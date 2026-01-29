# Architecture Discussion: Scope/Run Context Management with InstanceID

## Problem Statement

We have **two separate but related concerns** when managing context:

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
