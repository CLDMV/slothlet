# Naming Convention Cleanup — UnifiedWrapper & Internal Properties

**Priority:** Medium (consistency/maintainability, not critical for functionality)
**Status:** ✅ ALL PHASES COMPLETE
**Created:** 2026-02-07
**Last Updated:** 2026-02-13

**Current Status:**
- ✅ Phase 1: Complete (`moduleID` → `__moduleID`, etc.)
- ✅ Phase 2: Complete (all internal functions use `___` prefix)
- ✅ Phase 3: Complete (all internal variables use `____` prefix)
- ✅ Phase 4: Complete (covered by Phase 2)
- ✅ Phase 5: Complete (audit — all source and test files consistent)
- ✅ Phase 6: Complete - All metadata properties moved to `____slothletInternal`
- ✅ Phase 7: Complete - Internal property migrations and debug script fixes
  - ✅ Fixed ComponentBase.slothlet → ____slothlet collision with user-facing api.slothlet
  - ✅ Fixed debug script to remove obsolete childCache references
  - ✅ Fixed debug script to skip __slothletInstance internals in comparisons
  - ✅ All 2648 tests passing
  - ✅ Debug script shows "APIs are structurally identical"

### Phase 6: `____slothletInternal` Container (✅ COMPLETE 2026-02-12)

**Status:** All internal properties successfully nested in non-enumerable container.

**Currently in `____slothletInternal` (non-enumerable container):**
- `mode`, `apiPath`, `isCallable`, `isCallableLocked`
- `state`, `displayName`, `invalid`
- `moduleID`, `filePath`, `sourceFolder`, `materializeOnCreate`
- Dynamic: `collisionMergedKeys`, `childFilePathsPreMaterialize`, `needsImmediateChildAdoption`

**Still on wrapper surface (ENUMERABLE - appears in Object.keys()):**
```javascript
this.____id = "...";                         // Line 153 in unified-wrapper.mjs
this.____callableImpl = null;                 // Line 199
this.____waitingProxyCache = new Map();      // Line 202  
this.____proxy = null;                       // Line 203
this._impl = UnifiedWrapper._cloneImpl(...); // Line 207
this.____materializeFunc = materializeFunc;  // Line 209
// ____materializationPromise added later
```

**Test Output (current working state):**
```javascript
Object.keys(api.math) = [
  '____id',                    // ❌ Should be hidden
  '____callableImpl',          // ❌ Should be hidden
  '____waitingProxyCache',     // ❌ Should be hidden
  '____proxy',                 // ❌ Should be hidden
  '_impl',                     // ⚠️ Maybe should stay (external property)
  '____materializeFunc',       // ❌ Should be hidden
  'add',                       // ✅ Actual API
  'multiply',                  // ✅ Actual API
  'divide'                     // ✅ Actual API
]
```

**Why Phase 6 Was Marked Complete (Incorrectly):**

Only the metadata/config properties were moved into `____slothletInternal`. The implementation
state properties (`____id`, `____callableImpl`, etc.) were renamed with `____` prefix (Phase 3)
but never actually moved into the container. The documentation claimed they were moved but
the code still has them as direct properties on `this`.

**Files modified (partial migration):**
- `src/lib/handlers/unified-wrapper.mjs` — Constructor creates `internal` object but only stores metadata in it
- `src/lib/builders/api-assignment.mjs` — References updated for metadata properties only
- `src/lib/builders/modes-processor.mjs` — References updated for metadata properties only
- `src/lib/handlers/api-manager.mjs` — References updated for metadata properties only  
- `src/lib/handlers/metadata.mjs` — References updated for metadata properties only

**Key design changes:**
- `__isCallable` configurability (previously `Object.defineProperty configurable: true/false`) replaced with `isCallableLocked` boolean flag
- `__filePath` updates now use direct assignment instead of `Object.defineProperty`
- Proxy getTrap has backward compat handlers: `proxy.__mode` → `wrapper.____slothletInternal.mode`
- `allowedInternals` Set and `hasTrap`/`setTrap`/`deletePropertyTrap` internal key lists all include `"____slothletInternal"`

