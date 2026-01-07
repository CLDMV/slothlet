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

## ✨ What's New

### Latest: v2.11.0 (January 2025)

- **AddApi Special File Pattern (Rule 11)** - Files named `addapi.mjs` now always flatten for seamless API namespace extensions
- **Filename-Matches-Container in addApi (Rule 1 Extension)** - Auto-flattening now works in runtime `addApi()` contexts
- **Enhanced addApi Content Preservation** - Fixed critical issue where multiple addApi calls were overwriting previous content instead of merging
- **Rule 12 Smart Flattening Enhancements** - Comprehensive smart flattening improvements with 168-scenario test coverage
- **API Documentation Suite Overhaul** - Enhanced 3-tier navigation system with verified examples and cross-references
- [View Changelog](./docs/changelog/v2.11.md)

### Recent Releases

- **v2.10.0** - Function metadata tagging and introspection capabilities ([Changelog](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.10.md))
- **v2.9** - Per-Request Context Isolation with `api.run()` and `api.scope()` methods ([Changelog](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.9.md))
- **v2.8** - NPM security fixes and package workflow updates ([Changelog](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.8.md))
- **v2.7** - Security updates ([Changelog](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.7.md))
- **v2.6** - Hook System with 4 interceptor types ([Changelog](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.6.md))
- **v2.5** - Architectural consolidation and API consistency ([Changelog](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.5.md))
- **v2.4** - Multi-default export handling ([Changelog](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.4.md))
- **v2.3** - EventEmitter & Class Context Propagation ([Changelog](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.3.md))
- **v2.2** - Case preservation options ([Changelog](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.2.md))
- **v2.1** - Advanced sanitization patterns ([Changelog](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.1.md))
- **v2.0** - Complete Architectural Rewrite ([Changelog](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.0.md))

---

## 🚀 Key Features

### 🎯 **Dual Loading Strategies**

- **Eager Loading**: Immediate loading for maximum performance in production environments
- **Lazy Loading**: Copy-left materialization with look-ahead proxies (4.3x faster startup, 1.4x faster calls after materialization)

> [!IMPORTANT]  
> **Function Call Patterns:**
>
> - **Lazy Mode**: ALL function calls must be awaited (`await api.math.add(2, 3)`) due to materialization process
> - **Eager Mode**: Functions behave as originally defined - sync functions are sync (`api.math.add(2, 3)`), async functions are async (`await api.async.process()`)

### ⚡ Performance Excellence

- **2.9x faster startup** in lazy mode (4.89ms vs 14.29ms)
- **1.1x faster function calls** in eager mode (0.90μs vs 0.99μs)
- **Copy-left materialization**: Once loaded, modules stay materialized
- **Zero dependencies**: Pure Node.js implementation

