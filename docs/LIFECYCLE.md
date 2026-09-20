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

Emitted when a module implementation is first placed on the composed api — during initial `slothlet()` startup or via `api.slothlet.api.add()`. It fires **post-placement**, once, for the contribution that actually owns the path: when two modules collide at one leaf, the event fires only for the winner, never for the contribution collision resolution discards. It carries the **wrapped** leaf (`wrapper.__impl`), not a raw unwrapped callable — a subscriber can identify and inspect the leaf without being handed a function that bypasses slothlet's context/permission wrapping.

**Event data:**

```javascript
{
	apiPath: "plugins.auth",         // API path dot-notation
	wrapper: { __impl: [Function] }, // Frozen, minimal wrapper around the placed leaf's impl
	source: "initial",               // "initial" | "hot-reload" | "lazy-materialization"
	moduleID: "plugins_xyz789",      // Module identifier of the placed owner
	filePath: "/path/to/auth.mjs",   // Absolute source file path
	sourceFolder: "/path/to/plugins" // Source directory
}
```

> The raw `impl` field was removed in v3.16.x (#398): it exposed the module's unwrapped callable, which a subscriber could invoke outside slothlet's enforced boundary. Read `data.wrapper.__impl` for the leaf's implementation. The event now also fires only for the leaf actually placed on the tree, so a registry keyed off it no longer records a contribution that a later merge discards.

### `impl:changed`

Emitted when a placed module implementation is replaced - during `api.slothlet.api.reload()` or `api.slothlet.reload()`.

**Event data:** Same shape as `impl:created` (carries `wrapper`, not a raw `impl`; fires for the placed owner).

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

Because `impl:created` fires post-placement for the winning contribution only (#398), a registry built this way records the module that actually owns each path — not a contribution a later collision discards. If you need the leaf's implementation in the registry, read `data.wrapper.__impl` (the wrapped leaf), never a raw callable.

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

Each array entry normalizes to `{ name, mode, recursive, order, cascade }`:

| Entry form                                      | Normalizes to                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `"launch"`                                      | `{ name: "launch", mode: "manual", recursive: false, order: "mount", cascade: true }`    |
| `"prefetch:startup"`                            | `{ name: "prefetch", mode: "startup", recursive: false, order: "mount", cascade: true }` |
| `{ name: "warmup" }`                            | `{ name: "warmup", mode: "manual", recursive: false, order: "mount", cascade: true }`    |
| `{ name, mode?, recursive?, order?, cascade? }` | `mode`/`recursive`/`order`/`cascade` default as shown; everything else used verbatim     |

`recursive`, `order`, and `cascade` are only settable via the object form — the string shorthands always mean `recursive: false`, `cascade: true`, `order` defaulted by mode (see below). `cascade: false` suppresses the root run-all cascade for a per-entity routine — see [Per-entity routines](#per-entity-routines-cascade-false-forkey-and-contributors) below.

`mode` controls how a routine fires:

- **`"startup"`** — runs once, as the final awaited step of composition. `await slothlet(...)` resolves only after every `"startup"` routine's cascade completes.
- **`"shutdown"`** — runs on dispose, via the existing teardown path (`api.shutdown()` and `api.slothlet.shutdown()` both trigger it) — not a competing `self.shutdown` property.
- **`"destroy"`** — runs from `api.destroy()` specifically. `"shutdown"`-mode routines still also run as part of `destroy()` (it calls the root `shutdown()` internally) — `"destroy"` mode is for a routine meant to fire on `destroy()` only.
- **`"manual"`** (default when omitted) — never runs automatically; the host calls it explicitly.

Every mode's wrapping happens unconditionally — `self.<path>()` is always directly callable regardless of mode. The _automatic_ firing at the mode's trigger point (compose end for `startup`, dispose for `shutdown`/`destroy`) is gated by [`autoRoutines`](#autoroutines) (`false` by default). Whether **more than one** contributor at the same exact api path actually runs is a separate, independent question — see [`stackRoutines`](#stackroutines) below; by default only the single contributor that actually owns that path (per whatever `collisionMode` resolved) runs, matching how every other part of the framework has always worked.

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

At any exact composed api path where a mounted module's contribution resolves, `self.<path>` is that contribution's callable. When **[`stackRoutines`](#stackroutines) is `true`** and more than one module's contribution resolves to the identical api path, `self.<path>` becomes **one callable** that runs every contributor's function in registration order, sequentially, awaiting each — instead of just the single module that would otherwise win the path under the instance's `collisionMode`:

```javascript
// package A mounts at ["auth"], package B mounts at ["auth"] too — both export `initialize`
const api = await slothlet({ dir: "./api", stackRoutines: true });
await api.slothlet.api.add(["auth"], "./plugins/auth-core/api");
await api.slothlet.api.add(["auth"], "./plugins/auth-audit/api");

await api.auth.initialize(); // runs auth-core's initialize, then auth-audit's — both, in mount order
```

Without `stackRoutines: true` (the default), the same setup runs only whichever contribution actually owns `auth.initialize` on the real composed tree — the other module's contribution is never invoked, matching ordinary (non-routine) collision behavior everywhere else in the framework.

Slothlet also generates a **root cascade** for each configured routine — `api.<name>()` (equivalently `self.<name>()` inside a module; a dotted or `^`-prefixed name is reachable via bracket notation, e.g. `api["admin.initialize"]`) — that runs every matching contribution, grouped by exact path, the groups ordered per the routine's `order`. The cascade is installed **only** at the root `api.<name>` — it is not mirrored onto the `api.slothlet.*` control namespace (the `shutdown`/`destroy` dispose builtins, which do live at `api.slothlet.shutdown`/`destroy`, are a separate framework surface). Contributions at distinct paths are always unconditional; a group whose contributors collide at the identical path follows the same `stackRoutines` rule described above — all of them run together only with `stackRoutines: true`, otherwise just the current owner at that path runs:

- **`order: "mount"`** (default for `startup`/`manual`) — groups run in first-appearance registration order.
- **`order: "depth"`** (default for `shutdown`/`destroy`) — groups run deepest-path-first; contributors colliding at the identical path still run in registration order relative to each other, since depth can't distinguish those.

```javascript
await api.initialize(); // runs every matching "initialize" contribution, in that routine's order
```

A later `api.slothlet.api.add()` re-derives every stacked callable (new contributors join it), but does not re-fire a `"startup"` routine — those run exactly once, at the end of the initial compose.

### Per-entity routines: `cascade: false`, `.for(key)`, and `.contributors`

The root cascade is a **run-all**: `api.<name>()` fires every matching contribution. That is exactly wrong for a **per-entity** lifecycle — a namespace co-owned by several first-class packages, each contributing its own function at the _same_ leaf, where the host must invoke **exactly one** contributor (the one belonging to the entity being activated), never all of them. Two config-level controls cover that:

- **`cascade: false`** on a routine entry (default `true`) — do not create the root `api.<name>()` run-all cascade at all. Use it when a run-all would be a bug.
- **`api.<path>.<name>.for(key)`** — invoke the single contributor whose **moduleID** is `key`, run in that contributor's own extent + identity (ambient `self.*` and permission checks resolve against _that_ contributor), with the call's arguments passed straight through. It deliberately **bypasses the `stackRoutines` owner-filter**: selecting a specific co-owner is the whole point, so a contributor that would lose the shared-path collision still runs when addressed by key. An unknown `key` throws `INVALID_ARGUMENT`.
- **`api.<path>.<name>.contributors`** — the moduleIDs present at that stacked path, in registration order, so a host can discover which co-owners it may address (symmetry with `versioning.list(path)`).

Worked example — two packages co-own `self.storage`, each with its own `activate` at `self.storage.activate` (moduleIDs `"A"` and `"B"`):

```javascript
const api = await slothlet({
	base: "./api",
	routines: [
		{ name: "activate", mode: "manual", cascade: false },
		{ name: "deactivate", mode: "manual", cascade: false }
	],
	stackRoutines: true
});

api.activate; // → undefined        (no run-all cascade — cascade:false)
api.storage.activate.contributors; // → ["A", "B"]       (discover the co-owners)
await api.storage.activate.for("A")(ctx); // runs ONLY A.activate(ctx),   in A's extent + identity
await api.storage.activate.for("B")(id, text); // runs ONLY B.activate(id, text), in B's extent + identity
await api.storage.deactivate.for("B")(ctx); // runs ONLY B.deactivate(ctx)
```

`.for(key)` narrows _which_ contributor and returns its callable; the call after it supplies _what args_, positionally — `api.storage.activate("x")` (the base stacked callable) still runs every contributor at the path with `("x")`, while `api.storage.activate.for("B")("x")` runs only `B` with `("x")`. The selector must precede the invocation: `activate.for("B")(args)`, never `activate(args).for("B")`.

### Execution extent

Every contribution runs **exactly as if it had been called directly** — inside the instance's own extent, attributed to its own module's wrapper. So ambient `self.*` inside a routine body resolves, and a permission check on a `self.*` call is evaluated against the contributing module's identity, never a shared slot or the instance root. This holds whether the contribution is invoked per-path (`api.<path>.<name>()`) or through the root cascade (`api.<name>()`), so a cascade needs no `api.slothlet.run(...)` wrap to make `self.*` resolve. A routine fans a call out to every matching contribution without changing the semantics of any one of them. (Fixed in v3.16.2: the root cascade previously ran contributors with no active extent, so a contributor reaching `self.*` threw `RUNTIME_NO_ACTIVE_CONTEXT_SELF` — see [#394](https://github.com/CLDMV/slothlet/pull/394).)

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

### `stackRoutines`

**Type**: `boolean` · **Default**: `false`

Whether two or more modules' contributions colliding at the exact same composed api path all run, or only the single contribution that actually owns that path (per the instance's `collisionMode`) runs. `false` by default — matching ordinary (non-routine) collision behavior everywhere else in the framework, where a colliding key always resolves to one winner.

This is **deliberately independent of `collisionMode`** — it is its own flag, not a side effect of `merge`/`replace`/any other collision mode. A module that loses a collision, under any `collisionMode`, does not run via the routine system unless `stackRoutines: true` is set explicitly. Set `true` to let every contributor at a shared path run (see [Stacking and the root cascade](#stacking-and-the-root-cascade) above for the mechanics and an example).

The root cascade (`api.<name>()`) runs every matching contribution across **distinct** api paths regardless of this flag. Where two or more contributions land on the **identical** api path, the cascade applies the same `stackRoutines` filtering a direct call at that path would: only the current owner's contribution runs there by default, and every contributor at that shared path runs when `stackRoutines: true`.

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
