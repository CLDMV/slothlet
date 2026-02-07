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

### 🚧 Step 4: Implement moduleID reload with cache rebuild
**Status:** In Progress (50%)  
**Goal:** Rebuild cache from disk and restore all paths

- [x] Get cache entry by moduleID
- [x] Call buildAPI with cached parameters (via rebuildCache())
- [x] Replace cache.api with fresh result
- [x] Recursively traverse new API tree
- [x] Reuse existing wrappers (call __setImpl) or create new ones
- [x] Honor cached collision settings
- [x] Register/update ownership
- [ ] Fix nested path restoration (currentPath calculation issue)
- [ ] Test moduleID reload restores removed paths

**Current Status:**
- **Selective reload tests: 28/56 passing (50%)** - up from 16/56 (28.6%)
- Baseline tests: 2356/2356 passing ✅
- Created `_reloadByModuleID()` - rebuilds cache and restores tree
- Created `_reloadByApiPath()` - rebuilds all contributing caches
- Created `_restoreApiTree()` - recursive tree restoration with wrapper updates
- Issue: Nested paths like "custom.math.add" not being restored properly
- Context errors in test cleanup (timing issue, not core functionality)

### ⬜ Step 5: Implement path reload with multi-cache rebuild
**Status:** Not Started  
**Goal:** Rebuild all caches contributing to a path

- [ ] Find all moduleIDs owning the target apiPath
- [ ] Rebuild each moduleID's cache
- [ ] Extract implementations at target path from each cache
- [ ] Merge into existing wrapper using ownership stack order
- [ ] Honor collision settings
- [ ] Test path reload with multiple contributors

### ⬜ Step 6: Update removeApiComponent cache lifecycle
**Status:** Not Started  
**Goal:** Proper cache cleanup and diagnostics

- [ ] Delete cache only when removing by moduleID
- [ ] Preserve cache when removing by apiPath
- [ ] Add getCacheDiagnostics() method
- [ ] Expose under api.slothlet.diag.caches when diagnostics enabled
- [ ] Test cache persistence through partial removes

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
- **Last Run:** Before implementation start
- **Command:** `npm run baseline | Select-Object -Last 50`

### Full Reload Tests
- **Status:** ✅ Passing (56/56)
- **Last Run:** Before implementation start
- **Command:** `npm run vitest tests/vitests/suites/core/core-reload-full.test.vitest.mjs | Select-Object -Last 100`

### Selective Reload Tests
- **Status:** ⚠️ Partial (16/56 passing - 28.6%)
- **Last Run:** Before implementation start
- **Command:** `npm run vitest tests/vitests/suites/core/core-reload-selective.test.vitest.mjs | Select-Object -Last 100`
- **Goal:** 100% passing after implementation

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
- 🚧 Step 4: 50% complete - moduleID reload implemented, nested path issues remain
  - Created `_reloadByModuleID()`, `_reloadByApiPath()`, `_restoreApiTree()`  
  - Selective reload: 28/56 passing (50%), up from 16/56 (28.6%)
  - Known issue: Nested paths like "custom.math.add" not restoring properly
  - Path calculation fixed (relativePath vs fullPath separation)
  - Next: Debug why nested containers aren't being created

## Related Files

- `src/lib/handlers/api-manager.mjs` - Main implementation location
- `src/lib/handlers/ownership.mjs` - Ownership tracking integration
- `src/lib/builders/api_builder.mjs` - buildAPI interface
- `tests/vitests/suites/core/core-reload-selective.test.vitest.mjs` - Primary test suite
