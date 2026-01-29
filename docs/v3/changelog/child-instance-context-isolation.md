# Child Instance Approach for Context Isolation

**Date**: 2025-01-28  
**Status**: ✅ Implemented  
**Impact**: Major - Breaking Change  
**Category**: Context Management  

## Summary

Replaced parent chain traversal with a **child instance approach** for `.run()` and `.scope()` context isolation. This provides clearer semantics, better performance, and eliminates behavioral differences between async and live modes.

## Motivation

**Previous Implementation Issues**:
- Complex parent chain traversal in `context.get()`
- Inconsistent behavior between async (ALS) and live modes
- Unclear cross-instance context semantics
- Duplicate code between `.run()` and `.scope()`
- Performance overhead from chain walking

**New Approach Benefits**:
- Simple pattern-based instance recognition
- Identical behavior across all runtime modes
- Clear isolation semantics
- Single unified implementation
- Configurable isolation levels

## Implementation Details

### Child Instance Pattern

```javascript
// Child instance ID format
`${baseInstanceID}__run_${timestamp}_{random}`

// Example
"slothlet_abc123__run_1737240000000_x9k2n"
```

### Context Store Structure

```javascript
{
    instanceID: "slothlet_abc123__run_...",
    context: { ...mergedContext },
    self: partialMode ? baseSelf : deepClone(baseSelf),
    config: { ...baseConfig },
    createdAt: timestamp,
    parentInstanceID: "slothlet_abc123" // NEW FIELD
}
```

### Recognition Logic

**In `runInContext()` (both context managers)**:
```javascript
const isOurContext = 
    activeStore.instanceID === instanceID ||
    activeStore.parentInstanceID === instanceID ||
    activeStore.instanceID.startsWith(instanceID + "__run_");
```

**In `.scope()` (context retrieval)**:
```javascript
// Get THIS instance's store (base or child), not just any active store
let currentStore = null;
const activeStore = contextManager.tryGetContext();

if (activeStore && isOurInstance(activeStore, slothlet.instanceID)) {
    currentStore = activeStore; // Use child if in our context
} else {
    currentStore = contextManager.instances.get(slothlet.instanceID); // Fall back to base
}
```

### Unified `.run()` and `.scope()`

`.run()` now delegates to `.scope()`:

```javascript
run: async (contextData, callback) => {
    return await scopeFunction({
        context: contextData,
        fn: callback,
        args: [],
        merge: "shallow"
    });
}
```

## Isolation Modes

### Partial Isolation (Default)

```javascript
scope: { isolation: "partial" } // or omit (default)
```

- Child `self` references base `self` (shared)
- Mutations to API state persist outside `.run()`
- Context is isolated, self is not

### Full Isolation

```javascript
scope: { isolation: "full" }
```

- Child `self` is deep cloned from base `self`
- Mutations to API state do NOT persist outside `.run()`
- Both context AND self are isolated

### Per-Call Override

```javascript
// Instance default: partial
const api = await slothlet({
    scope: { isolation: "partial" }
});

// Override for specific call
await api.slothlet.context.scope({
    context: { requestId: "123" },
    isolation: "full", // <-- override
    fn: async () => { /* isolated */ }
});
```

## Breaking Changes

### Cross-Instance Context Behavior

**Before** (parent chain):
```javascript
await api1.slothlet.context.run({ user: "alice" }, async () => {
    await api2.slothlet.context.run({ requestId: "123" }, async () => {
        const ctx1 = await api1.slothlet.context.get();
        // OLD: Returns { user: "alice" } from parent chain
    });
});
```

**After** (child instance):
```javascript
await api1.slothlet.context.run({ user: "alice" }, async () => {
    await api2.slothlet.context.run({ requestId: "123" }, async () => {
        const ctx1 = await api1.slothlet.context.get();
        // NEW: Returns api1's BASE context (no user field)
    });
});
```

**Rationale**: Cross-instance calls should not leak `.run()` context from different instances. This provides clearer isolation guarantees.

