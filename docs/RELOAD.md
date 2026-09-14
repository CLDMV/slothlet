# Runtime API Mutations & Reload

Slothlet supports three runtime mutation operations - `add`, `remove`, and `reload` - that let you evolve the API surface after initialization without destroying existing references. All three share a common proxy-based reference preservation system so callers never need to re-acquire the API object.

---

## Table of Contents

- [Enabling Mutations](#enabling-mutations)
- [api.slothlet.api.add()](#apislothletapiadd)
- [api.slothlet.api.leaves()](#apislothletapileaves)
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
			add: true, // default
			remove: true, // default
			reload: true // default
		}
	}
});
```

Disabling a mutation throws `INVALID_CONFIG_MUTATIONS_DISABLED` when that method is called. Set all three to `false` to create a locked, immutable API after build.

---

## `api.slothlet.api.add()`

Mounts API modules into the live API at runtime — from a directory, a single file, an array of paths, or **in-memory exports** (no filesystem).

```javascript
await api.slothlet.api.add(apiPath, folderPath, options);
```

| Parameter                   | Type                                                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiPath`                   | `string`                                                    | Dot-separated path where modules are mounted (e.g. `"plugins"`, `"plugins.tools"`). Pass `""` or `null` to add directly to root.                                                                                                                                                                                                                                                                                                                                                          |
| `folderPath`                | `string \| string[] \| Function \| Record<string, unknown>` | What to mount: a **directory** to scan, a **single file** (`.mjs`/`.cjs`/`.js`), an **array** of file/folder paths, a bare **function** (mounts as one callable leaf), a **plain object** used directly as the export map (its keys mount as leaves), or the **`{ exports, ...options }`** shorthand (the `exports` value is the export map; sibling keys apply as options). The last two are synthetic / in-memory leaves — no filesystem. Relative paths resolve from the calling file. |
| `options.moduleID`          | `string?`                                                   | Stable identifier for this module. Used for targeted `reload()` and `remove()`. Auto-generated if omitted (including for synthetic leaves).                                                                                                                                                                                                                                                                                                                                               |
| `options.forceOverwrite`    | `boolean?`                                                  | Override collision mode for this call. Use with ownership-aware workflows.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `options.metadata`          | `object?`                                                   | Metadata to apply to loaded API paths after mount.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `options.hidden`            | `string \| string[]?`                                       | Glob(s) hiding files/folders from this mount, matched against each entry's path relative to the **added** folder (files match extension-stripped). Same syntax and semantics as the init-time [`hidden`](./CONFIGURATION.md#hidden) option. Persisted, so `reload()` re-applies it.                                                                                                                                                                                                       |
| `options.scanHiddenFolders` | `boolean?`                                                  | **Deprecated** escape hatch: scan `.`/`__`-prefixed folders for this mount (default `false`; falls back to the instance config; supplying it warns). See [`scanHiddenFolders`](./CONFIGURATION.md#scanhiddenfolders). Removed in v4.                                                                                                                                                                                                                                                      |

**Validation.** A mount `apiPath` may not contain a `__proto__` / `constructor` / `prototype` segment (a prototype-pollution guard) or the reserved internal separator `__slothlet_sep__`; a supplied `moduleID` may not contain the reserved separator either (see [Module Ownership](#module-ownership-moduleid)). Any of these is refused up front with a validation error (`INVALID_CONFIG_API_PATH_INVALID` / `MODULE_ID_RESERVED_SEPARATOR`) rather than mounted.

**Examples:**

```javascript
// Mount a plugins folder at api.plugins
await api.slothlet.api.add("plugins", "./plugins");

// Mount a single file — its exports mount AT the apiPath
await api.slothlet.api.add("plugins.tools", "./tools/string-utils.mjs");

// Mount several paths at once (files and/or folders)
await api.slothlet.api.add("plugins", ["./a.mjs", "./b.mjs", "./extras"]);

// Mount with stable ID for later reload/remove
await api.slothlet.api.add("plugins", "./plugins", { moduleID: "core-plugins" });
await api.slothlet.api.remove("core-plugins"); // remove by ID
await api.slothlet.api.reload("core-plugins"); // reload by ID

// Root-level mount - exports appear directly on api.*
await api.slothlet.api.add("", "./extra-root");
await api.slothlet.api.add(null, "./extra-root");
```

### Synthetic / in-memory leaves (no filesystem)

`add()` also accepts inline content in place of a path — useful in browser mode, tests, or when composing behavior programmatically. The value flows through the same flatten + wrap pipeline a file would, so `self` / `context` / hooks / permissions apply identically, in both eager and lazy mode.

```javascript
// A bare function → one callable leaf at the apiPath
await api.slothlet.api.add("synth.greet", (name) => `Hello, ${name}`);
await api.synth.greet("Nate"); // "Hello, Nate"

// An { exports } object → multiple named leaves under the apiPath
await api.slothlet.api.add("tools", {
	exports: { ping: () => "pong", pong: () => "ping" }
});
await api.tools.ping(); // "pong"

// A plain object (no `exports` key) IS the exports map — its keys mount as leaves, even keys
// that happen to share an option name. The 2nd arg is never scanned for options.
await api.slothlet.api.add("util", { upper: (s) => s.toUpperCase() });
await api.slothlet.api.add("cfg", { moduleID: "x" }); // mounts api.cfg.moduleID = "x" (content, not an option)

// Shorthand: when the inline object carries an `exports` key, its sibling keys ARE options
// (here a custom moduleID), exactly as if passed third. `exports` must be present.
await api.slothlet.api.add("svc", { exports: { ping: () => "pong" }, moduleID: "svc-id" });

// Mount at root ("" or null) — exports land directly on api.*
await api.slothlet.api.add("", { exports: { ping: () => "pong" } }); // api.ping
```

An object's exports flatten exactly as a file's exports would — a lone `default` becomes the leaf, named exports become child leaves, and a `default` plus named exports follows the same flatten rules a file with those exports does. **A plain object is always content:** its own keys mount as leaves (a function value as a callable leaf, a non-function value as a data leaf), so options are never auto-extracted from the 2nd argument — pass them third. As a shorthand, an inline object that includes an **`exports`** key is split: `exports` is the content, and the remaining sibling keys are applied as options (an explicit 3rd-argument option wins on conflict). The original value is stored, so `reload(moduleID)` re-applies it (there is no file to re-read) while preserving the wrapper reference, and `remove(moduleID)` unmounts it. The moduleID is auto-generated just like a file-path add (unless supplied via options or the `{ exports, ... }` shorthand).

**Path deduplication (Rule 13 / F08):** When the scanned directory itself produces a top-level key matching the last segment of `apiPath`, slothlet deduplicates the namespace. For example, `api.add("math", dir_containing_math.mjs)` results in `api.math.*` - not `api.math.math.*`. See [API-RULES/API-FLATTENING.md](API-RULES/API-FLATTENING.md#f08-addapi-path-deduplication-flattening) for details.

**AddApi special file (Rule 11 / F06):** A file named `addapi.mjs` inside the scanned directory always merges its exports directly into the mount namespace, never creating an intermediate `.addapi.` level. See [API-RULES/API-FLATTENING.md](API-RULES/API-FLATTENING.md#f06-addapi-special-file-pattern).

---

## `api.slothlet.api.leaves()`

Enumerates the api paths a module owns — the inverse of the ownership tracking every mount already records. The answer is read from the loader's own records, never by walking the live api object, so it is complete under `mode: "lazy"` (the owned subtree is settled first).

```javascript
const moduleID = await api.slothlet.api.add("modules.acme.shop", "/path/to/extension/api");

await api.slothlet.api.leaves(moduleID);
// ["modules.acme.shop.connect", "modules.acme.shop.search", …]  — flattened, callable paths

await api.slothlet.api.leaves("modules.acme.shop"); // same, keyed by mount endpoint
await api.slothlet.api.leaves("."); // the base load's own leaves
```

| Form           | Example               | Behavior                                                                |
| -------------- | --------------------- | ----------------------------------------------------------------------- |
| moduleID       | `"core-plugins"`      | The paths that mount contributed                                        |
| mount endpoint | `"modules.acme.shop"` | Resolved to the module mounted there                                    |
| any owned path | `"shop.ns"`           | Resolved to the owning module — the enumeration is always module-scoped |
| `"."` / `""`   | `"."`                 | The base load (the injected `slothlet.*` control tree is excluded)      |

The default return is the **callable** leaf paths — one entry per function a caller can invoke, the one-stub-per-callable contract. Pass `{ details: true }` for every owned path tagged with its kind:

```javascript
await api.slothlet.api.leaves("modules.acme.shop", { details: true });
// [
//   { path: "modules.acme.shop",         kind: "namespace" },
//   { path: "modules.acme.shop.connect", kind: "function" },
//   { path: "modules.acme.shop.limit",   kind: "data" }
// ]
```

An unknown key throws `API_LEAVES_UNKNOWN_MODULE`. Module callers pass through the same internal-permission gate as the rest of `slothlet.*` (`slothlet.api.leaves`); the host's bound handle is exempt from that gate, matching the carve-out documented in [PERMISSIONS.md](PERMISSIONS.md).

Enumeration is a disclosure surface, so the answer is scoped to the caller: [module-private members](PERMISSIONS.md#module-private-exports) the caller could not read are omitted, matching the redaction `Object.keys` already performs on the composed surface. A module sees its own module's privates and no other module's, and the host's bound handle is redacted too by default (`permissions.private.host: "deny"`). Pass `{ includePrivate: true }` — host only — for the unredacted list; a module asking for it is refused with `PERMISSION_DENIED` rather than quietly downgraded to the redacted answer. With permissions disabled nothing is private and nothing is filtered.

---

## `api.slothlet.api.remove()`

Removes API modules from the live API by API path, by moduleID, or — with the optional second argument — by **one module scoped to a path**.

```javascript
await api.slothlet.api.remove(pathOrModuleID);
await api.slothlet.api.remove(moduleID, apiPath); // scoped: only this module's nodes under apiPath
```

| Form               | Example                     | Behavior                                                                                                                                     |
| ------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| API path           | `"plugins.tools"`           | Deletes the value at that dot-path from the API — the **whole subtree**, regardless of which module owns each node                           |
| moduleID           | `"core-plugins"`            | Removes **all** paths owned by that moduleID (anywhere) and rolls ownership back to the previous owner                                       |
| moduleID + apiPath | `"core-plugins", "plugins"` | **Scoped:** removes only the nodes `moduleID` owns **at or under** `apiPath`, leaving other modules and that module's other mounts untouched |

```javascript
// Remove a namespace by path (whole subtree)
await api.slothlet.api.remove("plugins.tools");

// Remove a module by ID (rolls back ownership for all its registered paths)
await api.slothlet.api.remove("core-plugins");

// Scoped: remove only modA's nodes under "shop" — modB's shop.b and the container survive
await api.slothlet.api.add("shop.a", "./a", { moduleID: "modA" });
await api.slothlet.api.add("shop.b", "./b", { moduleID: "modB" });
await api.slothlet.api.remove("modA", "shop"); // → true; api.shop.a gone, api.shop.b intact
```

The scoped `remove(moduleID, apiPath)` form is a **recursive per-node detach pinned to one module**: it walks every path that module owns at or under `apiPath` and, per node, removes it when the module was the sole owner or reverts it to the previous owner when the node is shared. A node still owned by another module is left in place, and a container is deleted only once nothing remains under it — so it survives while it still holds another module's descendants. It never blanket-deletes the subtree; that is what `remove(apiPath)` (the path as the first argument) is for. It returns `true` when it removed something, `false` when the module doesn't own the requested path (or the moduleID is unknown), and rejects a non-string `apiPath` with `INVALID_ARGUMENT`.

Removing a module emits `impl:removed` lifecycle events for each affected path, triggers metadata cleanup for those paths, and cleans up the wrapper state.

---

## `api.slothlet.api.reload()`

Reloads API modules from disk, busting ESM/CJS caches so updated source files are picked up. Existing wrapper proxy references are preserved - callers holding `api.math.add` continue to work after reload.

```javascript
await api.slothlet.api.reload(pathOrModuleID, options);
```

| Form        | Example                             | Behavior                                                   |
| ----------- | ----------------------------------- | ---------------------------------------------------------- |
| Base module | `null` / `undefined` / `""` / `"."` | Reloads all initially-loaded `dir` modules                 |
| API path    | `"plugins"`                         | Reloads all caches that contribute to or include that path |
| moduleID    | `"core-plugins"`                    | Reloads that single cache entry                            |

**Resolution order for path-based reload:**

1. Exact cache endpoint match
2. Child caches (endpoints under the path)
3. Ownership history (modules that registered the exact path)
4. Parent cache (most specific cache whose scope covers the path)

**Options:**

| Option             | Default     | Description                                                   |
| ------------------ | ----------- | ------------------------------------------------------------- |
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

|                           | Eager Mode                                 | Lazy Mode                                           |
| ------------------------- | ------------------------------------------ | --------------------------------------------------- |
| **Before first access**   | Impl already loaded                        | Proxy shell only (no impl)                          |
| **Reload mechanism**      | `___setImpl(newImpl)` - direct replacement | `___resetLazy(newMaterializeFunc)` - reset to shell |
| **Update visible**        | Immediately after `await reload()`         | On next access to that namespace                    |
| **Memory freed**          | Old impl replaced immediately              | Materialized children freed on reset                |
| **Root-level files**      | Eager path                                 | Eager path (root files always eager)                |
| **Subdirectory wrappers** | Eager path                                 | Lazy reset path                                     |
| **Proxy reference**       | Preserved                                  | Preserved                                           |

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
console.log(api.myProp); // undefined - runtime mutations cleared on reload
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

Replay faithfully reproduces the full runtime state, including operations that are not plain path adds:

- **Scoped removals** (`remove(moduleID, apiPath)`) are recorded with their `moduleID` and replayed as the two-argument form, so a scoped removal stays applied after a reload instead of the module reappearing. A module's id survives a reload — the `add` op records `options.moduleID` and it is reused on re-add — which is what lets the scoped remove resolve the same module on replay.
- **Synthetic / in-memory adds** (an inline function, an export map, or the `{ exports, … }` shorthand) record their original inline value as the replay source, so `reload()` re-runs the identical synthetic add; the mount is not lost on a base reload and stays removable by its `moduleID` afterward.

Targeted reloads (by path or moduleID) rebuild only the affected cache entries and do not replay operation history - they operate on the existing namespace tree in-place.

---

## Module Ownership (moduleID)

Every module mounted via `add()` is tracked by a `moduleID`. If you don't provide one, slothlet generates a stable ID from the apiPath and resolved folder path.

A `moduleID` may contain **any character** — `:`, `/`, `.`, `-`, and so on all round-trip through `add` / `leaves` / `remove` / `reload`, so a namespaced convention like `vine:abc` or `plugin:opensearch:v1` is safe. Internally slothlet joins the id and its apiPath into a composite metadata key using a **reserved multi-character token** (`__slothlet_sep__`), not `:`, and stores the raw base id verbatim — so no ordinary character collides with the delimiter. The one token a `moduleID` (or an `apiPath`) may **not** contain is that reserved separator: `add()` refuses it up front with a named error (`MODULE_ID_RESERVED_SEPARATOR` for a supplied or auto-generated id, `INVALID_CONFIG_API_PATH_INVALID` for an apiPath).

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

| Event                   | Fires when                                                                     |
| ----------------------- | ------------------------------------------------------------------------------ |
| `impl:created`          | A new API path is registered for the first time                                |
| `impl:changed`          | An existing API path's implementation is replaced (reload, add with overwrite) |
| `impl:removed`          | An API path is deleted via `remove()`                                          |
| `materialized:complete` | A lazy-mode namespace finishes materializing after first access                |
| `path:collision`        | Two modules write to the same path                                             |

Each event handler receives an object with:

- `apiPath` - dot-path of the affected API member
- `impl` - the implementation object (new impl for created/changed, old impl for removed)
- `source` - `"initial"`, `"hot-reload"`, `"materialization"`, etc.
- `moduleID` - the module identifier that triggered the event
- `filePath` - source file path (when available)

See [LIFECYCLE.md](LIFECYCLE.md) for the full lifecycle events reference.
