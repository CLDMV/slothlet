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

### Construction-time subscription (`lifecycle` config option)

Subscribing via `api.slothlet.lifecycle.on(...)` only works **after** the api has been built, so events emitted during the cold-start build (init-time `impl:created`, `impl:warning`, …) have already fired by the time you can attach a handler. To observe those, pass a `lifecycle` map to `slothlet()`. Its handlers are registered on the lifecycle emitter **before** the api builds, so they catch initialization events — and, being ordinary subscribers, they keep receiving runtime events afterward too.

```javascript
const api = await slothlet({
	base: "./api",
	lifecycle: {
		// Event name → a handler, or an array of handlers.
		"impl:warning": (data) => console.warn(`[init] ${data.code}: ${data.message}`),
		"impl:error": [onError, auditError],
		"impl:created": (data) => registry.add(data.apiPath)
	}
});
```

Any event name is accepted — the map is just a set of early `subscribe()` calls. The value must be a function or an array of functions; an invalid shape throws `INVALID_CONFIG` at construction.

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

### `impl:warning`

Emitted for a **non-throwing** diagnostic warning — a condition slothlet handled and continued past, both at runtime (e.g. a synthetic `api.slothlet.api.add()` whose default export cannot be placed at the root) and during cold-start initialization (e.g. multiple root-level default exports, or a user API that shadows the reserved `slothlet` property). The event is **additive**: it fires regardless of the `silent` config, which suppresses console output only. Init-time configuration that is genuinely invalid still **throws** — only non-throwing warnings emit this event.

**Event data:**

```javascript
{
	apiPath: "",                             // Where the mutation was attempted ("" / "(root)" for the root)
	code: "WARN_SYNTHETIC_ROOT_COLLISION",   // The i18n diagnostic code
	message: "Synthetic add at the API root…", // Already-translated human-readable message
	source: "addApi",                        // Command family: "addApi" | "reload" | "buildAPI" | "module-mount"
	context: { name: "greet" },              // Structured context passed to the diagnostic
	moduleID: "plugins_xyz789"               // Module identifier, when one is in scope
}
```

```javascript
// Programmatic observers work even when console output is suppressed (silent: true).
api.slothlet.lifecycle.on("impl:warning", (data) => {
	console.log(`[${data.source}] ${data.code}: ${data.message}`);
});
```

### `impl:error`

Emitted for a **non-throwing** runtime error — a failure slothlet caught and continued past without throwing (for example, a hot-reload merge that cannot combine a primitive with an incoming module and so keeps the existing value and rejects the mutation). Like `impl:warning`, it fires regardless of `silent`. It carries the same payload as `impl:warning` plus an `error` field with the originating `Error` / `SlothletError`.

**Event data:**

```javascript
{
	apiPath: "plugins.count",
	code: "WARNING_HOT_RELOAD_MERGE_PRIMITIVES",
	message: "Cannot merge into primitive value…",
	source: "addApi",
	context: { apiPath: "plugins.count" },
	moduleID: "plugins_xyz789",
	error: SlothletError                     // The originating (non-thrown) error
}
```

