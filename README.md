# @cldmv/slothlet

**@cldmv/slothlet** is a sophisticated module loading framework that revolutionizes how you work with massive APIs in Node.js. Built for developers who demand smart, efficient module loading without compromising performance or developer experience.

Choose your loading strategy based on your needs: **lazy mode** loads modules on-demand for faster startup and lower memory usage, while **eager mode** loads everything upfront for maximum runtime performance and predictable behavior.

With our **copy-left materialization** in lazy mode, you get the best of both worlds: the memory efficiency of on-demand loading with near-eager performance on repeated calls. Once a module is materialized, it stays materialized—no re-processing overhead.

The name might suggest we're taking it easy, but don't be fooled. **Slothlet delivers speed where it counts**, with smart optimizations that make your APIs fly.

> _"slothlet is anything but slow."_

[![npm version]][npm_version_url] [![npm downloads]][npm_downloads_url] <!-- [![GitHub release]][github_release_url] -->[![GitHub downloads]][github_downloads_url] [![Last commit]][last_commit_url] <!-- [![Release date]][release_date_url] -->[![npm last update]][npm_last_update_url]

> [!NOTE]  
> **🚀 Production Ready Modes:**
>
> - **Eager Mode**: Fully stable and production-ready for immediate module loading
> - **Lazy Mode**: Production-ready with advanced copy-left materialization and 4.3x faster startup (1.1x slower function calls)

> [!CAUTION]  
> **⚙️ Experimental Modes:**
>
> - **Worker, Fork, Child, VM modes**: In active development, not recommended for production use
>
> Please report issues and contribute feedback to help improve the experimental features.

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

---

## ✨ What's New in v2.0

### 🎯 **Complete Architectural Rewrite**

v2.0 represents a ground-up rewrite with enterprise-grade features:

- **Universal Module Support**: Load both ESM (`.mjs`) and CommonJS (`.cjs`) files seamlessly
- **AsyncLocalStorage Integration**: Advanced context isolation and live-binding system
- **4.3x Faster Startup**: Lazy mode achieves 564.17μs vs 2.45ms in eager mode
- **Copy-Left Materialization**: Once loaded, modules stay materialized for optimal performance
- **Zero Dependencies**: Pure Node.js implementation with no external dependencies

### 🏗️ **Enhanced Architecture**

- **Modular Design**: Organized into `engine/`, `modes/`, `runtime/`, and `helpers/`
- **Live-Binding System**: Dynamic context and reference binding with runtime coordination
- **Smart Function Naming**: Preserves original capitalization (`autoIP`, `parseJSON`, `getHTTPStatus`)
- **Multi-Execution Environments**: Singleton, VM, worker, fork isolation modes (experimental)

### 📊 **Performance Optimizations**

- **Startup**: Lazy mode 4.3x faster (564.17μs vs 2.45ms)
- **Function Calls**: Eager mode 1.1x faster (0.65μs vs 0.72μs) after materialization
- **Memory**: On-demand loading scales with actual usage
- **Predictability**: Consistent performance characteristics per mode

---

## 🚀 Key Features

### 🎯 **Dual Loading Strategies**

- **Eager Loading**: Immediate loading for maximum performance in production environments
- **Lazy Loading**: Copy-left materialization with look-ahead proxies (4.3x faster startup, 1.1x slower calls after materialization)

> [!IMPORTANT]  
> **Function Call Patterns:**
>
> - **Lazy Mode**: ALL function calls must be awaited (`await api.math.add(2, 3)`) due to materialization process
> - **Eager Mode**: Functions behave as originally defined - sync functions are sync (`api.math.add(2, 3)`), async functions are async (`await api.async.process()`)

### ⚡ Performance Excellence

- **📊 For comprehensive performance analysis, benchmarks, and recommendations, see [PERFORMANCE.md](PERFORMANCE.md)**

### 🔧 **Smart API Management**

