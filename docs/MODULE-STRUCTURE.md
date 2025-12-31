# Module Structure & Examples

Slothlet supports sophisticated module organization patterns with seamless ESM/CJS interoperability. This guide demonstrates the various ways you can structure your API modules and how they map to the resulting API structure.

## Overview

Slothlet's intelligent module loader automatically transforms your file structure into a clean, intuitive API. It handles mixed ESM/CJS modules, automatic flattening, smart naming, and various export patterns.

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

## Root-Level Modules

Files at the root of your API directory become top-level API properties:

```text
api/
├── root-math.mjs     → api.rootMath (dash-to-camelCase)
├── rootstring.mjs    → api.rootstring
└── config.mjs        → api.config
```

**Example:**

```javascript
// api/root-math.mjs
export function add(a, b) {
	return a + b;
}

// Usage
const api = await slothlet({ dir: "./api" });
const result = api.rootMath.add(2, 3); // 5
```

## Filename-Folder Matching Modules

When a folder contains a single file with a matching name, slothlet automatically flattens the structure:

```text
api/
├── math/
│   └── math.mjs      → api.math (folder + filename match)
├── string/
│   └── string.mjs    → api.string
└── util/
	└── util.cjs      → api.util (CJS support)
```

**Example:**

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
const sum = api.math.add(2, 3); // Not api.math.math.add()
const diff = api.math.subtract(5, 2);
```

## Multi-File Modules

Folders with multiple files create nested API structures:

```text
api/
└── multi/
	├── alpha.mjs   → api.multi.alpha
	├── beta.mjs    → api.multi.beta
	└── gamma.cjs   → api.multi.gamma (mixed ESM/CJS)
```

**Example:**

```javascript
// api/multi/alpha.mjs
export function processAlpha(data) {
	return `Alpha: ${data}`;
}

// api/multi/beta.mjs
export function processBeta(data) {
	return `Beta: ${data}`;
}

// api/multi/gamma.cjs (CJS module)
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

## Function-Based Modules

Modules that export a default function become callable:

```text
api/
├── funcmod/
│   └── funcmod.mjs   → api.funcmod() (callable function)
└── multi_func/
	├── alpha.mjs     → api.multi_func.alpha()
	└── beta.cjs      → api.multi_func.beta() (CJS callable)
```

**Example:**

```javascript
// api/funcmod/funcmod.mjs
export default function(name) {
	return `Hello, ${name}!`;
}

// api/multi_func/alpha.mjs
export default function(value) {
	return value * 2;
}

// api/multi_func/beta.cjs (CJS default export)
module.exports = function(value) {
	return value * 3;
};

// Usage
const api = await slothlet({ dir: "./api" });
api.funcmod("Alice"); // "Hello, Alice!"
api.multi_func.alpha(5); // 10
api.multi_func.beta(5); // 15
```

## Mixed ESM/CJS Modules

Slothlet seamlessly handles mixed ESM and CJS modules in the same directory:

```text
api/
└── interop/
	├── esm-module.mjs → api.interop.esmModule
	├── cjs-module.cjs → api.interop.cjsModule
	└── mixed.mjs      → api.interop.mixed (calls both)
```

**Example:**

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

// api/interop/mixed.mjs - Can call both!
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

## Hybrid Export Patterns

Modules can export both a default function and named properties:

```text
api/
├── exportDefault/
│   └── exportDefault.mjs → api.exportDefault() (callable with methods)
└── objectDefaultMethod/
	└── method.mjs        → api.objectDefaultMethod() (object with default)
```

**Example:**

```javascript
// api/exportDefault/exportDefault.mjs
export default function logger(msg) {
	console.log(msg);
}

// Add methods to the default function
logger.info = (msg) => console.log(`[INFO] ${msg}`);
logger.error = (msg) => console.error(`[ERROR] ${msg}`);

export { logger };

// Usage
const api = await slothlet({ dir: "./api" });
api.exportDefault("Hello"); // Direct call
api.exportDefault.info("Info message"); // Method call
api.exportDefault.error("Error message"); // Method call
```

## Nested Structure

Slothlet supports deeply nested directory structures:

```text
api/
├── nested/
│   └── date/
│	   ├── date.mjs → api.nested.date
│	   └── util.cjs → api.nested.dateUtil
└── advanced/
	├── selfObject/  → api.advanced.selfObject
	└── nest*/       → Various nesting examples
```

**Example:**

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

## Utility Modules

Organize utility functions in nested structures:

```text
api/
└── util/
	├── controller.mjs → api.util.controller
	├── extract.cjs    → api.util.extract (CJS utility)
	└── url/
		├── parser.mjs → api.util.url.parser
		└── builder.cjs → api.util.url.builder (mixed)
```

**Example:**

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

## Smart Function Naming

Slothlet preserves function name capitalization for technical terms:

```text
api/
├── task/
│   └── auto-ip.mjs      → api.task.autoIP (preserves function name)
├── util/
│   └── parseJSON.mjs    → api.util.parseJSON (preserves JSON)
└── api/
	└── getHTTPStatus.mjs → api.api.getHTTPStatus (preserves HTTP)
```

**Example:**

```javascript
// api/task/auto-ip.mjs
// Function name takes precedence over filename
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
api.task.autoIP({ mode: "dhcp" }); // Not api.task.autoIp
api.util.parseJSON('{"key": "value"}'); // Not api.util.parseJson
api.api.getHTTPStatus(200); // Not api.api.getHttpStatus
```

## Key Principles

1. **Automatic Flattening**: When folder name matches single file name, structure is flattened
2. **Mixed Module Support**: ESM and CJS modules work seamlessly together
3. **Smart Naming**: Function names preserve technical term capitalization (IP, JSON, HTTP, API)
4. **Flexible Exports**: Support for default exports, named exports, and hybrid patterns
5. **Deep Nesting**: No limits on directory depth or complexity
6. **Universal Access**: All modules accessible through `self` binding in any other module

---

For more information, see:

- [API Flattening Rules](API-FLATTENING.md) - Detailed flattening logic
- [API Rules](API-RULES.md) - Complete transformation rules
- [README](../README.md) - Main project documentation
