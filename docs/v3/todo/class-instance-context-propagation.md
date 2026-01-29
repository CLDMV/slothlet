# Class Instance Context Propagation

**Status:** ⚠️ **NOT IMPLEMENTED**  
**Priority:** 🔴 **HIGH** - Core feature for object-oriented API modules  
**Complexity:** MEDIUM - Requires proxy wrapping and method interception  
**Blocked By:** None - Per-request context system is complete  
**Ready To Implement:** ✅ YES

---

## Problem Statement

When API modules return class instances, those instances lose access to slothlet's context system. Methods on returned class instances cannot access `self`, `context`, or `reference` because they execute outside of slothlet's ALS/live binding scope.

### Example of the Problem

```javascript
// api/data-processor.mjs
import { self, context } from "@cldmv/slothlet/runtime";

class DataProcessor {
    constructor(config) {
        this.config = config;
    }

    process(data) {
        // ❌ V3: context is UNDEFINED here
        // ❌ V3: self is WRONG instance (or undefined)
        console.log(`Processing for user: ${context.user}`); // undefined!
        const validated = self.validator.check(data); // Error or wrong instance!
        return this.transform(validated);
    }

    transform(data) {
        // ❌ V3: Context still unavailable in nested methods
        return self.utils.format(data); // Error!
    }
}

export function createProcessor(config) {
    return new DataProcessor(config); // Returns unwrapped instance
}
```

### What Users Expect

```javascript
// Usage
const api = await slothlet({
    dir: "./api",
    context: { user: "alice", requestId: "req-123" }
});

const processor = api.createProcessor({ format: "json" });

// ✅ Should work: All methods should have full context
const result = processor.process({ data: "test" });
```

---

## V2 Implementation Reference

### Git History

**Commit:** `ebd8e7e` (v2.3.0) - "release: v2.3.0 - Add automatic class instance context preservation (#47)"  
**Date:** Thu Oct 16 16:26:19 2025 -0700

**V2 Implementation Location:** `src2/lib/runtime/runtime-asynclocalstorage.mjs`  
**Key Functions:**
- `runtime_isClassInstance(val)` - Lines 388-407
- `runtime_wrapClassInstance(instance, ctx, wrapFn, instanceCache)` - Lines 428-491
- Called from `makeWrapper()` apply trap (line 534) and construct trap (line 545)

### V2 Approach (Proven Working)

In V2, class instances were **automatically detected and wrapped** when returned from API functions via the `apply` and `construct` traps in the `makeWrapper()` proxy. Each method call was intercepted and wrapped with context restoration using a **dual-level caching system**.

**V2 Features Implemented:**
1. ✅ Smart class instance detection with systematic exclusion lists
2. ✅ Automatic method wrapping via Proxy to preserve context
3. ✅ Dual-level caching: instance-level (WeakMap) + method-level (Map per instance)
4. ✅ Complete context preservation through return values and fluent APIs
5. ✅ Support for both function returns and constructor calls (`new MyClass()`)
6. ✅ Cache-first property access optimization
7. ✅ Comprehensive built-in method exclusion (Object.prototype, symbols, `__` methods)
8. ✅ Method cache invalidation on property overwrites
9. ✅ Recursive return value wrapping to maintain context preservation chains

**V2 Exclusion Strategy:**
```javascript
const EXCLUDED_CONSTRUCTORS = new Set([
    Object, Array, Date, RegExp, Error, Map, Set, WeakMap, WeakSet,
    Promise, ArrayBuffer, DataView, Int8Array, Uint8Array, /* ... more typed arrays */
]);

const EXCLUDED_INSTANCEOF_CLASSES = [
    Buffer, /* Check typeof cls === "function" for environment safety */
];
```

**Why V3 Doesn't Have This:**
V3 is a **clean rewrite** that started from scratch with a new unified wrapper architecture. The class wrapping feature was NOT ported during the V2→V3 architecture flip (commit `586c209`). V2 (`src2/`) still has the working implementation.

---

## V3 Design Considerations

### Integration Points

**Where to implement:**
- **Option 1:** In unified-wrapper.mjs apply trap
  - Intercept function return values
  - Detect class instances
  - Wrap before returning to caller
  
- **Option 2:** In api_builder.mjs or runtime
  - Post-process function results
  - Check for class instances
  - Apply wrapping layer

### Detection Strategy