- **Callable Interface**: Use `slothlet(options)` for direct API creation
- **Automatic Flattening**: Single-file modules become direct API properties (`math/math.mjs` → `api.math`)
- **Intelligent Naming**: Dash-separated names convert automatically (`root-math.mjs` → `api.rootMath`)
- **Function Name Preservation**: Maintains original capitalization (`auto-ip.mjs` with `autoIP` → `api.autoIP`)
- **Hybrid Exports**: Support for callable APIs with methods, default + named exports, and mixed patterns

> [!TIP]  
> **📁 For comprehensive examples of API flattening, naming conventions, and function preservation patterns, see the test modules in [api_tests/](api_tests/) and their documentation in [docs/api_tests/](docs/api_tests/)**

### 🔗 **Advanced Binding System**

- **Live Bindings**: Dynamic context and reference binding for runtime API mutation
- **AsyncLocalStorage**: Per-instance context isolation with seamless integration
- **Copy-Left Preservation**: Materialized functions stay materialized, preserving performance gains
- **Bubble-Up Updates**: Parent API synchronization ensures consistency across the API tree
- **Mixed Module Support**: Seamlessly blend ESM and CommonJS modules in the same API

### 🛠 **Developer Experience**

- **Standard Error Handling**: Clear JavaScript errors with plans for enhanced descriptive errors in v2.1.0
- **TypeScript-Friendly**: Comprehensive JSDoc annotations for excellent editor support with auto-generated declarations
- **Configurable Debug**: Detailed logging for development and troubleshooting via CLI flags or environment variables
- **Multiple Instances**: Parameter-based isolation for complex applications with instance ID management
- **Development Checks**: Built-in environment detection with silent production behavior

### 🏗 **Architecture & Compatibility**

- **ESM-First**: Built for modern JavaScript with full ES module support
- **Universal Loading**: CommonJS and ESM files work together seamlessly
- **Zero Dependencies**: Lightweight footprint with no external dependencies
- **Cross-Platform**: Works seamlessly across all Node.js environments
- **Extensible**: Modular architecture designed for future plugin system (in development)

---

## 📦 Installation

### Requirements

- **Node.js v16.4.0 or higher** (for stable AsyncLocalStorage support)
- **ESM support** (ES modules with `import`/`export`)

> [!IMPORTANT]  
> **v2.x Breaking Change**: Slothlet v2.x requires AsyncLocalStorage for its comprehensive live-binding system, which was stabilized in Node.js v16.4.0+ (June 2021). If you need older Node.js versions, please use slothlet v1.x (which requires Node.js v12.20.0+ (November 2020) for ESM support, dynamic imports, and query string imports). Note that v1.x live-binding worked in ESM (including multiple APIs via query strings) but was not available for multiple API instances in CommonJS.

### Install

```bash
npm install @cldmv/slothlet
```

---

## 🚀 Quick Start

### ESM (ES Modules)

```javascript
import slothlet from "@cldmv/slothlet";

// Direct usage - eager mode by default (auto-detects callable interface)
const api = await slothlet({
	dir: "./api",
	context: { user: "alice" }
});

// Eager mode: Functions behave as originally defined
const result = api.math.add(2, 3); // Sync function - no await needed
const greeting = api("World"); // Instant if callable

// Original async functions still need await in eager mode
const asyncResult = await api.async.processData({ data: "async" });

// Access both ESM and CJS modules seamlessly
const esmResult = api.mathEsm.multiply(4, 5); // 20 (sync)
const cjsResult = await api.mathCjs.divide(10, 2); // 5 (if originally async)
```

### CommonJS (CJS)

```javascript
const slothlet = require("@cldmv/slothlet");

// Same usage pattern works with CommonJS
const api = await slothlet({
	dir: "./api",
	context: { env: "production" }
});

const result = api.math.multiply(4, 5); // 20
const mixedResult = await api.interop.processData({ data: "test" }); // CJS+ESM interop
```

### Lazy Loading Mode

```javascript
import slothlet from "@cldmv/slothlet";

// Lazy mode with copy-left materialization (opt-in)
const api = await slothlet({
	lazy: true,
	dir: "./api",
	apiDepth: 3
});

// First access: ~310μs (materialization overhead)
const result1 = await api.math.add(2, 3);

// Subsequent access: ~0.5μs (materialized function)
const result2 = await api.math.add(5, 7); // 700x faster than first call!
```

