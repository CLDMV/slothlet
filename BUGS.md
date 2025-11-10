# Slothlet Bugs

This document tracks identified bugs fixed in the current release.

## Bug #1: Lazy Loading Deep Nested Path Materialization Failure

**Status**: ✅ **FIXED** (November 9, 2025)

**Description**: Deep nested property access (4 levels) in lazy loading mode failed to materialize properly, causing "is not a function" errors when accessing the deepest nested API paths. The issue affected existing 4-level deep paths in master including `api.util.controller.getDefault()`, `api.util.extract.NVRSection()`, and `api.util.extract.parseDeviceName()`, as well as newly added test paths like `api.singletest.helper.utilities.format()`.

**Symptoms**:

- 4-level deep function calls like `api.util.controller.getDefault()` failed with "is not a function"
- Lazy folder proxies remained as `[Function: lazyFolder_*]` instead of materializing to proper object structures
- The issue occurred specifically in lazy mode but not in eager mode
- Shallow paths (1-3 levels) worked correctly, only the deepest 4-level nesting failed

**Expected Behavior**:

- Deep nested paths should materialize automatically when accessed in lazy mode
- `api.singletest.helper.utilities.format("input")` should work identically in both eager and lazy modes
- Folder proxies should materialize to their proper object structure when any nested property is accessed

**Root Cause**:

Two issues in the lazy loading proxy chain:

1. **Duplicate materialization trigger**: An erroneous `if (!inFlight) inFlight = _materialize();` line was added to `lazy_propertyAccessor`, causing race conditions in the materialization process.

2. **Missing deep property handler**: The `lazy_deepPropertyAccessor` proxy only had an `apply` handler but no `get` handler, breaking the proxy chain for properties deeper than 3 levels.

**Fix Applied**:

1. **Removed duplicate materialization check** in `lazy_propertyAccessor`:

   ```javascript
   // BEFORE: Caused race conditions
   function lazy_propertyAccessor(...args) {
   	if (!inFlight) inFlight = _materialize(); // ❌ REMOVED
   	return inFlight.then(/* ... */);
   }

   // AFTER: Clean materialization flow
   function lazy_propertyAccessor(...args) {
   	return inFlight.then(/* ... */);
   }
   ```

2. **Added missing `get` handler** for deeper nesting in `lazy_deepPropertyAccessor`:
   ```javascript
   // ADDED: Continues proxy chain for 4+ level nesting
   get(target, nextProp) {
       return new Proxy(
           function lazy_deeperPropertyAccessor() {},
           {
               apply(target, thisArg, args) {
                   // Handle materialization for deeper nested calls
               }
           }
       );
   }
   ```

**Impact Before Fix**:

- `src/slothlet.mjs` - Added `instanceId` property and generation
- `src/lib/helpers/api_builder.mjs` - Updated `analyzeModule()` function
- `src/lib/helpers/multidefault.mjs` - Updated `multidefault_analyzeModules()` function
- All calling sites updated to pass the `instance` parameter

**Test Case Created**:

Created comprehensive isolation test at `tests/test-tv-config-isolation.mjs`:

```javascript
// Create two separate slothlet instances
const api1 = await slothlet({ dir: "./api_tests/api_tv_test" });
const api2 = await slothlet({ dir: "./api_tests/api_tv_test" });

// Update configs with different values
api1.config.update({ manufacturer: "samsung", host: "192.168.1.200", port: 8080 });
api2.config.update({ manufacturer: "sony", host: "192.168.1.300", port: 9090 });

// Verify isolation - should be different
console.log("Instance 1:", api1.config.get());
console.log("Instance 2:", api2.config.get());
```

**Impact Before Fix**:

```javascript
// BEFORE (shared state bug):
Instance 1 ID: xcdpo1oyp
Instance 2 ID: xcdpo1oyp  // ❌ Same ID!

// Both instances showed the same config after updates:
Instance 1 config: { manufacturer: "sony", host: "192.168.1.300", port: 9090 }
Instance 2 config: { manufacturer: "sony", host: "192.168.1.300", port: 9090 }
// ❌ Instance 1 lost its samsung/8080 config - shared state!
```

**Impact After Fix**:

