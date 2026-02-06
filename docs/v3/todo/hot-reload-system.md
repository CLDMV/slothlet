# Hot Reload System Implementation

**Status:** ❌ NOT IMPLEMENTED (Selective Reload)  
**Last Updated:** 2026-02-06

## Status: Mixed Results

### ✅ Completed Features

#### ✅ Full Instance Reload (`api.slothlet.reload()`)
- **Status**: COMPLETE & WORKING
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
1. **Proxy Forwarding**: `boundApi` proxy forwards to `this.api` (updated on reload)
2. **Cache Busting**: Temporary instance IDs force ESM re-import
3. **Operation Replay**: Chronological replay of `add()`/`remove()` calls
4. **Context Preservation**: Instance ID maintained for AsyncLocalStorage continuity

### ⚠️ Issues Found

#### ❌ Selective Module Reload (`api.slothlet.api.reload(pathOrModuleId)`)
- **Status**: NOT PROPERLY IMPLEMENTED
- **Tests**: 48 failed / 56 total (14% pass rate) - 86% failure
- **Implementation**: `src/lib/handlers/api-manager.mjs` - `reloadApiComponent()` method
- **Test File**: `tests/vitests/suites/core/core-reload-selective.test.vitest.mjs` (may not be fully v3-compatible)

**Note**: Only baseline tests (2356 tests) are confirmed v3-compatible. This test file may need updates in addition to implementation fixes.

**Intended API**:
```javascript
// Reload single module by API path
await api.slothlet.api.reload("math.advanced");

// Reload by moduleID
await api.slothlet.api.reload(moduleID);

// Reload subtree
await api.slothlet.api.reload("plugins");
```

**Current Issues** (from test failures):

1. **Custom properties lost**: Properties added to API paths (`api.custom.testFlag = true`) become `undefined` after selective reload
2. **Hooks not reapplied**: `api.math.add(5, 5)` returns `10` instead of `1010` (hook should add 1000, not being reapplied)
3. **Context lifecycle broken**: 4 unhandled `CONTEXT_NOT_FOUND` errors - instances shut down prematurely
   ```
   SlothletError: [CONTEXT_NOT_FOUND] Context not found for instance 'slothlet_xxx'.
   Instance may have been shut down. Available instances: []
   ```
4. **Type handling broken in lazy mode**: `typeof api.custom` returns `"function"` instead of `"object"`
5. **Error handling missing**: Reload of removed component returns `undefined` instead of throwing error
6. **Sibling isolation broken**: Nested child reload (`api.parent.child1`) affects siblings when it shouldn't

**Implementation Gaps** (what needs to be built):

1. **Property preservation system**:
   - Capture all custom properties before reload
   - Restore custom properties after reload
   - Test case: `api.custom.testFlag = true` → reload → should still be `true`

2. **Hook reapplication**:
   - Store registered hooks per module
   - Replay hooks during selective reload
   - Test case: math.add hook (adds 1000) must be reapplied

3. **Context lifecycle management**:
   - Fix premature instance shutdown
   - Ensure UnifiedWrapper context lookup works during reload
   - Prevent `Available instances: []` errors

4. **Type handling for lazy mode**:
   - Special handling for lazy proxy materialization during reload
   - Ensure `typeof` checks return correct types after reload

5. **Error handling**:
   - Validate component exists before reload
   - Throw error when reloading removed component (currently returns `undefined`)

6. **Isolation guarantees**:
   - Ensure selective reload scope is properly bounded
   - Nested child reload must not affect siblings
   - Only target module + explicit dependencies should change

---

## Implementation History

### Phase 1: Foundation (January 2026)
- ✅ Proxy-based reference preservation system
- ✅ ESM/CJS cache busting mechanisms
- ✅ Operation history tracking in api-manager
- ✅ Console.log display fix for UnifiedWrapper proxies

### Phase 2: Full Instance Reload (January 2026)
- ✅ Complete instance reload with preserved instance ID
- ✅ Chronological operation replay (add/remove)
- ✅ Custom property cleanup during reload
- ✅ All 56 tests passing (100%)

### Phase 3: Selective Reload (February 2026)
- 🟡 Partial implementation in `src/lib/handlers/api-manager.mjs` (incomplete)
- ⚠️ Tests written but 86% failing (48/56 tests)
- ❌ Custom property preservation not implemented
- ❌ Hook reapplication system not implemented
- ❌ Context lifecycle broken (premature shutdown)
- ❌ Lazy mode type handling broken
- ❌ Error handling not implemented
- ❌ Sibling isolation not working

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

### Full Instance Reload Tests
- **File**: `tests/vitests/suites/core/core-reload-full.test.vitest.mjs`
- **Status**: ✅ 56/56 tests passing (100%)
- **Coverage**: basic reload, operation replay, context preservation, multiple reloads, error handling

### Selective Module Reload Tests
- **File**: `tests/vitests/suites/core/core-reload-selective.test.vitest.mjs`
- **Status**: ❌ 8/56 tests passing (14% pass rate)
- **Error**: `CONTEXT_NOT_FOUND` - Context not found for instance, instance may have been shut down
- **Coverage**: API path reload, moduleID reload, nested path reload, removed component handling

### Metadata Reload Tests
- **File**: `tests/vitests/suites/metadata/metadata-reload.test.vitest.mjs`
- **Status**: Tests for `api.slothlet.api.reload()` partial reload
- **Coverage**: Metadata preservation during selective reload operations

---

## Action Items

### High Priority - Fix Selective Reload
- [ ] Debug `CONTEXT_NOT_FOUND` errors in selective reload tests
- [ ] Fix context lifecycle management during `api.slothlet.api.reload()`
- [ ] Prevent premature instance cleanup during selective reload
- [ ] Ensure UnifiedWrapper context lookup works during reload
- [ ] Get all 56 selective reload tests passing

### Medium Priority - Documentation
- [ ] User guide: how to use reload in production
- [ ] Performance benchmarks: full vs selective reload
- [ ] Best practices: when to use full vs selective reload
- [ ] Migration guide: updating code for hot reload support

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

## Documentation Status

- ✅ Implementation complete in `src/slothlet.mjs` (full reload)
- ✅ Implementation complete in `src/lib/handlers/api-manager.mjs` (selective reload)
- ✅ JSDoc documentation complete for both reload methods
- ✅ Test coverage written for full reload (100% passing)
- ⚠️ Test coverage written for selective reload (86% failing)
- ❌ Selective reload needs debugging before production use
- 🔄 User guide pending (how to use reload in production)
- 🔄 Performance benchmarks pending
