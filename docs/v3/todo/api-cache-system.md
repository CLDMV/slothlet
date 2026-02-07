# API Cache System for Hot Reload

**Status:** 🚧 In Progress  
**Started:** 2026-02-06  
**Branch:** refactor/unified-wrapper-poc

## Overview

Implement API cache storage that maintains complete `buildAPI` results per moduleID. This architectural change simplifies hot reload by keeping each API as a separate, cached entity. The user-facing API is a live merged view of these caches.

## Architecture

### Core Concept
- **One cache per moduleID** - Each represents a complete API (base or from api.add)
- **Complete buildAPI results** - Store entire tree, not individual paths
- **Original parameters preserved** - Store folderPath, mode, sanitizeOptions, collisionMode, config for rebuild
- **Live API is merged view** - User mutations happen on live wrappers, never on cached APIs
- **Caches persist through api.remove(apiPath)** - Only deleted when removing by moduleID

### Cache Structure
```javascript
apiCaches = Map<string, CacheEntry>
// moduleID → {
//   endpoint: string,         // API path endpoint (e.g., ".", "plugins")
//   moduleID: string,          // Module identifier
//   api: Object,               // Complete buildAPI result tree
//   folderPath: string,        // Source folder path
//   mode: string,              // lazy/eager
//   sanitizeOptions: Object,   // Sanitization config
//   collisionMode: string,     // Collision handling mode
//   config: Object,            // Config snapshot at add time
//   timestamp: number          // Cache creation time
// }
```

## Implementation Steps

### ✅ Step 1: Audit ownership.register callsites
**Status:** ✅ Complete  
**Goal:** Determine what's currently stored in ownership.value field

- [x] Search all ownership.register calls (17 found)
- [x] Document what's passed as value parameter
- [x] Choose simplest storage approach that doesn't break existing behavior

**Findings:**
- **Some callsites pass value** (slothlet.mjs, api-manager.mjs): Store raw impl via `wrapper?.__impl ?? impl`
- **Most callsites omit value** (modes-processor.mjs): Only register moduleID + apiPath for tracking
- **getCurrentValue handles unwrapping** (ownership.mjs line 240-244): Auto-extracts __impl from wrappers
- **Decision:** Cache system will store complete buildAPI result trees, ownership continues current behavior (stores impls where provided, undefined where not)

### ✅ Step 2: Add apiCaches Map to ApiManager
**Status:** ✅ Complete  
**Goal:** Create cache storage structure

- [x] Add `this.apiCaches = new Map()` in ApiManager constructor
- [x] Define CacheEntry structure with all required fields
- [x] Document cache lifecycle expectations

### ✅ Step 3: Populate caches during load and api.add
**Status:** ✅ Complete  
**Goal:** Store buildAPI results in cache

- [x] Capture cache after initial load (base moduleID with builtins included)
- [x] Store cache in addApiComponent after buildAPI
- [x] Verify all parameters stored correctly
- [x] Test cache persistence - **Baseline: 2356/2356 passing ✅**
- [x] Fixed cache timing - store AFTER buildFinalAPI (includes builtins)

**Key Changes:**
- Created ApiCacheManager as dedicated handler (294 lines)
- Moved ownership.registerSubtree() to ownership.mjs (67 lines)
- Moved metadata.applyToSubtree() to metadata.mjs (50 lines)
- ApiManager reduced from 1775 → 1613 lines (~162 lines removed)
- Cache is primary storage after builtins attached

### ✅ Step 4: Update removeApiComponent cache lifecycle (PRIORITY)
**Status:** ✅ Complete  
**Goal:** Make existing api.remove feature cache-aware before building new features

**Why This Must Come First:**
- api.remove is an **existing, working feature** that needs cache integration
- Building reload (Steps 5-6) on incomplete foundation creates:
  - Stale/orphaned cache entries after remove
  - Reload encountering garbage data
  - Undefined behavior when removing then reloading

