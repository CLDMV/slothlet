# Hook System Implementation

**Status**: ✅ Complete  
**Completed**: January 30, 2026  
**Related Files**: 
- `src/lib/handlers/hook-manager.mjs`
- `src/lib/handlers/unified-wrapper.mjs`
- `docs/HOOKS.md`
- `tests/vitests/suites/hooks/` (14 test files, 557 tests)

---

## Test Results

**All 557 hook tests passing (100%):**
- ✅ hooks-after-chaining.test.vitest.mjs (12/12)
- ✅ hooks-always-error-context.test.vitest.mjs (28/28)
- ✅ hooks-async-timing.test.vitest.mjs (8/8)
- ✅ hooks-before-chaining.test.vitest.mjs (12/12)
- ✅ hooks-comprehensive.test.vitest.mjs (88/88)
- ✅ hooks-debug.test.vitest.mjs (24/24)
- ✅ hooks-error-source.test.vitest.mjs (24/24)
- ✅ hooks-execution.test.vitest.mjs (80/80)
- ✅ hooks-internal-properties.test.vitest.mjs (28/28)
- ✅ hooks-mixed-scenarios.test.vitest.mjs (28/28)
- ✅ hooks-patterns.test.vitest.mjs (61/61)
- ✅ hooks-short-circuit.test.vitest.mjs (36/36)
- ✅ hooks-suppress-errors.test.vitest.mjs (36/36)
- ✅ hook-subsets.test.vitest.mjs (92/92)

**Baseline tests:** 34 files, 2,356 tests passing

---

## Implementation Highlights

### 1. Always Hook Timing Fix (January 30, 2026)

**Issue:** Always hooks were being called twice during short-circuit execution - once when the before hook short-circuited, and again in the finally block.

**Root Cause:** 
```javascript
// Before hook short-circuits
if (beforeResult.shortCircuit) {
    hookManager.executeAlwaysHooks(...); // Call #1
    return beforeResult.value;
}
// ... later in finally block
finally {
    if (hasHooks) {
        hookManager.executeAlwaysHooks(...); // Call #2 - BUG!
    }
}
```

**Fix:** Remove always hooks call from short-circuit block, set `finalResult` instead so finally block has correct value:
```javascript
if (beforeResult.shortCircuit) {
    finalResult = beforeResult.value; // Set for finally block
    return beforeResult.value;
}
// Finally block calls always hooks once with correct finalResult
```

**Tests Fixed:** hooks-always-error-context.test.vitest.mjs (4 short-circuit tests)

### 2. Async Function Always Hook Timing (January 30, 2026)

**Issue:** Need to verify always hooks fire in async promise chain, not in finally block.

**Solution:** Added `isAsync` flag:
```javascript
// Detect promise
if (result && typeof result === "object" && typeof result.then === "function") {
    isAsync = true; // Flag for finally block
    return result.then(
        (resolvedResult) => {
            // Always hooks fire here (in promise chain)
            hookManager.executeAlwaysHooks(...);
        }
    );
}

// Finally block checks flag
finally {
    if (hasHooks && !isAsync) { // Skip if async
        hookManager.executeAlwaysHooks(...);
    }
}
```

**Test Added:** hooks-async-timing.test.vitest.mjs (8 tests) - Uses synchronous checks (no await) to verify hooks don't fire in finally block for async functions.

### 3. Error Unwrapping for Hooks (January 30, 2026)

**Issue:** Caught errors are wrapped in SlothletError, but hooks should receive the original error.

**Solution:** Added `unwrapError()` helper:
```javascript
const unwrapError = (error) => {
    return error?.cause?.originalError || error;
};

// Use in error handling
const originalError = unwrapError(error);
hookManager.executeErrorHooks(..., originalError, ...);
```

**Tests Fixed:** hooks-always-error-context.test.vitest.mjs (error comparison tests)

### 4. Pattern Matching & API Features (January 30, 2026)

