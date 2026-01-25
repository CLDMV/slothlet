# CJS Default Export Handling Issue

## Status
🔴 **OPEN** - Not yet implemented

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