**V2's proven approach (from `runtime_isClassInstance`):**
```javascript
function isClassInstance(val) {
    // Quick null/type/constructor checks
    if (
        val == null ||
        typeof val !== "object" ||
        !val.constructor ||
        typeof val.constructor !== "function" ||
        EXCLUDED_CONSTRUCTORS.has(val.constructor)
    ) {
        return false;
    }

    // Check instanceof exclusions with environment safety
    for (const cls of EXCLUDED_INSTANCEOF_CLASSES) {
        if (typeof cls === "function" && val instanceof cls) {
            return false;
        }
    }

    return true; // It's a class instance that should be wrapped
}
```

**Key V2 Design Decisions:**
1. **Positive detection:** Assume class instance unless excluded
2. **Set-based exclusions:** O(1) constructor lookups
3. **Environment-safe instanceof:** Check `typeof cls === "function"` first
4. **No method counting:** Simpler, faster, handles empty classes

### Wrapping Strategy

**V2's proven approach (from `runtime_wrapClassInstance`):**
```javascript
function wrapClassInstance(instance, ctx, wrapFn, instanceCache) {
    // Check cache to avoid double-wrapping
    if (instanceCache.has(instance)) {
        return instanceCache.get(instance);
    }

    // Method cache per instance (not WeakMap - stored in closure)
    const methodCache = new Map();

    const wrappedInstance = new Proxy(instance, {
        get(target, prop, receiver) {
            // Cache-first to avoid repeated Reflect.get
            if (methodCache.has(prop)) {
                return methodCache.get(prop);
            }

            const value = Reflect.get(target, prop, receiver);

            // If it's a method that should be wrapped
            if (shouldWrapMethod(value, prop)) {
                const wrappedMethod = function(...args) {
                    // Execute with context and recursively wrap result
                    const result = runWithCtx(ctx, value, target, args);
                    return wrapFn(result); // Maintains context chain
                };

                methodCache.set(prop, wrappedMethod);
                return wrappedMethod;
            }

            // For non-methods, recursively wrap if needed
            return wrapFn(value);
        },

        set(target, prop, value, receiver) {
            // Invalidate method cache on property overwrite
            if (methodCache.has(prop)) {
                methodCache.delete(prop);
            }
            return Reflect.set(target, prop, value, receiver);
        }
    });

    // Cache wrapped instance
    instanceCache.set(instance, wrappedInstance);
    return wrappedInstance;
}
```

**V2 Key Features:**
1. **Dual caching:** Instance-level WeakMap + per-instance method Map
2. **Cache-first access:** Avoids Reflect.get on repeated access
3. **Recursive wrapping:** `wrapFn(result)` maintains context through chains
4. **Cache invalidation:** Handles dynamic property changes
5. **Method filtering:** `shouldWrapMethod()` excludes constructor, Object.prototype methods, `__` methods

### Performance Considerations

1. **Method caching:** Wrap each method once, cache the wrapper
2. **Lazy detection:** Only check return values from API functions
3. **Minimal overhead:** Use efficient instanceof/prototype checks
4. **Skip primitives:** Fast-path for non-objects

---

## Implementation Plan

### Phase 1: Detection and Wrapping (Core)

1. Add `isClassInstance()` helper function
2. Add `wrapClassInstance()` function in appropriate location
3. Intercept API function return values (in apply trap or post-processing)
4. Apply wrapping when class instance detected
5. Ensure nested method calls work correctly

### Phase 2: Testing

1. Create test API module with class-based exports
2. Test basic class instance method calls
3. Test nested method calls (methods calling methods)
4. Test async methods (Promise-returning methods)
5. Test context.get() and self access within methods
6. Test with both async and live runtime modes
7. Test cleanup on shutdown

### Phase 3: Edge Cases

