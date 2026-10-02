# API Collision & Ownership Conditions (O##)

Collision-resolution conditions — which value wins when two contributions land at the same api path. These interact with the ownership stack (which tracks _who_ owns a path); the ownership stack/rollback mechanics stay with [Rule 12](../API-RULES.md#rule-12-module-ownership-and-selective-api-overwriting), while the value-resolution decisions are catalogued here.

- **Series**: `O##`
- **Rules**: [Rule 17 — Collision Resolution](../API-RULES.md#rule-17-collision-resolution) (value winners) and [Rule 12 — Module Ownership and Selective API Overwriting](../API-RULES.md#rule-12-module-ownership-and-selective-api-overwriting) (ownership stack, rollback, user-assigned overrides).
- **Dedup**: each collision **mode** is ONE condition even though it is decided across the ownership layer, the value-execution layer, and the wrapper-sync layer — all listed under one `O##` `Source`.

---

## O01: Collision Mode — `merge`

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: Existing properties are kept and new ones added; on an overlapping key the existing value wins.

**Source(s)**: `src/lib/handlers/ownership.mjs:145` (allow) · `src/lib/builders/api-assignment.mjs:405-406` (value merge) · `src/lib/handlers/api-manager.mjs:804-839` (`syncWrapper`)

**Trigger**: `collisionMode === "merge"`
**Result**: keep existing, add genuinely-new keys; a same-name leaf collision keeps the existing leaf.

---

## O02: Collision Mode — `merge-replace`

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: New properties are added and conflicting ones overwritten (namespaces merge recursively, leaves are replaced).

**Source(s)**: `src/lib/builders/api-assignment.mjs:405-406` (`isMergeReplace`) · `src/lib/handlers/api-manager.mjs:840-890`

**Trigger**: `collisionMode === "merge-replace"`
**Result**: add new + overwrite existing on overlap.

---

## O03: Collision Mode — `replace`

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: The incoming value completely replaces the existing one (user-assigned overrides excepted — see O15).

**Source(s)**: `src/lib/builders/api-assignment.mjs:351-399` · `src/lib/handlers/api-manager.mjs:746-803` (`syncWrapper`)

**Trigger**: `effectiveMode === "replace"`
**Result**: `targetApi[key] = value` — incoming wins wholesale.

---

## O04: Collision Mode — `skip`

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: The existing value is kept and the incoming one dropped, silently.

**Source(s)**: `src/lib/handlers/ownership.mjs:147-149` · `src/lib/builders/api-assignment.mjs:266-269`

**Trigger**: `collisionMode === "skip"`
**Result**: `return null`/`false` — no change, no signal.

---

## O05: Collision Mode — `warn` (context-dependent)

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: Emits a warning, then resolves **according to the collision context** — the two are intentionally different scenarios:

- **Cross-module ownership conflict** (`ownership.mjs`): keep the existing owner, drop the incoming registration (`WARNING_OWNERSHIP_CONFLICT`).
- **Intra-build file/folder collision** (`api-assignment.mjs`): treat as `merge` to preserve lazy capability (`WARNING_COLLISION_FILE_FOLDER_MERGE`).

**Source(s)**: `src/lib/handlers/ownership.mjs:150-159` (reject + warn) · `src/lib/builders/api-assignment.mjs:273-278` (warn → merge)

**Trigger**: `collisionMode === "warn"`
**Result**: warn, then keep-existing (ownership) or merge (file/folder). Same mode name, distinct warning codes and outcomes by layer — by design.

---

## O06: Collision Mode — `error`

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: A conflict throws rather than resolving.

**Source(s)**: `src/lib/handlers/ownership.mjs:160-167` (`OWNERSHIP_CONFLICT`) · `src/lib/builders/api-assignment.mjs:255-264` (`COLLISION_ERROR`)

**Trigger**: `collisionMode === "error"`
**Result**: throw; nothing is mounted/overwritten.

---

## O07: `forceOverwrite` → `replace`

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: A per-call `forceOverwrite: true` forces full replacement regardless of the configured collision mode (a `moduleID` is auto-generated if absent).

**Source(s)**: `src/lib/handlers/api-manager.mjs:1905` (flag → `collisionModeOverride`) · `src/lib/builders/api-assignment.mjs:253` (override precedence)

**Trigger**: `forceOverwrite: true`
**Result**: `collisionMode` treated as `replace` for that call.

---

## O08: Merge-Loss (function-vs-function under `merge`)

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: Under `merge`, when a different module's **function** already owns the exact leaf path, the incoming callable loses — the existing callable stays live. A container/namespace instead merges children (no single winner).

**Source(s)**: `src/lib/handlers/ownership.mjs:254-256,265-289`

**Trigger**: function-vs-function collision at an owned leaf under `merge`
**Result**: incoming entry flagged `isMergeLoss`; existing callable remains the live value.

---

## O09: Namespace-vs-Callable → Callable Wins

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: When a plain namespace and a callable collide, the callable takes the slot; the namespace's non-conflicting children are grafted onto it.

**Source(s)**: `src/lib/builders/api-assignment.mjs:602-633`

**Trigger**: `!existingIsCallable && valueIsCallable`
**Result**: callable occupies the slot, existing children merged on (merge: existing child wins; merge-replace: incoming wins).

**At runtime** (`api.slothlet.api.add()`, `reload()`, a `remove()` that reverts to a function owner, a lazy materialization that turns out callable): the same holds regardless of add order. When a later module supplies the function for a namespace an earlier module created as a plain namespace, the namespace becomes callable and keeps every child (`src/lib/handlers/unified-wrapper.mjs` `___adoptCallableImpl` / `___upgradeToCallableProxy`). The function slot resolves like any other merged member: a namespace with no function always takes the incoming one; one that already has a function keeps it under `merge` (first writer wins, as in O08) and takes the incoming one under `merge-replace` (incoming wins).

```javascript
await api.slothlet.api.add("plugins", "./plugins-a", { moduleID: "a" }); // plain namespace
const held = api.plugins; // typeof "object"
await api.slothlet.api.add("plugins", "./plugins-b", { moduleID: "b" }); // b's default export flattens onto plugins

typeof api.plugins; // "function"
api.plugins(); // runs b's function
api.plugins.fromA(); // a's children stay

held.fromA(); // a held reference keeps reading, enumerating and writing through
typeof held; // "object" — it stays non-callable; read api.plugins again to call it
```

A Proxy's callability is fixed when it is created, so the namespace gets a new proxy on a function target, installed in its parent in place of the old one; the old proxy forwards every operation to the new one (the same forwarding `restart()` gives held references). A reference taken before the change therefore stays non-callable, while `api.<path>` is callable. A namespace no module ever makes callable keeps `typeof` "object".

On `remove()`, the namespace's function is resolved again from the modules that remain, in the order they were added: the first one that supplies a function takes the slot, and a later one replaces it only if it was added under `merge-replace` or `replace` (a merge loser never does). So removing the module whose function won reverts to the function that was there before it — under `merge-replace`, the previous function — and removing a module whose function lost, or one that only contributed children, leaves the function as it is.

```javascript
// collision.api: "merge-replace"
await api.slothlet.api.add("plugins", "./plugins-a", { moduleID: "a" }); // plain namespace
await api.slothlet.api.add("plugins", "./plugins-b", { moduleID: "b" }); // supplies a function
await api.slothlet.api.add("plugins", "./plugins-c", { moduleID: "c" }); // supplies another: c's wins
await api.slothlet.api.remove("c"); // api.plugins() runs b's function again
```

The change to a callable proxy is one-way: when no function is left (`remove()` of the only module that supplied one, or a `reload()` after which no module exports one), the namespace's children revert as usual but it keeps the callable proxy — `typeof` stays "function" and a call throws `INVALID_CONFIG_NOT_A_FUNCTION`, exactly as for a namespace that was callable from the start.

---

## O10: Wrapper / Plain Fall-Through Winners

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: Outside the wrapper-vs-wrapper path, three shape combinations resolve differently: wrapper-vs-plain merges the plain object's keys onto the wrapper (incoming keys win); plain-vs-wrapper replaces the plain with the wrapper; plain-vs-plain does `Object.assign` (incoming wins).

**Source(s)**: `src/lib/builders/api-assignment.mjs:715-736`

**Trigger**: mixed wrapper/plain shapes at a collision
**Result**: three distinct winners as above.

---

## O11: `mergeApiObjects` `removeMissing`

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: When `removeMissing` is set, target leaves absent from the source are deleted during a merge (used by hot-reload to prune).

**Source(s)**: `src/lib/builders/api-assignment.mjs:856-862`

**Trigger**: `options.removeMissing === true`
**Result**: `delete targetApi[key]` for each key not in the source.

---

## O12: Load / Mount Order (collision precedence)

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: The order modules are processed — default `priority` descending, then `packageName` ascending by raw codepoint — is the precedence "last wins"/"first wins" resolution iterates. A caller comparator overrides it.

**Source(s)**: `src/lib/helpers/module-sort.mjs:80-89` (default) · `:60-63` (comparator override)

**Trigger**: default ordering, or a supplied comparator
**Result**: fixes which contribution is processed first/last at a shared path.

---

## O13: Mount Preflight Collision Throw

**Related Rule**: [Rule 17](../API-RULES.md#rule-17-collision-resolution)
**Status**: ✅ Active

**Pattern**: For an external-module mount under `collisionMode: "error"`, an exact-mountPath collision is thrown before the mount runs (the underlying build then uses `merge`).

**Source(s)**: `src/lib/handlers/module-manager.mjs:427-442` (tagged `S7`) · `:445` (`error` → `merge` for the underlying add)

**Trigger**: `collisionMode === "error"` and an exact-path collision exists
**Result**: `throw MODULE_MOUNT_COLLISION` — module never mounts.

---

## O14: Cross-Module `replace` Shadow Capture & Restore

**Related Rule**: [Rule 12](../API-RULES.md#rule-12-module-ownership-and-selective-api-overwriting)
**Status**: ✅ Active

**Pattern**: When a cross-module `replace` drops a first module's exclusive members, those detached child wrappers are captured; removing the overriding module re-attaches them, restoring the first module's mount.

**Source(s)**: `src/lib/handlers/api-manager.mjs:941-974` (capture, #3) · `:3214-3233` (restore)

**Trigger**: `replace` detaches foreign-owned members / the overrider is later removed
**Result**: shadowed members stashed in `replaceShadows`, re-defined on removal.

---

## O15: User-Assigned Overrides Survive `replace`/Reload

**Related Rule**: [Rule 12](../API-RULES.md#rule-12-module-ownership-and-selective-api-overwriting)
**Status**: ✅ Active

**Pattern**: A runtime wrap-on-set override (`self.x = …`, flagged `userAssigned`) is excluded from a `replace`'s delete/re-adopt/copy cycle, so it survives reloads verbatim.

**Source(s)**: `src/lib/handlers/api-manager.mjs:711-715,785-795` (#329)

**Trigger**: `resolveWrapper(existingWrapper[k])?.____slothletInternal?.userAssigned`
**Result**: the override stays attached and untouched through replace/reload.

---

_Collision/ownership family: O01–O15. O01–O13 → Rule 17; O14–O15 → Rule 12. The ownership-stack mechanics themselves (register conflict handling, `#currentEntry` non-loss resolution, `removePath` restore/delete, duplicate-registration reposition/recompute) are documented under Rule 12 directly._
