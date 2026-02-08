# API Cache System for Hot Reload

**Status:** 🚧 In Progress (Steps 1-5 Complete, Step 6 Remaining)  
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

### ✅ Step 5: Implement moduleID reload with cache rebuild
**Status:** ✅ Complete  
**Goal:** Rebuild cache from disk and restore all paths  
**Tests:** 56/56 selective reload passing, 2412/2412 baseline passing

**Implementation Summary:**

1. **Cache-bust parameter threading** — Passed `cacheBust` timestamp through the entire call chain:
   `rebuildCache` → `buildAPI` → `buildEagerAPI`/`buildLazyAPI` → `processFiles` → `loadModule`
   This forces `import()` to return fresh module objects, preventing Node.js module cache from
   returning the same function reference used by the live API (which would cause `applyRootContributor`'s
   `Object.assign` to overwrite live API properties).

2. **CollisionContext fix** — Changed `rebuildCache` to use `"initial"` for base modules and
   `"addApi"` for added modules (was incorrectly using `"core"` which doesn't exist in config,
   causing fallback to merge instead of the configured collision mode).

3. **Always-eager rebuilds** — `rebuildCache` forces `mode: "eager"` regardless of original mode.
   This ensures fresh API is fully materialized before `_restoreApiTree` applies it.

4. **Root-level ___setImpl preservation** — `_restoreApiTree` uses `___setImpl` directly on existing
   wrappers for root-level keys, preserving proxy identity and custom properties. Custom properties
   are collected before and restored after `___setImpl`.

5. **Defensive _waitingProxyCache guard** — Added initialization guard in `_createWaitingProxy`
   for edge cases where `_waitingProxyCache` can become undefined during reload/adoption cycles.

6. **Lazy materialization closure fix** — Added `cacheBust` parameter to `createLazySubdirectoryWrapper`
   so lazy materialization closures have access to the cache-bust timestamp.

**Key Design Decisions:**
- moduleID is NEVER changed during reload — it is the identity for ownership, cache lookup, and metadata
- Cache-busting happens at the import URL level only (appends `&_reload=<timestamp>`)
- cacheBust is passed as a parameter through the chain, NOT stored as shared mutable state

**Files Modified:**
- `src/lib/handlers/api-cache-manager.mjs` — `rebuildCache`: collisionContext fix, eager mode, cacheBust param
- `src/lib/handlers/api-manager.mjs` — `_restoreApiTree`: root ___setImpl, custom prop collect/restore
- `src/lib/builders/builder.mjs` — `buildAPI`: pass cacheBust to mode builders
- `src/lib/modes/eager.mjs` — `buildEagerAPI`: accept and pass cacheBust
- `src/lib/modes/lazy.mjs` — `buildLazyAPI`: accept and pass cacheBust
- `src/lib/builders/modes-processor.mjs` — `processFiles`: accept cacheBust, pass to loadModule (3 sites) and recursive calls (2 sites); `createLazySubdirectoryWrapper`: accept cacheBust
- `src/lib/processors/loader.mjs` — `loadModule`: accept cacheBust param, append to import URL
- `src/lib/handlers/unified-wrapper.mjs` — `_createWaitingProxy`: defensive _waitingProxyCache guard

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
- **Status:** ✅ Passing (2412/2412)
- **Last Run:** After Step 5 completion
- **Command:** `npm run baseline | Select-Object -Last 50`

### Full Reload Tests
- **Status:** ✅ Passing (56/56)
- **Last Run:** After Step 5 completion
- **Command:** `npm run vitest tests/vitests/suites/core/core-reload-full.test.vitest.mjs | Select-Object -Last 100`

### Selective Reload Tests
- **Status:** ✅ Passing (56/56)
- **Last Run:** After Step 5 completion
- **Command:** `npm run vitest tests/vitests/suites/core/core-reload-selective.test.vitest.mjs | Select-Object -Last 100`
- **Results:** 56/56 passing (100%) across all 8 configurations (4 eager + 4 lazy)

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

### 2026-02-07
- ✅ **Completed Step 5**: moduleID reload with cache rebuild (56/56 selective + 2412/2412 baseline)
  - Fixed collisionContext: "initial" for base, "addApi" for added (was "core" causing merge fallback)
  - Forced eager mode for all rebuilds
  - Threaded cacheBust timestamp as parameter through entire call chain (7 files)
  - Root-level ___setImpl preserves proxy identity and custom properties
  - Defensive _waitingProxyCache guard for reload/adoption edge cases
  - **Next**: Step 6 (path reload with multi-cache rebuild)

## Related Files

- `src/lib/handlers/api-cache-manager.mjs` — Cache storage and `rebuildCache` logic
- `src/lib/handlers/api-manager.mjs` — `_restoreApiTree`, `removeApiComponent`, `deletePath`
- `src/lib/handlers/unified-wrapper.mjs` — `___setImpl`, `_adoptImplChildren`, `_createWaitingProxy`
- `src/lib/builders/builder.mjs` — `buildAPI` options forwarding
- `src/lib/modes/eager.mjs` — `buildEagerAPI` with cacheBust
- `src/lib/modes/lazy.mjs` — `buildLazyAPI` with cacheBust
- `src/lib/builders/modes-processor.mjs` — `processFiles`, `createLazySubdirectoryWrapper`
- `src/lib/processors/loader.mjs` — `loadModule` with cacheBust URL parameter
- `src/lib/builders/api_builder.mjs` — buildAPI interface
- `tests/vitests/suites/core/core-reload-selective.test.vitest.mjs` — Primary test suite (56 tests)
