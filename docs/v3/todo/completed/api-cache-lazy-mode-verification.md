# API Cache System & Lazy Mode Verification

**Status**: Todo - needs test  
**Priority**: Medium  
**Date Created**: 2026-02-20

---

## Overview: The API Cache System

`ApiCacheManager` (→ `src/lib/handlers/api-cache-manager.mjs`) is the single source of truth for all
built API trees. It stores one **cache entry per `moduleID`** - one entry for the base module
(created during `slothlet()` initialization), and one entry for every subsequent
`api.slothlet.api.add()` call.

### Cache Entry Structure

```js
{
  endpoint:       string,  // API path endpoint ("." for base, "plugins" for add)
  moduleID:       string,  // Unique identifier, e.g. "base_abc12345"
  api:            Object,  // Complete buildAPI result tree (PRIMARY STORAGE - live refs point here)
  folderPath:     string,  // Source folder on disk
  mode:           string,  // "lazy" | "eager"
  sanitizeOptions: Object, // Sanitization config snapshot
  collisionMode:  string,  // Collision handling mode  
  config:         Object,  // Config snapshot at creation time
  timestamp:      number   // Cache creation time (ms since epoch)
}
```

### When Cache Entries Are Created

| Operation | Where | Timing |
|---|---|---|
| `slothlet()` initialization | `src/slothlet.mjs` (after `buildFinalAPI`) | Immediately on startup |
| `api.slothlet.api.add(path, dir)` | `src/lib/handlers/api-manager.mjs` (`addApiComponent`) | On each `add()` call |

Both operations call `buildAPI()` first, then store the result tree (including any builtins for
the base module) into `apiCacheManager.set(moduleID, entry)`.

### Diagnostics

Cache state is available at runtime via:

```js
api.slothlet.diag.caches.get();
// { totalCaches: 1, caches: [{ moduleID, endpoint, pathCount, timestamp, ... }] }

api.slothlet.diag.caches.ids();
// ["base_abc12345"]

api.slothlet.diag.caches.has("base_abc12345"); // true
```

---

## How Lazy Mode Interacts With the Cache

In **eager mode**, `buildAPI()` loads and materializes all module files before returning.
The API tree stored in the cache contains fully resolved function/object values.

In **lazy mode**, `buildAPI()` creates `UnifiedWrapper` proxy shells for each
subdirectory without loading the actual module files. Only root-level files (e.g.
`math.mjs` directly in the root folder) are loaded eagerly in both modes.
Subdirectory entries (e.g. `api/math/`) become unmaterialized wrapper proxies:

```
api.math           → UnifiedWrapper { __materialized: false, __inFlight: false }
api.math.add       → (triggers materialization on first access)
```

The cache entry is **always created at startup** - regardless of mode. However,
the `api` tree stored inside it contains **lazy (unmaterialized) wrappers** in lazy
mode. The underlying module files on disk are NOT read until a wrapper is first
accessed.

---

## The Open Question / Concern

> **In lazy mode, is the API cache actually being created lazily (only when modules are
> accessed), or is it created eagerly (immediately at startup)?**

### Current Behavior (Observed)

The cache entry **is created eagerly** in both modes - immediately after `buildFinalAPI()`
(or `addApiComponent()`) returns. The difference is what is stored inside the `api` property:

- **Eager mode**: `api` tree contains fully loaded module implementations.
- **Lazy mode**: `api` tree contains `UnifiedWrapper` proxy shells - module files are NOT
  loaded from disk until first property access.

So the cache record itself is always eager, but the *content* of the wrappers within it is lazy.

### Why This Matters

If lazy mode inadvertently caused module files to be loaded during cache setup (e.g., by
iterating over `entry.api` during `set()` or `_countPaths()`), that would break the lazy
contract and degrade startup performance. A regression here could silently make lazy mode
behave identically to eager mode at startup.

### What Needs to Be Confirmed With a Test

1. After `slothlet({ mode: "lazy" })` resolves, the cache has exactly one entry.
2. Subdirectory wrappers inside `cache.entry.api` are **not materialized**
   (`__materialized === false`) immediately after startup.
3. Accessing a lazy wrapper path triggers materialization (modifies the wrapper to
   `__materialized === true`).
4. `_countPaths()` (used by `getCacheDiagnostics()`) does **not** trigger materialization -
   it iterates over the wrapper object's own enumerable keys without invoking proxy get traps in
   a way that forces a load.

---

## Test to Write

**File**: `tests/vitests/suites/api-manager/api-cache-lazy-mode.test.vitest.mjs`  
**Suite**: `API Cache - Lazy Mode`

### Test Cases

#### 1. Cache exists immediately after startup

```js
it("should have exactly one cache entry after startup (lazy mode)", async () => {
  // api.slothlet.diag.caches.get().totalCaches === 1
  // entry.mode === "lazy"
});
```

#### 2. Subdirectory wrappers in cache are unmaterialized on startup

```js
it("should store unmaterialized wrappers in cache for subdirectories (lazy mode)", async () => {
  // Access a known subdirectory wrapper from cache entry:
  //   const entry = ... get raw cache entry via internal access ...
  //   const mathWrapper = entry.api.math  (or equivalent)
  //   expect(mathWrapper.__materialized).toBe(false)
  // This confirms module files were NOT loaded when cache was created.
});
```

#### 3. Accessing the live API proxy triggers materialization (lazy-mode contract)

```js
it("should materialize a lazy wrapper only on first access through live api", async () => {
  // Before access:
  //   api.math.__materialized === false
  // Trigger access:
  //   await api.math.add(1, 2)
  // After access:
  //   api.math.__materialized === true
});
```

#### 4. Cache diagnostics do not trigger materialization

```js
it("getCacheDiagnostics() should not cause lazy wrappers to materialize", async () => {
  // Call api.slothlet.diag.caches.get()
  // Verify afterwards that api.math.__materialized is still false
});
```

#### 5. After api.add() in lazy mode, the new module's cache entry is also lazy

```js
it("should store unmaterialized wrappers for api.add() modules in lazy mode", async () => {
  // await api.slothlet.api.add("plugins", TEST_DIRS.SOME_DIR)
  // api.slothlet.diag.caches.get().totalCaches === 2
  // api.plugins.__materialized === false (if plugins contains subdirs)
});
```

---

## Implementation Notes

- Use `process.env.SLOTHLET_INTERNAL_TEST_MODE = "true"` to enable internal API access.
- Use `getMatrixConfigs({ mode: "lazy" })` to run only against lazy configs.
- Use `api.__materialized` and `api.__inFlight` (builtins exposed by the wrapper) to check
  materialization state without triggering it.
- The `_countPaths()` method iterates `Object.entries(api)` - verify that accessing
  enumerable keys on a lazy wrapper proxy does NOT fire the materializeFunc.

---

## Related Files

- `src/lib/handlers/api-cache-manager.mjs` - Cache storage and diagnostics
- `src/slothlet.mjs` (line ~394) - Base cache entry creation after `buildFinalAPI`
- `src/lib/handlers/api-manager.mjs` (line ~1165) - Cache entry creation in `addApiComponent`
- `src/lib/handlers/unified-wrapper.mjs` - `UnifiedWrapper` lazy materialization logic
- `tests/vitests/suites/core/core-reload-lazy-mode.test.vitest.mjs` - Existing lazy-mode reload tests
- `docs/v3/todo/future/lazy-mode-performance-optimization.md` - Related perf investigation
