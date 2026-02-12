# Lazy Mode api.remove() Timing Issue

**Status:** ✅ RESOLVED  
**Priority:** HIGH  
**Impact:** Test failures on slower machines (CI/CD reliability)  
**Created:** 2026-02-11  
**Resolved:** 2026-02-11

---

## Problem Summary

Tests fail intermittently on slower machines when using `api.remove()` in LAZY mode. After removal, the `cycled` property persists on the API when it should be `undefined`. This is a **race condition** caused by async lazy materialization re-registering stale ownership entries after a module has been unregistered.

### Failing Tests

**File:** `tests/vitests/suites/metadata/metadata-api-manager.test.vitest.mjs`  
**Total Failures:** 7 (consistent across runs)  
**Configurations Affected:** LAZY, LAZY_HOOKS, LAZY_LIVE, LAZY_LIVE_HOOKS (all lazy modes)  
**Configurations Passing:** EAGER, EAGER_HOOKS, EAGER_LIVE, EAGER_LIVE_HOOKS (all eager modes)

#### Specific Test Failures:

1. **"should handle multiple add/remove/add cycles"** (LAZY_HOOKS, LAZY, LAZY_LIVE_HOOKS, LAZY_LIVE)
   - **Expected:** `api.cycled` is `undefined` after `api.remove("cycled")`
   - **Actual:** Empty `UnifiedWrapper` with `_impl: {}` still exists on cycle 2

2. **"should handle multiple add/remove cycles via internal API"** (LAZY, LAZY_LIVE_HOOKS, LAZY_LIVE)
   - **Expected:** Metadata is `undefined` after `api.remove("cycleInternal")`
   - **Actual:** Metadata from previous cycle still present

### Test Pattern:
```javascript
for (let cycle = 1; cycle <= 3; cycle++) {
    await api.slothlet.api.add("cycled", TEST_DIRS.API_SMART_FLATTEN, { metadata: { cycle } });
    await materialize(api, "cycled.config.settings.getPluginConfig");
    
    // Remove
    await api.slothlet.api.remove("cycled");
    expect(api.cycled).toBeUndefined(); // ❌ FAILS on cycle 2 in LAZY mode
    
    // Re-add for next cycle
}
```

---

## Root Cause

### Stale Ownership Re-Registration from Async Lazy Materialization

The bug is a race condition between lazy wrapper materialization and module ownership cleanup:

1. **Cycle 1 `api.add("cycled")`** — creates lazy wrapper, registers `cycled_hakmbb` in `ownership.moduleToPath`
2. **Cycle 1 `api.remove("cycled")`** — calls `ownership.unregister("cycled_hakmbb")`, deletes the map entry
3. **🐛 Lazy materialization from cycle 1 completes asynchronously** — `lazy.mjs:149` calls `ownership.register()` with the captured `cycled_hakmbb` moduleID from the closure, **re-creating the deleted entry** in `moduleToPath`
4. **Cycle 2 `api.add("cycled")`** — registers a new `cycled_vg7xg1`
5. **Cycle 2 `api.remove("cycled")`** — prefix lookup with `find()` finds `cycled_hakmbb` (stale, first match) instead of `cycled_vg7xg1` (current) → **wrong module gets unregistered** → only 2 paths deleted instead of 28 → `"cycled"` property remains on the API

### Why LAZY Mode Only

In **EAGER** mode, all modules are loaded synchronously during `buildAPI()`. By the time `api.remove()` is called, everything is fully registered and `unregister()` cleans up all paths completely.

In **LAZY** mode, `registerSubtree()` uses `Object.entries()` on lazy proxy wrappers. The `ownKeysTrap` calls `_materialize()` **fire-and-forget** (no `await`). So materialization continues in the background, and when it eventually completes, it calls `ownership.register()` with the old moduleID — after that moduleID was already unregistered.

### Why Timing-Dependent

On **fast machines:** lazy materialization completes quickly, `registerSubtree` captures all paths during the initial registration phase, and `unregister()` cleanly removes everything.

On **slower machines:** materialization is delayed, fewer paths are registered initially, and when the stale materialization completes after `unregister()`, it re-creates the ownership entry.

### Code Path (lazy.mjs:149)

```javascript
// Inside createLazyWrapper() → materializeFunc closure:
const effectiveModuleId = moduleIDOverride || file.moduleID; // captured from add() call
// ...async work loading files...
if (slothlet.handlers.ownership) {
    slothlet.handlers.ownership.register({
        moduleID: effectiveModuleId, // 🐛 stale moduleID from already-removed module
        apiPath: `${apiPath}.${moduleName}`,
        source: "core",
        // ...
    });
}
```

