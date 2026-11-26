/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/config.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T11:44:38-08:00 (1795635878)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Configuration normalization utilities
 * @module @cldmv/slothlet/helpers/config
 * @internal
 */
import { ComponentBase } from "#factories/component-base";
import { SlothletError } from "#errors";

// Node-vs-browser host detection, resolved once in the platform module (#123). Used by
// Config.normalizeEnvTarget()'s auto-detect fallback path.
import { isNode as IS_NODE } from "#helpers/platform";

// The single source of truth for apiDepth's default — the mode processors + loader read the
// same constant for their own (defensive, standalone-call-only) parameter defaults.
import { DEFAULT_API_DEPTH, DEFAULT_ROUTINES, DEFAULT_SEARCH_DEPTH, DEFAULT_SEARCH_PROPERTIES } from "#helpers/defaults";

// Validates a routines[] entry's `name` compiles as a real glob pattern at construction time,
// rather than silently matching nothing forever (see normalizeRoutines()).
import { compilePattern } from "#helpers/pattern-matcher";
import {
	ArrayMethods,
	Arrays,
	filterList,
	mapList,
	Numbers,
	Objects,
	setFrom,
	SetMethods,
	setToArray,
	String,
	StringMethods
} from "#helpers/intrinsics";
import { createClock } from "#helpers/clock";
import { markNormalized } from "#helpers/config-schema";

/** Valid `mode` values for a routines entry. @type {ReadonlySet<string>} */
const VALID_ROUTINE_MODES = setFrom(["manual", "startup", "shutdown", "destroy"]);

/** Valid `order` values for a routines entry. @type {ReadonlySet<string>} */
const VALID_ROUTINE_ORDERS = setFrom(["mount", "depth"]);

/**
 * Default `order` per mode when a routine entry doesn't specify one — `"depth"` (deepest-first)
 * for `shutdown`/`destroy`, matching the replaced `collectLifecycleHooks` mechanism's own hardcoded
 * teardown order; `"mount"` (registration order) for `startup`/`manual`.
 * @type {Readonly<Record<string, "mount"|"depth">>}
 */
const DEFAULT_ROUTINE_ORDER_BY_MODE = Objects.freeze({ startup: "mount", shutdown: "depth", destroy: "depth", manual: "mount" });

/**
 * Routine names a caller may never configure. `"slothlet"` is the control namespace a routine's
 * own root cascade would need to live under, so reusing it as a routine name would be
 * self-referential. `__proto__`/`constructor`/`prototype` are rejected for the same reason
 * `api-manager.mjs`'s `UNSAFE_PATH_SEGMENTS` rejects them in a mount path: a routine's `name` is
 * used verbatim as a property key (`api[name]`), so one of these values
 * would mutate the object's prototype chain instead of installing an ordinary property (#302's
 * same class of bug, on a different property-assignment surface).
 * @type {ReadonlySet<string>}
 */
const ROUTINE_NAME_RESERVED = setFrom(["slothlet", "__proto__", "constructor", "prototype"]);

/**
 * Normalize the `hook` config into a canonical `{ enabled, pattern, errors, pin }` object.
 *
 * Accepts the boolean form (enable/disable with the catch-all pattern), the string form
 * (enable, restricting hooks to a global path pattern — e.g. `"database.*"`), or the full
 * object form. Idempotent: an already-normalized object normalizes to an equivalent object,
 * so `reload()` can re-feed it.
 *
 * Exported as a standalone function (not just a {@link Config} method) because the HookManager
 * is constructed during `_initializeComponents` — BEFORE `transformConfig` runs — so it cannot
 * rely on the normalized config being in place yet, and must normalize the raw `config.hook`
 * itself from the same source of truth.
 *
 * @param {boolean|string|Object} [hook] - Raw hook config in any supported form.
 * `errors` is `"suppress"` (a hook error is reported to the error hooks and not thrown) or `false`; `true` is the
 * boolean form of `"suppress"`.
 *
 * @returns {{enabled: boolean, pattern: (string|null), errors: ("suppress"|false), pin: boolean}} Normalized hook config.
 * @throws {SlothletError} INVALID_CONFIG when `hook.errors` is not `"suppress"`, `true` or `false`.
 * @public
 */
export function normalizeHookConfig(hook) {
	const hookConfig = { enabled: false, pattern: "**", errors: false, pin: true };
	if (hook === true || hook === false) {
		// Boolean: enabled/disabled with all patterns
		hookConfig.enabled = hook;
		hookConfig.pattern = hook ? "**" : null;
	} else if (typeof hook === "string") {
		// String: enabled with a specific global path pattern
		hookConfig.enabled = true;
		hookConfig.pattern = hook;
	} else if (hook && typeof hook === "object") {
		// Object: { enabled, pattern, errors, pin }
		hookConfig.enabled = hook.enabled !== false; // Default true if object provided
		hookConfig.pattern = hook.pattern || "**";
		hookConfig.errors = configChoice(
			hook.errors === true ? "suppress" : hook.errors,
			["suppress", false],
			false,
			"hook.errors",
			'"suppress" or false'
		);
		hookConfig.pin = hook.pin !== false;
	}
	return hookConfig;
}

/**
 * Build an instance's clock from the host's `clock` option.
 * The option is read once, when the instance is created, and kept by the instance alone: it is never part of the
 * normalised config an instance hands out, so only the host that creates the instance can supply it.
 * @param {{now?: Function, set?: Function, clear?: Function}} [clock] - The option as given. Each member is optional and must be
 *   a function; one left out is the copy slothlet took when it loaded. Absent means no `clock` option at all.
 * @returns {object} The frozen clock `{ now, setTimeout, clearTimeout, hostTimers }` (`set` and `clear` as the timer functions).
 * @throws {SlothletError} INVALID_CONFIG when it is not an object whose given members are functions.
 * @public
 * @example
 * normalizeClockConfig({ now: () => 1000 }).now(); // => 1000
 */
export function normalizeClockConfig(clock) {
	const built = createClock(clock);
	if (built === null) {
		throw new SlothletError("INVALID_CONFIG", {
			option: "clock",
			value:
				clock === null
					? "null"
					: Arrays.isArray(clock)
						? "an array"
						: typeof clock === "object"
							? "an object with a member that is not a function"
							: typeof clock,
			expected: "an object whose now, set and clear members are functions"
		});
	}
	return built;
}

/**
 * Expand the `permissions` shorthand forms to the object form.
 *
 * `"on"`, `"off"` and `"disabled"` mean `{ mode }`; `true` means `"on"`; `false` and any other falsy value mean no `permissions` config (off). An object, `null`
 * and `undefined` come back as they are. Any other string, and any other value that is not an object, comes back as
 * `undefined` with `valid: false`, so a bare value never quietly reads as a different mode than it names.
 *
 * Exported as a standalone function because the PermissionManager is constructed during `_initializeComponents`,
 * before `transformConfig` runs, and must read the same shorthand from the raw config. It does not throw: the
 * config normalizer reports the invalid value as `INVALID_CONFIG` right after.
 *
 * @param {*} permissions - Raw `permissions` option.
 * @returns {{value: (object|null|undefined), valid: boolean}} The object form (or the absent value), and whether the input was a form `permissions` accepts.
 * @public
 *
 * @example
 * expandPermissionsShorthand("disabled"); // => { value: { mode: "disabled" }, valid: true }
 * expandPermissionsShorthand("nope"); // => { value: undefined, valid: false }
 */
