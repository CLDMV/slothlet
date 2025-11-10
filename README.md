# @cldmv/slothlet

<div align="center">
  <img src="https://github.com/CLDMV/slothlet/raw/HEAD/images/slothlet-logo-v1-horizontal-transparent.png" alt="Slothlet Logo" width="600">
</div>

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

## ✨ What's New in v2.x

### 🎯 **Complete Architectural Rewrite (v2.0)**

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

### 🔧 **Advanced Sanitization Control** ⭐ NEW

- **Custom API Naming**: Control how filenames become API property names through sanitize options
- **Boundary Pattern Matching**: Use `**string**` patterns for precise transformations (`**url**` → `buildURLWithParams`)
- **Glob Pattern Support**: Apply rules with wildcards (`*json*`, `auto*`, `http*`) for flexible naming control
- **Case-Sensitive Rules**: Preserve important naming patterns (acronyms, technical terms, branding)
- **Mixed Rule Types**: Combine exact matches, globs, and boundary patterns for sophisticated naming strategies

### 📊 **Performance Optimizations**

- **Startup**: Lazy mode 4.3x faster (564.17μs vs 2.45ms)
- **Function Calls**: Eager mode 1.1x faster (0.65μs vs 0.72μs) after materialization
- **Memory**: On-demand loading scales with actual usage
- **Predictability**: Consistent performance characteristics per mode

### 🔄 **Context Propagation (v2.3)** ⭐ NEW

- **EventEmitter Context Propagation**: Automatic context preservation across EventEmitter callbacks using AsyncResource patterns
- **Class Instance Context Propagation**: Automatic context preservation across class method calls with transparent wrapping
- **AsyncResource Integration**: Production-ready context management following Node.js best practices
- **Zero Configuration**: Works automatically with TCP servers, HTTP servers, and any EventEmitter-based patterns

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

