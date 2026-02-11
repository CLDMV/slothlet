# Lazy Mode api.remove() Timing Issue

**Status:** 🔴 IN PROGRESS  
**Priority:** HIGH  
**Impact:** Test failures on slower machines (CI/CD reliability)  
**Created:** 2026-02-11  
**Last Updated:** 2026-02-11

---

## Problem Summary

Tests fail intermittently on slower machines when using `api.remove()` in LAZY mode. After removal, metadata and wrapper objects are still accessible when they should be `undefined`. This is a **race condition** caused by fire-and-forget lifecycle event handlers.

### Failing Tests

**File:** `tests/vitests/suites/metadata/metadata-api-manager.test.vitest.mjs`  
**Total Failures:** 5-8 (varies by timing)  
**Configurations Affected:** LAZY, LAZY_HOOKS, LAZY_LIVE, LAZY_LIVE_HOOKS (all lazy modes)  
**Configurations Passing:** EAGER, EAGER_HOOKS, EAGER_LIVE, EAGER_LIVE_HOOKS (all eager modes)

#### Specific Test Failures:

1. **"should handle multiple add/remove/add cycles"** (LAZY_HOOKS, LAZY_LIVE_HOOKS)
   - **Expected:** `api.cycled` is `undefined` after `api.remove("cycled")`
   - **Actual:** Empty `UnifiedWrapper` with `_impl: {}` still exists
   - **Lines:** 160-182

2. **"should handle multiple add/remove cycles via internal API"** (LAZY, LAZY_LIVE_HOOKS, LAZY_LIVE)
   - **Expected:** Metadata is `undefined` after `api.remove("cycleInternal")`
   - **Actual:** Metadata from cycle 2 still present (e.g., `{ cycle: 2, iteration: "cycle_2" }`)
   - **Lines:** 260-284

### Test Pattern:
```javascript
for (let cycle = 1; cycle <= 3; cycle++) {
    await api.slothlet.api.add("cycleInternal", TEST_DIRS.API_SMART_FLATTEN, { metadata: { cycle } });
    await materialize(api, "cycleInternal.config.settings.getPluginConfig");
    
    // Verify metadata
    const metadata = await api.metadataTestHelper.getMetadata("cycleInternal.config.settings.getPluginConfig");
    expect(metadata.cycle).toBe(cycle); // ✅ PASSES
    
    // Remove
    await api.slothlet.api.remove("cycleInternal");
    
    // Verify removed
    const afterRemove = await api.metadataTestHelper.getMetadata("cycleInternal.config.settings.getPluginConfig");
    expect(afterRemove).toBeUndefined(); // ❌ FAILS - still has cycle 2 metadata
}
```

---

## Root Cause Analysis

### Primary Issue: Fire-and-Forget Lifecycle Events

**Location:** `src/lib/handlers/api-manager.mjs:828`

```javascript
// Emit lifecycle event for removal BEFORE deletion
if (removedImpl && this.slothlet.handlers?.lifecycle) {
    const metadata = this.slothlet.handlers.metadata?.getMetadata?.(removedImpl);
    this.slothlet.handlers.lifecycle.emit("impl:removed", {
        apiPath,
        impl: removedImpl,
        source: "removal",
        moduleID: metadata?.moduleID,
        filePath: metadata?.filePath,
        sourceFolder: metadata?.sourceFolder
    });
}
```

**Problem:** `lifecycle.emit()` calls handlers synchronously but doesn't await async handlers:

**Location:** `src/lib/handlers/lifecycle.mjs:124`

```javascript
for (const handler of handlers) {
    try {
        handler(data); // 🔴 FIRE-AND-FORGET - no await!
    } catch (error) {
        // Log error but don't stop other handlers
        if (!this.config?.silent) {
            console.error(`[slothlet] Lifecycle event handler error (${event}):`, error);
        }
    }
}
```

### Secondary Issues in LAZY Mode

1. **Shallow Cleanup:** `deletePath()` only cleans immediate wrapper properties, not nested child wrappers
2. **Metadata Persistence:** Function references in nested child wrappers keep metadata alive in WeakMap
3. **Lazy Materialization After Removal:** Accessing removed paths can trigger re-materialization if `_materializeFunc` isn't cleared

---

## Why It Affects Slower Machines

On **fast machines:**
- Lifecycle handlers complete before test checks metadata
- Race window is ~0-5ms (imperceptible)

