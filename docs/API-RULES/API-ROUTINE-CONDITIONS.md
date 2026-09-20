# API Routine & Cascade Conditions (T##)

Stackable-routine conditions — how contributions to a named routine are collected, and whether an api slot becomes a plain value, a per-path "stack" callable, or a root "cascade" callable.

- **Series**: `T##`
- **Rule**: [Rule 20 — Stackable Routines & Cascades](../API-RULES.md#rule-20-stackable-routines--cascades)

---

## T01: `stackRoutines` Contributor Gate

**Related Rule**: [Rule 20](../API-RULES.md#rule-20-stackable-routines--cascades)
**Status**: ✅ Active

**Pattern**: With `stackRoutines` off (default), only the ownership-winner at a shared path counts as a contributor; with it on, every raw contribution counts regardless of collision outcome.

**Source(s)**: `src/lib/handlers/routine-manager.mjs:273-276` (`#applyStackFilter`, #365) · `:249-260` (`#isCurrentOwner`)

**Trigger**: `config?.stackRoutines`
**Result**: all contributions (on) vs owner-only filter (off).

---

## T02: Routine Name Matching (root-anchored / relative / recursive)

**Related Rule**: [Rule 20](../API-RULES.md#rule-20-stackable-routines--cascades)
**Status**: ✅ Active

**Pattern**: A routine name matches an api path root-anchored when prefixed `^`, otherwise resolved relative to the module's own mount endpoint, plus a `**.<name>` recursive form when `recursive`.

**Source(s)**: `src/lib/handlers/routine-manager.mjs:201-224` (`#matches`)

**Trigger**: `name.startsWith("^")` / relative compile / `recursive`
**Result**: boolean — whether a raw export may join this routine's stack/cascade.

---

## T03: Slot Type — Single Value vs Per-Path Stack vs Root Cascade

**Related Rule**: [Rule 20](../API-RULES.md#rule-20-stackable-routines--cascades)
**Status**: ✅ Active

**Pattern**: Re-evaluated on every mutation: a lone uncontested contributor stays a plain function; a contested per-path slot installs a stacked callable; a root-level routine-named slot installs a cascade callable.

**Source(s)**: `src/lib/handlers/routine-manager.mjs:443-598` (`#reactivelyPatchStack`, #362)

**Trigger**: contributor count / contested / cascade-slot
**Result**: plain fn (no-op), `#buildStackedCallable`, or `#buildCascadeCallable`.

---

## T04: Last-Registered-Routine Wins a Contested Slot

**Related Rule**: [Rule 20](../API-RULES.md#rule-20-stackable-routines--cascades)
**Status**: ✅ Active

**Pattern**: When two routines match the same exact path, the routine configured **last** governs the slot's install type/name.

**Source(s)**: `src/lib/handlers/routine-manager.mjs:466-489`

**Trigger**: multiple routines match one path
**Result**: later config entry overwrites `winner`.

---

## T05: Cascade Slot Never Gets Both Stack and Cascade

**Related Rule**: [Rule 20](../API-RULES.md#rule-20-stackable-routines--cascades)
**Status**: ✅ Active

**Pattern**: When a root-level contributor's own path coincides with the routine's name, only the cascade callable is installed there — never also a per-path stack.

**Source(s)**: `src/lib/handlers/routine-manager.mjs:492,540-546` · `:1697` (`rebuildStacks`)

**Trigger**: `parentPath === "" && key === winner.name`
**Result**: cascade-only at that slot.

---

## T06: `cascade: false` Suppresses the Root Run-All Property

**Related Rule**: [Rule 20](../API-RULES.md#rule-20-stackable-routines--cascades)
**Status**: ✅ Active

**Pattern**: A routine declared `cascade: false` never gets a root `api.<name>()` run-all cascade property.

**Source(s)**: `src/lib/handlers/routine-manager.mjs:543` · `:1708` (#400)

**Trigger**: `!routine.cascade`
**Result**: no `api[routine.name] = cascade` assignment.

---

## T07: Root-Builtin Names Excluded from Routines

**Related Rule**: [Rule 20](../API-RULES.md#rule-20-stackable-routines--cascades) (with [Rule 21](../API-RULES.md#rule-21-reserved-keys--built-in-surface))
**Status**: ✅ Active

**Pattern**: No stack/cascade callable is ever written at root `shutdown`/`destroy` — the framework's dispose builtins occupy those slots.

**Source(s)**: `src/lib/handlers/routine-manager.mjs:40` (`ROOT_BUILTIN_NAMES`), applied `:461,1687,1707`

**Trigger**: `parentPath === "" && ROOT_BUILTIN_NAMES.has(key)`
**Result**: `continue` — the builtin slot is left to the dispose builtins.

---

## T08: Cascade Execution Order (mount vs depth)

**Related Rule**: [Rule 20](../API-RULES.md#rule-20-stackable-routines--cascades)
**Status**: ✅ Active

**Pattern**: A cascade runs its contributors in registration ("mount") order by default, or deepest-path-first when `order: "depth"`.

**Source(s)**: `src/lib/handlers/routine-manager.mjs:1401-1407` (`#orderPaths`)

**Trigger**: `order === "depth"` vs otherwise
**Result**: `sort((a,b) => b.depth - a.depth || a.index - b.index)` vs registration order.

---

## T09: Stacked Callable Gains `.for` / `.contributors`

**Related Rule**: [Rule 20](../API-RULES.md#rule-20-stackable-routines--cascades)
**Status**: ✅ Active

**Pattern**: A generated stacked callable exposes non-enumerable `.for(key)` and `.contributors` beyond being callable — the leaf is both invocable and per-contributor-addressable.

**Source(s)**: `src/lib/handlers/routine-manager.mjs:1613-1623` (#400)

**Trigger**: any stacked callable built
**Result**: `.for` / `.contributors` defined on the callable.

---

## T10: Routine Return Shape — Scalar vs Array

**Related Rule**: [Rule 20](../API-RULES.md#rule-20-stackable-routines--cascades)
**Status**: ✅ Active

**Pattern**: A stacked/cascade invocation returns a scalar when there is one contributor, an array when there are two or more.

**Source(s)**: `src/lib/handlers/routine-manager.mjs:1077` (`runPath`) · `:1120` (`runPathFor`) · `:1462` (`runCascade`)

**Trigger**: `results.length === 1` vs `>= 2`
**Result**: `results[0]` vs `results`.

---

_Routines family: T01–T10, under Rule 20 (T07 also Rule 21). `autoRoutines` (whether the mode cascade auto-fires) governs invocation timing, not tree shape, and is not a shape condition._
