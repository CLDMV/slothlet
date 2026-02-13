# Context Cross-Instance Behavior & Mutability Investigation

**Investigation Completed:** February 12, 2026  
**Status:** ⚠️ **IDENTIFIED BUG - NEEDS FIXING**  
**Priority:** HIGH  
**Related Files:**
- `docs/v3/todo/investigate-context-mutability.md` (consolidated here)
- `docs/v3/todo/context-get-cross-instance-behavior.md` (consolidated here)

---

### How to Run Tests Properly

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

## Executive Summary

Both `investigate-context-mutability.md` and `context-get-cross-instance-behavior.md` describe issues with context isolation in `.run()` and `.scope()`.

**FINDINGS:** The current implementation has **INSUFFICIENT ISOLATION**. 

### Cross-Instance Behavior: ✅ CORRECT
Cross-instance calls return base context - this is correct and prevents context leakage between independent API instances.

### Context Mutability: ⚠️ **BUG - NEEDS FIXING**
`.run()` and `.scope()` currently use **shallow copy**, which allows mutations to leak back to the parent instance. This violates the design intent.

**EXPECTED BEHAVIOR:**
- `.run()` and `.scope()` should create a fully isolated copy
- Code runs with a snapshot of the current state
- Modifications inside .run() should NOT affect the parent instance
- Context should be **deep copied**, not shallow copied

---

## The Core Behavior

### Current Implementation

When you have two separate Slothlet instances and call from one to another:

```javascript
// Two separate instances
const api1 = await slothlet({ context: { app: "api1" } });
const api2 = await slothlet({ context: { app: "api2" } });

// api1 creates a child context with .run()
await api1.slothlet.context.run({ userId: 100 }, async () => {
    // Inside api1's child context
    const ctx1 = await api1.slothlet.context.get();
    console.log(ctx1); // { app: "api1", userId: 100 } ✅
    
    // Call api2 from inside api1's .run() block
    const ctx2 = await api2.slothlet.context.get();
    console.log(ctx2); // { app: "api2" } ✅ (api2's BASE context, NOT api1's child context)
});
```

**Why?** Because `api2.slothlet.context.get()` is bound to `api2`'s instance ID. It checks:
1. Is the current ALS context for `api2`'s instance? (No, it's for `api1`)
2. Falls back to `api2`'s base context

---

## Code Analysis

### Location: `src/lib/builders/api_builder.mjs` lines 385-448

The `context.get()` function is closure-bound to each instance's `slothlet.instanceID`:

```javascript
context: {
    get: (key) => {
        // For async mode
        if (slothlet.contextManager.constructor.name === "AsyncContextManager") {
            let currentStore = slothlet.contextManager.tryGetContext();
            
            // Check if current store belongs to THIS instance
            const isOurInstance =
                currentStore.instanceID === slothlet.instanceID ||
                currentStore.parentInstanceID === slothlet.instanceID ||
                currentStore.instanceID.startsWith(slothlet.instanceID + "__run_");
            
            if (isOurInstance) {
                // We're in our own context (base or child) - return it
                return key ? currentStore.context[key] : { ...currentStore.context };
            }
            
            // We're in a different instance's context - return our BASE context
            const baseStore = slothlet.contextManager.instances.get(slothlet.instanceID);
            const baseContext = baseStore?.context || {};
            return key ? baseContext[key] : { ...baseContext };
        }
        
        // Similar logic for live mode...
    }
}
```

**Key Insight:** The `slothlet.instanceID` in the closure is FIXED to the instance where the API was created. It cannot see other instances' child contexts.

---

## Why This Is Correct

### Scenario 1: Two Independent API Instances

```javascript
const authAPI = await slothlet({ dir: "./auth" });
const paymentAPI = await slothlet({ dir: "./payment" });

// User makes a request to authAPI
await authAPI.slothlet.context.run({ userId: 123, role: "admin" }, async () => {
    // Inside authAPI's request context
    
    // Call payment API
    const result = await paymentAPI.charge({ amount: 100 });
    // Inside paymentAPI.charge(), context.get() should NOT see authAPI's context
    // Payment API should only see its own base context (or its own .run() contexts)
});
```

**Expected:** `paymentAPI` should NOT have access to `authAPI`'s request context. They are separate instances with separate security boundaries.

**Actual:** ✅ Correct - cross-instance calls return base context

---

### Scenario 2: Same Instance, Nested .run() Calls

```javascript
const api = await slothlet({ dir: "./api" });

await api.slothlet.context.run({ level: "outer" }, async () => {
    // api.slothlet.context.get() → { level: "outer" } ✅
    
    await api.slothlet.context.run({ level: "inner" }, async () => {
        // api.slothlet.context.get() → { level: "inner" } ✅
        // Inner context overrides outer context
    });
});
```

**Expected:** Nested `.run()` calls on the SAME instance should see their own context.

**Actual:** ✅ Correct - child contexts properly isolate

---

## Context Mutability Analysis

From `investigate-context-mutability.md`:

### Question: Can external code modify context during .run()?

**Answer:** It depends on the runtime mode and what you modify.

#### Async Mode (AsyncLocalStorage)

