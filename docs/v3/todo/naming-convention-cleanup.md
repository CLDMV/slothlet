# Naming Convention Cleanup — UnifiedWrapper & Internal Properties

**Priority:** Medium (consistency/maintainability, not critical for functionality)
**Status:** Phase 6 (`__slothletInternal` container) complete — Phases 3-5 deferred
**Created:** 2026-02-07
**Last Updated:** 2026-02-12

## Decision: Defer Complex Refactoring

After attempting Phase 3-4 implementation, test failures revealed that changing internal property names (`_impl`, `_callableImpl`, etc.) has cascading effects that require deeper analysis. The current single-underscore convention for these properties, while inconsistent with the proposed 4-underscore standard, is working correctly.

**Note on Test Failures:** The 3 baseline test failures (7 tests) are pre-existing and unrelated to naming convention work:
- `processed/api/api-sanitize.test.vitest.mjs` (failures in sanitization tests)
- `suites/core/core-reload-lazy-mode.test.vitest.mjs` (1 failure: lazy wrapper rebuild after reload)
- Metadata tests (failures in cycle tracking)

**Current Status:**
- ✅ Phase 1: Complete (`moduleID` → `__moduleID`, etc.)
- ✅ Phase 2: Partially complete (`___setImpl`, `___resetLazy` added)
- ⏸️ Phase 3-5: **DEFERRED** - Not critical for V3 functionality
- ✅ Phase 6: Complete (`__slothletInternal` container — all `__` properties nested)

### Phase 6: `__slothletInternal` Container (COMPLETED 2026-02-12)

All 13+ internal `__` prefixed properties on UnifiedWrapper instances are now nested inside
a single `Object.create(null)` container (`__slothletInternal`), reducing collision risk to
one property name. Baseline: 38/38 files, 2648/2648 tests passing.

**Files modified:**
- `src/lib/handlers/unified-wrapper.mjs` — Constructor rewrite, all internal references updated, proxy traps updated with backward compat handlers for old property names
- `src/lib/builders/api-assignment.mjs` — Wrapper property access updated (31 references)
- `src/lib/builders/modes-processor.mjs` — Wrapper property access updated (2 references)
- `src/lib/handlers/api-manager.mjs` — Wrapper property access updated (18 references)
- `src/lib/handlers/metadata.mjs` — Wrapper property access updated (1 reference)

**Properties moved into container:** `mode`, `apiPath`, `isCallable`, `isCallableLocked` (new),
`state`, `moduleID`, `filePath`, `sourceFolder`, `materializeOnCreate`, `displayName`, `invalid`,
`collisionMergedKeys`, `childFilePathsPreMaterialize`, `needsImmediateChildAdoption`

**Key design changes:**
- `__isCallable` configurability (previously `Object.defineProperty configurable: true/false`) replaced with `isCallableLocked` boolean flag
- `__filePath` updates now use direct assignment instead of `Object.defineProperty`
- Proxy getTrap has backward compat handlers: `proxy.__mode` → `wrapper.__slothletInternal.mode`
- `allowedInternals` Set and `hasTrap`/`setTrap`/`deletePropertyTrap` internal key lists all include `"__slothletInternal"`

This naming convention cleanup is a nice-to-have for consistency but does not affect functionality or user-facing behavior. It can be revisited in a future maintenance cycle when there's bandwidth for comprehensive refactoring with full regression testing.

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

#### Properties using `__` (external variables — correct per new convention):
- `__mode`, `__apiPath`, `__isCallable`, `__materializeOnCreate`
- `__state`, `__displayName`, `__invalid`
- `__collisionMergedKeys`, `__childFilePathsPreMaterialize`, `__needsImmediateChildAdoption`

#### Properties using `_` that may need reclassification:
- `_id` — debugging ID, internal → should be `____id` or `___id`
- `_impl` — the implementation object, accessed via proxy → needs classification
- `_callableImpl` — callable function storage → internal variable → `____callableImpl`
- `_waitingProxyCache` — internal cache → `____waitingProxyCache`
- `_proxy` — cached proxy reference → `____proxy`
- `_userMetadata` — user metadata storage → `____userMetadata`
- `_materializeFunc` — materialization function → internal → `____materializeFunc`
- `_materializationPromise` — in-flight promise → internal → `____materializationPromise`

#### Functions using `_` that need reclassification:
- `_materialize()` — ✅ CORRECT: External function, called from slothlet.mjs and proxy-accessible
- `_adoptImplChildren()` — ❌ WRONG: Internal only (called by framework: modes-processor, api-assignment, api-manager) → should be `___adoptImplChildren()`
- `_createChildWrapper()` — ❌ WRONG: Internal only → should be `___createChildWrapper()`
- `_createWaitingProxy()` — ❌ WRONG: Internal only → should be `___createWaitingProxy()`