**Features Implemented:**
- ✅ Brace expansion: `{a,b,c}` → matches "a", "b", or "c"
- ✅ Negation: `!pattern` → matches anything except pattern
- ✅ Max brace nesting depth validation (10 levels)
- ✅ `apiDepth` config for directory traversal depth limiting
- ✅ `list()` API returns `{ registeredHooks: [...] }` object
- ✅ String shorthand support for type detection
- ✅ Diagnostic API: `api.slothlet.diag.hook.compilePattern()`

**Tests Fixed:** 
- hooks-patterns.test.vitest.mjs (61/61)
- hooks-debug.test.vitest.mjs (24/24)

### 5. Hook Subsets Implementation (January 30, 2026)

**Features:**
- ✅ Subset ordering: before → primary → after
- ✅ Priority sorting within each subset
- ✅ Error context enhancement: added `errorType` and `subset` to sourceInfo
- ✅ SlothletError `new` keyword fixes (7 locations)
- ✅ i18n translations for hook errors

**Tests Fixed:** hook-subsets.test.vitest.mjs (92/92)

### 6. Error Suppression (January 30, 2026)

**Feature:** `suppressErrors: true` config prevents hook errors from throwing

**Key Insight:** Hook errors don't short-circuit function execution - the chain continues even when hooks fail. This prevents a failing hook from breaking the entire application.

**Tests Fixed:** hooks-suppress-errors.test.vitest.mjs (36/36)

---

## Overview

Implemented a comprehensive hook system for V3 that allows intercepting and modifying API function calls through before/after/always/error hooks. The implementation follows V2's proven synchronous execution pattern while properly handling both synchronous and asynchronous functions.

---

## Key Features

### Hook Types

1. **Before Hooks** (`before`)
   - Execute before the target function
   - Can modify arguments via `modifiedArgs`
   - Can short-circuit execution via `shortCircuit: true` and return custom values
   - Executed synchronously

2. **After Hooks** (`after`)
   - Execute after successful function completion
   - Receive the function's result
   - Can transform the result via `modifiedResult`
   - Timing depends on whether function is sync or async (see below)

3. **Always Hooks** (`always`)
   - Execute regardless of success or failure (like `finally`)
   - Receive result or error information
   - Timing depends on whether function is sync or async (see below)

4. **Error Hooks** (`error`)
   - Execute only when an error occurs
   - Can modify or suppress errors
   - Timing depends on whether function is sync or async (see below)

---

## Critical Design Decision: Synchronous Hook Execution

### The Pattern

The hook system executes hooks **synchronously** while intelligently handling both sync and async functions:

```javascript
// Before hooks always execute synchronously
const beforeResult = hookManager.executeBeforeHooks(...);

// Execute the target function
const result = Reflect.apply(target, thisArg, args);

// Detect if result is a Promise
if (result && typeof result.then === "function") {
    // ASYNC PATH: Attach hooks to Promise chain (non-blocking!)
    return result.then(
        (resolvedResult) => {
            const afterResult = hookManager.executeAfterHooks(...);
            hookManager.executeAlwaysHooks(...);
            return resolvedResult;
        },
        (error) => {
            hookManager.executeErrorHooks(...);
            hookManager.executeAlwaysHooks(...);
            throw error;
        }
    );
}

// SYNC PATH: Execute hooks immediately
const afterResult = hookManager.executeAfterHooks(...);
hookManager.executeAlwaysHooks(...);
return result;
```

### Why This Approach?

This pattern provides **optimal behavior for both sync and async functions**:

#### For Synchronous Functions:
- Before hooks execute synchronously (minimal overhead)
- Function executes synchronously
- After/always hooks execute synchronously (minimal overhead)
- **Result**: Slight blocking from hook execution, but maintains synchronous behavior

#### For Asynchronous Functions:
- Before hooks execute synchronously (only blocks before Promise creation)
- Function executes and **returns Promise immediately** (non-blocking!)
- After/error/always hooks **attach to Promise chain** via `.then()`
- Hooks execute when Promise resolves/rejects (non-blocking!)
- **Result**: No event loop blocking, proper async behavior maintained

