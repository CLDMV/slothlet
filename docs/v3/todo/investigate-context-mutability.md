# Investigation: Context Mutability in .run() and .scope()

## Issue Description

Context isolation in `.run()` and `.scope()` may have mutability issues when dealing with primitives vs objects.

## Current Behavior

When calling `.run(contextData, callback)`:
- Context data is merged with base instance context
- The merged context is active during callback execution
- Question: Can external code modify the context while .run() is active?

## Concerns

### Primitives
```javascript
api.slothlet.context.run({ count: 0 }, () => {
    // Inside .run(), count = 0
    
    // If external code does:
    // contextManager.instances.get(instanceID).context.count = 5
    
    // What does the callback see?
    // Should it see 0 (isolated) or 5 (mutated)?
});
```

### Objects (Reference Types)
```javascript
api.slothlet.context.run({ data: { value: 10 } }, () => {
    // Inside .run(), data.value = 10
    
    // If external code does:
    // contextManager.instances.get(instanceID).context.data.value = 20
    
    // What does the callback see?
    // Current behavior: Likely sees 20 (shared reference)
    // Expected behavior: ???
});
```

## Questions to Answer

1. **Should .run() create a deep clone of context data?**
   - Pro: True isolation
   - Con: Performance impact, breaks intentional object sharing

2. **Should modifications to base context affect active .run() contexts?**
   - Current async mode: Uses ALS, so modifications don't affect active contexts
   - Current live mode: Modifies store.context in place - DOES affect active contexts!

3. **Is this a feature or a bug?**
   - Feature: Allows "hot" context updates that propagate to running operations
   - Bug: Violates isolation guarantees of .run()

## Test Cases Needed

```javascript
// Test 1: Primitive modification
const api = await slothlet({ dir: "./api", runtime: "async", context: { count: 0 } });
await api.slothlet.context.run({ count: 10 }, async () => {
    // Modify base context from outside
    const store = api.slothlet.contextManager.instances.get(api.slothlet.instanceID);
    store.context.count = 999;
    
    // What does api.slothlet.context.get("count") return?
    // Expected: 10 (isolated)
    // Actual: ???
});

// Test 2: Object reference modification
const api = await slothlet({ dir: "./api", runtime: "async", context: { data: { val: 0 } } });
await api.slothlet.context.run({ data: { val: 10 } }, async () => {
    // Modify base context object from outside
    const store = api.slothlet.contextManager.instances.get(api.slothlet.instanceID);
    store.context.data.val = 999;
    
    // What does api.slothlet.context.get("data").val return?
    // Expected: 10 (isolated)
    // Actual: 999 (shared reference) ???
});

// Test 3: Async vs Live mode differences
// Compare behavior between async and live modes
```

## Related Code Locations

- **AsyncContextManager.runInContext()**: `src/lib/handlers/context-async.mjs` line 54+
  - Creates `executionStore = { ...baseStore }` (shallow copy)
  - Merges context via `Object.assign()` or deep merge
  
- **LiveContextManager run()**: `src/lib/builders/api_builder.mjs` line 779+
  - Modifies `store.context` in place: `Object.assign(store.context, contextData)`
  - No isolation - all active contexts see modifications!

- **.run() implementation**: `src/lib/builders/api_builder.mjs` line 814+
  - Async mode: Creates new ALS context with merged data
  - Live mode: Mutates base store directly

## Priority

**HIGH** - Affects correctness of per-request context isolation guarantees.

## Proposed Solutions

### Option 1: Deep Clone Context (Safe but Slow)
- Deep clone all context data in .run()/.scope()
- Guarantees isolation
- Performance cost

### Option 2: Shallow Clone + Documentation (Current)
- Keep current shallow clone behavior
- Document that object properties are shared references
- Users must clone objects themselves if needed

### Option 3: Copy-on-Write Proxy
- Wrap context in proxy that clones on first write
- Lazy cloning only when needed
- Complex implementation

### Option 4: Mode-Specific Behavior
- Async mode: Current behavior (shallow clone via ALS)
- Live mode: Accept mutation as "feature" for performance
- Document differences clearly

## Next Steps

1. Create comprehensive test suite for context mutability
2. Test both async and live modes
3. Document actual behavior
4. Decide on intended behavior
5. Implement fixes if needed
6. Update documentation

## Date Created
2026-01-28