### Advanced Configuration

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	lazy: false, // Loading strategy
	api_mode: "auto", // API structure behavior
	apiDepth: Infinity, // Directory traversal depth
	debug: false, // Enable verbose logging
	context: {
		// Injected into live-binding
		user: "alice",
		env: "production",
		config: { timeout: 5000 }
	},
	reference: {
		// Merged into API root
		version: "2.0.0",
		helpers: {
			/* ... */
		}
	}
});
```

### Multiple Instances

In v2.x, each call to `slothlet(options)` automatically creates a new isolated instance with its own context and configuration:

#### ESM (ES Modules)

```javascript
import slothlet from "@cldmv/slothlet";

// Each call creates a new isolated instance automatically
const api1 = await slothlet({ dir: "./api1", context: { tenant: "alice" } });
const api2 = await slothlet({ dir: "./api2", context: { tenant: "bob" } });

// Instances are completely isolated
console.log(api1.context.tenant); // "alice"
console.log(api2.context.tenant); // "bob"
```

#### CommonJS (CJS)

```javascript
const slothlet = require("@cldmv/slothlet");

// Each call creates a new isolated instance automatically
const api1 = await slothlet({ dir: "./api1", context: { tenant: "alice" } });
const api2 = await slothlet({ dir: "./api2", context: { tenant: "bob" } });

// Instances are completely isolated with their own AsyncLocalStorage contexts
console.log(api1.context.tenant); // "alice"
console.log(api2.context.tenant); // "bob"
```

> [!NOTE]  
> **v2.x Simplification**: Unlike v1.x which required query string parameters or `withInstanceId()` methods, v2.x automatically creates isolated instances with each `slothlet()` call, leveraging AsyncLocalStorage for complete context separation.

---

## 📚 API Reference

### Core Methods

#### `slothlet(options)` ⇒ `Promise<object>`

Creates and loads an API instance with the specified configuration.

**Parameters:**

| Param   | Type     | Description           |
| ------- | -------- | --------------------- |
| options | `object` | Configuration options |

**Returns:** `Promise<object>` - The bound API object

**Options:**

| Option      | Type      | Default       | Description                                                                                                                                                                                                                                                                                                                                                                        |
| ----------- | --------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dir`       | `string`  | `"api"`       | Directory to load API modules from. Can be absolute or relative path. If relative, resolved from process.cwd().                                                                                                                                                                                                                                                                    |
| `lazy`      | `boolean` | `false`       | Loading strategy - `true` for lazy loading (on-demand), `false` for eager loading (immediate)                                                                                                                                                                                                                                                                                      |
| `apiDepth`  | `number`  | `Infinity`    | Directory traversal depth control - `0` for root only, `Infinity` for all levels                                                                                                                                                                                                                                                                                                   |
| `debug`     | `boolean` | `false`       | Enable verbose logging. Can also be set via `--slothletdebug` command line flag or `SLOTHLET_DEBUG=true` environment variable                                                                                                                                                                                                                                                      |
| `mode`      | `string`  | `"singleton"` | Execution environment mode - `"singleton"`, `"vm"`, `"worker"`, or `"fork"`                                                                                                                                                                                                                                                                                                        |
| `api_mode`  | `string`  | `"auto"`      | API structure behavior when root-level default functions exist:<br/>• `"auto"`: Automatically detects if root has default function export and creates callable API<br/>• `"function"`: Forces API to be callable (use when you have root-level default function exports)<br/>• `"object"`: Forces API to be object-only (use when you want object interface regardless of exports) |
| `context`   | `object`  | `{}`          | Context data object injected into live-binding `context` reference. Available to all loaded modules via `import { context } from '@cldmv/slothlet/runtime'`                                                                                                                                                                                                                        |
| `reference` | `object`  | `{}`          | Reference object merged into the API root level. Properties not conflicting with loaded modules are added directly to the API                                                                                                                                                                                                                                                      |

#### `slothlet.getApi()` ⇒ `object`

Returns the raw API object (Proxy or plain object).