### Event Loop Impact

**Key Point**: The hook system does NOT block the event loop for async functions!

- **Before hooks**: Execute before Promise is created (unavoidable, minimal impact)
- **After/error/always hooks**: Attached via `.then()` and execute when Promise settles
- **No forced async conversion**: Sync functions return sync values, async functions return Promises

This is superior to making everything async, which would:
- Force ALL functions to return Promises (breaking EAGER mode expectations)
- Add unnecessary overhead to synchronous operations
- Break existing code expecting synchronous return values

---

## Implementation Details

### Hook Manager (src/lib/handlers/hook-manager.mjs)

All hook execution methods are **synchronous**:

```javascript
executeBeforeHooks(hookContext) {
    // Synchronous execution - no async/await
    const result = hook.handler(hookContext);
    // ...
}

executeAfterHooks(hookContext) {
    // Synchronous execution - no async/await
    const result = hook.handler(hookContext);
    // ...
}

executeAlwaysHooks(hookContext) {
    // Synchronous execution - no async/await
    hook.handler(hookContext);
}

executeErrorHooks(hookContext) {
    // Synchronous execution - no async/await
    hook.handler(hookContext);
}
```

### Unified Wrapper Integration (src/lib/handlers/unified-wrapper.mjs)

The `applyTrap` (lines 960-1106) integrates hooks using the synchronous pattern:

1. **Lines 965-969**: Check if hooks are enabled for this API path
2. **Lines 975-984**: Execute before hooks synchronously, handle short-circuit
3. **Lines 986-1046**: Lazy materialization logic (unchanged)
4. **Lines 1048-1074**: Execute target function, capture result
5. **Lines 1078-1095**: If Promise detected, attach after/always/error hooks via `.then()`
6. **Lines 1098-1102**: If sync result, execute after/always hooks immediately
7. **Lines 1103-1109**: Catch block for sync errors, execute error/always hooks

---

## Pattern Recognition: Promise Detection

The system uses a simple, reliable pattern to detect Promises:

```javascript
if (result && typeof result.then === "function") {
    // It's a Promise (or thenable)
}
```

This works because:
- Native Promises have a `.then()` method
- Async functions always return Promises
- The pattern is duck-typing compliant (works with Promise-like objects)
- No need for `instanceof Promise` checks

---

## Why Not Async Hooks?

**Q**: Why not make hooks async so they can support async operations?

**A**: Because that forces ALL functions to return Promises, breaking EAGER mode:

```javascript
// If hooks were async:
async function applyTrap(target, thisArg, args) {
    await executeBeforeHooks(...);  // Forces Promise
    const result = Reflect.apply(...);
    await executeAfterHooks(...);   // Forces Promise
    return result;  // ALWAYS returns Promise!
}

// Result:
api.math.add(2, 3);  // Returns Promise {5} instead of 5
```

This breaks the fundamental contract of EAGER mode: synchronous functions must return values synchronously.

**Q**: Can we support async for async functions and sync for sync?

**A**: We already do! That's exactly what the V2 pattern achieves:
- Hooks themselves are synchronous functions
- The *timing* of when they execute depends on the wrapped function
- Async functions get hooks attached to Promise chains (non-blocking)
- Sync functions get hooks executed immediately (minimal blocking)

---

## Hook Handler Requirements

Hook handlers receive a `hookContext` object and must be synchronous functions:

```javascript
// ✅ CORRECT: Synchronous hook handler
slothlet.hook.add("before", "api.math.*", (context) => {
    console.log("Calling:", context.apiPath);
    console.log("Args:", context.args);
    
    // Can modify args
    return { modifiedArgs: [10, 20] };
    
    // Can short-circuit
    return { shortCircuit: true, value: 42 };
});

// ❌ WRONG: Async hook handler
slothlet.hook.add("after", "api.db.*", async (context) => {
    await logToDatabase(context);  // This won't work as expected!
    return { modifiedResult: context.result };
});
```