#### Functions using `__` that need reclassification:
- ~~`__setImpl()`~~ → `___setImpl()` ✅ RENAMED (correctly reclassified as internal)
- `__getState()` — ❌ WRONG PREFIX: Exposed via proxy but only called internally → should be `___getState()` (internal, not external)
- `__invalidate()` — ❌ WRONG PREFIX: Exposed via proxy but only called internally → should be `___invalidate()` (internal, not external)

## Migration Plan

1. **Phase 1:** ✅ COMPLETE (commit `2b87ceb`) — Rename `moduleID` → `__moduleID`, `filePath` → `__filePath`, `sourceFolder` → `__sourceFolder`
   - All references updated across unified-wrapper, api-manager, api-assignment, modes-processor, lifecycle handlers, ownership, metadata
   - `allowedInternals` set, proxy traps all updated
   - Full test suite passing

2. **Phase 2:** ✅ COMPLETE — Reclassify internal framework functions
   - ✅ `__setImpl` → `___setImpl` (internal framework function)
   - ✅ `___resetLazy` added as internal function
   - ⏸️ `__getState` and `__invalidate` — **DEFERRED** (should be `___` as internal functions, not `__`)
   - ⏸️ `_adoptImplChildren`, `_createChildWrapper`, `_createWaitingProxy` — **DEFERRED** (should all be `___` as internal)
   - **Rationale:** All these functions are only called by framework internals (modes-processor, api-manager, api-assignment, unified-wrapper itself), never by user code. They're exposed via proxy getTrap but that's for internal framework access, not external API.

3. **Phase 3:** ⏸️ **DEFERRED** — Rename truly internal variables to `____` prefix
   - Current state: `_callableImpl`, `_waitingProxyCache`, `_proxy`, `_userMetadata`, `_materializeFunc`, `_materializationPromise`, `_id`
   - Target state: `____callableImpl`, `____waitingProxyCache`, `____proxy`, `____userMetadata`, `____materializeFunc`, `____materializationPromise`, `____id`
   - **Blocker:** Test failures indicate cascading dependencies that need deeper analysis

4. **Phase 4:** ⏸️ **DEFERRED** — Rename truly internal functions to `___` prefix
   - Current state: `_createChildWrapper`, `_createWaitingProxy`
   - Target state: `___createChildWrapper`, `___createWaitingProxy`
   - **Blocker:** Dependent on Phase 3 completion

5. **Phase 5:** ⏸️ **DEFERRED** — Audit all other source files for consistency
   - Files to audit: `component-base.mjs`, `api-manager.mjs`, `ownership.mjs`, `metadata.mjs`, `lifecycle.mjs`
   - **Blocker:** Dependent on Phases 3-4 completion

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

## Implemented: Nested Internal Variables (`__slothletInternal`)

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
this.__slothletInternal = Object.create(null);
this.__slothletInternal.moduleID = "...";
this.__slothletInternal.filePath = "...";
this.__slothletInternal.sourceFolder = "...";
this.__slothletInternal.mode = "lazy";
this.__slothletInternal.apiPath = "math";
this.__slothletInternal.state = { materialized: false, inFlight: false };
```

### Why This Matters

1. **One collision point instead of many** — Only `__slothletInternal` needs to be unique. All child properties inside it are isolated from user exports entirely.
2. **Proxy trap simplification** — The `allowedInternals` Set currently has 20+ entries and grows with every new property. With nesting, the getTrap only needs to intercept ONE property name.
3. **Cleaner `ownKeys` / `getOwnPropertyDescriptor`** — No need to filter out dozens of internal properties when enumerating. Just filter the single container.
4. **Follows the established pattern** — Slothlet already nests builtin functions under `slothlet.*` (e.g., `api.slothlet.shutdown()`, `api.slothlet.reload()`). Internal variables should follow the same containment principle.
5. **Future-proof** — Adding new internal state never risks colliding with user exports, no matter what users name their modules.
6. **Preserves user internals** — Users can still have their own `_` prefixed properties without collision. The proxy getTrap looks for `__slothletInternal` specifically, not blocking all underscored properties.

### What Stays Exposed

- `_materialize()` — Must remain on the surface so users can force materialization if needed

### Migration Approach

This was implemented in Phase 6:

1. ✅ Created `this.__slothletInternal = Object.create(null)` in constructor
2. ✅ Moved all `__` prefixed variables into `this.__slothletInternal.*` (dropping the prefix)
3. ✅ Updated proxy traps to route `__slothletInternal` access
4. ✅ Updated all internal code to read from `this.__slothletInternal.X` instead of `this.__X`
5. ✅ Kept `_materialize()` exposed on the surface
6. ✅ Proxy getTrap backward compat: old `__mode`, `__apiPath` etc. still work through proxy
