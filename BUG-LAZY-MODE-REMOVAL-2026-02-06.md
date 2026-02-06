# Bug: Lazy Mode with Hooks - Incomplete API Removal on Multiple Add/Remove Cycles

**Date Discovered:** 2026-02-06  
**Affected Configurations:** `LAZY_HOOKS` only (not LAZY, not EAGER variants)  
**Severity:** High - Data from previous cycle persists after removal

## Summary

When using lazy mode with hooks (`mode: "lazy"`, `hooks: true`), performing multiple add/remove cycles on the same API path fails to properly clean up the API tree. After removing cycle N, the API tree still contains data from cycle N-1.

## Test Case

**File:** `tests/vitests/suites/metadata/metadata-api-manager.test.vitest.mjs`  
**Test:** `"should handle multiple add/remove cycles via internal API"`  
**Status:** 7/8 configurations pass, `LAZY_HOOKS` fails

##Details

```javascript
for (let cycle = 1; cycle <= 3; cycle++) {
  // Add API
  await api.slothlet.api.add("cycleInternal", TEST_DIRS.API_SMART_FLATTEN, {
    metadata: { cycle, iteration: `cycle_${cycle}` }
  });
  
  // Materialize function
  await materialize(api, "cycleInternal.config.settings.getPluginConfig");
  
  // Verify metadata exists with correct cycle number
  const metadata = await api.metadataTestHelper.getMetadata("...");
  expect(metadata.cycle).toBe(cycle); // ✅ PASSES
  
  // Remove API
  await api.slothlet.api.remove("cycleInternal");
  
  // Verify API removed
  const afterRemove = await api.metadataTestHelper.getMetadata("...");
  expect(afterRemove).toBeUndefined(); // ❌ FAILS on cycle 2 in LAZY_HOOKS
}
```

## Expected Behavior

After `await api.slothlet.api.remove("cycleInternal")`:
- `api.cycleInternal` should be `undefined`
- `"cycleInternal" in api` should be `false`
- `api.metadataTestHelper.getMetadata("cycleInternal.config.settings.getPluginConfig")` should return `undefined`

## Actual Behavior (LAZY_HOOKS only)

**Cycle 1:** ✅ Works correctly - API removed, metadata undefined  
**Cycle 2:** ❌ BUG - After removing cycle 3:
```javascript
api.cycleInternal = {
  addapi: { ... },
  config: { settings: { getPluginConfig: [Function], ... } },
  services: { ... },
  utils: [Function]
}

"cycleInternal" in api // true (should be false!)

metadata = {
  cycle: 2,  // Cycle 2 data persists!
  iteration: "cycle_2",
  moduleID: "cycleInternal_b7dku9:cycleInternal/config/settings/getPluginConfig",
  ...
}
```

## Configuration Matrix Results

| Config | Result |
|--------|--------|
| `EAGER_HOOKS` | ✅ Pass |
| `EAGER` | ✅ Pass |
| `EAGER_LIVE_HOOKS` | ✅ Pass |
| `EAGER_LIVE` | ✅ Pass |
| `LAZY_HOOKS` | ❌ **FAIL** |
| `LAZY` | ✅ Pass |
| `LAZY_LIVE_HOOKS` | ✅ Pass |
| `LAZY_LIVE` | ✅ Pass |

## Root Cause Analysis

The bug is specific to:
1. **Lazy mode** - proxy-based deferred loading
2. **With hooks enabled** - lifecycle event system
3. **Multiple cycles** - specifically fails on cycle 2

The issue appears to be in the API removal logic (`src/lib/handlers/api-manager.mjs` method `deletePath()`) when handling lazy mode proxies with hooks. The deletion is not properly clearing the lazy proxy structures, leaving cycle 2's data accessible after cycle 3 is removed.

## Key Code Paths

1. **API Removal:** `src/lib/handlers/api-manager.mjs` - `removeApiComponent()` → `deletePath()`
2. **Lazy Mode Proxies:** `src/lib/modes/lazy.mjs` - Proxy handler and wrapper state
3. **Metadata Retrieval:** `src/lib/handlers/metadata.mjs` - `get()` → `#findFunctionByPath()`

## Impact

- **Security:** Old implementations remain accessible when they should be removed
- **Memory Leaks:** Previous cycle data not garbage collected
- **Metadata Integrity:** Wrong metadata returned (cycle 2 instead of undefined)
- **API Correctness:** `api.cycleInternal` exists when it should be undefined

## Workaround

None currently - avoid using `LAZY_HOOKS` configuration if dynamic add/remove cycles are required.

## Next Steps

1. Investigate why `deletePath()` fails to clean up lazy proxies with hooks
2. Check if lazy wrapper's `_impl` or `_proxyTarget` cache is holding stale references
3. Verify hook lifecycle events are properly cleaning up references in lazy mode
4. Add specific cleanup for lazy mode proxies in the removal path

## Related Files

- `tests/vitests/suites/metadata/metadata-api-manager.test.vitest.mjs` (test case)
- `src/lib/handlers/api-manager.mjs` (removal logic)
- `src/lib/modes/lazy.mjs` (lazy proxy implementation)
- `src/lib/handlers/metadata.mjs` (metadata retrieval)
- `src/lib/builders/api_builder.mjs` (API building logic)
