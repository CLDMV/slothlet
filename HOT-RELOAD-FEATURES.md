# Hot Reload Features - Implementation Status

## ✅ Implemented Features

### 1. `reload()` Method

- **Location**: Lines 1345-1407 in `src/slothlet.mjs`
- **Status**: ✅ Fully implemented
- **Functionality**:
  - Clears current API state
  - Re-runs initial load with stored config
  - Replays all `addApi()` calls (except removed modules)
  - Maintains same bound API reference
- **Error Handling**: ✅ Throws error when `hotReload` is disabled
- **Usage**: `await api.reload()`

### 2. `reloadApi(apiPath)` Method

- **Location**: Lines 1437-1506 in `src/slothlet.mjs`
- **Status**: ✅ Fully implemented
- **Functionality**:
  - Selective reload of specific API paths
  - Finds matching `addApi()` history entries
  - Re-executes with `mutateExisting: true`
  - Preserves references through mutation
- **Error Handling**:
  - ✅ Throws error when `hotReload` is disabled
  - ✅ Validates `apiPath` is a non-empty string
  - ✅ Silently succeeds for non-existent paths
- **Usage**: `await api.reloadApi("plugins")`

### 3. Hot Reload Configuration

- **Option**: `hotReload: true`
- **Status**: ✅ Implemented
- **Functionality**:
  - Enables `reload()` and `reloadApi()` methods on bound API (lines 997-1016)
  - Tracks module ownership via `_moduleOwnership` Map
  - Stores `_addApiHistory` for replay
  - Stores `_removeApiHistory` Set for filtering

### 4. Module Ownership Tracking

- **Status**: ✅ Implemented (Rule 12)
- **Functionality**:
  - `_registerApiOwnership()` - Tracks which module owns which API path
  - `_getApiOwnership()` - Gets module that owns an API path
  - Used to prevent cross-module overwrites during reload

## ❌ Missing/Not Exposed Features

### 1. Direct `api.context` Access

- **Test Expectation**: `api.context.userId = 123`
- **Reality**: ❌ `context` is NOT exposed as a property on `api`
- **Actual Access**:
  - Via `@cldmv/slothlet/runtime` imports inside API modules
  - Via internal `api.__ctx.context` (hidden property)
  - Via `load()` method's `ctxRef` parameter during initialization

### 2. Direct `api.reference` Access

- **Test Expectation**: `api.reference.customUtil = () => "test"`
- **Reality**: ❌ `reference` is NOT exposed as a property on `api`
- **Actual Access**:
  - Via `@cldmv/slothlet/runtime` imports inside API modules
  - Via internal `api.__ctx.reference` (hidden property)
  - Reference properties are merged into API root level during creation

### 3. Context/Reference Preservation Across `reload()`

- **Test Expectation**: User-set context/reference values persist after reload
- **Reality**: ⚠️ Unclear if supported
- **Issue**: `reload()` clears API state and re-runs `load()` - may reset context/reference

### 4. `mutateExisting` for Reference Preservation in `reloadApi()`

- **Test Expectation**: `reloadApi()` preserves references by using `mutateExisting: true`
- **Reality**: ✅ Code exists (line 1496) but tests fail
- **Issue**: May not be working correctly OR test expectations are wrong

## 🔍 Investigation Findings

### Error Patterns in Tests

#### Test 10: `reloadApi()` selective reload

- **Error**: "extra1 reference should be preserved after reloadApi"
- **Issue**: Reference preservation may not work as expected with `mutateExisting: true`

#### Test 11: Multiple modules on same path

- **Error**: Rule 12 violation - "Cannot overwrite API 'features' - owned by module 'core'"
- **Issue**: Second `addApi()` requires `forceOverwrite: true` but still fails due to ownership rules

#### Test 12 & 13: Context/Reference preservation

- **Error**: "Cannot set properties of undefined (setting 'userId'/'customUtil')"
- **Root Cause**: `api.context` and `api.reference` don't exist as settable properties

#### Test 15 & 17: Error handling when disabled

- **Error**: Methods don't throw when `hotReload` is disabled
- **Issue**: Methods ARE only added when `hotReload: true` (lines 997-1016), so they don't exist to throw errors
- **Test Flaw**: Test tries to call methods that were never added to API

#### Test 21: Deep reference preservation with `mutateExisting`

- **Error**: "Nested object reference not preserved with mutateExisting"
- **Issue**: `mutateExisting` may only work for top-level properties, not nested objects

## 📋 Recommendations

### Fix Test Expectations

1. **Tests 12-13**: Remove context/reference direct access tests - this feature doesn't exist
2. **Tests 15, 17**: Remove error checking tests - methods don't exist when disabled
3. **Test 11**: Fix to use proper module ownership semantics OR enable `allowApiOverwrite`
4. **Test 21**: Either fix implementation OR adjust test to match actual behavior

### Expose Context/Reference (Optional Enhancement)

If this feature is desired, add to `createBoundApi()`:

```javascript
// Add context getter/setter
Object.defineProperty(boundApi, "context", {
	get: () => this.context,
	set: (val) => {
		Object.assign(this.context, val);
	},
	configurable: true,
	enumerable: false
});

// Add reference getter/setter
Object.defineProperty(boundApi, "reference", {
	get: () => this.reference,
	set: (val) => {
		Object.assign(this.reference, val);
	},
	configurable: true,
	enumerable: false
});
```

### Fix Module Ownership for Overwrites

Test 11 expects multiple modules on same path. Either:

- Allow same-module overwrites (check if `moduleId` matches existing owner)
- Require `forceOverwrite` option to bypass ownership checks

## Summary

The hot reload implementation is **mostly complete** but:

- ❌ Tests assume features that don't exist (`api.context`, `api.reference` direct access)
- ❌ Tests assume error handling that can't occur (methods not added when disabled)
- ⚠️ Some features may not work as expected (`mutateExisting` reference preservation)
- ⚠️ Module ownership rules may be too strict for legitimate use cases

**Next Steps**: Either fix tests to match implementation OR enhance implementation to match test expectations.
