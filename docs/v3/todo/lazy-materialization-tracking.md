# Lazy Mode Background Materialization Tracking

**Last Evaluated:** 2026-02-06

**Status:** 📋 Planning / Research  
**Created:** January 29, 2026  
**Priority:** Medium  
**Category:** Performance & Developer Experience

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

## Overview

Explore implementing a system to track lazy folder materialization state across the entire API, with the ability to detect when all lazy folders have been materialized and emit an event.

## Current State

Slothlet's lazy mode uses proxy-based deferred loading where folders are wrapped in lazy proxies that materialize on first access. Currently:

- Each `UnifiedWrapper` tracks its own materialization state via `_state.materialized`
- No global tracking of how many lazy folders exist in the API
- No way to know when the entire API tree is fully materialized
- No events emitted for materialization milestones

## Proposed Feature

### Goal
Track the count of unmaterialized lazy folders in the current API instance and provide access via `api.slothlet.materialize` namespace. Expose boolean state, detailed statistics, and wait functionality.

### Use Cases

1. **Performance Monitoring**: Measure when API becomes "fully loaded" via `api.slothlet.materialize.materialized`
2. **Testing**: Wait for full materialization before running tests via `await api.slothlet.materialize.wait()`
3. **Debugging**: Understand materialization patterns via `api.slothlet.materialize.get()`
4. **Preloading**: Implement strategic preloading after initial critical path
5. **Metrics**: Track materialization time per module or total tree depth

## Technical Considerations

### Tracking Approach Options

#### Option 1: Central Registry
- Maintain a `Set` or `Map` in Slothlet instance tracking all lazy wrappers
- Increment count when lazy wrapper is created
- Decrement count when wrapper materializes
- Emit event when count reaches zero

**Pros:**
- Simple, centralized tracking
- Minimal wrapper overhead
- Easy to query current state

**Cons:**
- Memory overhead for large APIs (weak references?)
- Need to handle wrapper garbage collection
- Circular reference concerns

#### Option 2: Recursive Tree Walk
- On-demand traversal of API tree counting unmaterialized wrappers
- No persistent state needed
- Query when needed via method like `slothlet.countUnmaterialized()`

**Pros:**
- No memory overhead
- No lifecycle management
- Always accurate (no stale data)

**Cons:**
- O(n) traversal cost per query
- Can't emit events automatically
- May miss transient states

#### Option 3: Hybrid Approach
- Maintain count but verify via tree walk periodically
- Use weak references for wrapper tracking
- Emit events based on count, validate on critical paths

**Pros:**
- Balance of performance and accuracy
- Self-correcting mechanism
- Event-driven capabilities

**Cons:**
- Most complex to implement
- Potential race conditions

### Implementation Details

#### New Properties on Slothlet Instance

```javascript
// Option 1: Central Registry
class Slothlet {
    _lazyWrappers = new WeakSet(); // Track all lazy wrappers
    _unmaterializedCount = 0;      // Current count
    _materializationEvents = new EventEmitter();
    
    // Or simpler:
    _unmaterializedLazy = new Set(); // Set of wrapper references
}
```

#### Wrapper Lifecycle Hooks

```javascript
// In UnifiedWrapper creation (lazy mode)
constructor(...) {
    if (mode === "lazy") {
        this.slothlet._registerLazyWrapper(this);
    }
}

// In materialization
async materialize() {
    // ... existing materialization logic
    this.slothlet._onWrapperMaterialized(this);
}
```

#### Event API

```javascript
// Public API via api.slothlet.materialize namespace
const { api } = await slothlet.load("./modules");

// Check materialization state
api.slothlet.materialize.materialized // => boolean (true when all lazy folders materialized)

// Get detailed state
api.slothlet.materialize.get() // => { total, materialized, remaining, percentage }

// Wait for full materialization
await api.slothlet.materialize.wait() // => Promise<void> (resolves when fully materialized)

// Events (via internal emitter if needed)
slothlet.on('materialized:complete', () => {
    console.log('All lazy folders materialized!');
});

slothlet.on('materialized:progress', ({ total, remaining, percentage }) => {
    console.log(`Materialization: ${percentage}% (${remaining}/${total} remaining)`);
});
```

### Edge Cases to Consider

1. **Dynamic API Changes**: Hot reload adds new lazy folders after "complete" event
2. **Nested Lazy Folders**: Parent materializes but reveals child lazy folders
3. **Circular Dependencies**: Wrapper A materializes wrapper B which materializes A
4. **Garbage Collection**: Wrapper goes out of scope before materializing
5. **Multiple Instances**: Each Slothlet instance needs independent tracking
6. **Concurrent Materialization**: Multiple folders materializing simultaneously

