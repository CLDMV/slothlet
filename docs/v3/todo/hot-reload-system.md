# Hot Reload System Implementation

**Status:** ⚠️ INVESTIGATION NEEDED  
**Last Updated:** 2026-02-06

## Investigation Summary (2026-02-06)

**Selective Reload Specification**:

1. **Reload by apiPath**: Reloads entire path (base + all modules contributing to it)
   ```javascript
   await api.slothlet.api.reload("math");
   // Reloads: base math + any modules that added to math path
   ```

2. **Reload by moduleID**: Reloads ONLY that module's contributions (uses ownership system)
   ```javascript
   await api.slothlet.api.reload(moduleID1);
   // Updates module1's impl WITHOUT replacing currently active impl if buried
   ```

**Ownership Stack Behavior**:
- When module1 provides `api.x.fn` then module2 provides `api.x.fn`:
  - module2's impl is active (last loaded wins)
  - module1's impl is buried in ownership stack
- When `reload(module1)`:
  - Update module1's buried impl with fresh code
  - DO NOT replace module2's active impl
  - So when module2 is removed, module1's UPDATED impl becomes active

**What Happened**:
- Attempted to implement without understanding ownership stack system
- Modified global reload code which broke full instance reload
- Changes reverted

**Key Learnings**:
1. Selective reload works with ownership stack, not simple replacement
2. Path reload affects all contributors; moduleID reload affects only that module
3. Must preserve ownership order when reloading buried implementations
4. Full reload (`api.slothlet.reload()`) is working and in baseline (✅ all tests passing)

**Implementation Requirements**:
1. Track ownership per module (already exists in ownership system)
2. When reloading by moduleID, update that module's impl in ownership stack
3. Only update active impl if that module currently owns it (is top of stack)
4. Preserve all other modules' implementations unchanged

---

## Status: Mixed Results

**CRITICAL**: The selective reload test file `core-reload-selective.test.vitest.mjs` is NOT in the baseline tests (2356 tests). This test may not be v3-compatible or may be testing features that aren't fully implemented yet. Investigation needed to determine if the test or implementation needs updating.

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

#### 🟡 Selective Module Reload (`api.slothlet.api.reload(pathOrModuleId)`)
- **Status**: IMPLEMENTATION IN PROGRESS
- **Implementation**: `src/lib/handlers/api-manager.mjs` - `reloadApiComponent()` method
- **Test File**: `tests/vitests/suites/core/core-reload-selective.test.vitest.mjs` (NOT in baseline)

**Feature Description**:
Selective reload updates specific module implementations while preserving the ownership stack. Two modes:

1. **By apiPath**: Reloads all contributors to that path
   ```javascript
   await api.slothlet.api.reload("math");
   // Reloads base module + all added modules contributing to math
   ```

2. **By moduleID**: Reloads only that module's contributions
   ```javascript
   await api.slothlet.api.reload(moduleID);
   // Updates module's impl in ownership stack without affecting active impl if buried
   ```

**Current Implementation Status**:
- ✅ Path-based reload triggers `restoreApiPath` for base modules
- ✅ Replays `addHistory` entries with `mutateExisting: true`
- ❓ Ownership stack preservation unclear
- ❓ Buried impl updates not verified
- ❌ Not in baseline tests - needs test validation/updates

**Questions to Answer**:

1. **Does ownership system track per-module implementations?**
   - When module2 replaces module1's impl, is module1's impl preserved?
   - Can we retrieve and update module1's buried impl without affecting module2?

2. **Does current `addApiComponent` with `mutateExisting` preserve stacks?**
   - Or does it replace the entire value, destroying ownership stack?

3. **Is the test file v3-compatible?**
   - Test calls `api.slothlet.api.reload("math")` with string parameter
   - API signature expects object: `{ apiPath, moduleID }`
   - Needs API update or test update?

**Intended API**:
```javascript
// Reload single module by API path
await api.slothlet.api.reload("math.advanced");

// Reload by moduleID
await api.slothlet.api.reload(moduleID);

// Reload subtree
await api.slothlet.api.reload("plugins");
```

**Questions to Answer**:

1. **Is selective reload meant to work at all in v3?**
   - Test file last modified 2026-02-05 (recent)
   - But not included in baseline tests (2356 tests all passing)
   - May be work-in-progress feature

2. **What should selective reload do?**
   - Documentation says: "Replays recorded api.slothlet.api.add calls"
   - But implementation has fallback for base modules via `restoreApiPath`
   - Is base module reload intended, or should it throw an error?

3. **Is the test file correct?**
   - Calls `api.slothlet.api.reload("math")` - string parameter
   - API signature in code accepts object: `{ apiPath, moduleID }`
   - Should API accept string, or should test use object?

4. **Does the commit d2cbcb7 API change make sense?**
   - Added string parameter support
   - Improved pass rate from 8/56 to 36/56
   - But may have been masking actual issues

**Recommendation**: Review with project owner before implementing selective reload features.

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
- 🟡 **Implementation in progress** - Test file not yet in baseline
- ✅ Basic structure exists in `src/lib/handlers/api-manager.mjs`
- ❓ Ownership stack preservation needs investigation
- ❓ Buried impl updates need verification
- ❓ API signature needs clarification (string vs object parameter)
- **Next**: Investigate ownership system integration before proceeding

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
