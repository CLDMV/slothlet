# Configuration Reference

Complete reference for all slothlet configuration options. Pass these as properties of the options object to `slothlet({ ... })`.

---

## Quick Reference

```javascript
const api = await slothlet({
	// Required
	base: "./api", // API directory (node) or base URL (browser); `dir` is a deprecated alias

	// API build
	mode: "eager", // "eager" | "lazy"
	runtime: "async", // "async" | "live"
	helpers: "instance", // "instance" | "module" — one copy of each helper file per instance, or per importing api file
	apiDepth: Infinity, // number | Infinity
	hidden: [], // string | string[] — globs hiding files/folders from the API
	scanHiddenFolders: false, // DEPRECATED escape hatch — scan "."/"__"-prefixed folders (removed in v4)

	// Collision control
	api: {
		collision: "merge", // string or { initial, api }
		mutations: {
			add: true,
			remove: true,
			reload: true
		}
	},

	// Context
	context: null,
	reference: null,
	scope: { merge: "shallow" }, // "shallow" | "deep"

	// Hooks
	hook: false, // boolean | string | object

	// Permissions (off without this block) — see PERMISSIONS.md
	permissions: { defaultPolicy: "allow", attribution: "precise" }, // attribution: "precise" | "fast"

	// Debug / diagnostics
	debug: false,
	silent: false,
	diagnostics: false,
	tracking: false,
	backgroundMaterialize: false,

	// Time (host only) — see the `clock` section
	clock: undefined, // { now, setTimeout, clearTimeout } — each member optional

	// i18n (dev-facing; process-global)
	i18n: { language: "en-us" },

	// TypeScript
	typescript: false, // see TYPESCRIPT.md

	// Bug-fix suppression (temporary escape hatch — removed in v4)
	suppressFixes: [] // string[] — e.g. ["C03_116"]
});
```

---

## Base Directory

### `base`

**Type**: `string` (path in node mode; base URL in browser mode) | `null`
**Required**: No — omit it for an instance built entirely through `api.add()` (see below).

In node mode it is the directory to scan for API modules (relative paths are resolved from the calling file); in browser mode it is the base URL used to resolve module specifiers. `dir` is a **deprecated v3 alias** for `base` — it still works but emits a `V3_CONFIG_DEPRECATED` warning (unless `silent: true`) and will be removed in v4.

```javascript
const api = await slothlet({ base: "./api" });
const api = await slothlet({ base: "/absolute/path/to/api" });
```

