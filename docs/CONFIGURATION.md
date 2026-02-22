# Configuration Reference

Complete reference for all slothlet configuration options. Pass these as properties of the options object to `slothlet({ ... })`.

---

## Quick Reference

```javascript
const api = await slothlet({
	// Required
	dir: "./api",

	// API build
	mode: "eager",         // "eager" | "lazy"
	runtime: "async",      // "async" | "live"
	apiDepth: Infinity,    // number | Infinity

	// Collision control
	api: {
		collision: "merge",  // string or { initial, api }
		mutations: {
			add: true,
			remove: true,
			reload: true
		}
	},

	// Context
	context: null,
	reference: null,
	scope: { merge: "shallow" },  // "shallow" | "deep"

	// Hooks
	hook: false,           // boolean | string | object

	// Debug / diagnostics
	debug: false,
	silent: false,
	diagnostics: false,
	tracking: false,
	backgroundMaterialize: false,

	// i18n (dev-facing; process-global)
	i18n: { language: "en-us" },

	// TypeScript
	typescript: false      // see MODULE-STRUCTURE.md
});
```

---

## Required Options

### `dir`

**Type**: `string` (path)  
**Required**: Yes

Directory to scan for API modules. Relative paths are resolved from the calling file.

```javascript
const api = await slothlet({ dir: "./api" });
const api = await slothlet({ dir: "/absolute/path/to/api" });
```

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

## Collision Options

### `api.collision`

**Type**: `string` | `{ initial: string, api: string }`  
**Default**: `"merge"`

Controls behavior when two modules export a property at the same API path.

| Mode | Behavior |
|---|---|
| `"merge"` | Merge properties - preserve originals and add new ones *(default)* |
| `"merge-replace"` | Merge properties - add new ones and overwrite overlapping values |
| `"replace"` | Replace existing value completely |
| `"skip"` | Silently ignore the collision, keep the existing value |
| `"warn"` | Warn about the collision, keep the existing value |
| `"error"` | Throw an error on collision |

Use the object form to specify different strategies for the initial API build vs. runtime `api.slothlet.api.add()` operations:

```javascript
const api = await slothlet({
	dir: "./api",
	api: {
		collision: {
			initial: "merge",  // During initial build
			api: "replace"     // During api.slothlet.api.add()
		}
	}
});
```

String shorthand applies to both contexts:

```javascript
api: { collision: "warn" }
```

See [METADATA.md](METADATA.md) for per-module collision mode overrides via metadata.

---

## Mutation Options

### `api.mutations`

**Type**: `{ add?: boolean, remove?: boolean, reload?: boolean }`  
**Default**: `{ add: true, remove: true, reload: true }`

Controls which runtime API mutation methods are available on `api.slothlet.api`.

| Property | Default | Controls |
|---|---|---|
| `add` | `true` | `api.slothlet.api.add()` - mount new API modules at runtime |
| `remove` | `true` | `api.slothlet.api.remove()` - unmount API modules at runtime |
| `reload` | `true` | `api.slothlet.api.reload()` - hot-reload a module or directory |

Disable all mutations to create a locked, immutable API:

```javascript
const api = await slothlet({
	dir: "./api",
	api: {
		mutations: { add: false, remove: false, reload: false }
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

api.db        // ✅ db is directly on the API
api.config    // ✅
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

## Hook Configuration

### `hook`

**Type**: `boolean` | `string` | `{ enabled, pattern, suppressErrors }`  
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
		pattern: "**",          // Default glob filter for hooks
		suppressErrors: false   // true: don't re-throw after error hooks run
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
		builder:   false,   // API tree construction
		api:       false,   // api.slothlet.api.* operations
		index:     false,   // File indexing and scanning
		modes:     false,   // Flattening mode decisions
		wrapper:   false,   // Proxy/wrapper construction
		ownership: false,   // Module ownership tracking
		context:   false    // Context propagation
	}
});
```

---

### `silent`

**Type**: `boolean`  
**Default**: `false`

Suppresses all console output from slothlet, including warnings and deprecation notices. Does not affect `debug` logging.

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

### `tracking`

**Type**: `boolean` | `{ materialization: boolean }`  
**Default**: `false`

Enables internal tracking features.

| Property | Default | Effect |
|---|---|---|
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

## TypeScript

### `typescript`

**Type**: `boolean` | `"fast"` | `"strict"` | `object`  
**Default**: `false`

Enables TypeScript declaration generation for the built API surface.

```javascript
const api = await slothlet({ dir: "./api", typescript: true });       // fast mode
const api = await slothlet({ dir: "./api", typescript: "strict" });   // strict mode
```

See [MODULE-STRUCTURE.md](MODULE-STRUCTURE.md) for the full TypeScript configuration reference and generated type file details.

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
diag.describe();         // Returns array of top-level key names
diag.describe(true);     // Returns full shallow copy of API object
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

Returns the ownership set for the given API path - the set of `moduleId` strings that currently own that path.

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

Returns the array of all `moduleId` strings currently in cache.

```javascript
const ids = diag.caches.getAllModuleIDs(); // ["base_abc", "plugins_xyz"]
```

### `diag.caches.has(moduleID)`

Returns `true` if a cache exists for the given `moduleId`.

```javascript
diag.caches.has("base_abc"); // true
```

### `diag.hook.compilePattern(pattern)` *(hooks enabled only)*

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

## Deprecated Options

These options are still accepted but emit deprecation warnings. Migrate to their v3 replacements.

| Deprecated | Replacement | Notes |
|---|---|---|
| `allowMutation: false` | `api: { mutations: { add: false, remove: false, reload: false } }` | v2 mutation lock |
| `collision: "..."` *(root-level)* | `api: { collision: "..." }` | v2 root-level collision config |