```javascript
api.slothlet.lifecycle.on("impl:error", (data) => {
	console.warn(`Handled runtime error at ${data.apiPath}:`, data.error);
});
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

## Module Discovery Events

These fire from the module discovery + mount pipeline at `api.slothlet.api.modules.*` (see the dedicated module discovery docs for the full surface). They observe both the discovery phase and the per-module mount phase.

### `modules:discover-start`

Emitted at the start of every `discover()` call (including the lazy-trigger call from `addModule(name)` when the cache is empty, and the chained call inside `addDiscovered()`).

**Event data:**

```javascript
{
	scanRoot: "/path/to/scan/root",  // The resolved scan root (string | string[] from options)
	options: { /* the full discover() options object */ }
}
```

### `modules:discover-complete`

Emitted after `discover()` finishes walking the filesystem and replaces the discovery cache.

**Event data:**

```javascript
{
	found: [ /* DiscoverResult[] in walk order */ ],
	stale: [ /* MountResult[] of modules mounted previously but not in the new cache */ ]
}
```

The `stale` array enables S3b reconciliation — the host can iterate it and call `removeModule()` on each to unmount packages that have been uninstalled from disk.

### `modules:mount-start`

Emitted at the start of `addModule()`, `addModules()`, or `addDiscovered()`'s mount phase.

**Event data:**

```javascript
{
	items: [ /* (string | DiscoverResult)[] — the input list */ ],
	options: { /* the full options object: collisionMode, onFailure, concurrency, etc. */ }
}
```

### `modules:mount-complete`

Emitted once **per successfully mounted module**, immediately after the underlying `api.add()` resolves. Fires up to N times for `addModules` with N items — once per item that mounted cleanly. Failed mounts emit nothing on this channel. Whether failures surface elsewhere depends on `onFailure`:

- **`onFailure: "best-effort"`** — every prior-success `modules:mount-complete` event still fires, plus the final `modules:loaded` payload carries a `failed[]` aggregate of every failure.
- **`onFailure: "throw"` (default)** — every successful mount BEFORE the failing one still fires `modules:mount-complete`; the failure throws synchronously and `modules:loaded` is NOT emitted (see below).
- **`onFailure: "rollback"`** — same as `throw`: prior successes' `modules:mount-complete` events still fired (they happened before the failure was known), then the failure triggers rollback + throws without emitting `modules:loaded`. Subscribers needing rollback awareness should listen for the thrown SlothletError, not for any lifecycle event.

**Event data:**

```javascript
{
	name: "@org/some-module",        // packageName from package.json
	version: "1.4.2",                // semver from package.json
	mountPath: "drivers.foo",        // effective mountPath; versioned (e.g., "v1.drivers.foo") when multi-version routing applied
	moduleID: "drivers.foo_abc123"   // moduleID returned by the underlying api.add()
}
```

Under `concurrency > 1` event order tracks **completion order**, not start order. Hosts that need strictly-ordered mount events must use the default `concurrency: 1` (serial).

### `modules:loaded`

Emitted after the helper's entire async chain settles. Fires **exactly once on the happy path** — at the end of every `addModule`, `addModules`, or `addDiscovered` call that returns normally. Does **NOT** fire when the call throws:

- **`onFailure: "throw"` (default)** — fires only if every mount succeeded. The first failure rethrows synchronously and skips this emit.
- **`onFailure: "rollback"`** — fires only if every mount succeeded. Any failure triggers a best-effort rollback and rethrows; this emit is skipped.
- **`onFailure: "best-effort"`** — always fires; the payload includes the `failed[]` aggregate alongside `mounted[]`.

Hosts that need a "settled regardless of outcome" signal should either use `best-effort` and inspect `failed[]`, or wrap the call in their own try/catch.

**Event data:**

```javascript
{
	mounted: [ /* MountResult[] for every successful mount */ ],
	failed?: [ /* FailureEntry[] with { item, error } — only present when onFailure was "best-effort" */ ],
	stale?: [ /* MountResult[] — only present on addDiscovered chains that ran discover() */ ]
}
```

Useful as a "module system is ready" signal for hosts that gate downstream work on the discovery + mount cycle completing.

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
console.log(typeof api.math); // "function" - even if math module exports an object

// __type returns the real implementation type
console.log(api.math.__type); // api.slothlet.types.UNMATERIALIZED  (not loaded yet)
// api.slothlet.types.IN_FLIGHT        (loading)
// "object"                            (loaded, object export)
// "function"                          (loaded, function export)
```

### `api.slothlet.types` symbols

| Symbol                              | Meaning                                            |
| ----------------------------------- | -------------------------------------------------- |
| `api.slothlet.types.UNMATERIALIZED` | Module not yet loaded; materialization not started |
| `api.slothlet.types.IN_FLIGHT`      | Materialization in progress                        |

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

| Use case                        | Recommendation                                 |
| ------------------------------- | ---------------------------------------------- |
| First-call latency is critical  | Enable (`tracking: { materialization: true }`) |
| Fast startup is critical        | Disable (default)                              |
| Large API, not all modules used | Disable                                        |
| Small API, most modules used    | Enable                                         |
| Unit/integration tests          | Enable for predictable behavior                |

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

| Method                        | Description                             | Returns    |
| ----------------------------- | --------------------------------------- | ---------- |
| `on(event, handler)`          | Subscribe to lifecycle event            | `void`     |
| `off(event, handler)`         | Unsubscribe handler                     | `void`     |
| `subscribe(event, handler)`   | Subscribe, returns unsubscribe function | `Function` |
| `unsubscribe(event, handler)` | Alias for `off()`                       | `void`     |

**Available events:** `impl:created` · `impl:changed` · `impl:removed` · `impl:warning` · `impl:error` · `materialized:complete`

Register handlers before the api builds (to observe init-time events) with the [`lifecycle` config option](#construction-time-subscription-lifecycle-config-option).

### api.slothlet.materialize

| Property/Method | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `wait()`        | `Promise<void>` - resolves when all background materialization completes |
| `get()`         | Returns materialization stats (total, completed count)                   |
| `materialized`  | `boolean` - `true` when all modules are loaded                           |

### api.slothlet.types

| Symbol                              | Meaning                       |
| ----------------------------------- | ----------------------------- |
| `api.slothlet.types.UNMATERIALIZED` | Module proxy, not yet loading |
| `api.slothlet.types.IN_FLIGHT`      | Module loading in progress    |

### `mod.__type`

Direct property on any lazy-mode proxy. Returns `api.slothlet.types.UNMATERIALIZED`, `api.slothlet.types.IN_FLIGHT`, or a `typeof` string once materialized.

---

## See Also

- [Module Structure](MODULE-STRUCTURE.md) - All structural patterns including lazy mode
- [Hooks](HOOKS.md) - Intercept function calls with before/after/always/error hooks
- [Performance](PERFORMANCE.md) - Eager vs. lazy mode performance characteristics