1. Handle classes with getters/setters
2. Handle classes with private fields (#privateField)
3. Handle inherited methods (prototype chain)
4. Handle bound methods (this binding)
5. Handle async generators and iterators
6. Handle classes that return other class instances

---

## Test Requirements

### Basic Class Instance Test

```javascript
// api_tests/api_test/class-instance.mjs
import { self, context } from "@cldmv/slothlet/runtime";

class Calculator {
    constructor(multiplier) {
        this.multiplier = multiplier;
    }

    add(a, b) {
        // Should have context access
        const user = context.user;
        return (a + b) * this.multiplier;
    }

    callOtherModule(value) {
        // Should have self access
        return self.math.double(value);
    }
}

export function createCalculator(multiplier) {
    return new Calculator(multiplier);
}
```

### Test Suite Structure

```javascript
describe("Class Instance Context Propagation", () => {
    test("Context available in class methods", async () => {
        const api = await slothlet({
            dir: TEST_DIRS.API_TEST,
            context: { user: "test-user" }
        });
        
        const calc = api.createCalculator(2);
        const result = calc.add(5, 3); // Should not throw
        expect(result).toBe(16); // (5+3)*2
        
        await api.shutdown();
    });
    
    test("Self access in class methods", async () => {
        const api = await slothlet({
            dir: TEST_DIRS.API_TEST
        });
        
        const calc = api.createCalculator(1);
        const result = calc.callOtherModule(5); // Calls self.math.double(5)
        expect(result).toBe(10);
        
        await api.shutdown();
    });
    
    test("Nested method calls preserve context", async () => {
        // Test methods calling other methods on same instance
    });
    
    test("Async methods work correctly", async () => {
        // Test Promise-returning methods
    });
});
```

---

## Related Issue: User-Defined Proxy Objects

**Note:** This feature also affects user-defined Proxy objects returned from API functions. When an API function returns a Proxy object (not a class instance), the Proxy's get handler and any methods it returns will also lose context.

**Discovered:** 2026-01-29 via test script `tmp/test-proxy-runtime-context.mjs`

**Example:**
```javascript
// api/proxy-test.mjs
import { context, self } from "@cldmv/slothlet/runtime";

export function getProxy() {
    // ✅ Context available INSIDE function
    console.log("getProxy context:", context); // Works!
    
    return new Proxy({
        value: "test",
        method() {
            // ❌ V3: context unavailable here - proxy method executed outside ALS scope
            console.log(context.user); // Error: No active context!
        }
    }, {
        get(target, prop) {
            // ❌ V3: context unavailable in get handler - executed after function returns
            console.log("Accessing", prop, "for user", context.user); // Error!
            return target[prop];
        }
    });
}
```

**Test Output:**
```
→ getProxy() called
→ context in getProxy: {"appName":"test-app","version":"1.0"}  ✅

→ Proxy get handler for "value"
→ ERROR: No active context  ❌

→ Calling proxyObj.method()
→ ERROR: No active context  ❌
```

**Why This Happens:**
1. API function (`getProxy()`) executes **within** ALS context - context available
2. Function returns Proxy object to caller
3. Caller accesses properties/methods **outside** ALS context - context lost
4. Proxy get handlers and methods execute in caller's scope, not slothlet scope

**Solution:** The same wrapping approach works for Proxy objects - they're just objects with methods. The class instance wrapper will handle them automatically since Proxy objects pass the `isClassInstance` check (they have constructors and methods).

**Related Test Files:**
- `tmp/test-proxy-runtime-context.mjs` - Demonstrates the issue
- `tmp/test-proxy-context.mjs` - Shows load-time vs runtime context access
- `api_tests/api_tv_test/proxy-test.mjs` - User Proxy example (doesn't use context)
- `tests/vitests/suites/proxies/proxy-baseline.test.vitest.mjs` - Tests Proxy behavior

See related todo: [proxy-context-propagation.md](./proxy-context-propagation.md)

---

## Key Questions to Resolve

1. **Where to intercept?**
   - In unified-wrapper apply trap?
   - In api_builder after function execution?
   - In a dedicated class wrapper component?

2. **How to handle live mode?**
   - Live bindings don't use ALS
   - Need different strategy for context restoration?
   - Or does it "just work" because of binding magic?

3. **Cleanup strategy?**
   - Track wrapped instances for shutdown cleanup?
   - Or rely on GC and WeakMap?

4. **Performance impact?**
   - How much overhead does method interception add?
   - Need benchmarks comparing wrapped vs unwrapped

---

## Documentation Requirements

Once implemented:
1. Update `docs/CONTEXT-PROPAGATION.md` with V3-specific details
2. Add examples to README
3. Create changelog entry
4. Add JSDoc to wrapping functions
5. Update TypeScript definitions if needed

---

## Success Criteria

- ✅ Class instances returned from API functions automatically wrapped
- ✅ `context` accessible in all class methods
- ✅ `self` accessible in all class methods
- ✅ Nested method calls work correctly
- ✅ Async methods work correctly
- ✅ Works in both async and live runtime modes
- ✅ Minimal performance overhead
- ✅ Full test coverage
- ✅ Clean shutdown (no memory leaks)

---

## Related

- [Per-Request Context Isolation](./completed/per-request-context-isolation.md) - Context system foundation (COMPLETED)
- [EventEmitter Context Propagation](./eventemitter-context-propagation.md) - Similar wrapping challenge
- [Proxy Context Propagation](./proxy-context-propagation.md) - User-defined Proxy objects (handled by this feature)
- [CONTEXT-PROPAGATION.md](../../CONTEXT-PROPAGATION.md) - User-facing documentation
