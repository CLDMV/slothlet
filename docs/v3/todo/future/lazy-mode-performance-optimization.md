# Lazy Mode Performance Optimization

**Status**: Future investigation  
**Priority**: Medium  
**Date Created**: 2026-01-31

## Problem Statement

V3's lazy mode materialization takes noticeably longer than v2's lazy mode. While both are async, v3 requires ~20ms delay for materialization to complete where v2 completed nearly instantly. This isn't an architectural flaw - both work asynchronously - but v3 has more overhead.

## Observed Timing

- **V2**: Materialization completes within ~1-5ms (usually before synchronous property access)
- **V3**: Materialization requires ~10-20ms to complete
- **Impact**: Tests need `setTimeout(20ms)` where v2 worked without delays

## Suspected Bottlenecks

### 1. UnifiedWrapper Creation Overhead
Every property gets wrapped in a new UnifiedWrapper instance with:
- Proxy creation
- Metadata initialization  
- Context setup
- State management
- Child cache initialization

### 2. `_adoptImplChildren()` Processing
For each property in materialized object:
- Create descriptor
- Check if value is proxy/function/object
- Create child wrapper with metadata inheritance
- Store in `_childCache`
- Delete from `_impl` (if configured)
- Handle special cases (Map, Set, TypedArrays, etc.)

### 3. Lifecycle Event Overhead
Emits `impl:created` event for:
- Each module object
- Each property/function in the module
- Creates event payload with full metadata
- Processes through event handler system

### 4. Metadata Tagging
Each wrapper and property gets:
- System metadata (filePath, moduleId, sourceFolder)
- User metadata inheritance
- Metadata manager lookups and storage

## Investigation Tasks

### Profile Materialization
1. Add timing instrumentation to key methods:
   - `_materialize()` total time
   - `_adoptImplChildren()` time
   - Individual wrapper creation time
   - Lifecycle event emission time
   - Metadata operations time

2. Test with different module sizes:
   - Simple module (1-2 exports)
   - Medium module (10-20 exports)
   - Large module (50+ exports)
   - Nested modules (folders with subfolders)

3. Compare v2 vs v3 timing breakdowns:
   - Where does v2 spend time?
   - What's different in v3?
   - Which v3 features add most overhead?

### Optimization Opportunities

#### Option 1: Lazy Child Wrapper Creation
Instead of wrapping all properties immediately, create wrappers on-demand:
- Store raw values in `_childCache` initially
- Wrap only when accessed
- Reduces upfront cost, spreads over time

**Pros**: Faster initial materialization  
**Cons**: Slightly slower first access, more complex logic

#### Option 2: Batch Lifecycle Events
Instead of emitting per-property:
- Batch all events for a module
- Emit single "module:materialized" event
- Include all properties in payload

**Pros**: Reduces event system overhead  
**Cons**: Changes event structure, may break listeners

#### Option 3: Conditional Wrapping
Skip wrapper creation for simple cases:
- Primitives don't need wrappers
- Pure functions without metadata
- Objects without special handling

**Pros**: Significant reduction in wrapper count  
**Cons**: Requires classification logic, metadata may be lost

#### Option 4: Metadata Optimization
Defer metadata operations:
- Store minimal metadata initially
- Compute full metadata on-demand
- Use WeakMap for lazy metadata lookup

**Pros**: Faster initialization  
**Cons**: Slower metadata access when needed

#### Option 5: Fast Path for Common Cases
Detect common patterns and optimize:
- Single default export → no wrapping needed
- Object with only functions → batch process
- No lifecycle listeners → skip events

**Pros**: Best of both worlds  
**Cons**: Adds complexity, multiple code paths

## Testing Requirements

Any optimization must:
1. Pass all existing tests
2. Maintain metadata accuracy
3. Preserve lifecycle event data
4. Keep inspection working correctly
5. Not break context isolation
6. Maintain custom proxy behavior

## Success Criteria

- Reduce lazy mode materialization time to <10ms
- Maintain feature parity with current implementation
- No regression in functionality or correctness
- Benchmarks show improvement across module sizes

## Notes

- This is a timing optimization, not a correctness fix
- Current behavior is correct, just slower than v2
- Users can work around with small delays if needed
- May be acceptable tradeoff for v3's features (better inspection, metadata, hooks, etc.)

## Related Files

- `src/lib/modes/lazy.mjs` - Lazy mode implementation
- `src/lib/handlers/unified-wrapper.mjs` - Wrapper creation and `_adoptImplChildren()`
- `src/lib/handlers/lifecycle.mjs` - Event emission system
- `src/lib/handlers/metadata.mjs` - Metadata management
- `tests/vitests/suites/proxies/proxy-baseline.test.vitest.mjs` - Performance-sensitive tests
