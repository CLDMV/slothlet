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

In a consumer project, `@cldmv/slothlet` is an **externalized** `node_modules` dependency — and vitest externalizes `node_modules` by default. So slothlet runs as native Node code and that `import()` is a **native** import that never enters vitest's module runner / module graph. `@vitest/coverage-v8` attributes execution only for modules in that graph, so the leaf's execution instance (`…/leaf.mjs?slothlet_instance=…`) is invisible to it. The only coverage a leaf gets is the module-level baseline from `coverage.all` scanning `src/**` once — hence the floor with the whole function body reading as uncovered.

This is **not** a source-vs-`dist` issue. The `slothlet-dev` condition only changes which files resolve; it does not change externalization. The axis is **externalized vs inlined**. (slothlet's own repo does not hit this: there the loader is _project code_, transformed by vitest by default, so its `import()` rides the runner and the query-URL loads attribute via cross-file aggregation.)

## The fix: inline slothlet in your test config

Add `@cldmv/slothlet` to vitest's `deps.inline` so vitest runs it through its own module runner; the leaf imports then route through vitest and attribute correctly:

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

| Metric     | externalized (default) | `deps.inline` |
| ---------- | ---------------------- | ------------- |
| Lines      | 75%                    | 92%           |
| Statements | 75%                    | 91%           |
| Functions  | 80%                    | 95%           |

**Tradeoff:** the shipped `dist` is re-processed by Vite during tests rather than loaded byte-for-byte by Node — a small fidelity cost in exchange for accurate coverage attribution.

## Scope

The artifact appears with any setup that externalizes `node_modules` and attributes coverage from the runner's module graph (vitest + the v8 provider). It is independent of eager vs lazy mode and of the `slothlet-dev` condition — the deciding axis is externalized vs inlined, nothing else.
