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
     * api path (contributors colliding at the same path run together, adjacently), the groups
     * themselves ordered per the routine's configured `order` (see {@link #orderPaths}). No-op —
     * and returns `undefined` — when the routine isn't configured.
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