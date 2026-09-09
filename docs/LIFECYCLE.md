# Module Lifecycle

This document covers the lifecycle event system, module type inspection, and background materialization for lazy-mode optimization.

## Table of Contents

- [Lifecycle Events](#lifecycle-events)
- [Routines](#routines)
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

// on() returns an unsubscribe function
const unsubscribe = api.slothlet.lifecycle.on("impl:changed", (data) => {
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

Any event name is accepted — the map is just a set of early subscriptions. The value must be a function or an array of functions; an invalid shape throws `INVALID_CONFIG` at construction.

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

Emitted for a **non-throwing** diagnostic warning — a condition slothlet handled and continued past, both at runtime (e.g. a synthetic `api.slothlet.api.add()` whose default export cannot be placed at the root) and during cold-start initialization (e.g. multiple root-level default exports, or a user API that shadows the reserved `slothlet` property). The event is **additive**: it always fires, independent of the `silent` config — `silent` gates only slothlet's own `console.warn` output (consistently across every warning site, runtime and init-time alike), never event delivery. So under `silent: true` the console stays quiet while `impl:warning` subscribers still observe every diagnostic. Init-time configuration that is genuinely invalid still **throws** — only non-throwing warnings emit this event.

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

## Routines

A **routine** is a named cross-module runnable: every mounted module that exports a function matching a configured routine name is stacked into one callable at its exact composed api path, plus a root cascade that runs every matching contribution anywhere. This solves a gap ordinary composition leaves open — when a coordinator and its contributors all mount into the same namespace (e.g. several packages each contributing to `self.auth`), an ordinary leaf named `initialize` recursive-merges to a single first-writer and silently drops every other contributor. A configured routine name stacks them instead.

Routines are not hooks (`api.slothlet.hook.*` intercepts calls), not phases (a hook's before/primary/after phases, or module discovery's own phases), and not the `impl:*` lifecycle event emitter (`api.slothlet.lifecycle`). They compose with all three — a routine contributor is an ordinary exported function, discoverable like any other leaf and callable directly in addition to being stacked. Routines also fully replace the legacy [`collectLifecycleHooks`](#construction-time-subscription-lifecycle-config-option) option's internals — see [Relationship to `collectLifecycleHooks`](#relationship-to-collectlifecyclehooks) below.

### Configuring routines

```javascript
const api = await slothlet({ dir: "./api", routines: [...slothlet.defaults.routines, "launch"] });
```

Slothlet ships two built-in defaults, exposed as `slothlet.defaults.routines`:

| Name         | Mode         |
| ------------ | ------------ |
| `initialize` | `"startup"`  |
| `shutdown`   | `"shutdown"` |

Passing `routines` at all **replaces** the built-ins — that is the off switch:

```javascript
slothlet({ dir: "./api", routines: [...slothlet.defaults.routines, "launch"] }); // extend the defaults
slothlet({ dir: "./api", routines: ["launch"] }); // REPLACE — no initialize/shutdown
slothlet({ dir: "./api", routines: [] }); // disable every routine
slothlet({ dir: "./api" }); // omit routines — keeps the built-in defaults
```

`slothlet.defaults.routines` is frozen (at every level) and derived from the exact constant the runtime reads — spread it to extend, or filter it to drop one default while keeping the other:

```javascript
slothlet.defaults.routines.filter((r) => r.name !== "shutdown"); // keep initialize, drop shutdown
```

Each array entry normalizes to `{ name, mode, recursive, order }`:

| Entry form                            | Normalizes to                                                              |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `"launch"`                            | `{ name: "launch", mode: "manual", recursive: false, order: "mount" }`     |
| `"prefetch:startup"`                  | `{ name: "prefetch", mode: "startup", recursive: false, order: "mount" }`  |
| `{ name: "warmup" }`                  | `{ name: "warmup", mode: "manual", recursive: false, order: "mount" }`     |
| `{ name, mode?, recursive?, order? }` | `mode`/`recursive`/`order` default as shown; everything else used verbatim |

`recursive` and `order` are only settable via the object form — the string shorthands always mean `recursive: false`, `order` defaulted by mode (see below).

`mode` controls how a routine fires:

- **`"startup"`** — runs once, as the final awaited step of composition. `await slothlet(...)` resolves only after every `"startup"` routine's cascade completes.
- **`"shutdown"`** — runs on dispose, via the existing teardown path (`api.shutdown()` and `api.slothlet.shutdown()` both trigger it) — not a competing `self.shutdown` property.
- **`"destroy"`** — runs from `api.destroy()` specifically. `"shutdown"`-mode routines still also run as part of `destroy()` (it calls the root `shutdown()` internally) — `"destroy"` mode is for a routine meant to fire on `destroy()` only.
- **`"manual"`** (default when omitted) — never runs automatically; the host calls it explicitly.

Every mode's wrapping/stacking happens unconditionally — `self.<path>()` is always directly callable regardless of mode. Only the _automatic_ firing at the mode's trigger point (compose end for `startup`, dispose for `shutdown`/`destroy`) is gated by [`autoRoutines`](#autoroutines) (`false` by default). This is about the `autoRoutines` gate specifically, not a guarantee that a path's stacked callable is always current: the root cascade always force-materializes what it needs and re-reads current state on every call, but the path-level stacked callable is only (re)installed at compose end, after `api.add()`, or right before an auto-fired cascade runs — not on an ordinary property touch or a late direct `self.x.y = fn` reassignment (both of those are still captured into the registry, just not promoted). For the common single-contributor-per-path case this is invisible either way; it only becomes observable when two or more contributors collide on the exact same composed api path and the second is captured after the last rebuild already ran — see the v3.16.0 changelog's "Known Limitations" and #362 for the tracked follow-up.

### Name matching: bare, mount-relative, recursive, or root-anchored

A routine's `name` is resolved **relative to a mount point** by default — a mount point being either a top-level entry from the initial `dir` scan, or the target of an explicit `api.slothlet.api.add(mountPath, ...)` call. This, not "anywhere in the tree," is the default matching scope. A mount-relative name is compiled via the **same glob engine** (`compilePattern()`, `helpers/pattern-matcher.mjs` — `*`, `**`, `{}`, `!`) as a `^`-anchored one; the only difference is what it's matched against — a mount-relative name is matched against the path **relative to its own mount**, a `^`-anchored name against the **full absolute api path**. So `"admin.*"` is a perfectly valid (if unusual) mount-relative name, matching every direct child of `admin` within each mount — glob syntax isn't reserved for `^`-anchored names, it's just that a plain identifier like `"admin.initialize"` happens to compile to a pattern that matches only itself:

| Name form                                                                                                  | Resolves against                                                                                          | Lazy-mode materialization cost                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bare, e.g. `"initialize"`                                                                                  | Each mount's own top level only                                                                           | **None** — a mount's own top level is always constructed eagerly, in either mode                                                                                                                                                                                                                                                      |
| Dotted, mount-relative (`recursive: false`, default), e.g. `"admin.initialize"`, `"admin.*"`, `"a{a,b}.*"` | The pattern's matches within each mount, relative to that mount                                           | Only what each `.`-segment actually requires: a literal segment resolves that one child; a single-level wildcard (`*`/`?`) enumerates just its own level; `{}` expands into concrete alternatives up front (`"a{a,b}.*"` walks only `aa`/`ab`, never a sibling `ac`) — none of these touch a sibling subtree the pattern doesn't name |
| Dotted, mount-relative, containing `**` (`recursive: false`), e.g. `"admin.**"`                            | Every depth under wherever the pattern's literal/wildcard prefix narrows to                               | That prefix's own subtree, in full — but never a sibling of that prefix (`"admin.**"` walks all of `admin`, never an unrelated `quiet` under the same mount)                                                                                                                                                                          |
| Mount-relative, `recursive: true`, or a `!`-negated name                                                   | The name at any depth within each mount's own subtree (`recursive: true`), or a computed complement (`!`) | That mount's entire subtree — unbounded from the mount's own root, not from any narrowing prefix                                                                                                                                                                                                                                      |
| Root-anchored (`^` prefix), e.g. `"^ext.*.initialize"`                                                     | The full absolute api path, crossing mount boundaries                                                     | The entire composed tree (not mount-scoped at all)                                                                                                                                                                                                                                                                                    |

`recursive` has no effect on a `^`-anchored name — that form already expresses depth directly via `*` vs `**` in the pattern.

The lazy-mode cost is precisely scoped to what the configured pattern actually requires — never a blanket "routines + lazy mode = eager everything." A `^`-anchored or `recursive: true` cascade forces materialization immediately before it runs (at `startup`'s compose-end step, or at `shutdown`/`destroy` dispose time), not proactively at every compose — this is the one documented crux of combining lazy mode with a non-bare routine name.

### Module side

Any file composed into a mount can export a routine name as an ordinary function:

```javascript
// any file under a mount's own top level:
export function initialize() {
	/* self.* is fully composed here */
}
export function shutdown() {
	/* teardown */
}
```

A routine name is just an ordinary export otherwise — it can sit alongside normal leaves in the same file, and stays directly callable on its own in addition to being folded into its path's stack.

### Stacking and the root cascade

At any exact composed api path where one or more mounted modules' contributions resolve, `self.<path>` becomes **one callable** that runs every contributor's function in registration order, sequentially, awaiting each:

```javascript
// package A mounts at ["auth"], package B mounts at ["auth"] too — both export `initialize`
await api.slothlet.api.add(["auth"], "./plugins/auth-core/api");
await api.slothlet.api.add(["auth"], "./plugins/auth-audit/api");

await api.auth.initialize(); // runs auth-core's initialize, then auth-audit's — both, in mount order
```

Slothlet also generates a **root cascade** for each configured routine — `self.<name>()`, mirrored at `api.slothlet.<name>()` (a dotted or `^`-prefixed name is reachable via bracket notation, e.g. `api.slothlet["admin.initialize"]`) — that runs every matching contribution anywhere, grouped by exact path, the groups ordered per the routine's `order`:

- **`order: "mount"`** (default for `startup`/`manual`) — groups run in first-appearance registration order.
- **`order: "depth"`** (default for `shutdown`/`destroy`) — groups run deepest-path-first; contributors colliding at the identical path still run in registration order relative to each other, since depth can't distinguish those.

```javascript
await api.slothlet.initialize(); // runs every matching "initialize" contribution, in that routine's order
await api.initialize(); // identical — the bare top-level property is the same cascade
```

A later `api.slothlet.api.add()` re-derives every stacked callable (new contributors join it), but does not re-fire a `"startup"` routine — those run exactly once, at the end of the initial compose.

### Errors: best-effort, aggregated

A contributor that throws does **not** stop the rest of the chain — every contributor still gets a chance to run, mirroring the framework's existing best-effort conventions and the dispose path this replaces. Each failure is individually attributed; if any occurred, once everything has run, one aggregate `SlothletError` (`ROUTINE_FAILED`) is thrown:

```javascript
try {
	await api.auth.initialize();
} catch (error) {
	// error.code === "ROUTINE_FAILED"
	// error.context.count === 2                                // total failures
	// error.context.failures === [{ apiPath, moduleID }, ...]  // every failure, in order
	// error.context.apiPath / .moduleID                        // the FIRST failure, for quick access
	// error.cause is the first failure's own thrown error
}
```

### `autoRoutines`

**Type**: `boolean` · **Default**: `false`

TEMPORARY v3-compat gate: a project upgrading to a slothlet version carrying routines sees no behavior change by default — a pre-existing nested leaf that happens to share a routine's name (e.g. `shutdown`) stays stacked and directly callable, but does not start auto-firing. Set `true` to enable automatic firing (`startup` at compose end, `shutdown`/`destroy` at dispose). Planned to default to `true` in v4, at which point `collectLifecycleHooks` (below) is removed.

### Relationship to `collectLifecycleHooks`

The legacy [`collectLifecycleHooks`](#construction-time-subscription-lifecycle-config-option) option (a boolean, opt-in nested `shutdown`/`destroy` discovery) is now implemented entirely in terms of routines rather than a separate parallel mechanism. Setting it `true` does three things:

1. Sets the effective `autoRoutines` to `true` (unless `autoRoutines` is given explicitly, which always wins).
2. Injects two implicit routines reproducing its exact historical scope: `{ name: "^**.shutdown", mode: "shutdown", order: "depth" }` and `{ name: "^**.destroy", mode: "destroy", order: "depth" }` — root-anchored, so they match a literally-named `shutdown`/`destroy` leaf anywhere in the tree, crossing every mount boundary, deepest-first.
3. Drops any existing `shutdown`/`destroy`-mode routine (including the built-in `shutdown` default) — a root-anchored routine of the same mode strictly subsumes a narrower mount-relative one, and keeping both would double-invoke the same contributor.

`collectLifecycleHooks` is deprecated in favor of configuring `routines`/`autoRoutines` directly, and will be removed in v4.

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

| Method                | Description                             | Returns    |
| --------------------- | --------------------------------------- | ---------- |
| `on(event, handler)`  | Subscribe, returns unsubscribe function | `Function` |
| `off(event, handler)` | Unsubscribe handler                     | `void`     |

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
