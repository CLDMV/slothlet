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

import { path } from "@cldmv/slothlet/helpers/platform";
import { ComponentBase } from "#factories/component-base";
import { compilePattern } from "@cldmv/slothlet/helpers/pattern-matcher";
import { translate } from "@cldmv/slothlet/i18n";
import { MODULE_ID_SEPARATOR } from "#handlers/metadata";

/**
 * Cache size above which a principal with a `maxAge` sweeps its expired identities on the next
 * resolve (#459), so a long-lived process serving many identities does not grow without bound.
 * @type {number}
 */
const PRINCIPAL_PRUNE_THRESHOLD = 1024;

/**
 * Auto-incrementing counter for rule IDs.
 * @type {number}
 */
let ruleIdCounter = 0;

/**
 * Monotonic registration sequence for rules. Used as the final tiebreak (last-registered wins
 * WITHIN a layer) so it is robust against `Date.now()` collisions when several rules register in
 * the same millisecond (e.g. the config-rules loop). Strictly increasing across the process.
 * @type {number}
 */
let ruleRegistrationSeq = 0;

/**
 * Hook types that may appear as a permission-target suffix in the `pattern:type` form.
 * `hook` is the "any type" wildcard. Mirrors HookManager's registrable types so a hook and the
 * rule that gates it read identically (e.g. `hook.on("db.*:error")` ↔ `target: "db.*:error"`).
 * @type {Set<string>}
 */
const HOOK_TARGET_TYPES = new Set(["before", "after", "always", "error", "hook"]);

/**
 * Precedence layers used to break ties when two matching rules have EQUAL specificity.
 * Most-specific-wins is always the primary rule; only among equally-specific rules does the
 * higher layer win, so the composing host (instance config / gated runtime) overrides a module's
 * manifest, which overrides the framework built-in default. Within a single layer, last-registered
 * wins. Higher number = higher precedence.
 *
 * This applies uniformly to call rules, hook-target rules, and event rules (#407) — a broad host
 * "lock it down" rule and a module's own narrower "open my events" rule resolve by specificity, and
 * an equally-specific host rule always overrides the module's.
 * @type {Readonly<Record<string, number>>}
 */
const RULE_LAYER_RANK = Object.freeze({ builtin: 0, manifest: 1, instance: 2, runtime: 3 });

/**
 * Resolve a rule's precedence layer from an explicit layer or the owning module id.
 * @param {string|null} layer - Explicit layer ("builtin"|"manifest"|"instance"|"runtime"), or null to derive.
 * @param {string|null} ownerModuleID - Owning module id; "__builtin__" marks a framework rule.
 * @returns {string} The resolved layer name.
 * @internal
 */
function resolveRuleLayer(layer, ownerModuleID) {
	if (layer && Object.prototype.hasOwnProperty.call(RULE_LAYER_RANK, layer)) return layer;
	if (ownerModuleID === "__builtin__") return "builtin";
	return "instance";
}

/**
 * Whether an api path's terminal member name is module-private (#260).
 *
 * @param {string|null|undefined} targetPath - Dotted api path of the read/call target.
 * @returns {boolean} True when the LAST segment is `_`/`__`-prefixed.
 * @internal
 *
 * @description
 * Privacy attaches to the MEMBER name, not the route: `mod.__rate` is private however deep the
 * namespace, while `_utils.helper` is a public member of a module whose surface name merely starts
 * with an underscore (hidden-entry filtering excludes `__`-prefixed FILES and FOLDERS at scan, so
 * an underscore-prefixed intermediate segment is a deliberate public mount). Framework-reserved
 * names never reach enforcement as members, so no reserved-name exclusion is needed here.
 *
 * A member needs something to be a member OF, so a path with no parent segment is never private:
 * a bare `_utils` is the mount itself, and calling it must stay as public as traversing it. Keeping
 * a root-level file out of the api is what the `__` prefix and the `hidden` globs are for; the
 * single-underscore form is deliberately not hidden at scan.
 */
function runtime_isPrivateName(targetPath) {
	if (typeof targetPath !== "string" || targetPath.length === 0) return false;
	const cut = targetPath.lastIndexOf(".");
	if (cut < 0) return false;
	return targetPath.charCodeAt(cut + 1) === 95; // "_"
}

/**
 * Whether two source files belong to the same module — the same directory of files (#260).
 *
 * @param {string} callerFilePath - Absolute path of the caller's source file.
 * @param {string} targetFilePath - Absolute path of the target's source file.
 * @returns {boolean} True when both files live in the same directory.
 * @internal
 *
 * @description
 * A slothlet module IS a directory of files, so same-directory is the module-identity encoding
 * that survives every composition shape — the api path is lossy in both directions, but
 * enforcement receives both REAL file paths, and `dirname` equality needs no new assigned
 * identity, no cache-key change, and no mode-dependent normalization. A subdirectory is its own
 * module: nesting expresses a boundary, exactly as it does for the api surface.
 */