export function expandPermissionsShorthand(permissions) {
	if (permissions === undefined || permissions === null || typeof permissions === "object") {
		return { value: permissions, valid: true };
	}
	if (!permissions) {
		// `false` (and any other falsy value) is no `permissions` config at all: the system is off.
		return { value: null, valid: true };
	}
	if (permissions === true) {
		return { value: { mode: "on" }, valid: true };
	}
	if (permissions === "on" || permissions === "strict" || permissions === "off" || permissions === "disabled") {
		return { value: { mode: permissions }, valid: true };
	}
	return { value: undefined, valid: false };
}

/**
 * Validate that a config group, when given, is a plain object (not an array, not a primitive).
 * `typeof [] === "object"`, and an array would make every option inside the group read as unset — a silently
 * defaulted misconfiguration on a security-relevant block.
 * @param {*} value - The group as given.
 * @param {string} option - Its dotted config path, for the error.
 * @returns {object} The group, or an empty object when it was not given.
 * @throws {SlothletError} INVALID_CONFIG when it is given and is not an object.
 * @private
 */
function configGroup(value, option) {
	if (value === undefined) return {};
	if (typeof value !== "object" || value === null || Arrays.isArray(value)) {
		throw new SlothletError("INVALID_CONFIG", { option, value, expected: "object" });
	}
	return value;
}

/**
 * Validate one enumerated config value.
 * @param {*} value - The value as given (`undefined` takes the default).
 * @param {Array<*>} allowed - The accepted values.
 * @param {*} fallback - The default.
 * @param {string} option - Its dotted config path, for the error.
 * @param {string} expected - The accepted values as the error states them.
 * @returns {*} The value, or the default.
 * @throws {SlothletError} INVALID_CONFIG for any other value.
 * @private
 */
function configChoice(value, allowed, fallback, option, expected) {
	if (value === undefined) return fallback;
	if (ArrayMethods.includes(allowed, value)) return value;
	throw new SlothletError("INVALID_CONFIG", { option, value, expected });
}

/**
 * Validate one whole-number config value within bounds.
 * @param {*} value - The value as given (`undefined` takes the default).
 * @param {number} fallback - The default.
 * @param {number} min - The smallest accepted value.
 * @param {number} max - The largest accepted value.
 * @param {string} option - Its dotted config path, for the error.
 * @returns {number} The value, or the default.
 * @throws {SlothletError} INVALID_CONFIG for anything but a whole number from `min` to `max`.
 * @private
 */
function configCount(value, fallback, min, max, option) {
	if (value === undefined) return fallback;
	if (Numbers.isSafeInteger(value) && value >= min && value <= max) return value;
	throw new SlothletError("INVALID_CONFIG", { option, value, expected: `whole number from ${min} to ${max}` });
}

/**
 * The largest `permissions.search.depth` accepted. Each level is one more nested call of the search, and the budget of
 * properties bounds the rest.
 * @type {number}
 * @private
 */
const MAX_SEARCH_DEPTH = 64;

/**
 * The largest `permissions.search.properties` accepted: what one search reads is bounded so a call's cost stays bounded.
 * @type {number}
 * @private
 */
const MAX_SEARCH_PROPERTIES = 65536;

/**
 * Normalize the `permissions` option to its full object form (or `null` for no permissions config).
 *
 * The normalized form has the same shape as the option, every member filled in, so feeding it back in (a reload)
 * gives the same result.
 *
 * @param {object|string|boolean|null} [permissions] - Raw permissions config from user. A bare `"on"`, `"strict"`, `"off"` or `"disabled"` means `{ mode }`; `true` and `false` mean `"on"` and `"off"`.
 * @param {"allow"|"deny"} [permissions.policy="allow"] - What a call no rule decides gets.
 * @param {"on"|"strict"|"off"|"disabled"|boolean} [permissions.mode="on"] - `"on"` (the default for a `permissions` block): every rule
 *   applies. `"strict"`: as `"on"`, chosen in the config only (it cannot be left at runtime), and the instance refuses to
 *   start while a check of the permission baseline is not met (docs/PERMISSIONS.md). `"off"`: only the built-in rules that keep module code off the framework's own namespace, root
 *   functions, and keys on api nodes apply (as with no `permissions` config at all). `"disabled"`: nothing applies.
 *   `true` and `false` mean `"on"` and `"off"`.
 * @param {string|boolean} [permissions.audit="default"] - Audit level: `"default"` (denied + self-bypass only),
 *   `"verbose"` (all decisions). `true` and `false` are accepted and both normalize to `"default"`.
 * @param {object} [permissions.caller] - How the caller of a call or read is identified.
 * @param {boolean} [permissions.caller.anonymous=false] - When `false` (the default), calls and reads occurring inside an
 *   active context with no resolvable (or forged) caller identity fail closed (denied); only genuinely host-initiated
 *   calls are exempt. `true` lets them through.
 * @param {"precise"|"fast"} [permissions.caller.attribution="precise"] - How the definer of code a module hands out is
 *   known (#726). `"precise"` (the default) wraps a returned value that is itself code to record its definer; `"fast"`
 *   wraps nothing and tells every definer from the stack.
 * @param {boolean} [permissions.caller.capture=true] - When `true` (the default), a function read out of the api carries
 *   the identity of the module that read it, so it stays enforced as that module wherever it is later invoked.
 * @param {"leaf"|"chain"} [permissions.caller.ceiling="leaf"] - Code a caller hands to a leaf runs as the caller with the
 *   leaf as its ceiling (#597). With `"leaf"` (the default) that ceiling is the leaf the code is running inside;
 *   with `"chain"` it accumulates across every leaf the code was handed through, and all of them are enforced.
 * @param {boolean} [permissions.caller.provenance=true] - Code is told apart by where it was written: a module's function
 *   running inside another module's call, reached by a route slothlet does not see, runs as that module with the
 *   call as its ceiling (#597). `false` turns this off.
 * @param {object} [permissions.gating] - What is gated besides calls.
 * @param {boolean|number} [permissions.gating.buffers=false] - Whether a typed array or `Buffer` one module hands
 *   another is checked for members of its own under string keys. `false` never lists its keys, `true` always does,
 *   a whole number lists arrays of up to that many kilobytes.
 * @param {boolean} [permissions.gating.read=true] - When `true` (the default), reading a terminal data value off a module
 *   API path is permission-checked, the same way calls are.
 * @param {boolean} [permissions.owner=false] - When `true`, a caller leaf may access any target leaf currently owned by
 *   the same module, across directories, where the policy would otherwise deny. An explicit deny rule still wins (#509).
 * @param {Array<object>} [permissions.rules=[]] - Initial permission rules.
 * @param {object} [permissions.search] - How far a value handed into a call or returned out of one is searched for code.
 *   Set by the host only.
 * @param {number} [permissions.search.depth=4] - Levels of objects searched, the outermost counted: a whole number from
 *   1 to 64.
 * @param {number} [permissions.search.properties=512] - Own properties read, all values of one search counted together:
 *   a whole number from 1 to 65536.
 * @returns {object|null} Normalized permissions config, or null when permissions is absent or off by shorthand.
 * @public
 *
 * @example
 * normalizePermissionsConfig({ policy: "deny", rules: [{ caller: "**", target: "admin.**", effect: "deny" }] });
 * // => { policy: "deny", mode: "on", audit: "default", caller: { anonymous: false, ... }, gating: { buffers: false, read: true }, ... }
 */