**Implementation Tasks:**
- [x] Delete cache when removing by moduleID (complete cleanup)
- [x] Preserve cache when removing by apiPath (partial removal, cache may have other paths)
- [x] Add getCacheDiagnostics() method for debugging
- [x] Expose diagnostics under api.slothlet.diag.caches when enabled
- [x] Test cache persistence through partial removes
- [x] Validate baseline tests remain 100% passing

**Key Changes:**
- Added cache deletion in removeApiComponent after moduleID cleanup (line ~1455)
- Exposed cache diagnostics under api.slothlet.diag.caches with get(), getAllModuleIDs(), has()
- Cache preserved during apiPath removal (only deleted for complete module removal)
- Baseline tests: 2356/2356 passing ✅

### ⚠️ Step 5: Implement moduleID reload with cache rebuild
**Status:** **Blocked at 50%** - Nested path restoration issue  
**Goal:** Rebuild cache from disk and restore all paths  
**Commits:** 958d064 (initial), 6d36059 (improved)

**Current Status:**
- Selective reload tests: **28/56 passing (50%)** - stuck at this level
- Baseline tests: **2356/2356 passing (100%)** ✅
- Implemented `_reloadByModuleID()` - rebuilds cache, calls `_restoreApiTree()`
- Implemented `_reloadByApiPath()` - finds child modules, reloads each
- Simplified `_restoreApiTree()` - uses `__setImpl()` for nested paths

**Known Issues & Investigation Needed:**
- **Core blocker:** Nested paths fail after reload - "cannot access math of undefined"
- **Test case:** `api.nested.comp1.math.add` works after add, fails after reload
- **Symptom:** `api.nested.comp1.math` returns `undefined` post-reload
- **Root cause hypothesis:** `UnifiedWrapper.__setImpl()` may not properly reconstruct `_proxyTarget` during reload
  - Initial add: Creates wrapper with `_impl = {math: {add: fn}}`, calls `_adoptImplChildren()` which populates `_proxyTarget` with `math` wrapper
  - Reload: Calls `__setImpl({math: {add: fn}})` again, but `_proxyTarget.math` isn't recreated
  - Possible issue: `_adoptImplChildren()` behavior differs between constructor and `__setImpl` call
  - Possible issue: Collision mode handling during reload differs from add
- **Context cleanup errors:** Tests show `CONTEXT_NOT_FOUND` after shutdown (timing issue, not core blocker)