This naming convention cleanup is a nice-to-have for consistency but does not affect functionality or user-facing behavior. It can be revisited in a future maintenance cycle when there's bandwidth for comprehensive refactoring with full regression testing.

---

## Phase 7: Complete Surface Cleanup (✅ COMPLETE 2026-02-13)

**Goal:** Fix remaining issues with internal property exposure and debug validation.

**What Was Fixed:**

1. **ComponentBase naming collision** (commit ce522cd)
   - Renamed `ComponentBase.slothlet` → `ComponentBase.____slothlet`
   - Added `slothlet` getter for backward compatibility
   - Added Symbol.toStringTag and name properties to wrapper for proper type identification
   - Prevents collision with user-facing `api.slothlet.*` methods

2. **Debug script obsolete references** (commit pending)
   - Removed references to `wrapper._childCache` (no longer exists)
   - Children are now stored directly as properties on wrapper
   - Fixed normalization in compareApiShapes function

3. **Debug script internal traversal** (commit pending)
   - Added `__slothletInstance` to shouldSkipKey filter
   - Prevents debug comparison from diving into internal Slothlet instance
   - Reduced paths checked from 718 to 200 (only user-facing API)

**Test Results:**
- ✅ All 2648 tests passing (`npm run baseline`)
- ✅ Debug script: "APIs are structurally identical!" (`npm run debug`)
- ✅ Paths checked: 200 total (only user-facing API paths)

**Achieved Surface State:**
```javascript
Object.keys(api.math) 
// Shows: ['add', 'multiply', 'divide']  ← Only actual API methods ✅

// Accessible but non-enumerable:
api.math.____slothletInternal  // ✅ Exists, non-enumerable, contains all internal state

// All internal properties are INSIDE ____slothletInternal:
api.math.____slothletInternal.id                    // ✅
api.math.____slothletInternal.impl                  // ✅
api.math.____slothletInternal.callableImpl          // ✅
api.math.____slothletInternal.waitingProxyCache     // ✅
api.math.____slothletInternal.proxy                 // ✅
api.math.____slothletInternal.materializeFunc       // ✅
api.math.____slothletInternal.materializationPromise // ✅
api.math.____slothletInternal.mode                  // ✅
api.math.____slothletInternal.apiPath               // ✅
// ... all other internal state
```

### Migration Results (Completed in commits cf91d5e through 97c054e)

All 7 properties successfully migrated to `____slothletInternal` container:

- ✅ **Property 1:** `____id` → `internal.id` (commit cf91d5e)
- ✅ **Property 2:** `____callableImpl` → `internal.callableImpl` (commit 3c5c377)
- ✅ **Property 3:** `____waitingProxyCache` → `internal.waitingProxyCache` (commit cdbdfd9)
- ✅ **Property 4:** `____proxy` → `internal.proxy` (commit 82d7b1b)
- ✅ **Property 5:** `_impl` → `internal.impl` (commit b88e568)
- ✅ **Property 6:** `____materializeFunc` → `internal.materializeFunc` (commit 498fbba)
- ✅ **Property 7:** `____materializationPromise` → `internal.materializationPromise` (commit 0b594af)

**Additional migrations:**
- ✅ `__wrapper` → `internal.wrapper` (commit 419c211)
- ✅ ComponentBase.slothlet → ____slothlet (commit 97c054e)

**Files updated:**
- `src/lib/handlers/unified-wrapper.mjs` — All property definitions and references
- `src/lib/builders/api-assignment.mjs` — All wrapper property accesses
- `src/lib/builders/modes-processor.mjs` — All wrapper property accesses
- `src/lib/handlers/api-manager.mjs` — All wrapper property accesses
- `src/lib/handlers/metadata.mjs` — All wrapper property accesses
- `src/slothlet.mjs` — Updated SKIP_PROPS filter
- `tests/debug-slothlet.mjs` — Updated comparison normalization