- **📊 For comprehensive performance analysis, benchmarks, and recommendations, see [PERFORMANCE.md](https://github.com/CLDMV/slothlet/blob/HEAD/PERFORMANCE.md)**

### 🔧 **Smart API Management**

- **Callable Interface**: Use `slothlet(options)` for direct API creation
- **Smart Flattening**: Intelligent rules create clean APIs (`math/math.mjs` → `api.math`, `connection.mjs` → `api.connect()`)
- **Intelligent Naming**: Dash-separated names convert automatically (`root-math.mjs` → `api.rootMath`)
- **Function Name Preservation**: Maintains original capitalization (`auto-ip.mjs` with `autoIP` → `api.autoIP`)
- **Hybrid Exports**: Support for callable APIs with methods, default + named exports, and mixed patterns

> [!TIP]  
> **📁 For comprehensive examples of API flattening, naming conventions, and function preservation patterns, see the test modules in [api_tests/](https://github.com/CLDMV/slothlet/blob/HEAD/api_tests) and their documentation in [docs/api_tests/](https://github.com/CLDMV/slothlet/blob/HEAD/docs/api_tests)**

> [!NOTE]  
> **🔍 For detailed technical documentation on API transformation rules:**
>
> - **[API-RULES.md](https://github.com/CLDMV/slothlet/blob/HEAD/API-RULES.md)** - Verified API transformation rules with examples and test cases
> - **[API-RULES-CONDITIONS.md](https://github.com/CLDMV/slothlet/blob/HEAD/API-RULES-CONDITIONS.md)** - Complete technical reference of all conditional logic that controls API generation

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
	},
	sanitize: {
		// 🔧 NEW: Control API property naming
		lowerFirst: false, // Keep first character casing
		rules: {
			leave: ["parseJSON", "autoIP"], // Preserve exact names
			leaveInsensitive: ["*xml*"], // Case-insensitive preservation
			upper: ["**url**", "api", "http*"], // Force uppercase (including boundary patterns)
			lower: ["id", "uuid", "*id"] // Force lowercase
		}
	}
});
```

### Sanitize Options Examples

Transform module filenames into clean, professional API property names:

```javascript
// Without sanitize options (default behavior)
const api = await slothlet({ dir: "./api" });
// Files: build-url-with-params.mjs, parse-json-data.mjs, auto-ip.mjs
// Result: api.buildUrlWithParams, api.parseJsonData, api.autoIp

// With sanitize options (custom naming control)
const api = await slothlet({
	dir: "./api",
	sanitize: {
		lowerFirst: false,
		rules: {
			leave: ["parseJSON"], // Exact match preservation
			upper: ["**url**", "ip", "http*"], // Boundary + glob patterns
			leaveInsensitive: ["*xml*"] // Case-insensitive globs
		}
	}
});
// Result: api.buildURLWithParams, api.parseJSON, api.autoIP
```

**Sanitize Pattern Types:**

- **Exact Match**: `"parseJSON"` - Matches exact string only
- **Glob Patterns**: `"*json*"`, `"auto*"`, `"http*"` - Wildcard matching
- **Boundary Patterns**: `"**url**"` - Only matches when surrounded by word boundaries
- **Case Control**: `leaveInsensitive` for case-insensitive matching

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
| `context`   | `object`  | `{}`          | Context data object injected into live-binding `context` reference. Available to all loaded modules via `import { context } from "@cldmv/slothlet/runtime"`                                                                                                                                                                                                                        |
| `reference` | `object`  | `{}`          | Reference object merged into the API root level. Properties not conflicting with loaded modules are added directly to the API                                                                                                                                                                                                                                                      |
| `sanitize`  | `object`  | `{}`          | **🔧 NEW**: Control how filenames become API property names. Supports exact matches, glob patterns (`*json*`), and boundary patterns (`**url**`). Configure `lowerFirst` and `rules` for `leave`, `leaveInsensitive`, `upper`, and `lower` transformations                                                                                                                         |

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
> **📚 For detailed API documentation with comprehensive parameter descriptions, method signatures, and examples, see [docs/API.md](https://github.com/CLDMV/slothlet/blob/HEAD/docs/API.md)**

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

### EventEmitter Context Propagation

Slothlet automatically preserves AsyncLocalStorage context across all EventEmitter callbacks using Node.js AsyncResource patterns. This ensures your API modules maintain full context access in event handlers without any configuration.

```javascript
// api/tcp-server.mjs - Your API module
import { self, context } from "@cldmv/slothlet/runtime";
import net from "node:net";

export function createTcpServer() {
	const server = net.createServer();

	// Connection handler maintains full context automatically
	server.on("connection", (socket) => {
		console.log(`User: ${context.user}`); // ✅ Context preserved
		console.log(`API keys: ${Object.keys(self).length}`); // ✅ Full API access

		// Socket data handler also maintains context automatically
		socket.on("data", (data) => {
			console.log(`Session: ${context.session}`); // ✅ Context preserved
			console.log(`Processing for: ${context.user}`); // ✅ Context preserved

			// Full API access in nested event handlers
			const processed = self.dataProcessor.handle(data.toString());
			socket.write(processed);
		});

		socket.on("error", (err) => {
			// Error handlers also maintain context
			self.logger.error(`Error for user ${context.user}: ${err.message}`);
		});
	});

	return server;
}

export function startServer(port = 3000) {
	const server = createTcpServer();
	server.listen(port);
	return server;
}
```

```javascript
// Usage in your application
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: { user: "alice", session: "tcp-session" }
});

// Start the server - all event handlers will have full context
const server = api.startServer(8080);
console.log("TCP server started with context preservation");
```

**Key Benefits:**

- ✅ **Automatic**: No configuration needed - works transparently in all API modules
- ✅ **Complete Context**: Full `context` object and `self` API access in all event handlers
- ✅ **Nested Events**: Works with any depth of EventEmitter nesting (server → socket → custom emitters)
- ✅ **Universal Support**: All EventEmitter methods (`on`, `once`, `addListener`) are automatically context-aware
- ✅ **Production Ready**: Uses Node.js AsyncResource patterns for reliable context propagation
- ✅ **Zero Overhead**: Only wraps listeners when context is active, minimal performance impact

> [!TIP]  
> **Automatic Context Propagation**: EventEmitter context propagation works automatically in both lazy and eager modes. TCP servers, HTTP servers, custom EventEmitters, and any other event-driven patterns in your API modules will maintain full slothlet context and API access without any code changes.

### Class Instance Context Propagation

Slothlet automatically preserves AsyncLocalStorage context across all class instance method calls. When your API functions return class instances, slothlet wraps them transparently to ensure all method calls maintain full context access.

```javascript
// api/data-processor.mjs - Your API module
import { self, context } from "@cldmv/slothlet/runtime";

