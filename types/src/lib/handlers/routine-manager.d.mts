/**
 * Tracks, per Slothlet instance, every mounted module's raw contribution of a real function at any
 * api path, and resolves — on demand, at rebuild/cascade time, never inside the event handler
 * itself — which configured routine(s) each one matches.
 *
 * @description
 * Interpretation is deliberately deferred: a module's ownership *endpoint* (its own mount root,
 * needed for mount-relative name matching) is not recorded until AFTER all of that module's own
 * `impl:created` events have already fired (see `api-manager.mjs`'s `addApiComponent` —
 * `setModuleEndpoint` runs once, after `buildAPI` has already built and emitted for every leaf).
 * Matching inside the event handler would therefore see `undefined` for a brand-new module's own
 * endpoint on its very first events. Capturing the raw `{apiPath, moduleID, fn}` unconditionally and
 * resolving matches later — once every relevant `setModuleEndpoint` call has definitely run —
 * sidesteps that ordering hazard entirely.
 *
 * @class RoutineManager
 * @extends ComponentBase
 * @public
 */
export class RoutineManager extends ComponentBase {
    static slothletProperty: string;
    /**
     * Create a RoutineManager instance.
     * @param {object} slothlet - Slothlet class instance.
     */
    constructor(slothlet: object);
    /**
     * Raw capture, in arrival (registration) order, deduplicated by `(apiPath, moduleID)`. A
     * re-registration of the same pair (hot-reload, or an incidental re-touch from an unrelated
     * later mount at the same parent path) replaces the existing entry in place — preserving its
     * original position — rather than appending a duplicate.
     * @type {Array<{apiPath: string, moduleID: string, fn: Function}>}
     */
    raw: Array<{
        apiPath: string;
        moduleID: string;
        fn: Function;
    }>;
    /**
     * Every `raw` entry's originating `UnifiedWrapper`, keyed `moduleID -> apiPath -> wrapper` —
     * populated alongside `raw` in {@link RoutineManager#onImplCreated} purely so a
     * build-attempt-wide revert ({@link RoutineManager#revertSpeculativeState}) can invalidate
     * exactly the wrapper(s) IT speculatively created, without needing a concrete api-tree
     * reference to walk. Never consulted by routine execution itself — `raw`'s own `fn` field
     * stays the single source of truth there. Nested (not a single `` `${moduleID}:${apiPath}` ``
     * string key) because `:` is a valid character in a user-supplied moduleID — a flat string
     * key risked one module's prefix-scan (e.g. `pruneModule("a")`, matching `"a:"`) wrongly
     * catching another module's entries (e.g. moduleID `"a:b"`'s own `"a:b:sub.path"` key)
     * (#372/#373 review, suppressed finding).
     * @type {Map<string, Map<string, object>>}
     */
    rawWrappers: Map<string, Map<string, object>>;
    /**
     * Recording guard. `rebuildStacks()` overwrites live api properties, which re-enters
     * `onImplCreated` via the same `impl:created` event every other write goes through — this
     * flag is turned off for the duration of that overwrite so the stacked callable it just
     * installed is never captured as a phantom contributor to its own chain.
     * @type {boolean}
     */
    recording: boolean;
    /**
     * Compiled-glob-pattern cache, keyed by the raw pattern string (never includes a leading `^`
     * — callers strip that themselves before compiling).
     * @type {Map<string, function(string): boolean>}
     */
    patternCache: Map<string, (arg0: string) => boolean>;
    /**
     * Discard all captured state. Called at the start of every `load()` (including `reload()`,
     * which re-invokes `load()` on the same instance) so a previous cycle's contributors never
     * bleed into a fresh compose.
     * @returns {void}
     * @public
     */
    public reset(): void;
    /**
     * Lifecycle subscriber for BOTH `impl:created` and `impl:changed` (subscribed to both in
     * src/slothlet.mjs's `_setupLifecycleSubscribers()`). Captures a contribution's raw
     * `{apiPath, moduleID, fn}` unconditionally — routine-name interpretation happens later, at
     * rebuild/cascade time (see the class-level description for why).
     *
     * @description
     * Reads `data.wrapper.__impl` (present on every such event, in both eager and lazy mode) rather
     * than `data.impl` — `impl:created` fires twice per leaf construction (once with `impl` set to
     * the wrapper itself, once with the raw value for eager-known impls), and `wrapper.__impl` is
     * the one consistent field across every variant. Fires BEFORE collision resolution decides
     * which contributor's value survives onto the composed tree, so every contributor is captured —
     * not just the merge winner.
     *
     * Also subscribed to `impl:changed` so a LATE, direct reassignment (`self.auth.shutdown = fn`,
     * done after the module that owns `auth` finished loading) is captured too, not just the
     * original module-load-time contribution — and, symmetrically, so a later reassignment AWAY
     * from a function (to an object, `null`, or any other non-function value) removes the earlier
     * capture rather than leaving a stale function contribution behind for a cascade to invoke.
     * @param {object} data - `impl:created` / `impl:changed` event payload.
     * @returns {void}
     * @public
     */
    public onImplCreated(data: object): void;
    /**
     * Lifecycle subscriber: `impl:removed`. Prunes a removed module's raw contribution.
     * @param {object} data - `impl:removed` event payload.
     * @returns {void}
     * @public
     */
    public onImplRemoved(data: object): void;
    /**
     * Prune every raw-captured contribution at or below a given api path for one moduleID — the
     * scoped-removal analog of {@link RoutineManager#pruneModule}, for when a whole SUBTREE (not
     * just its own top-level property) is deleted from the live tree.
     * @param {string} apiPath - The removed subtree's own root path.
     * @param {string} moduleID - Module identifier whose descendant contributions to prune.
     * @returns {void}
     * @public
     *
     * @description
     * The scoped two-argument `api.remove(apiPath, moduleID)` deletes the ENTIRE live subtree
     * rooted at `apiPath` (`ApiManager#deletePath`), but `impl:removed` only ever fires for the
     * exact property that was deleted — never for descendants that were simply carried away with
     * it. A nested routine capture like `auth.initialize` therefore survived indefinitely in `raw`
     * after removing `auth`, still invoked by `stackRoutines: true`'s cascades even though its
     * whole subtree is gone (#372/#373 review, suppressed finding).
     *
     * @example
     * routineManager.pruneSubtree("auth", moduleID);
     */
    public pruneSubtree(apiPath: string, moduleID: string): void;
    /**
     * Prune every raw-captured contribution belonging to a module, regardless of whether it was
     * ever the live property at its own path.
     * @param {string} moduleID - Module identifier being fully removed.
     * @returns {void}
     * @public
     *
     * @description
     * `onImplRemoved()` alone is not enough for a whole-module removal: it prunes by (apiPath,
     * moduleID) on the `impl:removed` lifecycle event, which fires only when a property is actually
     * DELETED from the live composed tree. A module that lost a collision (a merge-loser, recorded
     * in ownership but never installed as the live property at its path) is never the live property,
     * so removing it resolves as an ownership "restore" (the current owner's value is re-applied,
     * unchanged) rather than a "delete" — `impl:removed` never fires for the loser's own entry, and
     * its raw contribution would otherwise survive `api.remove()` indefinitely, still invoked under
     * `stackRoutines: true` (#372). Call this alongside `OwnershipManager#unregister()` for a
     * whole-module removal, which already discards every path the module owned regardless of
     * whether the live tree changed for each one.
     *
     * @example
     * ownership.unregister(moduleID);
     * routineManager.pruneModule(moduleID);
     */
    public pruneModule(moduleID: string): void;
    /**
     * Snapshot the raw contributions moduleID currently has, keyed by apiPath, for later restoration
     * @param {string} moduleID - Module identifier to snapshot.
     * @returns {Map<string, {fn: Function, index: number, wrapper: object|undefined}>} One entry per
     *   apiPath the module currently contributes to.
     * @public
     *
     * @description
     * Call this BEFORE a candidate build's construction (buildAPI) runs, so a later revert can tell
     * an apiPath moduleID already genuinely contributed to (whose entry must be restored, not
     * dropped) from one the candidate build's own speculative `impl:created` capture fabricated
     * (which must be discarded outright). Capturing `wrapper` alongside `fn`/`index` lets a restore
     * put the ORIGINAL wrapper back into {@link RoutineManager#rawWrappers} tracking too — otherwise
     * a candidate's own re-touch of the pair overwrites that tracking with its own (about to be
     * invalidated) wrapper, and restoring only `raw` leaves nothing correctly tracked for the
     * pre-candidate contribution (#372/#373 review, suppressed finding).
     *
     * @example
     * const snapshot = routineManager.snapshotRawEntries("same-mod");
     */
    public snapshotRawEntries(moduleID: string): Map<string, {
        fn: Function;
        index: number;
        wrapper: object | undefined;
    }>;
    /**
     * Snapshot exactly one (apiPath, moduleID) raw entry's function and array position, for a single
     * internal candidate's own revert — the single-path analog of
     * {@link RoutineManager#snapshotRawEntries}.
     * @param {string} apiPath - Full api path the candidate is about to (re-)contribute to.
     * @param {string} moduleID - Module identifier making the contribution.
     * @returns {{fn: Function, index: number, wrapper: object|undefined}|undefined} The prior
     *   function, its position in `raw`, and its tracked wrapper (if any) — or `undefined` if none.
     * @public
     *
     * @description
     * `processFiles()`'s internal collision branches each construct a `UnifiedWrapper` (firing
     * `impl:created`, unconditionally capturing into `raw`) BEFORE calling `assignToApiPath()` to
     * learn whether that specific candidate is actually accepted. Call this immediately before
     * constructing the wrapper for one such branch, then {@link RoutineManager#revertRawEntry} after
     * a `false` assignment result, so a skip/warn-rejected internal candidate's raw capture is
     * corrected without needing a whole-module snapshot (#372/#373 review). Capturing `index`
     * alongside `fn` lets a restore re-insert at the original registration position instead of
     * appending, preserving `stackRoutines: true`'s registration-order execution semantics (#372/#373
     * review, suppressed finding).
     *
     * @example
     * const priorEntry = routineManager.snapshotRawEntry("thing.initialize", moduleID);
     * const wrapper = new UnifiedWrapper(...);
     * const assigned = assignToApiPath(targetApi, "thing", wrapper.createProxy(), {...});
     * if (!assigned) routineManager.revertRawEntry("thing.initialize", moduleID, priorEntry);
     */
    public snapshotRawEntry(apiPath: string, moduleID: string): {
        fn: Function;
        index: number;
        wrapper: object | undefined;
    } | undefined;
    /**
     * Restore or drop exactly one (apiPath, moduleID) raw entry after an internal candidate at that
     * path was rejected — the single-path analog of
     * {@link RoutineManager#revertSpeculativeState}/{@link RoutineManager#revertSpeculativeSubtree}.
     * @param {string} apiPath - Full api path the rejected candidate targeted.
     * @param {string} moduleID - Module identifier the rejected candidate belongs to.
     * @param {{fn: Function, index: number}|undefined} priorEntry - This pair's snapshot from BEFORE
     *   the candidate's own wrapper construction ran, from {@link RoutineManager#snapshotRawEntry} —
     *   `undefined` when there was no genuine prior contribution (the candidate's capture must be
     *   dropped outright).
     * @returns {void}
     * @public
     *
     * @example
     * routineManager.revertRawEntry("thing.initialize", moduleID, priorEntry);
     */
    public revertRawEntry(apiPath: string, moduleID: string, priorEntry: {
        fn: Function;
        index: number;
    } | undefined): void;
    /**
     * Revert a speculative API subtree's raw routine contributions
     * @param {object} api - API object or subtree (the same candidate value addApiComponent built).
     * @param {string} moduleID - Module identifier whose speculative contributions to revert.
     * @param {string} path - Current API path.
     * @param {Map<string, Function>} priorEntries - Snapshot from
     *   {@link RoutineManager#snapshotRawEntries}, taken before the candidate build ran, of what
     *   moduleID already genuinely contributed.
     * @param {WeakSet} [visited] - Visited objects (prevents circular refs).
     * @returns {void}
     * @public
     *
     * @description
     * Mirrors OwnershipManager#revertSpeculativeSubtree()'s reasoning for the same underlying cause:
     * `onImplCreated` fires from the SAME `impl:created`/`impl:changed` events during a candidate
     * build's construction, before addApiComponent's own collision decision runs — capturing every
     * constructed wrapper's function into `this.raw` regardless of whether the build is later
     * accepted. Under `stackRoutines: true` (which bypasses ownership filtering entirely), a
     * skip/warn-rejected candidate's raw entry would otherwise still be invoked by root-anchored
     * routines and the exact-path stacked callable, even though its module was never actually
     * mounted. At each level: if `priorEntries` has this exact apiPath, moduleID already
     * contributed to it before this build — restore that function (a later re-registration for the
     * same pair replaces in place, so a rejected candidate's fn would otherwise silently overwrite a
     * genuine, pre-existing contribution). Otherwise the entry is purely speculative — drop it.
     *
     * @example
     * const priorEntries = routineManager.snapshotRawEntries("same-mod");
     * // ...buildAPI runs, candidate is rejected...
     * routineManager.revertSpeculativeSubtree(apiToMerge, "same-mod", "thing", priorEntries);
     */
    public revertSpeculativeSubtree(api: object, moduleID: string, path: string, priorEntries: Map<string, Function>, visited?: WeakSet<any>): void;
    /**
     * Revert every speculative raw contribution currently on record for a module, driven by the
     * module's own current `raw` entries rather than a candidate api-tree reference
     * @param {string} moduleID - Module identifier whose speculative raw entries to revert.
     * @param {Map<string, Function>} priorEntries - Snapshot from
     *   {@link RoutineManager#snapshotRawEntries}, taken before the candidate build ran.
     * @returns {void}
     * @public
     *
     * @description
     * Mirrors `OwnershipManager#revertSpeculativeState()`'s reasoning: `revertSpeculativeSubtree`
     * needs a concrete api-tree value to walk, which may not exist when `buildAPI()` or
     * `setValueAtPath()` throws partway through a candidate build. Reads `this.raw` directly for
     * whatever paths this moduleID currently has an entry at, restoring the ones already present in
     * `priorEntries` and dropping the rest (#372 review).
     *
     * Also invalidates ({@link module:@cldmv/slothlet/handlers/unified-wrapper~UnifiedWrapper#___invalidate})
     * whatever wrapper this now-aborted build attempt itself constructed at each reverted path —
     * `revertSpeculativeSubtree()`'s two callers already pair it with
     * `ApiManager#invalidateSpeculativeWrappers()` on a concrete tree; this is the state-only
     * variant's equivalent, since there is no tree here to walk. Restoring/dropping the raw `fn`
     * alone is not enough when `materializeOnCreate` (`config.backgroundMaterialize`) is set: that
     * wrapper can already be materializing in the background and would otherwise re-apply its
     * result and re-fire `impl:changed` after this rollback (#372/#373 review, suppressed finding).
     * A path this build attempt never touched (`raw`'s current `fn` still equals what `priorEntries`
     * already had) keeps whatever wrapper it already had — only a CHANGED (apiPath, moduleID) pair
     * had its wrapper constructed during this now-abandoned attempt.
     *
     * @example
     * const priorEntries = routineManager.snapshotRawEntries("same-mod");
     * try {
     *   // ...buildAPI/setValueAtPath run and throw...
     * } catch (err) {
     *   routineManager.revertSpeculativeState("same-mod", priorEntries);
     *   throw err;
     * }
     */
    public revertSpeculativeState(moduleID: string, priorEntries: Map<string, Function>): void;
    /**
     * Run one exact api path's stacked contributors directly (the callable installed at that path
     * by {@link rebuildStacks} delegates here). Every contributor runs regardless of an earlier
     * one's failure; if any failed, one aggregate `ROUTINE_FAILED` error is thrown once all of them
     * have run (see {@link #throwAggregate}).
     * @param {string} apiPath - Exact composed api path.
     * @param {Array} [args] - Arguments forwarded to every contributor.
     * @param {object} [routine] - The specific routine config this callable was built for
     *   ({@link #buildStackedCallable}'s own caller, {@link rebuildStacks}, always supplies it).
     *   When present, entries are also filtered by {@link #matches} so a mount-relative name
     *   pattern belonging to a DIFFERENT routine that happens to resolve to the same exact apiPath
     *   (e.g. a root module's bare `"initialize"` and an `api.add()`-mounted module's own
     *   `"initialize"`, both composing to the same final path) doesn't invoke that other routine's
     *   raw functions too (#366 review).
     * @returns {Promise<*>} The sole contributor's return value, an ordered array of every
     *   contributor's return value when there are two or more, or `[]` when there are none (e.g. a
     *   stacked callable left in place after its last contributor was removed without an
     *   intervening rebuild) — matching {@link runCascade}'s identical "no contributors" contract.
     * @throws {SlothletError} `ROUTINE_FAILED` — see {@link #throwAggregate}.
     * @public
     */
    public runPath(apiPath: string, args?: any[], routine?: object): Promise<any>;
    /**
     * Run the root cascade for a routine: every matching contribution anywhere, grouped by exact
     * api path — with `stackRoutines: true`, contributors colliding at the same path all run
     * together, adjacently; with the default `stackRoutines: false`, only the current owner at
     * that path runs, exactly like a direct call — the groups themselves ordered per the routine's
     * configured `order` (see {@link #orderPaths}). No-op — and returns `undefined` — when the
     * routine isn't configured.
     *
     * @description
     * Force-materializes whatever the routine's pattern requires (see {@link #materializeFor})
     * before reading `this.raw`, so a not-yet-touched lazy contribution is captured rather than
     * missed. Best-effort across the whole cascade: every matching path's group runs regardless of
     * an earlier group's failure; if any contributor anywhere failed, one aggregate `ROUTINE_FAILED`
     * error is thrown once everything has run (see {@link #throwAggregate}).
     * @param {string} name - Routine name.
     * @param {boolean} [skipMaterialize=false] - Skip the {@link #materializeFor} call — internal
     *   use only, for a caller (`#runModeRoutines`) that already force-materialized this exact
     *   routine immediately beforehand and would otherwise re-walk the same tree for no new
     *   information. Always leave this `false` for any externally-triggered cascade (the installed
     *   `api[name]()` / `api.slothlet[name]()` callables never pass it), since those calls have no
     *   such prior guarantee.
     * @returns {Promise<*>} The sole involved path's result, an ordered array of every involved
     *   path's result when there are two or more, `[]` when the routine has no contributors
     *   anywhere, or `undefined` when the routine isn't configured at all OR the instance has
     *   already been destroyed.
     * @throws {SlothletError} `ROUTINE_FAILED` — see {@link #throwAggregate}.
     * @public
     */
    public runCascade(name: string, skipMaterialize?: boolean): Promise<any>;
    /**
     * Run every configured `mode: "shutdown"` routine's cascade. Called from the framework's
     * existing dispose builtin (`createShutdownFunction()` in api_builder.mjs) — the
     * `"shutdown"`-mode integration point the spec calls "the existing dispose path". Covers the
     * default `shutdown` routine and any custom-named `mode: "shutdown"` routine alike.
     *
     * @description
     * TEMPORARY v3-compat gate (#341): a no-op unless `config.autoRoutines` is `true` (its
     * deprecated alias is `collectLifecycleHooks`, which also expands into an implicit
     * `mode: "shutdown"` routine — see `Config.normalizeRoutines`). Every routine is always
     * stacked/wrapped regardless of this flag — `self.<path>()` is always directly callable — only
     * the AUTOMATIC firing at dispose is gated, so that a project upgrading to a slothlet version
     * carrying #341 sees no behavior change by default. Planned for v4: default `autoRoutines` to
     * `true` and remove `collectLifecycleHooks` — do not lose track of this before that release.
     * @returns {Promise<void>}
     * @public
     */
    public runShutdownModeRoutines(): Promise<void>;
    /**
     * Run every configured `mode: "destroy"` routine's cascade. Called from the framework's
     * existing dispose builtin (`createDestroyFunction()` in api_builder.mjs) — the "existing
     * dispose path" for `destroy`, replacing what used to be a separate `_collectLifecycleHooks
     * ("destroy")` walk. `destroy()` also calls the root `shutdown()` afterward, so
     * `mode: "shutdown"` routines still run as part of `destroy()` too — this only covers routines
     * a consumer wants to fire on `destroy()` specifically, not on a plain `shutdown()`.
     *
     * @description
     * Same TEMPORARY v3-compat `autoRoutines` gate as {@link runShutdownModeRoutines} — see that
     * method's description for the full rationale and the v4 migration plan.
     * @returns {Promise<void>}
     * @public
     */
    public runDestroyModeRoutines(): Promise<void>;
    /**
     * Run every configured `mode: "startup"` routine's cascade. Called once, as the final awaited
     * step of `load()` — `await slothlet(...)` resolves only after this completes.
     *
     * @description
     * Same TEMPORARY v3-compat `autoRoutines` gate as {@link runShutdownModeRoutines} — see that
     * method's description for the full rationale and the v4 migration plan. Wrapping still always
     * happens; only automatic firing is gated.
     * @returns {Promise<void>}
     * @public
     */
    public runStartupModeRoutines(): Promise<void>;
    /**
     * Overwrite every currently-known matching api path's slot on the live api tree with its
     * stacked callable, and (re)attach every configured routine's root cascade at the api root and
     * under `api.slothlet` (using the routine's `name` verbatim as the property key — a dotted or
     * `^`-prefixed name is reachable via bracket notation, e.g. `api.slothlet["admin.initialize"]`,
     * `api["^ext.*.initialize"]`; only a bare name gets clean dot-notation access).
     *
     * @description
     * Safe to call repeatedly — at the end of initial `load()`, and again after every
     * `api.slothlet.api.add()` — it re-derives every path from current state. A path whose
     * container no longer resolves (its owning module was removed without ever un-registering) is
     * silently skipped rather than throwing: teardown ordering across removal + rebuild is
     * best-effort, not a correctness guarantee this feature makes.
     *
     * Guards writes with `recording = false`: the property write below re-enters `onImplCreated`
     * via the same `impl:created` event ordinary module writes go through, and without the guard
     * the stacked callable being installed would be captured as a phantom contributor on the very
     * next rebuild.
     * @param {object} api - The fully composed, bound api object.
     * @returns {Promise<void>}
     * @public
     */
    public rebuildStacks(api: object): Promise<void>;
    #private;
}
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=routine-manager.d.mts.map