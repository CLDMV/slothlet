# Slothlet Bugs

This document tracks identified bugs in the slothlet codebase.

## Bug #1: Module Cache Isolation Between Slothlet Instances

**Status**: ✅ **FIXED** (November 5, 2025)

**Description**: Multiple slothlet instances were sharing the same imported module objects due to Node.js module caching, causing configuration and state to be shared between different slothlet instances when they should have been isolated.

**Symptoms**:

- Configuration updates in one slothlet instance affected all other instances
- Shared state between different slothlet instances loading the same API directory
- Instance IDs were identical across different slothlet instances
- Cross-contamination of instance-specific values and settings
- Breaking the fundamental expectation of instance isolation

**Expected Behavior**:

- Each slothlet instance should have its own isolated copy of imported modules
- Configuration updates in one instance should not affect other instances
- Instance-specific state should remain isolated between different slothlet instances
- Each instance should maintain its own unique identity and configuration

**Root Cause**:

Node.js module caching was causing the same module objects to be reused across different slothlet instances. When slothlet imported modules using:

```javascript
// BEFORE: Shared module imports
const rawModule = await import(moduleUrl);
```

All slothlet instances loading the same file path would get the exact same module object from Node.js cache, including any stateful objects within those modules.

**Fix Applied**:

1. **Added unique instance ID generation** to each slothlet instance:

   ```javascript
   // Generate unique instance ID for cache isolation between different slothlet instances
   this.instanceId = `slothlet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
   ```

2. **Implemented instance-based cache busting** using query parameters:

   ```javascript
   // Add instance-based cache busting to isolate imports between different slothlet instances
   let importUrl = moduleUrl;
   if (instance && instance.instanceId) {
   	const separator = moduleUrl.includes("?") ? "&" : "?";
   	importUrl = `${moduleUrl}${separator}slothlet_instance=${instance.instanceId}`;
   }

   const rawModule = await import(importUrl);
   ```

3. **Files Modified**:
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

---

_Last updated: November 5, 2025_