class DataProcessor {
	constructor(config) {
		this.config = config;
	}

	process(data) {
		// Context automatically available in all methods
		console.log(`Processing for user: ${context.user}`); // ✅ Context preserved
		console.log(`Request ID: ${context.requestId}`); // ✅ Context preserved

		// Full API access in class methods
		const validated = self.validator.check(data);
		return this.transform(validated);
	}

	transform(data) {
		// Context preserved in nested method calls
		console.log(`Transforming for: ${context.user}`); // ✅ Context preserved

		// Call other API modules from class methods
		return self.utils.format(data);
	}
}

export function createProcessor(config) {
	// Return class instance - slothlet automatically wraps it
	return new DataProcessor(config);
}
```

```javascript
// Usage in your application
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: { user: "alice", requestId: "req-123" }
});

// Create processor instance - all methods will have full context
const processor = api.createProcessor({ format: "json" });

// All method calls maintain context automatically
const result = processor.process({ data: "test" });
console.log("Processing completed with context preservation");
```

**Key Benefits:**

- ✅ **Automatic**: Class instances returned from API functions are automatically context-aware
- ✅ **Transparent**: No code changes needed - works with existing class patterns
- ✅ **Complete Context**: Full `context` object and `self` API access in all class methods
- ✅ **Nested Methods**: Context preserved across method chains and internal calls
- ✅ **Constructor Support**: Context preserved for both function calls and `new` constructor usage
- ✅ **Performance Optimized**: Method wrapping is cached to avoid overhead on repeated calls

> [!TIP]  
> **Universal Class Support**: Any class instance returned from your API functions automatically maintains slothlet context. This includes database models, service classes, utility classes, and any other object-oriented patterns in your codebase.

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

### Filename-Folder Matching Modules

```text
math/math.mjs     → api.math (filename matches folder)
string/string.mjs → api.string (filename matches folder)
util/util.cjs     → api.util (CJS support with filename matching)
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

## 🏗️ API Flattening Rules

Slothlet uses intelligent flattening rules to create clean, intuitive API structures. Understanding these rules helps you organize your modules for the best developer experience:

### 1. **Filename-Folder Matching** (Single Named Export)

**When:** A file exports a single named export that matches the sanitized filename  
**Why:** Avoids redundant nesting (`api.math.math.add()` → `api.math.add()`)  
**Reasoning:** When file purpose matches folder purpose, eliminate the duplicate layer

```text
math/math.mjs (exports { math: {...} })     → api.math (flattened)
string/string.mjs (exports { string: {...} }) → api.string (flattened)
util/util.mjs (exports { util: {...} })     → api.util (flattened)
```

### 2. **No Default Export + Only Named Exports** ⭐ NEW

**When:** A file has **no default export** and **only named exports**  
**Why:** The file acts as a pure function collection, not a module with a main export  
**Reasoning:** If there's no "main thing" (default export), treat all functions as equals at the root level

```text
connection.mjs (exports { connect, disconnect, isConnected })
  → api.connect(), api.disconnect(), api.isConnected()
  Because: No default export = no main "connection" object needed

app.mjs (exports { getAllApps, getCurrentApp, setApp })
  → api.getAllApps(), api.getCurrentApp(), api.setApp()
  Because: No default export = these are standalone utility functions

state.mjs (exports { cloneState, emitLog, reset, update })
  → api.cloneState(), api.emitLog(), api.reset(), api.update()
  Because: No default export = treat as individual state utilities
```

### 3. **Has Default Export** (Namespace Preservation)

**When:** A file has a default export (with or without named exports)  
**Why:** The default export indicates there's a "main thing" that should be the namespace  
**Reasoning:** Default export signals intentional module structure that should be preserved

```text
config.mjs (exports default + named exports) → api.config.*
  Because: Default export indicates a main config object with methods

input.mjs (exports default + named exports)  → api.input.*
  Because: Default export indicates a main input handler with utilities

volume.mjs (exports default + named exports) → api.volume.*
  Because: Default export indicates a main volume controller with methods
```

