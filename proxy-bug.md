# Slothlet Runtime Proxy Bug: Map/Set Prototype Method Incompatibility

## Bug Summary

The Slothlet runtime's AsyncLocalStorage proxy system corrupts native Map and Set objects by breaking their prototype method bindings. This causes `TypeError: Method Set.prototype.values called on incompatible receiver #<Set>` errors when trying to use standard Map/Set methods on proxied collections.

## Root Cause Analysis

**Problem Location**: `@cldmv/slothlet/dist/lib/runtime/runtime-asynclocalstorage.mjs`

**Core Issue**: When Slothlet wraps objects in proxies for context isolation, the proxy handlers corrupt the `this` binding for native Map and Set prototype methods. The proxied objects are no longer recognized as valid Map/Set instances by their own prototype methods.

**Technical Details**:

1. Slothlet creates proxies around HoldMyTask collections (`taskQueue.tasks` Map, `taskQueue.running` Set)
2. When code calls `proxiedSet.values()` or `proxiedMap.size`, the native prototype methods receive the proxy object as `this`
3. Native Map/Set methods validate that `this` is actually a Map/Set instance using internal slots
4. Proxy objects don't have these internal slots, causing "incompatible receiver" errors

## Error Stack Trace Pattern

```
TypeError: Method Set.prototype.values called on incompatible receiver #<Set>
    at Proxy.values (<anonymous>)
    at runtime_runInALS (file:///path/to/@cldmv/slothlet/dist/lib/runtime/runtime-asynclocalstorage.mjs:37:26)
    at AsyncLocalStorage.run (node:internal/async_local_storage/async_hooks:80:14)
    at runWithCtx (file:///path/to/@cldmv/slothlet/dist/lib/runtime/runtime-asynclocalstorage.mjs:40:13)
    at Object.apply (file:///path/to/@cldmv/slothlet/dist/lib/runtime/runtime-asynclocalstorage.mjs:160:20)
    at Function.from (<anonymous>)
```

## Current Exclusion System (Not Working)

Slothlet already has exclusion logic that SHOULD prevent this:

```javascript
const EXCLUDED_INSTANCEOF_CLASSES = [ArrayBuffer, Map, Set, WeakMap, WeakSet];

function runtime_isClassInstance(val) {
	// ... checks for exclusions
	for (const cls of EXCLUDED_INSTANCEOF_CLASSES) {
		if (typeof cls === "function" && val instanceof cls) {
			return false; // Should exclude Map/Set from proxying
		}
	}
	return true;
}
```

**The exclusion system exists but is being bypassed somewhere in the proxy creation chain.**

## Reproduction Test Case

```javascript
// Test file: test-slothlet-map-set-proxy-bug.mjs
import { createSlothlet } from "@cldmv/slothlet";

async function testMapSetProxyBug() {
	const slothlet = createSlothlet();

	// Create a module that exposes Map and Set collections
	const testModule = {
		myMap: new Map([
			["key1", "value1"],
			["key2", "value2"]
		]),
		mySet: new Set(["item1", "item2", "item3"])
	};

	// Add module to slothlet context (this will trigger proxying)
	slothlet.addModule("testModule", testModule);

	// Initialize and access the proxied collections
	await slothlet.init();
	const { testModule: proxiedModule } = slothlet.getModules();

	console.log("Testing Map methods:");
	try {
		console.log("Map size:", proxiedModule.myMap.size); // Should work
		console.log("Map keys:", Array.from(proxiedModule.myMap.keys())); // Should fail
	} catch (error) {
		console.error("Map error:", error.message);
		console.error("Stack:", error.stack);
	}

	console.log("\nTesting Set methods:");
	try {
		console.log("Set size:", proxiedModule.mySet.size); // Should work or fail
		console.log("Set values:", Array.from(proxiedModule.mySet.values())); // Should fail
	} catch (error) {
		console.error("Set error:", error.message);
		console.error("Stack:", error.stack);
	}
}

testMapSetProxyBug();
```

## Expected Behavior

1. Map and Set objects should be **excluded from proxying** entirely
2. Direct access to Map/Set collections should work without proxy interference
3. All native Map/Set methods (`.size`, `.values()`, `.keys()`, `.entries()`, etc.) should function normally
4. The existing `EXCLUDED_INSTANCEOF_CLASSES` exclusion should prevent Map/Set from being wrapped

## Actual Behavior

1. Map and Set objects are being proxied despite exclusion rules
2. Native prototype methods fail with "incompatible receiver" errors
3. Basic collection operations like `.size` and `.values()` are broken
4. The exclusion system is not preventing Map/Set proxying

## Fix Requirements

The Slothlet runtime needs to be fixed to:

1. **Properly enforce Map/Set exclusions** - Ensure `EXCLUDED_INSTANCEOF_CLASSES` actually prevents Map/Set from being proxied
2. **Fix proxy handler binding** - If Map/Set must be proxied, ensure native methods are properly bound to the original object
3. **Add proxy bypass for native methods** - Implement special handling for Map/Set prototype methods that preserves `this` binding
4. **Test coverage** - Add comprehensive tests for Map/Set collection handling in proxied contexts

## Immediate Workaround

For applications affected by this bug, the only current workaround is to:

1. Access raw Map/Set objects before they get proxied
2. Store references to unproxied collections
3. Use manual collection inspection instead of native methods

```javascript
// Workaround example
const rawMap = Object.getPrototypeOf(proxiedMap) === Map.prototype ? proxiedMap : null;
if (rawMap) {
	// Use rawMap with native methods
	const keys = Array.from(rawMap.keys());
}
```

## Impact Assessment

**Severity**: High - Breaks core JavaScript collection functionality
**Scope**: Any Slothlet application using Map/Set collections in modules
**Workaround Complexity**: High - Requires deep knowledge of proxy internals

## Test Validation Criteria

A successful fix should:

1. ✅ Allow all native Map methods (`.size`, `.keys()`, `.values()`, `.entries()`, `.get()`, `.set()`, `.has()`, `.delete()`)
2. ✅ Allow all native Set methods (`.size`, `.values()`, `.keys()`, `.entries()`, `.has()`, `.add()`, `.delete()`)
3. ✅ Preserve Map/Set iteration (`for...of`, `forEach()`, destructuring)
4. ✅ Maintain context isolation where needed without breaking native functionality
5. ✅ Pass existing Slothlet tests (no regressions)
6. ✅ Work with nested Map/Set collections and complex object graphs

This bug report provides a complete technical foundation for an agent to create comprehensive tests and implement a proper fix for the Slothlet proxy system.
