# API Mutation Conditions (M##)

Dynamic-mutation conditions — how the api tree is shaped by runtime `api.slothlet.api.add()` / `remove()` / `mount` / reload, as opposed to the initial disk/manifest build. These decide placement, container creation, pruning, and removal/reload semantics.

- **Series**: `M##`
- **Rule**: [Rule 18 — Dynamic API Mutation](../API-RULES.md#rule-18-dynamic-api-mutation) (add/remove/reload). M04/M05 also serve [Rule 3 — No Empty Leaves](../API-RULES.md#rule-3-no-empty-leaves); M03 shares wrap-on-set with [Rule 21](../API-RULES.md#rule-21-reserved-keys--built-in-surface).
- Collision **mode** semantics at add-time are the `O##` conditions (Rule 17); this family covers the placement/lifecycle decisions around them.

---

## M01: `ensureParentPath` Auto-Creates Namespace Containers

**Related Rule**: [Rule 18](../API-RULES.md#rule-18-dynamic-api-mutation)
**Status**: ✅ Active

**Pattern**: A missing intermediate path segment is auto-created as an empty-impl namespace container (a real `UnifiedWrapper` proxy, not a plain `{}`).

**Source(s)**: `src/lib/handlers/api-manager.mjs:410-429`

**Condition Check**:

```javascript
const next = current[part];
if (next === undefined) {
	containerWrapper.___setImpl({}, moduleID);
	current[part] = containerWrapper.createProxy();
}
```

**Trigger**: `current[part] === undefined`
**Result**: an empty namespace container proxy is inserted so the mount can nest under it.

---

## M02: Non-Object Value Blocks Nested Mount

**Related Rule**: [Rule 18](../API-RULES.md#rule-18-dynamic-api-mutation)
**Status**: ✅ Active

**Pattern**: A mount that would nest under an existing non-object / non-function value is refused.

**Source(s)**: `src/lib/handlers/api-manager.mjs:431-441`

**Trigger**: existing segment value is neither object nor function
**Result**: `throw INVALID_CONFIG_API_PATH_INVALID` (reason `API_PATH_REASON_NOT_TRAVERSABLE`).

---

## M03: `setOwnedProperty` (self.X =) Wrap-on-Set

**Related Rule**: [Rule 18](../API-RULES.md#rule-18-dynamic-api-mutation) (with [Rule 21](../API-RULES.md#rule-21-reserved-keys--built-in-surface))
**Status**: ✅ Active

**Pattern**: A runtime top-level write wraps callable/object values through `UnifiedWrapper` (flagged `userAssigned`); primitives are stored raw.

**Source(s)**: `src/lib/handlers/api-manager.mjs:573-586` · `src/lib/handlers/unified-wrapper.mjs:4652-4699` (set-trap)

**Trigger**: `typeof value === "function" || (value !== null && typeof value === "object")`
**Result**: wrapped proxy stored (see O15 for reload survival); primitive stored directly.

---

## M04: `deletePath` Prunes Empty Ancestor Containers

**Related Rule**: [Rule 3 — No Empty Leaves](../API-RULES.md#rule-3-no-empty-leaves) (via [Rule 18](../API-RULES.md#rule-18-dynamic-api-mutation))
**Status**: ✅ Active

**Pattern**: After deleting a leaf, any now-empty ancestor container is pruned too (walking deepest-to-shallowest), so no dangling empty namespace remains.

**Source(s)**: `src/lib/handlers/api-manager.mjs:1468-1474`

**Trigger**: post-delete, an ancestor value is an object/function with `Object.keys(value).length === 0`
**Result**: the empty ancestor is deleted.

---

## M05: Empty Add Is a No-Op

**Related Rule**: [Rule 3 — No Empty Leaves](../API-RULES.md#rule-3-no-empty-leaves) (via [Rule 18](../API-RULES.md#rule-18-dynamic-api-mutation))
**Status**: ✅ Active

**Pattern**: An add whose resolved export map has nothing to mount warns and mounts nothing — a no-op, not a hard error (mirrors the empty-directory warning).

**Source(s)**: `src/lib/handlers/api-manager.mjs:2200-2214` (#136)

**Trigger**: `rootKeys.length === 0 && isSynthetic`
**Result**: `WARN_SYNTHETIC_ROOT_EMPTY` emitted; the merge loop mounts nothing.
**Rule tie**: the mutation-layer companion to G06 (empty folder) and the empty-value leaf (placement) under Rule 3.

---

## M06: Synthetic Add — Content → Export-Map + Root Re-Key

**Related Rule**: [Rule 18](../API-RULES.md#rule-18-dynamic-api-mutation)
**Status**: ✅ Active

**Pattern**: An in-memory (`#117`) add maps its second argument to an export map three ways — a bare function → a single `default` leaf; `{exports: <object>}` → unwrap `exports`; a plain object → its own keys are the map. At a **root** mount a function `default` has no path segment, so it is re-keyed onto its own function name (dropped with a warning if unnamed; a same-named export wins via spread order).

**Source(s)**: `src/lib/handlers/api-manager.mjs:1792-1823` (3-way) · `:1824-1871` (root fn-default re-key) — all `#136`

**Trigger**: `typeof folderPath === "function"` / `hasOwnProperty(folderPath,"exports")` / plain object; `parts.length === 0 && typeof syntheticExports.default === "function"`
**Result**: the synthetic export map and its placement at the mount path.

---

## M07: Single-File / Synthetic One-Key Unwrap

**Related Rule**: [Rule 18](../API-RULES.md#rule-18-dynamic-api-mutation)
**Status**: ✅ Active

**Pattern**: A single-file or synthetic add whose build result has exactly one top-level key exposes that key's exports directly at the mount path, dropping the filename/placeholder wrapper level.

**Source(s)**: `src/lib/handlers/api-manager.mjs:2067-2073`

**Trigger**: `(isFile || isSynthetic) && Object.keys(newApi).length === 1`
**Result**: `apiToMerge = newApi[fileName]`.

---

## M08: Bare-Function Merged Value → Callable Container

**Related Rule**: [Rule 18](../API-RULES.md#rule-18-dynamic-api-mutation)
**Status**: ✅ Active

**Pattern**: A nested-path add whose merged value is a bare (non-wrapper) function is wrapped as a callable container, so `api.logger()` stays callable while `api.logger.utils.*` siblings still attach.

**Source(s)**: `src/lib/handlers/api-manager.mjs:2260-2278`

**Trigger**: `resolveWrapper(apiToMerge) === null && typeof apiToMerge === "function"`
**Result**: a container wrapper with `isCallable: true` is built around the function.

---

## M09: Removal — Remove-if-Sole vs Revert-if-Shared

**Related Rule**: [Rule 18](../API-RULES.md#rule-18-dynamic-api-mutation)
**Status**: ✅ Active

**Pattern**: Removal never blanket-deletes a subtree. Per node: a **shared** node reverts to its prior owner's value; a **solely-owned** node is deleted only if nothing is still registered beneath it. Scoped removals walk deepest-path-first and mark a fully-emptied module unregistered before teardown (so a late lazy registration can't resurrect it).

**Source(s)**: `src/lib/handlers/api-manager.mjs:2850-2916` (scoped) · `:2952-3033` (path) · `:3095-3212` (whole-module classify/delete/rollback)

**Trigger**: per owned path — current owner differs (rollback), sole owner + no surviving child (delete), or foreign-owned descendants remain (leave the container)
**Result**: revert-to-prior (`setValueAtPath … collisionMode:"replace"`) or `deletePath`, never a blanket subtree wipe.

---

_Mutation family: M01–M09, under Rule 18 (M04/M05 also Rule 3). Reload placement mechanics (endpoint ordering, force-replace, lazy-reset, recreate) are internal realizations of these conditions and are documented inline in `api-manager.mjs` rather than as separate user-observable conditions._
