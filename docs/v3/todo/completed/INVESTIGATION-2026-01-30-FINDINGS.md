# Investigation Findings - January 30, 2026

## Test Baseline Status

**Commit 357c039** (feat: reload implementation):
- ✅ All 34 baseline test files passing
- ✅ 2356/2356 tests passing (100%)

**With uncommitted changes (stash@{0})**:
- ❌ 2 baseline test files failing
- ❌ 25/2356 tests failing (98.9% passing)
- Failing tests:
  - `ownership-replacement.test.vitest.mjs`: 8 failures
  - `proxy-baseline.test.vitest.mjs`: 17 failures

## Changes Made (Stashed)

### 1. Config Bug Fix - `src/lib/builders/modes-processor.mjs` (Line 301)
**Purpose**: Fix `api.config` showing as empty object `{}`

**Change**:
```javascript
const wrapper = new UnifiedWrapper(this.slothlet, {
    effectiveMode,
    apiPath: buildApiPath(categoryName),
    initialImpl: exportedValue,  // <-- ADDED: Initialize wrapper with exported value
    materializeOnCreate: config.backgroundMaterialize,
    filePath: file.path,
    moduleId: moduleId || file.moduleId,
    sourceFolder
});
api[categoryName] = wrapper.createProxy();  // <-- ADDED: Explicit assignment
```

**Result**: 
- ✅ FIXED: `api.config` now shows correct object with properties
- ✅ FIXED: `console.log(api.config)` displays full object
- ✅ FIXED: Property access works correctly
- ❌ BROKE: 25 tests now failing (ownership rollback + proxy baseline)

### 2. Array Protection - `src/lib/handlers/unified-wrapper.mjs` (Line 385)
**Purpose**: Prevent deletion of array indices from wrapper's `_impl`

**Change**:
```javascript
const keepImplProperties =
    typeof this._impl === "function" ||
    Array.isArray(this._impl) ||  // <-- ADDED
    (this._impl && typeof this._impl === "object" && typeof this._impl.default === "function");
```

**Result**:
- ❌ BROKE: 17 proxy-baseline tests failing with array access issues

### 3. Custom Inspect Handlers - `src/lib/handlers/unified-wrapper.mjs`
**Purpose**: Make `console.log(api.config)` show actual values instead of `{}`

**Changes**:
- Added `util.inspect.custom` to proxy target (lines 739-772)
- Added `util.inspect.custom` handler in getTrap (lines 862-892)
- Added descriptor unwrapping logic (lines 1345-1368)

**Result**:
- ✅ FIXED: Console output shows actual object values
- Side effect: May contribute to proxy-baseline failures

### 4. Property Descriptor Fix - `src/lib/handlers/unified-wrapper.mjs` (Line 975)
**Purpose**: Avoid infinite recursion when `_impl` contains proxies

**Change**:
```javascript
// OLD: Direct property access
let value = wrapper._impl ? wrapper._impl[prop] : undefined;

// NEW: Use Object.getOwnPropertyDescriptor to avoid triggering proxy getTrap
let value = undefined;
if (wrapper._impl) {
    const descriptor = Object.getOwnPropertyDescriptor(wrapper._impl, prop);
    if (descriptor) {
        if (descriptor.get) {
            value = descriptor.get.call(wrapper._impl);
        } else if ("value" in descriptor) {
            value = descriptor.value;
        }
    }
}
```

**Result**:
- ✅ FIXED: Eliminated stack overflow in ownership rollback
- ❌ CHANGED BEHAVIOR: May affect how wrapped values are retrieved

### 5. Reload System - `src/slothlet.mjs`
**Purpose**: Implement full instance reload with operation history replay

**Changes**:
- Added `operationHistory` tracking in api-manager
- Modified reload() to preserve instanceID and replay operations
- Added context manager reuse during reload

**Result**:
- ✅ Works for reload tests
- ❓ Unknown impact on other tests

## Root Cause Analysis

### Ownership Rollback Failures (8 tests)
**Error**: "fn.apply is not a function"
**Location**: `src/lib/handlers/context-async.mjs:119` and `context-live.mjs:93`

**Problem**: When ownership rollback occurs:
1. Ownership stores WRAPPERS (not raw values)
2. During rollback, `ownership.getCurrentValue()` returns a WRAPPER
3. That wrapper is passed to `setValueAtPath()` 
4. If the wrapper's `_impl` is set to another wrapper, double-wrapping occurs
5. When context tries to execute the "function", it's actually a wrapper proxy, not a raw function
6. `fn.apply()` fails because proxies don't have `.apply` method directly accessible

**Attempted Fix**: Tried unwrapping before storing in ownership - WRONG approach because ownership is designed to store wrappers.

**Correct Fix Needed**: 
- Either: Unwrap when RETRIEVING from ownership during rollback
- Or: Detect wrapper-in-wrapper scenario in `__setImpl` and unwrap
- Or: Understand why the system worked before and what changed

### Proxy Baseline Failures (17 tests)
**Error**: Array access issues (`lg[0]`, array-style access)

**Problem**: Array check added to `keepImplProperties` prevents deletion of array properties from `_impl`, but this may cause conflicts with how arrays are proxied.

**Affected Pattern**:
```javascript
// Test expects: lg[0] to return first item
// With keepImplProperties=true for arrays, indices stay in _impl
// But childCache may also have entries, causing conflicts
```

## Key Insights

1. **Ownership stores wrappers by design** - this is correct and should not be changed
2. **The `initialImpl` fix works** but something about how it initializes wrappers breaks the rollback mechanism
3. **Array handling is delicate** - the keepImplProperties flag affects more than just deletion
4. **Double-wrapping is the real issue** - wrappers end up with other wrappers as their `_impl`

## Questions for Resolution

1. **Why does `initialImpl: exportedValue` break rollback?**
   - Does it cause wrappers to be created differently?
   - Is the exported value itself a wrapper in some scenarios?

2. **What is the correct unwrapping strategy?**
   - Should `__setImpl` unwrap incoming values?
   - Should rollback unwrap before calling `setValueAtPath`?
   - How did it work before this change?

3. **Is the array check correct?**
   - Should arrays be treated like functions (keep impl properties)?
   - Or should they be treated differently?

## Next Steps

1. ✅ Verify baseline tests pass without changes (DONE - all passing)
2. ✅ Identify which specific changes break tests (DONE - documented above)
3. ⏳ Understand WHY the `initialImpl` change breaks rollback
4. ⏳ Find minimal fix that preserves config display AND rollback functionality
5. ⏳ Fix or revert array handling change
6. ⏳ Commit working solution

## Recommendation

The safest approach is to:
1. Keep ONLY the `initialImpl: exportedValue` change from modes-processor.mjs
2. Remove the array check from keepImplProperties (revert to original)
3. Test if this reduces failures
4. If ownership tests still fail, investigate the wrapper-in-wrapper scenario more carefully
5. Consider if there's a different fix for the config display issue that doesn't affect wrapper initialization