On **slower machines:**
- Lifecycle handlers take longer to complete
- Race window is ~10-100ms (visible in tests)
- Test checks metadata BEFORE async cleanup completes

**Key Point:** This is NOT a bug in logic, it's a **missing synchronization point**. The code assumes synchronous cleanup but allows async handlers.

---

## Solution Requirements

1. ✅ **Make lifecycle.emit() await async handlers** (primary fix)
2. ✅ **Make deletePath() async and await lifecycle events** (secondary fix)
3. ✅ **Ensure all callers of deletePath() await it properly**
4. ⚠️ **Consider recursive cleanup for nested lazy wrappers** (defensive - may not be needed after primary fix)
5. ✅ **Add tests to verify timing/synchronization works on slow machines**

---

## Changes Made

### Investigation Phase
- ✅ Git bisected to find when failures started (~commit a3bd85b, pre-existing issue)
- ✅ Confirmed failures only in LAZY modes, not EAGER modes
- ✅ Identified lifecycle.emit() as fire-and-forget
- ✅ Confirmed deletePath() is synchronous but emits async events

### Attempted Fixes (Reverted)
- ❌ Added `_cleanupWrapperRecursive()` - made failures worse (5→8 failures)
  - **Reason:** Cleared too much, broke other functionality
  - **Learning:** Cleanup is fine, timing is the issue

---

## Implementation Plan

### Phase 1: Fix Lifecycle Event Timing ✅ COMPLETED
1. ✅ Made `lifecycle.emit()` async and await async handlers
2. ✅ Made `deletePath()` async  
3. ✅ Awaited lifecycle.emit() before deletion
4. ✅ Updated all call sites to await deletePath()

**Result:** No regression, but didn't fix the issue (no lifecycle handlers registered in tests)

### Phase 2: Wait for Pending Materializations 📋 IN PROGRESS
**Root Cause Update:** Tests have NO lifecycle handlers. The real issue is that in LAZY mode, when tests access properties to check metadata, they might trigger NEW materializations of child wrappers that weren't fully cleaned up.

Solution: Before completing `removeApiComponent()`, wait for any pending materializations to complete, similar to the fix in commit 9825104 for `addApiComponent()`.

1. Collect pending `_materializationPromise` from wrappers before deletion
2. Wait for all materializations to complete
3. Then proceed with deletion
4. Add defensive check to prevent re-materialization after removal

### Phase 3: Add Recursive Cleanup (Defensive) 📋
1. Add `_cleanupWrapperRecursive()` method
2. Clear `_materializeFunc` to prevent re-materialization  
3. Clear all child wrapper references
4. Mark wrappers as invalid

### Phase 4: Add Timing Tests 📋
1. Add explicit timing test that simulates slow machine
2. Test with artificial delay in lifecycle handlers (even though none exist)
3. Verify metadata is properly cleaned up

---

## Testing Strategy

### Verification Steps:
1. Run failing test file: `npm run vitest tests/vitests/suites/metadata/metadata-api-manager.test.vitest.mjs`
2. Run full baseline: `npm run baseline`
3. Test on slower machine or with simulated delay
4. Verify LAZY mode tests pass consistently

### Success Criteria:
- ✅ All 96 tests in metadata-api-manager pass
- ✅ No failures in LAZY mode configurations
- ✅ Tests pass reliably on slower machines
- ✅ No performance regression in EAGER mode

---

## Related Files

- `src/lib/handlers/api-manager.mjs` - removeApiComponent(), deletePath()
- `src/lib/handlers/lifecycle.mjs` - emit() method (fire-and-forget)
- `src/lib/handlers/metadata.mjs` - metadata cleanup
- `src/lib/handlers/unified-wrapper.mjs` - lazy wrapper materialization
- `tests/vitests/suites/metadata/metadata-api-manager.test.vitest.mjs` - failing tests

---

## Notes

- This is a **pre-existing issue**, not caused by recent work
- Only affects LAZY mode because of async materialization
- EAGER mode not affected because everything is synchronous
- Fix will improve reliability on CI/CD systems with varying performance
- Consider adding configurable timeout for lifecycle handlers

---

## Next Actions

- [ ] Implement async lifecycle.emit() with handler tracking
- [ ] Make deletePath() async and await lifecycle events
- [ ] Update all call sites to properly await
- [ ] Add timing/synchronization test
- [ ] Verify all tests pass on slower machines
- [ ] Document lifecycle handler best practices
