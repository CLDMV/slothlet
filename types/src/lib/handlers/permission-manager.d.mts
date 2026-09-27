/**
 * Manages access control rules for API path invocations.
 * Rules are glob-pattern-based (same syntax as hooks: *, **, ?, {a,b}, !negation).
 * Self-calls (same moduleID) always bypass the permission system.
 *
 * @class PermissionManager
 * @extends ComponentBase
 */
export class PermissionManager extends ComponentBase {
    /**
     * Property name for auto-discovery by _initializeComponents.
     * @type {string}
     * @static
     */
    static slothletProperty: string;
    /**
     * Creates a new PermissionManager instance.
     *
     * @param {object} slothlet - Parent slothlet instance.
     * @example
     * const pm = new PermissionManager(slothlet);
     */
    constructor(slothlet: object);
    /**
     * Add a permission rule.
     *
     * @param {object} rule - The rule definition.
     * @param {string} rule.caller - Glob pattern matching caller API paths.
     * @param {string} rule.target - Glob pattern matching target API paths.
     * @param {string} rule.effect - "allow" or "deny".
     * @param {string|null} [ownerModuleID=null] - Module ID that owns this rule.
     * @param {string|null} [ruleId=null] - Optional rule ID to reuse (for replay).
     * @returns {string} The rule ID (generated or reused).
     * @throws {SlothletError} INVALID_PERMISSION_RULE if rule is malformed.
     * @example
     * pm.addRule({ caller: "payments.**", target: "db.write", effect: "allow" }, "mod_abc123");
     */
    addRule(rule: {
        caller: string;
        target: string;
        effect: string;
    }, ownerModuleID?: string | null, ruleId?: string | null, layer?: null): string;
    /**
     * Remove a permission rule by ID.
     * A module cannot remove rules it owns (immutability).
     *
     * @param {string} ruleId - The rule ID to remove.
     * @param {string|null} [callerModuleID=null] - Module ID of the caller attempting removal.
     * @returns {boolean} True if the rule was removed.
     * @throws {SlothletError} PERMISSION_SELF_MODIFY if caller owns the rule.
     * @example
     * pm.removeRule("perm-3", "mod_other");
     */
    removeRule(ruleId: string, callerModuleID?: string | null): boolean;
    /**
     * Add an event rule (#407). Separate three-level construct from {@link addRule}: `effect` is
     * "deny" | "notify" | "allow". Matched most-specific-wins with the same layered tiebreak; the
     * EventManager uses it to resolve each subscriber's delivery level.
     *
     * @param {object} rule - The event-rule definition.
     * @param {string} rule.caller - Glob matching the SUBSCRIBER's api path.
     * @param {string} rule.event - Glob matching the event name.
     * @param {"deny"|"notify"|"allow"} rule.effect - Delivery level.
     * @param {object|Function|Array<object|Function>} [rule.condition] - Optional condition(s).
     * @param {string|null} [ownerModuleID=null] - Owning module id ("__builtin__" for framework).
     * @param {string|null} [ruleId=null] - Optional rule id to reuse (for reload replay).
     * @param {string|null} [layer=null] - Explicit precedence layer; derived from ownerModuleID when null.
     * @returns {string} The rule id.
     * @throws {SlothletError} INVALID_PERMISSION_RULE if the rule is malformed.
     * @example
     * pm.addEventRule({ caller: "orders.**", event: "orders.*", effect: "allow" }, "mod_orders", null, "manifest");
     */
    addEventRule(rule: {
        caller: string;
        event: string;
        effect: "deny" | "notify" | "allow";
        condition?: object | Function | (object | Function)[] | undefined;
    }, ownerModuleID?: string | null, ruleId?: string | null, layer?: string | null): string;
    /**
     * Remove an event rule by id. A module cannot remove an event rule it owns (immutability),
     * mirroring {@link removeRule}.
     *
     * @param {string} ruleId - The event-rule id.
     * @param {string|null} [callerModuleID=null] - Module id attempting removal.
     * @returns {boolean} True if a rule was removed.
     * @throws {SlothletError} PERMISSION_SELF_MODIFY if the caller owns the rule.
     */
    removeEventRule(ruleId: string, callerModuleID?: string | null): boolean;
    /**
     * Resolve the delivery level for a subscriber/event pair (#407): "deny" | "notify" | "allow".
     * Most-specific-wins with the layered tiebreak (see {@link RULE_LAYER_RANK}); falls back to the
     * base default (`permissions.events.default`, built-in "notify") when no rule matches. A host
     * subscription (no module caller) is trusted like a host-initiated call and always resolves "allow".
     *
     * @param {string|null} subscriberPath - The subscribing module's api path, or null for the host.
     * @param {string} eventName - The event name being subscribed to / emitted.
     * @param {object|null} [runtimeContext=null] - Per-request ALS context for condition evaluation.
     * @returns {"deny"|"notify"|"allow"} The resolved delivery level.
     */
    resolveEventLevel(subscriberPath: string | null, eventName: string, runtimeContext?: object | null): "deny" | "notify" | "allow";
    /**
     * Monotonic epoch that changes on every event-rule mutation. The EventManager caches resolved
     * levels against it and re-resolves only when it changes.
     * @returns {number} The current event-rules epoch.
     */
    get eventRulesEpoch(): number;
    /**
     * Whether any event rule carries a condition. When false, a resolved subscriber level depends
     * only on the rule set and can be safely cached against {@link eventRulesEpoch}; when true, the
     * level can vary with the per-request context and must be re-resolved on each emit.
     * @returns {boolean} True if at least one event rule has a condition.
     */
    get hasConditionalEventRules(): boolean;
    /**
     * Register (or replace) a named principal — a resolver that turns a caller identity into
     * authorization facts for rules that declare `requires: [name]` (#459).
     *
     * The first registrant owns the name. Only that owner (same module) or the host may register it
     * again; a re-registration swaps the resolver and bumps the principal's epoch, so every cached
     * value is discarded and re-resolved on next use. Another module claiming an owned name throws.
     *
     * @param {string} name - Principal name, as rules list it in `requires`.
     * @param {object} definition - The resolver definition.
     * @param {function(object): *} definition.key - Maps the runtime context to this principal's identity
     *   key (e.g. `(ctx) => ctx.user?.id`). Synchronous. A `null`/`undefined` key means "no identity":
     *   rules requiring this principal do not match for that call.
     * @param {function(*): *} definition.resolve - Resolves the facts for an identity key. May be async.
     * @param {number} [definition.maxAge] - Optional time-to-live in milliseconds for a resolved value.
     * @param {string|null} [ownerModuleID=null] - Registering module's id; `null` for the host.
     * @param {function(Function, Array<*>): *} [invoke=null] - Runs the resolver as its registering
     *   module, so anything the resolver calls is attributed to that module rather than to whichever
     *   caller's call triggered the resolve. `null` (host registrations) calls `resolve` directly.
     * @returns {void}
     * @throws {SlothletError} PERMISSION_SEALED when the control surface is sealed.
     * @throws {SlothletError} INVALID_ARGUMENT when the name or definition is malformed.
     * @throws {SlothletError} PRINCIPAL_NAME_OWNED when another module owns the name.
     * @example
     * pm.registerPrincipal("roles", { key: (ctx) => ctx.user?.id, resolve: (id) => loadRoles(id), maxAge: 30_000 }, "roles_mod");
     */
    registerPrincipal(name: string, definition: {
        key: (arg0: object) => any;
        resolve: (arg0: any) => any;
        maxAge?: number | undefined;
    }, ownerModuleID?: string | null, invoke?: (arg0: Function, arg1: Array<any>) => any): void;
    /**
     * Unregister a principal. Only its owner or the host may do so. Rules that require it stop
     * matching (their calls fall to `defaultPolicy`).
     *
     * @param {string} name - Principal name.
     * @param {string|null} [callerModuleID=null] - Calling module's id; `null` for the host.
     * @returns {boolean} True when a principal was removed.
     * @throws {SlothletError} PERMISSION_SEALED when the control surface is sealed.
     * @throws {SlothletError} PRINCIPAL_NOT_OWNER when a module other than the owner calls it.
     * @example
     * pm.unregisterPrincipal("roles");
     */
    unregisterPrincipal(name: string, callerModuleID?: string | null): boolean;
    /**
     * Invalidate a principal's cached facts — for one identity, or for every identity when
     * `identityKey` is omitted. The next call needing it re-resolves. Only the owner or the host may
     * invalidate. Deliberately allowed after `seal()`: revoking access must keep working once the
     * policy surface is frozen.
     *
     * A resolve already in flight for an invalidated identity is discarded when it settles, so a
     * revocation that lands mid-resolve is never overwritten by the pre-revocation answer.
     *
     * @param {string} name - Principal name.
     * @param {*} [identityKey] - Identity to invalidate; omit (`undefined`) to invalidate all identities.
     * @param {string|null} [callerModuleID=null] - Calling module's id; `null` for the host.
     * @returns {boolean} True when the principal exists.
     * @throws {SlothletError} PRINCIPAL_NOT_OWNER when a module other than the owner calls it.
     * @example
     * pm.invalidatePrincipal("roles", "user-42");
     */
    invalidatePrincipal(name: string, identityKey?: any, callerModuleID?: string | null): boolean;
    /**
     * Whether a principal with this name is registered.
     *
     * @param {string} name - Principal name.
     * @returns {boolean} True when registered.
     * @example
     * pm.hasPrincipal("roles");
     */
    hasPrincipal(name: string): boolean;
    /**
     * Drop every principal owned by a removed module (#459). Called when a whole module is removed
     * (`api.slothlet.api.remove(moduleID)`), so a resolver never outlives the code that defined it.
     *
     * @param {string} moduleID - The removed module's id.
     * @returns {void}
     * @example
     * pm.onModuleRemoved("roles_mod");
     */
    onModuleRemoved(moduleID: string): void;
    /**
     * Put every principal owned by a reloaded module to sleep (#459). The registered resolver is a
     * closure over the PRE-reload module — its state (a grants table, a connection) is not the state
     * the reloaded module now holds — so it must not keep answering. The principal goes dormant: the
     * module keeps the name, cached values are discarded, and rules requiring it do not match until
     * the module registers it again (typically from its `initialize` routine).
     *
     * @param {string} moduleID - The reloaded module's id.
     * @returns {void}
     * @example
     * pm.onModuleReloaded("roles_mod");
     */
    onModuleReloaded(moduleID: string): void;
    /**
     * Reserve a principal name for a module without a resolver (#459). Used when a full reload replays
     * a module's registration: the reloaded module's code replaced the resolver the history recorded,
     * so the name is held for its owner — nobody else can claim it — but stays dormant until the owner
     * registers again. An existing registration under the name is left untouched.
     *
     * @param {string} name - Principal name.
     * @param {string} ownerModuleID - Owning module's id.
     * @returns {void}
     * @example
     * pm.reservePrincipal("roles", "roles_mod");
     */
    reservePrincipal(name: string, ownerModuleID: string): void;
    /**
     * List the principals a caller→target call needs resolved before its rules can be evaluated —
     * every `(principal, identity)` pair required by a matching `requires` rule whose value is missing,
     * expired, or from an older epoch (#459). Empty on the fast path (nothing stale, no `requires`
     * rules, or enforcement would short-circuit before rules), so a call with an empty result is
     * enforced synchronously exactly as before.
     *
     * @param {string} callerPath - Caller API path.
     * @param {string} targetPath - Target API path.
     * @param {string|null} [callerFilePath=null] - Caller source file path.
     * @param {string|null} [targetFilePath=null] - Target source file path.
     * @param {object|null} [runtimeContext=null] - Per-request context the principals key from.
     * @returns {Array<{ name: string, identityKey: * }>} Stale pairs to resolve; empty when none.
     * @example
     * const stale = pm.stalePrincipals("callers.a", "project.files.list", "/a.mjs", "/files.mjs", ctx);
     */
    stalePrincipals(callerPath: string, targetPath: string, callerFilePath?: string | null, targetFilePath?: string | null, runtimeContext?: object | null): Array<{
        name: string;
        identityKey: any;
    }>;
    /**
     * Resolve the given `(principal, identity)` pairs and cache the results (#459). Concurrent requests
     * for one pair share a single resolve. Never rejects: a resolver that throws leaves its pair
     * unresolved, so the rules that need it fail closed, and the failure is reported as a diagnostic.
     *
     * @param {Array<{ name: string, identityKey: * }>} pairs - Pairs from {@link stalePrincipals}.
     * @returns {Promise<void>} Settles once every pair has resolved or failed.
     * @example
     * await pm.resolvePrincipals(pm.stalePrincipals(caller, target, cf, tf, ctx));
     */
    resolvePrincipals(pairs: Array<{
        name: string;
        identityKey: any;
    }>): Promise<void>;
    /**
     * Silent query: check whether a caller path is allowed to access a target path.
     * Never emits lifecycle or debug events — use {@link enforceAccess} at actual enforcement points.
     * May read/write the resolved-decision cache unless `options.useCache` is explicitly `false`.
     *
     * @param {string} callerPath - The calling module's API path.
     * @param {string} targetPath - The target API path being accessed.
     * @param {string|null} [callerFilePath=null] - Caller's source file path (for self-call bypass).
     * @param {string|null} [targetFilePath=null] - Target's source file path (for self-call bypass).
     * @param {object|null} [runtimeContext=null] - Per-request ALS context for condition evaluation.
     * @param {{ useCache?: boolean }|null} [options=null] - Query options.
     * @param {boolean} [options.useCache=true] - Read/write resolved decision cache.
     * @returns {boolean} True if access is allowed.
     * @example
     * const allowed = pm.checkAccess("payments.charge", "db.write", "/src/pay.mjs", "/src/db.mjs");
     */
    checkAccess(callerPath: string, targetPath: string, callerFilePath?: string | null, targetFilePath?: string | null, runtimeContext?: object | null, options?: {
        useCache?: boolean;
    } | null): boolean;
    /**
     * Check whether a condition payload matches the provided runtime context.
     * Mirrors permission rule condition semantics used during enforcement.
     *
     * @param {Record<string, unknown>|Function|Array<Record<string, unknown>|Function>|null|undefined} condition - Rule condition payload.
     * @param {object|null} [runtimeContext=null] - Per-request ALS context for condition evaluation.
     * @returns {boolean} True when condition semantics match the runtime context.
     * @example
     * const ok = pm.matchesCondition({ role: "admin" }, { role: "admin" });
     */
    matchesCondition(condition: Record<string, unknown> | Function | Array<Record<string, unknown> | Function> | null | undefined, runtimeContext?: object | null): boolean;
    /**
     * Enforce access: check whether a caller is allowed to access a target and emit audit events.
     * Called at actual module invocation points (applyTrap, enforceInternalPermission).
     * Use {@link checkAccess} for silent queries that should not generate audit events.
     *
     * @param {string} callerPath - The calling module's API path.
     * @param {string} targetPath - The target API path being accessed.
     * @param {string|null} [callerFilePath=null] - Caller's source file path (for self-call bypass).
     * @param {string|null} [targetFilePath=null] - Target's source file path (for self-call bypass).
     * @param {object|null} [runtimeContext=null] - Per-request ALS context for condition evaluation.
     * @param {PermissionCallMeta|null} [callMeta=null] - Call/construct metadata (#455): `{ args, target }`
     *   from the invocation, forwarded to function conditions as their second argument. Null for reads,
     *   hooks, the internal control surface, and silent queries.
     * @param {{ principalGrace?: boolean }|null} [options=null] - Enforcement options.
     * @param {boolean} [options.principalGrace=false] - Accept a principal whose epoch is current even if its
     *   `maxAge` has elapsed (#459). Set only by a promoted call re-enforcing right after its resolve.
     * @returns {boolean} True if access is allowed.
     * @example
     * if (!pm.enforceAccess("payments.charge", "db.write", "/src/pay.mjs", "/src/db.mjs")) {
     *   throw new SlothletError("PERMISSION_DENIED", { caller, target });
     * }
     */
    enforceAccess(callerPath: string, targetPath: string, callerFilePath?: string | null, targetFilePath?: string | null, runtimeContext?: object | null, callMeta?: PermissionCallMeta | null, options?: {
        principalGrace?: boolean;
    } | null): boolean;
    /**
     * Enforce whether a caller may register or fire a hook of `hookType` on `hookPath`.
     *
     * Layered resolution: hook-target rules (`pattern:type`) decide when any match; otherwise the
     * decision falls back to the CALL decision for `hookPath` — a path the caller may not call may
     * not be hooked either. A specific-type rule (`:before`) outranks an any-type rule (`:hook`).
     * Host-registered hooks (no owner identity) are always allowed (the trusted host). Emits audit
     * events; use {@link checkHookAccess} for a silent query (fire-time filtering).
     *
     * @param {string|null} callerPath - Hook owner's API path (the registering module); null for a
     *   host-registered hook (no owner identity), which is always allowed.
     * @param {string} hookPath - Concrete API path (fire-time) or registration pattern (registration).
     * @param {string} hookType - Hook type: "before", "after", "always", or "error".
     * @param {string|null} [callerFilePath=null] - Owner's source file path (for self-hook bypass).
     * @param {string|null} [targetFilePath=null] - Hooked path's source file path (for self-hook bypass).
     * @param {object|null} [runtimeContext=null] - Per-request ALS context for condition evaluation.
     * @returns {boolean} True if hooking is allowed.
     * @example
     * if (!pm.enforceHookAccess("audit.log", "db.write", "error", "/src/audit.mjs", "/src/db.mjs")) {
     *   throw new SlothletError("PERMISSION_DENIED", { caller, target });
     * }
     */
    enforceHookAccess(callerPath: string | null, hookPath: string, hookType: string, callerFilePath?: string | null, targetFilePath?: string | null, runtimeContext?: object | null): boolean;
    /**
     * Silent variant of {@link enforceHookAccess} — never emits audit/lifecycle events. Used for
     * fire-time hook filtering, where emitting on every intercepted call would flood the audit stream.
     *
     * @param {string|null} callerPath - Hook owner's API path; null for a host-registered hook (always allowed).
     * @param {string} hookPath - Concrete API path being hooked.
     * @param {string} hookType - Hook type: "before", "after", "always", or "error".
     * @param {string|null} [callerFilePath=null] - Owner's source file path (for self-hook bypass).
     * @param {string|null} [targetFilePath=null] - Hooked path's source file path (for self-hook bypass).
     *   Typically null at fire time, where the target's source file isn't resolved — the filepath
     *   self-bypass is registration-only, so a self-hook is admitted at on()-time, not re-checked here.
     * @param {object|null} [runtimeContext=null] - Per-request ALS context for condition evaluation.
     * @returns {boolean} True if hooking is allowed.
     * @example
     * const visible = pm.checkHookAccess(hook.ownerPath, "db.write", "after");
     */
    checkHookAccess(callerPath: string | null, hookPath: string, hookType: string, callerFilePath?: string | null, targetFilePath?: string | null, runtimeContext?: object | null): boolean;
    /**
     * Get all rules that match a given target path.
     *
     * @param {string} targetPath - Target API path to check.
     * @returns {Array<object>} Array of matching rule objects (serialized).
     * @example
     * const rules = pm.getRulesForPath("db.write");
     */
    getRulesForPath(targetPath: string): Array<object>;
    /**
     * Get all rules owned by a given module.
     *
     * @param {string} moduleID - Module ID to look up.
     * @returns {Array<object>} Array of rule objects (serialized).
     * @example
     * const rules = pm.getRulesByModule("mod_abc123");
     */
    getRulesByModule(moduleID: string): Array<object>;
    /**
     * Get all rules where the caller pattern matches a given caller path.
     * Used by `self.rules()` to show what rules affect the calling module.
     *
     * @param {string} callerPath - Caller API path.
     * @returns {Array<object>} Array of matching rule objects (serialized).
     * @example
     * const rules = pm.getRulesForCaller("payments.charge");
     */
    getRulesForCaller(callerPath: string): Array<object>;
    /**
     * Enable the permission system globally.
     *
     * @returns {void}
     * @example
     * pm.enable();
     */
    enable(): void;
    /**
     * Seal the control surface (one-way, no unseal). After sealing, `enable`, `disable`, `addRule`,
     * `removeRule`, `setReadGating`, `registerPrincipal`, and `unregisterPrincipal` throw
     * `PERMISSION_SEALED`. Enforcement continues to evaluate normally, and `shutdown()` and
     * `invalidatePrincipal()` still work. Idempotent — calling twice is a no-op.
     * @returns {void}
     * @example
     * pm.seal();
     */
    seal(): void;
    /**
     * Whether the control surface has been sealed.
     * @returns {boolean} True if sealed.
     * @example
     * if (pm.isSealed()) { ... }
     */
    isSealed(): boolean;
    /**
     * Disable the permission system globally (all calls allowed).
     *
     * @returns {void}
     * @example
     * pm.disable();
     */
    disable(): void;
    /**
     * Whether the permission system is currently enabled.
     *
     * @returns {boolean} True if enabled.
     * @example
     * if (pm.isEnabled()) { ... }
     */
    isEnabled(): boolean;
    /**
     * Whether terminal data-value property reads are permission-gated.
     * Separate from {@link isEnabled} so call enforcement is unaffected by this default-on
     * flag (opt out via `permissions.readGating: false`).
     *
     * @returns {boolean} True if read gating is enabled.
     * @example
     * if (pm.isReadGatingEnabled()) { ... }
     */
    isReadGatingEnabled(): boolean;
    /**
     * Whether a function read out of the api keeps the identity of the module that read it.
     *
     * Consulted on the read path, so it is a method rather than a config lookup: reading it off the
     * manager is one call instead of walking the instance's config object on every property read.
     *
     * @returns {boolean} True when captured references stay attributed to their capturer.
     * @example
     * if (pm.isCaptureEnabled()) { ... }
     */
    isCaptureEnabled(): boolean;
    /**
     * Whether an api path targets a module-private (`_`/`__`-prefixed) member (#260).
     *
     * @param {string|null|undefined} targetPath - Dotted api path of the read/call target.
     * @returns {boolean} True when the terminal segment is underscore-prefixed.
     * @public
     *
     * @description
     * The wrapper layer consults this at its trusted-root short-circuits: a host-initiated
     * read/call normally bypasses enforcement entirely, but a private-named target must still
     * route through {@link enforceAccess} so the configured `permissions.private.host` policy
     * applies and the denial is audited like any other.
     */
    public isPrivateTarget(targetPath: string | null | undefined): boolean;
    /**
     * Enable or disable read-level permission gating at runtime.
     * Unlike {@link enable}/{@link disable}, this does not clear the resolved cache —
     * the flag only controls whether property reads consult the rule set; it never
     * changes the allow/deny outcome of an evaluated caller→target pair.
     *
     * @param {boolean} value - True to gate terminal data-value reads, false to stop.
     * @returns {void}
     * @throws {SlothletError} INVALID_ARGUMENT if `value` is not a boolean.
     * @example
     * pm.setReadGating(true);
     */
    setReadGating(value: boolean): void;
    /**
     * Export all registered rules for replay during full reload.
     *
     * @returns {Array<object>} Snapshot of all current rules.
     * @example
     * const snapshot = pm.exportRules();
     */
    exportRules(): Array<object>;
    /**
     * Re-register rules exported by {@link exportRules}.
     * Called after a full reload to restore programmatic rules.
     *
     * @param {Array<object>} registrations - Snapshot returned by exportRules().
     * @returns {void}
     * @example
     * pm.importRules(snapshot);
     */
    importRules(registrations: Array<object>): void;
    /**
     * Cleanup permission manager on shutdown.
     * Clears all internal state.
     *
     * @returns {Promise<void>}
     * @example
     * await pm.shutdown();
     */
    shutdown(): Promise<void>;
    /**
     * Emit a debug message. Delegates to slothlet.debug().
     *
     * @param {string} category - Debug category.
     * @param {object} data - Debug data.
     * @returns {void}
     * @private
     */
    private debug;
    #private;
}
/**
 * Call/construct metadata threaded into a function condition's second argument so a rule can
 * authorize on the resource named in the call itself, not just ambient context (#455).
 *
 * Provided only at the call and construct enforcement gates — where the invocation's arguments
 * exist. Read gating, hook gating, event delivery, the internal `slothlet.*` control surface, and
 * silent queries evaluate conditions with `callMeta === null`, so a function condition that reads
 * `callMeta.args` must guard for its absence (or the rule must only match targets that always gate
 * at a call/construct site).
 */
export type PermissionCallMeta = {
    /**
     * - Arguments the target leaf was called/constructed with, or null.
     */
    args: Array<any> | null;
    /**
     * - Concrete (post-glob) target api path of the gated call.
     */
    target: string | null;
};
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=permission-manager.d.mts.map