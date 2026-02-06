# Hot Reload System Implementation

**Last Evaluated:** 2026-02-06

## Status: Partially Complete ✅

### Completed Features

#### ✅ Full Instance Reload (`api.slothlet.reload()`)
- **Status**: COMPLETE
- **Tests**: 56/56 passing (100%)
- **Implementation**: `src/slothlet.mjs` - `async reload()` method
- **Features**:
  - Fresh module loading with ESM/CJS cache busting
  - Preserves instance ID and user reference to API object
  - Replays operation history (add/remove API calls)
  - Maintains context isolation across reload
  - Console.log display fix for nested objects
  - UnifiedWrapper proxy forwarding system

**Technical Details**:
```javascript
// User keeps same reference across reloads
const api = await slothlet({ dir: "./api" });
api.customProp = "test"; // Custom properties

// Reload clears everything and rebuilds
await api.slothlet.reload();

// Custom properties gone, modules refreshed
console.log(api.customProp); // undefined
console.log(api.config); // Shows actual nested values, not {}
```

**Key Mechanisms**:
1. **Proxy Forwarding**: `boundApi` proxy forwards to `_currentApi` (updated on reload)
2. **Cache Busting**: Temporary instance IDs force ESM re-import
3. **Operation Replay**: Chronological replay of `add()`/`remove()` calls
4. **Context Preservation**: Instance ID maintained for AsyncLocalStorage continuity

### Pending Features

#### 🔄 Targeted Module Reload (`api.slothlet.reload("path")`)
- **Status**: NOT STARTED
- **Tests**: Not yet written
- **Priority**: Medium
- **Description**: Reload specific module or subtree without full instance reload

**Planned API**:
```javascript
// Reload single module
await api.slothlet.reload("math.advanced");

// Reload subtree
await api.slothlet.reload("plugins");
```

**Requirements**:
- Selective cache invalidation (only target module + dependencies)
- Preserve non-reloaded modules in memory
- Update ownership tracking for replaced modules only
- Maintain context for non-reloaded parts
- Handle dependency graph updates

**Challenges**:
- Dependency tracking (which modules depend on reloaded module?)
- Partial ownership updates (don't clear entire history)
- Lazy wrapper invalidation (materialized proxies must re-lazy)
- Reference preservation for parent objects containing reloaded module

---

## Implementation History

### Phase 1: Foundation (January 2026)
- ✅ Proxy-based reference preservation system
- ✅ ESM/CJS cache busting mechanisms
- ✅ Operation history tracking in api-manager
- ✅ Console.log display fix for UnifiedWrapper proxies

### Phase 2: Full Reload (January 2026)
- ✅ Complete instance reload with preserved instance ID
- ✅ Chronological operation replay (add/remove)
- ✅ Custom property cleanup during reload
- ✅ All 56 reload tests passing

### Phase 3: Targeted Reload (Pending)
- 🔄 Selective module invalidation
- 🔄 Dependency graph tracking
- 🔄 Partial ownership updates
- 🔄 Reference preservation for non-reloaded modules

---

## Design Decisions

### Why Proxy Forwarding?
JavaScript doesn't allow reassigning through references:
```javascript
let api = { x: 1 };
const ref = api;
api = { x: 2 }; // ref still points to { x: 1 }
```

Solution: `boundApi` is a stable proxy that forwards to mutable `_currentApi`:
```javascript
this.boundApi = new Proxy(function(){}, {
  get: (target, prop) => this._currentApi[prop],
  // ... other traps
});
```

### Why Operation Replay?
Users can modify API at runtime:
```javascript
await api.slothlet.api.add("plugins", "./plugins");
await api.slothlet.api.remove("test-module");
```

Reload must restore these modifications:
1. Save operation history before reload
2. Fresh load (clean slate)
3. Replay operations in chronological order

### Why Custom Property Cleanup?
Users can attach runtime properties:
```javascript
api.customProp = "runtime-value";
api.config.tempData = { ... };
```

Reload should restore "clean" state (only module exports, no runtime mutations).

---

## Related Systems

### Dependencies
- **Context Manager** (`src/lib/runtime/`) - Instance ID and AsyncLocalStorage
- **API Manager** (`src/lib/handlers/api-manager.mjs`) - Operation history tracking
- **Ownership Manager** (`src/lib/handlers/ownership.mjs`) - Module ownership and rollback
- **UnifiedWrapper** (`src/lib/handlers/unified-wrapper.mjs`) - Proxy system and cache
- **Modes Processor** (`src/lib/builders/modes-processor.mjs`) - Module loading

### Integration Points
- Lifecycle events (`impl:created`, `impl:changed`, `impl:removed`)
- Ownership registration and rollback
- Context store management
- Module cache invalidation

---

## Testing

### Full Reload Tests (`tests/vitests/suites/core/core-reload-full.test.vitest.mjs`)
- ✅ 56/56 tests passing (100%)
- Covers: basic reload, operation replay, context preservation, multiple reloads, error handling

### Targeted Reload Tests
- 🔄 Not yet implemented

---

## Future Enhancements

### Hot Module Replacement (HMR)
- Watch file system for changes
- Auto-trigger targeted reload on file save
- Preserve application state across reloads
- IDE integration (VS Code extension?)

### Reload Hooks
```javascript
api.slothlet.hooks.before("reload", async (modules) => {
  // Cleanup before reload
});

api.slothlet.hooks.after("reload", async (modules) => {
  // Re-initialize after reload
});
```

### Dependency Graph
- Track which modules import which other modules
- Intelligent cascading reloads (reload dependents too)
- Circular dependency detection and handling

---

## Documentation

- ✅ Implementation complete in `src/slothlet.mjs`
- ✅ JSDoc documentation complete
- ✅ Test coverage 100% for full reload
- 🔄 User guide pending (how to use reload in production)
- 🔄 Performance benchmarks pending
