# Testing a slothlet-composed API

This guide covers a coverage-measurement gotcha that surfaces when a **consumer** project — one that installs `@cldmv/slothlet` from npm — measures test coverage of its own API leaves.

## Coverage of composition-loaded leaves reads as (near-)zero

When a consumer measures coverage with `vitest` + `@vitest/coverage-v8`, any leaf reached **only through slothlet composition** reports near-zero coverage of its function body — even though the leaf executes and its output is asserted. The module-level lines (the `spec` / `default` export) attribute, but everything inside the exported functions reads as uncovered.

The functions genuinely run; the coverage collector just can't attribute them correctly. It looks like slothlet is "blocking" coverage, but it is a **measurement artifact** — worth knowing about so it doesn't cost a debugging session.

## Why it happens

Slothlet's loader imports each leaf with a native dynamic import carrying a per-instance cache-bust query (`src/lib/processors/loader.mjs`):

```js
const fileUrl = url.pathToFileURL(filePath).href;
const moduleUrl = `${fileUrl}?slothlet_instance=${instanceID}`; // cache-bust per instance
const module = await import(moduleUrl);
```

In a consumer project, `@cldmv/slothlet` is an **externalized** `node_modules` dependency — and vitest externalizes `node_modules` by default. So slothlet runs as native Node code and that `import()` is a **native** import that never enters vitest's module runner / module graph.

That native load is not invisible to `@vitest/coverage-v8` — it is collected and **mis-mapped**. V8 records the leaf's execution against the raw file (`…/leaf.mjs?slothlet_instance=…`), and the provider maps those raw-file offsets onto vite's _transformed_ code for the same path. The offsets don't line up, so functions that never ran can be marked executed and functions that did run can read as uncovered. Measured on one consumer (vitest 4.1.7), a function V8 reported at its raw offset with a count of 0 was nevertheless marked executed, along with several of its neighbours. Numbers taken without one of the fixes below are therefore **unreliable in both directions**, and the change in totals after applying a fix is not a measure of how much coverage improved: on that consumer, line coverage _dropped_ from 58.1% to 56.9% once leaves attributed correctly, because inflated false coverage was removed along with the false misses.

