# Slothlet Bugs

This document tracks identified bugs in the slothlet codebase.

## Bug #1: Empty Folders Wrapped as Lazy Functions

**Status**: 🐛 **IDENTIFIED - NOT FIXED**

**Description**: In lazy mode, empty folders are incorrectly wrapped as lazy functions instead of being resolved immediately to empty objects.

**Expected Behavior**:

- Empty folders should resolve to `{}` in both EAGER and LAZY modes
- No difference in behavior between modes for empty folders

**Current Behavior**:

- **EAGER Mode**: `empty: {}` (correct)
- **LAZY Mode**: `empty: [Function: lazyFolder_empty]` (incorrect - should be `{}`)

**Impact**:

- Inconsistent API behavior between modes
- Empty folders require function call in lazy mode: `await api.empty()` vs direct access `api.empty`
- Breaks API consistency expectations

**Root Cause**:
Lazy mode treats all folders as potential lazy-loadable modules, even when they contain no files. The empty folder detection (`processingStrategy = "empty"`) happens during analysis but lazy mode still wraps it as a function.

**Source Code Location**:

- **Detection**: `src/lib/helpers/api_builder.mjs` lines 318-319 (correctly identifies empty folders)
- **Bug Location**: Lazy mode folder processing (likely in lazy mode generation logic)

**Test Verification**:

```bash
node tests/debug-slothlet.mjs
# EAGER: empty: {} (correct)
# LAZY:  empty: [Function: lazyFolder_empty] (bug - should be {})
```

**Test Case**:

- Create empty folder: `api_tests/api_test/empty/` (no .mjs files)
- Load API in both modes
- Compare `api.empty` behavior

**Reproduction Steps**:

1. Create empty folder in API test directory
2. Load slothlet in lazy mode
3. Observe `api.empty` is a function instead of empty object
4. Compare with eager mode where `api.empty` is correctly `{}`

**Fix Required**:
Lazy mode should check `processingStrategy === "empty"` and immediately resolve to `{}` instead of wrapping as lazy function.

---

_Last updated: October 26, 2025_