export function normalizePermissionsConfig(permissions) {
	const expanded = expandPermissionsShorthand(permissions);
	if (!expanded.valid) {
		throw new SlothletError("INVALID_CONFIG", {
			option: "permissions",
			value: typeof permissions === "string" ? `"${permissions}"` : String(permissions),
			expected: 'an object, "on", "strict", "off", "disabled", or a boolean'
		});
	}
	permissions = expanded.value;
	if (!permissions || typeof permissions !== "object") {
		return null;
	}

	const policy = configChoice(permissions.policy, ["allow", "deny"], "allow", "permissions.policy", '"allow" or "deny"');

	// `true` and `false` are the boolean forms of "on" and "off".
	const rawMode = permissions.mode === true ? "on" : permissions.mode === false ? "off" : permissions.mode;
	const mode = configChoice(
		rawMode,
		["on", "strict", "off", "disabled"],
		"on",
		"permissions.mode",
		'"on", "strict", "off", "disabled" or a boolean'
	);

	// `true` and `false` normalize to "default" (denied + self-bypass events only; audit is never switched off).
	const rawAudit = permissions.audit === true || permissions.audit === false ? "default" : permissions.audit;
	const audit = configChoice(rawAudit, ["default", "verbose"], "default", "permissions.audit", '"default" or "verbose"');

	const owner = configChoice(permissions.owner, [true, false], false, "permissions.owner", "boolean");

	// How the caller of a call or read is identified.
	const callerGroup = configGroup(permissions.caller, "permissions.caller");
	const caller = {
		anonymous: configChoice(callerGroup.anonymous, [true, false], false, "permissions.caller.anonymous", "boolean"),
		attribution: configChoice(
			callerGroup.attribution,
			["precise", "fast"],
			"precise",
			"permissions.caller.attribution",
			'"precise" | "fast"'
		),
		capture: configChoice(callerGroup.capture, [true, false], true, "permissions.caller.capture", "boolean"),
		ceiling: configChoice(callerGroup.ceiling, ["leaf", "chain"], "leaf", "permissions.caller.ceiling", '"leaf" | "chain"'),
		provenance: configChoice(callerGroup.provenance, [true, false], true, "permissions.caller.provenance", "boolean")
	};

	// Every gating option. `buffers`: whether a typed array or `Buffer` one module hands another is checked for members of
	// its own under string keys (`bytes.item = …`), which means listing its keys; a whole number lists arrays of up to
	// that many kilobytes.
	const gatingGroup = configGroup(permissions.gating, "permissions.gating");
	const buffers = gatingGroup.buffers === undefined ? false : gatingGroup.buffers;
	if (typeof buffers !== "boolean" && !(Numbers.isSafeInteger(buffers) && buffers >= 0)) {
		throw new SlothletError("INVALID_CONFIG", {
			option: "permissions.gating.buffers",
			value: buffers,
			expected: "boolean | whole number of kilobytes"
		});
	}
	const gating = {
		buffers,
		read: configChoice(gatingGroup.read, [true, false], true, "permissions.gating.read", "boolean")
	};

	if (permissions.rules !== undefined && !Arrays.isArray(permissions.rules)) {
		throw new SlothletError("INVALID_CONFIG", { option: "permissions.rules", value: permissions.rules, expected: "array" });
	}
	const rules = Arrays.isArray(permissions.rules) ? permissions.rules : [];

	// Module privacy (#260). `host`: secure default deny, the privacy claim covers the host too unless deliberately
	// opened. `scope`: what a private member is private to, its owning module (default) or the folder that exports it.
	const privateGroup = configGroup(permissions.private, "permissions.private");
	const privacy = {
		host: configChoice(privateGroup.host, ["deny", "allow"], "deny", "permissions.private.host", '"deny" or "allow"'),
		scope: configChoice(privateGroup.scope, ["module", "folder"], "module", "permissions.private.scope", '"module" or "folder"')
	};

	// The event-rule section (#407): a three-level construct (deny/notify/allow), distinct from the binary call `rules`.
	// `policy` is the level applied when no event rule matches a subscriber/event pair (built-in: "notify", subscription
	// open and payload opt-in).
	const eventsGroup = configGroup(permissions.events, "permissions.events");
	const eventPolicy = configChoice(
		eventsGroup.policy,
		["deny", "notify", "allow"],
		"notify",
		"permissions.events.policy",
		'"deny", "notify", or "allow"'
	);
	if (eventsGroup.rules !== undefined && !Arrays.isArray(eventsGroup.rules)) {
		throw new SlothletError("INVALID_CONFIG", { option: "permissions.events.rules", value: eventsGroup.rules, expected: "array" });
	}
	const eventRules = Arrays.isArray(eventsGroup.rules) ? eventsGroup.rules : [];

	// How far a value handed into a call or returned out of one is searched for code (a leaf's function nested in an
	// argument, code nested in returned data). Host config only: an `api.add`'s `permissions` takes rules alone.
	const searchGroup = configGroup(permissions.search, "permissions.search");
	const search = {
		depth: configCount(searchGroup.depth, DEFAULT_SEARCH_DEPTH, 1, MAX_SEARCH_DEPTH, "permissions.search.depth"),
		properties: configCount(searchGroup.properties, DEFAULT_SEARCH_PROPERTIES, 1, MAX_SEARCH_PROPERTIES, "permissions.search.properties")
	};

	return {
		policy,
		mode,
		audit,
		owner,
		caller,
		gating,
		search,
		rules,
		private: privacy,
		events: { policy: eventPolicy, rules: eventRules }
	};
}

/**
 * Configuration normalization utilities
 * @class Config
 * @extends ComponentBase
 * @public
 */
export class Config extends ComponentBase {
	static slothletProperty = "config";

	/**
	 * Normalize collision configuration for handling property collisions
	 * @param {string|Object} collision - Collision mode or object with per-context modes
	 * @returns {Object} Normalized collision configuration with initial and api.slothlet.api.add modes
	 * @public
	 *
	 * @description
	 * Normalizes collision handling configuration for both initial load (buildAPI)
	 * and hot reload (api.add) contexts. Supports six collision modes:
	 * - "skip": Silently ignore collision, keep existing value
	 * - "warn": Warn about collision, keep existing value
	 * - "replace": Replace existing value completely
	 * - "merge": Merge properties (preserve original + add new)
	 * - "merge-replace": Merge properties (add new + overwrite existing with new values)
	 * - "error": Throw error on collision
	 *
	 * @example
	 * // String shorthand applies to both contexts
	 * normalizeCollision("merge")
	 * // => { initial: "merge", api: "merge" }
	 *
	 * @example
	 * // Object allows per-context control
	 * normalizeCollision({ initial: "warn", api: "error" })
	 * // => { initial: "warn", api: "error" }
	 */
	normalizeCollision(collision) {
		const validModes = ["skip", "warn", "replace", "merge", "merge-replace", "error"];
		const defaultMode = "merge";

		// String shorthand applies to both contexts
		if (typeof collision === "string") {
			const normalized = StringMethods.toLowerCase(collision);
			const mode = ArrayMethods.includes(validModes, normalized) ? normalized : defaultMode;
			return { initial: mode, api: mode };
		}

		// Object allows per-context control
		if (collision && typeof collision === "object") {
			const validateMode = (m) => {
				if (!m) return defaultMode;
				const normalized = StringMethods.toLowerCase(String(m));
				return ArrayMethods.includes(validModes, normalized) ? normalized : defaultMode;
			};
			return {
				initial: validateMode(collision.initial),
				api: validateMode(collision.api)
			};
		}

		// Default: merge for both contexts
		return { initial: defaultMode, api: defaultMode };
	}

