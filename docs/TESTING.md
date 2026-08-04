# Testing a slothlet-composed API

This guide covers a coverage-measurement gotcha that surfaces when a **consumer** project — one that installs `@cldmv/slothlet` from npm — measures test coverage of its own API leaves.

## Coverage of composition-loaded leaves reads as (near-)zero

When a consumer measures coverage with `vitest` + `@vitest/coverage-v8`, any leaf reached **only through slothlet composition** reports near-zero coverage of its function body — even though the leaf executes and its output is asserted. The module-level lines (the `spec` / `default` export) attribute, but everything inside the exported functions reads as uncovered.

The functions genuinely run; the coverage collector simply never sees them. It looks like slothlet is "blocking" coverage, but it is purely a **measurement artifact** — worth knowing about so it doesn't cost a debugging session.

## Why it happens

Slothlet's loader imports each leaf with a native dynamic import carrying a per-instance cache-bust query (`src/lib/processors/loader.mjs`):

```js
const fileUrl = url.pathToFileURL(filePath).href;
const moduleUrl = `${fileUrl}?slothlet_instance=${instanceID}`; // cache-bust per instance
const module = await import(moduleUrl);
```

In a consumer project, `@cldmv/slothlet` is an **externalized** `node_modules` dependency — and vitest externalizes `node_modules` by default. So slothlet runs as native Node code and that `import()` is a **native** import that never enters vitest's module runner / module graph. `@vitest/coverage-v8` attributes execution only for modules in that graph, so the leaf's execution instance (`…/leaf.mjs?slothlet_instance=…`) is invisible to it. The only coverage a leaf gets is the module-level baseline from vitest's all-files scan over `coverage.include` (`src/**`) — the pass that reports every included file once, even ones no test imported. Hence the floor, with the whole function body reading as uncovered.

This is **not** a source-vs-`dist` issue. The `slothlet-dev` condition only changes which files resolve; it does not change externalization. The axis is **externalized vs inlined**. (slothlet's own repo does not hit this: there the loader is _project code_, transformed by vitest by default, so its `import()` rides the runner and the query-URL loads attribute via cross-file aggregation.)

## The fix: inline slothlet in your test config

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

No test changes are needed — this is purely a measurement fix, and all tests stay green. Measured on a real consumer project (same published `dist`, identical suite, only the config line added):

| Metric     | externalized (default) | `server.deps.inline` |
| ---------- | ---------------------- | -------------------- |
| Lines      | 75%                    | 92%                  |
| Statements | 75%                    | 91%                  |
| Functions  | 80%                    | 95%                  |

**Tradeoff:** the shipped `dist` is re-processed by Vite during tests rather than loaded byte-for-byte by Node — a small fidelity cost in exchange for accurate coverage attribution.

## The fidelity-preserving alternative: `slothlet({ import })`

Instead of inlining the whole package, hand the loader an importer bound to **your** module graph. The loader then routes every leaf load through it — with the exact cache-busted URL it would have imported natively (`?slothlet_instance=…`, `&module=…` for mounts, `&_reload=…` during reload), and the module namespace you resolve is used unchanged:

```js
// In your test setup (only under coverage, if you prefer):
const api = await slothlet({
	base: "./api",
	import: (url) => import(url) // YOUR import(), so the leaf rides YOUR runner's module graph
});
```

Because the `import()` executes in the consumer's (vitest-transformed) code, the leaf load enters the runner's module graph and attributes — while slothlet itself stays externalized and byte-for-byte native. Unset, the loader uses its own native import and nothing changes; per-instance isolation and hot reload behave identically either way, since everything that matters rides the URL.

A non-function value throws `INVALID_CONFIG_IMPORT` at construction.

Slothlet also detects the misattribution scenario itself: booting under a vitest **coverage** run (a plain test run stays quiet) while this slothlet copy is externalized and no `import` importer is configured emits a one-shot `WARNING_COVERAGE_IMPORTER_UNSET` pointing here. The detection reads vitest's worker state defensively — if vitest ever changes its internals the hint simply stops appearing; behavior never changes. `silent: true` suppresses it like any other warning.

**Trust model:** the importer controls what code loads for every leaf, so it carries the same authority as choosing `base` or `node_modules` — which is why it is host-only, boot-time configuration, like `versionDispatcher` and `resolveModuleSpecifier`. Never construct it from untrusted input; an importer built from external configuration is a code-injection point. (It grants modules nothing: in-process code can already `import()` natively — see the enforcement boundary in [PERMISSIONS.md](PERMISSIONS.md).)

## Scope

The artifact appears with any setup that externalizes `node_modules` and attributes coverage from the runner's module graph (vitest + the v8 provider). It is independent of eager vs lazy mode and of the `slothlet-dev` condition — the deciding axis is externalized vs inlined, nothing else.
