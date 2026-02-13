# Context.get() Cross-Instance Behavior - RESOLVED

**Last Evaluated:** 2026-02-12

**Status:** ✅ **RESOLVED - BEHAVIOR IS CORRECT**  
**Priority:** ~~MEDIUM~~ CLOSED  
**Date Created:** January 29, 2026  
**Date Resolved:** February 12, 2026

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

## ✅ RESOLUTION (February 12, 2026)

### Investigation Summary

After reviewing source code and running comprehensive tests, the current behavior is **CORRECT BY DESIGN**.

### Test Results
- ✅ **Per-request context tests**: 157/157 passed
- ✅ **Debug tests**: All passed
- ✅ **Baseline tests**: 2,648/2,648 passed (38 test files)

### Why Cross-Instance Returns Base Context

**Architectural Reason:** Instance isolation and proper separation of concerns.

When `api1.slothlet.context.get()` is called from within `api2.run()`:
- `context.get()` is a **method bound to api1** (not to the active scope)
- It checks: "Is the currently active context mine (api1) or a child of mine?"
- Since we're inside `api2.run()`, the active context belongs to api2
- Therefore, it correctly returns **api1's base context** (not api2's scoped context)

### Code Evidence

From [src/lib/builders/api_builder.mjs](../../../src/lib/builders/api_builder.mjs#L420-L445):

```javascript
// Check if current store belongs to this instance (base or child)
const isOurInstance =
    currentStore.instanceID === slothlet.instanceID ||
    currentStore.parentInstanceID === slothlet.instanceID ||
    currentStore.instanceID.startsWith(slothlet.instanceID + "__run_");

if (isOurInstance) {
    // We're in our own context (either base or .run() child)
    return key ? currentStore.context[key] : { ...currentStore.context };
}

// We're in a different instance's context - return our base context
const baseStore = slothlet.contextManager.instances.get(slothlet.instanceID);
return key ? baseContext[key] : { ...baseContext };
```

### Verified Behavior

✅ **Same-instance calls preserve scope:**
```javascript
api1.run({ level: 1 }, () => {
    api1.context.get(); // Returns { level: 1 } ✓ CORRECT
});
```

✅ **Cross-instance calls return base context:**
```javascript
api2.run({ level: 2 }, () => {
    api1.context.get(); // Returns api1's BASE context ✓ CORRECT
    // (not { level: 2 } - that would be context leakage)
});
```

### Why This Prevents Bugs

This design prevents:
1. **Context leakage** between different API instances
2. **Unexpected side effects** from cross-instance calls
3. **Confusion** about which instance's context is active
4. **Security issues** where one instance could access another's request-scoped data

### Test Location

Test verifying this behavior: [tests/vitests/suites/context/per-request-context.test.vitest.mjs](../../../tests/vitests/suites/context/per-request-context.test.vitest.mjs#L393-L420)

```javascript
// Create two separate API instances
api1 = await slothlet({ context: { appName: "app1" } });
api2 = await slothlet({ context: { appName: "app2" } });

await api1.slothlet.context.run({ level: "api1-outer", userId: 100 }, async () => {
    // Nest api2.run() inside api1.run()
    await api2.slothlet.context.run({ level: "api2-inner", userId: 200 }, async () => {
        // Cross-instance call returns BASE context (isolation)
        const ctx1Inner = await api1.slothlet.context.get();
        expect(ctx1Inner.level).toBeUndefined();     // ✅ BASE context
        expect(ctx1Inner.appName).toBe("app1");      // ✅ BASE context value
        
        // Same-instance call returns SCOPED context
        const ctx2Inner = await api2.slothlet.context.get();
        expect(ctx2Inner.level).toBe("api2-inner");  // ✅ SCOPED context
    });
});
```

### Conclusion

**NO ACTION REQUIRED** - The implementation is correct, tests validate the behavior, and the architectural design prevents context leakage between instances.

---

## ~~Issue Summary~~ (Original Concern - Now Resolved)

~~Current implementation of `.run()` and `.scope()` child instances may have incorrect context.get() behavior. Tests were updated to expect "BASE context only" for cross-instance calls, but this might be wrong.~~

**Resolution:** The behavior is intentional and correct. Tests were updated to match the correct expected behavior, not buggy behavior.

~~**Concern from TEST-STATUS.md:**~~
~~> **BREAKING CHANGE**: Cross-instance context.get() now returns BASE context only (not parent .run() context).~~

**Clarification:** This is not a breaking change - it's the correct implementation of instance isolation.

## ~~Why This Might Be Wrong~~ (Original Analysis - Disproven)

1. **We have instanceID tracking**: Each child instance created by `.run()` or `.scope()` has a unique instanceID following pattern `{baseID}__run_{timestamp}_{random}`
2. **We have parentInstanceID tracking**: Child instances know their parent via `parentInstanceID` field
3. **We can lookup by instanceID**: The ALS/context system should be able to lookup context by instanceID
4. **Expected behavior**: If code is executing within a `.run()` or `.scope()` block, `context.get()` should return the **scoped context**, not the base context

## Current Behavior (Per Tests)

```javascript
// Parent instance
const api = await slothlet({ context: { user: "parent" } });

api.run({ user: "child-scope" }, async () => {
    // Inside child scope
    
    // When child scope calls another API method:
    const result = await api.someMethod();
    
    // Currently: context.get() in someMethod returns { user: "parent" } (BASE)
    // Expected: context.get() should return { user: "child-scope" } (SCOPED)
});
```

## Questions to Investigate

1. **Why does cross-instance context.get() return base context?**
   - Is this a limitation of how child instances are created?
   - Is this a bug in context lookup logic?

2. **How does instanceID lookup work?**
   - Does the runtime system actually use instanceID to find the correct context?
   - Or does it always fall back to base instance context?

3. **What is the correct behavior?**
   - Should cross-instance calls preserve the calling scope's context?
   - Or is base context intentional for some architectural reason?

4. **Test implications:**
   - Were tests updated to match current behavior or correct expected behavior?
   - File: `tests/vitests/suites/context/per-request-context.test.vitest.mjs`
   - Note says: "Changed nested .run() assertions to expect base context for cross-instance calls"

## Related Files to Review

- **`src/lib/handlers/context-async.mjs`** - AsyncLocalStorage context manager
- **`src/lib/handlers/context-live.mjs`** - Live bindings context manager  
- **`src/lib/runtime/runtime-asynclocalstorage.mjs`** - Runtime context exports
- **`src/lib/runtime/runtime-livebindings.mjs`** - Runtime context exports
- **`tests/vitests/suites/context/per-request-context.test.vitest.mjs`** - Test file (157/157 passing)

## Implementation Notes

From TEST-STATUS.md:
> Implemented child instance approach for .run()/.scope() isolation. Added isolation modes: "partial" (default, shared self) vs "full" (cloned self). Unified .run() and .scope() implementations - .run() now delegates to .scope(). Child instances use pattern `{baseID}__run_{timestamp}_{random}` with parentInstanceID tracking. Both async and live modes now work identically.

**Key architectural decision:**
- Child instances have their own instanceID
- Parent-child relationship is tracked
- Both isolation modes exist: "partial" (shared self) and "full" (cloned self)

## Action Items

1. **Review context lookup logic** - How does `context.get()` resolve which instance's context to use?
2. **Test expected behavior** - Create explicit test case for cross-instance context access
3. **Document intended behavior** - Is base context fallback intentional or a bug?
4. **Fix if needed** - If context should be scoped, update context lookup to use instanceID properly
5. **Update tests if wrong** - If tests were updated to match buggy behavior, revert to correct expectations

## Potential Solutions

If this is indeed wrong, possible fixes:

1. **Use ALS store's instanceID** - When looking up context, check current ALS store for instanceID and use that
2. **Context chain lookup** - Follow parent-child instance chain to find correct context
3. **Preserve calling scope** - Ensure child instance context is active when calling parent methods

## Decision Required

**Before closing this issue, we need to definitively answer:**
- ✅ Is the current behavior (base context) correct?
- ✅ Or should context.get() return scoped context for cross-instance calls?

---

**Related Documentation:**
- `docs/v3/todo/architecture-context-instanceid-management.md`
- Test file: `tests/vitests/suites/context/per-request-context.test.vitest.mjs` (157/157 passing)
