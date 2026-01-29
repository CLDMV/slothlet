# Proxy Context Propagation

**Status:** ⚠️ **NOT IMPLEMENTED** (Same root cause as Class Instance issue)  
**Priority:** 🟡 **MEDIUM** - Subset of class instance wrapping  
**Complexity:** LOW - Handled by class instance wrapper  
**Blocked By:** [class-instance-context-propagation.md](./class-instance-context-propagation.md)  
**Ready To Implement:** ⏸️ After class instance feature

---

## Problem Statement

When API modules return user-defined Proxy objects, those Proxy objects lose access to slothlet's context system. The Proxy's get/set handlers and any methods returned cannot access `self`, `context`, or `reference` because they execute outside of slothlet's ALS/live binding scope.

This is **the same root cause** as the class instance context propagation issue - objects returned from API functions lose context when their methods are called.

### History: Why This Test Exists

The `proxy-baseline.test.vitest.mjs` test was created in **v2.5.5** (Nov 2025) to validate a different proxy-related bug:

**Original Issue (v2.5.5):**
- Custom Proxy objects (like `LGTVControllers`) weren't being detected properly during flattening
- Proxy passthrough issues affected both lazy and eager modes
- `lg[0]` array-style access was failing because the Proxy's custom get handler was being lost

**Commits:**
- `22ffef8` - "Progress: Working proxy fix for lg[0] access - need empty folder refinement"
- `f0998c9` - "release: v2.5.5 - Fix proxy detection in both lazy and eager modes"
  - Fixed by using `util.types.isProxy()` for proper Proxy detection
  - Ensured Proxy objects maintain their custom behavior during flattening
  - Test validates that `lg[0]` (custom Proxy get handler) and `lg.getStatus()` (named export) both work

**What That Test Does NOT Cover:**
- Context availability in Proxy get handlers ❌
- Context availability in methods returned by Proxy ❌
- Context propagation for Proxy objects returned from functions ❌

The v2.5.5 bug was about **Proxy object preservation** during module loading. The current issue is about **context propagation** for returned Proxy instances - a completely different problem that requires the class instance wrapping solution.

---

## Example of the Problem

```javascript
// api/device-proxy.mjs
import { self, context } from "@cldmv/slothlet/runtime";

export function getDeviceProxy(deviceId) {
    console.log("Creating proxy for:", deviceId);
    console.log("Context user:", context.user); // ✅ Works here
    
    const device = {
        id: deviceId,
        status: "ready",
        
        getInfo() {
            // ❌ V3: context unavailable here
            console.log("Getting info for user:", context.user); // Error!
            return { id: this.id, user: context.user };
        }
    };
    
    return new Proxy(device, {
        get(target, prop) {
            // ❌ V3: context unavailable in get handler
            console.log(`[${context.user}] Accessing ${prop}`); // Error!
            
            const value = target[prop];
            if (typeof value === "function") {
                return value.bind(target);
            }
            return value;
        },
        
        set(target, prop, value) {
            // ❌ V3: context unavailable in set handler
            console.log(`[${context.user}] Setting ${prop} = ${value}`); // Error!
            target[prop] = value;
            return true;
        }
    });
}
```

### What Users Expect

```javascript
const api = await slothlet({
    dir: "./api",
    context: { user: "alice", sessionId: "sess-123" }
});

const device = api.getDeviceProxy("device-1");

// ✅ Should work: Proxy handlers should have context
device.status; // Get handler should log "[alice] Accessing status"
device.status = "busy"; // Set handler should log "[alice] Setting status = busy"
const info = device.getInfo(); // Method should have context.user
```

---

## Current Behavior (V3)

**Test:** `tmp/test-proxy-runtime-context.mjs`

```javascript
→ getProxy() called
→ context in getProxy: {"appName":"test-app","version":"1.0"}  ✅ Works inside function

→ Accessing proxyObj.value (this triggers get handler)
  → Proxy get handler for "value"
  → ERROR: No active context - function must be called within slothlet API context.  ❌

→ Calling proxyObj.method()
  → Proxy get handler for "method"
  → ERROR: No active context  ❌
  
  → method() called
  → ERROR: No active context  ❌
```

**Why This Happens:**
1. API function executes **within** ALS context ✅
2. Function creates Proxy and returns it ✅
3. **Caller receives unwrapped Proxy object** ❌
4. Proxy handlers execute in **caller's scope** (no context) ❌
5. Methods on Proxy execute in **caller's scope** (no context) ❌

---

## Solution

**Good News:** This is automatically solved by the class instance wrapping system!

