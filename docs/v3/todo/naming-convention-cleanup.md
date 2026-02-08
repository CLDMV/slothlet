# Naming Convention Cleanup — UnifiedWrapper & Internal Properties

**Priority:** High (consistency/maintainability)
**Status:** TODO
**Created:** 2026-02-07

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

### No prefix at all (should be `__` external variables)

These properties are stored on `UnifiedWrapper` instances WITHOUT any prefix, yet they are internal wrapper properties that should NOT be confused with user-defined API children:

- **`moduleID`** — stored at `unified-wrapper.mjs` line ~229
- **`filePath`** — stored at `unified-wrapper.mjs` line ~230
- **`sourceFolder`** — stored at `unified-wrapper.mjs` line ~231

These are defined as non-enumerable via `Object.defineProperty`, but the lack of prefix means:
1. They can collide with user-exported properties named `moduleID`, `filePath`, or `sourceFolder`
2. They are inconsistent with `__mode`, `__apiPath`, `__isCallable` which ARE prefixed
3. Code reading `wrapper.moduleID` looks like a user-facing property, not an internal one

**Fix:** Rename to `__moduleID`, `__filePath`, `__sourceFolder` and update all references.

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

#### Functions using `_` that may need reclassification:
- `_materialize()` — called from proxy, external → `_` is correct
- `_adoptImplChildren()` — called from proxy and internally → needs classification
- `_createChildWrapper()` — internal only → `___createChildWrapper()`
- `_createProxy()` — called externally → `_` is correct
- `_createWaitingProxy()` — internal → `___createWaitingProxy()`

#### Functions using `__` that should be `_`:
- `__setImpl()` — external function, accessible via proxy → should be `_setImpl()`
- `__getState()` — external function, accessible via proxy → should be `_getState()`
- `__invalidate()` — external function, accessible via proxy → should be `_invalidate()`

## Migration Plan

1. **Phase 1:** Rename `moduleID` → `__moduleID`, `filePath` → `__filePath`, `sourceFolder` → `__sourceFolder`
   - Update all references in `unified-wrapper.mjs`, `api-manager.mjs`, `api-assignment.mjs`, `modes-processor.mjs`, lifecycle handlers, ownership, metadata
   - Update `allowedInternals` set in getTrap
   - Update proxy getOwnPropertyDescriptor, ownKeys traps
   - Run full test suite

2. **Phase 2:** Reclassify `__setImpl` → `_setImpl`, `__getState` → `_getState`, `__invalidate` → `_invalidate`
   - These are functions, not variables — convention says `_` for external functions, `__` for external variables

3. **Phase 3:** Rename truly internal variables to `____` prefix
   - `_callableImpl` → `____callableImpl`
   - `_waitingProxyCache` → `____waitingProxyCache`
   - `_proxy` → `____proxy`
   - `_userMetadata` → `____userMetadata`
   - `_materializeFunc` → `____materializeFunc`

4. **Phase 4:** Rename truly internal functions to `___` prefix
   - `_createChildWrapper` → `___createChildWrapper`
   - `_createWaitingProxy` → `___createWaitingProxy`

5. **Phase 5:** Audit all other source files for consistency
   - `component-base.mjs`
   - `api-manager.mjs`
   - `ownership.mjs`
   - `metadata.mjs`
   - `lifecycle.mjs`

## Impact

- **Breaking:** If any external consumers reference `_proxyTarget` (already removed), `moduleID`, `filePath`, or `sourceFolder` directly
- **Tests:** All tests referencing internal properties will need updating
- **Proxy traps:** `allowedInternals` set, getTrap, hasTrap, ownKeysTrap all need updating per phase

## Notes

- Each phase should be a separate commit with full `npm run precommit` passing
- The `allowedInternals` Set in `getTrap` must be updated to match whatever prefix is used
- Non-enumerable + non-prefix properties (`moduleID`, `filePath`, `sourceFolder`) are the highest priority fix since they can shadow user exports

## Future Direction: Nesting Internal Variables

Beyond prefix conventions, the long-term goal should be to **nest all internal wrapper variables inside a single private container object** — similar to how builtin functions are already nested under `slothlet`:

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
this.__internal = Object.create(null);
this.__internal.moduleID = "...";
this.__internal.filePath = "...";
this.__internal.sourceFolder = "...";
this.__internal.mode = "lazy";
this.__internal.apiPath = "math";
this.__internal.state = { materialized: false, inFlight: false };
```

### Why This Matters

1. **One collision point instead of many** — Only `__internal` (or whatever the container is named) needs to be unique. All child properties inside it are isolated from user exports entirely.
2. **Proxy trap simplification** — The `allowedInternals` Set currently has 20+ entries and grows with every new property. With nesting, the getTrap only needs to intercept ONE property name.
3. **Cleaner `ownKeys` / `getOwnPropertyDescriptor`** — No need to filter out dozens of internal properties when enumerating. Just filter the single container.
4. **Follows the established pattern** — Slothlet already nests builtin functions under `slothlet.*` (e.g., `api.slothlet.shutdown()`, `api.slothlet.reload()`). Internal variables should follow the same containment principle.
5. **Future-proof** — Adding new internal state never risks colliding with user exports, no matter what users name their modules.

### Migration Approach

This would be a Phase 6 after the prefix standardization is complete:

1. Create `this.__internal = Object.create(null)` in constructor
2. Move all `__` prefixed variables into `this.__internal.*` (dropping the prefix)
3. Update proxy traps to route `__internal` access
4. Update all internal code to read from `this.__internal.X` instead of `this.__X`
5. The proxy `getTrap` can be radically simplified — any prop starting with `_` returns `undefined` except `__internal`