### Debug Evidence

```
[REMOVE-LOOKUP] moduleID=cycled, matchingModules=cycled_hakmbb,cycled_vg7xg1
```
Two moduleIDs match the prefix `cycled_`. `find()` returns the first (stale) instead of the second (current). When the stale module is unregistered, only 2 paths are removed (those from the late async registration) instead of 28.

---

## Solution

### Three-Layer Fix (22 lines added, 1 changed)

#### 1. Primary Fix: `_unregisteredModules` Guard (ownership.mjs)

Added a `_unregisteredModules` Set to `OwnershipManager`. When `unregister()` is called, the moduleID is added to this Set. In `register()`, if the moduleID is in `_unregisteredModules`, the registration is **silently rejected**. This prevents stale lazy materialization from re-creating ownership entries.

```javascript
// ownership.mjs - constructor
this._unregisteredModules = new Set();

// ownership.mjs - register()
if (this._unregisteredModules.has(moduleID)) {
    return null; // Reject stale registrations
}

// ownership.mjs - unregister()
this._unregisteredModules.add(moduleID); // Mark before cleanup

// ownership.mjs - clear()
this._unregisteredModules.clear(); // Clean up on full reset
```

#### 2. Defense-in-Depth: `findLast()` Lookup (api-manager.mjs)

Changed `find()` to `findLast()` in the moduleID prefix lookup in `removeApiComponent()`. This ensures that when multiple moduleIDs match a prefix (due to stale entries), the **most recently registered** one is selected.

```javascript
// Before:
const matchingModule = registeredModules.find((m) => m === moduleID || m.startsWith(`${moduleID}_`));

// After:
const matchingModule = registeredModules.findLast((m) => m === moduleID || m.startsWith(`${moduleID}_`));
```

#### 3. Early Termination: `__invalid` Check (unified-wrapper.mjs)

Added `__invalid` check at the start of `___materialize()` to skip materialization entirely for wrappers whose parent module has been removed. Prevents unnecessary async work and registration attempts.

```javascript
// unified-wrapper.mjs - ___materialize()
if (this.__invalid) {
    return; // Don't materialize removed wrappers
}
```

---

## Changes Made

### Files Modified

| File | Change | Lines |
|------|--------|-------|
| `src/lib/handlers/ownership.mjs` | Added `_unregisteredModules` Set, guard in `register()`, tracking in `unregister()`, cleanup in `clear()` | +13 |
| `src/lib/handlers/api-manager.mjs` | Changed `find()` → `findLast()` for moduleID prefix lookup | +3/-1 |
| `src/lib/handlers/unified-wrapper.mjs` | Added `__invalid` check at start of `___materialize()` | +6 |

### Total: 22 insertions, 1 deletion across 3 files

---

## Test Results

### Before Fix
- **metadata-api-manager.test.vitest.mjs:** 89/96 passing (7 failures, all LAZY modes)
- **Full suite baseline:** 32 files failed, 595 tests failed

### After Fix
- **metadata-api-manager.test.vitest.mjs:** 96/96 passing ✅ (verified 3 consecutive runs)
- **Full suite baseline:** 31 files failed, 587 tests failed (8 fewer failures — all the LAZY timing failures fixed, no regressions)

---

## Related Files

- `src/lib/handlers/ownership.mjs` — Primary fix: `_unregisteredModules` guard
- `src/lib/handlers/api-manager.mjs` — Defense-in-depth: `findLast()` lookup
- `src/lib/handlers/unified-wrapper.mjs` — Early termination: `__invalid` materialization check
- `src/lib/modes/lazy.mjs` — Source of stale registrations (closure captures moduleIDOverride)
- `tests/vitests/suites/metadata/metadata-api-manager.test.vitest.mjs` — Previously failing tests

---

## Key Learnings

1. **Async closures capturing state** — Lazy materialization closures capture the moduleID at creation time. If the module is removed before materialization completes, the closure operates on a stale moduleID.
2. **`find()` ordering matters** — Map insertion order determines `find()` results. Stale entries that get re-registered end up before newer entries. `findLast()` is the correct approach for "most recent match" semantics.
3. **Defense-in-depth** — Three layers of protection ensure no single failure mode causes the bug to resurface: prevent stale registration, prefer newest match, skip materialization for invalid wrappers.
4. **Previous failed approaches** — Making `lifecycle.emit()` async, adding recursive cleanup, and adding timeouts all failed because they addressed symptoms (lifecycle timing, wrapper cleanup) rather than the root cause (stale ownership re-registration).