function runtime_sameModuleDir(callerFilePath, targetFilePath) {
	return path.dirname(callerFilePath) === path.dirname(targetFilePath);
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
 *
 * @typedef {object} PermissionCallMeta
 * @property {Array<*>|null} args - Arguments the target leaf was called/constructed with, or null.
 * @property {string|null} target - Concrete (post-glob) target api path of the gated call.
 */

/**
 * Whether a value is a thenable — the shape an async function or a Promise-returning condition
 * produces. Used to refuse a thenable result from a synchronous condition (#459): `!!promise` is
 * `true`, so without this guard an `async` condition on an `allow` rule would fail open.
 *
 * @param {*} value - A condition's return value.
 * @returns {boolean} True when `value` is an object or function with a callable `then`.
 * @internal
 */
function runtime_isThenable(value) {
	return value !== null && (typeof value === "object" || typeof value === "function") && typeof value.then === "function";
}

/**
 * Whether a resolved principal value is wrapped in a read-only view: plain objects (including
 * null-prototype) and arrays. Primitives pass through untouched (they are immutable), and class
 * instances / Date / Map / Set are returned as-is — wrapping them would break their methods (a wrong
 * `this`) without guarding them, since they mutate through methods rather than property writes.
 *
 * @param {*} value - A value inside a resolved principal.
 * @returns {boolean} True for a plain object or array.
 * @internal
 */
function runtime_isViewablePrincipalValue(value) {
	if (value === null || typeof value !== "object") return false;
	if (Array.isArray(value)) return true;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

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
	 * Whether a function read out of the api keeps the identity of the module that read it.
	 *
	 * On by default when permissions are configured — opt out via `permissions.references.capture: false`.
	 * Without it, a reference captured inside a module and invoked later from a boundary that carries no
	 * caller is treated as host-initiated, which is more authority than the capturing module has.
	 * @type {boolean}
	 * @private
	 */
	#capture = true;

	/**
	 * Module-privacy host policy (#260): "deny" (default) refuses the host's reads/calls of
	 * `_`/`__`-prefixed members; "allow" keeps the trusted-root carve-out for them.
	 * @type {"deny"|"allow"}
	 */
	#privateHost = "deny";

	/**
	 * Event rules (#407): the separate three-level (deny/notify/allow) rule pool for the event
	 * system, distinct from the binary call/hook {@link #rules} above. Keyed by rule id.
	 * @type {Map<string, object>}
	 * @private
	 */
	#eventRules = new Map();

	/**
	 * Base event level applied when no event rule matches a subscriber/event pair. Built-in default
	 * "notify" (open subscription, payload opt-in); overridable via `permissions.events.default`.
	 * @type {"deny"|"notify"|"allow"}
	 * @private
	 */
	#eventDefault = "notify";

	/**
	 * Monotonic epoch bumped on every event-rule change (add/remove). The EventManager caches
	 * resolved subscriber levels against this value and re-resolves only after a (gated) rule change.
	 * @type {number}
	 * @private
	 */
	#eventRulesEpoch = 0;

	/**
	 * Whether the control surface is sealed. When true, policy-mutating methods (`enable`,
	 * `disable`, `addRule`, `removeRule`, `setReadGating`, `registerPrincipal`, `unregisterPrincipal`)
	 * throw `PERMISSION_SEALED`. One-way: there is no unseal. `shutdown()` is never guarded (teardown
	 * must always work), and neither is `invalidatePrincipal` (revocation must keep working).
	 * @type {boolean}
	 * @private
	 */
	#sealed = false;

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
	 * Registered principals (#459): named, owned resolvers that turn a caller identity into
	 * authorization facts for synchronous rule conditions. Keyed by principal name.
	 *
	 * Each record: `{ name, ownerModuleID, key, resolve, maxAge, epoch, cache, inflight }`, where
	 * `cache` maps an identity key to `{ value, view, epoch, resolvedAt }` and `inflight` maps an
	 * identity key to the pending resolve so concurrent calls for one identity share it.
	 * @type {Map<string, object>}
	 * @private
	 */
	#principals = new Map();

	/**
	 * Number of call/hook rules that declare `requires`. Lets enforcement skip principal work
	 * entirely (the common case) without scanning the rule set.
	 * @type {number}
	 * @private
	 */
	#requiresRuleCount = 0;

	/**
	 * True only for the duration of a promoted call's post-resolve enforcement (#459). A principal
	 * resolved for that call is accepted even if its `maxAge` has since elapsed, as long as its epoch
	 * still matches — without this a `maxAge: 0` principal could never be satisfied. An epoch bump
	 * (invalidate / re-register / owner reload) during the resolve still fails the rule closed.
	 * @type {boolean}
	 * @private
	 */
	#principalGrace = false;

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
			this.#capture = permConfig.references?.capture !== false;
			// Module privacy (#260): whether the HOST may read `_`/`__` exports. Secure default deny.
			this.#privateHost = permConfig.private?.host === "allow" ? "allow" : "deny";

			// Register config-level rules (earliest in stacking order)
			if (Array.isArray(permConfig.rules)) {
				for (const rule of permConfig.rules) {
					this.addRule(rule, null);
				}
			}

			// Event rules (#407): base default level + config-level event rules (instance layer).
			// Config normalization guarantees `events` is present with a valid `default` and array `rules`.
			if (permConfig.events) {
				if (permConfig.events.default) this.#eventDefault = permConfig.events.default;
				if (Array.isArray(permConfig.events.rules)) {
					for (const rule of permConfig.events.rules) {
						this.addEventRule(rule, null);
					}
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

		// Built-in allow rules (#468): `slothlet.metadata.caller` / `slothlet.metadata.self` reveal
		// identity only — who is calling this module, and which module this is — which is what a module
		// needs to enforce its own policy (e.g. scoping records by caller). They grant no data or
		// control access, so like lockCaller/bind a `defaultPolicy: "deny"` host need not re-allow
		// them. `slothlet.metadata.get(path)`, which reads arbitrary metadata, stays gated, and a user
		// rule of equal or higher specificity still overrides these.
		this.addRule({ caller: "**", target: "slothlet.metadata.caller", effect: "allow" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.metadata.self", effect: "allow" }, "__builtin__");

		// Principals (#459): registering, replacing, or invalidating a resolver decides what facts every
		// `requires` rule sees, so the principal management surface is host-only by default. The host
		// grants it to the modules that should define principals, exactly like any other rule.
		this.addRule({ caller: "**", target: "slothlet.permissions.principal.**", effect: "deny" }, "__builtin__");

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

		// Event system (#407): modules may USE the event surface (subscribe/emit); per-subscriber
		// DELIVERY is governed by the separate three-level event-rule pool (resolveEventLevel), not this
		// coarse call gate. The broad deny keeps runtime rule mutation (`slothlet.event.rules.*`)
		// host-only — modules cannot override event rules at runtime — while the specific allows keep
		// on/once/off/emit usable under a `defaultPolicy: "deny"` configuration. A consumer rule of equal
		// specificity still wins (instance layer > builtin), so the host can tighten any of these.
		this.addRule({ caller: "**", target: "slothlet.event.**", effect: "deny" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.event.on", effect: "allow" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.event.once", effect: "allow" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.event.off", effect: "allow" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.event.emit", effect: "allow" }, "__builtin__");
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
	addRule(rule, ownerModuleID = null, ruleId = null, layer = null) {
		this.#assertNotSealed();
		this.#validateRule(rule);

		const id = ruleId || `perm-${++ruleIdCounter}`;
		// Detect the hook-target suffix form (`pattern:type`). When present the rule gates hook
		// registration/execution rather than plain calls; `hookType` is the type or "hook" (any),
		// `hookPathPattern` is the path-glob portion. Both null for ordinary call-target rules.
		const hookTarget = this.#parseHookTarget(rule.target);
		// Precedence layer (#407): explicit `layer` wins; otherwise "__builtin__" → builtin, else instance.
		// Used only as the equal-specificity tiebreak (see RULE_LAYER_RANK).
		const ruleLayer = resolveRuleLayer(layer, ownerModuleID);
		const entry = {
			id,
			caller: rule.caller,
			target: rule.target,
			effect: rule.effect,
			condition: rule.condition ?? null,
			// #459: principals the rule's condition needs. A frozen copy so a later mutation of the caller's
			// array cannot change which facts an already-registered rule depends on.
			requires: rule.requires == null ? null : Object.freeze([...rule.requires]),
			hookType: hookTarget ? hookTarget.hookType : null,
			hookPathPattern: hookTarget ? hookTarget.pathPattern : null,
			ownerModuleID: ownerModuleID,
			layer: ruleLayer,
			layerRank: RULE_LAYER_RANK[ruleLayer],
			registeredAt: Date.now(),
			registrationSeq: ++ruleRegistrationSeq
		};

		this.#rules.set(id, entry);
		if (entry.requires) this.#requiresRuleCount++;
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
		this.#assertNotSealed();
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
		if (entry.requires) this.#requiresRuleCount--;
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
	addEventRule(rule, ownerModuleID = null, ruleId = null, layer = null) {
		this.#assertNotSealed();
		this.#validateEventRule(rule);

		const id = ruleId || `evt-${++ruleIdCounter}`;
		const ruleLayer = resolveRuleLayer(layer, ownerModuleID);
		const entry = {
			id,
			caller: rule.caller,
			event: rule.event,
			effect: rule.effect,
			condition: rule.condition ?? null,
			ownerModuleID,
			layer: ruleLayer,
			layerRank: RULE_LAYER_RANK[ruleLayer],
			registeredAt: Date.now(),
			registrationSeq: ++ruleRegistrationSeq
		};

		this.#eventRules.set(id, entry);
		this.#eventRulesEpoch++;

		this.debug("permissions", {
			key: "DEBUG_PERMISSION_RULE_ADDED",
			ruleId: id,
			caller: rule.caller,
			target: `${rule.event}:event`,
			effect: rule.effect,
			ownerModuleID
		});

		return id;
	}

	/**
	 * Remove an event rule by id. A module cannot remove an event rule it owns (immutability),
	 * mirroring {@link removeRule}.
	 *
	 * @param {string} ruleId - The event-rule id.
	 * @param {string|null} [callerModuleID=null] - Module id attempting removal.
	 * @returns {boolean} True if a rule was removed.
	 * @throws {SlothletError} PERMISSION_SELF_MODIFY if the caller owns the rule.
	 */
	removeEventRule(ruleId, callerModuleID = null) {
		this.#assertNotSealed();
		const entry = this.#eventRules.get(ruleId);
		if (!entry) return false;
		// Self-modification protection, mirroring removeRule: only reachable via a direct
		// addEventRule(rule, moduleID) call, never from the null-owner public runtime surface.
		/* v8 ignore start */
		if (callerModuleID && entry.ownerModuleID && callerModuleID === entry.ownerModuleID) {
			throw new this.SlothletError("PERMISSION_SELF_MODIFY", { ruleId, moduleID: callerModuleID });
		}
		/* v8 ignore stop */
		this.#eventRules.delete(ruleId);
		this.#eventRulesEpoch++;
		return true;
	}

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
	resolveEventLevel(subscriberPath, eventName, runtimeContext = null) {
		// Host subscription (no module caller) is trusted like a host-initiated call → full payload.
		if (subscriberPath == null) return "allow";

		const matches = [];
		for (const entry of this.#eventRules.values()) {
			const callerMatcher = this.#getCompiledPattern(entry.caller);
			const eventMatcher = this.#getCompiledPattern(entry.event);
			if (callerMatcher(subscriberPath) && eventMatcher(eventName)) matches.push(entry);
		}

		// Event delivery has no call/construct arguments — function conditions receive null callMeta.
		const conditioned = matches.filter((entry) => this.#conditionMatches(entry, runtimeContext, null));
		if (conditioned.length === 0) return this.#eventDefault;

		// Most-specific-wins; equal specificity → higher layer; within a layer → last-registered.
		conditioned.sort((a, b) => {
			const specA = this.#patternSpecificity(a.caller, subscriberPath) + this.#patternSpecificity(a.event, eventName);
			const specB = this.#patternSpecificity(b.caller, subscriberPath) + this.#patternSpecificity(b.event, eventName);
			if (specA !== specB) return specB - specA;
			if (a.layerRank !== b.layerRank) return b.layerRank - a.layerRank;
			return b.registrationSeq - a.registrationSeq;
		});
		return conditioned[0].effect;
	}

	/**
	 * Monotonic epoch that changes on every event-rule mutation. The EventManager caches resolved
	 * levels against it and re-resolves only when it changes.
	 * @returns {number} The current event-rules epoch.
	 */
	get eventRulesEpoch() {
		return this.#eventRulesEpoch;
	}

	/**
	 * Whether any event rule carries a condition. When false, a resolved subscriber level depends
	 * only on the rule set and can be safely cached against {@link eventRulesEpoch}; when true, the
	 * level can vary with the per-request context and must be re-resolved on each emit.
	 * @returns {boolean} True if at least one event rule has a condition.
	 */
	get hasConditionalEventRules() {
		for (const entry of this.#eventRules.values()) {
			if (entry.condition != null) return true;
		}
		return false;
	}

	/**
	 * Validate an event-rule shape (#407). Mirrors {@link #validateRule} for the
	 * `{ caller, event, effect(deny/notify/allow), condition? }` construct.
	 * @param {object} rule - The event rule to validate.
	 * @returns {void}
	 * @throws {SlothletError} INVALID_PERMISSION_RULE on a malformed rule.
	 * @private
	 */
	#validateEventRule(rule) {
		if (!rule || typeof rule !== "object") {
			throw new this.SlothletError("INVALID_PERMISSION_RULE", { reason: translate("PERM_RULE_NOT_OBJECT"), received: typeof rule });
		}
		if (typeof rule.caller !== "string" || !rule.caller) {
			throw new this.SlothletError("INVALID_PERMISSION_RULE", {
				reason: translate("PERM_RULE_CALLER_REQUIRED"),
				received: typeof rule.caller
			});
		}
		if (typeof rule.event !== "string" || !rule.event) {
			throw new this.SlothletError("INVALID_PERMISSION_RULE", {
				reason: translate("PERM_EVENT_RULE_EVENT_REQUIRED"),
				received: typeof rule.event
			});
		}
		if (rule.effect !== "deny" && rule.effect !== "notify" && rule.effect !== "allow") {
			throw new this.SlothletError("INVALID_PERMISSION_RULE", {
				reason: translate("PERM_EVENT_RULE_EFFECT_INVALID"),
				received: rule.effect
			});
		}
		if (rule.condition !== undefined && rule.condition !== null) {
			this.#assertValidConditionPayload(rule.condition, "INVALID_PERMISSION_RULE");
		}
	}

	// ──────────────────── Principals (#459) ────────────────────

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
	registerPrincipal(name, definition, ownerModuleID = null, invoke = null) {
		this.#assertNotSealed();
		this.#validatePrincipal(name, definition);

		const existing = this.#principals.get(name);
		if (existing && ownerModuleID !== null && !this.#sameOwner(existing.ownerModuleID, ownerModuleID)) {
			throw new this.SlothletError(
				"PRINCIPAL_NAME_OWNED",
				{ name, owner: existing.ownerModuleID ?? "host", claimant: ownerModuleID },
				null,
				{ validationError: true }
			);
		}

		this.#principals.set(
			name,
			this.#newPrincipalRecord(
				name,
				// The host replacing a module's principal keeps that module as the owner — the host acts on a
				// name's behalf, it does not take the name away from the module that defined it.
				existing ? existing.ownerModuleID : ownerModuleID,
				definition,
				invoke,
				definition.maxAge ?? null,
				// A replacement continues the epoch sequence so a value resolved by the previous resolver can
				// never read as current for the new one.
				existing ? existing.epoch + 1 : 0
			)
		);

		this.debug("permissions", {
			key: "DEBUG_PERMISSION_PRINCIPAL_REGISTERED",
			principal: name,
			ownerModuleID: ownerModuleID ?? "host"
		});
	}

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
	unregisterPrincipal(name, callerModuleID = null) {
		this.#assertNotSealed();
		const record = this.#principals.get(name);
		if (!record) return false;
		this.#assertPrincipalOwner(record, callerModuleID, "unregister");
		this.#principals.delete(name);
		return true;
	}

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
	invalidatePrincipal(name, identityKey = undefined, callerModuleID = null) {
		const record = this.#principals.get(name);
		if (!record) return false;
		this.#assertPrincipalOwner(record, callerModuleID, "invalidate");
		if (identityKey === undefined) {
			this.#bumpPrincipal(record);
			return true;
		}
		record.cache.delete(identityKey);
		// Only an identity with a resolve in flight needs a marker; the marker is dropped when it settles.
		if (record.inflight.has(identityKey)) record.keyInvalidations.set(identityKey, ++record.seq);
		return true;
	}

	/**
	 * Whether a principal with this name is registered.
	 *
	 * @param {string} name - Principal name.
	 * @returns {boolean} True when registered.
	 * @example
	 * pm.hasPrincipal("roles");
	 */
	hasPrincipal(name) {
		return this.#principals.has(name);
	}

	/**
	 * Drop every principal owned by a removed module (#459). Called when a whole module is removed
	 * (`api.slothlet.api.remove(moduleID)`), so a resolver never outlives the code that defined it.
	 *
	 * @param {string} moduleID - The removed module's id.
	 * @returns {void}
	 * @example
	 * pm.onModuleRemoved("roles_mod");
	 */
	onModuleRemoved(moduleID) {
		for (const [name, record] of this.#principals) {
			if (record.ownerModuleID !== null && this.#sameOwner(record.ownerModuleID, moduleID)) {
				this.#principals.delete(name);
			}
		}
	}

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
	onModuleReloaded(moduleID) {
		for (const record of this.#principals.values()) {
			if (record.ownerModuleID !== null && this.#sameOwner(record.ownerModuleID, moduleID)) {
				this.#makeDormant(record);
			}
		}
	}

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
	reservePrincipal(name, ownerModuleID) {
		if (this.#principals.has(name)) return;
		const record = this.#newPrincipalRecord(name, ownerModuleID, null, null, null, 0);
		this.#makeDormant(record);
		this.#principals.set(name, record);
	}

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
	stalePrincipals(callerPath, targetPath, callerFilePath = null, targetFilePath = null, runtimeContext = null) {
		if (this.#requiresRuleCount === 0 || this.#principals.size === 0) return [];
		// Mirror #resolveAccess's pre-rule short-circuits: those calls never reach a rule, so resolving
		// principals for them would be wasted work.
		if (!this.#enabled) return [];
		if (callerFilePath && targetFilePath && callerFilePath === targetFilePath) return [];
		if (runtime_isPrivateName(targetPath) && !targetPath.startsWith("slothlet.")) return [];

		const ctx = runtimeContext ?? {};
		const stale = [];
		const seen = new Map();
		for (const entry of this.#rules.values()) {
			if (!entry.requires || entry.hookType != null) continue;
			if (!this.#getCompiledPattern(entry.caller)(callerPath) || !this.#getCompiledPattern(entry.target)(targetPath)) continue;
			for (const name of entry.requires) {
				const record = this.#principals.get(name);
				// Absent or dormant → the rule simply does not match; nothing to resolve.
				if (!record || record.resolve === null) continue;
				const identityKey = this.#principalKey(record, ctx);
				if (identityKey == null) continue; // no identity → no facts; the rule does not match
				const hit = record.cache.get(identityKey);
				if (hit && this.#isPrincipalCurrent(record, hit, false)) continue;
				let keys = seen.get(name);
				if (!keys) seen.set(name, (keys = new Set()));
				if (keys.has(identityKey)) continue;
				keys.add(identityKey);
				stale.push({ name, identityKey });
			}
		}
		return stale;
	}

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
	async resolvePrincipals(pairs) {
		await Promise.all(pairs.map(({ name, identityKey }) => this.#resolvePrincipal(name, identityKey)));
	}

	/**
	 * Resolve one `(principal, identity)` pair, sharing an in-flight resolve for the same pair.
	 *
	 * @param {string} name - Principal name.
	 * @param {*} identityKey - Identity key.
	 * @returns {Promise<void>} Settles when the resolve finishes (never rejects).
	 * @private
	 */
	#resolvePrincipal(name, identityKey) {
		const record = this.#principals.get(name);
		// Unregistered or gone dormant between the stale scan and the resolve: nothing to do — the rule no
		// longer matches.
		if (!record || record.resolve === null) return Promise.resolve();
		const pending = record.inflight.get(identityKey);
		if (pending) return pending;

		const epoch = record.epoch;
		const startSeq = record.seq;
		const run = (async () => {
			try {
				const value = await (record.invoke ? record.invoke(record.resolve, [identityKey]) : record.resolve(identityKey));
				// Replaced, unregistered, or invalidated (wholesale or for this identity) while resolving: the
				// answer predates the change, so it must not be cached as current.
				const invalidatedAt = record.keyInvalidations.get(identityKey) ?? 0;
				if (this.#principals.get(name) !== record || record.epoch !== epoch || invalidatedAt > startSeq) return;
				const now = Date.now();
				record.cache.set(identityKey, { value, view: this.#principalView(record, value), epoch, resolvedAt: now });
				this.#prunePrincipalCache(record, now);
			} catch (error) {
				this.debug("permissions", {
					key: "DEBUG_PERMISSION_PRINCIPAL_RESOLVE_FAILED",
					principal: name,
					error: error?.message ?? String(error)
				});
			}
		})();
		record.inflight.set(identityKey, run);
		// `run` never rejects (the body catches), so this settle handler never surfaces a rejection.
		run.finally(() => {
			if (record.inflight.get(identityKey) === run) {
				record.inflight.delete(identityKey);
				record.keyInvalidations.delete(identityKey);
			}
		});
		return run;
	}

	/**
	 * The current principals a `requires` rule needs, as read-only views keyed by name, or `null`
	 * when any required principal is unregistered, has no identity for this context, or is not
	 * current (missing / expired / older epoch). A `null` makes the rule a non-match (#459).
	 *
	 * Enforcement sites that cannot wait (construct, read gating, hook and event resolution) reach
	 * this with a stale principal and fail the rule closed; a diagnostic records why.
	 *
	 * @param {ReadonlyArray<string>} requires - The rule's required principal names.
	 * @param {object|null} runtimeContext - Per-request context the principals key from.
	 * @param {string|null} target - Concrete target path, for the diagnostic.
	 * @returns {Readonly<Record<string, *>>|null} Frozen name→view map, or null when not all are current.
	 * @private
	 */
	#currentPrincipals(requires, runtimeContext, target) {
		const ctx = runtimeContext ?? {};
		const principals = Object.create(null);
		for (const name of requires) {
			const record = this.#principals.get(name);
			let reason = null;
			let hit = null;
			if (!record) {
				reason = "unregistered";
			} else if (record.resolve === null) {
				reason = "dormant";
			} else {
				const identityKey = this.#principalKey(record, ctx);
				if (identityKey == null) {
					reason = "no-identity";
				} else {
					hit = record.cache.get(identityKey);
					if (!hit || !this.#isPrincipalCurrent(record, hit, this.#principalGrace)) reason = "stale";
				}
			}
			if (reason !== null) {
				this.debug("permissions", { key: "DEBUG_PERMISSION_PRINCIPAL_UNAVAILABLE", principal: name, target, reason });
				return null;
			}
			principals[name] = hit.view;
		}
		return Object.freeze(principals);
	}

	/**
	 * Compute a principal's identity key for a context. A key function that throws, or returns a
	 * thenable (keys must be synchronous), yields `null` — no identity.
	 *
	 * @param {object} record - Principal record.
	 * @param {object} ctx - Runtime context.
	 * @returns {*} The identity key, or `null`.
	 * @private
	 */
	#principalKey(record, ctx) {
		let identityKey;
		try {
			identityKey = record.key(ctx);
		} catch {
			return null;
		}
		if (runtime_isThenable(identityKey)) {
			// Keep a rejecting async key function from surfacing as an unhandled rejection.
			try {
				identityKey.then(undefined, () => {});
			} catch {
				// A thenable whose `then` throws: the key is already treated as absent.
			}
			return null;
		}
		return identityKey;
	}

	/**
	 * Whether a cached principal value is current: same epoch, and within `maxAge` unless `grace`.
	 *
	 * @param {object} record - Principal record.
	 * @param {{ epoch: number, resolvedAt: number }} hit - Cached entry.
	 * @param {boolean} grace - Ignore `maxAge` (a promoted call re-enforcing right after its resolve).
	 * @returns {boolean} True when current.
	 * @private
	 */
	#isPrincipalCurrent(record, hit, grace) {
		if (hit.epoch !== record.epoch) return false;
		if (grace || record.maxAge === null) return true;
		return Date.now() - hit.resolvedAt <= record.maxAge;
	}

	/**
	 * Build a principal record.
	 *
	 * @param {string} name - Principal name.
	 * @param {string|null} ownerModuleID - Owning module's id; `null` for the host.
	 * @param {{ key: Function, resolve: Function }|null} definition - Resolver definition; `null` for a dormant reservation.
	 * @param {Function|null} invoke - Runs the resolver as its owner (see {@link registerPrincipal}).
	 * @param {number|null} maxAge - Time-to-live in ms, or `null` for none.
	 * @param {number} epoch - Starting epoch.
	 * @returns {object} The record.
	 * @private
	 */
	#newPrincipalRecord(name, ownerModuleID, definition, invoke, maxAge, epoch) {
		return {
			name,
			ownerModuleID,
			key: definition?.key ?? null,
			resolve: definition?.resolve ?? null,
			invoke,
			maxAge,
			epoch,
			seq: 0,
			cache: new Map(),
			inflight: new Map(),
			keyInvalidations: new Map(),
			views: new WeakMap()
		};
	}

	/**
	 * Drop a principal's resolver while keeping its name owned (see {@link onModuleReloaded}). A
	 * dormant principal never resolves and never satisfies a `requires` rule until re-registered.
	 *
	 * @param {object} record - Principal record.
	 * @returns {void}
	 * @private
	 */
	#makeDormant(record) {
		record.key = null;
		record.resolve = null;
		record.invoke = null;
		this.#bumpPrincipal(record);
	}

	/**
	 * Discard every cached value of a principal and bump its epoch, so in-flight resolves are
	 * discarded too and the next use re-resolves.
	 *
	 * @param {object} record - Principal record.
	 * @returns {void}
	 * @private
	 */
	#bumpPrincipal(record) {
		record.epoch++;
		record.cache.clear();
	}

	/**
	 * Drop expired entries once a principal's cache grows past a threshold. Only principals with a
	 * `maxAge` can expire; without one, entries live until invalidated.
	 *
	 * @param {object} record - Principal record.
	 * @param {number} now - Current time.
	 * @returns {void}
	 * @private
	 */
	#prunePrincipalCache(record, now) {
		if (record.maxAge === null || record.cache.size <= PRINCIPAL_PRUNE_THRESHOLD) return;
		for (const [identityKey, hit] of record.cache) {
			if (now - hit.resolvedAt > record.maxAge) record.cache.delete(identityKey);
		}
	}

	/**
	 * Build (or reuse) a read-only view of a resolved principal value. Reads pass through (nested
	 * plain objects/arrays are viewed on the way out); every write — set, define, delete, prototype
	 * change — throws `PRINCIPAL_READ_ONLY`. Only slothlet replaces a principal's value, on re-resolve.
	 *
	 * @param {object} record - Principal record (owns the view cache).
	 * @param {*} value - Raw resolved value, or a nested value inside it.
	 * @returns {*} A read-only view for a plain object/array; any other value unchanged.
	 * @private
	 */
	#principalView(record, value) {
		if (!runtime_isViewablePrincipalValue(value)) return value;
		const cached = record.views.get(value);
		if (cached) return cached;
		const refuse = () => {
			throw new this.SlothletError("PRINCIPAL_READ_ONLY", { name: record.name }, null, { validationError: true });
		};
		const view = new Proxy(value, {
			get: (target, prop, receiver) => {
				const inner = Reflect.get(target, prop, receiver);
				// Proxy invariant: a non-configurable, non-writable data property must read back as its exact
				// value, so a frozen resolver result keeps its own (already immutable) nested values.
				const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
				if (descriptor && descriptor.configurable === false && descriptor.writable === false) return inner;
				return this.#principalView(record, inner);
			},
			set: refuse,
			defineProperty: refuse,
			deleteProperty: refuse,
			setPrototypeOf: refuse
		});
		record.views.set(value, view);
		return view;
	}

	/**
	 * Throw unless the caller owns the principal (or is the host).
	 *
	 * @param {object} record - Principal record.
	 * @param {string|null} callerModuleID - Calling module's id; `null` for the host.
	 * @param {string} operation - Operation name, for the error.
	 * @returns {void}
	 * @throws {SlothletError} PRINCIPAL_NOT_OWNER when a non-owner module calls.
	 * @private
	 */
	#assertPrincipalOwner(record, callerModuleID, operation) {
		if (callerModuleID === null || this.#sameOwner(record.ownerModuleID, callerModuleID)) return;
		throw new this.SlothletError(
			"PRINCIPAL_NOT_OWNER",
			{ name: record.name, operation, owner: record.ownerModuleID ?? "host", caller: callerModuleID },
			null,
			{ validationError: true }
		);
	}

	/**
	 * Whether two module ids name the same module. Compares the base id, so a leaf's internal
	 * composite id (`moduleID<sep>apiPath`) and the plain id match.
	 *
	 * @param {string|null} a - A module id.
	 * @param {string|null} b - A module id.
	 * @returns {boolean} True when both name the same module.
	 * @private
	 */
	#sameOwner(a, b) {
		if (a === null || b === null) return a === b;
		return String(a).split(MODULE_ID_SEPARATOR)[0] === String(b).split(MODULE_ID_SEPARATOR)[0];
	}

	/**
	 * Validate a principal name and definition.
	 *
	 * @param {unknown} name - Principal name.
	 * @param {unknown} definition - Principal definition.
	 * @returns {void}
	 * @throws {SlothletError} INVALID_ARGUMENT on a malformed name or definition.
	 * @private
	 */
	#validatePrincipal(name, definition) {
		const fail = (argument, expected, received) => {
			throw new this.SlothletError("INVALID_ARGUMENT", { argument, expected, received, validationError: true });
		};
		if (typeof name !== "string" || name.length === 0) fail("name", "non-empty string", typeof name);
		if (!definition || typeof definition !== "object") fail("definition", "object", definition === null ? "null" : typeof definition);
		if (typeof definition.key !== "function") fail("definition.key", "function", typeof definition.key);
		if (typeof definition.resolve !== "function") fail("definition.resolve", "function", typeof definition.resolve);
		const { maxAge } = definition;
		if (maxAge !== undefined && maxAge !== null && !(typeof maxAge === "number" && Number.isFinite(maxAge) && maxAge >= 0)) {
			fail("definition.maxAge", "finite number >= 0", typeof maxAge);
		}
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

		// Silent query — no call/construct site, so no callMeta (function conditions receive null).
		return this.#resolveAccess(callerPath, targetPath, callerFilePath, targetFilePath, runtimeContext, useCache, null).allowed;
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
		// Public helper — a query, not a call/construct site — so function conditions receive null callMeta.
		return this.#matchesConditionUnchecked(condition, runtimeContext, null);
	}

	/**
	 * Evaluate condition semantics without payload-shape validation.
	 * Callers must ensure `condition` has already been validated.
	 *
	 * @param {object|Function|Array<object|Function>|null|undefined} condition - Rule condition payload.
	 * @param {object|null} [runtimeContext=null] - Per-request ALS context for condition evaluation.
	 * @param {PermissionCallMeta|null} callMeta - Call/construct metadata (#455) forwarded to function
	 *   conditions as their second argument; `null` off the call/construct path.
	 * @returns {boolean} True when condition semantics match the runtime context.
	 * @private
	 */
	#matchesConditionUnchecked(condition, runtimeContext = null, callMeta) {
		if (condition == null) return true;

		const ctx = runtimeContext ?? {};

		if (Array.isArray(condition)) {
			return condition.some((entry) => this.#singleConditionMatches(entry, ctx, callMeta));
		}

		return this.#singleConditionMatches(condition, ctx, callMeta);
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
	enforceAccess(
		callerPath,
		targetPath,
		callerFilePath = null,
		targetFilePath = null,
		runtimeContext = null,
		callMeta = null,
		options = null
	) {
		// #459: a promoted call re-enforces right after resolving its stale principals; `principalGrace`
		// lets those just-resolved values count as current even when `maxAge` has elapsed meanwhile.
		// Evaluation is synchronous, so the flag cannot leak into another call's enforcement; it is saved
		// and restored rather than cleared so a nested enforcement cannot end an outer one's grace early.
		const priorGrace = this.#principalGrace;
		this.#principalGrace = options?.principalGrace === true;
		let result;
		try {
			result = this.#resolveAccess(callerPath, targetPath, callerFilePath, targetFilePath, runtimeContext, true, callMeta);
		} finally {
			this.#principalGrace = priorGrace;
		}
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
		this.#assertNotSealed();
		this.#enabled = true;
		this.#clearCache();
	}

	/**
	 * Throw if the control surface is sealed. Called at the start of every policy-mutating method.
	 * @returns {void}
	 * @throws {SlothletError} PERMISSION_SEALED when {@link seal} has been called.
	 * @private
	 */
	#assertNotSealed() {
		if (this.#sealed) {
			throw new this.SlothletError("PERMISSION_SEALED", {}, null, { validationError: true });
		}
	}

	/**
	 * Seal the control surface (one-way, no unseal). After sealing, `enable`, `disable`, `addRule`,
	 * `removeRule`, `setReadGating`, `registerPrincipal`, and `unregisterPrincipal` throw
	 * `PERMISSION_SEALED`. Enforcement continues to evaluate normally, and `shutdown()` and
	 * `invalidatePrincipal()` still work. Idempotent — calling twice is a no-op.
	 * @returns {void}
	 * @example
	 * pm.seal();
	 */
	seal() {
		this.#sealed = true;
	}

	/**
	 * Whether the control surface has been sealed.
	 * @returns {boolean} True if sealed.
	 * @example
	 * if (pm.isSealed()) { ... }
	 */
	isSealed() {
		return this.#sealed;
	}

	/**
	 * Disable the permission system globally (all calls allowed).
	 *
	 * @returns {void}
	 * @example
	 * pm.disable();
	 */
	disable() {
		this.#assertNotSealed();
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
	 * Whether a function read out of the api keeps the identity of the module that read it.
	 *
	 * Consulted on the read path, so it is a method rather than a config lookup: reading it off the
	 * manager is one call instead of walking the instance's config object on every property read.
	 *
	 * @returns {boolean} True when captured references stay attributed to their capturer.
	 * @example
	 * if (pm.isCaptureEnabled()) { ... }
	 */
	isCaptureEnabled() {
		return this.#capture;
	}

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
	isPrivateTarget(targetPath) {
		return runtime_isPrivateName(targetPath);
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
		this.#assertNotSealed();
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
		this.#principals.clear();
		this.#requiresRuleCount = 0;
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
		if (rule.requires !== undefined && rule.requires !== null) {
			const valid =
				Array.isArray(rule.requires) &&
				rule.requires.length > 0 &&
				rule.requires.every((name) => typeof name === "string" && name.length > 0);
			if (!valid) {
				throw new this.SlothletError("INVALID_PERMISSION_RULE", {
					reason: translate("PERM_RULE_REQUIRES_INVALID"),
					received: Array.isArray(rule.requires) ? "array" : typeof rule.requires
				});
			}
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
	 * @param {PermissionCallMeta|null} callMeta - Call/construct metadata (#455) passed to a function
	 *   condition as its second argument; `null` off the call/construct path. Object conditions ignore it.
	 * @returns {boolean} True if the entry matches.
	 * @private
	 */
	#singleConditionMatches(conditionEntry, ctx, callMeta) {
		if (typeof conditionEntry === "function") {
			let result;
			try {
				// #455: forward call args + concrete target so a condition can gate on the resource in the
				// call itself (`(ctx, { args, target }) => …`); callMeta is null off the call/construct path.
				result = conditionEntry(ctx, callMeta);
			} catch {
				// Condition function threw — treat as non-match, NEVER implicit allow
				return false;
			}
			// #459: conditions are synchronous. A thenable (an `async` condition, or one returning a Promise)
			// is truthy, so `!!result` would let an `allow` rule fail OPEN — refuse it as a non-match. The
			// rejection handler keeps a rejecting condition from surfacing as an unhandled rejection; async
			// facts belong in a principal (`requires`), which is resolved before the condition runs.
			if (runtime_isThenable(result)) {
				try {
					result.then(undefined, () => {});
				} catch {
					// A hostile thenable whose `then` throws: nothing to observe — the verdict is already deny.
				}
				this.debug("permissions", {
					key: "DEBUG_PERMISSION_CONDITION_THENABLE",
					target: callMeta?.target ?? null
				});
				return false;
			}
			return !!result;
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
	 * @param {PermissionCallMeta|null} callMeta - Call/construct metadata (#455) forwarded to a function
	 *   condition's second argument; `null` off the call/construct path (reads, hooks, events, queries).
	 * @returns {boolean} True if the condition passes.
	 * @private
	 */
	#conditionMatches(entry, runtimeContext, callMeta) {
		if (entry.requires) {
			// #459: every required principal must be registered and current for this identity, or the rule
			// does not match (fail closed — a missing fact never widens access). Current principals reach
			// the condition as `principals`, alongside the call's own args/target.
			const principals = this.#currentPrincipals(entry.requires, runtimeContext, callMeta?.target ?? null);
			if (principals === null) return false;
			const meta = { args: callMeta?.args ?? null, target: callMeta?.target ?? null, principals };
			return this.#matchesConditionUnchecked(entry.condition, runtimeContext, meta);
		}
		// Rule conditions are validated at registration time; use unchecked matcher on hot path.
		return this.#matchesConditionUnchecked(entry.condition, runtimeContext, callMeta);
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
	 * @param {PermissionCallMeta|null} callMeta - Call/construct metadata (#455) forwarded to function
	 *   conditions; `null` off the call/construct path. Never affects caching: a call whose args a
	 *   condition reads is a condition-bearing rule, which already bypasses the cache.
	 * @returns {{ allowed: boolean, event: string|null, payload: object|null, hasConditionalRules?: boolean }} Decision record.
	 * @private
	 */
	#resolveAccess(callerPath, targetPath, callerFilePath, targetFilePath, runtimeContext, useCache, callMeta) {
		// Global toggle: when disabled, everything is allowed (no event to emit).
		// Exception: slothlet.permissions.control.** is always subject to rule evaluation
		// regardless of enabled state, so the built-in deny rule protects the toggle surface.
		// The principal management surface (#459) gets the same always-evaluated treatment, so a module
		// cannot register or replace a resolver while enforcement happens to be switched off.
		const isControlTarget =
			targetPath?.startsWith("slothlet.permissions.control.") || targetPath?.startsWith("slothlet.permissions.principal.");
		if (!this.#enabled && !isControlTarget) return { allowed: true, event: null, payload: null };

		// Self-call bypass: same source file always allowed
		if (callerFilePath && targetFilePath && callerFilePath === targetFilePath) {
			return {
				allowed: true,
				event: "permission:self-bypass",
				payload: { caller: callerPath, target: targetPath, filePath: callerFilePath }
			};
		}

		// Module privacy (#260): a `_`/`__`-prefixed member is private to the directory of files
		// that exports it. Enforced HERE — before rules and before the cache — deliberately:
		// the api path is a lossy projection of the module tree, so no rule glob can encode
		// "same module" (the guarantee is absolute, not overridable by user rules), and the
		// decision cache is keyed by path pair alone, which cannot distinguish two callers'
		// module identities. Same-module is same-DIRECTORY of the two source files — the one
		// identity that survives every composition shape, because enforcement already receives
		// both real file paths.
		// The injected `slothlet.*` control tree is framework surface, not module exports — its
		// members have no source files and no owning module, and internal machinery probes it with
		// synthetic `__`-prefixed children (`slothlet.permissions.__probe__`). Module privacy never
		// applies there.
		if (runtime_isPrivateName(targetPath) && targetPath !== "slothlet" && !targetPath.startsWith("slothlet.")) {
			if (callerFilePath && targetFilePath && runtime_sameModuleDir(callerFilePath, targetFilePath)) {
				return {
					allowed: true,
					event: "permission:private-module-bypass",
					payload: { caller: callerPath, target: targetPath, filePath: callerFilePath }
				};
			}
			// No caller identity = the host (module callers always carry a file path at the
			// enforcement sites). The host obeys the configured policy — secure default deny.
			if (!callerFilePath && this.#privateHost === "allow") {
				return {
					allowed: true,
					event: "permission:private-host-allow",
					payload: { caller: callerPath ?? null, target: targetPath }
				};
			}
			// Payload matches every other denial's shape; the private-name target itself carries the
			// why (an underscore-prefixed terminal segment is the module-privacy marker).
			return {
				allowed: false,
				event: "permission:denied",
				payload: { caller: callerPath ?? null, target: targetPath }
			};
		}

		// Check resolved cache
		const cacheKey = `${callerPath}::${targetPath}`;
		if (useCache && this.#resolvedCache.has(cacheKey)) {
			return this.#resolvedCache.get(cacheKey);
		}

		// Evaluate rules — returns { allowed, event, payload, hasConditionalRules }
		const entry = this.#evaluate(callerPath, targetPath, runtimeContext, callMeta);
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
	 * @param {PermissionCallMeta|null} callMeta - Call/construct metadata (#455) forwarded to function
	 *   conditions; `null` off the call/construct path.
	 * @returns {{ allowed: boolean, event: string, payload: object, hasConditionalRules: boolean }} Decision record (does not emit; caller must emit).
	 * @private
	 */
	#evaluate(callerPath, targetPath, runtimeContext = null, callMeta) {
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

		// Track whether any path-matching rule has a condition (used for cache safety). A `requires` rule
		// counts too (#459): its verdict depends on principal state, which changes without a rule change.
		const hasConditionalRules = matches.some((m) => m.condition != null || m.requires != null);

		// Filter out rules whose condition does not match the current runtime context. callMeta (#455) is
		// forwarded so a function condition can also gate on the call's own args + concrete target.
		const conditioned = matches.filter((entry) => this.#conditionMatches(entry, runtimeContext, callMeta));

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

		// Most-specific-wins (primary). Equal specificity → higher precedence layer wins
		// (runtime > instance > manifest > builtin); within a layer → last-registered wins.
		conditioned.sort((a, b) => {
			const specA = this.#computeSpecificity(a, callerPath, targetPath);
			const specB = this.#computeSpecificity(b, callerPath, targetPath);
			if (specA !== specB) return specB - specA; // higher specificity first
			if (a.layerRank !== b.layerRank) return b.layerRank - a.layerRank; // higher layer first
			return b.registrationSeq - a.registrationSeq; // later first → last-registered wins (within a layer)
		});
		const winner = conditioned[0];
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
		// Strict null/undefined check: an empty-string owner must not masquerade as "no owner" (#138 review).
		if (callerPath == null) return { allowed: true, event: null, payload: null };

		// 1. Hook-target rules (pattern:type) decide when any match.
		const hookDecision = this.#evaluateHook(callerPath, hookPath, hookType, runtimeContext);
		if (hookDecision.matched) {
			return { allowed: hookDecision.allowed, event: hookDecision.event, payload: hookDecision.payload };
		}

		// 2. Layered fallback: the CALL decision for the path (blocked path ⇒ blocked hook).
		// Hook fallback to the call decision carries no call/construct arguments → null callMeta.
		const callDecision = this.#resolveAccess(callerPath, hookPath, callerFilePath, targetFilePath, runtimeContext, true, null);
		return { allowed: callDecision.allowed, event: callDecision.event, payload: callDecision.payload };
	}

	/**
	 * Evaluate hook-target rules (`pattern:type`) for a caller→hook pair. Most-specific-wins, with a
	 * specific type outranking the any-type `hook`; equal specificity → higher layer, then
	 * last-registered. Returns `matched: false`
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

		// Hook gating has no call/construct arguments — function conditions receive null callMeta.
		const conditioned = matches.filter((entry) => this.#conditionMatches(entry, runtimeContext, null));
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
			// Different-layer tiebreak: two equal-specificity HOOK rules at distinct precedence layers
			// matching the same registration. The hook-rule layer sources that could so collide do not
			// co-occur on an arbitrary hook path via the public API (built-in rules gate only the
			// `slothlet.hook.*` control surface; manifest rules are module-scoped), so this arm is not
			// reachable here; the identical layer tiebreak is exercised by the event-rule comparator.
			/* v8 ignore next */
			if (a.layerRank !== b.layerRank) return b.layerRank - a.layerRank; // higher layer first
			return b.registrationSeq - a.registrationSeq; // last-registered wins (within a layer)
		});
		const winner = conditioned[0];
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
	 * @param {string} ___path - Actual path (unused but kept for future weighting).
	 * @returns {number} Specificity: 3 (exact), 2 (single-segment glob), 1 (multi-segment glob).
	 * @private
	 */
	#patternSpecificity(pattern, ___path) {
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
			requires: entry.requires ?? null,
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