	/**
	 * Normalize runtime input to internal standard format
	 * @param {string} runtime - Input runtime type (various formats accepted)
	 * @returns {string} Normalized runtime type ("async" or "live")
	 * @public
	 */
	normalizeRuntime(runtime) {
		if (!runtime || typeof runtime !== "string") {
			return "async"; // Default to AsyncLocalStorage
		}

		const normalized = StringMethods.trim(StringMethods.toLowerCase(runtime));

		// AsyncLocalStorage runtime variants
		if (normalized === "async" || normalized === "asynclocal" || normalized === "asynclocalstorage") {
			return "async";
		}

		// Live bindings runtime variants
		if (normalized === "live" || normalized === "livebindings" || normalized === "experimental") {
			return "live";
		}

		// Default to async for unknown values
		return "async";
	}

	/**
	 * Normalize mode input to internal standard format
	 * @param {string} mode - Input mode type (various formats accepted)
	 * @returns {string} Normalized mode type ("eager" or "lazy")
	 * @public
	 */
	normalizeMode(mode) {
		if (!mode || typeof mode !== "string") {
			return "eager"; // Default to eager
		}

		const normalized = StringMethods.trim(StringMethods.toLowerCase(mode));

		// Lazy mode variants
		if (normalized === "lazy" || normalized === "deferred" || normalized === "proxy") {
			return "lazy";
		}

		// Eager mode variants
		if (normalized === "eager" || normalized === "immediate" || normalized === "preload") {
			return "eager";
		}

		// Default to eager for unknown values
		return "eager";
	}

	/**
	 * Validate the `helpers` option: how often a helper file (a file an api file imports that is no api file itself)
	 * is loaded.
	 * @param {*} helpers - The option as given.
	 * @returns {"instance"|"module"} `"instance"` (the default: one copy per instance, shared by every api file
	 *   importing it) or `"module"` (one copy per importing api file).
	 * @throws {SlothletError} INVALID_CONFIG for any other value.
	 * @public
	 * @example
	 * config.normalizeHelpers(undefined); // "instance"
	 */
	normalizeHelpers(helpers) {
		if (helpers === undefined || helpers === null) return "instance";
		if (helpers !== "instance" && helpers !== "module") {
			throw new SlothletError("INVALID_CONFIG", { option: "helpers", value: String(helpers), expected: '"instance" | "module"' });
		}
		return helpers;
	}

	/**
	 * Normalize mutations configuration for API modification control
	 * @param {Object} mutations - Mutations config object with add/remove/reload properties
	 * @returns {Object} Normalized mutations configuration
	 * @public
	 *
	 * @description
	 * Normalizes mutation control configuration for API runtime modifications.
	 * Controls whether api.slothlet.api.add(), api.slothlet.api.remove(), and
	 * api.slothlet.reload() operations are allowed.
	 *
	 * @example
	 * // Allow all mutations (default)
	 * normalizeMutations({ add: true, remove: true, reload: true })
	 * // => { add: true, remove: true, reload: true }
	 *
	 * @example
	 * // Disable all mutations
	 * normalizeMutations({ add: false, remove: false, reload: false })
	 * // => { add: false, remove: false, reload: false }
	 */
	normalizeMutations(mutations) {
		const defaults = { add: true, remove: true, reload: true, permissions: true, events: true };

		// If mutations is not an object, use defaults
		if (!mutations || typeof mutations !== "object") {
			return defaults;
		}

		// Merge with defaults, ensuring boolean values
		return {
			add: mutations.add === false ? false : true,
			remove: mutations.remove === false ? false : true,
			reload: mutations.reload === false ? false : true,
			permissions: mutations.permissions === false ? false : true,
			// Gates the runtime event-rule mutation surface (api.slothlet.event.rules.*), mirroring
			// `permissions` for the call-rule surface (#407). Defaults to true.
			events: mutations.events === false ? false : true
		};
	}

	/**
	 * Normalize debug configuration
	 * @param {boolean|Object} debug - Debug flag or object with targeted flags
	 * @returns {Object} Normalized debug object with all flags
	 * @public
	 */
	normalizeDebug(debug) {
		if (!debug) {
			return {
				builder: false,
				api: false,
				index: false,
				modes: false,
				wrapper: false,
				ownership: false,
				context: false,
				initialization: false,
				materialize: false,
				versioning: false,
				permissions: false
			};
		}

		// If debug is a boolean true, enable all debug flags
		if (debug === true) {
			return {
				builder: true,
				api: true,
				index: true,
				modes: true,
				wrapper: true,
				ownership: true,
				context: true,
				initialization: true,
				materialize: true,
				versioning: true,
				permissions: true
			};
		}

		// If debug is an object, merge with defaults
		if (typeof debug === "object") {
			return {
				builder: debug.builder || false,
				api: debug.api || false,
				index: debug.index || false,
				modes: debug.modes || false,
				wrapper: debug.wrapper || false,
				ownership: debug.ownership || false,
				context: debug.context || false,
				initialization: debug.initialization || false,
				materialize: debug.materialize || false,
				versioning: debug.versioning || false,
				permissions: debug.permissions || false
			};
		}

		// Unknown type, default to all false
		return {
			builder: false,
			api: false,
			index: false,
			modes: false,
			wrapper: false,
			ownership: false,
			context: false,
			initialization: false,
			materialize: false,
			versioning: false,
			permissions: false
		};
	}

	/**
	 * Normalize execution-environment target from the raw `platform` config value.
	 *
	 * @description
	 * Distinct from `normalizeEnv()` which handles the `process.env` snapshot
	 * allowlist (`config.env`). This method determines *where* slothlet is executing
	 * so that filesystem-dependent code paths can be bypassed in browser/worker builds.
	 *
	 * When `platform` is omitted the method auto-detects by checking whether
	 * `process.versions.node` is available (true in Node.js; absent or undefined
	 * in browsers, web workers, and Electron renderers without nodeIntegration).
	 * Pass `"browser"` or `"node"` to override auto-detection for edge cases
	 * (e.g. Deno, Electron with custom process polyfills).
	 *
	 * @param {*} platform - Raw value of `config.platform` before normalisation.
	 * @returns {"browser"|"node"} Execution-environment target.
	 * @public
	 *
	 * @example
	 * normalizeEnvTarget("browser"); // => "browser" (explicit override)
	 * normalizeEnvTarget("node");    // => "node"    (explicit override)
	 * normalizeEnvTarget(undefined); // => "browser" or "node" (auto-detected)
	 */
	normalizeEnvTarget(platform, hasManifest = false) {
		if (platform === "browser") return "browser";
		if (platform === "node") return "node";
		// manifest presence is a strong browser-mode signal — treat it as browser
		// unless the caller explicitly passed platform: "node" (handled above).
		if (hasManifest) return "browser";
		// Auto-detect via the module-scope `IS_NODE` constant computed once at
		// module load. The false-arm of the ternary fires only in real browsers /
		// workers / Electron renderers; the Node-only vitest runner cannot exercise
		// it without stubbing the `process` global (which destabilizes vitest).
		return IS_NODE ? "node" : /* v8 ignore next */ "browser";
	}