**Implementation Details:**
- `_restoreApiTree(freshApi, endpoint, moduleID, collisionMode)`:
  - For root paths: Merges each key directly (same as addApiComponent)
  - For nested paths: Gets existing wrapper at endpoint, calls `__setImpl(freshApi, moduleID)`
  - Fallback: If no wrapper exists, creates new one (shouldn't happen in reload)
- `_reloadByApiPath(apiPath)`:
  - Checks for direct ownership history at path
  - If not found, searches cache for child modules (endpoint starts with path prefix)
  - Example: Reloading "nested" finds "nested.comp1" and "nested.comp2"
  - Reloads each child module separately

**Next Steps (Deep Investigation Required):**
1. Debug `UnifiedWrapper.__setImpl()` and `_adoptImplChildren()` behavior
2. Compare `_proxyTarget` state before/after reload
3. Check if collision mode affects `_adoptImplChildren()` execution
4. Verify `_adoptImplChildren()` clears/recreates children vs merges
5. Consider if reload needs different approach than just calling `__setImpl`
6. **Target:** 56/56 selective reload tests passing (100%)

### ⬜ Step 6: Implement path reload with multi-cache rebuild
**Status:** Not Started (Blocked on Step 5)  
**Goal:** Rebuild all caches contributing to a path

- [ ] Already partially implemented in `_reloadByApiPath()` (finds contributors)
- [ ] Verify multi-cache rebuild and merge works correctly
- [ ] Test path reload with multiple contributors
- [ ] Honor ownership stack order during merge
- [ ] Validate collision settings respected for each moduleID

## Test Commands (Remember to Tail!)

**Critical:** Always tail test output to avoid context overflow!

### Debug Command
```powershell
npm run debug | Select-Object -Last 50
```
- Validates API structure across lazy/eager modes
- Tests 91 paths automatically
- Use for quick validation after changes

### Baseline Tests
```powershell
npm run baseline | Select-Object -Last 50
```
- Core functionality tests (2356 tests)
- Must remain 100% passing
- Run before and after major changes

### Specific Test Suite
```powershell
npm run vitest tests/vitests/suites/core/core-reload-selective.test.vitest.mjs | Select-Object -Last 100
```
- Replace with specific test file path
- Use for targeted testing during development

## Test Status

### Baseline Tests
- **Status:** ✅ Passing (2356/2356)
- **Last Run:** After Step 4 and Step 5 attempts
- **Command:** `npm run baseline | Select-Object -Last 50`
- **Commits:** Maintained 100% through 040c870, 958d064, 6d36059

### Full Reload Tests
- **Status:** ✅ Passing (56/56)
- **Last Run:** Before implementation start
- **Command:** `npm run vitest tests/vitests/suites/core/core-reload-full.test.vitest.mjs | Select-Object -Last 100`

### Selective Reload Tests
- **Status:** ⚠️ Blocked at 50%
- **Last Run:** After commit 6d36059
- **Command:** `npm run vitest tests/vitests/suites/core/core-reload-selective.test.vitest.mjs | Select-Object -Last 100`
- **Results:** 28/56 passing (50%) - stuck since 958d064
- **Note:** Requires deep dive into UnifiedWrapper reload behavior

## Design Decisions

### Collision Settings During Restoration
✅ **Decision:** Use cached collision settings from original api.add call  
**Rationale:** Settings stored with cache metadata, not runtime changeable currently

### Path-Based Reload Cache Rebuild
✅ **Decision:** Rebuild all moduleID caches contributing to target path  
**Rationale:** Safer - catches source changes, ensures fresh implementations

### Base Module Cache Config
✅ **Decision:** Use cached config.dir, not live values  
**Rationale:** Config not runtime changeable, users create new instances for different dirs

### Cache Memory Management
✅ **Decision:** No size limits or eviction policies in v1  
**Rationale:** Architectural decision for simplicity (KISS), rely on manual api.remove cleanup

## Key Architectural Points

1. **Cached APIs are immutable** - User mutations never touch caches
2. **Each cache is independent** - Represents complete API for one moduleID
3. **Live API is merged view** - Built by setting wrapper.__impl from caches
4. **Reload rebuilds from disk** - Fresh buildAPI calls, not cache manipulation
5. **Restoration honors ownership** - Stack order determines merge precedence

## Progress Log

### 2026-02-06
- ✅ Created documentation
- ✅ Defined architecture and cache structure
- ✅ Outlined implementation steps
- ✅ Completed Step 1: ownership audit
- ✅ Completed Step 2: Created ApiCacheManager (294 lines)
- ✅ Completed Step 3: Cache populated during load/add (2356/2356 baseline passing)
- ⚠️ **PRIORITIZATION ERROR IDENTIFIED**: Implemented Step 5 (reload) before Step 4 (remove cleanup)
  - Commit 215e285: Implemented moduleID reload (28/56 tests passing, 50%)
  - **Issue**: Built new feature before making existing api.remove cache-aware
  - **Consequence**: Orphaned cache entries, undefined reload behavior after remove
  - **Resolution**: Reordered steps - Step 4 (remove) must complete before Step 5 (reload)
- ✅ **Completed Step 4**: api.remove cache lifecycle integration
  - Added cache deletion when removing by moduleID
  - Exposed cache diagnostics under api.slothlet.diag.caches
  - Baseline: 2356/2356 passing ✅
  - Foundation now solid for Step 5 re-validation
- **Next**: Re-validate Step 5 (reload) on proper foundation, fix nested path issues

## Related Files

- `src/lib/handlers/api-manager.mjs` - Main implementation location
- `src/lib/handlers/ownership.mjs` - Ownership tracking integration
- `src/lib/builders/api_builder.mjs` - buildAPI interface
- `tests/vitests/suites/core/core-reload-selective.test.vitest.mjs` - Primary test suite
