# Module Lifecycle

This document covers the lifecycle event system, module type inspection, and background materialization for lazy-mode optimization.

## Table of Contents

- [Lifecycle Events](#lifecycle-events)
- [Module Type Inspection](#module-type-inspection)
- [Background Materialization](#background-materialization)
- [API Reference](#api-reference)

---

## Lifecycle Events

`api.slothlet.lifecycle` provides an EventEmitter-based system for monitoring module loading, reloading, and removal at runtime.

### Subscribing to Events

```javascript
// Standard EventEmitter pattern
api.slothlet.lifecycle.on("impl:created", (data) => {
	console.log(`Module loaded: ${data.apiPath}`);
});

// subscribe() returns an unsubscribe function
const unsubscribe = api.slothlet.lifecycle.subscribe("impl:changed", (data) => {
	console.log(`Module reloaded: ${data.apiPath} from ${data.source}`);
});

// Later, clean up
unsubscribe();
```

### Unsubscribing

```javascript
const handler = (data) => console.log(data);
api.slothlet.lifecycle.on("impl:changed", handler);

// Remove specific handler
api.slothlet.lifecycle.off("impl:changed", handler);
```

---

## Events

### `impl:created`

Emitted when a module implementation is first loaded - during initial `slothlet()` startup or via `api.slothlet.api.add()`.

**Event data:**
```javascript
{
	apiPath: "plugins.auth",        // API path dot-notation
	impl: { login: [Function] },    // The implementation
	source: "initial",              // "initial" | "hot-reload" | "lazy-materialization"
	moduleID: "plugins_xyz789",     // Module identifier
	filePath: "/path/to/auth.mjs",  // Absolute source file path
	sourceFolder: "/path/to/plugins" // Source directory
}
```

### `impl:changed`

Emitted when an existing module implementation is replaced - during `api.slothlet.api.reload()` or `api.slothlet.reload()`.

**Event data:** Same shape as `impl:created`.

### `impl:removed`

Emitted when a module is removed via `api.slothlet.api.remove()`.

**Event data:**
```javascript
{
	apiPath: "plugins.oldModule",
	moduleID: "plugins_old123"
}
```

### `materialized:complete`

Emitted when all lazy-mode modules have been materialized. Requires `tracking: { materialization: true }` in config.

**Event data:**
```javascript
{
	total: 15,             // Total modules materialized
	timestamp: 1708012345  // Unix timestamp (ms)
}
```

---

## Use Cases

### Loading Indicators

```javascript
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	tracking: { materialization: true }
});

showLoadingSpinner();

api.slothlet.lifecycle.on("materialized:complete", () => {
	hideLoadingSpinner();
});
```

### Hot Reload Notifications

```javascript
api.slothlet.lifecycle.on("impl:changed", (data) => {
	notifyUser(`Module ${data.apiPath} was reloaded`);
});
```

### Module Registry

```javascript
const moduleRegistry = new Map();

api.slothlet.lifecycle.on("impl:created", (data) => {
	moduleRegistry.set(data.apiPath, {
		moduleID: data.moduleID,
		filePath: data.filePath,
		loadedAt: Date.now()
	});
});

api.slothlet.lifecycle.on("impl:removed", (data) => {
	moduleRegistry.delete(data.apiPath);
});
```

---

## Module Type Inspection

In eager mode, `typeof api.math` accurately reflects the underlying type (`"object"` for object exports, `"function"` for function exports). In **lazy mode this is not the case** - the proxy target is always a function to make namespaces callable, so `typeof` always returns `"function"` regardless of what the module exports.

Use `__type` and `api.slothlet.types` symbols to check actual module state.

### `__type` property

```javascript
const api = await slothlet({ dir: "./api", mode: "lazy" });

// typeof is always "function" in lazy mode (proxy target)
console.log(typeof api.math);     // "function" - even if math module exports an object

// __type returns the real implementation type
console.log(api.math.__type);     // api.slothlet.types.UNMATERIALIZED  (not loaded yet)
                                  // api.slothlet.types.IN_FLIGHT        (loading)
                                  // "object"                            (loaded, object export)
                                  // "function"                          (loaded, function export)
```

### `api.slothlet.types` symbols

| Symbol | Meaning |
|---|---|
| `api.slothlet.types.UNMATERIALIZED` | Module not yet loaded; materialization not started |
| `api.slothlet.types.IN_FLIGHT` | Materialization in progress |

Once materialized, `__type` returns a standard `typeof` string (`"object"`, `"function"`, etc.).

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({ dir: "./api", mode: "lazy" });

const { UNMATERIALIZED, IN_FLIGHT } = api.slothlet.types;

if (api.math.__type === UNMATERIALIZED) {
	console.log("Not loaded yet");
} else if (api.math.__type === IN_FLIGHT) {
	console.log("Loading...");
} else {
	console.log("Loaded, type:", api.math.__type); // "object" or "function"
}
```

---

## Background Materialization

The `tracking.materialization` config option (or the `backgroundMaterialize` shorthand) causes lazy-mode modules to start loading in the background immediately after the API is initialized, rather than waiting for first access.

### Configuration

```javascript
// Recommended: use tracking.materialization
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	tracking: { materialization: true }
});

// Shorthand: backgroundMaterialize
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	backgroundMaterialize: true
});
```

### Behavior comparison

**Without background materialization (default):**
```javascript
const api = await slothlet({ dir: "./api", mode: "lazy" });