📊 **For comprehensive performance analysis, benchmarks, and recommendations, see [docs/PERFORMANCE.md](https://github.com/CLDMV/slothlet/blob/master/docs/PERFORMANCE.md)**

### 🎣 **Hook System**

Powerful function interceptor system with 4 hook types:

- **`before`** - Modify arguments or cancel execution
- **`after`** - Transform return values
- **`always`** - Observe final results (read-only)
- **`error`** - Monitor and handle errors with detailed source tracking

Pattern matching, priority control, runtime enable/disable, and short-circuit support included.

🎣 **For complete hook system documentation, see [docs/HOOKS.md](https://github.com/CLDMV/slothlet/blob/master/docs/HOOKS.md)**

### 🔄 **Context Propagation**

Automatic context preservation across all asynchronous boundaries:

- **EventEmitter propagation**: Context maintained across all event callbacks
- **Class instance propagation**: Context preserved in class method calls
- **Zero configuration**: Works automatically with TCP servers, HTTP servers, and custom EventEmitters

🔄 **For context propagation details, see [docs/CONTEXT-PROPAGATION.md](https://github.com/CLDMV/slothlet/blob/master/docs/CONTEXT-PROPAGATION.md)**

### 🔧 **Smart API Management**

- **Intelligent Flattening**: Clean APIs with automatic structure optimization (`math/math.mjs` → `api.math`)
- **Smart Naming**: Preserves original capitalization (`auto-ip.mjs` with `autoIP` → `api.autoIP`)
- **Advanced Sanitization**: Custom naming rules with glob and boundary patterns
- **Hybrid Exports**: Support for callable APIs with methods, default + named exports

🏗️ **For module structure examples, see [docs/MODULE-STRUCTURE.md](https://github.com/CLDMV/slothlet/blob/master/docs/MODULE-STRUCTURE.md)**  
📐 **For API flattening rules, see [docs/API-FLATTENING.md](https://github.com/CLDMV/slothlet/blob/master/docs/API-FLATTENING.md)**

### 🔗 **Advanced Binding System**

- **Live Bindings**: Dynamic context and reference binding for runtime API mutation
- **Context Isolation**: Dual runtime options (AsyncLocalStorage or live-bindings)
- **Mixed Module Support**: Seamlessly blend ESM and CommonJS modules
- **Copy-Left Preservation**: Materialized functions stay materialized

### 🛠 **Developer Experience**

- **TypeScript-Friendly**: Comprehensive JSDoc annotations with auto-generated declarations
- **Configurable Debug**: Detailed logging via CLI flags or environment variables
- **Multiple Instances**: Parameter-based isolation for complex applications
- **Development Checks**: Built-in environment detection with silent production behavior

---

## 📦 Installation

### Requirements

- **Node.js v16.20.2 or higher** (required for stack trace API fixes used in path resolution)
  - Node.js 16.4-16.19 has a stack trace regression. For these versions, use slothlet 2.10.0: `npm install @cldmv/slothlet@2.10.0`

### Install

```bash
npm install @cldmv/slothlet
```

---

## 🚀 Quick Start

### ESM (ES Modules)

```javascript
import slothlet from "@cldmv/slothlet";

// Direct usage - eager mode by default
const api = await slothlet({
	dir: "./api",
	context: { user: "alice" }
});

// Eager mode: Functions behave as originally defined
const result = api.math.add(2, 3); // Sync function - no await needed
const asyncResult = await api.async.processData({ data: "async" });

// Access both ESM and CJS modules seamlessly
const esmResult = api.mathEsm.multiply(4, 5);
const cjsResult = api.mathCjs.divide(10, 2);
```

### CommonJS (CJS)

```javascript
const slothlet = require("@cldmv/slothlet");

// Same usage pattern works with CommonJS
const api = await slothlet({
	dir: "./api",
	context: { env: "production" }
});

const result = api.math.multiply(4, 5);
const mixedResult = await api.interop.processData({ data: "test" });
```

### Lazy Loading Mode

```javascript
import slothlet from "@cldmv/slothlet";

// Lazy mode with copy-left materialization
const api = await slothlet({
	mode: "lazy", // Preferred syntax
	dir: "./api",
	apiDepth: 3
});

// First access: materialization overhead (~1.45ms average)
const result1 = await api.math.add(2, 3);

// Subsequent access: materialized function (near-eager performance)
const result2 = await api.math.add(5, 7);
```

### Hook System Example

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	hooks: true // Enable hooks
});

// Before hook: Modify arguments
api.hooks.on(
	"validate",
	"before",
	({ path, args }) => {
		console.log(`Calling ${path} with args:`, args);
		return [args[0] * 2, args[1] * 2];
	},
	{ pattern: "math.add", priority: 100 }
);

// After hook: Transform result
api.hooks.on(
	"format",
	"after",
	({ path, result }) => {
		console.log(`${path} returned:`, result);
		return result * 10;
	},
	{ pattern: "math.*", priority: 100 }
);

// Always hook: Observe final result
api.hooks.on(
	"observe",
	"always",
	({ path, result, hasError }) => {
		console.log(hasError ? `${path} failed` : `${path} succeeded`);
	},
	{ pattern: "**" }
);

// Error hook: Monitor errors with source tracking
api.hooks.on(
	"error-logger",
	"error",
	({ path, error, source }) => {
		console.error(`Error in ${path}:`, error.message);
		console.error(`Source: ${source.type}`); // 'before', 'after', 'function', 'always'
	},
	{ pattern: "**" }
);

// Call function - hooks execute automatically
const result = await api.math.add(2, 3);
```

### Dynamic API Extension with addApi()

Load additional modules at runtime and extend your API dynamically:

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({ dir: "./api" });

// Add plugins at runtime
await api.addApi("plugins", "./plugins-folder");
api.plugins.myPlugin();

// Create nested API structures
await api.addApi("runtime.plugins", "./more-plugins");
api.runtime.plugins.loader();

// Add with metadata for security/authorization
await api.addApi("plugins.trusted", "./trusted-plugins", {
	trusted: true,
	permissions: ["read", "write", "admin"],
	version: "1.0.0"
});

await api.addApi("plugins.external", "./third-party", {
	trusted: false,
	permissions: ["read"]
});

// Access metadata on functions
const meta = api.plugins.trusted.someFunc.__metadata;
console.log(meta.trusted); // true
console.log(meta.permissions); // ["read", "write", "admin"]
```

**Security & Authorization with metadataAPI:**

```javascript
// Inside your modules, use metadataAPI for runtime introspection
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function sensitiveOperation() {
	// Check caller's metadata
	const caller = await metadataAPI.caller();

	if (!caller?.trusted) {
		throw new Error("Unauthorized: Caller is not trusted");
	}

	if (!caller.permissions.includes("admin")) {
		throw new Error("Unauthorized: Admin permission required");
	}

	// Proceed with secure operation
	return "Success";
}

// Get metadata by path
const meta = await metadataAPI.get("plugins.trusted.someFunc");

// Get current function's metadata
const self = await metadataAPI.self();
console.log("My version:", self.version);
```

🔒 **For complete metadata system documentation, see [docs/METADATA.md](https://github.com/CLDMV/slothlet/blob/master/docs/METADATA.md)**

---

## 📚 Configuration Options

| Option              | Type      | Default       | Description                                                                                                                                                                                              |
| ------------------- | --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dir`               | `string`  | `"api"`       | Directory to load API modules from (absolute or relative path)                                                                                                                                           |
| `mode`              | `string`  | `"eager"`     | **New** loading mode - `"lazy"` for on-demand loading, `"eager"` for immediate loading                                                                                                                   |
| `lazy`              | `boolean` | `false`       | **Legacy** loading strategy (use `mode` instead)                                                                                                                                                         |
| `engine`            | `string`  | `"singleton"` | Execution environment: `"singleton"`, `"vm"`, `"worker"`, or `"fork"` (experimental modes)                                                                                                               |
| `runtime`           | `string`  | `"async"`     | Runtime binding system: `"async"` for AsyncLocalStorage (requires Node.js v16.20.2+), `"live"` for live-bindings (works on Node.js v12.20.0+)                                                            |
| `apiDepth`          | `number`  | `Infinity`    | Directory traversal depth - `0` for root only, `Infinity` for all levels                                                                                                                                 |
| `debug`             | `boolean` | `false`       | Enable verbose logging (also via `--slothletdebug` flag or `SLOTHLET_DEBUG=true` env var)                                                                                                                |
| `api_mode`          | `string`  | `"auto"`      | API structure behavior: `"auto"` (detect), `"function"` (force callable), `"object"` (force object)                                                                                                      |
| `allowApiOverwrite` | `boolean` | `true`        | Allow `addApi()` to overwrite existing endpoints (`false` = prevent overwrites with warning)                                                                                                             |
| `hotReload`         | `boolean` | `false`       | Enable hot reload and module ownership tracking (`true` = track ownership for selective overwrites and support `.reload()`, `false` = disabled for performance)                                          |
| `context`           | `object`  | `{}`          | Context data injected into live-binding (available via `import { context } from "@cldmv/slothlet/runtime"`)                                                                                              |
| `reference`         | `object`  | `{}`          | Reference object merged into API root level                                                                                                                                                              |
| `sanitize`          | `object`  | `{}`          | Advanced filename-to-API transformation control with `lowerFirst`, `preserveAllUpper`, `preserveAllLower`, and `rules` (supports exact matches, glob patterns `*json*`, and boundary patterns `**url**`) |
| `hooks`             | `mixed`   | `false`       | Enable hook system: `true` (enable all), `"pattern"` (enable with pattern), or object with `enabled`, `pattern`, `suppressErrors` options                                                                |

**For complete API documentation with detailed parameter descriptions and examples, see [docs/generated/API.md](https://github.com/CLDMV/slothlet/blob/master/docs/generated/API.md)**

---

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

**Best for:** Production environments, maximum runtime performance, predictable behavior

```javascript
const api = await slothlet({ dir: "./api" }); // lazy: false by default

// Functions behave as originally defined
const result = api.math.add(2, 3); // Sync - no await needed
const asyncResult = await api.async.processData({ data: "test" }); // Async needs await
```

**Benefits:**

- ✅ Fastest function calls (0.90μs average)
- ✅ Predictable performance (no materialization delays)
- ✅ Functions behave exactly as originally defined

### Lazy Mode with Copy-Left Materialization (Production Ready)

**Best for:** Startup-sensitive applications, memory efficiency, loading only what you use

```javascript
const api = await slothlet({ mode: "lazy", dir: "./api" });

// ALL calls must be awaited (materialization process)
const result1 = await api.math.add(2, 3); // First: ~371μs (materialization)
const result2 = await api.math.add(5, 7); // Subsequent: 0.99μs (materialized)
```

**Benefits:**

- ✅ 2.9x faster startup (4.89ms vs 14.29ms)
- ✅ Near-equal function call performance (0.99μs vs 0.90μs eager)
- ✅ Memory efficient (loads only what you use)
- ✅ Copy-left optimization (once loaded, stays loaded)

> [!TIP]  
> **Choose your strategy:**
>
> - **Startup-sensitive?** → Lazy mode (2.9x faster startup)
> - **Call-intensive?** → Eager mode (1.1x faster calls)
> - **Need predictability?** → Eager mode (no materialization delays)
> - **Large API, use subset?** → Lazy mode (memory efficient)

---

## 📊 Performance Analysis

For comprehensive performance benchmarks, analysis, and recommendations:

**📈 [See docs/PERFORMANCE.md](https://github.com/CLDMV/slothlet/blob/master/docs/PERFORMANCE.md)**

Key highlights:

- Detailed startup vs runtime performance comparison
- Memory usage analysis by loading mode
- Materialization cost breakdown by module type
- Real-world performance recommendations

[![CodeFactor]][codefactor_url] [![npms.io score]][npms_url]

[![npm unpacked size]][npm_size_url] [![Repo size]][repo_size_url]

---

## 📚 Documentation

### Core Documentation

- **[API Documentation](https://github.com/CLDMV/slothlet/blob/master/docs/generated/API.md)** - Complete API reference with examples and detailed parameter descriptions
- **[Performance Analysis](https://github.com/CLDMV/slothlet/blob/master/docs/PERFORMANCE.md)** - Detailed benchmarks and recommendations
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to the project
- **[Security Policy](SECURITY.md)** - Security guidelines and reporting
- **[Test Documentation](api_tests)** - Comprehensive test module examples

### Technical Guides

- **[Hook System](https://github.com/CLDMV/slothlet/blob/master/docs/HOOKS.md)** - Complete hook system documentation with 4 hook types, pattern matching, and examples
- **[Context Propagation](https://github.com/CLDMV/slothlet/blob/master/docs/CONTEXT-PROPAGATION.md)** - EventEmitter and class instance context preservation
- **[Metadata System](https://github.com/CLDMV/slothlet/blob/master/docs/METADATA.md)** - Function metadata tagging and runtime introspection for security, authorization, and auditing
- **[Module Structure](https://github.com/CLDMV/slothlet/blob/master/docs/MODULE-STRUCTURE.md)** - Comprehensive module organization patterns and examples
- **[API Flattening](https://github.com/CLDMV/slothlet/blob/master/docs/API-FLATTENING.md)** - The 5 flattening rules with decision tree and benefits

### API Rules & Transformation

- **[API Rules](https://github.com/CLDMV/slothlet/blob/master/docs/API-RULES.md)** - Systematically verified API transformation rules with real examples and test cases
- **[API Rules Conditions](https://github.com/CLDMV/slothlet/blob/master/docs/API-RULES-CONDITIONS.md)** - Complete technical reference of all 26 conditional statements that control API generation

### Changelog

- **[v2.9](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.9.md)** - Per-Request Context Isolation & API Builder Modularization (December 30, 2025)
- **[v2.8](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.8.md)** - NPM security fixes and package workflow updates (December 26, 2025)
- **[v2.7](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.7.md)** - Hook System with 4 interceptor types (December 20, 2025)
- **[v2.6](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.6.md)** - Mode/Engine options and deep nested path fixes (November 10, 2025)
- **[v2.5](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.5.md)** - Architectural consolidation and API consistency (October 20, 2025)
- **[v2.4](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.4.md)** - Multi-default export handling with file-based naming (October 18, 2025)
- **[v2.3](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.3.md)** - EventEmitter & Class Context Propagation (October 16, 2025)
- **[v2.2](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.2.md)** - Case preservation options (preserveAllUpper/preserveAllLower) (October 14, 2025)
- **[v2.1](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.1.md)** - Advanced sanitization with boundary patterns (October 12, 2025)
- **[v2.0](https://github.com/CLDMV/slothlet/blob/master/docs/changelog/v2.0.md)** - Complete Architectural Rewrite (September 9, 2025)

---

## 🛡 Error Handling

> [!NOTE]  
> **Current Error Behavior**: Slothlet currently uses standard JavaScript error handling. Enhanced error handling with module suggestions is planned for v3.0.0 but not yet implemented.

**Current behavior:**

```javascript
try {
	console.log(api.nonexistent); // Returns: undefined
	await api.nonexistent.method(); // Throws: "Cannot read properties of undefined (reading 'method')"
} catch (error) {
	console.error(error.message); // Standard JavaScript error message
}
```

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

---

## 🌟 Migration from v1.x

### Key Changes

1. **Import paths**: `@cldmv/slothlet` instead of specific file paths
2. **Configuration**: New options (`api_mode`, `context`, `reference`, `hooks`)
3. **Function names**: Enhanced preservation of original capitalization
4. **Module structure**: Mixed ESM/CJS support
5. **Live bindings**: Dual runtime system with AsyncLocalStorage and live-bindings options
6. **Automatic instances**: No more query strings or `withInstanceId()` methods

### Migration Steps

```javascript
// v1.3.x - Multiple instances required query strings or withInstanceId()
const api1 = await slothlet({ dir: "./api?instanceId=alice" });
const api2 = slothlet.withInstanceId("bob");
const bobApi = await api2({ dir: "./api" });

// v2.x - Automatic instance isolation (no query strings needed)
const api1 = await slothlet({ dir: "./api", context: { tenant: "alice" } });
const api2 = await slothlet({ dir: "./api", context: { tenant: "bob" } });
// Instances completely isolated with their own contexts
```

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

**🎉 Welcome to the future of module loading with Slothlet!**

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
