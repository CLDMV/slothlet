# Changelog notes — Stackable lifecycle routines (#341)

**Status**: Preemptive notes, authored alongside the feature and kept up to date as it's built and reviewed — not a throwaway draft. When the release-doc PR for this version is opened, its author should read this file directly for first-hand knowledge of the feature (instead of reconstructing it from a diff or commit log), fold it into the combined `docs/changelog/v3/vX.Y.Z.md` entry for that release, and delete this file. This is one `feat` release from the changelog's perspective — the entry below describes the finished feature's behavior, not the sequence of commits (including code-review follow-ups) that produced it.

**Issue**: [#341](https://github.com/CLDMV/slothlet/issues/341)
**PR**: [#354](https://github.com/CLDMV/slothlet/pull/354)
**Expected release type**: Minor — new `routines` / `autoRoutines` config surface, additive; no removed or renamed public API.

---

## Overview

Slothlet's recursive module-merge silently kept only the first writer whenever two or more modules exported the same key at the same composed api path — fine for ordinary leaves, but wrong for a "lifecycle hook" style export (`initialize`, `shutdown`, a custom name) that every contributing module wants to run, not just the first one mounted. **Stackable lifecycle routines** (#341) add a `routines` config option: every module exporting a function matching a configured routine name is stacked into one callable at that composed path, and a root cascade (`self.<name>()` ≡ `api.slothlet.<name>()`) runs every matching contribution anywhere in the tree. This replaces the old `_collectLifecycleHooks` walk entirely — the internal mechanism behind the now-deprecated `collectLifecycleHooks` option — with one general-purpose system that covers `shutdown`/`destroy` auto-invocation (its old job) plus arbitrary named routines, startup invocation, and multi-contributor stacking (both new).

No public API is removed and no existing behavior changes unless a project opts in — either by setting `routines` explicitly, or by turning on `autoRoutines`/`collectLifecycleHooks`. See the **Deprecations** section below for one non-obvious behavior change that _does_ apply automatically to existing `collectLifecycleHooks: true` consumers.

---

## ✨ Features

### Stackable lifecycle routines (#341)

- **Config**: `routines: Array<string | { name, mode?, recursive?, order? }>`. String forms: `"name"` (mode `"manual"`) or `"name:mode"`. Object form adds `recursive` (boolean, default `false`) and `order` (`"mount" | "depth"`, mode-defaulted). Providing `routines` at all **replaces** the built-in default (`slothlet.defaults.routines`: `initialize` → `startup`, `shutdown` → `shutdown`) — spread `slothlet.defaults.routines` to extend rather than replace, or pass `[]` to disable every routine. A routine name may not be `"slothlet"` or a prototype-pollution meta-key (`__proto__`, `constructor`, `prototype`) — both are rejected at config-validation time, since a routine's name is used verbatim as a property key on the api root and `api.slothlet`.
- **Name matching — three modes, all reusing slothlet's existing glob engine (`compilePattern()`)**:
  - **Bare / dotted, mount-relative (default)** — `name` is resolved relative to the module's own mount point (a `dir`-scan top level, or an `api.add()` target). A bare name (`"initialize"`) matches only that mount's own top level; a dotted name (`"admin.initialize"`) matches a fixed relative sub-path. A mount's own top level is always eagerly constructed regardless of lazy/eager mode, so the common case never forces materialization.
  - **`recursive: true`** — the dotted/bare name is searched at _any_ depth within the mount's own subtree (`**.<name>` under the mount), not just the fixed relative path — including a subtree whose own top-level folder happens to be literally named `shutdown`, `destroy`, or `slothlet`, since those names are reserved only at the true api root, never at a mount's own top level.
  - **`^`-prefixed, root-anchored** — the name is a full glob (`*`, `**`, `{a,b}`, `!`) matched against the complete composed api path, crossing mount boundaries (e.g. `^ext.*.initialize`, `^**.shutdown`).
  - Recursive and root-anchored matches force lazy-mode materialization of the relevant subtree (the whole tree, for a root-anchored pattern) before a cascade runs — documented as the deliberate, unavoidable crux of combining lazy mode with a routine name that isn't mount-top-level. That materialization is scoped to what the pattern actually needs: when a mount's contents are already covered by the base compose's own subtree, they aren't walked a second time.
- **Modes**: `manual` (never auto-runs; always stacked/callable), `startup` (cascade runs once, at the end of `load()` / `await slothlet(...)`), `shutdown` (cascade runs on `api.shutdown()` / `api.slothlet.shutdown()`), `destroy` (cascade runs on `api.destroy()`, which also runs the root `shutdown()` afterward — so a `mode: "shutdown"` routine still runs as part of `destroy()` too; `destroy` covers only what a consumer wants to fire specifically on destroy). `destroy()`'s own teardown (marking the instance destroyed, clearing api keys, nulling `slothlet.api`) always completes even when a routine fails during either its `destroy`-mode cascade or the `shutdown()` call it makes internally — any failure is deferred and rethrown only after cleanup finishes.
- **Root cascade ordering**: `order: "mount"` (default for `startup`/`manual`) runs groups in registration order; `order: "depth"` (default for `shutdown`/`destroy`) runs deepest composed-path groups first, mirroring the old walk's deepest-first teardown order.
- **Errors — best-effort, aggregated**: a throwing contributor does not stop the chain — every contributor at a path, and every path in a cascade, still runs, and a receiver that can't be resolved (e.g. a permission-gated read) is treated like a missing one rather than aborting the run. If any contributor failed, one aggregated `ROUTINE_FAILED` error is thrown afterward (`context.count`, `context.failures: [{apiPath, moduleID}, …]`, `cause` = the first failure) — matching `module-manager.mjs`'s existing best-effort convention rather than introducing a second error-handling philosophy.
- **De-duplication and re-mount safety**: a module's contribution is captured once per `(apiPath, moduleID)` regardless of how many `impl:created`/`impl:changed` events it produces; removing a module drops its contributions from every affected cascade without double-counting a re-add.
- **`autoRoutines`** (new, non-deprecated replacement for `collectLifecycleHooks`): `false` by default (temporary v3-compat — see Deprecations). Every configured routine is always stacked and directly callable regardless of this flag; `autoRoutines` only gates _automatic_ firing (`startup` at compose end, `shutdown`/`destroy` at dispose).
- **`slothlet.defaults`**: new public namespace (attached on both the ESM and CJS entry points) exposing `slothlet.defaults.routines` (the frozen built-in routines list) and `slothlet.defaults.reservedExports` (the framework-reserved export names, as a genuinely immutable `Set` — reads work normally but `add`/`delete`/`clear` throw, since `Object.freeze()` alone doesn't stop a `Set`'s own mutating methods) — lets a consumer extend the defaults without retyping them.

---

## ⚠️ Deprecations

### `collectLifecycleHooks` — deprecated in favor of `routines` + `autoRoutines`

`collectLifecycleHooks` (and its internal engine, `_collectLifecycleHooks`) is removed and fully replaced by the routines system. Setting `collectLifecycleHooks: true` now:

1. Expands into two implicit, root-anchored routines reproducing the old option's exact scope for literally-named hooks: `{ name: "^**.shutdown", mode: "shutdown", order: "depth" }` and the `destroy` equivalent — whole-tree, cross-mount, deepest-first, best-effort, same as the original walk.
2. **Drops** any existing `shutdown`/`destroy`-mode routine already in the effective list — including the built-in default `shutdown` routine — before adding the two implicit ones, so a contributor is never invoked twice (once via the default bare-name routine, once via the implicit root-anchored one).
3. Sets the effective `autoRoutines` to `true`, unless `autoRoutines` is given explicitly (which always wins).

This means a project that only ever used `collectLifecycleHooks: true` for its documented purpose (auto-invoking nested `shutdown`/`destroy` functions) sees identical behavior for those two hooks. Emits a `V3_CONFIG_DEPRECATED` warning unless `silent: true`; will be removed in v4.

**Compatibility note — `autoRoutines` is not per-mode.** Because `collectLifecycleHooks: true` now also sets `autoRoutines: true`, and the built-in default routines list includes `initialize` (mode `startup`) alongside `shutdown`, turning on `collectLifecycleHooks` also newly auto-invokes any top-level `initialize` export at every mount's own root at the end of compose — something the old mechanism never did (it only ever touched `shutdown`/`destroy`). Verified directly: a project with `collectLifecycleHooks: true` and a mount-root `initialize.mjs` that was previously just an inert leaf will now have that function called automatically on `await slothlet(...)`. This is a side effect of `autoRoutines` being a single all-modes gate rather than a per-mode one, not a bug — but it is a real, non-obvious behavior change for existing `collectLifecycleHooks: true` consumers who happen to have a top-level `initialize` export they did not intend as a startup hook. **Flag this explicitly in the release notes' upgrade section**, not just in passing — it is the one case where turning on the deprecated flag does _more_ than it used to. (Nested/non-top-level `initialize` exports are unaffected — the default `initialize` routine is bare and mount-relative, not recursive or root-anchored.)

**Migration recipe for v4 (once `collectLifecycleHooks` is removed)** — reproduce the exact same effect explicitly:

```js
await slothlet({
	dir: "./api",
	autoRoutines: true,
	routines: [
		...slothlet.defaults.routines, // keep initialize:startup, drop or override as needed
		{ name: "^**.shutdown", mode: "shutdown", order: "depth" },
		{ name: "^**.destroy", mode: "destroy", order: "depth" }
	]
});
```

If the newly-surfaced `initialize` auto-invocation described above is unwanted, drop it from the spread (`routines: [{ name: "shutdown", mode: "manual" }, { name: "^**.shutdown", ... }, { name: "^**.destroy", ... }]` — keep `initialize` `manual` or omit it) while keeping `autoRoutines: true` for the shutdown/destroy cascades.

---

## 🧪 Tests

- **`tests/vitests/suites/config/routines-config.test.vitest.mjs`** (22 tests) — `slothlet.defaults` shape, freezing, and genuine `reservedExports` mutation-rejection; `routines` config normalization (string/object forms, `recursive`/`order` validation and defaults, meta-key/`"slothlet"` rejection, replace-not-merge semantics, `autoRoutines` interaction).
- **`tests/vitests/suites/lifecycle/routines.test.vitest.mjs`** (44 tests, run in both eager and lazy mode via `describe.each`) — bare/dotted mount-relative matching, `recursive` matching, `^`-root-anchored glob matching, flat cross-mount registration-order cascades, `startup`/`shutdown`/`destroy`/`manual` modes (including that `destroy()`'s own teardown always completes even when a routine fails), `order: "mount"` vs `"depth"`, best-effort/aggregated error propagation (a throwing contributor doesn't block a later one; multi-failure aggregation), and `collectLifecycleHooks` interaction (including the implicit-routine/default-routine de-duplication case).
- **`tests/vitests/suites/builders/lifecycle-hooks-collect.test.vitest.mjs`** (23 tests) — the pre-existing `collectLifecycleHooks` suite exercises the new engine end-to-end through the public `api.shutdown()`/`api.destroy()` surface rather than the old internal walk.
- New fixture directories under `api_tests/`: `api_test_routines{,_auth1,_auth2,_good,_bad,_manual,_nested}`.
- Post-destroy idempotency: calling `destroy()` (or `shutdown()`) a second time after `api.destroy()` has already nulled `slothlet.api` is a documented no-op guard (`runCascade`/`runPath` return immediately).
- Full regression: all 379 test files / 13,500+ tests pass; `npm run lint` and `npm run format:check` both clean.

---

## 📚 Documentation

- [docs/LIFECYCLE.md](../../LIFECYCLE.md) — "Routines" section fully rewritten: config table (`recursive`/`order`), the four modes, name-matching comparison table (bare/dotted/recursive/root-anchored), stacking + root cascade ordering, best-effort/aggregated errors, `autoRoutines`, and a "Relationship to `collectLifecycleHooks`" subsection.
- [docs/CONFIGURATION.md](../../CONFIGURATION.md) — `collectLifecycleHooks` marked deprecated with its expansion behavior; `routines` section rewritten for the final type signature; new `autoRoutines` section.
- [docs/MODULE-STRUCTURE.md](../../MODULE-STRUCTURE.md) — routine special-name note corrected to "same composed api path" / "registration order" (was "same namespace" / "mount order", stale from an earlier design pass).
- `src/slothlet.mjs` JSDoc (`SlothletOptions` typedef) — `collectLifecycleHooks`, `routines`, `autoRoutines` `@property` descriptions rewritten to match the final design.

---

## 🔧 Dependencies

- _No dependency updates._ Reuses the existing glob engine (`compilePattern()` from `src/lib/helpers/pattern-matcher.mjs`) already used by `HookManager`/`PermissionManager` — no new dependency, internal or external.

---

## Upgrade notes

- **No breaking changes.** `routines` and `autoRoutines` are both opt-in (`autoRoutines` defaults to `false`); a project that never touches either sees no behavior change, including the built-in default `initialize`/`shutdown` routines — they are always stacked/callable but never auto-fire unless `autoRoutines: true`.
- **`collectLifecycleHooks: true` now also implies `autoRoutines: true`** (unless `autoRoutines` is set explicitly) — see the Deprecations section above for the resulting `initialize` auto-invocation side effect. This is the one case existing consumers of the deprecated flag should specifically check for.
- **`collectLifecycleHooks` is deprecated**, emits `V3_CONFIG_DEPRECATED` unless `silent: true`, and will be removed in v4 — see the migration recipe above.

---

## Known limitation (worth a follow-up issue, not release-blocking)

A routine contributor discovered **after** the initial compose finishes — a lazy subtree materializing on first touch, or a late direct `self.x.y = fn` reassignment — is captured for the root cascade (which always re-reads current state), but the **path-level stacked callable** at that exact location is not automatically rebuilt, so it can remain un-stacked (or stacked with a stale contributor list) until something unrelated happens to trigger a rebuild (another `api.add()`, an auto-run, `reload()`). An attempted fix (rebuild on every post-compose discovery matching a routine) was reverted during review because it raced with the stack-rebuild mechanism's own reentrancy guard during `api.add()`'s concurrent per-file loading and silently dropped legitimate contributions. A correct fix needs that reentrancy guard redesigned from a blunt "pause all capture" flag to a targeted check (e.g. skip only a contribution whose function already carries the routine-stack brand). Tracked for a follow-up rather than rushed into this release.

---

## Design history (for context, not for the release notes)

Two design pivots during implementation were documented as they happened on the issue itself:

- [Mount-relative / glob / recursive / root-anchored naming](https://github.com/CLDMV/slothlet/issues/341#issuecomment-5586818260) — why routine names resolve relative to a mount point by default instead of matching anywhere in the tree, and how `recursive` and the `^` root anchor extend that.
- [`destroy` mode, `order`, best-effort aggregation, and the full `collectLifecycleHooks` replacement](https://github.com/CLDMV/slothlet/issues/341#issuecomment-5587891766) — why a separate `destroy` mode exists alongside `shutdown`, how root-cascade ordering became configurable, why error handling switched from fail-fast to best-effort, and the decision to fully replace rather than alias the old internal mechanism.
