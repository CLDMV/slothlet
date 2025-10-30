# Slothlet Bugs

This document tracks identified bugs in the slothlet codebase.

## Bug #1: Subfolder Multi-Default Export Flattening

**Status**: ✅ **FIXED**

**Description**: Subfolder modules with both `export default {}` and named exports incorrectly flatten their named exports to the parent folder level instead of preserving the module namespace.

**Expected Behavior**:

- Subfolder modules with `export default {}` + named exports should create namespaced API structure
- Example: `utils/lifecycle.mjs` should create `api.utils.lifecycle.callAll()`
- Root-level modules with identical structure work correctly

**Fixed Behavior**:

- **Root modules**: `lifecycle.mjs` correctly creates `api.lifecycle.callAll()` ✅
- **Subfolder modules**: `utils/lifecycle.mjs` now correctly creates `api.utils.lifecycle.callAll()` ✅

**Impact**:

- Inconsistent API structure between root and subfolder modules
- Loss of module namespace organization in subfolders
- Potential naming conflicts when multiple subfolder modules export same function names
- Breaks expected file-to-API mapping conventions

**Root Cause**:
The issue was in `buildCategoryDecisions()` in `src/lib/helpers/api_builder.mjs`. The function was checking `!mod.default` to determine flattening behavior, but `processModuleFromAnalysis()` removes the `.default` property from processed modules with object default exports (like `export default {}`). This caused modules with `export default {}` + named exports to be incorrectly identified as having no default export and flattened inappropriately.

**Fix Applied**:

- **File**: `src/lib/helpers/api_builder.mjs`
- **Change**: Updated `buildCategoryDecisions()` to use `!analysis.hasDefault` instead of `!mod.default`
- **Lines**: 1758, 1762, 1770 - All `mod.default` checks replaced with `analysis.hasDefault` from original module analysis

**Test Verification**:

```bash
node tools/inspect-api-structure.mjs api_tv_test
# Verify fix:
# ✅ api.lifecycle.callAll() (root module - correct)
# ✅ api.utils.lifecycle.callAll() (subfolder module - now fixed)
```

**Test Case Structure**:

Both files have identical export structure:

```javascript
export async function callAll() {
	/* ... */
}
export function getModules() {
	/* ... */
}
export const methods = {
	/* ... */
};
export default {};
```

**Reproduction Steps**:

1. Create root-level module with `export default {}` + named exports → Works correctly
2. Create identical module in subfolder → Named exports flatten incorrectly to parent level
3. Use inspect tool to observe API structure differences

**Resolution**:
Fixed by updating `buildCategoryDecisions()` to use original module analysis data (`analysis.hasDefault`) instead of checking the processed module's `.default` property. This ensures consistent behavior between root and subfolder modules with identical export patterns.

---

_Last updated: October 30, 2025_