**Pattern used:**
- Properties stored on `internal` object in constructor
- Accessed via `wrapper.____slothletInternal.propertyName`
- Wrapper reference added as getter to avoid circular reference issues
- Optional chaining (`?.`) used throughout for safe access

---

## The Problem

The current codebase has inconsistent underscore prefix usage across internal/external functions and variables. Properties and methods use a mix of `_`, `__`, no prefix, and there's no clear standard.

## Target Convention

| Prefix | Usage | Example |
|--------|-------|---------|
| `_` | **External functions** (public API on wrapper, accessible via proxy) | `_materialize()`, `_adoptImplChildren()` |
| `__` | **External variables** (public properties, accessible via proxy) | `__mode`, `__apiPath`, `__isCallable`, `__state` |
| `___` | **Internal functions** (private, never exposed through proxy) | `___resolveChild()`, `___buildProxy()` |
| `____` | **Internal variables** (private, never exposed through proxy) | `____callableImpl`, `____waitingProxyCache` |

## Known Violations

### ~~No prefix at all (should be `__` external variables)~~ ✅ RESOLVED

> **Completed in commit `2b87ceb` (Phase 1)**

These properties were renamed to use `__` prefix:

- ~~`moduleID`~~ → `__moduleID`
- ~~`filePath`~~ → `__filePath`
- ~~`sourceFolder`~~ → `__sourceFolder`

All references across `unified-wrapper.mjs`, `api-manager.mjs`, `api-assignment.mjs`, `modes-processor.mjs`, lifecycle handlers, ownership, metadata, and proxy traps were updated.

### Mixed `_` and `__` on what should be the same category

Current state of prefix usage in `UnifiedWrapper`:

#### Properties using `__` (external variables — all nested in `____slothletInternal`):
- `mode`, `apiPath`, `isCallable`, `materializeOnCreate` (via `____slothletInternal`)
- `state`, `displayName`, `invalid` (via `____slothletInternal`)
- `collisionMergedKeys`, `childFilePathsPreMaterialize`, `needsImmediateChildAdoption` (via `____slothletInternal`)

#### ~~Properties using `_` that may need reclassification~~ ✅ ALL RESOLVED
- ~~`_id`~~ → `____id` ✅ RENAMED (internal variable)
- `_impl` — ✅ CORRECT: External property, accessed via proxy (intentionally kept as `_`)
- ~~`_callableImpl`~~ → `____callableImpl` ✅ RENAMED (internal variable, dead code)
- ~~`_waitingProxyCache`~~ → `____waitingProxyCache` ✅ RENAMED (internal variable)
- ~~`_proxy`~~ → `____proxy` ✅ RENAMED (internal variable)
- ~~`_userMetadata`~~ → removed (0 references, dead code)
- ~~`_materializeFunc`~~ → `____materializeFunc` ✅ RENAMED (internal variable)
- ~~`_materializationPromise`~~ → `____materializationPromise` ✅ RENAMED (internal variable)

#### ~~Functions using `_` that need reclassification~~ ✅ ALL RESOLVED
- `_materialize()` — ✅ CORRECT: External function, called from slothlet.mjs and proxy-accessible
- ~~`_adoptImplChildren()`~~ → `___adoptImplChildren()` ✅ RENAMED (internal function)
- ~~`_createChildWrapper()`~~ → `___createChildWrapper()` ✅ RENAMED (internal function)
- ~~`_createWaitingProxy()`~~ → `___createWaitingProxy()` ✅ RENAMED (internal function)

#### ~~Functions using `__` that need reclassification~~ ✅ ALL RESOLVED
- ~~`__setImpl()`~~ → `___setImpl()` ✅ RENAMED (correctly reclassified as internal)
- ~~`__getState()`~~ → `___getState()` ✅ RENAMED (internal function)
- ~~`__invalidate()`~~ → `___invalidate()` ✅ RENAMED (internal function)