	/**
	 * Normalize the `hook` config into a canonical `{ enabled, pattern, errors, pin }` object.
	 *
	 * Accepts the boolean form (enable/disable with the catch-all pattern), the string form
	 * (enable, restricting hooks to a global path pattern — e.g. `"database.*"`), or the full
	 * object form. Idempotent: an already-normalized object normalizes to an equivalent object,
	 * so `reload()` can re-feed it. Shared by {@link transformConfig} and the HookManager so both
	 * derive the same values regardless of construction order (the manager is built before
	 * transformConfig runs, so it cannot rely on the normalized config being in place yet).
	 *
	 * @param {boolean|string|Object} [hook] - Raw hook config in any supported form.
	 * @returns {{enabled: boolean, pattern: (string|null), errors: ("suppress"|false), pin: boolean}} Normalized hook config.
	 * @public
	 */
	normalizeHook(hook) {
		return normalizeHookConfig(hook);
	}

	/**
	 * Normalize the `api.collision` group: `{ mode, override }`, or a bare mode string as the shorthand for `{ mode }`.
	 * @param {string|{mode?: (string|{initial?: string, api?: string}), override?: boolean}} [collision] - The group as given.
	 * @returns {{mode: {initial: string, api: string}, override: boolean}} The normalized group.
	 * @throws {SlothletError} INVALID_CONFIG when it is neither a string nor an object, or `override` is not a boolean.
	 * @public
	 * @example
	 * config.normalizeApiCollision("warn"); // => { mode: { initial: "warn", api: "warn" }, override: false }
	 */
	normalizeApiCollision(collision) {
		const group = typeof collision === "string" ? { mode: collision } : configGroup(collision, "api.collision");
		return {
			mode: this.normalizeCollision(group.mode ?? null),
			override: configChoice(group.override, [true, false], false, "api.collision.override", "boolean")
		};
	}

	/**
	 * Normalize the `loader` group: how leaf files are found and loaded.
	 * @param {object} [loader] - The group as given.
	 * @param {Function} [loader.import] - Every leaf load goes through it: `(specifier) => Promise<module>`.
	 * @param {{files: Array, directories: Array}} [loader.files] - The browser file list (`files.generate()`); giving one
	 *   selects browser mode.
	 * @param {boolean|Function} [loader.materialize=false] - Lazy mode: materialize every path in the background after init.
	 *   A function turns it on and is called once everything has materialized (at once in eager mode, or when
	 *   materialization finished before the instance did).
	 * @param {"node"|"browser"} [loader.platform] - Where slothlet runs; auto-detected when omitted.
	 * @param {Function} [loader.resolve] - Browser: a file list entry to an importable URL.
	 * @returns {{import: (Function|null), files: (object|null), materialize: (boolean|Function), platform: ("node"|"browser"), resolve: (Function|null)}}
	 *   The normalized group.
	 * @throws {SlothletError} INVALID_CONFIG_IMPORTER_INVALID when `import` is given and is not a function.
	 * @throws {SlothletError} INVALID_CONFIG when `materialize` is not a boolean or a function.
	 * @public
	 * @example
	 * config.normalizeLoader({}); // => { import: null, files: null, materialize: false, platform: "node", resolve: null }
	 * config.normalizeLoader({ materialize: () => {} }).materialize; // => the function (materialization is on)
	 */
	normalizeLoader(loader) {
		const group = configGroup(loader, "loader");
		// Validate the injectable leaf importer (#235): a function or nothing.
		if (group.import !== undefined && group.import !== null && typeof group.import !== "function") {
			throw new this.SlothletError("INVALID_CONFIG_IMPORTER_INVALID", { received: typeof group.import });
		}
		const files = group.files ?? null;
		return {
			import: group.import ?? null,
			files,
			// true | false | a function: a function turns materialization on and is kept as given, so a reload feeding this
			// config back in keeps the callback.
			materialize:
				typeof group.materialize === "function"
					? group.materialize
					: configChoice(group.materialize, [true, false], false, "loader.materialize", "a boolean or a function"),
			// A file list is a strong browser-mode signal: it selects browser mode unless the platform is given.
			platform: this.normalizeEnvTarget(group.platform, files !== null),
			resolve: group.resolve ?? null
		};
	}

	/**
	 * Normalize the `routines` group (object form only).
	 * @param {object} [routines] - The group as given.
	 * @param {boolean} [routines.auto=true] - Startup/shutdown/destroy routines fire by themselves; `false` leaves them to explicit calls.
	 * @param {Array} [routines.entries] - The routines; see {@link Config#normalizeRoutines}. Omitted keeps the defaults.
	 * @param {boolean} [routines.stack=true] - Every module contributing the same routine name at one api path runs, in
	 *   mount order; `false` runs only the collision winner.
	 * @returns {{auto: boolean, entries: Array<object>, stack: boolean}} The normalized group.
	 * @throws {SlothletError} INVALID_CONFIG when it is not an object, or a member is invalid.
	 * @public
	 * @example
	 * config.normalizeRoutinesGroup({}).auto; // true
	 * config.normalizeRoutinesGroup({ auto: false }).auto; // false
	 */
	normalizeRoutinesGroup(routines) {
		if (Arrays.isArray(routines)) {
			throw new this.SlothletError("INVALID_CONFIG", {
				option: "routines",
				value: "array",
				expected: 'an object, e.g. { entries: ["initialize:startup", "shutdown:shutdown"] }'
			});
		}
		const group = configGroup(routines, "routines");
		return {
			auto: configChoice(group.auto, [true, false], true, "routines.auto", "boolean"),
			entries: this.normalizeRoutines(group.entries),
			// Independent of the collision mode entirely (#365): on (the default), every contributor at a shared path runs;
			// off, a module that lost a collision, under ANY collision mode, does not run through the routine system.
			stack: configChoice(group.stack, [true, false], true, "routines.stack", "boolean")
		};
	}

