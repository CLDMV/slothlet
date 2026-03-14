# AGENT-USAGE.md: Building Slothlet API Folders

> **Critical**: This guide prevents AI agents from making architectural mistakes when building Slothlet API modules.

## 📋 Related Documentation

- **[`docs/API-RULES.md`](docs/API-RULES.md)** - All 13 API transformation rules with verified test examples
- **[`README.md`](README.md)** - Complete project overview and usage examples
- **[`api_tests/*/README.md`](api_tests/)** - Live examples demonstrating each pattern below

---

## 🚫 NEVER DO: Cross-Module Imports

**The #1 mistake AI agents make with Slothlet**: Importing API files from each other.

```js
// ❌ WRONG - Do NOT import API modules from each other
import { math } from "./math/math.mjs"; // BREAKS SLOTHLET
import { config } from "../config.mjs"; // BREAKS SLOTHLET
import { util } from "./util/util.mjs"; // BREAKS SLOTHLET
```

**Why this breaks Slothlet**:

- Slothlet builds API structure dynamically at runtime
- Cross-imports create circular dependencies
- Breaks lazy loading and context isolation
- Defeats the purpose of the module loading framework

## ✅ CORRECT: Use Slothlet's Live-Binding System

```js
// ✅ CORRECT - Import from Slothlet runtime for cross-module access
import { self, context } from "@cldmv/slothlet/runtime";

export const myModule = {
	async processData(input) {
		// Access other API modules via `self` (live binding - always current)
		const mathResult = self.math.add(2, 3);
		const configValue = self.config.get("setting");
		// context holds the current request/call context
		console.log(`Caller: ${context.userId}`);
		return `Processed: ${input}, Math: ${mathResult}`;
	}
};
```

---

## 🏗️ API Module Patterns

### Pattern 1: Simple Object Export (Most Common)

**File**: `math/math.mjs` → **API**: `api.math.add()`, `api.math.multiply()`

```js
export const math = {
	add(a, b) { return a + b; },
	multiply(a, b) { return a * b; }
};
```

**Result**: Filename matches folder (`math/math.mjs`) → Auto-flattening → `api.math.add()` (not `api.math.math.add()`)

> 📖 See [API-RULES.md Rule 1](docs/API-RULES.md) for flattening details.

### Pattern 2: Multiple Files in Folder

**Files**: `multi/alpha.mjs`, `multi/beta.mjs` → **API**: `api.multi.alpha.hello()`, `api.multi.beta.world()`

```js
// File: multi/alpha.mjs
export const alpha = { hello() { return "alpha hello"; } };

// File: multi/beta.mjs
export const beta = { world() { return "beta world"; } };
```

**Result**: Different filenames from folder → No flattening → Nested structure preserved.

### Pattern 3: Default Function Export

**File**: `funcmod/funcmod.mjs` → **API**: `api.funcmod(name)`

```js
export default function funcmod(name) {
	return `Hello, ${name}!`;
}
```

**Result**: Filename matches folder + default export → Function flattened to `api.funcmod()`.

### Pattern 4: Root-Level API Functions

**File**: `root-function.mjs` → **API**: `api(name)` + `api.rootFunctionShout()`

```js
export default function greet(name) {
	return `Hello, ${name}!`;
}

export function rootFunctionShout(message) {
	return message.toUpperCase();
}
```

**Result**: Root file with default export → `api()` callable + named exports as top-level `api.methodName()`.

### Pattern 5: AddApi Special File Pattern (Rule 11)

Files named `addapi.mjs` always flatten regardless of `autoFlatten` setting:

```js
// File: plugins/addapi.mjs
export function initializePlugin() { return "Plugin initialized"; }
export function cleanup() { return "Plugin cleaned up"; }
```

```js
await api.slothlet.api.add("plugins", "./plugins-folder");
api.plugins.initializePlugin(); // ✅ Direct extension - no intermediate namespace
```

> 📖 See [API-RULES.md Rule 11](docs/API-RULES.md) for addApi flattening details.