### Performance Implications

- **Memory**: Small overhead per lazy wrapper (WeakSet entry or Set reference)
- **CPU**: Increment/decrement operations on materialization (negligible)
- **Event Emission**: Only when count reaches zero (one-time cost)

### Testing Strategy

1. **Unit Tests**: Test counter increment/decrement logic
2. **Integration Tests**: Verify count accuracy with real API structures
3. **Edge Case Tests**: Dynamic changes, nested folders, GC scenarios
4. **Performance Tests**: Measure overhead impact on existing benchmarks

## Questions to Resolve

1. **Nested Lazy Detection**: How do we count lazy folders that are revealed only after parent materialization?
   - Track recursively as they're discovered?
   - Count only "root" lazy folders?
   - Provide separate counts for "discovered" vs "remaining"?

2. **WeakSet vs Set**: Should we use weak references to avoid memory leaks?
   - WeakSet can't be sized or iterated
   - Regular Set requires manual cleanup
   - Is cleanup necessary given wrapper lifecycle?

3. **Event Timing**: When to emit progress events?
   - On every materialization (potentially noisy)?
   - Only on significant milestones (25%, 50%, 75%, 100%)?
   - Throttled/debounced?

4. **API Surface**: What level of detail to expose via `api.slothlet.materialize`?
   - `materialized` (boolean) - simple state check
   - `get()` returns object with `{ total, materialized, remaining, percentage }`
   - `wait()` returns Promise that resolves when fully materialized
   - Optional: Full list of unmaterialized paths?
   - Optional: Tree structure with materialization states?

5. **Hot Reload Integration**: How does this interact with hot reload?
   - Reset counts?
   - Continue tracking across reloads?
   - Separate tracking per reload generation?

## Implementation Phases

### Phase 1: Basic Tracking (MVP)
- Add `_unmaterializedCount` to Slothlet
- Increment on lazy wrapper creation
- Decrement on materialization
- Expose `api.slothlet.materialize.materialized` boolean

### Phase 2: Detailed State & Wait Function
- Implement `api.slothlet.materialize.get()` returning state object
- Implement `api.slothlet.materialize.wait()` returning Promise
- Add internal event emitter for 'materialized:complete'

### Phase 3: Advanced Tracking & Events
- Add progress events with percentages via internal emitter
- Add debug logging for materialization timeline
- Optional: Expose event listening via `api.slothlet.materialize.on()`

### Phase 4: Nested Discovery
- Track nested lazy folders as they're discovered
- Provide separate counts for "known" vs "remaining"
- Handle dynamic API changes gracefully

## Related Code

### Key Files
- [src/lib/unified-wrapper.mjs](../../src/lib/unified-wrapper.mjs) - Wrapper creation and materialization
- [src/slothlet.mjs](../../src/slothlet.mjs) - Slothlet main class (internal tracking state)
- [src/lib/builders/api-assignment.mjs](../../src/lib/builders/api-assignment.mjs) - API construction (initial count setup)
- [src/lib/runtime/runtime.mjs](../../src/lib/runtime/runtime.mjs) - Runtime exports (add `api.slothlet.materialize` namespace)

### Relevant Sections
- `UnifiedWrapper` constructor (mode === "lazy" detection)
- `UnifiedWrapper._materialize()` method (materialization hook point)
- `ApiAssignment.assignToApiPath()` (lazy wrapper assignment detection)

## References

- **Similar Patterns**: Module bundlers (Webpack, Rollup) track chunk loading
- **Event Patterns**: Node.js `EventEmitter`, DOM `addEventListener`
- **Lazy Loading**: React lazy(), Vue defineAsyncComponent()

## Next Steps

1. Review with maintainers/stakeholders
2. Prototype Option 1 (Central Registry) as simplest approach
3. Add tests for basic count tracking
4. Validate performance impact
5. Iterate based on real-world usage patterns

---

**Notes:**
- This is a non-breaking additive feature
- Exposed via `api.slothlet.materialize` namespace (consistent with framework utilities pattern)
- Should be opt-in via config flag initially: `config.tracking.materialization = true`
- Consider exposing in debug output for development visibility
- May want to integrate with existing `config.debug.api` logging
- Internal tracking in Slothlet instance, public API via runtime exports
