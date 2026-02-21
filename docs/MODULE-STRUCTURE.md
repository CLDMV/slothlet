# Module Structure & Examples

Slothlet supports sophisticated module organization patterns with seamless ESM/CJS interoperability. This guide demonstrates the various ways you can structure your API modules and how they map to the resulting API structure.

## Overview

Slothlet's module loader automatically transforms your file structure into a clean, intuitive API. It handles mixed ESM/CJS modules, automatic flattening, smart naming, and various export patterns — with no configuration required for common cases.

## Table of Contents

- [Root-Level Modules](#root-level-modules)
- [Filename-Folder Matching Modules](#filename-folder-matching-modules)
- [Multi-File Modules](#multi-file-modules)
- [Function-Based Modules](#function-based-modules)
- [Mixed ESM/CJS Modules](#mixed-esmcjs-modules)
- [Hybrid Export Patterns](#hybrid-export-patterns)
- [Nested Structure](#nested-structure)
- [Utility Modules](#utility-modules)
- [Smart Function Naming](#smart-function-naming)
- [TypeScript Modules](#typescript-modules)

---

## Root-Level Modules

Files at the root of your API directory become top-level API properties. Dash-separated filenames are converted to camelCase:

```text
api/
├── root-math.mjs     → api.rootMath
├── rootstring.mjs    → api.rootstring
└── config.mjs        → api.config
```

```javascript
// api/root-math.mjs
export function add(a, b) {
	return a + b;
}

// Usage
const api = await slothlet({ dir: "./api" });
const result = api.rootMath.add(2, 3); // 5
```

---

## Filename-Folder Matching Modules

When a folder contains a single file whose name matches the folder name, slothlet automatically flattens the structure — the intermediate namespace is eliminated:

```text
api/
├── math/
│   └── math.mjs      → api.math   (not api.math.math)
├── string/
│   └── string.mjs    → api.string
└── util/
    └── util.cjs      → api.util
```

```javascript
// api/math/math.mjs
export function add(a, b) {
	return a + b;
}

export function subtract(a, b) {
	return a - b;
}

// Usage
const api = await slothlet({ dir: "./api" });
const sum = api.math.add(2, 3);       // ✅ not api.math.math.add()
const diff = api.math.subtract(5, 2);
```

See [API Flattening Rules](API-RULES/API-FLATTENING.md) for the full set of flattening patterns.

---

## Multi-File Modules

Folders with multiple files create namespaced API structures. Each file becomes a sub-key:

```text
api/
└── multi/
    ├── alpha.mjs   → api.multi.alpha
    ├── beta.mjs    → api.multi.beta
    └── gamma.cjs   → api.multi.gamma
```

```javascript
// api/multi/alpha.mjs
export function processAlpha(data) {
	return `Alpha: ${data}`;
}

// api/multi/beta.mjs
export function processBeta(data) {
	return `Beta: ${data}`;
}

// api/multi/gamma.cjs
function processGamma(data) {
	return `Gamma: ${data}`;
}
module.exports = { processGamma };

// Usage
const api = await slothlet({ dir: "./api" });
api.multi.alpha.processAlpha("test");
api.multi.beta.processBeta("test");
api.multi.gamma.processGamma("test"); // CJS works seamlessly
```

---

## Function-Based Modules

Modules that export a default function become callable directly at their API path:

```text
api/
├── funcmod/
│   └── funcmod.mjs   → api.funcmod()        (callable)
└── multi_func/
    ├── alpha.mjs     → api.multi_func.alpha()
    └── beta.cjs      → api.multi_func.beta()
```

```javascript
// api/funcmod/funcmod.mjs
export default function(name) {
	return `Hello, ${name}!`;
}

// api/multi_func/alpha.mjs
export default function(value) {
	return value * 2;
}

// api/multi_func/beta.cjs
module.exports = function(value) {
	return value * 3;
};

// Usage
const api = await slothlet({ dir: "./api" });
api.funcmod("Alice");         // "Hello, Alice!"
api.multi_func.alpha(5);      // 10
api.multi_func.beta(5);       // 15
```

---

## Mixed ESM/CJS Modules

ESM and CJS modules coexist transparently in the same directory. CJS `module.exports` is treated equivalently to an ESM `export default` — no `.default` wrapper is introduced:

```text
api/
└── interop/
    ├── esm-module.mjs → api.interop.esmModule
    ├── cjs-module.cjs → api.interop.cjsModule
    └── mixed.mjs      → api.interop.mixed
```

```javascript
// api/interop/esm-module.mjs
export function esmFunction(data) {
	return `ESM: ${data}`;
}

// api/interop/cjs-module.cjs
function cjsFunction(data) {
	return `CJS: ${data}`;
}
module.exports = { cjsFunction };

// api/interop/mixed.mjs — can call both through self
import { self } from "@cldmv/slothlet/runtime";

export function callBoth(data) {
	const esmResult = self.interop.esmModule.esmFunction(data);
	const cjsResult = self.interop.cjsModule.cjsFunction(data);
	return { esmResult, cjsResult };
}

// Usage
const api = await slothlet({ dir: "./api" });
api.interop.esmModule.esmFunction("test");
api.interop.cjsModule.cjsFunction("test");
api.interop.mixed.callBoth("test");
```

> **CJS default exports**: `module.exports = { fn }` is always accessible directly as `api.module.fn` — never as `api.module.default.fn`. Slothlet normalizes the CJS `default` wrapper so CJS and ESM modules have identical access patterns.

---

## Hybrid Export Patterns

Modules can export both a default function and named properties. The default function becomes the callable entry point; named exports become methods on it:

```text
api/
└── exportDefault/
    └── exportDefault.mjs → api.exportDefault()  (callable with .info / .error methods)
```

```javascript
// api/exportDefault/exportDefault.mjs
export default function logger(msg) {
	console.log(msg);
}

logger.info = (msg) => console.log(`[INFO] ${msg}`);
logger.error = (msg) => console.error(`[ERROR] ${msg}`);

export { logger };

// Usage
const api = await slothlet({ dir: "./api" });
api.exportDefault("Hello");           // Direct call
api.exportDefault.info("Info");       // Method call
api.exportDefault.error("Error");     // Method call
```

---

## Nested Structure

Slothlet supports arbitrarily deep directory structures:

```text
api/
├── nested/
│   └── date/
│       ├── date.mjs    → api.nested.date
│       └── util.cjs    → api.nested.dateUtil
└── advanced/
    └── self-object/    → api.advanced.selfObject
```

```javascript
// api/nested/date/date.mjs
export function formatDate(date) {
	return date.toISOString();
}

// api/nested/date/util.cjs
function parseDate(str) {
	return new Date(str);
}
module.exports = { parseDate };

// Usage
const api = await slothlet({ dir: "./api" });
const formatted = api.nested.date.formatDate(new Date());
const parsed = api.nested.dateUtil.parseDate("2025-12-30");
```

---

## Utility Modules

Utility modules follow the same structural rules. Mixed ESM/CJS works at any depth:

```text
api/
└── util/
    ├── controller.mjs → api.util.controller
    ├── extract.cjs    → api.util.extract
    └── url/
        ├── parser.mjs  → api.util.url.parser
        └── builder.cjs → api.util.url.builder
```

```javascript
// api/util/controller.mjs
export function handleRequest(req) {
	return { status: 200, data: req };
}

// api/util/extract.cjs
function extractData(obj, key) {
	return obj[key];
}
module.exports = { extractData };

// api/util/url/parser.mjs
export function parseUrl(url) {
	return new URL(url);
}

// api/util/url/builder.cjs
function buildUrl(base, path) {
	return `${base}/${path}`;
}
module.exports = { buildUrl };

// Usage
const api = await slothlet({ dir: "./api" });
api.util.controller.handleRequest({ data: "test" });
api.util.extract.extractData({ key: "value" }, "key");
api.util.url.parser.parseUrl("https://example.com");
api.util.url.builder.buildUrl("https://example.com", "path");
```

---

## Smart Function Naming

Slothlet preserves function name capitalization for technical acronyms. When a module's exported function name contains an acronym (IP, JSON, HTTP, API, etc.), Slothlet uses the function's own name as the API key rather than deriving it from the filename:

```text
api/
├── task/
│   └── auto-ip.mjs      → api.task.autoIP    (not autoIp)
├── util/
│   └── parseJSON.mjs    → api.util.parseJSON  (not parseJson)
└── api/
    └── getHTTPStatus.mjs → api.api.getHTTPStatus
```

```javascript
// api/task/auto-ip.mjs — function name takes precedence over filename
export function autoIP(config) {
	return "192.168.1.1";
}

// api/util/parseJSON.mjs
export function parseJSON(str) {
	return JSON.parse(str);
}

// api/api/getHTTPStatus.mjs
export function getHTTPStatus(code) {
	return code === 200 ? "OK" : "Error";
}

// Usage
const api = await slothlet({ dir: "./api" });
api.task.autoIP({ mode: "dhcp" });        // not .autoIp
api.util.parseJSON('{"key": "value"}');   // not .parseJson
api.api.getHTTPStatus(200);               // not .getHttpStatus
```

---

## TypeScript Modules

Slothlet supports TypeScript modules with two transpilation strategies. TypeScript is a peer dependency — install only what you need.

### Fast Mode (esbuild)

```bash
npm install esbuild
```

```text
api/
├── math.ts        → api.math
└── utils.ts       → api.utils
```

```typescript
// api/math.ts
export function add(a: number, b: number): number {
	return a + b;
}

export function multiply(a: number, b: number): number {
	return a * b;
}
```

```javascript
const api = await slothlet({
	dir: "./api",
	typescript: { mode: "fast" } // uses esbuild
});

api.math.add(2, 3);      // 5
api.math.multiply(3, 4); // 12
```

### Strict Mode (tsc)

```bash
npm install typescript
```

```javascript
const api = await slothlet({
	dir: "./api",
	typescript: { mode: "strict" } // uses tsc, respects tsconfig.json
});
```

TypeScript modules (`.ts`) follow all the same structural rules as ESM modules — flattening, function naming, and nesting all behave identically.

---

## Key Principles

1. **Automatic Flattening**: When a folder name matches its single file's name, the intermediate namespace is eliminated
2. **Transparent CJS/ESM**: ESM and CJS modules have identical access patterns — no `.default` wrapper
3. **Smart Naming**: Exported function names (including acronyms) take precedence over filenames for the API key
4. **Flexible Exports**: Default exports, named exports, and hybrid patterns (callable + methods) are all supported
5. **Unlimited Depth**: No constraints on directory depth or complexity
6. **Universal Access**: All modules are accessible through the `self` live binding from any other module

---

## See Also

- [API Flattening Rules](API-RULES/API-FLATTENING.md) — Detailed flattening logic and all 8 patterns
- [API Rules](API-RULES.md) — Complete 13-rule transformation catalog
- [README](../README.md) — Main project documentation