---

## 🔄 Operating Modes

Slothlet supports two loading modes set via `mode:` in the config:

### Eager Mode (default)

All modules are loaded synchronously at `await slothlet(...)`. The API is fully populated before `slothlet()` resolves.

```js
const api = await slothlet({ dir: "./api" }); // mode: "eager" is default
// All api.* properties are immediately available
```

### Lazy Mode

Modules are loaded on first access via transparent proxy. `slothlet()` resolves immediately without loading any files.

```js
const api = await slothlet({
	dir: "./api",
	mode: "lazy"
});
// api.math is a proxy - file not loaded yet
const result = api.math.add(2, 3); // First access triggers load
```

#### Background Materialization

Enable `backgroundMaterialize: true` to pre-load all modules in the background immediately after init (still non-blocking):

```js
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	backgroundMaterialize: true
});

// Subscribe to completion event
api.slothlet.lifecycle.on("materialized:complete", (data) => {
	console.log(`${data.total} modules materialized`);
});

// Or await all modules to be ready
await api.slothlet.materialize.wait();

// Or check current progress
const stats = api.slothlet.materialize.get();
// { total, materialized, remaining, percentage }
```

**Important**: Lazy mode hot reload intentionally restores modules to an unmaterialized state on reload (references are not preserved). Eager mode preserves existing references by merging into the live wrapper.

---

## 🎣 Hook System

Hooks intercept API function calls. They work across all modes. See [`docs/HOOKS.md`](docs/HOOKS.md) for the full reference.

### Hook Configuration

```js
// Simple enable (default pattern "**")
const api = await slothlet({ dir: "./api", hook: true });

// Enable with default pattern filter
const api = await slothlet({ dir: "./api", hook: "database.*" });

// Full configuration
const api = await slothlet({
	dir: "./api",
	hook: {
		enabled: true,
		pattern: "**",
		suppressErrors: false // true = errors suppressed (returns undefined instead of throwing)
	}
});
```

### Hook Types

- **`before`** - Executes before the function. Can modify arguments or short-circuit. **Must be synchronous.**
- **`after`** - Executes after successful completion. Can transform the return value.
- **`always`** - Read-only observer. Always executes (even on short-circuit). Return value ignored.
- **`error`** - Executes only when an error occurs. Receives error with source tracking.

### Basic Hook Usage

The `hook.on(typePattern, handler, options)` signature uses `"type:pattern"` as the first argument:

```js
// Before hook - modify arguments
api.slothlet.hook.on(
	"before:math.add",
	({ path, args, ctx }) => {
		return [args[0] * 2, args[1] * 2]; // Return array to replace arguments
		// Return any non-array non-undefined value to short-circuit (skip function)
		// Return undefined to continue with original args
	},
	{ id: "double-args", priority: 100 }
);

// After hook - transform result
api.slothlet.hook.on(
	"after:math.*",
	({ path, args, result, ctx }) => {
		return result * 10; // Return value to replace result; undefined = no change
	},
	{ id: "scale-result" }
);

// Always hook - observe (read-only)
api.slothlet.hook.on(
	"always:**",
	({ path, result, hasError, errors }) => {
		if (hasError) console.error(`${path} failed:`, errors);
		else console.log(`${path} returned:`, result);
		// Return value is ignored
	},
	{ id: "logger" }
);

// Error hook - monitor failures
api.slothlet.hook.on(
	"error:**",
	({ path, error, source }) => {
		// source.type: "before" | "after" | "always" | "function"
		console.error(`Error in ${path} (from ${source.type}):`, error.message);
	},
	{ id: "error-monitor" }
);
```

### Pattern Matching

| Syntax | Description | Example |
|---|---|---|
| `exact.path` | Exact match | `"before:math.add"` |
| `namespace.*` | All functions in namespace | `"after:math.*"` |
| `*.funcName` | Function name across namespaces | `"always:*.add"` |
| `**` | All functions | `"error:**"` |
| `{a,b}` | Brace expansion | `"before:{math,utils}.*"` |
| `!pattern` | Negation | `"before:!internal.*"` |