**Returns:** `function | object` - The raw API object or function

#### `slothlet.getBoundApi()` ⇒ `object`

Returns the bound API object with context and reference.

**Returns:** `function | object` - The bound API object or function with live bindings and context

#### `slothlet.isLoaded()` ⇒ `boolean`

Returns true if the API is loaded.

**Returns:** `boolean` - Whether the API has been loaded

#### `slothlet.shutdown()` ⇒ `Promise<void>`

Gracefully shuts down the API and cleans up resources.

**Returns:** `Promise<void>` - Resolves when shutdown is complete

> [!NOTE]  
> **📚 For detailed API documentation with comprehensive parameter descriptions, method signatures, and examples, see [docs/API.md](docs/API.md)**

### Live Bindings

Access live-bound references in your API modules:

```javascript
// Create API with reference functions
const api = await slothlet({
	dir: "./api",
	reference: {
		md5: (str) => crypto.createHash("md5").update(str).digest("hex"),
		version: "2.0.0",
		utils: { format: (msg) => `[LOG] ${msg}` }
	}
});
```

```javascript
// In your API modules (ESM)
import { self, context, reference } from "@cldmv/slothlet/runtime";

export function myFunction() {
	console.log(context.user); // Access live context
	return self.otherModule.helper(); // Access other API modules

	// Reference functions are available directly on self
	const hash = self.md5("hello world"); // Access reference function
	console.log(self.version); // Access reference data
}

// Mixed module example (ESM accessing CJS)
export function processData(data) {
	// Call a CJS module from ESM
	const processed = self.cjsModule.process(data);

	// Use reference utilities directly
	const logged = self.utils.format(`Processed: ${processed}`);
	return self.md5(logged); // Hash the result
}
```

```javascript
// In your CJS modules
const { self, context, reference } = require("@cldmv/slothlet/runtime");

function cjsFunction(data) {
	console.log(context.env); // Access live context

	// Reference functions available directly on self
	const hash = self.md5(data); // Direct access to reference function

	return self.esmModule.transform(hash); // Access ESM modules from CJS
}

module.exports = { cjsFunction };
```

### API Mode Configuration

The `api_mode` option controls how slothlet handles root-level default function exports:

#### Auto-Detection (Recommended)

```javascript
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

```javascript
const api = await slothlet({
	api_mode: "function" // Force callable interface
});

// Always creates callable API even without root default export
// Useful when you know you have root functions
const result = api("World"); // Calls root default function
const math = api.math.add(2, 3); // Also access other modules
```

#### Explicit Object Mode

```javascript
const api = await slothlet({
	api_mode: "object" // Force object-only interface
});

// Always creates object interface even with root default export
// api("World") won't work, but api.rootFunction("World") will
const result = api.rootFunction("World"); // Access via property
const math = api.math.add(2, 3); // Normal module access
```

---

## 🏗 Module Structure & Examples

Slothlet supports sophisticated module organization patterns with seamless ESM/CJS interoperability:

### Root-Level Modules

```text
root-math.mjs     → api.rootMath (dash-to-camelCase)
rootstring.mjs    → api.rootstring
config.mjs        → api.config
```

### Single-File Modules

```text
math/math.mjs     → api.math (automatic flattening)
string/string.mjs → api.string
util/util.cjs     → api.util (CJS support)
```

### Multi-File Modules

```text
multi/
  ├── alpha.mjs   → api.multi.alpha
  ├── beta.mjs    → api.multi.beta
  └── gamma.cjs   → api.multi.gamma (mixed ESM/CJS)
```

### Function-Based Modules

```text
funcmod/funcmod.mjs → api.funcmod() (callable function)
multi_func/
  ├── alpha.mjs     → api.multi_func.alpha()
  └── beta.cjs      → api.multi_func.beta() (CJS callable)
```

### Mixed ESM/CJS Modules

```text
interop/
  ├── esm-module.mjs → api.interop.esmModule
  ├── cjs-module.cjs → api.interop.cjsModule
  └── mixed.mjs      → api.interop.mixed (calls both ESM and CJS)
