````markdown
# Metadata Path API & Reload-with-Metadata Option

**Date**: February 18, 2026  
**Version**: v3.x (development)  
**Status**: ✅ Complete  
**Commits**: `e5e547c`, `83b924e`

---

## Overview

Two related enhancements to the metadata and hot-reload systems:

1. **`metadata.setFor()` / `metadata.removeFor()`** — set or remove user metadata
   by API path string rather than by function reference. All functions whose
   `apiPath` starts with (or equals) the given path inherit the values automatically.
2. **`api.slothlet.api.reload(path, { metadata })` option** — pass updated metadata
   directly to a partial reload call, atomically updating path metadata during
   the cache-rebuild step.
3. **Metadata now survives full `api.slothlet.reload()`** — `set()` and `setGlobal()`
   values are preserved across a complete instance hot-reload.

---

## New API Surface

### `api.slothlet.metadata.setFor(pathOrModuleId, keyOrObj, value?)`

Sets metadata for **all functions** reachable under the given dot-notation path or moduleID.

```javascript
// Single key/value
api.slothlet.metadata.setFor("math", "category", "math");

// Object merge (multiple keys at once)
api.slothlet.metadata.setFor("math", { category: "math", version: "2.0.0" });

// Targets a specific function path
api.slothlet.metadata.setFor("math.add", "description", "Adds two numbers");
```

**How it works**: stores metadata in `#userMetadataStore` keyed by `apiPath`.
`getMetadata()` calls `collectMetadataFromParents()` which traverses the path
hierarchy (e.g. `"math.add"` → checks `"math"` then `"math.add"`), so every
function under `"math"` inherits the values without needing a function reference.

**Priority** (lowest → highest):

| Layer | Source |
|-------|--------|
| Global | `setGlobal()` |
| Path | `setFor()` / `api.add({ metadata })` |
| Function | `set(fn, key, val)` |
| System | `moduleID`, `filePath`, `apiPath` (always wins) |

**Multiple calls accumulate; later calls override earlier ones for conflicting keys.**

---

### `api.slothlet.metadata.removeFor(pathOrModuleId, key?)`

Removes one key, multiple keys, or ALL path-level metadata for a path or moduleID.

```javascript
// Remove a single key
api.slothlet.metadata.removeFor("math", "category");

// Remove multiple keys
api.slothlet.metadata.removeFor("math", ["category", "version"]);

// Remove ALL path-level metadata for "math"
api.slothlet.metadata.removeFor("math");
```

Only affects metadata stored under that exact path segment. Does **not** walk
descendant paths or affect function-level (`set()`) metadata for the same key.

---

### `api.slothlet.api.reload(path, options)`

The partial reload function now accepts a second `options` argument:

```javascript
// Reload "plugins" and simultaneously update its metadata
await api.slothlet.api.reload("plugins", {
  metadata: {
    version: "2.0.0",
    updated: true
  }
});
```

The metadata is merged into the path store **after** the cache rebuild completes,
so all freshly-tagged wrappers will return the new values on their next
`__metadata` access.

This is the canonical way to change path-registered metadata at runtime — you
get the fresh module implementations AND the updated metadata in one atomic step.

**Without reload** (just updating metadata in place):
```javascript
// Use setFor — no reload needed, takes effect immediately
api.slothlet.metadata.setFor("plugins", "version", "2.0.0");
```

---

### Metadata Preserved Across `api.slothlet.reload()`

Previously, calling `api.slothlet.reload()` (full instance reload) destroyed any
metadata set via `set()` or `setGlobal()` because it created a brand-new `Metadata`
instance. This is now fixed.

```javascript
// Set metadata before reload
api.slothlet.metadata.set(api.math.add, "category", "math");
api.slothlet.metadata.setGlobal("appVersion", "3.0.0");

// Full reload
await api.slothlet.reload();

// Both values persist
await materialize(api, "math.add");
console.log(api.math.add.__metadata.category);    // "math"
console.log(api.math.add.__metadata.appVersion);  // "3.0.0"
```

**How it works**: `reload()` calls `metadata.exportUserState()` before `load()`
destroys the handler, then calls `metadata.importUserState(saved)` on the new
instance before operation-history replay. The merge strategy is:

- Values from the fresh `load()` win over saved values (for the same key).
- Operation-history replay (`registerUserMetadata` from `api.add`) is applied
  after the restore, so `api.add`-registered metadata also takes priority over
  previously-saved state.

---

## Implementation Details

### Files Changed

| File | Change |
|------|--------|
| `src/lib/handlers/metadata.mjs` | `setPathMetadata()`, `removePathMetadata()`, `exportUserState()`, `importUserState()` added. `setUserMetadata()` now also stores by `apiPath` key (dual storage). `removeUserMetadata()` cleans both the moduleID and apiPath entries. |
| `src/lib/builders/api_builder.mjs` | `setFor` / `removeFor` wired into `api.slothlet.metadata` namespace. `api.slothlet.api.reload` accepts `options` second arg and passes it through. |
| `src/lib/handlers/api-manager.mjs` | `reloadApiComponent` + `_reloadByApiPath` accept `options`. `options.metadata` applied via `registerUserMetadata()` after all caches rebuild. |
| `src/slothlet.mjs` | `reload()` saves metadata state via `exportUserState()` before `load()`, restores via `importUserState()` after. |

### Dual Storage in `setUserMetadata()`

`set(fn, key, val)` now stores under **both** the `moduleID` key (for immediate
lookup) and the `apiPath` key (e.g. `"rootMath.add"`). This means:

- Immediate `__metadata` reads still hit the moduleID-keyed entry (fast path).
- After a `reload()`, the moduleID changes, but `collectMetadataFromParents()`
  finds the apiPath-keyed entry — so `set()` metadata also survives reload.

### `exportUserState()` / `importUserState()`

```javascript
// Before load():
const saved = this.handlers.metadata.exportUserState();
// → { globalMetadata: {...}, userMetadataStore: Map<key, entry> }

// After load() (fresh Metadata instance), before replay:
this.handlers.metadata.importUserState(saved);
// → merges saved entries; existing keys (from load) win
```

---

## Test Coverage

| Test File | Tests | Notes |
|-----------|-------|-------|
| `metadata-reload.test.vitest.mjs` | 168/168 | "Reload with Metadata Updates" now passes `{ metadata }` to `reload()` and asserts `version: "2.0.0"` and `updated: true` appear post-reload |
| `metadata-external-api.test.vitest.mjs` | 248/248 | +96 new tests: `setFor()` describe (single key, object merge, subpath targeting, priority vs `set()`, system metadata immunity, accumulation) and `removeFor()` describe (single key, all keys, isolation from `set()`) |

---

## Related Documentation

- [metadata-system.md](./metadata-system.md) — full metadata system reference
- [hot-reload-complete.md](./hot-reload-complete.md) — full and partial reload implementation
- `src/lib/handlers/metadata.mjs` — implementation
- `src/slothlet.mjs` — `reload()` method
````