### 4. **Root-Level Special Cases**

**When:** Files are at the root directory level (not in subfolders)  
**Why:** Prevents accidental API pollution and maintains clear root structure  
**Reasoning:** Root files are explicitly placed there and should maintain their intended naming

```text
root-math.mjs   → api.rootMath (namespace preserved)
  Because: Explicitly named "root-math" = keep as intended namespace

rootstring.mjs  → api.rootstring (namespace preserved)
  Because: Root-level placement = developer wants this specific API structure

config.mjs      → api.config (namespace preserved)
  Because: Root config file = keep as clear config namespace, don't flatten
```

### 5. **Self-Referential Prevention**

**When:** A file would create circular/redundant nesting (`api.config.config`)  
**Why:** Prevents infinite nesting and maintains clean API structure  
**Reasoning:** When file/folder names match, assume they represent the same logical concept

```text
config/config.mjs → api.config (prevented: api.config.config.config...)
  Because: config.mjs in config/ folder = same concept, use folder name only
```

### 🎯 Flattening Decision Tree

```mermaid
flowchart TD
    FILE[Module File] --> ROOT{Root Level?}

    ROOT -->|Yes| PRESERVE[Preserve Namespace<br/>api.rootMath, api.config]

    ROOT -->|No| SELFREFER{Self-Referential?}
    SELFREFER -->|Yes| NAMESPACE[Use Namespace<br/>api.config]

    SELFREFER -->|No| HASDEFAULT{Has Default Export?}
    HASDEFAULT -->|Yes| NAMESPACE

    HASDEFAULT -->|No| NAMEDONLY{Only Named Exports?}
    NAMEDONLY -->|Yes| FLATTEN[Flatten All Named Exports<br/>api.connect(), api.disconnect()]

    NAMEDONLY -->|No| SINGLENAMED{Single Named Export<br/>Matching Filename?}
    SINGLENAMED -->|Yes| FLATTENSINGLE[Flatten Single Export<br/>api.math]
    SINGLENAMED -->|No| NAMESPACE

    style FLATTEN fill:#e1f5fe
    style FLATTENSINGLE fill:#e8f5e8
    style NAMESPACE fill:#fff3e0
    style PRESERVE fill:#fce4ec
```

### 🚀 Benefits of Smart Flattening

- **Cleaner APIs**: `api.connect()` instead of `api.connection.connect()`  
  _Why it matters:_ Reduces typing, improves readability, and matches how you'd naturally call connection functions
- **Intuitive Structure**: File organization matches API usage patterns  
  _Why it matters:_ Files with only utility functions flatten (no main export = no namespace needed), while files with main exports preserve their intended structure
- **Flexible Organization**: Mix flattened and nested patterns as needed  
  _Why it matters:_ You can organize files by purpose (`connection.mjs` for utilities, `config.mjs` for main objects) and slothlet automatically creates the right API structure
- **Developer Intent Respected**: Export structure signals your architectural intentions  
  _Why it matters:_ Default exports = "this is a main thing with methods", named exports only = "these are utility functions"
- **Backward Compatibility**: Existing APIs continue to work as expected  
  _Why it matters:_ The rules are additive - existing filename-matching and default export patterns still work exactly the same

## 🔀 How Slothlet Works: Loading Modes Explained

