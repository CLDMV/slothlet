# Architecture Discussion: Scope/Run Context Management with InstanceID

## ✅ RESOLVED: Child Instance Approach Implemented

**Status**: COMPLETED as of 2025-01-28
**Solution**: Child instance approach with pattern-based recognition
**Files Modified**:
- `src/lib/builders/api_builder.mjs`: Unified .run() and .scope() implementations
- `src/lib/handlers/context-async.mjs`: Child instance recognition in runInContext
- `src/lib/handlers/context-live.mjs`: Child instance recognition in runInContext
- Tests updated in `tests/vitests/suites/context/per-request-context.test.vitest.mjs`

## Final Implementation Summary

### Child Instance Pattern

Instead of maintaining a parent chain, we now create **temporary child instances** for each `.run()` or `.scope()` call:

```javascript
// Child instance ID pattern
const childInstanceID = `${baseInstanceID}__run_${timestamp}_{random}`;

// Example: "slothlet_123abc__run_1234567890123_x9k2n"
```

Each child instance:
- Has a unique instanceID following the pattern above
- Stores `parentInstanceID` pointing to the base instance
- Gets registered in `contextManager.instances` during execution
- Gets automatically cleaned up in the `finally` block

### Context Isolation Semantics

**Cross-Instance Calls (Different Base Instances)**:
```javascript
await api1.slothlet.context.run({ user: "alice" }, async () => {
    // Inside api1's .run()
    const ctx1 = await api1.slothlet.context.get(); // ✅ Returns api1's child context
    const ctx2 = await api2.slothlet.context.get(); // ✅ Returns api2's BASE context
});
```

**Same-Instance Calls**:
```javascript
await api1.slothlet.context.run({ outer: "yes" }, async () => {
    const ctx = await api1.slothlet.context.get(); // ✅ Returns child context
    
    await api1.slothlet.context.run({ inner: "yes" }, async () => {
        const nested = await api1.slothlet.context.get(); // ✅ Returns inner child context
    });
});
```

### Isolation Modes

**Partial Isolation (Default)**: `scope: { isolation: "partial" }`
- Child `self` = base `self` (shared reference)
- Mutations to API state persist across .run() boundaries
- Context is isolated, but self is not cloned

**Full Isolation**: `scope: { isolation: "full" }`
- Child `self` = `deepClone(base self)` (cloned reference)  
- Mutations to API state do NOT persist outside .run()
- Both context AND self are isolated

### Implementation Details

**Child Instance Creation** (both modes):
```javascript
const childStore = {
    instanceID: childInstanceID,
    context: mergedContext, // Merged with parent context
    self: isolation === "full" ? deepClone(currentStore.self) : currentStore.self,
    config: currentStore.config,
    createdAt: currentStore.createdAt,
    parentInstanceID: slothlet.instanceID // Track parent
};
```

**Recognition Logic** (in runInContext):
```javascript
const isOurContext = 
    activeStore.instanceID === instanceID ||           // Exact match
    activeStore.parentInstanceID === instanceID ||     // Child of this instance
    activeStore.instanceID.startsWith(instanceID + "__run_"); // Pattern match
```

**Context Retrieval** (in .scope()):
```javascript
// CRITICAL: Get THIS instance's store, not just any active store
let currentStore = null;

const activeStore = contextManager.tryGetContext(); // or currentInstanceID for live
if (activeStore) {
    const isOurContext = 
        activeStore.instanceID === slothlet.instanceID ||
        activeStore.parentInstanceID === slothlet.instanceID ||
        activeStore.instanceID.startsWith(slothlet.instanceID + "__run_");
    
    if (isOurContext) {
        currentStore = activeStore; // Use child if in our context
    }
}

// Fall back to base
if (!currentStore) {
    currentStore = contextManager.instances.get(slothlet.instanceID);
}
```

### Unified .run() and .scope()

`.run()` now delegates to `.scope()` with default parameters:

```javascript
// .run() implementation
run: async (contextData, callback) => {
    return await scopeFunction({
        context: contextData,
        fn: callback,
        args: [],
        merge: "shallow"
    });
}
```

This ensures:
- Single implementation path (no code duplication)
- Consistent behavior across both methods
- Easier maintenance and testing

### Mode Differences Eliminated

Both **async** (ALS) and **live** (global state) modes now work identically:
- Child instance creation: Same logic
- Context retrieval: Same recognition pattern  
- Cleanup: Same `finally` block pattern
- Isolation modes: Same deepClone logic