### Hook Subsets

Each hook type has three ordered execution phases:

| Subset | Order | Typical use |
|---|---|---|
| `"before"` | First | Auth checks, security validation |
| `"primary"` | Middle (default) | Main hook logic |
| `"after"` | Last | Audit trails, cleanup |

```js
api.slothlet.hook.on(
	"before:protected.*",
	({ ctx }) => { if (!ctx.user) throw new Error("Unauthorized"); },
	{ id: "auth", subset: "before", priority: 2000 }
);
```

### Hook Management

```js
// Remove by ID
api.slothlet.hook.remove({ id: "my-hook" });
api.slothlet.hook.off("my-hook"); // alias for remove

// Remove by filter
api.slothlet.hook.remove({ type: "before", pattern: "math.*" });

// Remove all
api.slothlet.hook.clear();

// List hooks
const all = api.slothlet.hook.list();
const active = api.slothlet.hook.list({ enabled: true });

// Enable / disable without unregistering
api.slothlet.hook.disable();         // disable all
api.slothlet.hook.disable({ pattern: "math.*" });
api.slothlet.hook.enable();          // re-enable all
api.slothlet.hook.enable({ type: "before" });
```

---

## 🔄 Per-Request Context

Execute functions with temporary merged context using `api.slothlet.context`:

```js
const api = await slothlet({
	dir: "./api",
	context: { appName: "MyApp", version: "3.0" }
});

// run() - execute a function inside a scoped context
await api.slothlet.context.run({ userId: "alice", role: "admin" }, async () => {
	// Inside this scope: context = { appName, version, userId, role }
	await api.database.query();
	await api.audit.log();
});

// scope() - return a new API object with merged context
const scopedApi = api.slothlet.context.scope({ userId: "bob" });
await scopedApi.database.query(); // context includes userId: "bob"
```

### Deep Merge Strategy

```js
// Default: shallow merge (top-level properties replaced)
await api.slothlet.context.run({ newProp: "value" }, handler);

// Deep merge: nested objects recursively merged
await api.slothlet.context.run(
	{ nested: { prop: "value" } },
	handler,
	{ mergeStrategy: "deep" }
);
```

### Automatic EventEmitter Context Propagation

Context propagates automatically through EventEmitter callbacks:

```js
import net from "net";
import { context } from "@cldmv/slothlet/runtime";

export const server = {
	async start() {
		const tcpServer = net.createServer((socket) => {
			// Context automatically available in connection handler
			console.log(`User ${context.userId} connected`);

			socket.on("data", (data) => {
				// Context preserved in nested event callbacks
				console.log(`Data from ${context.userId}: ${data}`);
			});
		});
		tcpServer.listen(3000);
	}
};
```

Works with: TCP servers, HTTP servers, custom EventEmitters, unlimited nested callbacks.

> 📖 See [`docs/CONTEXT-PROPAGATION.md`](docs/CONTEXT-PROPAGATION.md) for full documentation.

---

## 🏷️ Metadata System

Tag API paths with metadata for authorization, auditing, and security. See [`docs/METADATA.md`](docs/METADATA.md) for the full reference.

```js
// Set metadata when loading (via api.slothlet.api.add)
await api.slothlet.api.add("plugins/trusted", "./trusted-dir", {
	metadata: { trusted: true, securityLevel: "high" }
});

// Set metadata at runtime
api.slothlet.metadata.set("plugins.trusted.someFunc", { version: 2 });
api.slothlet.metadata.setGlobal({ environment: "production" });
api.slothlet.metadata.setFor("plugins/trusted", { owner: "core-team" });

// Read metadata inside a module
import { self } from "@cldmv/slothlet/runtime";

export const secureOperation = {
	async execute() {
		// Access metadata via api.slothlet.metadata from within a module via self
		// Or read it externally:
		// const meta = api.slothlet.metadata.get("plugins.trusted.execute");
		return "Authorized execution";
	}
};
```