```

### Hybrid Export Patterns

```text
exportDefault/exportDefault.mjs → api.exportDefault() (callable with methods)
objectDefaultMethod/            → api.objectDefaultMethod() (object with default)
```

### Nested Structure

```text
nested/
  └── date/
	  ├── date.mjs → api.nested.date
	  └── util.cjs → api.nested.dateUtil
advanced/
  ├── selfObject/  → api.advanced.selfObject
  └── nest*/       → Various nesting examples
```

### Utility Modules

```text
util/
  ├── controller.mjs → api.util.controller
  ├── extract.cjs    → api.util.extract (CJS utility)
  └── url/
	  ├── parser.mjs → api.util.url.parser
	  └── builder.cjs → api.util.url.builder (mixed)
```

### Smart Function Naming Examples

```text
task/auto-ip.mjs (exports autoIP) → api.task.autoIP (preserves function name)
util/parseJSON.mjs               → api.util.parseJSON (preserves JSON casing)
api/getHTTPStatus.mjs            → api.api.getHTTPStatus (preserves HTTP casing)
```

---

## 🚀 Performance Modes

### Eager Mode (Default - Production Ready)

```javascript
const api = await slothlet({ dir: "./api" }); // lazy: false by default

// Functions behave as originally defined - no await needed for sync functions
const result = api.math.add(2, 3); // Sync function - direct call
const greeting = api("World"); // Instant if callable

// Async functions still need await (as originally defined)
const asyncResult = await api.async.processData({ data: "test" }); // Original async function

// ESM+CJS works seamlessly with native behavior
const mixed = api.interop.process({ data: "test" }); // Sync or async as defined
```

**Benefits:**

- ✅ Fastest function calls (0.36μs average)
- ✅ Predictable performance
- ✅ No materialization delays
- ✅ Functions behave exactly as originally defined (sync stays sync, async stays async)
- ✅ Optimal for production environments

### Lazy Mode with Copy-Left Materialization (Production Ready)

```javascript
const api = await slothlet({ lazy: true, dir: "./api" });

// ALL function calls must be awaited in lazy mode (due to materialization)
const result1 = await api.math.add(2, 3); // First access: ~310μs (materialization)
const result2 = await api.math.add(5, 7); // Subsequent: ~0.5μs (materialized)