User-defined Proxy objects are just regular objects that:
1. Have a constructor (Proxy)
2. Can have methods
3. Pass `isClassInstance()` checks

When the class instance wrapper detects a Proxy object returned from an API function, it will:
1. Wrap the Proxy in another Proxy
2. Intercept get/set operations
3. Execute handlers within the correct ALS context
4. Wrap returned methods to preserve context

**No separate implementation needed** - Proxy objects are handled by the class instance wrapping system.

---

## V2 Implementation

V2's `runtime_wrapClassInstance` function **already handled Proxy objects** because:
- Proxy objects are `typeof === "object"`
- They have constructors and methods
- They're not in the exclusion lists
- The wrapper intercepts their get/set operations

**V2 Code (src2/lib/runtime/runtime-asynclocalstorage.mjs lines 534-536):**
```javascript
// Auto-wrap returned class instances to preserve context for method calls
if (runtime_isClassInstance(result)) {
    return runtime_wrapClassInstance(result, ctx, wrap, instanceCache);
}
```

This catches **both** class instances **and** Proxy objects!

---

## Edge Cases to Consider

### 1. Proxy of Proxy

```javascript
export function getNestedProxy() {
    const inner = new Proxy({}, { ... });
    return new Proxy(inner, { ... });
}
```

**Solution:** The wrapper handles this naturally via recursive wrapping in `wrapFn(value)`.

### 2. Proxy with Revocable

```javascript
export function getRevocableProxy() {
    const { proxy, revoke } = Proxy.revocable({}, { ... });
    return { proxy, revoke };
}
```

**Solution:** The returned object has `proxy` and `revoke` properties. The `proxy` property would be wrapped when accessed.

### 3. Proxy Traps That Return Functions

```javascript
const proxy = new Proxy({}, {
    get(target, prop) {
        return function(...args) {
            // This returned function should also have context
        };
    }
});
```

**Solution:** The class instance wrapper's recursive wrapping (`wrapFn(value)`) handles returned functions automatically.

---

## Test Requirements

### Basic Proxy Test

```javascript
// api_tests/api_test/proxy-runtime.mjs
import { self, context } from "@cldmv/slothlet/runtime";

export function getProxy() {
    return new Proxy({
        value: "test-value",
        
        getValue() {
            return { value: this.value, user: context.user };
        }
    }, {
        get(target, prop) {
            console.log(`Accessing ${prop} for user ${context.user}`);
            return target[prop];
        }
    });
}
```

### Test Suite

```javascript
describe("Proxy Context Propagation", () => {
    test("Proxy get handler has context", async () => {
        const api = await slothlet({
            dir: TEST_DIRS.API_TEST,
            context: { user: "alice" }
        });
        
        const proxy = api.getProxy();
        const value = proxy.value; // Triggers get handler
        
        // Get handler should log "Accessing value for user alice"
        expect(value).toBe("test-value");
    });
    
    test("Methods on Proxy have context", async () => {
        const api = await slothlet({
            dir: TEST_DIRS.API_TEST,
            context: { user: "bob" }
        });
        
        const proxy = api.getProxy();
        const result = proxy.getValue();
        
        expect(result.user).toBe("bob");
    });
});
```

---

## Implementation Status

**Current State:** NOT IMPLEMENTED

**Blocker:** Waiting for class instance context propagation implementation

**Once Class Instance Wrapping is Complete:**
- ✅ Proxy objects automatically handled
- ✅ No additional code needed
- ✅ Add tests to verify Proxy-specific scenarios
- ✅ Update documentation

**Estimated Effort:** 1-2 hours for testing and documentation (no code changes)

---

## Documentation Requirements

Once class instance feature is complete:
1. Add Proxy example to `docs/CONTEXT-PROPAGATION.md`
2. Document Proxy edge cases (revocable, nested, etc.)
3. Add JSDoc examples showing Proxy usage
4. Update changelog mentioning Proxy support

---

## Related

- [Class Instance Context Propagation](./class-instance-context-propagation.md) - **BLOCKER** - Implements the wrapper that handles Proxies
- [EventEmitter Context Propagation](./eventemitter-context-propagation.md) - Similar context loss issue
- [CONTEXT-PROPAGATION.md](../../CONTEXT-PROPAGATION.md) - User-facing documentation

---

## Notes

- User-defined Proxy objects from `api_tests/api_tv_test/proxy-test.mjs` work fine **because they don't access context/self**
- The `proxy-baseline.test.vitest.mjs` tests Proxy **behavior**, not context propagation
- V2's implementation (src2) already handles Proxy objects correctly via class instance wrapping
- This is a **documentation/testing task**, not a code implementation task