```mermaid
flowchart TD
    MODULEFOLDERS --> SLOTHLET
    SLOTHLET --> CHOOSEMODE

    CHOOSEMODE --> LAZY
    CHOOSEMODE --> EAGER

    subgraph EAGER ["⚡ Eager Mode"]
        direction TB
        EAGER0 ~~~ EAGER1
        EAGER2 ~~~ EAGER3

        EAGER0@{ shape: braces, label: "📥 All modules loaded immediately" }
        EAGER1@{ shape: braces, label: "✅ API methods available right away" }
        EAGER2@{ shape: braces, label: "🔄 Function calls behave as originally defined" }
        EAGER3@{ shape: braces, label: "📞 Sync stays sync: api.math.add(2,3)<br/>🔄 Async stays async: await api.async.process()" }
    end

    subgraph LAZY ["💤 Lazy Mode"]
        direction TB
        LAZY0 ~~~ LAZY1
        LAZY2 ~~~ LAZY3
        LAZY4 ~~~ LAZY5

        LAZY0@{ shape: braces, label: "📦 Modules not loaded yet" }
        LAZY1@{ shape: braces, label: "🎭 API methods are placeholders/proxies" }
        LAZY2@{ shape: braces, label: "📞 First call triggers materialization" }
        LAZY3@{ shape: braces, label: "⏳ All calls must be awaited<br/>await api.math.add(2,3)" }
        LAZY4@{ shape: braces, label: "💾 Module stays loaded after materialization<br/>Copy-left materialization" }
        LAZY5@{ shape: braces, label: "🚀 Subsequent calls nearly as fast as eager mode" }
    end

    subgraph EAGERCALL ["⚡ Eager Mode Calls"]
        direction TB
    end

    subgraph LAZYCALL ["💤 Lazy Mode Calls"]
        direction TB
        LAZYCALL0 --> LAZYCALL2

		LAZYCALL0@{ shape: rounded, label: "📞 First call" }
		LAZYCALL1@{ shape: rounded, label: "🔁 Sequential calls" }
		LAZYCALL2@{ shape: rounded, label: "🧩 Materialize" }
    end

    EAGER --> READYTOUSE
    LAZY --> READYTOUSE

    READYTOUSE --> CALL
    CALL -.-> EAGERCALL
    CALL -.-> LAZYCALL

    EAGERCALL --> MATERIALIZEDFUNCTION
    LAZYCALL1 --> MATERIALIZEDFUNCTION
    LAZYCALL2 --> MATERIALIZEDFUNCTION

	READYTOUSE@{ shape: rounded, label: "🎯 Ready to Use" }
	MATERIALIZEDFUNCTION@{ shape: rounded, label: "✅ Materialized method/property" }
	CALL@{ shape: trap-b, label: "📞 Call" }

    %% Notes as unattached nodes with braces shape
    subgraph ALWAYS ["✨ Extras Always On"]
        direction TB
        ALWAYS0 ~~~ ALWAYS1
        ALWAYS1 ~~~ ALWAYS2

		ALWAYS0@{ shape: rounded, label: "🔗 Live Bindings ALS<br/>Per-instance context isolation" }
		ALWAYS1@{ shape: rounded, label: "🏷️ Smart Naming & Flattening<br/>Multiple rules for clean APIs" }
		ALWAYS2@{ shape: rounded, label: "🔄 Mixed Module Support<br/>Seamlessly mix .mjs and .cjs" }
    end

    MODULEFOLDERS@{ shape: st-rect, label: "📁 Modules Folder<br/>.mjs and/or .cjs files<br/>math.mjs, string.cjs, async.mjs" }
	SLOTHLET@{ shape: rounded, label: "🔧 Call slothlet(options)" }
	CHOOSEMODE@{ shape: diamond, label: "Choose Mode<br/>in options" }

    style EAGER0 stroke:#9BC66B,color:#9BC66B,opacity:0.5
    style EAGER1 stroke:#9BC66B,color:#9BC66B,opacity:0.5
    style EAGER2 stroke:#9BC66B,color:#9BC66B,opacity:0.5
    style EAGER3 stroke:#9BC66B,color:#9BC66B,opacity:0.5

    style LAZY0 stroke:#9BC66B,color:#9BC66B,opacity:0.5
    style LAZY1 stroke:#9BC66B,color:#9BC66B,opacity:0.5
    style LAZY2 stroke:#9BC66B,color:#9BC66B,opacity:0.5
    style LAZY3 stroke:#9BC66B,color:#9BC66B,opacity:0.5
    style LAZY4 stroke:#9BC66B,color:#9BC66B,opacity:0.5
    style LAZY5 stroke:#9BC66B,color:#9BC66B,opacity:0.5

    %% Slothlet brand colors - #9BC66B primary on dark theme
    style MODULEFOLDERS fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style SLOTHLET fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style CHOOSEMODE fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style READYTOUSE fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style CALL fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5
    style MATERIALIZEDFUNCTION fill:#1a1a1a,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5

    %% Eager mode - primary green
    style EAGER fill:#0d1a0d,stroke:#9BC66B,stroke-width:3px,color:#9BC66B,opacity:0.5
    style EAGERCALL fill:#0d1a0d,stroke:#9BC66B,stroke-width:2px,color:#9BC66B,opacity:0.5

    %% Lazy mode - lighter green tint
    style LAZY fill:#0d1a0d,stroke:#B8D982,stroke-width:3px,color:#B8D982,opacity:0.5
    style LAZYCALL fill:#0d1a0d,stroke:#B8D982,stroke-width:2px,color:#B8D982,opacity:0.5
    style LAZYCALL0 fill:#1a1a1a,stroke:#B8D982,stroke-width:2px,color:#B8D982,opacity:0.5
    style LAZYCALL1 fill:#1a1a1a,stroke:#B8D982,stroke-width:2px,color:#B8D982,opacity:0.5
    style LAZYCALL2 fill:#1a1a1a,stroke:#B8D982,stroke-width:2px,color:#B8D982,opacity:0.5

    %% Always available - accent green
    style ALWAYS fill:#0d1a0d,stroke:#7FA94F,stroke-width:3px,color:#7FA94F,opacity:0.5
    style ALWAYS0 fill:#1a1a1a,stroke:#7FA94F,stroke-width:1px,color:#7FA94F,opacity:0.5
    style ALWAYS1 fill:#1a1a1a,stroke:#7FA94F,stroke-width:1px,color:#7FA94F,opacity:0.5
    style ALWAYS2 fill:#1a1a1a,stroke:#7FA94F,stroke-width:1px,color:#7FA94F,opacity:0.5

    %% Arrow styling
    linkStyle default stroke:#9BC66B,stroke-width:3px,opacity:0.5
    linkStyle 4,5,6,7,8,18,19 stroke-width:0px
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

See [CONTRIBUTING.md](https://github.com/CLDMV/slothlet/blob/HEAD/CONTRIBUTING.md) for detailed contribution guidelines.

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

---

## 📊 Performance Analysis

For comprehensive performance benchmarks, analysis, and recommendations:

**📈 [See PERFORMANCE.md](https://github.com/CLDMV/slothlet/blob/HEAD/PERFORMANCE.md)**

Key highlights:

- Detailed startup vs runtime performance comparison
- Memory usage analysis by loading mode
- Materialization cost breakdown by module type
- Real-world performance recommendations

[![CodeFactor]][codefactor_url] [![npms.io score]][npms_url]

[![npm unpacked size]][npm_size_url] [![Repo size]][repo_size_url]

---

## 📚 Documentation

- **[API Documentation](https://github.com/CLDMV/slothlet/blob/HEAD/docs/API.md)** - Complete API reference with examples
- **[Performance Analysis](https://github.com/CLDMV/slothlet/blob/HEAD/PERFORMANCE.md)** - Detailed benchmarks and recommendations
- **[Contributing Guide](https://github.com/CLDMV/slothlet/blob/HEAD/CONTRIBUTING.md)** - How to contribute to the project
- **[Security Policy](https://github.com/CLDMV/slothlet/blob/HEAD/SECURITY.md)** - Security guidelines and reporting
- **[Test Documentation](https://github.com/CLDMV/slothlet/blob/HEAD/api_tests)** - Comprehensive test module examples

### 🔧 Technical Documentation

- **[API Rules](https://github.com/CLDMV/slothlet/blob/HEAD/API-RULES.md)** - Systematically verified API transformation rules with real examples and test cases
- **[API Rules Conditions](https://github.com/CLDMV/slothlet/blob/HEAD/API-RULES-CONDITIONS.md)** - Complete technical reference of all 26 conditional statements that control API generation

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
[github_license_url]: https://github.com/CLDMV/slothlet/blob/HEAD/LICENSE
[npm license]: https://img.shields.io/npm/l/%40cldmv%2Fslothlet.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_license_url]: https://www.npmjs.com/package/@cldmv/slothlet
[contributors]: https://img.shields.io/github/contributors/CLDMV/slothlet.svg?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[contributors_url]: https://github.com/CLDMV/slothlet/graphs/contributors
[sponsor shinrai]: https://img.shields.io/github/sponsors/shinrai?style=for-the-badge&logo=githubsponsors&logoColor=white&labelColor=EA4AAA&label=Sponsor
[sponsor_url]: https://github.com/sponsors/shinrai
