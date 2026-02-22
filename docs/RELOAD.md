# Runtime API Mutations & Reload

Slothlet supports three runtime mutation operations - `add`, `remove`, and `reload` - that let you evolve the API surface after initialization without destroying existing references. All three share a common proxy-based reference preservation system so callers never need to re-acquire the API object.

---

## Table of Contents

- [Enabling Mutations](#enabling-mutations)
- [api.slothlet.api.add()](#apislothletapiadd)
- [api.slothlet.api.remove()](#apislothletapiremove)
- [api.slothlet.api.reload()](#apislothletapireload)
- [Eager vs Lazy Reload Behavior](#eager-vs-lazy-reload-behavior)
- [Reference Preservation](#reference-preservation)
- [ESM / CJS Cache Busting](#esm--cjs-cache-busting)
- [Operation History and Replay](#operation-history-and-replay)
- [Module Ownership (moduleID)](#module-ownership-moduleid)
- [Lifecycle Events](#lifecycle-events)

---

## Enabling Mutations

All three operations are enabled by default and individually gated by the `api.mutations` config:

```javascript
const api = await slothlet({
    dir: "./api",
    api: {
        mutations: {
            add:    true,  // default
            remove: true,  // default
            reload: true   // default
        }
    }
});
```

Disabling a mutation throws `INVALID_CONFIG_MUTATIONS_DISABLED` when that method is called. Set all three to `false` to create a locked, immutable API after build.

---

## `api.slothlet.api.add()`

Mounts API modules from a directory into the live API at runtime.

```javascript
await api.slothlet.api.add(apiPath, folderPath, options);
```

| Parameter | Type | Description |
|---|---|---|
| `apiPath` | `string` | Dot-separated path where modules are mounted (e.g. `"plugins"`, `"plugins.tools"`). Pass `""` or `null` to add directly to root. |
| `folderPath` | `string` | Directory to scan. Relative paths resolved from the calling file. |
| `options.moduleID` | `string?` | Stable identifier for this module. Used for targeted `reload()` and `remove()`. Auto-generated if omitted. |
| `options.forceOverwrite` | `boolean?` | Override collision mode for this call. Use with ownership-aware workflows. |
| `options.metadata` | `object?` | Metadata to apply to loaded API paths after mount. |

**Examples:**

```javascript
// Mount plugins folder at api.plugins
await api.slothlet.api.add("plugins", "./plugins");

// Mount with stable ID for later reload/remove
await api.slothlet.api.add("plugins", "./plugins", { moduleID: "core-plugins" });
await api.slothlet.api.remove("core-plugins");     // remove by ID
await api.slothlet.api.reload("core-plugins");     // reload by ID

// Root-level mount - exports appear directly on api.*
await api.slothlet.api.add("", "./extra-root");
await api.slothlet.api.add(null, "./extra-root");
```

**Path deduplication (Rule 13 / F08):** When the scanned directory itself produces a top-level key matching the last segment of `apiPath`, slothlet deduplicates the namespace. For example, `api.add("math", dir_containing_math.mjs)` results in `api.math.*` - not `api.math.math.*`. See [API-RULES/API-FLATTENING.md](API-RULES/API-FLATTENING.md#f08-addapi-path-deduplication-flattening) for details.

**AddApi special file (Rule 11 / F06):** A file named `addapi.mjs` inside the scanned directory always merges its exports directly into the mount namespace, never creating an intermediate `.addapi.` level. See [API-RULES/API-FLATTENING.md](API-RULES/API-FLATTENING.md#f06-addapi-special-file-pattern).

---

## `api.slothlet.api.remove()`

Removes API modules from the live API by API path or moduleID.

```javascript
await api.slothlet.api.remove(pathOrModuleId);
```

| Form | Example | Behavior |
|---|---|---|
| API path | `"plugins.tools"` | Deletes the value at that dot-path from the API |
| moduleID | `"core-plugins"` | Removes all paths owned by that moduleID and rolls ownership back to the previous owner |

```javascript
// Remove a namespace by path
await api.slothlet.api.remove("plugins.tools");

// Remove a module by ID (rolls back ownership for all its registered paths)
await api.slothlet.api.remove("core-plugins");
```

Removing a module emits `impl:removed` lifecycle events for each affected path, triggers metadata cleanup for those paths, and cleans up the wrapper state.

---

## `api.slothlet.api.reload()`

Reloads API modules from disk, busting ESM/CJS caches so updated source files are picked up. Existing wrapper proxy references are preserved - callers holding `api.math.add` continue to work after reload.

```javascript
await api.slothlet.api.reload(pathOrModuleId, options);
```

| Form | Example | Behavior |
|---|---|---|
| Base module | `null` / `undefined` / `""` / `"."` | Reloads all initially-loaded `dir` modules |
| API path | `"plugins"` | Reloads all caches that contribute to or include that path |
| moduleID | `"core-plugins"` | Reloads that single cache entry |

**Resolution order for path-based reload:**

1. Exact cache endpoint match
2. Child caches (endpoints under the path)
3. Ownership history (modules that registered the exact path)
4. Parent cache (most specific cache whose scope covers the path)

**Options:**

| Option | Default | Description |
|---|---|---|
| `options.metadata` | `undefined` | Metadata to merge/update for the reloaded paths after rebuild |

**Examples:**

```javascript
// Reload base module (all initially-loaded dir modules)
await api.slothlet.api.reload();
await api.slothlet.api.reload(".");

// Reload a specific API path (finds contributing caches automatically)
await api.slothlet.api.reload("plugins");

// Reload by module ID (precise, single-cache rebuild)
await api.slothlet.api.reload("core-plugins");

// Reload and update metadata at the same time
await api.slothlet.api.reload("plugins", {
    metadata: { version: "2.0.0", reloadedAt: Date.now() }
});
```

---

## Eager vs Lazy Reload Behavior

This is the primary point where slothlet's behavior diverges between `mode: "eager"` and `mode: "lazy"`. The external API for reload is identical in both modes - the divergence is entirely internal, in how fresh module content is applied to existing wrapper proxies.

### Eager Mode - Direct Impl Replacement

In eager mode, every API namespace is a fully-materialized `UnifiedWrapper` whose implementation is already in memory. When reload runs:

1. The cache is rebuilt from disk (fresh import of all files)
2. `___setImpl(newImpl, moduleID)` is called on each existing wrapper
3. The new implementation object **replaces** the old one inside the wrapper
4. The wrapper proxy reference is unchanged - existing code keeps working

```text
Before reload:      api.math        ← wrapper proxy (unchanged ref)
                        └── _impl = { add: fn_v1, subtract: fn_v1 }

After reload:       api.math        ← same proxy ref
                        └── _impl = { add: fn_v2, subtract: fn_v2 }
```

The transition is synchronous and immediate. Any call to `api.math.add` after `await reload()` returns will invoke the new implementation.

### Lazy Mode - Wrapper Reset to Un-Materialized State

In lazy mode, API namespaces are proxy shells backed by a `materializeFunc` that loads modules on first access. When reload runs on a lazy wrapper that has **not yet been accessed** (or has been accessed and needs to be reset):

1. The cache is rebuilt from disk to obtain a fresh lazy wrapper shell
2. `___resetLazy(freshMaterializeFunc)` is called on the existing wrapper
3. The wrapper is returned to an **un-materialized state** with the new `materializeFunc`
4. All previously-materialized children are released from memory
5. The next access triggers fresh materialization from the updated source

```text
Before reload:      api.math        ← lazy proxy (unchanged ref)
                        materializeFunc → loads math_v1.mjs

After reload:       api.math        ← same proxy ref
                        materializeFunc → loads math_v2.mjs (fresh)
                        state: not materialized

On next access:     api.math.add    ← materializes fresh, returns fn_v2
```

**Key implication for lazy mode:** In eager mode, the reload result is immediately visible to all code paths. In lazy mode, the update is visible only **after the next access** to that namespace. Code that has already read `api.math.add` into a local variable holds the old function until the wrapper re-materializes.

If a lazy namespace **has already been materialized** when reload runs, the `___resetLazy` path still applies - the wrapper is reset, children are cleared, and the next access loads fresh content. The previously-materialized function objects are eligible for garbage collection once no other references hold them.

**Root-level files are always eager even in lazy mode.** A `math.mjs` in the root `dir` (not inside a subdirectory) is loaded eagerly and follows the eager reload path (`___setImpl`) even when `mode: "lazy"` is configured. Only subdirectory wrappers use the lazy reset path.

### Summary Table

| | Eager Mode | Lazy Mode |
|---|---|---|
| **Before first access** | Impl already loaded | Proxy shell only (no impl) |
| **Reload mechanism** | `___setImpl(newImpl)` - direct replacement | `___resetLazy(newMaterializeFunc)` - reset to shell |
| **Update visible** | Immediately after `await reload()` | On next access to that namespace |
| **Memory freed** | Old impl replaced immediately | Materialized children freed on reset |
| **Root-level files** | Eager path | Eager path (root files always eager) |
| **Subdirectory wrappers** | Eager path | Lazy reset path |
| **Proxy reference** | Preserved | Preserved |

---

## Reference Preservation

The API object returned by `slothlet()` is a **stable proxy** that forwards property access to an internal `_currentApi` object. This means the same variable remains valid across reloads, `add()` calls, and `remove()` operations:

```javascript
const api = await slothlet({ dir: "./api" });

// Add something at runtime
api.myProp = "custom";

// Reload from disk
await api.slothlet.api.reload();

// api is still valid - the same reference
console.log(typeof api.math.add); // "function" (fresh from disk)
console.log(api.myProp);          // undefined - runtime mutations cleared on reload
```

Runtime mutations (`api.myProp = ...`) are intentionally cleared on full reload because the wrapper tree is rebuilt. Mutations to properties that belong to loaded modules (e.g. `api.math.add = customFn`) are also cleared - the reload replaces the impl inside those wrappers.

---

## ESM / CJS Cache Busting

Slothlet forces fresh module loading on every rebuild rather than serving cached imports:

**CommonJS**: `require.cache` entries for the target directory are deleted before re-importing.

**ESM**: A temporary instance ID suffix is appended to the cache-busted import path, causing Node's ESM loader to treat it as a new module specifier and re-execute the file.

This means `reload()` is suitable as a real hot-reload trigger in development workflows - simply editing a source file and calling `reload()` is sufficient.

---

## Operation History and Replay

Every `api.slothlet.api.add()` and `api.slothlet.api.remove()` call is recorded in the instance's operation history in chronological order. A full base module reload (`reload()` / `reload(".")`) rebuilds the core API from disk and then **replays the operation history** in order, restoring all runtime additions:

```javascript
const api = await slothlet({ dir: "./api" });

await api.slothlet.api.add("plugins", "./plugins", { moduleID: "core-plugins" });
await api.slothlet.api.add("tools", "./tools");

// Reload base module - replays both add() calls automatically
await api.slothlet.api.reload();

// api.plugins and api.tools are still present after reload
```

Targeted reloads (by path or moduleID) rebuild only the affected cache entries and do not replay operation history - they operate on the existing namespace tree in-place.

---

## Module Ownership (moduleID)

Every module mounted via `add()` is tracked by a `moduleID`. If you don't provide one, slothlet generates a stable ID from the apiPath and resolved folder path.

Ownership is **stack-based**: each API path maintains a history of which modules have written to it. Removing a module automatically rolls back to the previous owner for all paths it touched.

```javascript
// Two modules coexist at peer namespaces
await api.slothlet.api.add("plugins.auth", "./auth", { moduleID: "auth-module" });
await api.slothlet.api.add("plugins.billing", "./billing", { moduleID: "billing-module" });

// Reload only authentication
await api.slothlet.api.reload("auth-module");
// api.plugins.billing is unaffected

// Remove billing - rolls back to previous owner of plugins.billing paths
await api.slothlet.api.remove("billing-module");
```

You can inspect ownership at runtime when `diagnostics: true`:

```javascript
const api = await slothlet({ dir: "./api", diagnostics: true });
api.slothlet.diag.owner.get("plugins.auth");
// Set { "auth-module" }
```

See [CONFIGURATION.md](CONFIGURATION.md#the-apislothletdiag-namespace) for the full `diag.owner` API.

---

## Lifecycle Events

The lifecycle system emits events for each wrapper impl change during mutations. Subscribe via `api.slothlet.lifecycle`:

```javascript
// Subscribe from the internal system - access via diagnostics or direct handler
const unsubscribe = api.slothlet.lifecycle.on("impl:changed", (data) => {
    console.log(`${data.apiPath} updated`, data.source, data.moduleID);
});

await api.slothlet.api.reload("plugins");

unsubscribe(); // clean up
```

| Event | Fires when |
|---|---|
| `impl:created` | A new API path is registered for the first time |
| `impl:changed` | An existing API path's implementation is replaced (reload, add with overwrite) |
| `impl:removed` | An API path is deleted via `remove()` |
| `materialized:complete` | A lazy-mode namespace finishes materializing after first access |
| `path:collision` | Two modules write to the same path |

Each event handler receives an object with:
- `apiPath` - dot-path of the affected API member
- `impl` - the implementation object (new impl for created/changed, old impl for removed)
- `source` - `"initial"`, `"hot-reload"`, `"materialization"`, etc.
- `moduleID` - the module identifier that triggered the event
- `filePath` - source file path (when available)

See [LIFECYCLE.md](LIFECYCLE.md) for the full lifecycle events reference.
