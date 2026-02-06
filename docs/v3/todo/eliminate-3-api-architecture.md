# Eliminate 3-API Architecture - Consolidate to 2 APIs

**Status:** 🟡 Pending Approval  
**Created:** 2026-02-06  
**Priority:** HIGH - Architectural simplification  
**Complexity:** Medium - Requires coordinated changes across 3 files

---

## Problem Statement

Currently, v3 maintains **3 separate API references**:

1. **`slothlet.api`** - Raw API from mode builders (eager/lazy)
2. **`slothlet._currentApi`** - Cloned API with builtins added
3. **`slothlet.boundApi`** - Proxy forwarding to `_currentApi`

This creates unnecessary complexity:
- Deletion logic must target ALL 3 references (api-manager.mjs bug we just fixed)
- Shallow clone causes shared proxy references between `api` and `_currentApi`
- `_currentApi` serves no purpose beyond being a forwarding target for `boundApi`
- Clone was added to "prevent cross-instance pollution" but ALL exports are UnifiedWrapper proxies (instance-specific)

**v2 had only 2 API references** - we should match that architecture.

---

## Root Cause Analysis

### Current Flow (v3 - WASTEFUL)

```
1. Mode builder creates api with UnifiedWrapper proxies
   └─> slothlet.api = finalApi

2. buildFinalAPI() CLONES the api (pointless!)
   └─> clonedApi = Object.assign({}, slothlet.api)
   └─> Adds builtins to clonedApi
   └─> Returns clonedApi

3. load() stores clonedApi separately
   └─> slothlet._currentApi = apiWithBuiltins

4. load() creates proxy to _currentApi
   └─> slothlet.boundApi forwards to _currentApi

5. User receives boundApi (stable reference)
   └─> boundApi[prop] → _currentApi[prop] → SAME proxy as in slothlet.api[prop]!
```

**Problem:** Steps 2-4 are redundant! `slothlet.api` and `slothlet._currentApi` share the SAME proxy objects via shallow clone, so why have both?

### Proposed Flow (v3 - SIMPLIFIED)

```
1. Mode builder creates api with UnifiedWrapper proxies
   └─> slothlet.api = finalApi

2. buildFinalAPI() mutates slothlet.api directly (NO CLONE)
   └─> Adds builtins to slothlet.api IN PLACE
   └─> Returns slothlet.api

3. load() creates/updates boundApi proxy
   └─> slothlet.boundApi forwards to slothlet.api

4. User receives boundApi (stable reference)
   └─> boundApi[prop] → slothlet.api[prop] → UnifiedWrapper proxy
```

**Benefit:** Only 2 API references (like v2), cleaner deletion logic, no pointless clone

---

## Why Clone Was Added (And Why It's Wrong)

**Comment in api_builder.mjs lines 72-74:**
```javascript
// CRITICAL: Clone the API object to prevent cross-instance pollution from module cache
// The API modules are cached by Node.js and shared across instances
// We must create a new object before mutating it with builtins
```