**No base directory.** Omit `base` (or pass `base: null`) to start from an empty root and build the whole tree at runtime with [`api.slothlet.api.add()`](./RELOAD.md#apislothletapiadd) — directories, in-memory `{ exports }` objects, at a path or at the root (`""`). Nothing is scanned, so there is no `WARN_DIRECTORY_EMPTY`; permissions, lifecycle, `remove()`, and both reload forms work as usual, and a full `reload()` replays what was added.

```javascript
const api = await slothlet({ mode: "eager" }); // no base
await api.slothlet.api.add("services", { exports: { now: () => Date.now() } });
await api.slothlet.api.add("plugins", "./plugins");
```

A base that is given but unusable still fails loudly: an empty string throws `INVALID_CONFIG_DIR_MISSING`, a path that does not exist throws, and an existing but empty directory still warns `WARN_DIRECTORY_EMPTY`. In browser mode the same applies, and a `manifest` is only needed with a base — a manifest that lists files without a base throws `INVALID_CONFIG_DIR_MISSING`, since those files cannot be resolved.

---

## API Build Options

### `mode`

**Type**: `"eager"` | `"lazy"`
**Default**: `"eager"`

Controls when API modules are loaded and materialized.

- **`"eager"`** - All modules are loaded and the API is fully built on initialization. Safe for all runtimes.
- **`"lazy"`** - Modules are loaded on first access via a Proxy. Reduces startup time for large APIs.

Also accepted: `"immediate"` / `"preload"` (aliases for `"eager"`); `"deferred"` / `"proxy"` (aliases for `"lazy"`).

```javascript
const api = await slothlet({ dir: "./api", mode: "lazy" });
```

See [LIFECYCLE.md](LIFECYCLE.md) for lazy mode behavior, proxy semantics, and materialization details.

---

### `runtime`

**Type**: `"async"` | `"live"`
**Default**: `"async"`

Selects the context-propagation runtime.

- **`"async"`** - Uses AsyncLocalStorage (Node.js built-in). Recommended for all production use.
- **`"live"`** - Experimental live bindings mode. Has known limitations; do not use in production.

Also accepted: `"asynclocalstorage"` / `"als"` / `"node"` (aliases for `"async"`).

```javascript
const api = await slothlet({ dir: "./api", runtime: "async" });
```

See [CONTEXT-PROPAGATION.md](CONTEXT-PROPAGATION.md) for context runtime details.

---

### `helpers`

**Type**: `"instance"` | `"module"`
**Default**: `"instance"`

How often an instance loads a **helper file**: a file an api file imports by a relative path (or from its own package) that is no api file itself, such as `api/orders.mjs` importing `../lib/queue.mjs`.

- **`"instance"`** - Once per instance. Every api file importing the helper gets the same module, so state the helper keeps at module level (a cache, a counter, a queue) is shared between them, as in any JavaScript program. See [Helper Modules Are Per Instance](MODULE-STRUCTURE.md#helper-modules-are-per-instance).
- **`"module"`** - Once per importing api file. Each api file gets its own copy of every helper it imports, directly or through other helpers. An api file mounted twice with `api.slothlet.api.add()` gets a copy per mount.

```javascript
// lib/tally.mjs
let count = 0;
export const bump = () => ++count;

// api/one.mjs and api/two.mjs both:  import { bump } from "../lib/tally.mjs";  export const next = () => bump();
```

```javascript
const shared = await slothlet({ base: "./api" });
[await shared.one.next(), await shared.two.next()]; // [1, 2] - one count

const apart = await slothlet({ base: "./api", helpers: "module" });
[await apart.one.next(), await apart.two.next()]; // [1, 1] - a count each
```

**Why turn it on.** A helper file has no api path, so with one shared copy the permission system can only say that the helper's code belongs to the api files importing it, and holds it to all of them where it cannot tell more (see [a helper file's code](PERMISSIONS.md#file-level-code-has-its-own-permission-path)). With a copy per api file, each copy's code is known to be that one file's: a helper function a leaf hands out, and a timer or queue the helper starts when it loads, run as the module of the api file the copy was loaded for, under `permissions.attribution: "fast"` as well.

**What it costs.**

- **Helper state is no longer shared between api files.** A cache, connection pool, registry or queue kept in a helper becomes one per importing api file. Programs that rely on api files sharing a helper's state must keep the default, or move that state to a package or to slothlet's `context`.
- **Memory and load time.** Each helper is compiled and evaluated once per api file that imports it, and whatever it starts when it loads (timers, connections) starts once per copy.
- `instanceof` between copies fails: a class declared in a helper is a different class in each copy.

**Limits.**

- **CommonJS helpers** are copied per api file too, so their state is separate, but a CommonJS file's stack frames carry only its path, not which copy is running. For permissions a CommonJS helper's own code therefore stays held to every api file that loads the helper.
- **Packages are never copied**: a file in another package (`node_modules`, or a folder with its own named `package.json`) is one module for the whole process, as before.
- **Browser builds are not affected.** Without Node's resolve hook or the vite plugin (`slothletInstanceImports()`), the browser loads what a file imports itself, so there is one copy and the every-importer rule applies. The option is accepted and does nothing there.
- A partial reload re-imports the reloaded api files, which link against their existing helper copies, as with `"instance"`.

```javascript
const api = await slothlet({ base: "./api", helpers: "module" });
```

---

### `apiDepth`

**Type**: `number` | `Infinity`
**Default**: `Infinity`

Limits how many directory levels deep slothlet scans when building the API from `dir`. Useful for monorepo layouts or large directory trees where you want to restrict which subdirectories become API namespaces.

```javascript
// Only scan top-level dir and one level deep
const api = await slothlet({ dir: "./api", apiDepth: 1 });
```

Setting `Infinity` (default) scans all subdirectories.

---

### `hidden`

**Type**: `string` | `string[]`
**Default**: none

Glob or array of globs hiding files and folders from the API. Each glob is matched against an entry's path **relative to `dir`** — written folder-style (`internal/secret`) or dotted (`internal.secret`); files match on their extension-stripped path (`math/scratch.mjs` matches `math.scratch`). Supported syntax: `*` (one segment), `**` (any number of segments, none included: `tools/**` names `tools` itself, a root file `tools.mjs` included, as well as everything in the folder), `?` (one char), `{a,b}` (alternation), `!` (negation).

> **Match the on-disk name, not the API key.** Globs are tested against the raw directory/file name as it appears on disk, _before_ it is sanitized into a JavaScript-safe API property. A folder `draft-notes` (surfaced as `api.draftNotes`) is hidden with `hidden: "draft-notes"`, not `hidden: "draftNotes"`.

```javascript
// Hide a folder, a nested subtree, and one file
const api = await slothlet({ dir: "./api", hidden: ["drafts", "internal/**", "math.scratch"] });
```

`api.slothlet.api.add(path, dir, { hidden })` accepts the same option per call, with globs relative to the **added** folder.

Hidden entries are skipped during scanning, on top of the built-in rule below. A folder whose entire contents are hidden does not create an API key at all.

> **Built-in rule:** files **and** folders whose names start with `.` or `__` are hidden by default — no configuration needed (`.`/`__`-prefixed _folders_ can be restored via the deprecated `scanHiddenFolders` below; files stay hidden).

---

### `scanHiddenFolders`

**Type**: `boolean`
**Default**: `false`
**Deprecated** — temporary escape hatch, removed in v4.

Before v3.11, the `.`/`__` hidden-name rule applied only to files; folders with such names were scanned and surfaced in the API (a dot-prefixed folder appeared under its sanitized name). Folders are now hidden by default. If you depended on the old behavior, `scanHiddenFolders: true` restores hidden-**folder** scanning while you migrate; supplying the option emits a `CONFIG_SCAN_HIDDEN_FOLDERS_DEPRECATED` warning (unless `silent: true`). Also accepted per call on `api.slothlet.api.add(path, dir, { scanHiddenFolders })`.

```javascript
// Temporary: keep loading .legacy/ as api.legacy while migrating
const api = await slothlet({ dir: "./api", scanHiddenFolders: true });
```

---

## Collision Options

### `api.collision`

**Type**: `string` | `{ initial: string, api: string }`
**Default**: `"merge"`

Controls behavior when two modules export a property at the same API path.

| Mode              | Behavior                                                           |
| ----------------- | ------------------------------------------------------------------ |
| `"merge"`         | Merge properties - preserve originals and add new ones _(default)_ |
| `"merge-replace"` | Merge properties - add new ones and overwrite overlapping values   |
| `"replace"`       | Replace existing value completely                                  |
| `"skip"`          | Silently ignore the collision, keep the existing value             |
| `"warn"`          | Warn about the collision, keep the existing value                  |
| `"error"`         | Throw an error on collision                                        |

Use the object form to specify different strategies for the initial API build vs. runtime `api.slothlet.api.add()` operations:

```javascript
const api = await slothlet({
	dir: "./api",
	api: {
		collision: {
			initial: "merge", // During initial build
			api: "replace" // During api.slothlet.api.add()
		}
	}
});
```

String shorthand applies to both contexts:

```javascript
api: {
	collision: "warn";
}
```

See [METADATA.md](METADATA.md) for per-module collision mode overrides via metadata.

---

## Mutation Options

### `api.mutations`

**Type**: `{ add?: boolean, remove?: boolean, reload?: boolean, permissions?: boolean, events?: boolean, allowCollisionOverride?: boolean }`
**Default**: `{ add: true, remove: true, reload: true, permissions: true, events: true, allowCollisionOverride: false }`

Controls which runtime API mutation methods are available. Affects the `api.slothlet.api.*` (module mounting), `api.slothlet.permissions.*` (rule management), and `api.slothlet.event.rules.*` (event-rule management) mutation surfaces.

| Property                 | Default | Controls                                                                                                                                                                                                                                                                                              |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add`                    | `true`  | `api.slothlet.api.add()` - mount new API modules at runtime                                                                                                                                                                                                                                           |
| `remove`                 | `true`  | `api.slothlet.api.remove()` - unmount API modules at runtime                                                                                                                                                                                                                                          |
| `reload`                 | `true`  | `api.slothlet.api.reload()` - hot-reload a module or directory                                                                                                                                                                                                                                        |
| `permissions`            | `true`  | `api.slothlet.permissions.addRule()` / `removeRule()` - add or remove permission rules at runtime                                                                                                                                                                                                     |
| `events`                 | `true`  | `api.slothlet.event.rules.add()` / `remove()` - add or remove event rules at runtime (host-only)                                                                                                                                                                                                      |
| `allowCollisionOverride` | `false` | Honor a per-call `collisionMode` / `mutateExisting` / `recordHistory` on `api.slothlet.api.add()`. Locked by default: passing them warns and the override is ignored (it could bypass the instance's collision config). `forceOverwrite` stays the always-available targeted escape hatch regardless. |

Disable all mutations to create a locked, immutable API:

```javascript
const api = await slothlet({
	dir: "./api",
	api: {
		mutations: { add: false, remove: false, reload: false, permissions: false }
	}
});
```

> **v2 Migration**: The v2 `allowMutation: false` option is detected and mapped to `{ add: false, remove: false, reload: false }` with a deprecation warning.

---

## Context Options

### `context`

**Type**: `object` | `null`
**Default**: `null`

An object that is merged into the per-request context available inside async API functions via `api.slothlet.context.get()`. Useful for injecting shared services (loggers, DB connections, etc.) that API methods can access without explicit parameters.

```javascript
const api = await slothlet({
	dir: "./api",
	context: { db, logger }
});
```

See [CONTEXT-PROPAGATION.md](CONTEXT-PROPAGATION.md) for per-request context isolation and usage patterns.

---

### `reference`

**Type**: `object` | `null`
**Default**: `null`

An object whose properties are merged directly into the root of the built API and also made accessible as `api.slothlet.reference`. Commonly used to expose the API object itself back through `reference` so modules can call peer methods without circular imports.

```javascript
const api = await slothlet({
	dir: "./api",
	reference: { db, config }
});

api.db; // ✅ db is directly on the API
api.config; // ✅
```

---

### `scope`

**Type**: `{ merge: "shallow" | "deep" }`
**Default**: `undefined`

Controls how per-request scope data is merged.

- **`"shallow"`** - Top-level keys are merged (default when scope is provided)
- **`"deep"`** - Deep recursive merge of all nested keys

```javascript
const api = await slothlet({
	dir: "./api",
	scope: { merge: "deep" }
});
```

---

## Permissions

The `permissions` block turns the permission system on; every option it takes is listed in [PERMISSIONS.md](./PERMISSIONS.md#configuration-options). Two of them change what a module is handed, so they are described here too.

`permissions` may also be a bare mode: `"on"`, `"off"` or `"disabled"` is the same as `{ mode }`, `true` is `"on"` and `false` is no block. Any other string or non-object value is an `INVALID_CONFIG`.

With no `permissions` block the system is off: no call, read or event rule is evaluated. That includes the event levels ([EVENTS.md](./EVENTS.md#delivery-levels)): every `self.slothlet.event.on()` subscription is delivered at `allow`, with its payload. Under a `permissions` block the event rules apply, and a subscriber that matches none gets `permissions.events.default` (built-in: `notify`, the trigger without the payload).

### `permissions.typedArrayMembers`

**Type**: `boolean | number`
**Default**: `false`

While the permission system is on, what one module hands another reaches it as a view, except values that hold nothing but their own bytes: a typed array or `Buffer` is handed over as itself, because native code needs the array. A member a module stored on the array under a string key (`bytes.item = instance`) can only be found by listing the array's keys, which lists every index (about 14 ms for 64 KB, 400 ms for 1 MB, on each crossing), so by default it is not looked for and rides along.

| Value            | A typed array or `Buffer` one module hands another                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `false`          | handed over as itself, its keys never listed                                                                     |
| `true`           | its keys are listed; one holding a member of its own is handed over as a view                                    |
| a whole number N | listed when it is N kilobytes or smaller (`byteLength <= N * 1024`); a larger one is handed over as with `false` |

Anything else is rejected with `INVALID_CONFIG`.

```javascript
const api = await slothlet({ base: "./api", permissions: { defaultPolicy: "deny", typedArrayMembers: 64, rules } });
```

### `permissions.attribution`

**Type**: `"precise" | "fast"`
**Default**: `"precise"`

A `self.*` call is allowed only when both the code making it (its definer: the leaf it is written in) and the caller running it are allowed. This option decides how slothlet knows the definer of code a module hands out:

| Value       | A returned function, class, class instance, generator, promise or Proxy export            | Where the call stack cannot tell the definer                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"precise"` | a stand-in recording a fallback definer: not `===` the original, about 1 µs more per call | still known for a function returned directly (browser modules sharing a folder, a CommonJS file two instances load, `provenance: false`); `eval`-built code is refused while `provenance` is on |
| `"fast"`    | the original itself: `===` holds and calls are plain calls                                | refused with `PERMISSION_DENIED`                                                                                                                                                                |

Wherever the stack names the definer, both use it. Plain data comes back as itself under both, unsearched, and with the permission system not on nothing is wrapped or checked under either. Any other value is rejected with `INVALID_CONFIG`.

**`"fast"` together with `provenance: false` keeps no author check.** `provenance` reads who wrote code from the stack and `"precise"` records it on what a module hands out; with both off, every function runs as whoever runs it. It is the one combination in which the two values refuse different things:

```javascript
// rules: defaultPolicy "allow", { caller: "author.**", target: "vault.**", effect: "deny" }
// author returns () => self.vault.get(); runner, which may read the vault, runs it.
//
// { attribution: "precise", provenance: false }  → PERMISSION_DENIED  (the function records author)
// { attribution: "fast",    provenance: false }  → "SECRET"           (the function runs as runner)
// either value with provenance on (the default)  → PERMISSION_DENIED  (the stack names author)
```

```javascript
const api = await slothlet({ base: "./api", permissions: { defaultPolicy: "deny", attribution: "fast", rules } });
```

See [Code a module hands out runs as its definer](./PERMISSIONS.md#code-a-module-hands-out-runs-as-its-definer) for the rule, the trade-off and its limits.

---

## Hook Configuration

### `hook`

**Type**: `boolean` | `string` | `{ enabled, pattern, suppressErrors, pin }`
**Default**: `false`

Enables the hook system, which intercepts API function calls.

```javascript
// Simple enable
const api = await slothlet({ dir: "./api", hook: true });

// Enable with a default pattern filter
const api = await slothlet({ dir: "./api", hook: "database.*" });

// Full object form
const api = await slothlet({
	dir: "./api",
	hook: {
		enabled: true,
		pattern: "**", // Default glob filter for hooks
		suppressErrors: false, // true: don't re-throw after error hooks run
		pin: true // pin each handler to its registering module's identity (see HOOKS.md)
	}
});
```

See [HOOKS.md](HOOKS.md) for the complete hook API and usage guide.

---

## Debug and Diagnostics

### `debug`

**Type**: `boolean` | `object`
**Default**: `false`

Enables verbose internal logging. `true` enables all categories. Pass an object to target specific subsystems:

```javascript
const api = await slothlet({
	dir: "./api",
	debug: {
		builder: false, // API tree construction
		api: false, // api.slothlet.api.* operations
		index: false, // File indexing and scanning
		modes: false, // Flattening mode decisions
		wrapper: false, // Proxy/wrapper construction
		ownership: false, // Module ownership tracking
		context: false, // Context propagation
		initialization: false, // Instance startup/compose
		materialize: false, // Lazy materialization
		versioning: false, // Versioned mounts/dispatcher
		permissions: false // Permission rule resolution
	}
});
```

---

### `silent`

**Type**: `boolean`
**Default**: `false`

Suppresses all console output from slothlet — warnings, deprecation notices, and init-time diagnostics — consistently across every warning site. It gates **only console output**: `impl:warning` / `impl:error` lifecycle events still fire regardless of `silent` (see [LIFECYCLE.md](LIFECYCLE.md)), and it does not affect `debug` logging.

```javascript
const api = await slothlet({ dir: "./api", silent: true });
```

---

### `diagnostics`

**Type**: `boolean`
**Default**: `false`

Enables the `api.slothlet.diag.*` namespace for runtime introspection. Intended for testing and debugging - do not enable in production.

```javascript
const api = await slothlet({ dir: "./api", diagnostics: true });

// Now available:
api.slothlet.diag.describe();
api.slothlet.diag.inspect();
```

See [The `api.slothlet.diag.*` Namespace](#the-apislothletdiag-namespace) below for the full surface.

---

### `lifecycle`

**Type**: `Object.<string, Function | Function[]>`
**Default**: _(none)_

Construction-time lifecycle subscribers, registered on the lifecycle emitter **before** the api builds — so events emitted during the cold-start build (init-time `impl:warning`, `impl:created`, …) are observable. `api.slothlet.lifecycle.on(...)` can only attach _after_ the build, by which point those events have already fired. Maps an event name to a handler `function(data, token)` or an array of handlers; any event name is accepted. The handlers are ordinary subscribers, so they keep receiving runtime events afterward too.

```javascript
const api = await slothlet({
	dir: "./api",
	lifecycle: {
		"impl:warning": (data) => console.warn(`[init] ${data.code}: ${data.message}`),
		"impl:error": [onError, auditError],
		"impl:created": (data) => registry.add(data.apiPath)
	}
});
```

A non-plain-object value (array, class instance, primitive) throws at construction. See [LIFECYCLE.md](LIFECYCLE.md) for the event catalog and the `impl:warning` / `impl:error` payloads.

---

### `collectLifecycleHooks`

**Type**: `boolean`
**Default**: `false`
**Status**: Deprecated — use [`routines`](#routines) / [`autoRoutines`](#autoroutines) directly. Will be removed in v4.

When `true`, expands into two implicit `routines` entries reproducing this option's original scope — a literally-named `shutdown` / `destroy` leaf found anywhere in the API tree, crossing every mount boundary, invoked deepest-first — and sets the effective `autoRoutines` to `true` (unless `autoRoutines` is given explicitly, which always wins). Any existing `shutdown` / `destroy`-mode routine, including the built-in `shutdown` default, is dropped in favor of these, since a root-anchored routine of the same mode strictly subsumes a narrower one. Nested hooks remain directly callable regardless of this option.

```javascript
const api = await slothlet({ dir: "./api", collectLifecycleHooks: true });
// api.shutdown() now also fires nested shutdown() leaves, deepest-first — implemented as an
// implicit `{ name: "^**.shutdown", mode: "shutdown", order: "depth" }` routine.
```

---

### `routines`

**Type**: `Array<string | { name: string, mode?: "manual" | "startup" | "shutdown" | "destroy", recursive?: boolean, order?: "mount" | "depth", cascade?: boolean }>`
**Default**: `slothlet.defaults.routines` — `[{ name: "initialize", mode: "startup" }, { name: "shutdown", mode: "shutdown" }]`

A **routine** is a named cross-module runnable: every mounted module exporting a function matching a configured routine name is composed into a callable at its exact composed api path, plus a root cascade (`self.<name>()` ≡ `api.slothlet.<name>()`) that runs every matching contribution anywhere, each at its own distinct api path. When two or more modules' contributions land on the **identical** api path (e.g. a coordinator and its contributors sharing `self.auth`), whether all of them run there or only the one that owns that path is controlled by [`stackRoutines`](#stackroutines) — off by default, matching ordinary collision behavior; set it `true` to let every contributor at a shared path run instead of only the single contribution that owns that path (per `collisionMode`).

Each entry normalizes to `{ name, mode, recursive, order, cascade }`: a bare `"name"` string (mode `"manual"`), `"name:mode"` (split on the first colon), or `{ name, mode?, recursive?, order?, cascade? }` — `recursive`/`order`/`cascade` are only settable via the object form. Providing `routines` at all **replaces** the built-in defaults — pass `[]` to disable every routine, or spread `slothlet.defaults.routines` to extend rather than replace them. `cascade` (default `true`) governs the root run-all: set `cascade: false` for a **per-entity** routine, where the host invokes exactly one co-owner via `api.<path>.<name>.for(key)` (and discovers the co-owners via `.contributors`) instead of a run-all cascade — see [LIFECYCLE.md](LIFECYCLE.md#per-entity-routines-cascade-false-forkey-and-contributors).

By default, `name` is resolved **relative to a mount point** (a top-level `dir`-scan entry, or an `api.slothlet.api.add()` target) — a bare name only matches a mount's own top level, never anything nested. A dotted name (`"admin.initialize"`) matches a fixed relative sub-path, or with `recursive: true` matches that name at any depth within the mount. A `^`-prefixed name (`"^ext.*.initialize"`) is root-anchored: matched via glob (`*`, `**`, `{}`, `!`) against the full absolute api path, crossing mount boundaries. `order` controls the root cascade's grouping order — `"mount"` (registration order) or `"depth"` (deepest-matching-path first); defaults to `"depth"` for `shutdown`/`destroy`, `"mount"` for `startup`/`manual`.

```javascript
const api = await slothlet({ dir: "./api", routines: [...slothlet.defaults.routines, "launch"] });
// extends the defaults with a new "launch" (manual) routine

const api2 = await slothlet({ dir: "./api", routines: [] });
// disables initialize/shutdown routine behavior entirely
```

See [LIFECYCLE.md](LIFECYCLE.md#routines) for the full contract — name matching, stacking semantics, cascade ordering, `mode` firing rules, and the best-effort, aggregated `ROUTINE_FAILED` error shape.

---

### `autoRoutines`

**Type**: `boolean`
**Default**: `false`

TEMPORARY v3-compat gate (see [LIFECYCLE.md](LIFECYCLE.md#autoroutines)): every configured routine is always stacked and directly callable regardless of this flag — only the _automatic_ firing (`startup` at compose end, `shutdown`/`destroy` at dispose) is gated, so upgrading to a slothlet version carrying routines changes no observable behavior by default. `collectLifecycleHooks: true` also sets the effective value to `true` unless this option is given explicitly. Planned to default to `true` in v4.

```javascript
const api = await slothlet({ dir: "./api", autoRoutines: true });
// "startup"-mode routines now auto-run at compose end; "shutdown"/"destroy"-mode routines auto-run at dispose.
```

---

### `stackRoutines`

**Type**: `boolean`
**Default**: `false`

Whether two or more modules' contributions colliding at the exact same composed api path all run, or only the single contribution that actually owns that path (per [`api.collision`](#apicollision)) runs. `false` by default, matching ordinary (non-routine) collision behavior everywhere else in the framework — a colliding key always resolves to one winner unless explicitly opted into stacking.

Deliberately independent of `collisionMode`: stacking is not a side effect of `merge`, `replace`, or any other mode — a module that loses a collision, under any collision mode, does not run via the routine system unless `stackRoutines: true` is set. The root cascade runs every matching contribution across **distinct** api paths regardless of this flag; where two or more contributions land on the **identical** api path, the cascade applies the same `stackRoutines` filtering a direct call at that path would.

```javascript
const api = await slothlet({ dir: "./api", stackRoutines: true });
await api.slothlet.api.add(["auth"], "./plugins/auth-core/api");
await api.slothlet.api.add(["auth"], "./plugins/auth-audit/api"); // also exports "initialize"

await api.auth.initialize(); // runs both, in mount order — without stackRoutines only one would
```

See [LIFECYCLE.md](LIFECYCLE.md#stackroutines) for the full contract.

---

### `tracking`

**Type**: `boolean` | `{ materialization: boolean }`
**Default**: `false`

Enables internal tracking features.

| Property          | Default | Effect                                                 |
| ----------------- | ------- | ------------------------------------------------------ |
| `materialization` | `false` | Track which lazy-mode API paths have been materialized |

```javascript
const api = await slothlet({ dir: "./api", mode: "lazy", tracking: true });
// or
const api = await slothlet({ dir: "./api", mode: "lazy", tracking: { materialization: true } });
```

---

### `backgroundMaterialize`

**Type**: `boolean`
**Default**: `false`

When using `mode: "lazy"`, immediately begins materializing all API paths in the background after initialization. The API is still usable via proxies before this completes.

```javascript
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	backgroundMaterialize: true
});
```

See [LIFECYCLE.md](LIFECYCLE.md) for materialization details.

---

### `clock`

**Type**: `{ now?: () => number, setTimeout?: Function, clearTimeout?: Function }`
**Default**: none (the functions slothlet loaded with)

The functions an instance reads the time with and starts its deferred work with. Every member is optional, and a member you leave out is the copy slothlet took when it loaded. Anything that is not an object whose given members are functions throws `INVALID_CONFIG`.

slothlet takes `Date.now` and the timers when it loads, so a script (or a test runner) that replaces them afterwards does not move an instance. That is deliberate: a principal's `maxAge` is measured on that clock, and a module that replaced `Date.now` must not be able to stretch it. `clock` is how a host that wants to control time, a test above all, hands an instance its own:

- **`now`** is the time in milliseconds. It stamps the principal cache behind `maxAge` (a value older than `maxAge`, or resolved at a time later than `now()` reports, is stale), the ID a `reload()` gives the instance, the ID of a context run, and every time slothlet records: the `timestamp` of lifecycle events and hook failure sources, the `at` of event metadata, the time a rule or an ownership entry was registered.
- **`setTimeout`** and **`clearTimeout`**: when you give `setTimeout`, slothlet's own deferred work (the background step of `backgroundMaterialize` and `tracking.materialization`, and the patch of a stack after an api change) runs through it with a delay of `0` instead of on the host's immediate queue, so a host that fakes timers moves it with its own clock. slothlet never cancels a timer it started, so `clearTimeout` is only kept for the host's use of the instance's clock.

The option is read once, when the instance is created, and kept by the instance alone: it is not part of the config the instance reports (`api.slothlet.diag.inspect().config`), a module's manifest, the options of `api.slothlet.api.add()` and `context` cannot supply or replace it, and it carries across `reload()` and `restart()`. Two instances have two clocks.

A clock whose `now` throws makes the call that read it throw. A `now` that answers something that is not a finite number, or that goes backwards, never keeps a principal alive past its `maxAge`: the value is stale.

```javascript
// Test a principal's maxAge without waiting for it
let time = 1_000;
const api = await slothlet({
	base: "./api",
	permissions: { defaultPolicy: "deny", rules },
	clock: { now: () => time }
});
api.slothlet.permissions.principal.register("roles", { key: (ctx) => ctx.user, resolve, maxAge: 10 });
// ...resolve it, then
time += 11; // the cached value is now stale, with no real wait
```

With a test runner's fake timers, install them before creating the instance and hand it the (now fake) functions:

```javascript
vi.useFakeTimers();
const api = await slothlet({ base: "./api", clock: { now: Date.now, setTimeout, clearTimeout } });
await vi.advanceTimersByTimeAsync(10); // moves the instance's clock and its deferred work
```

Process-wide work that belongs to no instance keeps the functions slothlet loaded with: the TypeScript processor's sweep of old transform folders, frame placement's sampling of the host's scripts, the `@generated` stamp of generated type files, and the cache-busting token of a module import.

---

## TypeScript

### `typescript`

**Type**: `boolean` | `"fast"` | `"strict"` | `object`
**Default**: `false`

Enables TypeScript **module loading** — transpilation of `.ts`/`.mts` files in the API directory. `true` or `"fast"` uses esbuild (no type checking); `"strict"` uses `tsc` (type-checks, and can optionally emit a `.d.ts`). Declaration generation is a sub-feature of strict mode, not what this flag turns on by itself.

```javascript
const api = await slothlet({ dir: "./api", typescript: true }); // fast mode (esbuild)
const api = await slothlet({ dir: "./api", typescript: "strict" }); // strict mode (tsc)
```

See [TYPESCRIPT.md](TYPESCRIPT.md) for the full TypeScript configuration reference, modes, peer dependencies, and generated type file details.

---

## The `api.slothlet.diag.*` Namespace

Available only when `diagnostics: true` is set. Provides runtime introspection for testing and debugging.

```javascript
const api = await slothlet({ dir: "./api", diagnostics: true });
const diag = api.slothlet.diag;
```

### `diag.describe([showAll])`

List top-level API keys, or dump the full API structure.

```javascript
diag.describe(); // Returns array of top-level key names
diag.describe(true); // Returns full shallow copy of API object
```

### `diag.reference`

The `reference` object passed at initialization, or `null`.

```javascript
console.log(diag.reference); // { db, config } or null
```

### `diag.context`

The `context` object passed at initialization.

```javascript
console.log(diag.context); // { db, logger } or {}
```

### `diag.inspect()`

Returns internal instance state from `getDiagnostics()` - config snapshot, handler state, and materialization stats.

```javascript
const state = diag.inspect();
```

### `diag.owner.get(apiPath)`

Returns the ownership set for the given API path - the set of `moduleID` strings that currently own that path.

```javascript
const owners = diag.owner.get("math.add");
// Set { "base_abc123" }
```

Returns `null` if the path is not tracked.

### `diag.caches.get()`

Returns cache diagnostics summarizing all active API caches.

```javascript
const info = diag.caches.get();
// {
//   totalCaches: 2,
//   caches: [
//     { moduleID: "base_abc", endpoint: ".", pathCount: 45, ... },
//     { moduleID: "plugins_xyz", endpoint: "plugins", pathCount: 12, ... }
//   ]
// }
```

### `diag.caches.getAllModuleIDs()`

Returns the array of all `moduleID` strings currently in cache.

```javascript
const ids = diag.caches.getAllModuleIDs(); // ["base_abc", "plugins_xyz"]
```

### `diag.caches.has(moduleID)`

Returns `true` if a cache exists for the given `moduleID`.

```javascript
diag.caches.has("base_abc"); // true
```

### `diag.hook.compilePattern(pattern)` _(hooks enabled only)_

Expands a glob pattern string into a `RegExp`. Only available when `hook` is also enabled.

```javascript
const re = diag.hook.compilePattern("math.*");
```

### `diag.SlothletWarning`

Direct reference to the `SlothletWarning` class. Used in tests to capture and assert on warnings.

```javascript
// In tests
diag.SlothletWarning.clearCaptured();
// ... trigger code that may emit warnings ...
const warnings = diag.SlothletWarning.captured;
expect(warnings).toHaveLength(1);
```

---

## Bug-Fix Suppression (`suppressFixes`)

**Type**: `string[]`  
**Default**: `[]`

An escape hatch for consumers who temporarily need to opt out of a specific bug-fix behavior while they update their API directory structure. Each entry is a rule ID in the format `<rule>_<PR>` (e.g. `"C03_116"`).

When a fix is suppressed:

- Slothlet emits a `SlothletWarning` identifying the suppressed rule and linking to the GitHub PR for context.
- The corrected behavior is skipped; the pre-fix (broken) behavior is restored for that rule only.
- **This option will be removed in v4.** The corrected behavior becomes permanent.

> **This is not a v2 compatibility option.** Use `suppressFixes` only if the corrected behavior is a breaking change for your current codebase and you need time to migrate.

### Available Fix IDs

| ID        | Rule         | Description                                                                                                                                                                                                                                                                                                                          | PR                                                 |
| --------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `C03_116` | Rule 5 / C03 | Named-only files in a multi-default folder are hoisted into the parent namespace instead of being nested under the filename sub-namespace. Pre-fix: they fell through to standard namespace wrapping and appeared as `api.folder.filename.exportName`. Correct behavior: `api.folder.exportName` (intermediate namespace dissolved). | [#116](https://github.com/CLDMV/slothlet/pull/116) |

### Example

```javascript
// Suppress the C03 fix and restore pre-fix nesting
const api = await slothlet({
	dir: "./api",
	suppressFixes: ["C03_116"]
});
// api.notifications.helpers.formatPhone(...) — pre-fix (nested, broken)
// api.notifications.formatPhone(...)          — post-fix (hoisted, correct)
```

---

## Deprecated Options

These options are still accepted but emit deprecation warnings. Migrate to their v3 replacements.

| Deprecated                        | Replacement                                                        | Notes                          |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| `allowMutation: false`            | `api: { mutations: { add: false, remove: false, reload: false } }` | v2 mutation lock               |
| `collision: "..."` _(root-level)_ | `api: { collision: "..." }`                                        | v2 root-level collision config |