The only difference is the context storage mechanism:
- **Async**: Uses ALS with `als.run(childStore, fn)`
- **Live**: Uses global `currentInstanceID` tracking

## Benefits of This Approach

1. **Simplicity**: No parent chain traversal needed
2. **Clear Semantics**: Cross-instance = base, same-instance = child
3. **Performance**: Simple pattern matching vs chain walking
4. **Unified Code**: Both modes work identically
5. **Explicit Isolation**: Configurable partial/full isolation
6. **Clean Lifecycle**: Child instances auto-cleaned in finally blocks

## Breaking Changes

**Cross-Instance Context Behavior Changed**:

**Before** (parent chain approach):
```javascript
await api1.run({ user: "alice" }, async () => {
    await api2.run({ requestId: "123" }, async () => {
        const ctx1 = await api1.context.get();
        // OLD: Would find api1's .run() context in parent chain
        // Returns: { user: "alice" }
    });
});
```

**After** (child instance approach):
```javascript
await api1.run({ user: "alice" }, async () => {
    await api2.run({ requestId: "123" }, async () => {
        const ctx1 = await api1.context.get();
        // NEW: Returns api1's BASE context (not .run() context)
        // Returns: {} (or whatever base context is)
    });
});
```

**Rationale**: Cross-instance calls should not leak .run() context from different instances. If you need to access api1's context from inside api2, save it to a variable before entering api2.run().

## Testing

All 133 tests pass in `per-request-context.test.vitest.mjs`:
- ✅ Shallow and deep merge
- ✅ .run() and .scope() equivalence
- ✅ Nested .run() calls (same instance)
- ✅ Nested .run() calls (cross-instance)
- ✅ Concurrent isolation
- ✅ Multi-instance isolation
- ✅ Partial isolation mode
- ✅ Full isolation mode
- ✅ Isolation override per call
- ✅ Error handling

## Related Files

- `docs/v3/changelog/` - Create changelog entry for this change
- `tests/vitests/TEST-STATUS.md` - Updated test status
- Architecture documentation updated (this file)

---

## Original Problem Statement (For Reference)

We had **two separate but related concerns** when managing context:

1. **Base Instance Context**: Getting the correct instance's base context when api1 functions are called from within api2
2. **Isolated Run Context**: Preserving .run()/.scope() modified context during execution

Current implementation conflates these concerns with parent chain search.

## Current Implementation Analysis

### What Works
- **UnifiedWrapper + instanceID**: Already correctly handles cross-instance calls
  - `wrapper.slothlet.instanceID` identifies which instance the function belongs to
  - `contextManager.runInContext(instanceID, ...)` looks up base context via `instances.get(instanceID)`
  - ✅ api1 functions called from api2 correctly get api1's base context

### What's Complex
- **Parent chain search in context.get()**: Lines 298-312 in api_builder.mjs
  - Searches backwards through nested .run() calls to find matching instanceID
  - Needed for: `api1.slothlet.context.get()` called inside `api1.run()` → should get .run() context
  - NOT needed for: Normal function calls (UnifiedWrapper handles this)

## The Real Questions

### Question 1: What should context.get() return?

**Scenario A: Inside .run() for SAME instance**
```javascript
await api1.slothlet.context.run({ requestID: "req1" }, () => {
    const ctx = api1.slothlet.context.get();
    // Should return: { requestID: "req1" } (the .run() context) ✅
});
```

**Scenario B: Inside .run() for DIFFERENT instance**
```javascript
await api2.slothlet.context.run({ requestID: "req2" }, () => {
    const ctx = api1.slothlet.context.get();
    // Should return: api1's BASE context (not req2's context) ✅
});
```

**Scenario C: Inside nested .run() calls**
```javascript
await api1.slothlet.context.run({ outer: "yes" }, async () => {
    await api1.slothlet.context.run({ inner: "yes" }, () => {
        const ctx = api1.slothlet.context.get();
        // Should return: { inner: "yes" } (most recent .run() context) ✅
    });
});
```

### Question 2: Who needs parent chain vs instanceID lookup?

| Code Path | Needs | Current Implementation |
|-----------|-------|----------------------|
| **Function calls** (via UnifiedWrapper) | instanceID → instances.get() | ✅ Already correct |
| **context.get()** for same instance | ALS current store | ✅ Works via tryGetContext() |
| **context.get()** for different instance | instanceID → instances.get() | ❌ Uses parent chain (overcomplicated) |