**Why synchronous only?**
1. Keeps implementation simple and predictable
2. Prevents event loop blocking for most use cases
3. If you need async operations, do them in the wrapped function itself
4. Hooks are for interception/transformation, not heavy async work

---

## Testing

All baseline tests pass with the hook system enabled:
- ✅ 1695/1695 baseline tests passing (19 test files)
- ✅ 160/160 collision-config tests passing
- ✅ 56/56 add-api tests passing

Tests validate:
- EAGER mode returns synchronous values (no unwanted Promises)
- LAZY mode returns Promises correctly
- Hook execution doesn't break existing functionality
- Module ownership registration works with hooks

---

## Related Changes

### ModuleId Propagation

As part of the hook system implementation, fixed moduleId propagation through the call chain:

**Modified Files**:
- `src/lib/handlers/api-manager.mjs` (lines 464, 489)
- `src/lib/builders/api-assignment.mjs` (lines 110, 349, 390)
- `src/lib/handlers/unified-wrapper.mjs` (ownership registration)

**Issue**: Module ownership registration was failing with `moduleId null` errors during `impl:changed` lifecycle events.

**Solution**: Pass `moduleId` through entire call chain:
1. `api-manager.mjs` passes moduleId in options to `mergeApiObjects`
2. `api-assignment.mjs` extracts moduleId from options and passes to `assignToApiPath`
3. `assignToApiPath` passes moduleId to `syncWrapper`
4. `unified-wrapper.mjs` receives moduleId for ownership registration

---

## Migration from V2

The V3 hook system follows V2's proven synchronous pattern:

**V2 Reference**:
- `src2/lib/runtime/runtime-asynclocalstorage.mjs` (lines 150-280)
- `src2/lib/helpers/hooks.mjs` (lines 320-450)

**Key Differences**:
- V3 uses class-based architecture (HookManager class)
- V3 integrates with unified-wrapper.mjs (unified lazy/eager handling)
- Same synchronous execution pattern
- Same Promise detection and `.then()` attachment pattern

---

## Future Considerations

### Potential Enhancements

1. **Async Hook Support** (if needed)
   - Could add separate `beforeAsync`, `afterAsync` hook types
   - These would force Promise returns (explicit opt-in)
   - Most use cases don't need this

2. **Hook Priority/Ordering**
   - Currently hooks execute in registration order
   - Could add priority levels if needed

3. **Hook Performance Metrics**
   - Track hook execution time
   - Warn if hooks are slowing down calls significantly

4. **Hook Composition**
   - Allow hooks to depend on other hooks
   - Create hook chains/pipelines

---

## Lessons Learned

### Critical Mistake: Reverting Without Backup

During implementation, an error was made reverting `unified-wrapper.mjs` to a previous commit without backing up the hook integration work. This nuked hours of changes.

**Lesson**: Always back up work before reverting, especially in complex integration work.

**Recovery**: After investigating V2's implementation, correctly reimplemented hooks following the synchronous pattern.

### Understanding V2's Design

Investigating V2's source code revealed why hooks were synchronous:
- Maintains synchronous behavior for sync functions (no forced Promises)
- Handles async functions gracefully via Promise detection
- No event loop blocking for async operations
- Optimal performance for both sync and async cases

This validated the synchronous approach and provided a clear implementation path.

---

## Documentation

Complete hook system documentation available in:
- **API Reference**: `docs/HOOKS.md`
- **Implementation**: This changelog entry
- **Examples**: `api_tests/` (various hook usage patterns)

---

## Summary

The V3 hook system successfully provides powerful function interception capabilities while maintaining optimal performance characteristics for both synchronous and asynchronous functions. By following V2's proven synchronous pattern, the implementation avoids forcing all functions to return Promises while properly handling async operations through Promise chain attachment.

**Key Takeaway**: The hooks themselves are synchronous, but the system intelligently handles both sync and async functions without blocking the event loop for async operations.
