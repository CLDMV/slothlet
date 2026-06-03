/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/permission-manager.mjs
 *	@Date: 2026-04-14 16:47:31 -07:00 (1776210451)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:12:47 -07:00 (1776211967)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Permission manager for API path access control.
 * Enforces caller→target access rules using glob pattern matching.
 * Integrated into UnifiedWrapper.applyTrap for enforcement.
 *
 * @module @cldmv/slothlet/handlers/permission-manager
 * @internal
 */

import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
import { compilePattern } from "@cldmv/slothlet/helpers/pattern-matcher";
import { translate } from "@cldmv/slothlet/i18n";

/**
 * Auto-incrementing counter for rule IDs.
 * @type {number}
 */
let ruleIdCounter = 0;

/**
 * Hook types that may appear as a permission-target suffix in the `pattern:type` form.
 * `hook` is the "any type" wildcard. Mirrors HookManager's registrable types so a hook and the
 * rule that gates it read identically (e.g. `hook.on("db.*:error")` ↔ `target: "db.*:error"`).
 * @type {Set<string>}
 */
const HOOK_TARGET_TYPES = new Set(["before", "after", "always", "error", "hook"]);

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
	static slothletProperty = "permissionManager";

	/**
	 * Map of ruleId → rule object.
	 * @type {Map<string, object>}
	 * @private
	 */
	#rules = new Map();

	/**
	 * Default policy when no rule matches: "allow" or "deny".
	 * @type {string}
	 * @private
	 */
	#defaultPolicy = "allow";

	/**
	 * Whether the permission system is enabled globally.
	 * Off by default — only enabled when a `permissions` config block is provided.
	 * @type {boolean}
	 * @private
	 */
	#enabled = false;

	/**
	 * Audit level: "default" or "verbose".
	 * @type {string}
	 * @private
	 */
	#audit = "default";

	/**
	 * Whether terminal data-value property reads are permission-gated.
	 * On by default when permissions are configured — opt out via `permissions.readGating: false`.
	 * @type {boolean}
	 * @private
	 */
	#readGating = false;

	/**
	 * Cache of resolved caller::target decision records.
	 * Keyed by "${callerPath}::${targetPath}".
	 * Each value is the decision record returned by {@link #evaluate}:
	 * `{ allowed: boolean, event: string, payload: object }`.
	 * @type {Map<string, {allowed: boolean, event: string, payload: object}>}
	 * @private
	 */
	#resolvedCache = new Map();

	/**
	 * Cache of compiled glob patterns → matcher functions.
	 * @type {Map<string, function>}
	 * @private
	 */
	#compiledCache = new Map();

	/**
	 * Creates a new PermissionManager instance.
	 *
	 * @param {object} slothlet - Parent slothlet instance.
	 * @example
	 * const pm = new PermissionManager(slothlet);
	 */
	constructor(slothlet) {
		super(slothlet);

		const permConfig = slothlet.config?.permissions;
		if (permConfig) {
			// The "allow" fallback in || is uncovered when all tests supply defaultPolicy explicitly.
			/* v8 ignore next */
			this.#defaultPolicy = permConfig.defaultPolicy || "allow";
			this.#enabled = permConfig.enabled !== false;
			this.#audit = permConfig.audit || "default";
			this.#readGating = permConfig.readGating !== false;

			// Register config-level rules (earliest in stacking order)
			if (Array.isArray(permConfig.rules)) {
				for (const rule of permConfig.rules) {
					this.addRule(rule, null);
				}
			}
		}

		// Built-in deny rule: block all modules from calling control.enable/disable by default.
		this.addRule({ caller: "**", target: "slothlet.permissions.control.**", effect: "deny" }, "__builtin__");

		// Built-in allow rules: the caller-identity utilities `slothlet.lockCaller` and
		// `slothlet.bind` grant no security-sensitive access — they only pin a callback's
		// caller identity, which strengthens enforcement. Allowing them by default means a
		// `defaultPolicy: "deny"` configuration does not have to allow them explicitly.
		// A more specific user rule can still deny them for a particular module.
		this.addRule({ caller: "**", target: "slothlet.lockCaller", effect: "allow" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.bind", effect: "allow" }, "__builtin__");

		// Built-in hook-management baseline (enforced only when permissions are enabled): modules may
		// inspect and register hooks (`list`, `on`) but may NOT tamper with other modules' hooks via the
		// global-effect methods (remove/off/clear, enable/disable, enablePattern/disablePattern/reset).
		// The broad deny is overridden by the two specific allows (most-specific-wins). These are call
		// targets (no `:type` suffix), so they gate the hook MANAGEMENT surface, not interception.
		this.addRule({ caller: "**", target: "slothlet.hook.**", effect: "deny" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.hook.list", effect: "allow" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.hook.on", effect: "allow" }, "__builtin__");

		// The runtime pin-enforcement switch `slothlet.hook.pin.*` (enable/disable/enabled) is host-only
		// via the `slothlet.hook.**` deny above — modules cannot weaken pinning. No separate rule needed.
	}

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
	addRule(rule, ownerModuleID = null, ruleId = null) {
		this.#validateRule(rule);

		const id = ruleId || `perm-${++ruleIdCounter}`;
		// Detect the hook-target suffix form (`pattern:type`). When present the rule gates hook
		// registration/execution rather than plain calls; `hookType` is the type or "hook" (any),
		// `hookPathPattern` is the path-glob portion. Both null for ordinary call-target rules.
		const hookTarget = this.#parseHookTarget(rule.target);
		const entry = {
			id,
			caller: rule.caller,
			target: rule.target,
			effect: rule.effect,
			condition: rule.condition ?? null,
			hookType: hookTarget ? hookTarget.hookType : null,
			hookPathPattern: hookTarget ? hookTarget.pathPattern : null,
			ownerModuleID: ownerModuleID,
			registeredAt: Date.now()
		};

		this.#rules.set(id, entry);
		this.#clearCache();

		this.debug("permissions", {
			key: "DEBUG_PERMISSION_RULE_ADDED",
			ruleId: id,
			caller: rule.caller,
			target: rule.target,
			effect: rule.effect,
			ownerModuleID
		});

		return id;
	}

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
	removeRule(ruleId, callerModuleID = null) {
		const entry = this.#rules.get(ruleId);
		if (!entry) return false;

		// Self-modification protection: module cannot remove its own rules
		// ownerModuleID is only set when addRule is called from within an internal module
		// context (not from the public api.slothlet.permissions.addRule surface which always
		// passes null). Reachable only via direct addRule(rule, moduleID) calls.
		/* v8 ignore start */
		if (callerModuleID && entry.ownerModuleID && callerModuleID === entry.ownerModuleID) {
			throw new this.SlothletError("PERMISSION_SELF_MODIFY", {
				ruleId,
				moduleID: callerModuleID
			});
		}
		/* v8 ignore stop */
		this.#rules.delete(ruleId);
		this.#clearCache();

		this.debug("permissions", {
			key: "DEBUG_PERMISSION_RULE_REMOVED",
			ruleId,
			caller: entry.caller,
			target: entry.target,
			effect: entry.effect
		});

		return true;
	}

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
	checkAccess(callerPath, targetPath, callerFilePath = null, targetFilePath = null, runtimeContext = null, options = null) {
		const normalizedOptions = options == null ? {} : options;
		if (typeof normalizedOptions !== "object" || Array.isArray(normalizedOptions)) {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "options",
				expected: "object with optional boolean useCache",
				received: Array.isArray(normalizedOptions) ? "array" : typeof normalizedOptions,
				validationError: true
			});
		}

		const { useCache = true } = normalizedOptions;
		if (typeof useCache !== "boolean") {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "options.useCache",
				expected: "boolean",
				received: typeof useCache,
				validationError: true
			});
		}

		return this.#resolveAccess(callerPath, targetPath, callerFilePath, targetFilePath, runtimeContext, useCache).allowed;
	}

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
	matchesCondition(condition, runtimeContext = null) {
		if (condition == null) return true;
		this.#assertValidConditionPayload(condition, "INVALID_ARGUMENT");
		return this.#matchesConditionUnchecked(condition, runtimeContext);
	}

	/**
	 * Evaluate condition semantics without payload-shape validation.
	 * Callers must ensure `condition` has already been validated.
	 *
	 * @param {object|Function|Array<object|Function>|null|undefined} condition - Rule condition payload.
	 * @param {object|null} [runtimeContext=null] - Per-request ALS context for condition evaluation.
	 * @returns {boolean} True when condition semantics match the runtime context.
	 * @private
	 */
	#matchesConditionUnchecked(condition, runtimeContext = null) {
		if (condition == null) return true;

		const ctx = runtimeContext ?? {};

		if (Array.isArray(condition)) {
			return condition.some((entry) => this.#singleConditionMatches(entry, ctx));
		}

		return this.#singleConditionMatches(condition, ctx);
	}

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
	enforceAccess(callerPath, targetPath, callerFilePath = null, targetFilePath = null, runtimeContext = null) {
		const result = this.#resolveAccess(callerPath, targetPath, callerFilePath, targetFilePath, runtimeContext, true);
		if (result.event) {
			this.#emitAuditEvent(result.event, result.payload);
		}
		return result.allowed;
	}

	/**
	 * Enforce whether a caller may register or fire a hook of `hookType` on `hookPath`.
	 *
	 * Layered resolution: hook-target rules (`pattern:type`) decide when any match; otherwise the
	 * decision falls back to the CALL decision for `hookPath` — a path the caller may not call may
	 * not be hooked either. A specific-type rule (`:before`) outranks an any-type rule (`:hook`).
	 * Host-registered hooks (no owner identity) are always allowed (the trusted host). Emits audit
	 * events; use {@link checkHookAccess} for a silent query (fire-time filtering).
	 *
	 * @param {string} callerPath - Hook owner's API path (the registering module).
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
	enforceHookAccess(callerPath, hookPath, hookType, callerFilePath = null, targetFilePath = null, runtimeContext = null) {
		const result = this.#resolveHookAccess(callerPath, hookPath, hookType, callerFilePath, targetFilePath, runtimeContext);
		// Registration always has a caller (on() skips host hooks), so result.event is normally
		// non-null here. Guard anyway for defensive consistency with enforceAccess: a host caller
		// (no owner identity) yields event:null and must emit nothing.
		if (result.event) {
			this.#emitAuditEvent(result.event, result.payload);
		}
		return result.allowed;
	}

	/**
	 * Silent variant of {@link enforceHookAccess} — never emits audit/lifecycle events. Used for
	 * fire-time hook filtering, where emitting on every intercepted call would flood the audit stream.
	 *
	 * @param {string} callerPath - Hook owner's API path.
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
	checkHookAccess(callerPath, hookPath, hookType, callerFilePath = null, targetFilePath = null, runtimeContext = null) {
		return this.#resolveHookAccess(callerPath, hookPath, hookType, callerFilePath, targetFilePath, runtimeContext).allowed;
	}

	/**
	 * Get all rules that match a given target path.
	 *
	 * @param {string} targetPath - Target API path to check.
	 * @returns {Array<object>} Array of matching rule objects (serialized).
	 * @example
	 * const rules = pm.getRulesForPath("db.write");
	 */
	getRulesForPath(targetPath) {
		const matching = [];
		for (const entry of this.#rules.values()) {
			const targetMatcher = this.#getCompiledPattern(entry.target);
			if (targetMatcher(targetPath)) {
				matching.push(this.#serializeRule(entry));
			}
		}
		return matching;
	}

	/**
	 * Get all rules owned by a given module.
	 *
	 * @param {string} moduleID - Module ID to look up.
	 * @returns {Array<object>} Array of rule objects (serialized).
	 * @example
	 * const rules = pm.getRulesByModule("mod_abc123");
	 */
	getRulesByModule(moduleID) {
		const matching = [];
		for (const entry of this.#rules.values()) {
			if (entry.ownerModuleID === moduleID) {
				matching.push(this.#serializeRule(entry));
			}
		}
		return matching;
	}

	/**
	 * Get all rules where the caller pattern matches a given caller path.
	 * Used by `self.rules()` to show what rules affect the calling module.
	 *
	 * @param {string} callerPath - Caller API path.
	 * @returns {Array<object>} Array of matching rule objects (serialized).
	 * @example
	 * const rules = pm.getRulesForCaller("payments.charge");
	 */
	getRulesForCaller(callerPath) {
		const matching = [];
		for (const entry of this.#rules.values()) {
			const callerMatcher = this.#getCompiledPattern(entry.caller);
			if (callerMatcher(callerPath)) {
				matching.push(this.#serializeRule(entry));
			}
		}
		return matching;
	}

	/**
	 * Enable the permission system globally.
	 *
	 * @returns {void}
	 * @example
	 * pm.enable();
	 */
	enable() {
		this.#enabled = true;
		this.#clearCache();
	}

	/**
	 * Disable the permission system globally (all calls allowed).
	 *
	 * @returns {void}
	 * @example
	 * pm.disable();
	 */
	disable() {
		this.#enabled = false;
		this.#clearCache();
	}

	/**
	 * Whether the permission system is currently enabled.
	 *
	 * @returns {boolean} True if enabled.
	 * @example
	 * if (pm.isEnabled()) { ... }
	 */
	isEnabled() {
		return this.#enabled;
	}

	/**
	 * Whether terminal data-value property reads are permission-gated.
	 * Separate from {@link isEnabled} so call enforcement is unaffected by this default-on
	 * flag (opt out via `permissions.readGating: false`).
	 *
	 * @returns {boolean} True if read gating is enabled.
	 * @example
	 * if (pm.isReadGatingEnabled()) { ... }
	 */
	isReadGatingEnabled() {
		return this.#readGating;
	}

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
	setReadGating(value) {
		if (typeof value !== "boolean") {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "value",
				expected: "boolean",
				received: typeof value,
				validationError: true
			});
		}
		this.#readGating = value;
	}

	/**
	 * Export all registered rules for replay during full reload.
	 *
	 * @returns {Array<object>} Snapshot of all current rules.
	 * @example
	 * const snapshot = pm.exportRules();
	 */
	// exportRules/importRules are reserved for a future bulk-snapshot reload path;
	// the current reload flow replays operationHistory entries directly and never calls these.
	/* v8 ignore start */
	exportRules() {
		const rules = [];
		for (const entry of this.#rules.values()) {
			rules.push({
				rule: { caller: entry.caller, target: entry.target, effect: entry.effect },
				ownerModuleID: entry.ownerModuleID
			});
		}
		return rules;
	}

	/**
	 * Re-register rules exported by {@link exportRules}.
	 * Called after a full reload to restore programmatic rules.
	 *
	 * @param {Array<object>} registrations - Snapshot returned by exportRules().
	 * @returns {void}
	 * @example
	 * pm.importRules(snapshot);
	 */
	importRules(registrations) {
		if (!Array.isArray(registrations)) return;
		for (const reg of registrations) {
			this.addRule(reg.rule, reg.ownerModuleID);
		}
	}
	/* v8 ignore stop */

	/**
	 * Cleanup permission manager on shutdown.
	 * Clears all internal state.
	 *
	 * @returns {Promise<void>}
	 * @example
	 * await pm.shutdown();
	 */
	async shutdown() {
		this.#rules.clear();
		this.#resolvedCache.clear();
		this.#compiledCache.clear();
		this.#enabled = false;
		this.#defaultPolicy = "allow";
		this.#audit = "default";
		this.#readGating = false;
	}

	// ──────────────────── Private methods ────────────────────

	/**
	 * Validate a rule object.
	 *
	 * @param {object} rule - Rule to validate.
	 * @throws {SlothletError} INVALID_PERMISSION_RULE if malformed.
	 * @private
	 */
	#validateRule(rule) {
		if (!rule || typeof rule !== "object") {
			throw new this.SlothletError("INVALID_PERMISSION_RULE", {
				reason: translate("PERM_RULE_NOT_OBJECT"),
				received: typeof rule
			});
		}
		if (typeof rule.caller !== "string" || !rule.caller) {
			throw new this.SlothletError("INVALID_PERMISSION_RULE", {
				reason: translate("PERM_RULE_CALLER_REQUIRED"),
				received: typeof rule.caller
			});
		}
		if (typeof rule.target !== "string" || !rule.target) {
			throw new this.SlothletError("INVALID_PERMISSION_RULE", {
				reason: translate("PERM_RULE_TARGET_REQUIRED"),
				received: typeof rule.target
			});
		}
		if (rule.effect !== "allow" && rule.effect !== "deny") {
			throw new this.SlothletError("INVALID_PERMISSION_RULE", {
				reason: translate("PERM_RULE_EFFECT_INVALID"),
				received: rule.effect
			});
		}
		if (rule.condition !== undefined && rule.condition !== null) {
			this.#assertValidConditionPayload(rule.condition, "INVALID_PERMISSION_RULE");
		}
	}

	/**
	 * Validate a condition payload shape for either public helper calls or rule registration.
	 * Conditions must be a plain object, a function, or a non-empty array of those entries.
	 *
	 * @param {unknown} condition - Condition payload to validate.
	 * @param {"INVALID_ARGUMENT"|"INVALID_PERMISSION_RULE"} errorCode - Error code to throw on invalid input.
	 * @returns {void}
	 * @throws {SlothletError} When the condition shape is invalid.
	 * @private
	 */
	#assertValidConditionPayload(condition, errorCode) {
		const getValueType = (value) => {
			if (value === null) return "null";
			if (Array.isArray(value)) return "array";
			return typeof value;
		};

		const isPlainObject = (value) => {
			if (value === null || typeof value !== "object") return false;
			const proto = Object.getPrototypeOf(value);
			return proto === Object.prototype || proto === null;
		};

		const isValidConditionEntry = (value) => typeof value === "function" || isPlainObject(value);
		const entries = Array.isArray(condition) ? condition : [condition];
		const invalidEntry = entries.length === 0 ? condition : entries.find((entry) => !isValidConditionEntry(entry));
		if (entries.length > 0 && invalidEntry === undefined) return;

		const received = getValueType(invalidEntry);
		if (errorCode === "INVALID_PERMISSION_RULE") {
			throw new this.SlothletError("INVALID_PERMISSION_RULE", {
				reason: translate("PERM_RULE_CONDITION_INVALID"),
				received
			});
		}

		throw new this.SlothletError("INVALID_ARGUMENT", {
			argument: "condition",
			expected: translate("PERM_RULE_CONDITION_INVALID"),
			received,
			validationError: true
		});
	}

	/**
	 * Recursively check that every leaf value in `pattern` matches the corresponding
	 * path in `ctx` via strict equality. Non-leaf objects are traversed; leaves are compared.
	 *
	 * @param {object} pattern - Condition pattern object (may be deeply nested).
	 * @param {object} ctx - Runtime context to test against.
	 * @returns {boolean} True if all leaves in `pattern` match `ctx`.
	 * @private
	 */
	#deepObjectMatches(pattern, ctx) {
		if (ctx == null || typeof ctx !== "object") return false;
		for (const [key, val] of Object.entries(pattern)) {
			// Only recurse into plain objects; treat class instances / Date / etc. as leaves
			const proto = val !== null && typeof val === "object" ? Object.getPrototypeOf(val) : null;
			const isPlainNested = proto === Object.prototype || proto === null;
			if (val !== null && typeof val === "object" && isPlainNested) {
				// Recurse into nested plain object
				if (!this.#deepObjectMatches(val, ctx[key])) return false;
			} else {
				// Leaf comparison (primitives, arrays, class instances, etc.)
				if (ctx[key] !== val) return false;
			}
		}
		return true;
	}

	/**
	 * Check whether a single condition entry (plain object or function) matches the context.
	 *
	 * @param {object|Function} conditionEntry - One condition entry.
	 * @param {object} ctx - Runtime context (never null — callers pass `{}`).
	 * @returns {boolean} True if the entry matches.
	 * @private
	 */
	#singleConditionMatches(conditionEntry, ctx) {
		if (typeof conditionEntry === "function") {
			try {
				return !!conditionEntry(ctx);
			} catch {
				// Condition function threw — treat as non-match, NEVER implicit allow
				return false;
			}
		}
		// Plain object (possibly nested): every leaf must match
		return this.#deepObjectMatches(conditionEntry, ctx);
	}

	/**
	 * Check whether a rule's condition matches the current runtime context.
	 * Rules with no condition always pass (backward compatible).
	 * A single plain-object condition requires all leaves to match (deep equality).
	 * A single function condition is called with the context; throws are non-match.
	 * An array of conditions passes if ANY single entry matches (OR semantics).
	 *
	 * @param {object} entry - Rule entry.
	 * @param {object|null} runtimeContext - Current per-request ALS context.
	 * @returns {boolean} True if the condition passes.
	 * @private
	 */
	#conditionMatches(entry, runtimeContext) {
		// Rule conditions are validated at registration time; use unchecked matcher on hot path.
		return this.#matchesConditionUnchecked(entry.condition, runtimeContext);
	}

	/**
	 * Shared access resolution logic used by both {@link checkAccess} and {@link enforceAccess}.
	 * Returns a decision record without emitting any events.
	 *
	 * @param {string} callerPath - Caller API path.
	 * @param {string} targetPath - Target API path.
	 * @param {string|null} callerFilePath - Caller source file path.
	 * @param {string|null} targetFilePath - Target source file path.
	 * @param {object|null} runtimeContext - Per-request ALS context.
	 * @param {boolean} useCache - Whether to read/write the resolved cache.
	 * @returns {{ allowed: boolean, event: string|null, payload: object|null, hasConditionalRules?: boolean }} Decision record.
	 * @private
	 */
	#resolveAccess(callerPath, targetPath, callerFilePath, targetFilePath, runtimeContext, useCache) {
		// Global toggle: when disabled, everything is allowed (no event to emit).
		// Exception: slothlet.permissions.control.** is always subject to rule evaluation
		// regardless of enabled state, so the built-in deny rule protects the toggle surface.
		const isControlTarget = targetPath?.startsWith("slothlet.permissions.control.");
		if (!this.#enabled && !isControlTarget) return { allowed: true, event: null, payload: null };

		// Self-call bypass: same source file always allowed
		if (callerFilePath && targetFilePath && callerFilePath === targetFilePath) {
			return {
				allowed: true,
				event: "permission:self-bypass",
				payload: { caller: callerPath, target: targetPath, filePath: callerFilePath }
			};
		}

		// Check resolved cache
		const cacheKey = `${callerPath}::${targetPath}`;
		if (useCache && this.#resolvedCache.has(cacheKey)) {
			return this.#resolvedCache.get(cacheKey);
		}

		// Evaluate rules — returns { allowed, event, payload, hasConditionalRules }
		const entry = this.#evaluate(callerPath, targetPath, runtimeContext);
		// Do NOT cache when any matching rule has a condition — results vary by runtime context
		if (useCache && !entry.hasConditionalRules) {
			this.#resolvedCache.set(cacheKey, entry);
		}
		return entry;
	}

	/**
	 * Evaluate all rules for a caller→target pair.
	 * Most-specific-wins; tiebreak: last-registered wins.
	 * An optional runtimeContext filters rules by their condition field.
	 *
	 * @param {string} callerPath - Caller API path.
	 * @param {string} targetPath - Target API path.
	 * @param {object|null} [runtimeContext=null] - Per-request ALS context for condition evaluation.
	 * @returns {{ allowed: boolean, event: string, payload: object, hasConditionalRules: boolean }} Decision record (does not emit; caller must emit).
	 * @private
	 */
	#evaluate(callerPath, targetPath, runtimeContext = null) {
		// Collect all path-matching rules
		const matches = [];

		for (const entry of this.#rules.values()) {
			// Hook-target rules (pattern:type) gate interception, never plain calls — skip them here.
			if (entry.hookType != null) continue;
			const callerMatcher = this.#getCompiledPattern(entry.caller);
			const targetMatcher = this.#getCompiledPattern(entry.target);

			if (callerMatcher(callerPath) && targetMatcher(targetPath)) {
				matches.push(entry);
			}
		}

		// Track whether any path-matching rule has a condition (used for cache safety)
		const hasConditionalRules = matches.some((m) => m.condition != null);

		// Filter out rules whose condition does not match the current runtime context
		const conditioned = matches.filter((entry) => this.#conditionMatches(entry, runtimeContext));

		// No conditioned matches → fall back to default policy
		if (conditioned.length === 0) {
			const allowed = this.#defaultPolicy === "allow";
			return {
				allowed,
				event: "permission:default",
				payload: { caller: callerPath, target: targetPath, policy: this.#defaultPolicy },
				hasConditionalRules
			};
		}

		// Sort by specificity (most specific first), tiebreak by registration order (last wins)
		conditioned.sort((a, b) => {
			const specA = this.#computeSpecificity(a, callerPath, targetPath);
			const specB = this.#computeSpecificity(b, callerPath, targetPath);
			if (specA !== specB) return specB - specA; // Higher specificity first
			return a.registeredAt - b.registeredAt; // Earlier first (so last in ties wins below)
		});

		// Among the highest-specificity rules, the last-registered one wins
		const highestSpec = this.#computeSpecificity(conditioned[0], callerPath, targetPath);
		const topTier = conditioned.filter((m) => this.#computeSpecificity(m, callerPath, targetPath) === highestSpec);
		// Last-registered in top tier wins
		const winner = topTier[topTier.length - 1];
		const allowed = winner.effect === "allow";

		return {
			allowed,
			event: allowed ? "permission:allowed" : "permission:denied",
			payload: {
				caller: callerPath,
				target: targetPath,
				rule: this.#serializeRule(winner),
				conditionMatched: winner.condition != null
			},
			hasConditionalRules
		};
	}

	/**
	 * Shared hook-access resolution used by {@link enforceHookAccess} and {@link checkHookAccess}.
	 * Returns a decision record without emitting any events.
	 *
	 * @param {string} callerPath - Hook owner's API path.
	 * @param {string} hookPath - API path being hooked.
	 * @param {string} hookType - Hook type.
	 * @param {string|null} callerFilePath - Owner source file path.
	 * @param {string|null} targetFilePath - Hooked path source file path.
	 * @param {object|null} runtimeContext - Per-request ALS context.
	 * @returns {{ allowed: boolean, event: string|null, payload: object|null }} Decision record.
	 * @private
	 */
	#resolveHookAccess(callerPath, hookPath, hookType, callerFilePath, targetFilePath, runtimeContext) {
		// Host-registered hook (no owner identity) is trusted, like an external (caller-less) call.
		// Callers (on()/getHooksForPath) only reach here when the system is enabled, so there is no
		// separate disabled-short-circuit; the call-level self-bypass is applied by the fallback below.
		if (!callerPath) return { allowed: true, event: null, payload: null };

		// 1. Hook-target rules (pattern:type) decide when any match.
		const hookDecision = this.#evaluateHook(callerPath, hookPath, hookType, runtimeContext);
		if (hookDecision.matched) {
			return { allowed: hookDecision.allowed, event: hookDecision.event, payload: hookDecision.payload };
		}

		// 2. Layered fallback: the CALL decision for the path (blocked path ⇒ blocked hook).
		const callDecision = this.#resolveAccess(callerPath, hookPath, callerFilePath, targetFilePath, runtimeContext, true);
		return { allowed: callDecision.allowed, event: callDecision.event, payload: callDecision.payload };
	}

	/**
	 * Evaluate hook-target rules (`pattern:type`) for a caller→hook pair. Most-specific-wins, with a
	 * specific type outranking the any-type `hook`; tiebreak last-registered. Returns `matched: false`
	 * when no hook-target rule applies (the caller then falls back to the call decision).
	 *
	 * @param {string} callerPath - Hook owner's API path.
	 * @param {string} hookPath - API path being hooked.
	 * @param {string} hookType - Hook type.
	 * @param {object|null} runtimeContext - Per-request ALS context.
	 * @returns {{ matched: boolean, allowed: boolean, event: string|null, payload: object|null }} Decision.
	 * @private
	 */
	#evaluateHook(callerPath, hookPath, hookType, runtimeContext) {
		const matches = [];
		for (const entry of this.#rules.values()) {
			if (entry.hookType == null) continue; // call-target rules don't gate hooks
			if (entry.hookType !== "hook" && entry.hookType !== hookType) continue;
			const callerMatcher = this.#getCompiledPattern(entry.caller);
			const pathMatcher = this.#getCompiledPattern(entry.hookPathPattern);
			if (callerMatcher(callerPath) && pathMatcher(hookPath)) {
				matches.push(entry);
			}
		}

		const conditioned = matches.filter((entry) => this.#conditionMatches(entry, runtimeContext));
		if (conditioned.length === 0) {
			return { matched: false, allowed: false, event: null, payload: null };
		}

		// Specificity: caller + path-pattern specificity, plus a point for a specific type over `hook`.
		const spec = (e) =>
			this.#patternSpecificity(e.caller, callerPath) +
			this.#patternSpecificity(e.hookPathPattern, hookPath) +
			(e.hookType === "hook" ? 0 : 1);
		conditioned.sort((a, b) => {
			const specA = spec(a);
			const specB = spec(b);
			if (specA !== specB) return specB - specA;
			return a.registeredAt - b.registeredAt;
		});
		const highest = spec(conditioned[0]);
		const topTier = conditioned.filter((m) => spec(m) === highest);
		const winner = topTier[topTier.length - 1];
		const allowed = winner.effect === "allow";

		return {
			matched: true,
			allowed,
			event: allowed ? "permission:allowed" : "permission:denied",
			payload: {
				caller: callerPath,
				target: `${hookPath}:${hookType}`,
				rule: this.#serializeRule(winner),
				conditionMatched: winner.condition != null
			}
		};
	}

	/**
	 * Parse a permission target into its hook-path pattern and hook type when it is a hook target.
	 *
	 * A hook target uses the suffix form `pattern:type`, where `type` is the trailing colon-delimited
	 * token and one of before/after/always/error or `hook` (any type) — e.g. `"db.*:error"`, `"**:hook"`.
	 * Ordinary call targets (no recognized hook-type suffix, e.g. `"db.write"`) return null.
	 *
	 * @param {string} target - Rule target string.
	 * @returns {{ pathPattern: string, hookType: string }|null} Parsed parts, or null for a call target.
	 * @private
	 */
	#parseHookTarget(target) {
		const lastColon = target.lastIndexOf(":");
		if (lastColon === -1) return null;
		const type = target.substring(lastColon + 1);
		if (!HOOK_TARGET_TYPES.has(type)) return null;
		const pathPattern = target.substring(0, lastColon);
		if (!pathPattern) return null;
		return { pathPattern, hookType: type };
	}

	/**
	 * Compute specificity score for a rule relative to a caller/target pair.
	 * Exact match = 3, single-segment glob = 2, multi-segment glob = 1.
	 * Combined score = callerScore + targetScore.
	 *
	 * @param {object} entry - Rule entry.
	 * @param {string} callerPath - Caller path.
	 * @param {string} targetPath - Target path.
	 * @returns {number} Combined specificity score (2–6).
	 * @private
	 */
	#computeSpecificity(entry, callerPath, targetPath) {
		return this.#patternSpecificity(entry.caller, callerPath) + this.#patternSpecificity(entry.target, targetPath);
	}

	/**
	 * Score a single pattern's specificity against an actual path.
	 *
	 * @param {string} pattern - Glob pattern.
	 * @param {string} _path - Actual path (unused but kept for future weighting).
	 * @returns {number} Specificity: 3 (exact), 2 (single-segment glob), 1 (multi-segment glob).
	 * @private
	 */
	#patternSpecificity(pattern, _path) {
		// Exact match (no glob characters)
		if (!pattern.includes("*") && !pattern.includes("?") && !pattern.includes("{")) {
			return 3;
		}
		// Multi-segment glob (**)
		if (pattern.includes("**")) {
			return 1;
		}
		// Single-segment glob (*, ?, {a,b})
		return 2;
	}

	/**
	 * Get or compile a cached pattern matcher.
	 *
	 * @param {string} pattern - Glob pattern.
	 * @returns {function} Matcher function.
	 * @private
	 */
	#getCompiledPattern(pattern) {
		let matcher = this.#compiledCache.get(pattern);
		if (!matcher) {
			matcher = compilePattern(pattern);
			this.#compiledCache.set(pattern, matcher);
		}
		return matcher;
	}

	/**
	 * Clear the resolved result cache. Called when rules or topology change.
	 *
	 * @returns {void}
	 * @private
	 */
	#clearCache() {
		this.#resolvedCache.clear();
	}

	/**
	 * Emit an audit event via the lifecycle system.
	 * "permission:denied" and "permission:self-bypass" always emit.
	 * "permission:allowed" and "permission:default" only emit when audit is "verbose".
	 *
	 * @param {string} event - Event name.
	 * @param {object} payload - Event payload.
	 * @returns {void}
	 * @private
	 */
	#emitAuditEvent(event, payload) {
		// Debug logging always fires
		this.debug("permissions", {
			key:
				event === "permission:denied"
					? "DEBUG_PERMISSION_DENIED"
					: event === "permission:allowed"
						? "DEBUG_PERMISSION_ALLOWED"
						: event === "permission:self-bypass"
							? "DEBUG_PERMISSION_SELF_BYPASS"
							: "DEBUG_PERMISSION_DEFAULT",
			...payload
		});

		// Lifecycle events: denied and self-bypass always emit; allowed/default only in verbose mode
		const alwaysEmit = event === "permission:denied" || event === "permission:self-bypass";
		if (!alwaysEmit && this.#audit !== "verbose") return;

		const lifecycle = this.slothlet.handlers?.lifecycle;
		if (lifecycle) {
			lifecycle.emit(event, { ...payload, timestamp: Date.now() });
		}
	}

	/**
	 * Serialize a rule entry for external consumption.
	 *
	 * @param {object} entry - Internal rule entry.
	 * @returns {object} Serialized rule.
	 * @private
	 */
	#serializeRule(entry) {
		return {
			id: entry.id,
			caller: entry.caller,
			target: entry.target,
			effect: entry.effect,
			condition: entry.condition ?? null,
			ownerModuleID: entry.ownerModuleID,
			registeredAt: entry.registeredAt
		};
	}

	/**
	 * Emit a debug message. Delegates to slothlet.debug().
	 *
	 * @param {string} category - Debug category.
	 * @param {object} data - Debug data.
	 * @returns {void}
	 * @private
	 */
	debug(category, data) {
		this.slothlet.debug(category, data);
	}
}