---

## 🔁 Hot Reload / Dynamic API Management

```js
// Add new modules at runtime
await api.slothlet.api.add("newModule", "./new-module-path");
await api.slothlet.api.add("plugins", "./plugins", { collision: "merge" });

// Remove modules by path
await api.slothlet.api.remove("oldModule");

// Reload all modules
await api.slothlet.reload();

// Reload specific API path
await api.slothlet.api.reload("database.*");
await api.slothlet.api.reload("plugins.auth");
```

> **Lazy mode reload behavior**: In lazy mode, reload restores modules to an unmaterialized proxy state - existing references to lazy wrappers are intentionally not preserved. Eager mode merges new module exports into the existing live wrapper, preserving references.

> 📖 See [`docs/RELOAD.md`](docs/RELOAD.md) for reload system documentation.

---

## ⚡ Lifecycle Events

Subscribe to internal API events via `api.slothlet.lifecycle`:

```js
// Available events
api.slothlet.lifecycle.on("materialized:complete", (data) => {
	console.log(`${data.total} modules materialized`);
});

api.slothlet.lifecycle.on("impl:changed", (data) => {
	console.log(`Module at ${data.apiPath} was reloaded`);
});

// Unsubscribe
const handler = (data) => console.log(data);
api.slothlet.lifecycle.on("materialized:complete", handler);
api.slothlet.lifecycle.off("materialized:complete", handler);
```

**Available events**: `"materialized:complete"`, `"impl:created"`, `"impl:changed"`, `"impl:removed"`

---

## 📁 File Organization Best Practices

### ✅ Clean Folder Structure

```text
api/
├── config.mjs              → api.config.*
├── math/
│   └── math.mjs            → api.math.* (flattened - filename matches folder)
├── util/
│   ├── util.mjs            → api.util.* (flattened methods)
│   ├── extract.mjs         → api.util.extract.*
│   └── controller.mjs      → api.util.controller.*
├── nested/
│   └── date/
│       └── date.mjs        → api.nested.date.*
└── multi/
    ├── alpha.mjs           → api.multi.alpha.*
    └── beta.mjs            → api.multi.beta.*
```

### ✅ Naming Conventions

- **Filename matches folder** → Auto-flattening (`math/math.mjs` → `api.math.*`)
- **Different filename** → Nested structure preserved
- **Dash-separated names** → camelCase API (`auto-ip.mjs` → `api.autoIP`)
- **Function name preferred** → Original capitalization kept over sanitized form
  (see [Rule 9](docs/API-RULES.md))

---

## 🚨 Common AI Agent Mistakes

### ❌ Mistake 1: Cross-Module Imports

```js
// ❌ WRONG
import { config } from "./config.mjs";
// ✅ CORRECT
import { self } from "@cldmv/slothlet/runtime";
// then: self.config.get(...)
```

### ❌ Mistake 2: Using V2 API Surface

```js
// ❌ WRONG (v2 API - does not exist in v3)
await api.addApi("plugins", "./dir");
await api.reloadApi("math.*");
api.hooks.on("validate", "before", handler, { pattern: "math.*" });
await api.run({ userId: "alice" }, fn);

// ✅ CORRECT (v3 API)
await api.slothlet.api.add("plugins", "./dir");
await api.slothlet.api.reload("math.*");
api.slothlet.hook.on("before:math.*", handler);
await api.slothlet.context.run({ userId: "alice" }, fn);
```

### ❌ Mistake 3: Wrong Hook Config Key

```js
// ❌ WRONG
const api = await slothlet({ dir: "./api", hooks: true }); // "hooks" plural

// ✅ CORRECT
const api = await slothlet({ dir: "./api", hook: true }); // "hook" singular
```

### ❌ Mistake 4: Breaking Auto-Flattening

```js
// File: math/calculator.mjs (different name from folder)
export const math = { /* methods */ };
// Result: api.math.calculator.math.* ← extra nesting, not flattened

// ✅ CORRECT: File math/math.mjs
export const math = { /* methods */ };
// Result: api.math.* ← flattened
```

