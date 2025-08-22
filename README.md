# @cldmv/slothlet

[![npm version](https://img.shields.io/npm/v/@cldmv/slothlet.svg)](https://www.npmjs.com/package/@cldmv/slothlet)
[![license](https://img.shields.io/github/license/CLDMV/slothlet.svg)](LICENSE)
![size](https://img.shields.io/npm/unpacked-size/@cldmv/slothlet.svg)
[![npm-downloads](https://img.shields.io/npm/dm/@cldmv/slothlet.svg)](https://www.npmjs.com/package/@cldmv/slothlet)
[![github-downloads](https://img.shields.io/github/downloads/CLDMV/slothlet/total)](https://github.com/CLDMV/slothlet/releases)

> **🚀 Production Ready Modes:**
>
> - **Eager Mode**: Fully stable and production-ready for immediate module loading
> - **Lazy Mode**: Production-ready with advanced copy-left materialization and 44x faster startup (1.3x slower function calls)
>
> **⚙️ Experimental Modes:**
>
> - **Worker, Fork, Child, VM modes**: In active development, not recommended for production use
>
> Please report issues and contribute feedback to help improve the experimental features.

**@cldmv/slothlet** is an advanced module loading framework that eliminates the pain of working with massive APIs in Node.js. Built for developers who need smart, efficient module loading without compromising on performance or developer experience.

Instead of loading everything upfront and watching your memory usage spike, slothlet intelligently loads only what you need, when you need it. Whether you want lazy loading for optimal memory usage or eager loading for maximum performance, slothlet adapts to your workflow.

With our new **copy-left materialization** in lazy mode, you get the best of both worlds: the memory efficiency of lazy loading with near-eager performance on repeated calls. Once a module is materialized, it stays materialized—no re-processing overhead.

The name might suggest we're taking it easy, but don't be fooled. Slothlet delivers speed where it counts, with smart optimizations that make your APIs fly.

"slothlet is anything but slow."

## ✨ Key Features

### 🎯 **Dual Loading Strategies**

- **Eager Loading**: Immediate loading for maximum performance in production environments
- **Lazy Loading**: Copy-left materialization with look-ahead proxies (44x faster startup, 1.3x slower calls after materialization)

### ⚡ Performance

- **📊 For comprehensive performance analysis, benchmarks, and recommendations, see [PERFORMANCE.md](PERFORMANCE.md)**

### 🔧 **Smart API Management**

- **Callable Interface**: Use `slothlet(options)` or `slothlet.create(options)` interchangeably
- **Automatic Flattening**: Single-file modules become direct API properties (`math/math.mjs` → `api.math`)
- **CamelCase Mapping**: Dash-separated names convert automatically (`root-math.mjs` → `api.rootMath`)
- **Hybrid Exports**: Support for callable APIs with methods, default + named exports, and mixed patterns

### 🔗 **Advanced Binding System**

- **Live Bindings**: Dynamic context and reference binding for runtime API mutation
- **Copy-Left Preservation**: Materialized functions stay materialized, preserving performance gains
- **Bubble-Up Updates**: Parent API synchronization ensures consistency across the API tree

### 🛠 **Developer Experience**

- **Descriptive Errors**: Clear, actionable error messages with full context
- **TypeScript-Friendly**: Comprehensive JSDoc annotations for excellent editor support
- **Configurable Debug**: Detailed logging for development and troubleshooting
- **Multiple Instances**: Parameter-based isolation for complex applications

### 🏗 **Architecture & Compatibility**

- **ESM-First**: Built for modern JavaScript with full ES module support
- **Zero Dependencies**: Lightweight footprint with no external dependencies
- **Cross-Platform**: Works seamlessly across all Node.js environments
- **Extensible**: Modular architecture designed for future plugin system (in development)

## 📦 Installation

```sh
npm install @cldmv/slothlet
```

## 🚀 Quick Start

### ESM (ES Modules)

```js
import slothlet from "@cldmv/slothlet";

// Direct usage - eager mode by default (auto-detects callable interface)
const api = await slothlet({
	dir: "./api",
	context: { user: "alice" }
});

// API calls are synchronous in eager mode (no await needed for API calls)
const result = api.math.add(2, 3); // 5

// If root function detected, API is also callable
const greeting = api("World"); // "Hello, World!" (if root function exists)
```

### CommonJS (CJS)

```js
const slothlet = require("@cldmv/slothlet");

// Same usage pattern works with CommonJS
const api = await slothlet({
	dir: "./api",
	context: { env: "production" }
});

const result = api.math.multiply(4, 5); // 20
```

### Lazy Loading Mode

```js
import slothlet from "@cldmv/slothlet";

// Lazy mode with copy-left materialization (opt-in)
const api = await slothlet({
	lazy: true,
	dir: "./api",
	apiDepth: 3
});
```

### Multiple Instances

```js
// When creating multiple instances, use parameter isolation
const { slothlet: slothlet1 } = await import("@cldmv/slothlet?_slothlet=instance1");
const { slothlet: slothlet2 } = await import("@cldmv/slothlet?_slothlet=instance2");

const api1 = await slothlet1({ dir: "./api1" });
const api2 = await slothlet2({ dir: "./api2" });
```

## 📚 API Reference

### Core Methods

#### `slothlet(options)` / `slothlet.create(options)`

Creates and loads an API instance with the specified configuration.

**Parameters:**

- `options` (object): Configuration options

**Returns:** `Promise<object>` - Bound API object

**Options:**

- `dir` (string): Directory to load API modules from. Can be absolute or relative path. If relative, resolved from process.cwd(). (default: `"api"`)
- `lazy` (boolean): Loading strategy - `true` for lazy loading (on-demand), `false` for eager loading (immediate) (default: `false`)
- `apiDepth` (number): Directory traversal depth control - `0` for root only, `Infinity` for all levels (default: `Infinity`)
- `debug` (boolean): Enable verbose logging. Can also be set via `--slothletdebug` command line flag or `SLOTHLET_DEBUG=true` environment variable (default: `false`)
- `mode` (string): Execution environment mode - `"singleton"`, `"vm"`, `"worker"`, or `"fork"` (default: `"singleton"`)
- `api_mode` (string): API structure behavior when root-level default functions exist:
  - `"auto"` (default): Automatically detects if root has default function export and creates callable API
  - `"function"`: Forces API to be callable (use when you have root-level default function exports)
  - `"object"`: Forces API to be object-only (use when you want object interface regardless of exports)
- `context` (object): Context data object injected into live-binding `context` reference. Available to all loaded modules via `import { context } from '@cldmv/slothlet'` (default: `{}`)
- `reference` (object): Reference object merged into the API root level. Properties not conflicting with loaded modules are added directly to the API (default: `{}`)

#### `slothlet.getApi()` → `object`

Returns the raw API object (Proxy or plain object).

#### `slothlet.getBoundApi()` → `object`

Returns the bound API object with context and reference.

#### `slothlet.isLoaded()` → `boolean`

Returns true if the API is loaded.

#### `slothlet.shutdown()` → `Promise<void>`

Gracefully shuts down the API and cleans up resources.

> **📚 For detailed API documentation with comprehensive parameter descriptions, method signatures, and examples, see [docs/API.md](docs/API.md)**

### Live Bindings

Access live-bound references in your API modules:

```js
// In your API modules
const { self, context, reference } = await import(
	new URL(`@cldmv/slothlet?_slothlet=${new URL(import.meta.url).searchParams.get("_slothlet") || ""}`, import.meta.url).href
);

export function myFunction() {
	console.log(context.user); // Access live context
	return self.otherModule.helper(); // Access other API modules
}
```

### API Mode Configuration

The `api_mode` option controls how slothlet handles root-level default function exports:

#### Auto-Detection (Recommended)

```js
const api = await slothlet({
	api_mode: "auto" // Default - automatically detects structure
});

// If you have a root-level function export:
// root-function.mjs: export default function(name) { return `Hello, ${name}!` }
// Result: api("World") works AND api.otherModule.method() works

// If you only have object exports:
// Result: api.math.add() works, api("World") doesn't exist
```

#### Explicit Function Mode

```js
const api = await slothlet({
	api_mode: "function" // Force callable interface
});

// Always creates callable API even without root default export
// Useful when you know you have root functions
const result = api("World"); // Calls root default function
const math = api.math.add(2, 3); // Also access other modules
```

#### Explicit Object Mode

```js
const api = await slothlet({
	api_mode: "object" // Force object-only interface
});

// Always creates object interface even with root default export
// api("World") won't work, but api.rootFunction("World") will
const result = api.rootFunction("World"); // Access via property
const math = api.math.add(2, 3); // Normal module access
```

## 🏗 Module Structure & Examples

The `api_test` folder demonstrates comprehensive module organization patterns:

### Root-Level Modules

```
root-math.mjs     → api.rootMath (dash-to-camelCase)
rootstring.mjs    → api.rootstring
config.mjs        → api.config
```

### Single-File Modules

```
math/math.mjs     → api.math (automatic flattening)
string/string.mjs → api.string
```

### Multi-File Modules

```
multi/
  ├── alpha.mjs   → api.multi.alpha
  └── beta.mjs    → api.multi.beta
```

### Function-Based Modules

```
funcmod/funcmod.mjs → api.funcmod() (callable function)
multi_func/
  ├── alpha.mjs     → api.multi_func.alpha()
  └── beta.mjs      → api.multi_func.beta()
```

### Hybrid Export Patterns

```
exportDefault/exportDefault.mjs → api.exportDefault() (callable with methods)
objectDefaultMethod/            → api.objectDefaultMethod() (object with default)
```

### Nested Structure

```
nested/
  └── date/
      └── date.mjs → api.nested.date
advanced/
  ├── selfObject/  → api.advanced.selfObject
  └── nest*/       → Various nesting examples
```

### Utility Modules

```
util/
  ├── controller/  → api.util.controller
  ├── extract/     → api.util.extract
  └── url/         → api.util.url
```

### Eager Mode (Default)

```js
const api = await slothlet({ dir: "./api" }); // lazy: false by default

// All modules loaded upfront - always fast, no await needed
const result = api.math.add(2, 3); // Always fast
const greeting = api("World"); // Instant if callable
```

### Lazy Mode with Copy-Left Materialization (Opt-in)

```js
const api = await slothlet({ lazy: true, dir: "./api" });

// First access: ~33μs (materialization overhead)
const result1 = await api.math.add(2, 3);

// Subsequent access: ~0.5μs (materialized function)
const result2 = await api.math.add(5, 7); // 70x faster than first call!
```

**Quick Summary:**

- **Startup**: Lazy wins (44x faster - 91μs vs 4ms)
- **Function calls**: Eager wins (1.3x faster - 0.36μs vs 0.46μs)
- **Memory**: Lazy wins (loads only what you use)
- **Predictability**: Eager wins (no materialization delays)

## 🛡 Error Handling

Slothlet provides descriptive errors with full context:

```js
try {
	await api.nonexistent.method();
} catch (error) {
	// Error includes requested path, directory, and suggestions
	console.error(error.message);
}
```

## 🔧 Production vs Development Modes

### Production Ready ✅

- **Eager Mode**: Stable, battle-tested, maximum performance
- **Lazy Mode**: Production-ready with copy-left optimization
- **Singleton Mode**: Default mode for standard applications

### Experimental ⚠️

- **Worker Mode**: Thread isolation (in development)
- **Fork Mode**: Process isolation (in development)
- **Child Mode**: Child process execution (in development)
- **VM Mode**: Virtual machine context (in development)

The experimental modes are located in `src/lib/engine/` and should not be used in production environments.

## 🤝 Contributing

We welcome contributions! The experimental modes in particular need development and testing. Please:

1. Review the code in `src/lib/engine/` for experimental features
2. Report issues with detailed reproduction steps
3. Submit pull requests with tests
4. Provide feedback on API design and performance

## 📄 License

Apache-2.0 © Shinrai / CLDMV