## Migration Plan

1. **Phase 1:** ✅ COMPLETE (commit `2b87ceb`) — Rename `moduleID` → `__moduleID`, `filePath` → `__filePath`, `sourceFolder` → `__sourceFolder`
   - All references updated across unified-wrapper, api-manager, api-assignment, modes-processor, lifecycle handlers, ownership, metadata
   - `allowedInternals` set, proxy traps all updated
   - Full test suite passing

2. **Phase 2:** ✅ COMPLETE — Reclassify internal framework functions
   - ✅ `__setImpl` → `___setImpl` (internal framework function)
   - ✅ `___resetLazy` added as internal function
   - ✅ `__getState` → `___getState` (5 files: unified-wrapper, modes-processor, api-manager, debug-slothlet, core-reload-lazy-mode test)
   - ✅ `__invalidate` → `___invalidate` (unified-wrapper only)
   - ✅ `_adoptImplChildren` → `___adoptImplChildren` (4 files: unified-wrapper, api-assignment, modes-processor, api-manager)
   - ✅ `_createChildWrapper` → `___createChildWrapper` (unified-wrapper only)
   - ✅ `_createWaitingProxy` → `___createWaitingProxy` (unified-wrapper only)
   - All proxy traps (allowedInternals, hasTrap, setTrap, deletePropertyTrap) updated
   - Baseline: 38/38 files, 2648/2648 tests passing

3. **Phase 3:** ✅ COMPLETE — Rename truly internal variables to `____` prefix
   - ✅ `_callableImpl` → `____callableImpl` (2 refs, unified-wrapper only — dead code, assigned but never read)
   - ✅ `_waitingProxyCache` → `____waitingProxyCache` (9 refs, unified-wrapper only)
   - ✅ `_proxy` → `____proxy` (10 refs, unified-wrapper only)
   - ✅ `_userMetadata` → `____userMetadata` (0 refs — already removed in prior refactoring)
   - ✅ `_materializeFunc` → `____materializeFunc` (16 refs: unified-wrapper, api-assignment, modes-processor, api-manager)
   - ✅ `_materializationPromise` → `____materializationPromise` (10 refs: unified-wrapper, api-manager)
   - ✅ `_id` → `____id` (10 refs: unified-wrapper, api-assignment)
   - Note: `_impl` intentionally NOT renamed — accessed via proxy and used as external property
   - Baseline: 38/38 files, 2648/2648 tests passing

4. **Phase 4:** ✅ COMPLETE (covered by Phase 2)
   - `_createChildWrapper` → `___createChildWrapper` — done in Phase 2
   - `_createWaitingProxy` → `___createWaitingProxy` — done in Phase 2

5. **Phase 5:** ✅ COMPLETE — Audit all other source files for consistency
   - Audited: api-manager.mjs, api-assignment.mjs, modes-processor.mjs, ownership.mjs, metadata.mjs, lifecycle.mjs, api-cache-manager.mjs
   - No stale references to old-style UnifiedWrapper property names found
   - Note: Other manager classes (OwnershipManager, MetadataManager, etc.) retain `_` prefix for their own internal properties — separate naming scope from UnifiedWrapper

## New Methods from Refactoring (2026-02-10)

Three refactoring commits (f8f3139, 7ccfb07, ac0b7ca) introduced new methods that follow existing conventions:

| Method | Type | Prefix | Classification |
|--------|------|--------|----------------|
| `static _cloneImpl(value)` | Static function | `_` | External — called by constructor and `_applyNewImpl` |
| `_applyNewImpl(newImpl)` | Instance function | `_` | External — core impl application logic shared by `___setImpl` and lazy materialization |
| `static _extractFullImpl(wrapper)` | Static function | `_` | External — reconstructs complete impl tree from wrapper hierarchy |

These follow the `_` prefix = external function convention correctly.