	/**
	 * Transform and validate configuration.
	 *
	 * The result has the shape of the option object (`slothlet({...})`) with every group filled in, so feeding it back in
	 * (a reload) gives the same result.
	 * @param {Object} config - Raw configuration options
	 * @returns {Object} Normalized configuration
	 * @throws {SlothletError} If configuration is invalid
	 * @public
	 */
	transformConfig(config = {}) {
		// Determine execution environment target before any filesystem operations.
		const loader = this.normalizeLoader(config.loader);
		const envTarget = loader.platform;

		// `base` is required in both modes: in node mode it is the API directory path; in browser mode it is the base URL
		// used to resolve module specifiers when no `loader.resolve` is given.
		// #471: no base at all (absent or null) is an instance whose tree is built entirely through
		// api.slothlet.api.add() — it composes an empty root, in node and browser mode alike. A base
		// that is present but falsy (e.g. "") is a mistake and still fails. A browser file list that
		// lists files describes a base tree, which cannot be resolved without a base, so it needs one.
		const rawBase = config.base;
		const noBase = rawBase === undefined || rawBase === null;
		const files = loader.files;
		const filesListEntries =
			files !== null &&
			typeof files === "object" &&
			((Arrays.isArray(files.files) && files.files.length > 0) || (Arrays.isArray(files.directories) && files.directories.length > 0));
		if ((!noBase && !rawBase) || (noBase && filesListEntries)) {
			throw new this.SlothletError("INVALID_CONFIG_BASE_MISSING", {});
		}

		// Browser-mode specific validation. With no base there is no base tree to describe, so the
		// file list is only required when a base is given.
		if (envTarget === "browser") {
			if (!noBase && (!files || typeof files !== "object" || Arrays.isArray(files))) {
				throw new this.SlothletError("INVALID_CONFIG_FILES_REQUIRED", {});
			}
			if (!noBase && (!Arrays.isArray(files.files) || !Arrays.isArray(files.directories))) {
				throw new this.SlothletError("INVALID_CONFIG_FILES_INVALID", {
					received: typeof files
				});
			}
			// loader.resolve is optional — if omitted (undefined) or normalized to null it defaults to new URL(path, base).
			// Only a provided NON-function value is rejected. Treating null like undefined keeps transformConfig
			// idempotent, so reload() — which re-feeds the already-normalized config — does not throw (#91).
			if (loader.resolve !== null && typeof loader.resolve !== "function") {
				throw new this.SlothletError("INVALID_CONFIG_RESOLVER_INVALID", { received: typeof loader.resolve });
			}
		}

		// Resolve relative paths from caller's context (node mode only).
		// In browser mode base is a URL string — pass it through as-is.
		const resolvedBase = noBase ? null : envTarget === "browser" ? rawBase : this.slothlet.helpers.resolver.resolvePathFromCaller(rawBase);

		// Process the api.* group.
		const apiConfig = configGroup(config.api, "api");
		const collision = this.normalizeApiCollision(apiConfig.collision);
		const mutations = this.normalizeMutations(apiConfig.mutations);

		// Validate scope.merge strategy if provided
		let scopeConfig = config.scope;
		if (scopeConfig && typeof scopeConfig === "object" && scopeConfig.merge) {
			const validMergeStrategies = ["shallow", "deep"];
			if (!ArrayMethods.includes(validMergeStrategies, scopeConfig.merge)) {
				throw new this.SlothletError("INVALID_CONFIG", {
					option: "scope.merge",
					value: scopeConfig.merge,
					expected: ArrayMethods.join(validMergeStrategies, " or ")
				});
			}
		}

		// Parse hook configuration — shared with the HookManager.
		const hookConfig = this.normalizeHook(config.hook);

		// Validate the versioning group's dispatcher: a version metadata key, a function, or nothing.
		const versioningGroup = configGroup(config.versioning, "versioning");
		const dispatcher = versioningGroup.dispatcher ?? null;
		if (dispatcher !== null && typeof dispatcher !== "string" && typeof dispatcher !== "function") {
			throw new this.SlothletError("VERSION_DISPATCHER_INVALID", { received: typeof dispatcher });
		}

		// Normalize permissions configuration
		const permissionsConfig = this.normalizePermissions(config.permissions);

		// Parse i18n configuration (dev-facing; process-global)
		let i18nConfig = null;
		if (config.i18n && typeof config.i18n === "object") {
			i18nConfig = {
				language: typeof config.i18n.language === "string" ? config.i18n.language : undefined
			};
		}

		// Normalize + validate the construction-time lifecycle subscription map (#148).
		const lifecycleConfig = this.normalizeLifecycle(config.lifecycle);

		// Build normalized config. It is marked as slothlet's own, so a reload can feed it back in unchecked.
		return markNormalized({
			...config,
			base: resolvedBase,
			loader,
			mode: this.normalizeMode(config.mode),
			runtime: this.normalizeRuntime(config.runtime),
			helpers: this.normalizeHelpers(config.helpers),
			depth: config.depth !== undefined ? config.depth : DEFAULT_API_DEPTH,
			reference: config.reference || null,
			context: config.context || null,
			i18n: i18nConfig,
			lifecycle: lifecycleConfig,
			routines: this.normalizeRoutinesGroup(config.routines),
			debug: this.normalizeDebug(config.debug),
			diagnostics: config.diagnostics === true,
			hook: hookConfig,
			api: {
				collision,
				mutations
			},
			scope: scopeConfig,
			silent: config.silent === true,
			typescript: this.normalizeTypeScript(config.typescript),
			env: this.normalizeEnv(config.env),
			versioning: { dispatcher },
			permissions: permissionsConfig
		});
	}

	/**
	 * Normalize TypeScript configuration
	 * @param {boolean|string|Object} typescript - TypeScript config (true, "fast", or { mode: "fast"|"strict", ... })
	 * @returns {Object|null} Normalized TypeScript configuration or null if disabled
	 * @public
	 */
	normalizeTypeScript(typescript) {
		// Disabled by default
		if (!typescript) {
			return null;
		}

		// Boolean true defaults to fast mode
		if (typescript === true) {
			return { enabled: true, mode: "fast" };
		}

		// String "fast" or "strict"
		if (typeof typescript === "string") {
			const mode = StringMethods.toLowerCase(typescript);
			if (mode === "fast" || mode === "strict") {
				return { enabled: true, mode };
			}
			// Unknown string defaults to fast
			return { enabled: true, mode: "fast" };
		}

		// Object configuration
		if (typeof typescript === "object") {
			const mode = typescript.mode === "strict" ? "strict" : "fast";
			this.#validateTypeScriptOption("target", typescript.target, "string", 'a string such as "es2020"');
			this.#validateTypeScriptOption("sourcemap", typescript.sourcemap, "boolean", "a boolean");
			this.#validateTypeScriptOption("module", typescript.module, "string", 'a string such as "esnext"');
			this.#validateTypeScriptOption("strict", typescript.strict, "boolean", "a boolean");
			this.#validateTypeScriptOption("compiler", typescript.compiler, "plain-object", "a plain object of tsconfig.json compilerOptions");
			return {
				enabled: true,
				mode,
				types: typescript.types || null,
				target: typescript.target || "es2020",
				// null = not set: the loader turns source maps on during a coverage run (#484).
				sourcemap: typescript.sourcemap ?? null,
				module: typescript.module ?? null,
				strict: typescript.strict ?? null,
				compiler: typescript.compiler ?? null
			};
		}

		// Unknown type, disable
		return null;
	}

