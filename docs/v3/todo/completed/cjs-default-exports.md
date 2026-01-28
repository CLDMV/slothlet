# CJS Default Export Handling Issue

## Status
✅ **COMPLETED** - January 28, 2026

## Priority
Medium - Affects CommonJS interoperability

## Issue Description

CommonJS modules are currently exposing a `.default` property in the API structure when they should be treated equivalently to ESM `export default`.

### Current Behavior (Incorrect)
```javascript
// CJS module: math-cjs.cjs
module.exports = {
    multiply: (a, b) => a * b,
    divide: (a, b) => a / b
};

// Results in API structure:
api.mathCjs.default.multiply(2, 3)  // ❌ Should not have .default
api.mathCjs.default.divide(6, 2)
```

### Expected Behavior
```javascript
// Should be treated like ESM default export:
api.mathCjs.multiply(2, 3)  // ✅ Direct access, no .default
api.mathCjs.divide(6, 2)
```

## Root Cause

The loader's `extractExports()` method is not normalizing CJS `module.exports` to behave identically to ESM `export default`. When a CJS module is imported, Node.js wraps it as `{ default: <module.exports> }`, and slothlet is exposing this wrapper structure instead of unwrapping it.

## Impact

- **API Inconsistency**: CJS and ESM modules have different access patterns
- **Developer Confusion**: Users must remember which modules are CJS vs ESM
- **Migration Pain**: Converting CJS to ESM breaks API paths
- **Metadata Access**: Properties under `.default` (like `api.mathCjs.default.multiply`) don't have individual metadata since they're nested properties, not top-level wrappers. Only the file-level wrapper (`api.mathCjs`) has metadata.

## Solution Approach

### Option 1: Normalize in Loader (Recommended)
Update `src/lib/processors/loader.mjs` `extractExports()` to detect when:
- A module has only a `default` export
- The `default` export is an object with additional properties
- No other named exports exist

In these cases, flatten the structure by treating `default` properties as top-level exports.

### Option 2: Normalize in Modes Processor
Add logic in `modes-processor.mjs` to detect `.default` wrapper pattern and unwrap it during API construction.

## Testing Requirements

1. **Unit Tests**: Verify CJS and ESM modules with identical exports produce identical API structures
2. **Integration Tests**: Test mixed CJS/ESM codebases
3. **Edge Cases**:
   - CJS with `module.exports.default = ...` (explicit default)
   - CJS with both `module.exports` and `module.exports.someProperty`
   - Hybrid exports (default + named)

## Related Files

- `src/lib/processors/loader.mjs` - Export extraction logic
- `src/lib/builders/modes-processor.mjs` - API structure building
- `api_tests/api_test_cjs/` - CJS test modules
- `api_tests/api_test_mixed/` - Mixed CJS/ESM test modules

## Discovered During

Metadata system implementation (Phase 4) - noticed `api.mathCjs.default.*` pattern in moduleID dump showing CJS modules exposing unnecessary `.default` layer.

## Notes

- This issue was not caught earlier because most testing focused on ESM modules
- The `.default` wrapper is technically correct per Node.js CJS/ESM interop, but creates poor DX
- Need to ensure fix doesn't break legitimate use of a property named "default"

## Implementation Summary

**Completed: January 28, 2026**

### Changes Made

1. **src/lib/processors/loader.mjs** (~lines 157-195):
   - Added filtering of "module.exports" key from named exports
   - Implemented CJS default normalization to unwrap nested `.default` pattern
   - Handles pattern: `module.exports = { default: X, namedExport: fn }` → normalizes to match ESM behavior

2. **src/lib/builders/modes-processor.mjs**:
   - Lines ~261-287: Added object default handling in main processing path to merge named exports onto default objects
   - Lines ~820-835: Extended flattening path to handle object defaults (not just function defaults)
   - Line ~669: Changed to use `moduleContent` directly instead of `cloneWrapperImpl()` to preserve added properties
   - Line ~844: Changed to use `implToWrap` directly instead of cloning for flattening path

3. **tests/vitests/suites/cjs/cjs-default-exports.test.vitest.mjs** (NEW):
   - Created comprehensive test suite with 64 tests (8 test cases × 8 config combinations)
   - Tests CJS pattern `module.exports = { default: obj, namedFn: fn }`
   - Verifies no extra .default layer, all properties accessible, correct typeof, function name preservation
   - Added to baseline-tests.json and TEST-STATUS.md

### Key Insights

- Node.js wraps CJS as `{ default: { default: X, namedExport: fn }, namedExport: fn }` for modules using the ESM-style pattern
- The `extractExports()` unwraps this to `{ default: X, namedExport: fn }` matching ESM behavior
- Two separate code paths needed fixing: main processing and flattening
- Both paths now add named exports to object defaults and avoid cloning (which stripped added properties)
- UnifiedWrapper's `_adoptImplChildren()` reads keys at construction time, so named exports must be added BEFORE wrapper creation

### Test Results

✅ All 64 tests pass across matrix configurations (EAGER/LAZY × ASYNC/LIVE × HOOKS/NO-HOOKS)
✅ All 1296 baseline tests continue to pass