```javascript
const api = await slothlet({ runtime: "async", context: { count: 0 } });

await api.slothlet.context.run({ count: 10 }, async () => {
    // Inside .run(), count = 10
    
    // External modification attempt:
    const store = api.slothlet.contextManager.instances.get(api.slothlet.instanceID);
    store.context.count = 999;
    
    // Result: context.get("count") still returns 10 ✅
    // Why? .run() creates a shallow copy of the context object
});
```

**Primitives:** ✅ Isolated - modifications don't affect active `.run()` contexts

**Objects (reference types):**
```javascript
await api.slothlet.context.run({ data: { value: 10 } }, async () => {
    const store = api.slothlet.contextManager.instances.get(api.slothlet.instanceID);
    store.context.data.value = 999;
    
    // Result: context.get("data").value returns 999 ❌
    // Why? Shallow copy means nested objects are shared by reference
});
```

**Objects:** ⚠️ NOT isolated - nested object properties can be mutated

---

#### Live Mode (currentInstanceID tracking)

Live mode modifies context in-place:

```javascript
const api = await slothlet({ runtime: "live", context: { count: 0 } });

await api.slothlet.context.run({ count: 10 }, async () => {
    const store = api.slothlet.contextManager.instances.get(api.slothlet.instanceID);
    store.context.count = 999;
    
    // Result: context.get("count") returns 999 ❌
    // Why? Live mode uses Object.assign directly on store.context
});
```

**Both primitives and objects:** ⚠️ NOT isolated - live mode provides weaker guarantees

---

## Required Fixes

### Bug 1: Shallow Copy Allows Mutation Leakage

**Current Behavior:** Shallow copy means nested objects are shared by reference

```javascript
const api = await slothlet({ context: { data: { count: 0 } } });

await api.slothlet.context.run({ data: { count: 10 } }, async () => {
    const ctx = api.slothlet.context.get();
    ctx.data.count = 999; // ⚠️ MUTATES PARENT CONTEXT
});

// After .run() completes:
const baseCtx = api.slothlet.context.get();
console.log(baseCtx.data.count); // 999 ❌ WRONG - should still be 0
```

**Fix Required:** Use `structuredClone()` or deep copy when creating child contexts

**Implementation Location:**
- `src/lib/handlers/context-async.mjs` - AsyncContextManager.runInContext()
- `src/lib/handlers/context-live.mjs` - LiveContextManager.runInContext()
- `.run()` and `.scope()` implementations in api_builder.mjs

### Bug 2: Live Mode In-Place Modification

Live mode directly modifies `store.context` with `Object.assign()`, providing even weaker isolation than async mode.

**Fix Required:** Create new context object for child instances instead of mutating in place

---

## Test Validation

Tests were updated in `per-request-context.test.vitest.mjs` to expect cross-instance calls returning BASE context:

```javascript
// Lines 402-406
// api1's child context exists in the context chain but is NOT returned for cross-instance calls.
expect(ctx1Inner.level).toBeUndefined(); // Cross-instance = base context
expect(ctx1Inner.userId).toBeUndefined(); // Cross-instance = base context
expect(ctx1Inner.appName).toBe("app1"); // Base context value preserved
```

**Status:** All 157 tests passing ✅

---

## Documentation Updates Needed

### ✅ Completed
- Consolidated investigation findings
- Documented cross-instance behavior
- Explained mutability characteristics

### 📝 Recommended Next Steps
1. Add to main docs explaining context isolation boundaries
2. Add examples showing cross-instance behavior
3. Document shallow vs deep copy considerations
4. Add best practices for context data structure

---

## Related Code Locations

**Context Managers:**
- `src/lib/handlers/context-async.mjs` - AsyncLocalStorage manager
- `src/lib/handlers/context-live.mjs` - Live bindings manager

**Context API Implementation:**
- `src/lib/builders/api_builder.mjs` lines 385-448 - `context.get()` closure

**Tests:**
- `tests/vitests/suites/context/per-request-context.test.vitest.mjs` - Comprehensive tests

**Runtime Exports:**
- `src/lib/runtime/runtime-asynclocalstorage.mjs` - Async runtime context proxy
- `src/lib/runtime/runtime-livebindings.mjs` - Live runtime context proxy

---

## Final Verdict

### ✅ Cross-Instance Behavior: CORRECT
Cross-instance `context.get()` calls returning BASE context is:
1. Intentional design
2. Security-conscious (prevents context leakage)
3. Documented in tests
4. Working as expected

### ⚠️ Context Isolation: **BUG - CODE CHANGES REQUIRED**

**Problem:** Shallow copy allows mutation leakage back to parent instance

**Required Changes:**
1. Use `structuredClone()` for deep copying context in `.run()` and `.scope()`
2. Update both async and live mode context managers
3. Add tests verifying nested object mutations don't leak
4. Ensure performance impact is acceptable (structuredClone is fast in V8)

**Impact:**
- High - affects correctness of context isolation
- Breaking change potential - code relying on shared references will break
- Should be fixed in v3.0 since breaking changes are acceptable

**Next Steps:**
1. Move this document from /completed/ to /todo/ (it's NOT resolved)
2. Implement deep copy in context managers
3. Update tests to verify full isolation
4. Document the change in BREAKING-CHANGES-V3.md