// Modules are proxies - not loaded
console.log(api.math.__type); // UNMATERIALIZED

// First call triggers loading (slightly slower)
const result = await api.math.add(2, 3);

// Module is now loaded
console.log(api.math.__type); // "object"
```

**With background materialization:**
```javascript
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	tracking: { materialization: true }
});

// Modules are loading in background - may already be IN_FLIGHT or loaded
console.log(api.math.__type); // "object" (if fast enough) or IN_FLIGHT

// Wait for all modules to finish loading
await api.slothlet.materialize.wait();

// All modules guaranteed loaded
console.log(api.math.__type); // "object"
const result = await api.math.add(2, 3); // Fast - no loading delay
```

### `api.slothlet.materialize.wait()`

Waits until all lazy-mode background materialization is complete. Returns immediately if already done.

```javascript
// Wait for full materialization before serving requests
await api.slothlet.materialize.wait();
console.log("All modules ready, starting server...");
server.listen(3000);
```

### When to use background materialization

| Use case | Recommendation |
|---|---|
| First-call latency is critical | Enable (`tracking: { materialization: true }`) |
| Fast startup is critical | Disable (default) |
| Large API, not all modules used | Disable |
| Small API, most modules used | Enable |
| Unit/integration tests | Enable for predictable behavior |

---

## Best Practices

**Clean up listeners before shutdown:**
```javascript
const handler = (data) => console.log(data);
api.slothlet.lifecycle.on("impl:changed", handler);

// Before shutdown
api.slothlet.lifecycle.off("impl:changed", handler);
await api.shutdown();
```

**Handle errors in event handlers:**
```javascript
api.slothlet.lifecycle.on("impl:changed", async (data) => {
	try {
		await handleModuleChange(data);
	} catch (error) {
		console.error("Handler error:", error);
	}
});
```

---

## API Reference

### api.slothlet.lifecycle

| Method | Description | Returns |
|---|---|---|
| `on(event, handler)` | Subscribe to lifecycle event | `void` |
| `off(event, handler)` | Unsubscribe handler | `void` |
| `subscribe(event, handler)` | Subscribe, returns unsubscribe function | `Function` |
| `unsubscribe(event, handler)` | Alias for `off()` | `void` |

**Available events:** `impl:created` · `impl:changed` · `impl:removed` · `materialized:complete`

### api.slothlet.materialize

| Property/Method | Description |
|---|---|
| `wait()` | `Promise<void>` - resolves when all background materialization completes |
| `get()` | Returns materialization stats (total, completed count) |
| `materialized` | `boolean` - `true` when all modules are loaded |

### api.slothlet.types

| Symbol | Meaning |
|---|---|
| `api.slothlet.types.UNMATERIALIZED` | Module proxy, not yet loading |
| `api.slothlet.types.IN_FLIGHT` | Module loading in progress |

### `mod.__type`

Direct property on any lazy-mode proxy. Returns `api.slothlet.types.UNMATERIALIZED`, `api.slothlet.types.IN_FLIGHT`, or a `typeof` string once materialized.

---

## See Also

- [Module Structure](MODULE-STRUCTURE.md) - All structural patterns including lazy mode
- [Hooks](HOOKS.md) - Intercept function calls with before/after/always/error hooks
- [Performance](PERFORMANCE.md) - Eager vs. lazy mode performance characteristics
