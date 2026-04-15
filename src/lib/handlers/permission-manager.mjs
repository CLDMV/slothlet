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
	 * @type {boolean}
	 * @private
	 */
	#enabled = true;

	/**
	 * Audit level: "default" or "verbose".
	 * @type {string}
	 * @private
	 */
	#audit = "default";

	/**
	 * Cache of resolved caller::target → boolean results.
	 * Keyed by "${callerPath}::${targetPath}".
	 * @type {Map<string, boolean>}
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
			this.#defaultPolicy = permConfig.defaultPolicy || "allow";
			this.#enabled = permConfig.enabled !== false;
			this.#audit = permConfig.audit || "default";

			// Register config-level rules (earliest in stacking order)
			if (Array.isArray(permConfig.rules)) {
				for (const rule of permConfig.rules) {
					this.addRule(rule, null);
				}
			}
		}

		// Built-in deny rule: block all modules from calling control.enable/disable by default
		this.addRule({ caller: "**", target: "slothlet.permissions.control.**", effect: "deny" }, "__builtin__");
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
		const entry = {
			id,
			caller: rule.caller,
			target: rule.target,
			effect: rule.effect,
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
		if (callerModuleID && entry.ownerModuleID && callerModuleID === entry.ownerModuleID) {
			throw new this.SlothletError("PERMISSION_SELF_MODIFY", {
				ruleId,
				moduleID: callerModuleID
			});
		}

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
	 * Check whether a caller path is allowed to access a target path.
	 * This is the main enforcement method called from applyTrap.
	 *
	 * @param {string} callerPath - The calling module's API path.
	 * @param {string} targetPath - The target API path being accessed.
	 * @param {string|null} [callerFilePath=null] - Caller's source file path (for self-call bypass).
	 * @param {string|null} [targetFilePath=null] - Target's source file path (for self-call bypass).
	 * @returns {boolean} True if access is allowed.
	 * @example
	 * const allowed = pm.checkAccess("payments.charge", "db.write", "/src/pay.mjs", "/src/db.mjs");
	 */
	checkAccess(callerPath, targetPath, callerFilePath = null, targetFilePath = null) {
		// Global toggle: when disabled, everything is allowed
		if (!this.#enabled) return true;

		// Self-call bypass: same source file always allowed
		if (callerFilePath && targetFilePath && callerFilePath === targetFilePath) {
			this.#emitAuditEvent("permission:self-bypass", {
				caller: callerPath,
				target: targetPath,
				filePath: callerFilePath
			});
			return true;
		}

		// Check resolved cache
		const cacheKey = `${callerPath}::${targetPath}`;
		if (this.#resolvedCache.has(cacheKey)) {
			return this.#resolvedCache.get(cacheKey);
		}

		// Evaluate rules
		const result = this.#evaluate(callerPath, targetPath);
		this.#resolvedCache.set(cacheKey, result);
		return result;
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
	 * Export all registered rules for replay during full reload.
	 *
	 * @returns {Array<object>} Snapshot of all current rules.
	 * @example
	 * const snapshot = pm.exportRules();
	 */
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
		this.#enabled = true;
		this.#defaultPolicy = "allow";
		this.#audit = "default";
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
	}

	/**
	 * Evaluate all rules for a caller→target pair.
	 * Most-specific-wins; tiebreak: last-registered wins.
	 *
	 * @param {string} callerPath - Caller API path.
	 * @param {string} targetPath - Target API path.
	 * @returns {boolean} True if allowed.
	 * @private
	 */
	#evaluate(callerPath, targetPath) {
		// Collect all matching rules
		const matches = [];

		for (const entry of this.#rules.values()) {
			const callerMatcher = this.#getCompiledPattern(entry.caller);
			const targetMatcher = this.#getCompiledPattern(entry.target);

			if (callerMatcher(callerPath) && targetMatcher(targetPath)) {
				matches.push(entry);
			}
		}

		// No matches → fall back to default policy
		if (matches.length === 0) {
			const allowed = this.#defaultPolicy === "allow";
			this.#emitAuditEvent("permission:default", {
				caller: callerPath,
				target: targetPath,
				policy: this.#defaultPolicy
			});
			return allowed;
		}

		// Sort by specificity (most specific first), tiebreak by registration order (last wins)
		matches.sort((a, b) => {
			const specA = this.#computeSpecificity(a, callerPath, targetPath);
			const specB = this.#computeSpecificity(b, callerPath, targetPath);
			if (specA !== specB) return specB - specA; // Higher specificity first
			return a.registeredAt - b.registeredAt; // Earlier first (so last in ties wins below)
		});

		// Among the highest-specificity rules, the last-registered one wins
		const highestSpec = this.#computeSpecificity(matches[0], callerPath, targetPath);
		const topTier = matches.filter((m) => this.#computeSpecificity(m, callerPath, targetPath) === highestSpec);
		// Last-registered in top tier wins
		const winner = topTier[topTier.length - 1];
		const allowed = winner.effect === "allow";

		// Emit audit event
		if (allowed) {
			this.#emitAuditEvent("permission:allowed", {
				caller: callerPath,
				target: targetPath,
				rule: this.#serializeRule(winner)
			});
		} else {
			this.#emitAuditEvent("permission:denied", {
				caller: callerPath,
				target: targetPath,
				rule: this.#serializeRule(winner)
			});
		}

		return allowed;
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