## Impact

- **Breaking:** If any external consumers reference `_proxyTarget` (already removed), `moduleID`, `filePath`, or `sourceFolder` directly
- **Tests:** All tests referencing internal properties will need updating
- **Proxy traps:** `allowedInternals` set, getTrap, hasTrap, ownKeysTrap all need updating per phase

## Test Scripts

Run after every change pass to verify no regressions:

```bash
# Quick targeted test (failing test file for metadata/api-manager issues)
NODE_ENV=development NODE_OPTIONS=--conditions=slothlet-dev npm run vitest -- metadata-api-manager.test.vitest.mjs

# Debug suite (runs eager + lazy mode structural validation, NaN checks, API parity)
NODE_ENV=development NODE_OPTIONS=--conditions=slothlet-dev npm run debug

# Full baseline (38 test files, 2648+ tests — the gold standard)
NODE_ENV=development NODE_OPTIONS=--conditions=slothlet-dev npm run baseline
```

**Validation order:** vitest (fast, targeted) → debug (structural) → baseline (comprehensive)

## Notes

- Each phase should be a separate commit with full `npm run precommit` passing
- The `allowedInternals` Set in `getTrap` must be updated to match whatever prefix is used
- Non-enumerable + non-prefix properties (`moduleID`, `filePath`, `sourceFolder`) are the highest priority fix since they can shadow user exports

## Implemented: Nested Internal Variables (`____slothletInternal`)

The internal variable nesting described below has been **implemented** as of Phase 6.
All internal wrapper variables now live inside a single `Object.create(null)` container:

```js
// CURRENT: flat properties scattered across the wrapper instance
this.__moduleID = "...";
this.__filePath = "...";
this.__sourceFolder = "...";
this.__mode = "lazy";
this.__apiPath = "math";
this.__state = { materialized: false, inFlight: false };
// ... 15+ underscore-prefixed properties competing for names

// FUTURE: single internal container, zero collision risk
this.____slothletInternal = Object.create(null);
this.____slothletInternal.moduleID = "...";
this.____slothletInternal.filePath = "...";
this.____slothletInternal.sourceFolder = "...";
this.____slothletInternal.mode = "lazy";
this.____slothletInternal.apiPath = "math";
this.____slothletInternal.state = { materialized: false, inFlight: false };
```

### Why This Matters

1. **One collision point instead of many** — Only `____slothletInternal` needs to be unique. All child properties inside it are isolated from user exports entirely.
2. **Proxy trap simplification** — The `allowedInternals` Set currently has 20+ entries and grows with every new property. With nesting, the getTrap only needs to intercept ONE property name.
3. **Cleaner `ownKeys` / `getOwnPropertyDescriptor`** — No need to filter out dozens of internal properties when enumerating. Just filter the single container.
4. **Follows the established pattern** — Slothlet already nests builtin functions under `slothlet.*` (e.g., `api.slothlet.shutdown()`, `api.slothlet.reload()`). Internal variables should follow the same containment principle.
5. **Future-proof** — Adding new internal state never risks colliding with user exports, no matter what users name their modules.
6. **Preserves user internals** — Users can still have their own `_` prefixed properties without collision. The proxy getTrap looks for `____slothletInternal` specifically, not blocking all underscored properties.

### What Stays Exposed

- `_materialize()` — Must remain on the surface so users can force materialization if needed

### Migration Approach

This was implemented in Phase 6:

1. ✅ Created `this.____slothletInternal = Object.create(null)` in constructor
2. ✅ Moved all `__` prefixed variables into `this.____slothletInternal.*` (dropping the prefix)
3. ✅ Updated proxy traps to route `____slothletInternal` access
4. ✅ Updated all internal code to read from `this.____slothletInternal.X` instead of `this.__X`
5. ✅ Kept `_materialize()` exposed on the surface
6. ✅ Proxy getTrap backward compat: old `__mode`, `__apiPath` etc. still work through proxy