## Architecture Options

### Option 1: Simplified Dual-Path (RECOMMENDED)

**Principle**: Use the RIGHT tool for the RIGHT job

```javascript
context.get: (key) => {
    // Path 1: Try to get current ALS context for THIS instance
    const currentCtx = slothlet.contextManager.tryGetContext();
    if (currentCtx && currentCtx.instanceID === slothlet.instanceID) {
        // We're inside a .run() for THIS instance - use it
        return key ? currentCtx.context[key] : { ...currentCtx.context };
    }
    
    // Path 2: Fall back to base instance context
    const baseStore = slothlet.contextManager.instances.get(slothlet.instanceID);
    const baseContext = baseStore?.context || {};
    return key ? baseContext[key] : { ...baseContext };
}
```

**Benefits**:
- Simpler logic (no parent chain traversal)
- Clearly separates two concerns
- Works for all scenarios above
- Consistent with UnifiedWrapper's approach

**Trade-off**:
- Scenario C (nested .run()) returns inner context ✅
- If you want outer context, you need to save it to a variable

### Option 2: Keep Parent Chain (CURRENT)

**Current implementation** searches parent chain to find matching instanceID.

**Problems**:
- More complex
- Duplicates what UnifiedWrapper already does
- Slower (O(n) search vs O(1) lookup)
- Harder to reason about

**Benefits**:
- Handles scenario C explicitly
- Can find any ancestor context for the same instance

### Option 3: Explicit Context Stack per Instance

Store a stack of .run() contexts per instance:

```javascript
// In contextManager
this.runStack = new Map(); // instanceID → Array<context>

// In .run()
const stack = this.runStack.get(instanceID) || [];
stack.push(mergedContext);
try {
    return callback();
} finally {
    stack.pop();
}

// In context.get()
const stack = contextManager.runStack.get(slothlet.instanceID);
const activeContext = stack[stack.length - 1]; // Most recent .run()
return activeContext || instances.get(slothlet.instanceID).context;
```

**Benefits**:
- Explicit tracking of .run() nesting
- No parent chain traversal
- Clear semantics

**Problems**:
- Requires synchronization between ALS and stack
- More state to manage
- Doesn't work well with async (stack could pop while async op still running)

### Option 4: ALS-Only for .run() Context

**Async Mode**: Keep using ALS as single source of truth
- .run() creates new ALS context
- context.get() checks if current ALS belongs to THIS instance
- Fall back to instances.get(instanceID) if not

**Live Mode**: Store currentInstanceID + mergedContext temporarily
- .run() sets currentInstanceID and merges into base context
- context.get() checks currentInstanceID === slothlet.instanceID
- Fall back to instances.get(instanceID) if not

**Benefits**:
- Leverages ALS strengths in async mode
- Simple fallback to instances Map
- No parent chain complexity

**Problems**:
- Live mode still has concurrency issues (modifies in place)

## Recommendation: Option 1 (Simplified Dual-Path)

**Rationale**:
1. ✅ **Separation of concerns**: .run() context vs base context are different things
2. ✅ **Consistent with UnifiedWrapper**: Uses instanceID → instances.get() pattern
3. ✅ **Simpler code**: No parent chain traversal
4. ✅ **Better performance**: O(1) lookup vs O(n) search
5. ✅ **Easier to understand**: Clear rules

**Implementation**:
- Remove parent chain search (lines 298-312)
- Use simple two-step lookup:
  1. Check if current ALS context belongs to this instance → use it
  2. Otherwise → use instances.get(slothlet.instanceID)

**Edge Cases**:
- Nested .run() for same instance: Returns innermost .run() context ✅
- Cross-instance calls: Returns correct instance's base context ✅
- .run() not active: Returns base context ✅

## Migration Path

1. **Add diagnostic tests** to verify current behavior
2. **Implement Option 1** in parallel (feature flag?)
3. **Compare results** across test suite
4. **Document breaking changes** if any
5. **Switch to new implementation**
6. **Remove parent chain code**

## Open Questions

1. Should nested .run() calls **merge** contexts or **replace** them?
   - Current: Replace (innermost wins)
   - Alternative: Merge (outer + inner)

2. Should we expose a way to get "base context" explicitly?
   - `context.getBase()` → always returns instances.get() context
   - `context.get()` → returns active .run() context if available

3. How to handle live mode concurrency issues?
   - Accept as limitation?
   - Add locking?
   - Make .run() clone in live mode too?

## Date Created
2026-01-28