### ❌ Mistake 5: Using lifecycle.subscribe / lifecycle.emit

```js
// ❌ WRONG - subscribe/emit are internal
api.slothlet.lifecycle.subscribe("materialized:complete", handler);
api.slothlet.lifecycle.emit("impl:changed", data);

// ✅ CORRECT - public surface is on/off only
api.slothlet.lifecycle.on("materialized:complete", handler);
api.slothlet.lifecycle.off("materialized:complete", handler);
```

---

## ✅ AI Agent Checklist

- [ ] **No cross-module imports** - use `self` from `@cldmv/slothlet/runtime` instead
- [ ] **Match filename to folder** for cleaner APIs (auto-flattening)
- [ ] **Hook config key is `hook:` (singular)**, not `hooks:`
- [ ] **Hook API** is `api.slothlet.hook.*`, not `api.hooks.*`
- [ ] **Context API** is `api.slothlet.context.run/scope()`, not `api.run/scope()`
- [ ] **Reload/add/remove** is `api.slothlet.api.add/remove/reload()`, not `api.addApi()` etc.
- [ ] **Lifecycle** uses `api.slothlet.lifecycle.on/off()` only
- [ ] **Lazy mode**: if using background materialization, use `api.slothlet.materialize.wait()` before accessing the API
- [ ] **Hook subsets**: auth/security → `subset: "before"`, main logic → `"primary"`, audit → `"after"`
- [ ] **Double quotes everywhere** - follow Slothlet coding standards

---

## 📚 Reference Examples

- **Auto-flattening**: `api_tests/api_test/math/math.mjs`
- **Multi-file folders**: `api_tests/api_test/multi/`
- **Cross-module calls**: `api_tests/api_test_mixed/`
- **Root-level APIs**: `api_tests/api_test/root-function.mjs`
- **Nested structures**: `api_tests/api_test/nested/date/`

---

## 📖 Essential Documentation

### Core Architecture

- **[`docs/API-RULES.md`](docs/API-RULES.md)** - All 13 API transformation rules
- **[`docs/API-RULES/API-RULES-CONDITIONS.md`](docs/API-RULES/API-RULES-CONDITIONS.md)** - All C01–C34 conditional logic
- **[`docs/API-RULES/API-FLATTENING.md`](docs/API-RULES/API-FLATTENING.md)** - Flattening rules F01–F08

### Configuration & Features

- **[`docs/CONFIGURATION.md`](docs/CONFIGURATION.md)** - All config options
- **[`docs/HOOKS.md`](docs/HOOKS.md)** - Hook system (types, subsets, patterns, management)
- **[`docs/METADATA.md`](docs/METADATA.md)** - Metadata system
- **[`docs/CONTEXT-PROPAGATION.md`](docs/CONTEXT-PROPAGATION.md)** - Per-request context and EventEmitter propagation
- **[`docs/RELOAD.md`](docs/RELOAD.md)** - Hot reload and dynamic API management
- **[`docs/LIFECYCLE.md`](docs/LIFECYCLE.md)** - Lazy mode, materialization, and lifecycle events
- **[`docs/SANITIZATION.md`](docs/SANITIZATION.md)** - Property name sanitization rules
- **[`docs/I18N.md`](docs/I18N.md)** - Internationalization and language support
- **[`docs/PERFORMANCE.md`](docs/PERFORMANCE.md)** - Performance characteristics and benchmarks

### Critical Reading Order for AI Agents

1. **This file** - Prevents architectural mistakes
2. **[`README.md`](README.md)** - Project overview and quickstart
3. **[`docs/API-RULES.md`](docs/API-RULES.md)** - API transformation rules
4. **[`docs/HOOKS.md`](docs/HOOKS.md)** - Hook system (if needed)
5. **[`docs/METADATA.md`](docs/METADATA.md)** - Metadata system (if needed)
6. **[`api_tests/api_test/README.md`](api_tests/api_test/README.md)** - Live examples
