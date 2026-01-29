# Context.get() Cross-Instance Behavior - Needs Review

**Status:** 🟡 **NEEDS INVESTIGATION**  
**Priority:** MEDIUM  
**Date Created:** January 29, 2026

---

## Issue Summary

Current implementation of `.run()` and `.scope()` child instances may have incorrect context.get() behavior. Tests were updated to expect "BASE context only" for cross-instance calls, but this might be wrong.

**Concern from TEST-STATUS.md:**
> **BREAKING CHANGE**: Cross-instance context.get() now returns BASE context only (not parent .run() context).

## Why This Might Be Wrong

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