This is **not** a source-vs-`dist` issue. The `slothlet-dev` condition only changes which files resolve; it does not change externalization. The axis is **externalized vs inlined**. (slothlet's own repo does not hit this: there the loader is _project code_, transformed by vitest by default, so its `import()` rides the runner and the query-URL loads attribute via cross-file aggregation.)

## Fix 1: inline slothlet in your test config

Add `@cldmv/slothlet` to vitest's `server.deps.inline` so vitest runs it through its own module runner; the leaf imports then route through vitest and attribute correctly:

```js
// vitest.config.mjs
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		server: { deps: { inline: [/@cldmv\/slothlet/] } },
		coverage: { provider: "v8", include: ["src/**"] }
	}
});
```

No test changes are needed to get correct attribution. Measured on a real consumer project (same published `dist`, identical suite, only the config line added):

| Metric     | externalized (default) | `server.deps.inline` |
| ---------- | ---------------------- | -------------------- |
| Lines      | 75%                    | 92%                  |
| Statements | 75%                    | 91%                  |
| Functions  | 80%                    | 95%                  |

(As explained above, the "externalized" column is not a trustworthy baseline; the right-hand column is the real figure.)

Inlining has costs beyond fidelity:

- **Fidelity.** The shipped `dist` is re-processed by Vite during tests rather than loaded byte-for-byte by Node.
- **Speed.** Composition becomes noticeably slower. Measured on one consumer (vitest 4.1.7), the first composing test went from 1.1–1.8 s to 6.0–9.5 s and vitest's transform time from ~0.2 s to 22–28 s. Suites that compose an api per test may need a larger `hookTimeout` / `testTimeout`; one of two full inline runs there hit `Hook timed out in 10000ms` in a `beforeEach` composition.
- **Timing.** The slower boot can expose latent races in the tests themselves — for example, a worker's first message arriving before the test attached its handler.
- **Files outside the workspace (vitest 3 / vite-node).** With slothlet inlined, every leaf load goes through vite, and vite only loads files inside `server.fs.allow`. Leaves written to `os.tmpdir()` (or anywhere else outside the project) then fail with `MODULE_IMPORT_FAILED … Cannot find module '/tmp/…/leaf.mjs?slothlet_instance=…'`. Extend the allow-list — `server: { fs: { allow: [projectRoot, os.tmpdir()] } }` at the top level of the config. The same limit applies to the `import` hook below, and to a test file's own `import()` of such a path. This was observed on vitest 3.2.4; the same probe loaded fine on vitest 5.
- **A second runtime copy for `.cjs` leaves.** A `.cjs` leaf is loaded natively by `require`, outside vite, so its `await import("@cldmv/slothlet/runtime")` resolves Node's copy of the runtime while the inlined slothlet uses vite's copy. The leaf then sees no active context: `self` access throws `RUNTIME_NO_ACTIVE_CONTEXT_SELF`. Measured on vitest 5.0.2. Use the `import` hook instead when any `.cjs` leaf uses the runtime.

## Fix 2 (recommended): `slothlet({ import })`

Instead of inlining the whole package, hand the loader an importer bound to **your** module graph. The loader then routes every leaf load through it — with the exact cache-busted URL it would have imported natively (`?slothlet_instance=…`, `&module=…` for mounts, `&_reload=…` during reload), and the module namespace you resolve is used unchanged:

```js
// In your test setup (only under coverage, if you prefer):
const api = await slothlet({
	base: "./api",
	import: (url) => import(url) // YOUR import(), so the leaf rides YOUR runner's module graph
});
```

Because the `import()` executes in the consumer's (vitest-transformed) code, the leaf load enters the runner's module graph and attributes — while slothlet itself stays externalized and byte-for-byte native. Unset, the loader uses its own native import and nothing changes; per-instance isolation and hot reload behave identically either way, since everything that matters rides the URL.

This keeps a single copy of slothlet and its runtime, so `.cjs` leaves that use `@cldmv/slothlet/runtime` keep working, and `.cjs` leaves themselves attribute correctly without any setting (they load through a native `require` of the plain path). Prefer it over inlining. Don't combine the two: with `server.deps.inline` also set, the `.cjs` runtime problem above comes back.

A non-function value throws `INVALID_CONFIG_IMPORT` at construction.

Slothlet also detects the misattribution scenario itself: booting under a vitest **coverage** run (a plain test run stays quiet) while this slothlet copy is externalized and no `import` importer is configured emits a one-shot `WARNING_COVERAGE_IMPORTER_UNSET` pointing here. The detection reads vitest's worker state defensively — if vitest ever changes its internals the hint simply stops appearing; behavior never changes. `silent: true` suppresses it like any other warning.

**Trust model:** the importer controls what code loads for every leaf, so it carries the same authority as choosing `base` or `node_modules` — which is why it is host-only, boot-time configuration, like `versionDispatcher` and `resolveModuleSpecifier`. Never construct it from untrusted input; an importer built from external configuration is a code-injection point. (It grants modules nothing: in-process code can already `import()` natively — see the enforcement boundary in [PERMISSIONS.md](PERMISSIONS.md).)

## TypeScript leaves

A `.ts` / `.mts` leaf never executes from its own file. Slothlet transpiles it and imports the output from a cache file, `<package root>/.slothlet-cache/<pid>-<instanceID>/<hash>.mjs`, where the package root is the nearest directory above the leaf with a `package.json`. (A leaf with no `package.json` above it is cached in a private directory under `os.tmpdir()` instead, which no coverage `include` can reach — keep TypeScript leaves inside a package.) Coverage of a TypeScript leaf reaches the `.ts` source only through the **inline source map** in that cache file. Two things are needed:

1. **Source maps on.** `typescript.sourcemap` turns on automatically during a coverage run — a vitest run with coverage enabled, or a process started with `NODE_V8_COVERAGE` set (c8, or Node's native coverage) — so leave it unset. An explicit `sourcemap: false` wins; with it, a coverage run that loads TypeScript leaves emits a one-shot `WARNING_COVERAGE_TS_SOURCEMAP_OFF`, because that coverage can only land on the cache copies. Relative `.ts` imports between your modules are cached and mapped the same way.
2. **The cache directory in `coverage.include`.** `@vitest/coverage-v8` filters coverage by the file that _executed_ — the cache `.mjs` — before it remaps through the source map. With `include: ["src/**"]` alone, the cache files are dropped before remapping and every TypeScript leaf reports 0%. Add `**/.slothlet-cache/**`; after remapping, the results land on your `.ts` files and the cache files themselves do not appear in the report.

A complete config for a mixed `.mjs` / `.cjs` / `.ts` api under `api/`:

```js
// vitest.config.mjs
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
			include: ["api/**", "**/.slothlet-cache/**"]
		}
	}
});
```

```js
// api.test.mjs
import { test, expect } from "vitest";
import slothlet from "@cldmv/slothlet";

test("composes", async () => {
	const api = await slothlet({
		base: new URL("./api", import.meta.url).pathname,
		typescript: "fast", // sourcemap left unset: on during coverage
		import: (url) => import(url)
	});
	expect(api.typed.pick(true)).toBe("r");
	await api.slothlet.shutdown();
});
```

With this setup (vitest 5.0.2, `@vitest/coverage-v8` 5.0.2), the `.ts` leaf reported its exact uncovered lines — including an enum and an untaken branch — alongside the `.mjs` and `.cjs` leaves. Dropping `**/.slothlet-cache/**` from `include`, or setting `sourcemap: false`, left the `.ts` leaf at 0%. Per-instance isolation is unaffected.

### Plain Node with c8

Outside vitest, c8 (or any tool built on `NODE_V8_COVERAGE`) remaps TypeScript leaves the same way. c8 sets `NODE_V8_COVERAGE`, so source maps turn on automatically, and Node records each loaded module's source map into the coverage output, which c8 uses to remap the cache files onto the `.ts` sources:

```bash
npx c8 --include "api/**" --include "**/.slothlet-cache/**" node app-test.mjs
```

`--enable-source-maps` is not needed for coverage; it only changes stack traces.

## Scope

The `.mjs` artifact appears with any setup that externalizes `node_modules` and attributes coverage from the runner's module graph (vitest + the v8 provider). It is independent of eager vs lazy mode and of the `slothlet-dev` condition — the deciding axis is externalized vs inlined, nothing else. The TypeScript requirements (source maps and the cache directory in `include`) apply in every setup, including inlined slothlet and slothlet's own repo.
