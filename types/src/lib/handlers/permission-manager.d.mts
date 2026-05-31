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
    }, ownerModuleID?: string | null, ruleId?: string | null): string;
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
     * @returns {boolean} True if access is allowed.
     * @example
     * if (!pm.enforceAccess("payments.charge", "db.write", "/src/pay.mjs", "/src/db.mjs")) {
     *   throw new SlothletError("PERMISSION_DENIED", { caller, target });
     * }
     */
    enforceAccess(callerPath: string, targetPath: string, callerFilePath?: string | null, targetFilePath?: string | null, runtimeContext?: object | null): boolean;
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
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=permission-manager.d.mts.map