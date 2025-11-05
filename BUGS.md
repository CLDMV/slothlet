# Slothlet Bugs

This document tracks identified bugs in the slothlet codebase.

## Bug #1: Lazy Mode Custom Proxy Detection

**Status**: ✅ **FIXED**

**Description**: The lazy mode was using error-prone custom proxy detection logic instead of the reliable Node.js built-in `util.types.isProxy()` method that was already being used in other parts of the codebase.

**Symptoms**:

- Empty folders were incorrectly identified as custom Proxy objects in lazy mode
- Inconsistent behavior between eager and lazy modes for empty folder handling
- Precommit validation failures due to `nested.empty` showing as `function` in lazy mode vs `{}` in eager mode
- Potential false positives/negatives in proxy detection affecting custom proxy objects like LGTVControllers

**Expected Behavior**:

- Empty folders should consistently return `{}` (empty object) in both eager and lazy modes
- Custom Proxy objects (like LGTVControllers with array access `lg[0]`) should be properly detected and preserve their behavior
- Both modes should use the same reliable proxy detection method

**Root Cause**:

The lazy mode (`src/lib/modes/slothlet_lazy.mjs`) was using custom proxy detection logic that tested random property access:

```javascript
// Error-prone custom detection (BEFORE)
const testKey = "__slothlet_proxy_test_" + Math.random();
const directAccess = value[testKey];
const hasNoOwnProps = Object.getOwnPropertyNames(value).length === 0;
const respondsToAccess = directAccess !== undefined || hasNoOwnProps;

if (respondsToAccess && hasNoOwnProps) {
	isCustomProxy = true; // ❌ Empty objects incorrectly identified as proxies
}
```

Meanwhile, `slothlet.mjs` and `api_builder.mjs` were correctly using:

```javascript
// Reliable Node.js built-in (CORRECT)
const isProxy = utilTypes?.isProxy?.(defaultExport) ?? false;
```

**Fix Applied**:

1. **Added proper import** to lazy mode:

   ```javascript
   import { types as utilTypes } from "node:util";
   ```

2. **Replaced custom proxy detection** with reliable built-in:

   ```javascript
   // Replaced error-prone custom logic with:
   const isCustomProxy = value && typeof value === "object" && utilTypes?.isProxy?.(value);
   ```

3. **Files Modified**:
   - `src/lib/modes/slothlet_lazy.mjs` - Lines 157 (import) and 363-383 (detection logic)

**Impact Before Fix**:

- Empty folders in nested directories (`nested/empty`) returned `function` in lazy mode instead of `{}`
- Precommit validation failed due to inconsistent empty folder handling between modes
- Potential reliability issues with custom proxy object detection

**Impact After Fix**:

- ✅ Consistent empty folder handling: both modes return `{}` for empty directories
- ✅ Reliable proxy detection using Node.js built-in method across entire codebase
- ✅ Precommit validation passes with consistent behavior between modes
- ✅ Custom proxy objects (LGTVControllers) maintain proper behavior in both modes

**Test Verification**:

```bash
# Test empty folder consistency
node -e "import slothlet from './index.mjs'; const api = await slothlet({ dir: './api_tests/api_test' }); console.log('nested.empty type before access:', typeof api.nested.empty); console.log('nested.empty after access:', api.nested.empty);"
# Result: nested.empty type before access: object, nested.empty after access: {}

# Test proxy behavior preservation
node -e "import slothlet from './index.mjs'; const api = await slothlet({ dir: './api_tests/api_tv_test', lazy: true }); console.log('lg[0]:', api.devices.lg[0]); console.log('lg.clearCache:', typeof api.devices.lg.clearCache);"
# Result: Custom proxy behavior preserved correctly

# Precommit validation
npm run precommit
# Result: All 6 validation steps pass ✅
```

**Lesson Learned**:

Always use Node.js built-in utilities for standard detection operations rather than implementing custom logic. The `util.types.isProxy()` method provides definitive proxy detection that's reliable across all Node.js environments and edge cases.

---

_Last updated: November 4, 2025_