**Migration**: If you need api1's context from inside api2.run(), save it to a variable:
```javascript
await api1.slothlet.context.run({ user: "alice" }, async () => {
    const api1Context = await api1.slothlet.context.get();
    
    await api2.slothlet.context.run({ requestId: "123" }, async () => {
        // Use saved api1Context instead of calling api1.context.get()
        console.log(api1Context.user); // "alice"
    });
});
```

## Files Modified

### Core Implementation
- `src/lib/builders/api_builder.mjs`:
  - Lines 815-847: `.run()` delegates to `.scope()`
  - Lines 853-1038: Unified `.scope()` implementation with child instance logic
  - Lines 280-327: Simplified `context.get()` (no parent chain)
  - Added `deepClone()` helper for full isolation

### Context Managers
- `src/lib/handlers/context-async.mjs`:
  - Lines 54-71: Updated `runInContext()` with child instance recognition
  - Checks `parentInstanceID` and pattern matching

- `src/lib/handlers/context-live.mjs`:
  - Lines 48-86: Updated `runInContext()` to match async mode behavior
  - Added `parentInstanceID` check

### Tests
- `tests/vitests/suites/context/per-request-context.test.vitest.mjs`:
  - Updated nested run test assertions (cross-instance = base context)
  - Added isolation mode tests (partial/full)
  - Added `.scope()` override tests
  - All 133 tests passing

### Documentation
- `docs/v3/todo/architecture-context-instanceid-management.md`:
  - Marked as RESOLVED
  - Added implementation summary
  - Documented breaking changes

- `tests/vitests/TEST-STATUS.md`:
  - Updated per-request-context test status
  - Documented behavior changes

## Testing

✅ All tests pass: **133/133** in `per-request-context.test.vitest.mjs`

**Test Coverage**:
- Shallow and deep merge strategies
- `.run()` and `.scope()` equivalence
- Nested `.run()` calls (same instance and cross-instance)
- Concurrent request isolation
- Multi-instance isolation
- Partial isolation mode (shared self)
- Full isolation mode (cloned self)
- Isolation override per call
- Error handling (scope disabled, invalid parameters)

**Test Configurations**: Full matrix coverage
- Eager/Lazy modes
- Async/Live runtimes
- With/Without hooks
- All isolation modes

## Performance Impact

**Improvements**:
- ✅ No parent chain traversal (O(1) vs O(n) lookup)
- ✅ Simple pattern matching (`startsWith` check)
- ✅ Reduced code complexity

**Tradeoffs**:
- Full isolation mode incurs deep clone cost (opt-in only)
- Child instance registration/cleanup overhead (negligible)

## Migration Guide

### For Most Users
No changes required - existing code continues to work. The breaking change only affects cross-instance context access in nested `.run()` calls.

### For Advanced Multi-Instance Users

**If you rely on cross-instance context access**:

```javascript
// OLD CODE (no longer works)
await api1.slothlet.context.run({ userId: 100 }, async () => {
    await api2.slothlet.context.run({ requestId: "abc" }, async () => {
        // This now returns BASE context
        const ctx = await api1.slothlet.context.get();
        console.log(ctx.userId); // undefined (not 100)
    });
});

// NEW CODE (save context to variable)
await api1.slothlet.context.run({ userId: 100 }, async () => {
    const api1Ctx = await api1.slothlet.context.get();
    
    await api2.slothlet.context.run({ requestId: "abc" }, async () => {
        // Use saved context
        console.log(api1Ctx.userId); // 100
    });
});
```

### For Library Authors

If you're building on top of slothlet and rely on context isolation:
- Review cross-instance context access patterns
- Test with updated semantics
- Consider using isolation modes for explicit control

## Related Changes

- **Unified .run() and .scope()**: Eliminates code duplication
- **Mode Parity**: Async and live modes now behave identically
- **Explicit Isolation**: New `isolation` config option

## Future Work

- [ ] Performance benchmarks for isolation modes
- [ ] Additional isolation strategies (if needed)
- [ ] Context inheritance patterns documentation

## See Also

- `docs/CONTEXT-PROPAGATION.md` - Context system overview
- `docs/v3/todo/architecture-context-instanceid-management.md` - Architecture discussion
- `tests/vitests/suites/context/` - Context test suites
