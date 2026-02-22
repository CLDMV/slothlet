# Hot Reload System Implementation

**Status:** ✅ COMPLETE  
**Last Updated:** 2026-02-10

## Summary

All three hot reload modes are fully implemented, tested, and in the baseline test suite:

| Feature | Status | Tests | Test File |
|---------|--------|-------|-----------|
| Full Instance Reload (`api.slothlet.reload()`) | ✅ Complete | 56/56 | `core-reload-full.test.vitest.mjs` |
| Selective Module Reload (`api.slothlet.api.reload(pathOrModuleId)`) | ✅ Complete | 56/56 | `core-reload-selective.test.vitest.mjs` |
| Multi-Cache Path Reload | ✅ Complete | 112/112 | `core-reload-path-multicache.test.vitest.mjs` |
| Lazy-Mode Reload | ✅ Mostly Complete | 63/68 | `core-reload-lazy-mode.test.vitest.mjs` |

**All reload test suites are in the baseline** (`tests/vitests/baseline-tests.json`).

**Known Issue:** 5 failures in lazy-mode "Full Instance Reload Respects Lazy Mode" tests - `api.slothlet.reload()` doesn't reset lazy wrappers to un-materialized state (pre-existing issue in `slothlet.mjs` reload() method, not the selective reload system).

## Implementation Details

See [api-cache-system.md](./api-cache-system.md) for the full implementation history of Steps 1-6 and the API cache architecture that powers all reload modes.

### ✅ Completed Features

#### ✅ Full Instance Reload (`api.slothlet.reload()`)
- **Status**: COMPLETE & WORKING
- **Tests**: 56/56 passing (100%) - IN BASELINE
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

### ✅ Selective Module Reload (`api.slothlet.api.reload(pathOrModuleId)`)
- **Status**: COMPLETE & WORKING
- **Tests**: 56/56 passing (100%) - IN BASELINE
- **Implementation**: `src/lib/handlers/api-manager.mjs` - `_reloadByModuleID()` and `_reloadByApiPath()`
- **Test File**: `tests/vitests/suites/core/core-reload-selective.test.vitest.mjs`

**Features**:
- Reload by apiPath: Reloads all contributors to that path
- Reload by moduleID: Reloads only that module's contributions
- Accepts string parameter (apiPath or moduleID)
- Accepts null/undefined/""/"." for base module reload
- Ownership stack preserved during reload
- Cache-bust ensures fresh module imports

#### ✅ Multi-Cache Path Reload
- **Status**: COMPLETE & WORKING
- **Tests**: 112/112 passing (100%) - IN BASELINE
- **Implementation**: `src/lib/handlers/api-manager.mjs` - `_reloadByApiPath()` with per-endpoint forceReplace grouping
- **Test File**: `tests/vitests/suites/core/core-reload-path-multicache.test.vitest.mjs`

**Features**:
- Per-endpoint forceReplace grouping (first module replaces, subsequent merge)
- Load-order preservation (base first, then addHistory order)
- Same-endpoint multi-cache rebuild
- Collision mode respected per moduleID
- Custom property preservation through reload

#### ✅ Lazy-Mode Reload
- **Status**: MOSTLY COMPLETE (63/68, 92.6%) - IN BASELINE
- **Tests**: 63/68 passing (5 failures in "Full Instance Reload Respects Lazy Mode")
- **Implementation**: `___resetLazy` on UnifiedWrapper + lazy-aware `_restoreApiTree`
- **Test File**: `tests/vitests/suites/core/core-reload-lazy-mode.test.vitest.mjs`

**Features**:
- Mode-preserving rebuilds (lazy stays lazy, eager stays eager)
- `___resetLazy` resets wrapper to un-materialized state with fresh materializeFunc
- Memory release via reload (accessed paths can be freed)
- Surgical reload (un-accessed lazy paths stay lazy)
- Root-level files always eager in both modes

**Known Issue**: Full instance reload (`api.slothlet.reload()`) doesn't reset lazy wrappers to un-materialized state. This is a pre-existing issue in `slothlet.mjs` reload() method, not the selective reload system.

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
- ✅ **COMPLETE** - All tests in baseline
- ✅ API cache system (Steps 1-6) - See [api-cache-system.md](./api-cache-system.md)
- ✅ Selective reload by moduleID: 56/56 passing
- ✅ Selective reload by apiPath: 56/56 passing
- ✅ Multi-cache path reload: 112/112 passing
- ✅ Lazy-mode reload: 63/68 passing (5 failures in full instance reload, pre-existing)
- ✅ API signature accepts string (apiPath or moduleID) or null/undefined/""/"." for base reload

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
- **Status**: ✅ 56/56 tests passing (100%) - IN BASELINE
- **Coverage**: API path reload, moduleID reload, nested path reload, removed component handling

### Multi-Cache Path Reload Tests
- **File**: `tests/vitests/suites/core/core-reload-path-multicache.test.vitest.mjs`
- **Status**: ✅ 112/112 tests passing (100%) - IN BASELINE
- **Coverage**: Same-endpoint multi-cache, load order, child caches, collision modes, ownership stack

### Lazy-Mode Reload Tests
- **File**: `tests/vitests/suites/core/core-reload-lazy-mode.test.vitest.mjs`
- **Status**: ⚠️ 63/68 tests passing (92.6%) - IN BASELINE
- **Coverage**: Memory release, surgical reload, re-materialization, proxy identity, nested children
- **Known Issue**: 5 failures in "Full Instance Reload Respects Lazy Mode" (pre-existing)

### Metadata Reload Tests
- **File**: `tests/vitests/suites/metadata/metadata-reload.test.vitest.mjs`
- **Status**: Tests for `api.slothlet.api.reload()` partial reload
- **Coverage**: Metadata preservation during selective reload operations

---

## Action Items

### Remaining Issue
- [ ] Fix 5 lazy-mode full instance reload failures - `api.slothlet.reload()` doesn't reset lazy wrappers to un-materialized state

### Future Enhancements
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
- ✅ Implementation complete in `src/lib/handlers/api-cache-manager.mjs` (cache system)
- ✅ JSDoc documentation complete for all reload methods
- ✅ Test coverage: full reload (56/56), selective (56/56), multi-cache (112/112), lazy-mode (63/68)
- ✅ All reload test suites in baseline
- ⚠️ 5 lazy-mode full instance reload failures (pre-existing issue)
- 🔄 User guide pending (how to use reload in production)
- 🔄 Performance benchmarks pending
