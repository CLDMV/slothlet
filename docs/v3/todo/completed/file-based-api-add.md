# File-Based api.add() Feature

**Status:** ✅ COMPLETED  
**Implementation Date:** 2026-02-13  
**Test Coverage:** 19 tests in `tests/vitests/suites/addapi/add-api-files.test.vitest.mjs`

---

## Feature Summary

The `api.slothlet.api.add()` method now supports both directory and file-based loading, including arrays of mixed paths. This enables selective module loading, dynamic single-file plugins, and more flexible runtime module injection.

### What Was Implemented

1. **Single File Loading**: Load individual `.mjs`, `.cjs`, or `.js` files
2. **Array Support**: Pass arrays of files and/or directories
3. **Smart File Filtering**: fileFilter mechanism prevents loading entire directory when targeting single file
4. **Export Flattening**: Single file exports are flattened to avoid unnecessary nesting
5. **Full Feature Support**: Honors collision settings, metadata, ownership tracking, and all existing api.add() behavior
6. **Relative Path Support**: Works with relative paths, absolute paths, and file:// URLs

### Test Coverage

**File:** `tests/vitests/suites/addapi/add-api-files.test.vitest.mjs`  
**Status:** ✅ Added to baseline (all 19 tests passing)  
**Total Baseline Tests:** 2683 tests across 39 test files

**Test Categories:**
- Single file loading (.mjs, .cjs, .js)
- Array of files and directories
- Mixed file and directory loading
- Collision modes (error, merge, replace)
- Ownership tracking and module IDs
- Metadata support
- Edge cases (empty arrays, invalid paths, nested paths, relative paths)

---

## Usage Examples

```javascript
// Single file (relative path)
await api.slothlet.api.add("math", "./plugins/math.mjs");

// Single file (absolute path)
await api.slothlet.api.add("auth", "/path/to/auth.mjs");

// Array of files
await api.slothlet.api.add("utils", [
  "./plugins/helpers.mjs",
  "./plugins/validators.mjs"
]);

// Mixed files and directories
await api.slothlet.api.add("mixed", [
  "./plugins/auth.mjs",
  "./lib/utilities"
]);

// With metadata and options
await api.slothlet.api.add("module", "./plugins/feature.mjs", {
  metadata: { version: "1.0", author: "team" }
});

// Nested namespace with single file
await api.slothlet.api.add("nested.deep.path", "./plugins/module.mjs");
// Creates: api.nested.deep.path.exports...
```

## Implementation Details

### Core Changes

**api-manager.mjs:**
- `resolvePath()` method: Detects files vs directories using fs.stat()
- Array handling: Processes multiple paths sequentially
- File filter creation: Filters specific file when loading from directory
- Export flattening: Removes extra nesting for single file exports

**Pipeline Integration:**
- builder.mjs: Propagates fileFilter parameter
- eager.mjs: Passes fileFilter to loader
- lazy.mjs: Passes fileFilter to loader  
- loader.mjs: Applies fileFilter and skips subdirectories when active

### Path Resolution

Uses `resolvePathFromCaller()` which:
1. Resolves relative paths from caller's location
2. Falls back to current working directory
3. Supports absolute paths and file:// URLs
4. Works identically for both files and directories

---

## How to Run Tests Properly

**⚠️ IMPORTANT: Always tail test output (last 40 lines):**
```powershell
npm run debug 2>&1 | Select-Object -Last 40
npm run baseline 2>&1 | Select-Object -Last 40
```

**🧪 Run a single test file:**
```bash
npm run vitest <file>
```
Example:
```bash
npm run vitest tests/vitests/suites/context/per-request-context.test.vitest.mjs
```

**Why tail?**
- ❌ **WRONG:** Running without tailing shows the START of output, not results
- ✅ **CORRECT:** Tailing last 40 lines shows the RESULTS at the end

**📋 When file-based api.add() tests pass 100%:**
- Add related test files to `tests/vitests/baseline-tests.json`
- But ONLY if `npm run debug` AND `npm run baseline` both pass
- This ensures we catch regressions in working tests immediately

---

## Original Requirements (Archive)

This section preserved for historical context.

### Original Limitation (Resolved)

Previously, `api.slothlet.api.add()` only accepted directory paths and loaded all modules from that directory. There was no way to add a single file module to the API dynamically.

## Original Proposed Feature (Now Implemented)

Add support for file-based `api.add()` to allow adding individual module files to the API at runtime.

### Use Cases

1. **Selective module loading**: Load only specific modules without needing to organize them into separate directories
2. **Dynamic single-file plugins**: Add single-file plugins or extensions without directory structure requirements
3. **Testing**: Easier to test collision scenarios with individual files
4. **Runtime module injection**: Inject specific module files based on runtime conditions

### API Design

```javascript
// Current (directory-based)
await api.slothlet.api.add("namespace", "./path/to/directory");

// Proposed (file-based)
await api.slothlet.api.add("namespace", "./path/to/module.mjs");
await api.slothlet.api.add("namespace", "./path/to/module.cjs");

// Auto-detect based on path
if (path.endsWith('.mjs') || path.endsWith('.cjs') || path.endsWith('.js')) {
    // Load as single file
} else {
    // Load as directory (current behavior)
}
```

### Implementation Considerations

1. **Path Detection**: Check if path is a file or directory using `fs.stat()`
2. **Module Loading**: Use existing module loading logic but skip directory traversal
3. **Namespace Assignment**: File should be loaded into the specified namespace
4. **Collision Handling**: Should respect `collision.addApi` configuration
5. **Ownership**: Register ownership for the loaded module
6. **Error Handling**: Clear errors for missing files vs missing directories

### Implementation Notes

All implementation considerations from the original proposal were successfully addressed:

1. ✅ **Path Detection**: Uses `fs.stat()` to detect files vs directories
2. ✅ **Module Loading**: Reuses existing module loading logic with fileFilter optimization
3. ✅ **Namespace Assignment**: Files are correctly loaded into specified namespace
4. ✅ **Collision Handling**: Fully respects `collision.addApi` configuration (error, merge, replace)
5. ✅ **Ownership**: Properly registers ownership for loaded modules
6. ✅ **Error Handling**: Clear errors for missing files vs missing directories

### Status Update

~~**Priority:** Medium - Not blocking but would improve API flexibility and testing capabilities.~~

**Completed:** 2026-02-13  
**Result:** Feature is fully implemented, tested, and integrated into baseline test suite.

---

## Related Test Files

**Primary Test File:** `tests/vitests/suites/addapi/add-api-files.test.vitest.mjs`  
- ✅ Added to baseline-tests.json
- 19 comprehensive tests covering all scenarios
- All tests passing as of 2026-02-13

**Related Test Files Using This Feature:**
- `tests/vitests/suites/addapi/add-api.test.vitest.mjs` - Can now use file-based loading
- `tests/vitests/suites/config/collision-config.test.vitest.mjs` - Collision testing simplified

---

## Related Issues (Resolved)

- ✅ Tests in `tests/vitests/suites/config/collision-config.test.vitest.mjs` can now use file-based loading
- ✅ Collision testing is now simpler with file-based loading
- ✅ No more `INVALID_CONFIG_DIR_INVALID` errors when attempting to load single files