**This is INCORRECT because:**
- All exports are wrapped in UnifiedWrapper proxies (instance-specific)
- UnifiedWrapper stores `_impl` per-instance, not shared
- Module cache pollution would only happen with raw exports (which we don't return)
- The clone is shallow anyway, so properties ARE still shared!

**Proof:** If module cache pollution was real, the shallow clone wouldn't fix it because all the proxy references are shared via `Object.assign({}, api)`.

---

## Implementation Plan

### Phase 1: Eliminate buildFinalAPI Clone ✅ TODO

**File:** `src/lib/builders/api_builder.mjs`

**Changes:**
1. Remove the `Object.assign` clone (lines 75-80)
2. Mutate `userApi` directly with builtins
3. Update comments to reflect "mutate in place, no clone needed"
4. Return `userApi` directly

**Before:**
```javascript
const clonedApi =
    typeof userApi === "function"
        ? Object.assign(function (...args) { return userApi(...args); }, userApi)
        : Object.assign({}, userApi);

// ... add builtins to clonedApi ...
return clonedApi;
```

**After:**
```javascript
// No clone needed - all exports are already instance-specific UnifiedWrapper proxies
// Mutate userApi in place to add builtins

// ... add builtins to userApi directly ...
return userApi;
```

---

### Phase 2: Eliminate _currentApi Reference ✅ TODO

**File:** `src/slothlet.mjs`

**Changes:**

1. **Constructor (lines 52, 58-78):** Remove `_currentApi` placeholder and early proxy creation
   - Delete line 52: `this._currentApi = {};`
   - Delete lines 58-78: Early `boundApi` proxy creation
   - Keep only: `this.api = null;` and `this.boundApi = null;`

2. **load() method (lines 338-368):** Eliminate `_currentApi` assignment, update `boundApi` to forward to `this.api`
   - Delete line 338: `this._currentApi = apiWithBuiltins;`
   - Change line 315: `const apiWithBuiltins = ...` → Just mutate `this.api` directly in buildFinalAPI
   - Update proxy creation (lines 340-368):
     ```javascript
     // Before:
     this._currentApi = apiWithBuiltins;
     this.boundApi = new Proxy(proxyTarget, {
         get: (target, prop) => this._currentApi[prop],
         set: (target, prop, value) => { this._currentApi[prop] = value; ...
     });
     
     // After:
     // apiWithBuiltins is now just this.api (mutated in place)
     this.boundApi = new Proxy(proxyTarget, {
         get: (target, prop) => this.api[prop],
         set: (target, prop, value) => { this.api[prop] = value; ...
     });
     ```

3. **Update all proxy handlers** to reference `this.api` instead of `this._currentApi`

---

### Phase 3: Clean Up Deletion Logic ✅ TODO

**File:** `src/lib/handlers/api-manager.mjs`

**Changes:**

1. **removeApiComponent() method (lines 1514-1541):** Remove `_currentApi` deletion
   - Delete lines 1516-1519 (deletePath for _currentApi)
   - Delete lines 1540-1541 (root segment delete for _currentApi)
   - Update comments to reflect 2 APIs instead of 3

2. **Verify all other deletion sites** no longer reference `_currentApi`

**Before (3 deletions):**
```javascript
this.deletePath(this.slothlet.api, parts);
this.deletePath(this.slothlet.boundApi, parts);
if (this.slothlet._currentApi) {
    this.deletePath(this.slothlet._currentApi, parts);
}
```

**After (2 deletions):**
```javascript
this.deletePath(this.slothlet.api, parts);
this.deletePath(this.slothlet.boundApi, parts);
```

---

### Phase 4: Remove Redundant Root Segment Cleanup ✅ TODO

**File:** `src/lib/handlers/api-manager.mjs`

**Analysis:** Lines 1522-1541 do a separate root segment deletion AFTER `deletePath` already handled it.

**Current behavior:**
1. Loop deletes all paths via `deletePath(api, parts)` (lines 1514-1519)
2. Then separately deletes root segment via `delete api[rootSegment]` (lines 1534-1541)

**Problem:** This is redundant! If `pathsToDelete` includes `"cycled"`, then `deletePath(api, ["cycled"])` already deletes it. The separate root cleanup is leftover defensive code.

**Decision:** Keep it for now as safety net (edge cases where root isn't in pathsToDelete). Document WHY it exists.

**Action:** Add comment explaining this is defensive cleanup for edge cases.

---

## Testing Strategy

### Critical Test Cases

1. **Multi-cycle add/remove** (metadata-api-manager.test.vitest.mjs)
   - Already passing, should continue to pass
   - Verifies deletion works correctly across all 8 configs

2. **Reload functionality** (if we have tests)
   - Verify `boundApi` reference stays stable after reload
   - Verify `this.api` gets replaced during reload
   - User's reference to `boundApi` should still work

3. **Multiple instances**
   - Create 2 instances with same modules
   - Verify no cross-contamination
   - This tests whether the "module cache pollution" fear was valid

4. **Full baseline** (all 2356 tests)
   - Must pass after refactor
   - No regressions allowed

### Test Execution Order

```bash
# 1. Run metadata tests (most affected)
npm run vitest -- tests/vitests/suites/metadata/

# 2. Run full baseline
npm run baseline

# 3. Run precommit validation
npm run precommit
```

---

## Risk Assessment

### Low Risk ✅
- buildFinalAPI changes: Just removes clone, functionally equivalent
- _currentApi elimination: Pure refactoring, no logic changes
- Deletion logic cleanup: Already know it works from current fix

### Medium Risk ⚠️
- Reload functionality: Need to verify boundApi proxy update works correctly
- Edge cases in deletion: Root segment cleanup might catch edge cases we don't test

### Mitigation
- Implement incrementally (phase by phase)
- Run tests after each phase
- Keep git commits small for easy rollback
- Test reload specifically if we have tests for it

---

## Expected Benefits

1. **Simpler mental model** - 2 APIs instead of 3 (matches v2 architecture)
2. **Cleaner deletion logic** - Only 2 deletions needed, not 3
3. **No shallow clone bugs** - Eliminates shared reference issues we just debugged
4. **Performance** - One less object allocation, one less proxy indirection
5. **Maintainability** - Less code, fewer places to keep in sync

---

## Rollback Plan

If tests fail after implementation:

1. **Phase 1 rollback:** Restore `Object.assign` clone in buildFinalAPI
2. **Phase 2 rollback:** Restore `_currentApi` in slothlet.mjs
3. **Phase 3 rollback:** Restore 3rd deletion in api-manager.mjs

Each phase is independently revertible via git.

---

## Pre-Refactor Baseline Results

**Date:** 2026-02-06  
**Command:** `npm run baseline`  
**Status:** ✅ ALL TESTS PASSING

```
Test Files  34 passed (34)
Tests       2356 passed (2356)
Duration    97.36s (tests 362.72s)
Heap        max 443 MB | avg 189 MB

Top Memory Users:
- user-metadata.test.vitest.mjs: 443 MB
- system-metadata.test.vitest.mjs: 440 MB
- per-request-context.test.vitest.mjs: 406 MB
- collision-config.test.vitest.mjs: 393 MB
- metadata-external-api.test.vitest.mjs: 388 MB
```

**Verification:** All metadata tests passing (including the api-manager deletion test we just fixed). Ready for refactoring.

---

## Progress Tracking

- [ ] Phase 1: Remove buildFinalAPI clone
- [ ] Phase 2: Eliminate _currentApi reference  
- [ ] Phase 3: Clean up deletion logic
- [ ] Phase 4: Document root segment cleanup
- [ ] Run metadata tests
- [ ] Run full baseline (expect 2356/2356 passing)
- [ ] Run precommit validation
- [ ] Update this doc with final results

---

## Questions for Review

1. **Do we have reload tests?** Need to verify boundApi stability during reload
2. **Are there other _currentApi references?** Searched and found only 3 files, but double-check
3. **Should we keep defensive root cleanup?** Or trust deletePath to handle all cases?
4. **Breaking change?** This is internal refactor, no API changes, but does reload behavior change?

---

## Related Files

**Primary Changes:**
- `src/lib/builders/api_builder.mjs` - Remove clone
- `src/slothlet.mjs` - Eliminate _currentApi, update boundApi proxy
- `src/lib/handlers/api-manager.mjs` - Clean up deletion logic

**Verification Needed:**
- `tests/vitests/suites/metadata/metadata-api-manager.test.vitest.mjs` - Deletion tests
- Any reload tests (if they exist)
- Full test baseline (2356 tests)

---

## Notes

- This refactor brings v3 architecture back in line with v2's simpler 2-API model
- The "module cache pollution" fear that motivated the clone was unfounded
- Shallow clone actually made things WORSE by sharing proxy references
- UnifiedWrapper already provides instance isolation, no clone needed