// Even originally sync functions need await in lazy mode
const greeting = await api("World"); // Callable interface also needs await
const syncResult = await api.string.format("Hello"); // Originally sync, but needs await
```

**Benefits:**

- ✅ 4.3x faster startup (564.17μs vs 2.45ms)
- ✅ Memory efficient (loads only what you use)
- ✅ Copy-left optimization (once loaded, stays loaded)
- ✅ Optimal for startup-sensitive applications
- ⚠️ All function calls require await (regardless of original sync/async nature)

**Performance Summary:**

> [!TIP]  
> **Choose your loading strategy based on your needs:**
>
> - **Startup**: Lazy wins (4.3x faster - 564.17μs vs 2.45ms)
> - **Function calls**: Eager wins (1.1x faster - 0.65μs vs 0.72μs)
> - **Memory**: Lazy wins (loads only what you use)
> - **Predictability**: Eager wins (no materialization delays)

---

## 🛡 Error Handling

> [!NOTE]  
> **Current Error Behavior**: Slothlet currently uses standard JavaScript error handling. Enhanced error handling with module suggestions is planned for v2.1.0 but not yet implemented.

**Current behavior:**

```javascript
try {
	console.log(api.nonexistent); // Returns: undefined
	await api.nonexistent.method(); // Throws: "Cannot read properties of undefined (reading 'method')"
} catch (error) {
	console.error(error.message); // Standard JavaScript error message
}
```

**Planned Enhanced Error Features (v2.1.0):**

> [!TIP]  
> **Coming Soon**: Enhanced error handling with descriptive messages and module suggestions:
>
> ```javascript
> try {
> 	await api.nonexistent.method();
> } catch (error) {
> 	console.error(error.message);
> 	// Planned: "Module 'nonexistent' not found in './api'. Available modules: math, string, util. Did you mean 'util'?"
> }
> ```
>
> **Planned Features:**
>
> - 🔍 **Module discovery**: Show available modules and suggest alternatives
> - 📍 **Context information**: Include directory path and configuration details
> - 🎯 **Actionable suggestions**: Provide specific guidance for resolution
> - 🚀 **Development mode**: Additional debugging information when debug flag is enabled

---

## 🔧 Production vs Development Modes

### Production Ready ✅

- **Eager Mode**: Stable, battle-tested, maximum performance
- **Lazy Mode**: Production-ready with copy-left optimization
- **Singleton Mode**: Default mode for standard applications
- **Mixed Module Loading**: ESM/CJS interoperability fully supported

### Development Features 🛠️

- **Development Check**: `devcheck.mjs` for environment validation
- **Debug Mode**: Comprehensive logging via `--slothletdebug` flag or `SLOTHLET_DEBUG=true`
- **Performance Monitoring**: Built-in timing and performance analysis
- **Source Detection**: Automatic `src/` vs `dist/` mode detection

### Experimental ⚠️

> [!WARNING]  
> The following modes are in active development and not recommended for production use:
>
> - **Worker Mode**: Thread isolation (in development)
> - **Fork Mode**: Process isolation (in development)
> - **Child Mode**: Child process execution (in development)
> - **VM Mode**: Virtual machine context (in development)
>
> The experimental modes are located in `src/lib/engine/` and should not be used in production environments.

---

## 🌟 Migration from v1.x

### Key Changes

1. **Import paths**: `@cldmv/slothlet` instead of specific file paths
2. **Configuration**: New options (`api_mode`, `context`, `reference`)
3. **Function names**: Enhanced preservation of original capitalization
4. **Module structure**: Mixed ESM/CJS support
5. **Live bindings**: New runtime system with AsyncLocalStorage

### Migration Steps

```javascript
// v1.3.x - API creation (same pattern as v2.x)
import slothlet from "@cldmv/slothlet";
const api = await slothlet({
	dir: "./api",
	lazy: true
});

// v1.3.x - Multiple instances required query strings or withInstanceId()
const api1 = await slothlet({ dir: "./api?instanceId=alice" });
const api2 = slothlet.withInstanceId("bob");
const bobApi = await api2({ dir: "./api" });

// v2.0 - Same API creation, but automatic instance isolation
import slothlet from "@cldmv/slothlet";
const api = await slothlet({
	dir: "./api",
	lazy: true,
	context: { user: "alice" }, // New: context injection
	api_mode: "auto" // New: API mode control
});