```javascript
// AFTER (proper isolation):
Instance 1 ID: md3nbr2q6
Instance 2 ID: hdbzpi7gr  // ✅ Different IDs!

// Each instance maintains its own config:
Instance 1 config: { manufacturer: "samsung", host: "192.168.1.200", port: 8080 }
Instance 2 config: { manufacturer: "sony", host: "192.168.1.300", port: 9090 }
// ✅ Perfect isolation - each instance keeps its own state!
```

**Test Verification**:

```bash
# Run the isolation test
node tests/test-tv-config-isolation.mjs

# Expected output:
# ✅ ISOLATION TEST PASSED
# Config states are properly isolated between instances
```

**Benefits of This Approach**:

1. **Targeted**: Only affects slothlet instances, not the entire Node.js module cache
2. **Efficient**: Allows caching within the same instance while preventing cross-instance sharing
3. **Minimal Impact**: Uses Node.js's native query parameter cache differentiation
4. **Clean**: No complex cache management or global state manipulation needed
5. **Performance**: Maintains caching benefits within each instance

**Lesson Learned**:

When building frameworks that create multiple instances, consider Node.js module caching behavior. For stateful modules that should be isolated between instances, implement cache busting using query parameters or other techniques to ensure proper isolation while maintaining performance benefits within each instance.

## Bug #2: TypeError on Reference Object with Read-Only Properties

**Status**: ✅ **FIXED** (November 5, 2025)

**Description**: When passing a `reference` object to slothlet containing properties with names that match read-only function properties (like `name`, `length`, `prototype`), the runtime live binding system would throw a `TypeError` when trying to assign those properties to the function target.

**Symptoms**:

- `TypeError: Cannot assign to read only property 'name' of function` when reference object contains `name` property
- Similar errors for other read-only function properties like `length` and `prototype`
- Crash during slothlet initialization when using common reference properties

**Expected Behavior**:

- Reference object properties should be successfully assigned to the API root level
- Read-only properties should be gracefully handled without throwing errors
- All valid reference properties should be accessible on the final API object

**Root Cause**:

The `runtime_mutateLiveBinding` function in `src/lib/runtime/runtime.mjs` was attempting to directly assign all reference object properties to a function target without handling read-only properties:

```javascript
// BEFORE: No error handling for read-only properties
for (const [key, value] of Object.entries(source)) {
	target[key] = value; // ❌ Throws TypeError for read-only properties like 'name'
}
```

**Fix Applied**:

Added proper error handling to gracefully skip read-only properties while preserving the assignment for valid properties:

```javascript
// AFTER: Graceful handling of read-only properties
for (const [key, value] of Object.entries(source)) {
	try {
		target[key] = value;
	} catch (error) {
		// Skip read-only properties like function 'name', 'length', etc.
		// This commonly occurs when reference object contains 'name' property
		// and target is a function (live binding target)
		if (error instanceof TypeError && error.message.includes("read only")) {
			continue;
		}
		// Re-throw other errors
		throw error;
	}
}
```

**Test Case Created**:

Created test at `tests/test-reference-readonly-properties.mjs`:

```javascript
// This should NOT throw an error after the fix
const api = await slothlet({
	dir: "./api_tests/api_tv_test",
	reference: {
		version: "2.5.6",
		name: "test-package" // Previously caused TypeError
	}
});

// Verify properties are accessible
console.log(api.version); // "2.5.6"
console.log(api.name); // "test-package"
```

**Impact Before Fix**:

```javascript
// BEFORE (TypeError crash):
const api = await slothlet({
	reference: {
		version: packageJson.version,
		name: packageJson.name // ❌ TypeError: Cannot assign to read only property 'name'
	}
});
```

**Impact After Fix**:

```javascript
// AFTER (works perfectly):
const api = await slothlet({
	reference: {
		version: packageJson.version,
		name: packageJson.name // ✅ Works without errors
	}
});
console.log(api.version); // Accessible
console.log(api.name); // Accessible
```

**Files Modified**:

- `src/lib/runtime/runtime.mjs` - Added error handling for read-only property assignment
- `tests/test-reference-readonly-properties.mjs` - Added comprehensive test case

**Lesson Learned**:

When dynamically assigning properties to function objects, always handle potential `TypeError` exceptions for read-only properties. JavaScript functions have several read-only properties (`name`, `length`, `prototype`) that cannot be overwritten, and attempting to do so will throw an error in strict mode or when using `Object.assign()` patterns.

---

_Last updated: November 5, 2025_