	/**
	 * Validate the type of one `typescript` object-form option. `undefined` and `null` mean
	 * "not set" and always pass.
	 * @param {string} name - Option name under `typescript` (e.g. `"strict"`).
	 * @param {unknown} value - The raw option value.
	 * @param {"string"|"boolean"|"plain-object"} kind - Required kind of value.
	 * @param {string} expected - Human-readable description of the accepted values.
	 * @returns {void}
	 * @throws {SlothletError} INVALID_CONFIG when the value is set and is not of the required kind.
	 * @private
	 */
	#validateTypeScriptOption(name, value, kind, expected) {
		if (value === undefined || value === null) return;
		let valid;
		if (kind === "plain-object") {
			const proto = typeof value === "object" ? Objects.getPrototypeOf(value) : undefined;
			valid = typeof value === "object" && (proto === Objects.prototype || proto === null);
		} else {
			valid = typeof value === kind;
		}
		if (valid) return;
		throw new this.SlothletError("INVALID_CONFIG", {
			option: `typescript.${name}`,
			value: Arrays.isArray(value) ? "array" : typeof value === "object" ? (value.constructor?.name ?? "object") : typeof value,
			expected
		});
	}

	/**
	 * Normalize env snapshot configuration.
	 *
	 * @description
	 * Validates the `env` option from user config. When `include` is a non-empty
	 * string array, returns `{ include }` (the allowlist used by `_captureEnvSnapshot`).
	 * Any other value — including `undefined`, `null`, `{}`, or an empty `include`
	 * array — is normalised to `null`, meaning the full `process.env` snapshot is used.
	 *
	 * @param {Object|null|undefined} env - Raw env option from user config.
	 * @param {string[]} [env.include] - Allowlist of env variable names to capture.
	 * @returns {{ include: string[] }|null} Normalized env config, or `null` for full snapshot.
	 * @public
	 *
	 * @example
	 * // No restriction — full snapshot
	 * normalizeEnv(undefined); // => null
	 * normalizeEnv(null);      // => null
	 * normalizeEnv({});        // => null
	 *
	 * @example
	 * // Include allowlist
	 * normalizeEnv({ include: ["NODE_ENV", "PORT"] });
	 * // => { include: ["NODE_ENV", "PORT"] }
	 *
	 * @example
	 * // Non-string keys in the include array are filtered out
	 * normalizeEnv({ include: ["NODE_ENV", 42, null] });
	 * // => { include: ["NODE_ENV"] }
	 */
	normalizeEnv(env) {
		if (!env || typeof env !== "object") {
			return null; // No restriction — full snapshot
		}
		const include = Arrays.isArray(env.include) ? filterList(env.include, (k) => typeof k === "string") : null;
		if (include && include.length > 0) {
			return { include };
		}
		return null; // Empty or invalid include — treat as no restriction
	}

	/**
	 * Normalize + validate the construction-time `lifecycle` subscription map (#148).
	 *
	 * @description
	 * The `lifecycle` option registers event handlers on the Lifecycle emitter BEFORE the api builds,
	 * so events emitted during cold-start `buildAPI` (init-time `impl:warning` / `impl:created` / …)
	 * are observable. It is a plain object mapping an event name to a handler function or an array of
	 * handler functions. Any event name is accepted — registration is just early `subscribe()` calls,
	 * so these handlers also receive runtime events afterward.
	 *
	 * Idempotent: an already-normalized map (values already functions / arrays of functions) passes
	 * through unchanged, so `reload()` can re-feed it.
	 *
	 * @param {object|null|undefined} lifecycle - Raw `lifecycle` option from user config.
	 * @returns {object|null} The validated map, or `null` when absent.
	 * @throws {SlothletError} INVALID_CONFIG when the shape is not a plain object of functions / function arrays.
	 * @public
	 *
	 * @example
	 * normalizeLifecycle({ "impl:warning": (data) => log(data) });
	 * // => { "impl:warning": (data) => log(data) }
	 *
	 * @example
	 * normalizeLifecycle({ "impl:error": [onError, auditError] });
	 * // => { "impl:error": [onError, auditError] }
	 */
	normalizeLifecycle(lifecycle) {
		if (lifecycle === undefined || lifecycle === null) {
			return null;
		}
		if (typeof lifecycle !== "object" || Arrays.isArray(lifecycle)) {
			throw new this.SlothletError("INVALID_CONFIG", {
				option: "lifecycle",
				value: Arrays.isArray(lifecycle) ? "array" : typeof lifecycle,
				expected: "a plain object mapping event names to functions or arrays of functions"
			});
		}
		// Reject class instances (Date, Map, RegExp, custom classes, …): only a plain object
		// literal or Object.create(null) map is a valid lifecycle shape. A class instance often
		// has zero enumerable own properties, so the per-entry loop below would silently pass it
		// through unvalidated instead of rejecting the malformed config.
		const lifecycleProto = Objects.getPrototypeOf(lifecycle);
		if (lifecycleProto !== null && lifecycleProto !== Objects.prototype) {
			throw new this.SlothletError("INVALID_CONFIG", {
				option: "lifecycle",
				value: lifecycle?.constructor?.name ? `${lifecycle.constructor.name} instance` : "non-plain object",
				expected: "a plain object mapping event names to functions or arrays of functions"
			});
		}
		for (let ofIndex = 0, ofList = Objects.entries(lifecycle); ofIndex < ofList.length; ofIndex++) {
			const ofEntry = ofList[ofIndex],
				event = ofEntry[0],
				handler = ofEntry[1];
			const handlers = Arrays.isArray(handler) ? handler : [handler];
			for (let ofIndex = 0, ofList = handlers; ofIndex < ofList.length; ofIndex++) {
				const fn = ofList[ofIndex];
				if (typeof fn !== "function") {
					throw new this.SlothletError("INVALID_CONFIG", {
						option: `lifecycle["${event}"]`,
						value: typeof fn,
						expected: "a function or an array of functions"
					});
				}
			}
		}
		return lifecycle;
	}

	/**
	 * Normalize + validate the `routines` config option (#341).
	 *
	 * @description
	 * A routine is a named cross-module runnable: every mounted module that exports a function
	 * matching a configured routine name gets stacked into one chain at its resolved api path, and
	 * a root cascade runs every matching contribution anywhere, ordered per the entry's `order`.
	 * See `docs/LIFECYCLE.md` ("Routines") for the full contract.
	 *
	 * Each entry normalizes to `{ name, mode, recursive, order, cascade }` — `recursive`, `order` and
	 * `cascade` are always present on the normalized output, even when the raw entry omitted them:
	 * - `"name"` (string, no `:`) → `{ name, mode: "manual", recursive: false, order: "mount", cascade: true }`.
	 * - `"name:mode"` (string, split once on the first `:`) → `{ name, mode, recursive: false, order: <mode-defaulted>, cascade: true }`.
	 * - `{ name, mode?, recursive?, order?, cascade? }` (object) → `mode` defaults to `"manual"`, `recursive`
	 *   to `false`, `order` to {@link DEFAULT_ROUTINE_ORDER_BY_MODE}`[mode]`, and `cascade` to `true` when each
	 *   is omitted. `cascade: false` (#400) suppresses the root `api.<name>()` run-all cascade for that routine.
	 *
	 * Providing `routines` at all REPLACES {@link DEFAULT_ROUTINES} — that is the off-switch
	 * (`routines: []` disables every routine). Omitting the option keeps the built-in defaults.
	 * `slothlet.defaults.routines` is the frozen source of those defaults, exported for a consumer
	 * to spread (extend) or filter (drop one) rather than replace wholesale.
	 *
	 * Idempotent: an already-normalized list (every entry already `{ name, mode, recursive, order }`)
	 * normalizes to an equivalent list — same values, always freshly-built objects (never the same
	 * references) — so `reload()` can safely re-feed it.
	 *
	 * @param {undefined|null|Array<string|{name: string, mode?: string, recursive?: boolean, order?: string, cascade?: boolean}>} routines - Raw `routines` option.
	 * @returns {Array<{name: string, mode: "manual"|"startup"|"shutdown"|"destroy", recursive: boolean, order: "mount"|"depth", cascade: boolean}>} Normalized routines list.
	 * @throws {SlothletError} INVALID_CONFIG when the shape is invalid, a name is empty/reserved/an invalid glob, or a mode/order is unrecognized.
	 * @public
	 *
	 * @example
	 * normalizeRoutines(undefined);
	 * // => [{ name: "initialize", mode: "startup", recursive: false, order: "mount" },
	 * //     { name: "shutdown", mode: "shutdown", recursive: false, order: "depth" }]
	 *
	 * @example
	 * normalizeRoutines(["launch", "prefetch:startup", { name: "warmup" }]);
	 * // => [{ name: "launch", mode: "manual", recursive: false, order: "mount" },
	 * //     { name: "prefetch", mode: "startup", recursive: false, order: "mount" },
	 * //     { name: "warmup", mode: "manual", recursive: false, order: "mount" }]
	 *
	 * @example
	 * normalizeRoutines([]);
	 * // => [] — disables every routine
	 */
	normalizeRoutines(routines) {
		if (routines === undefined) {
			// Clone the frozen defaults' entries into fresh plain objects: the normalized config
			// value must stay independently mutable-shaped (an ordinary array of ordinary objects),
			// never the frozen singleton itself.
			return mapList(DEFAULT_ROUTINES, (entry) => ({
				name: entry.name,
				mode: entry.mode,
				recursive: entry.recursive ?? false,
				order: entry.order ?? DEFAULT_ROUTINE_ORDER_BY_MODE[entry.mode],
				cascade: entry.cascade ?? true
			}));
		}
		if (routines === null) {
			return [];
		}
		if (!Arrays.isArray(routines)) {
			throw new this.SlothletError("INVALID_CONFIG", {
				option: "routines",
				value: typeof routines,
				expected: 'an array of routine names/objects, e.g. ["initialize", "shutdown:shutdown", { name: "warmup" }]'
			});
		}

		return mapList(routines, (entry, index) => {
			let name;
			let mode;

			if (typeof entry === "string") {
				const sepIndex = StringMethods.indexOf(entry, ":");
				if (sepIndex === -1) {
					name = entry;
					mode = "manual";
				} else {
					name = StringMethods.slice(entry, 0, sepIndex);
					mode = StringMethods.slice(entry, sepIndex + 1);
				}
			} else if (entry && typeof entry === "object" && !Arrays.isArray(entry)) {
				name = entry.name;
				mode = entry.mode ?? "manual";
			} else {
				throw new this.SlothletError("INVALID_CONFIG", {
					option: `routines[${index}]`,
					value: Arrays.isArray(entry) ? "array" : typeof entry,
					expected: 'a string ("name" or "name:mode") or an object ({ name, mode? })'
				});
			}

			if (typeof name !== "string" || name.length === 0) {
				throw new this.SlothletError("INVALID_CONFIG", {
					option: `routines[${index}].name`,
					value: typeof name,
					expected: "a non-empty string"
				});
			}
			if (SetMethods.has(ROUTINE_NAME_RESERVED, name)) {
				throw new this.SlothletError("INVALID_CONFIG", {
					option: `routines[${index}].name`,
					value: name,
					expected: `a name other than the reserved: ${ArrayMethods.join(setToArray(ROUTINE_NAME_RESERVED), ", ")}`
				});
			}
			if (!SetMethods.has(VALID_ROUTINE_MODES, mode)) {
				throw new this.SlothletError("INVALID_CONFIG", {
					option: `routines[${index}].mode`,
					value: String(mode),
					expected: `one of: ${ArrayMethods.join(setToArray(VALID_ROUTINE_MODES), ", ")}`
				});
			}

			// `recursive` is only settable via the object form — the string shorthands ("name",
			// "name:mode") always mean recursive: false (the default).
			const recursive = typeof entry === "object" ? (entry.recursive ?? false) : false;
			if (typeof recursive !== "boolean") {
				throw new this.SlothletError("INVALID_CONFIG", {
					option: `routines[${index}].recursive`,
					value: typeof recursive,
					expected: "a boolean"
				});
			}

			// Validate the pattern compiles now — never at first cascade/rebuild — so a malformed
			// glob (root-anchored or not) fails fast at construction instead of silently matching
			// nothing forever. `^` marks a root-anchored pattern (see docs/LIFECYCLE.md — "Routines");
			// the compiler itself never sees the `^`.
			const pattern = StringMethods.startsWith(name, "^") ? StringMethods.slice(name, 1) : name;
			if (pattern.length === 0) {
				// A bare "^" with nothing after it: compilePattern("") compiles fine (as `^$`) but then
				// matches no real api path ever, silently — the exact "malformed glob" this validation
				// exists to catch, just one compilePattern's own try/catch can't see since it never throws.
				throw new this.SlothletError("INVALID_CONFIG", {
					option: `routines[${index}].name`,
					value: name,
					expected: 'a root-anchored name with a pattern after the `^` (a bare "^" matches nothing)'
				});
			}
			try {
				compilePattern(pattern);
			} catch (error) {
				// INVALID_CONFIG is a shared, generic code with no {error}/{reason} placeholder of its
				// own, so the compile failure's message is folded into the existing {expected} field.
				throw new this.SlothletError("INVALID_CONFIG", {
					option: `routines[${index}].name`,
					value: name,
					expected: `a name that compiles as a valid glob pattern (see helpers/pattern-matcher.mjs): ${error.message}`
				});
			}

			// `order` is only settable via the object form. Default depends on mode: "depth"
			// (deepest-first) for shutdown/destroy, "mount" (registration order) for startup/manual.
			const order = typeof entry === "object" && entry.order !== undefined ? entry.order : DEFAULT_ROUTINE_ORDER_BY_MODE[mode];
			if (!SetMethods.has(VALID_ROUTINE_ORDERS, order)) {
				throw new this.SlothletError("INVALID_CONFIG", {
					option: `routines[${index}].order`,
					value: String(order),
					expected: `one of: ${ArrayMethods.join(setToArray(VALID_ROUTINE_ORDERS), ", ")}`
				});
			}

			// `cascade` is only settable via the object form (like `recursive`/`order`); it defaults to
			// `true` — every routine gets a root `api.<name>()` run-all cascade. Set `false` (#400) to
			// suppress that root cascade for a per-entity lifecycle routine, where a single co-owner must
			// be invoked by key via `api.<path>.<name>.for(moduleID)(...)` rather than a run-all.
			const cascade = typeof entry === "object" && entry.cascade !== undefined ? entry.cascade : true;
			if (typeof cascade !== "boolean") {
				throw new this.SlothletError("INVALID_CONFIG", {
					option: `routines[${index}].cascade`,
					value: typeof cascade,
					expected: "a boolean"
				});
			}

			return { name, mode, recursive, order, cascade };
		});
	}

	/**
	 * Normalize permissions configuration: see {@link normalizePermissionsConfig}.
	 *
	 * @param {object|string|boolean|null} [permissions] - Raw permissions config from user.
	 * @returns {object|null} Normalized permissions config, or null when permissions is absent or not an object.
	 * @example
	 * config.normalizePermissions("disabled"); // => { mode: "disabled", enabled: false, ... }
	 */
	normalizePermissions(permissions) {
		return normalizePermissionsConfig(permissions);
	}
}