// v2.0 - Multiple instances automatically isolated (no query strings needed)
const api1 = await slothlet({ dir: "./api", context: { tenant: "alice" } });
const api2 = await slothlet({ dir: "./api", context: { tenant: "bob" } });
```

### Performance Improvements

- **Architectural optimizations** with copy-left materialization and AsyncLocalStorage integration
- **Zero dependencies** - pure Node.js implementation reduces overhead
- **Enhanced materialization** with copy-left optimization in lazy mode
- **Modular design** improves maintainability and potential optimization opportunities

---

## 🤝 Contributing

We welcome contributions! The experimental modes in particular need development and testing. Please:

1. **Review the code** in `src/lib/engine/` for experimental features
2. **Report issues** with detailed reproduction steps
3. **Submit pull requests** with comprehensive tests
4. **Provide feedback** on API design and performance
5. **Documentation improvements** are always appreciated

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

---

## 📊 Performance Analysis

For comprehensive performance benchmarks, analysis, and recommendations:

**📈 [See PERFORMANCE.md](PERFORMANCE.md)**

Key highlights:

- Detailed startup vs runtime performance comparison
- Memory usage analysis by loading mode
- Materialization cost breakdown by module type
- Real-world performance recommendations

[![CodeFactor]][codefactor_url] [![npms.io score]][npms_url]

[![npm unpacked size]][npm_size_url] [![Repo size]][repo_size_url]

---

## 📚 Documentation

- **[API Documentation](docs/API.md)** - Complete API reference with examples
- **[Performance Analysis](PERFORMANCE.md)** - Detailed benchmarks and recommendations
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to the project
- **[Security Policy](SECURITY.md)** - Security guidelines and reporting
- **[Test Documentation](api_tests/)** - Comprehensive test module examples

---

## 🔗 Links

- **npm**: [@cldmv/slothlet](https://www.npmjs.com/package/@cldmv/slothlet)
- **GitHub**: [CLDMV/slothlet](https://github.com/CLDMV/slothlet)
- **Issues**: [GitHub Issues](https://github.com/CLDMV/slothlet/issues)
- **Releases**: [GitHub Releases](https://github.com/CLDMV/slothlet/releases)

---

## 📄 License

[![GitHub license]][github_license_url] [![npm license]][npm_license_url]

Apache-2.0 © Shinrai / CLDMV

---

## 🙏 Acknowledgments

Slothlet v2.0 represents a complete architectural rewrite with enterprise-grade features and performance. Special thanks to all contributors who made this comprehensive enhancement possible.

**🎉 Welcome to the future of module loading with Slothlet v2.0!**

> _Where sophisticated architecture meets blazing performance - slothlet is anything but slow._

<!-- [github release]: https://img.shields.io/github/v/release/CLDMV/slothlet?style=for-the-badge&logo=github&logoColor=white&labelColor=181717 -->
<!-- [github_release_url]: https://github.com/CLDMV/slothlet/releases -->

[npm version]: https://img.shields.io/npm/v/%40cldmv%2Fslothlet.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_version_url]: https://www.npmjs.com/package/@cldmv/slothlet
[last commit]: https://img.shields.io/github/last-commit/CLDMV/slothlet?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[last_commit_url]: https://github.com/CLDMV/slothlet/commits

<!-- [release date]: https://img.shields.io/github/release-date/CLDMV/slothlet?style=for-the-badge&logo=github&logoColor=white&labelColor=181717 -->
<!-- [release_date_url]: https://github.com/CLDMV/slothlet/releases -->

[npm last update]: https://img.shields.io/npm/last-update/%40cldmv%2Fslothlet?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_last_update_url]: https://www.npmjs.com/package/@cldmv/slothlet
[codefactor]: https://img.shields.io/codefactor/grade/github/CLDMV/slothlet?style=for-the-badge&logo=codefactor&logoColor=white&labelColor=F44A6A
[codefactor_url]: https://www.codefactor.io/repository/github/cldmv/slothlet
[npms.io score]: https://img.shields.io/npms-io/final-score/%40cldmv%2Fslothlet?style=for-the-badge&logo=npms&logoColor=white&labelColor=0B5D57
[npms_url]: https://npms.io/search?q=%40cldmv%2Fslothlet
[npm downloads]: https://img.shields.io/npm/dm/%40cldmv%2Fslothlet.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_downloads_url]: https://www.npmjs.com/package/@cldmv/slothlet
[github downloads]: https://img.shields.io/github/downloads/CLDMV/slothlet/total?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[github_downloads_url]: https://github.com/CLDMV/slothlet/releases
[npm unpacked size]: https://img.shields.io/npm/unpacked-size/%40cldmv%2Fslothlet.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_size_url]: https://www.npmjs.com/package/@cldmv/slothlet
[repo size]: https://img.shields.io/github/repo-size/CLDMV/slothlet?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[repo_size_url]: https://github.com/CLDMV/slothlet
[github license]: https://img.shields.io/github/license/CLDMV/slothlet.svg?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[github_license_url]: LICENSE
[npm license]: https://img.shields.io/npm/l/%40cldmv%2Fslothlet.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_license_url]: https://www.npmjs.com/package/@cldmv/slothlet
[contributors]: https://img.shields.io/github/contributors/CLDMV/slothlet.svg?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[contributors_url]: https://github.com/CLDMV/slothlet/graphs/contributors
[sponsor shinrai]: https://img.shields.io/github/sponsors/shinrai?style=for-the-badge&logo=githubsponsors&logoColor=white&labelColor=EA4AAA&label=Sponsor
[sponsor_url]: https://github.com/sponsors/shinrai
