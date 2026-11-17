/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/permission-manager.mjs
 *	@Date: 2026-04-14T16:47:31-07:00 (1776210451)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:47-08:00 (1794882527)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Permission manager for API path access control.
 * Enforces caller→target access rules using glob pattern matching.
 * Integrated into UnifiedWrapper.applyTrap for enforcement.
 *
 * @module @cldmv/slothlet/handlers/permission-manager
 * @internal
 */

import { fileParts, util } from "#helpers/platform";
import { ComponentBase } from "#factories/component-base";
import { compilePattern, expandBraces } from "#helpers/pattern-matcher";
import { namesSlothletMember } from "#helpers/slothlet-tree";
import { translate } from "#i18n";
import { MODULE_ID_SEPARATOR } from "#handlers/metadata";
import { DEFAULT_ROUTINES } from "#helpers/defaults";
import { runBaseline } from "#helpers/permission-baseline";
import { assertOptionKeys } from "#helpers/config-schema";
import { isFrameworkWriteTarget, writeTargetLiteralPrefix, internals as reservedKeysInternals } from "#helpers/reserved-keys";
import { internals as unifiedWrapperInternals } from "#handlers/unified-wrapper";
import { internals as frameworkInternalsInternals } from "#handlers/framework-internals";
import {
	ArrayMethods,
	Arrays,
	Boolean,
	concatLists,
	copyList,
	filterList,
	FunctionMethods,
	listPush,
	Map,
	mapEntries,
	mapList,
	MapMethods,
	mapValues,
	NativeProxy,
	Numbers,
	Objects,
	promiseAll,
	PromiseMethods,
	Promises,
	Reflect,
	RegExpMethods,
	Set,
	setFrom,
	SetMethods,
	setToArray,
	setValues,
	splitText,
	String,
	StringMethods,
	Symbol,
	WeakMap,
	WeakMapMethods
} from "#helpers/intrinsics";
const reservedKeysOwn = reservedKeysInternals("lib/handlers/permission-manager");
const { runtime_selfModuleCeilings, runtime_selfModuleReader } = unifiedWrapperInternals("lib/handlers/permission-manager");
const { markSlothletProxy } = frameworkInternalsInternals("lib/handlers/permission-manager");

/**
 * Cache size above which a principal with a `ttl` sweeps its expired identities on the next
 * resolve (#459), so a long-lived process serving many identities does not grow without bound.
 * @type {number}
 */
const PRINCIPAL_PRUNE_THRESHOLD = 1024;

/**
 * Hook types that may appear as a permission-target suffix in the `pattern:type` form.
 * `hook` is the "any type" wildcard. Mirrors HookManager's registrable types so a hook and the
 * rule that gates it read identically (e.g. `hook.on("db.*:error")` ↔ `target: "db.*:error"`).
 * @type {Set<string>}
 */
const HOOK_TARGET_TYPES = setFrom(["before", "after", "always", "error", "around", "hook"]);

/**
 * Suffix that makes a rule target a write target (#625): `pattern:write` gates a module assigning, defining,
 * or deleting a member at a matching api path, or changing the prototype or extensibility of the node there.
 * @type {string}
 * @private
 */
const WRITE_TARGET_SUFFIX = ":write";

/**
 * The prefix of a rule target naming one of the built-in capabilities module code is refused by default while the
 * permission system is on (`capability:code`, …): see {@link CAPABILITIES}.
 * @type {string}
 */
const CAPABILITY_PREFIX = "capability:";

/**
 * The built-in capabilities, in the order they are reported: what each covers is listed in PERMISSIONS.md.
 * - `code`: turning a string into code (the function constructors, a string timer, `vm`, `Module#_compile`, Node's
 *   `contextify` binding);
 * - `imports`: importing a `data:` or `blob:` URL;
 * - `loader`: registering module hooks (`module.registerHooks()`, `module.register()`).
 * @type {ReadonlyArray<string>}
 */
const CAPABILITIES = Objects.freeze(["code", "imports", "loader"]);

/**
 * Why a capability is refused, by the `reasonCode` a refusal carries: the translation key of each reason.
 * @type {Readonly<Record<string, string>>}
 */
const CAPABILITY_REASONS = Objects.freeze({
	"not-opened": "PERMISSION_CAPABILITY_REASON_NOT_OPENED",
	unattributed: "PERMISSION_CAPABILITY_REASON_UNATTRIBUTED",
	"foreign-filename": "PERMISSION_CAPABILITY_REASON_FOREIGN_FILENAME",
	binding: "PERMISSION_CAPABILITY_REASON_BINDING"
});

/**
 * The global metadata setter, the host's unless an allow lifts the built-in deny for a module (#625).
 * @type {string}
 */
const GLOBAL_METADATA_TARGET = "slothlet.metadata.global";

/**
 * Precedence layers used to break ties when two matching rules have EQUAL specificity.
 * Most-specific-wins is always the primary rule (a pattern's kind, then its literal segments); only among
 * equally-specific rules does the higher layer win, so the composing host (instance config / gated runtime) overrides a module's
 * manifest, which overrides the framework built-in default. Within a single layer, last-registered
 * wins. Higher number = higher precedence.
 *
 * This applies uniformly to call rules, hook-target rules, and event rules (#407) — a broad host
 * "lock it down" rule and a module's own narrower "open my events" rule resolve by specificity, and
 * an equally-specific host rule always overrides the module's.
 * @type {Readonly<Record<string, number>>}
 */
/**
 * The data fields of a permission rule, the only ones a registered rule keeps ({@link PermissionManager#snapshotRule}).
 * @type {ReadonlyArray<string>}
 * @private
 */
const RULE_FIELDS = Objects.freeze(["caller", "target", "effect", "condition", "requires"]);

/**
 * The pin a module's function condition carries (#625): `{ moduleID, live }`, the registering module's base id, and
 * whether that module is still there. Its removal revokes the pin, so a condition held after it is gone never runs —
 * not even when another module later takes the freed id, whose standing it would otherwise reach.
 */
const CONDITION_PIN = Symbol("slothlet.permissions.conditionPin");

/** The data fields of an event rule (#407), read once when it is registered (#625). */
const EVENT_RULE_FIELDS = Objects.freeze(["caller", "event", "effect", "condition"]);

const RULE_LAYER_RANK = Objects.freeze({ builtin: 0, manifest: 1, module: 1, manager: 1, instance: 2, runtime: 3 });

/**
 * Enforcement options for the call-gate query {@link PermissionManager#checkCall} (#508): the supplied
 * caller is a module (never the host), the audit payload names the query as its origin, and — as for a
 * promoted call whose stale-principal scan has just run — principals count as current under grace.
 * @type {Readonly<{ moduleCaller: true, via: ReadonlyArray<string>, principalGrace: true }>}
 * @private
 */
const CHECK_CALL_OPTIONS = Objects.freeze({
	moduleCaller: true,
	via: Objects.freeze(["slothlet", "permissions", "global", "check", "call"]),
	principalGrace: true
});

/**
 * Resolve a rule's precedence layer from an explicit layer or the owning module id.
 * @param {string|null} layer - Explicit layer ("builtin"|"manifest"|"instance"|"runtime"), or null to derive.
 * @param {string|null} ownerModuleID - Owning module id; "__builtin__" marks a framework rule.
 * @returns {string} The resolved layer name.
 * @internal
 */
function resolveRuleLayer(layer, ownerModuleID) {
	if (layer && FunctionMethods.call(Objects.prototype.hasOwnProperty, RULE_LAYER_RANK, layer)) return layer;
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
	const cut = StringMethods.lastIndexOf(targetPath, ".");
	if (cut < 0) return false;
	return StringMethods.charCodeAt(targetPath, cut + 1) === 95; // "_"
}

/**
 * Framework-reserved api roots (#509). The composed tree registers them to the base module, but they
 * are framework surface rather than module code, so the owner grant never covers them.
 * @type {ReadonlySet<string>}
 * @internal
 */
const FRAMEWORK_ROOTS = Objects.freeze(setFrom(["slothlet", "shutdown", "destroy"]));

/**
 * The framework's own keys on api nodes the built-in write rules keep from module code.
 * @type {ReadonlySet<string>}
 * @private
 */
const FRAMEWORK_WRITE_KEYS = setFrom([...reservedKeysOwn.WRAPPER_INTERNAL_KEYS, ...reservedKeysOwn.IMPL_METADATA_KEYS]);

/**
 * Whether two source files share a folder, the module a private member belongs to under
 * `permissions.private.scope: "folder"` (#260).
 *
 * @param {string} callerFilePath - Absolute path of the caller's source file.
 * @param {string} targetFilePath - Absolute path of the target's source file.
 * @returns {boolean} True when both files live in the same directory.
 * @internal
 *
 * @description
 * Under the `"folder"` scope a module is a directory of files: the api path is lossy in both
 * directions, but enforcement receives both real file paths, and folder equality needs no
 * assigned identity, no cache-key change, and no mode-dependent normalization. A subdirectory is
 * its own module. The folders come from `fileParts`, so a browser, where both files are URLs,
 * compares them the same way. The default `"module"` scope compares owning module IDs instead.
 */
function runtime_sameModuleDir(callerFilePath, targetFilePath) {
	return fileParts(callerFilePath).dir === fileParts(targetFilePath).dir;
}

/**
 * Call/construct metadata threaded into a function condition's second argument so a rule can
 * authorize on the resource named in the call itself, not just ambient context (#455).
 *
 * Provided only at the call and construct enforcement gates — where the invocation's arguments
 * exist — and by the call-gate query {@link PermissionManager#checkCall} (#508), which is handed the
 * arguments it should evaluate against. Read gating, hook gating, event delivery, the internal
 * `slothlet.*` control surface, and silent queries evaluate conditions with `callMeta === null`, so a
 * function condition that reads `callMeta.args` must guard for its absence (or the rule must only
 * match targets that always gate at a call/construct site).
 *
 * @typedef {object} PermissionCallMeta
 * @property {Array<*>|null} args - Arguments the target leaf was called/constructed with, or null.
 * @property {string|null} target - Concrete (post-glob) target api path of the gated call.
 */

/**
 * Whether a principal's cached value is still inside its `ttl`, given how long ago it was resolved on the
 * instance's clock. A clock that went backwards (a negative age) or answered something that is not a number is not
 * evidence the value is fresh, so it is not current: it fails closed.
 *
 * @param {number} age - Milliseconds since the value was resolved.
 * @param {number} ttl - The principal's `ttl`.
 * @returns {boolean} True when the value is current.
 * @private
 */
function runtime_withinTtl(age, ttl) {
	return typeof age === "number" && age >= 0 && age <= ttl;
}

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
	if (Arrays.isArray(value)) return true;
	const proto = Objects.getPrototypeOf(value);
	return proto === Objects.prototype || proto === null;
}

/**
 * The module ids an ownership decision is taken for. Code a caller supplied to another module's call acts for
 * both modules (#597), and an ownership decision has to hold for each of them: a single id, or a list of them.
 *
 * @param {string|string[]|null} moduleIDs - One id, several, or `null` for the host.
 * @returns {string[]} The ids; empty for the host.
 * @private
 */
function runtime_moduleIDList(moduleIDs) {
	if (moduleIDs === null || moduleIDs === undefined) return [];
	return Arrays.isArray(moduleIDs) ? filterList(moduleIDs, (id) => id !== null && id !== undefined) : [moduleIDs];
}

/**
 * No paths: the answer when no rule names a path above a target exactly.
 * @type {ReadonlyArray<string>}
 * @private
 */
const NO_PREFIXES = Objects.freeze([]);

/**
 * How many paths the per-epoch records of exact deny rules above a path keep before starting over.
 * @type {number}
 * @private
 */
const PREFIX_CACHE_LIMIT = 1024;

/**
 * The matcher of one segment of a write pattern, kept per segment.
 * @type {Map<string, function(string): boolean>}
 * @private
 */
const SEGMENT_MATCHERS = new Map();

/**
 * Whether one segment of a write pattern matches a path segment.
 * @param {string} segment - The pattern's segment (`*`, `?`, `!(a|b)` and literals).
 * @param {string} name - The path's segment.
 * @returns {boolean} Whether it matches.
 * @private
 */
function runtime_segmentMatches(segment, name) {
	let matcher = MapMethods.get(SEGMENT_MATCHERS, segment);
	if (!matcher) MapMethods.set(SEGMENT_MATCHERS, segment, (matcher = compilePattern(segment)));
	return matcher(name);
}

/**
 * Whether a write pattern can match the path `target` or one beneath it (#667). It answers for what a pattern could
 * reach, so it errs toward yes: a segment holding `**` stands for any number of segments, and a pattern negated whole
 * (`!pattern`) reaches everything.
 * @param {string} pattern - The write pattern, without `:write`.
 * @param {string[]} target - The path's segments.
 * @param {boolean} [beneath=false] - Whether only a path strictly beneath `target` counts.
 * @returns {boolean} Whether it can.
 * @private
 * @example
 * runtime_patternReaches("owner.Foo.prototype.hi", ["owner", "Foo", "prototype"]); // true
 * runtime_patternReaches("owner.Foo.prototype", ["owner", "Foo", "prototype"], true); // false
 */
function runtime_patternReaches(pattern, target, beneath = false) {
	if (StringMethods.startsWith(pattern, "!") && !StringMethods.startsWith(pattern, "!(")) return true;
	for (let ofIndex = 0, ofList = expandBraces(pattern); ofIndex < ofList.length; ofIndex++) {
		const alternative = ofList[ofIndex];
		const segments = splitText(alternative, ".");
		const seen = new Set();
		const reaches = (i, j) => {
			// The whole path matched: what is left of the pattern matches the path itself, or something beneath it.
			if (j === target.length) return !beneath || i < segments.length;
			if (i === segments.length) return false;
			const key = i * (target.length + 1) + j;
			if (SetMethods.has(seen, key)) return false;
			SetMethods.add(seen, key);
			if (StringMethods.includes(segments[i], "**")) return reaches(i + 1, j) || reaches(i, j + 1);
			return runtime_segmentMatches(segments[i], target[j]) && reaches(i + 1, j + 1);
		};
		if (reaches(0, 0)) return true;
	}
	return false;
}

/**
 * Whether a write pattern matches the path `target` and every path beneath it (#667): one of its alternatives ends in
 * `.**` (or is `**`), and what comes before matches the path or a path above it. It answers yes only when sure.
 * @param {string} pattern - The write pattern, without `:write`.
 * @param {string[]} target - The path's segments.
 * @param {function(string): function(string): boolean} compiled - The compiled matcher of a pattern.
 * @returns {boolean} Whether it does.
 * @private
 * @example
 * runtime_patternCovers("owner.**", ["owner", "Foo", "prototype"], compilePattern); // true
 */
function runtime_patternCovers(pattern, target, compiled) {
	if (StringMethods.startsWith(pattern, "!") && !StringMethods.startsWith(pattern, "!(")) return false;
	for (let ofIndex = 0, ofList = expandBraces(pattern); ofIndex < ofList.length; ofIndex++) {
		const alternative = ofList[ofIndex];
		if (alternative === "**") return true;
		if (!StringMethods.endsWith(alternative, ".**")) continue;
		const above = compiled(StringMethods.slice(alternative, 0, -3));
		// `above.**` matches `x.` and anything after it, so a path at or below `x` is matched once `above` matches `x`;
		// the path itself needs `x` strictly above it.
		for (let length = 1; length < target.length; length++) if (above(ArrayMethods.join(copyList(target, 0, length), "."))) return true;
	}
	return false;
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
	 * The rules that gate calls, reads, and hooks: every rule but the write rules, so a call evaluation never scans
	 * the write rules (#625).
	 * @type {Map<string, object>}
	 * @private
	 */
	#callRules = new Map();

	/**
	 * Counter behind this instance's auto-generated rule ids (`perm-N`, `evt-N`). Per instance (#822), so a second
	 * instance numbers its rules from the same start rather than from where the first one left off.
	 * @type {number}
	 * @private
	 */
	#ruleIdCounter = 0;

	/**
	 * This instance's monotonic registration sequence for rules. It is the final tiebreak (last-registered wins
	 * WITHIN a layer), robust against `Date.now()` collisions when several rules register in the same millisecond
	 * (the config-rules loop). Per instance (#822): it only ever orders this instance's rules.
	 * @type {number}
	 * @private
	 */
	#ruleRegistrationSeq = 0;

	/**
	 * The write rules (`pattern:write`, #625), scanned only for a module's write.
	 * @type {Map<string, object>}
	 * @private
	 */
	#writeRules = new Map();

	/**
	 * Id of the built-in reach default (`slothlet.permissions.rules.add` for rules beyond a module's own subtree, #625).
	 * @type {string|null}
	 * @private
	 */
	#reachRuleId = null;

	/**
	 * Id of the built-in deny on `slothlet.metadata.global` for modules (#625), which
	 * {@link PermissionManager#assertGlobalMetadataWrite} applies rather than the call gate.
	 * @type {string|null}
	 * @private
	 */
	#globalMetadataRuleId = null;

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
	 * Whether the system was on when the instance shut down. What a module was handed as a view while it was on stays
	 * a view, and what it could not write then it cannot write through a view it kept: the instance ending grants
	 * nothing.
	 * @type {boolean}
	 * @private
	 */
	#endedOn = false;

	/**
	 * Whether the permission system is disabled outright (`mode: "disabled"`): not even the built-in rules that keep
	 * module code off the framework's own namespace apply. Off (`mode: "off"`, the default) evaluates those alone.
	 * @type {boolean}
	 * @private
	 */
	#disabled = false;

	/**
	 * Whether the mode is `"strict"`: as on, chosen in the config only, so `enable()` and `disable()` refuse.
	 * @type {boolean}
	 * @private
	 */
	#strict = false;

	/**
	 * What the permission baseline found when the instance started (see {@link runBaseline}), or null when no check ran
	 * (the mode was off or disabled).
	 * @type {{met: boolean, checks: Array<{id: string, met: boolean, reason: string|null}>}|null}
	 * @private
	 */
	#baseline = null;

	/**
	 * Audit level: "default" or "verbose".
	 * @type {string}
	 * @private
	 */
	#audit = "default";

	/**
	 * Whether terminal data-value property reads are permission-gated.
	 * On by default when permissions are configured — opt out via `permissions.gating.read: false`.
	 * @type {boolean}
	 * @private
	 */
	#readGating = false;

	/**
	 * Whether a function read out of the api keeps the identity of the module that read it.
	 *
	 * On by default when permissions are configured — opt out via `permissions.caller.capture: false`.
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
	 * What a `_`/`__`-prefixed member is private to: "module" (default) — the module ID that owns its path, so every
	 * leaf that module owns reads it, wherever its file sits; "folder" — the folder of files that exports it.
	 * @type {"module"|"folder"}
	 */
	#privateScope = "module";

	/**
	 * Owner grant (#509): when true, a caller leaf may access any target leaf whose CURRENT owner
	 * (per the ownership registry) is the caller leaf's own current owner, wherever the default policy
	 * would otherwise deny. Opt in via `permissions.owner: true`.
	 * @type {boolean}
	 * @private
	 */
	#owner = false;

	/**
	 * Event rules (#407): the separate three-level (deny/notify/allow) rule pool for the event
	 * system, distinct from the binary call/hook {@link #rules} above. Keyed by rule id.
	 * @type {Map<string, object>}
	 * @private
	 */
	#eventRules = new Map();

	/**
	 * Pins of the function conditions registered here, by the base id of the module each runs as (#625): a module's
	 * removal revokes them ({@link onModuleRemoved}).
	 * @type {Map<string, Set<{moduleID: string, live: boolean}>>}
	 * @private
	 */
	#conditionPins = new Map();

	/**
	 * Base event level applied when no event rule matches a subscriber/event pair. Built-in default
	 * "notify" (open subscription, payload opt-in); overridable via `permissions.events.policy`.
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
	 * Monotonic epoch that changes whenever a call, read or write rule's outcome may have changed (see
	 * {@link ruleEpoch}).
	 * @type {number}
	 */
	#ruleEpoch = 0;

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
	 * The paths a deny call rule names exactly (no glob), kept for the rule epoch: an exact deny on an object member a
	 * module's data holds covers what the member holds (see {@link enforceAccess}'s `dataMember` option). Null until
	 * asked for in the current epoch.
	 * @type {Set<string>|null}
	 * @private
	 */
	#exactDenyTargets = null;

	/**
	 * The paths above an api path that a deny call rule names exactly, by the path, for the rule epoch.
	 * @type {Map<string, string[]>}
	 * @private
	 */
	#exactDenyPrefixes = new Map();

	/**
	 * Whether an allow call rule for a caller can name something beneath a path, by `caller::path`, for the rule epoch.
	 * @type {Map<string, boolean>}
	 * @private
	 */
	#allowsBeneath = new Map();

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
	 * Write-rule verdicts (#625), keyed by caller path, written path, and `:write`: the deciding rule, or null when none
	 * matches. Only the rules' verdict is cached — ownership moves with every add, remove, and reload and is decided
	 * on each write. A verdict that a conditional rule took part in is not cached. Cleared on every rule change.
	 * @type {Map<string, object|null>}
	 * @private
	 */
	#writeCache = new Map();

	/**
	 * Write-rule verdicts over a whole subtree ({@link writeSubtree}), keyed by caller path and the subtree's root.
	 * Cleared on every rule change.
	 * @type {Map<string, "deny"|"grant"|null>}
	 * @private
	 */
	#subtreeCache = new Map();

	/**
	 * Whether a call or read rule could refuse a caller something at a path or beneath it ({@link readMayRefuseBeneath}),
	 * keyed by caller path and the path. Cleared on every rule change.
	 * @type {Map<string, boolean>}
	 * @private
	 */
	#readSubtreeCache = new Map();

	/**
	 * The write rules naming each caller path ({@link writeRulesFor}), keyed by caller path. Cleared on every rule change.
	 * @type {Map<string, string>}
	 * @private
	 */
	#writeRulesForCache = new Map();

	/**
	 * Ids of the built-in rules keeping module code off the framework's own keys on api nodes (`**.<key>:write`). They
	 * match a key at any depth, so {@link writeSubtree} leaves them out: they guard what an api node carries, and a
	 * value beneath a node's path is no node.
	 * @type {Set<string>}
	 * @private
	 */
	#nodeKeyRuleIds = new Set();

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
	 * Each record: `{ name, ownerModuleID, key, resolve, ttl, epoch, cache, inflight }`, where
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
	 * resolved for that call is accepted even if its `ttl` has since elapsed, as long as its epoch
	 * still matches — without this a `ttl: 0` principal could never be satisfied. An epoch bump
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

		// `slothlet.config.permissions` is the normalised section (load() normalises it before the components are built), so
		// every field below is present and valid.
		const permConfig = slothlet.config?.permissions;
		if (permConfig) {
			// The "allow" fallback in || is uncovered when all tests supply policy explicitly.
			/* v8 ignore next */
			this.#defaultPolicy = permConfig.policy || "allow";
			// An absent mode is "on"; `true` and `false` are the boolean forms of "on" and "off".
			const mode = permConfig.mode === undefined || permConfig.mode === true ? "on" : permConfig.mode === false ? "off" : permConfig.mode;
			this.#enabled = mode === "on" || mode === "strict";
			this.#disabled = mode === "disabled";
			this.#strict = mode === "strict";
			this.#audit = permConfig.audit || "default";
			this.#readGating = permConfig.gating?.read !== false;
			this.#capture = permConfig.caller?.capture !== false;
			// Module privacy (#260): whether the HOST may read `_`/`__` exports. Secure default deny.
			this.#privateHost = permConfig.private?.host === "allow" ? "allow" : "deny";
			// What a private member is private to; normalization guarantees "module" or "folder".
			this.#privateScope = permConfig.private?.scope === "folder" ? "folder" : "module";
			// Owner grant (#509): a module may reach every leaf it owns. Opt-in; normalization guarantees a boolean.
			this.#owner = permConfig.owner === true;

			// Register config-level rules (earliest in stacking order)
			if (Arrays.isArray(permConfig.rules)) {
				for (let i = 0; i < permConfig.rules.length; i++) {
					this.addRule(permConfig.rules[i], null);
				}
			}

			// Event rules (#407): base default level + config-level event rules (instance layer).
			// Config normalization guarantees `events` is present with a valid `default` and array `rules`.
			if (permConfig.events) {
				if (permConfig.events.policy) this.#eventDefault = permConfig.events.policy;
				if (Arrays.isArray(permConfig.events.rules)) {
					for (let i = 0; i < permConfig.events.rules.length; i++) {
						this.addEventRule(permConfig.events.rules[i], null);
					}
				}
			}
		}

		// Built-in deny rule: block all modules from calling control.enable/disable by default.
		this.addRule({ caller: "**", target: "slothlet.permissions.control.**", effect: "deny" }, "__builtin__");

		// Built-in deny rules (#529): `slothlet.reload` and `slothlet.shutdown` are the framework's own
		// lifecycle methods — a module that could call them could rebuild the tree under every other
		// module, or take the whole instance down. Host-only by default; an instance rule on the same
		// exact target outranks these, which is how the host grants them to a trusted module. The
		// default routines' root paths get the same treatment only while those defaults are configured
		// — see {@link PermissionManager#applyDefaultRoutineRules}.
		this.addRule({ caller: "**", target: "slothlet.reload", effect: "deny" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.shutdown", effect: "deny" }, "__builtin__");

		// Built-in deny rule (#504): `slothlet.restart` rebuilds the whole instance from its original
		// config, discarding every runtime rule, principal, subscription and the permission seal — so a
		// module that could call it could undo the host's runtime policy. Host-only by default; an
		// instance rule on the same exact target outranks this one, which is how the host grants it to a
		// trusted module (`{ caller: "admin.**", target: "slothlet.restart", effect: "allow" }`).
		this.addRule({ caller: "**", target: "slothlet.restart", effect: "deny" }, "__builtin__");

		// Built-in deny rule: `slothlet.warnings` holds every warning this instance raised, other modules' among them
		// (their paths and files), so reading or clearing it is the host's by default. An instance rule on the same
		// target grants it to a module.
		this.addRule({ caller: "**", target: "slothlet.warnings.**", effect: "deny" }, "__builtin__");

		// Built-in allow rules: the caller-identity utilities `slothlet.pin` and
		// `slothlet.bind` grant no security-sensitive access — they only pin a callback's
		// caller identity, which strengthens enforcement. Allowing them by default means a
		// `policy: "deny"` configuration does not have to allow them explicitly.
		// A more specific user rule can still deny them for a particular module.
		this.addRule({ caller: "**", target: "slothlet.pin", effect: "allow" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.bind", effect: "allow" }, "__builtin__");

		// Built-in deny rule (#477): `slothlet.pin.caller` pins the current leaf's CALLER onto
		// a callback, so the callback acts as another module — a privilege, unlike `pin`, which
		// only pins the module itself. Host-only by default; the host grants it to the service modules
		// that run callbacks on their callers' behalf (e.g. `{ caller: "scheduler.**", target:
		// "slothlet.pin.caller", effect: "allow" }`). The exact-path allow on `slothlet.pin`
		// above does not match this deeper path.
		this.addRule({ caller: "**", target: "slothlet.pin.caller", effect: "deny" }, "__builtin__");

		// Built-in allow rules (#468): `slothlet.metadata.caller` / `slothlet.metadata.self` reveal
		// identity only — who is calling this module, and which module this is — which is what a module
		// needs to enforce its own policy (e.g. scoping records by caller). They grant no data or
		// control access, so like pin/bind a `policy: "deny"` host need not re-allow
		// them. `slothlet.metadata.get(path)`, which reads arbitrary metadata, stays gated, and a user
		// rule of equal or higher specificity still overrides these.
		this.addRule({ caller: "**", target: "slothlet.metadata.caller", effect: "allow" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.metadata.self", effect: "allow" }, "__builtin__");

		// Built-in allow: `slothlet.node(target)` reports what slothlet knows about a node (its path, file, module, load
		// state). The call itself grants nothing: whether the caller may reach the target is decided per call, as a
		// read of the target's own path. So, like metadata.caller, a `defaultPolicy: "deny"` host need not re-allow it.
		this.addRule({ caller: "**", target: "slothlet.node", effect: "allow" }, "__builtin__");

		// Principals (#459): registering, replacing, or invalidating a resolver decides what facts every
		// `requires` rule sees, so the principal management surface is host-only by default. The host
		// grants it to the modules that should define principals, exactly like any other rule.
		this.addRule({ caller: "**", target: "slothlet.permissions.principal.**", effect: "deny" }, "__builtin__");

		// Built-in reach default (#625): module code manages rules (adds and removes them) for its own subtree only. A
		// rule on any other target, the framework's own among them, takes an explicit allow on this target for the
		// module — the host's or a manifest's — which outranks this deny. It decides only that reach; calling `rules.add`
		// for the module's own subtree is not gated by it (see placeModuleRule).
		this.#reachRuleId = this.addRule({ caller: "**", target: "slothlet.permissions.rules.add", effect: "deny" }, "__builtin__");

		// Call-gate query (#508): `global.check.call` answers "may caller X call target Y with these args"
		// for a SUPPLIED caller identity, exactly like `event.level` answers for a supplied
		// subscriber — so it is host-only by the same mechanism (a built-in deny), not merely gatable like
		// the rest of `global.*`. A module that could ask on another module's behalf would learn that
		// module's rule outcomes, and the query's audit trail would attribute the probe to the wrong
		// identity. The host grants it to a trusted boundary layer with an instance rule of equal
		// specificity (an exact target, `slothlet.permissions.global.check.call`), which outranks this one.
		this.addRule({ caller: "**", target: "slothlet.permissions.global.check.call", effect: "deny" }, "__builtin__");

		// Global metadata (#625): `metadata.global` changes the metadata every node reports, every other module's
		// included, so it is the host's. An allow for a module lifts it. Checked by assertGlobalMetadataWrite once the
		// call's arguments are valid, never by the call gate.
		this.#globalMetadataRuleId = this.addRule({ caller: "**", target: GLOBAL_METADATA_TARGET, effect: "deny" }, "__builtin__");

		// Built-in capabilities: refused to module code while the permission system is on. A rule naming the capability as
		// its target (`{ caller: "ext.render", target: "capability:code", effect: "allow" }`) opens it for the callers it
		// names, ranked as any rule is. Decided by assertCapability, never by the call gate: no api path is a capability.
		for (let ofIndex = 0, ofList = CAPABILITIES; ofIndex < ofList.length; ofIndex++) {
			const name = ofList[ofIndex];
			this.addRule({ caller: "**", target: `${CAPABILITY_PREFIX}${name}`, effect: "deny" }, "__builtin__");
		}

		// Built-in hook-management baseline (enforced only when permissions are enabled): modules may
		// inspect and register hooks (`list`, `on`) but may NOT tamper with other modules' hooks via the
		// global-effect methods (remove/off/clear, enable/disable, pattern.enable/disable/reset).
		// The broad deny is overridden by the two specific allows (most-specific-wins). These are call
		// targets (no `:type` suffix), so they gate the hook MANAGEMENT surface, not interception.
		this.addRule({ caller: "**", target: "slothlet.hook.**", effect: "deny" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.hook.list", effect: "allow" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.hook.on", effect: "allow" }, "__builtin__");

		// The runtime pin-enforcement switch `slothlet.hook.pin.*` (enable/disable/enabled) is host-only
		// via the `slothlet.hook.**` deny above — modules cannot weaken pinning. No separate rule needed.

		// Event system (#407): modules may USE the event surface (subscribe/emit); per-subscriber
		// DELIVERY is governed by the separate three-level event-rule pool (resolveEventLevel), not this
		// coarse call gate. The broad deny keeps runtime rule mutation (`slothlet.event.rules.*`), the
		// supplied-identity query (`resolveLevel`) and the delivery controls (`strategy`/`deliver`, #497)
		// host-only — modules cannot override event policy or delivery — while the specific allows keep
		// on/once/off/emit usable under a `policy: "deny"` configuration. A consumer rule of equal
		// specificity still wins (instance layer > builtin), so the host can tighten any of these.
		this.addRule({ caller: "**", target: "slothlet.event.**", effect: "deny" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.event.on", effect: "allow" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.event.once", effect: "allow" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.event.off", effect: "allow" }, "__builtin__");
		this.addRule({ caller: "**", target: "slothlet.event.emit", effect: "allow" }, "__builtin__");

		// Built-in write rules (#625), evaluated like every other rule only while the permission system is on. The
		// framework's namespace and root functions are shared by every module and the host, so no module
		// assigns, defines, or deletes anything at or under them, or changes the prototype or extensibility
		// of what is there; nor does a module touch the framework's own keys on any api node — the wrapper's
		// state, what a node reports about itself, and impl metadata. They are defaults: the host, a manifest, or a
		// module allowed to manage rules lifts one with an allow of equal or higher specificity, which grants the write
		// to the callers it names.
		for (const root of setValues(FRAMEWORK_ROOTS)) {
			this.addRule({ caller: "**", target: `${root}${WRITE_TARGET_SUFFIX}`, effect: "deny" }, "__builtin__");
			this.addRule({ caller: "**", target: `${root}.**${WRITE_TARGET_SUFFIX}`, effect: "deny" }, "__builtin__");
		}
		for (
			let ofIndex = 0,
				ofList = concatLists(setToArray(reservedKeysOwn.WRAPPER_INTERNAL_KEYS), setToArray(reservedKeysOwn.IMPL_METADATA_KEYS));
			ofIndex < ofList.length;
			ofIndex++
		) {
			const key = ofList[ofIndex];
			SetMethods.add(
				this.#nodeKeyRuleIds,
				this.addRule({ caller: "**", target: `${key}${WRITE_TARGET_SUFFIX}`, effect: "deny" }, "__builtin__")
			);
			SetMethods.add(
				this.#nodeKeyRuleIds,
				this.addRule({ caller: "**", target: `**.${key}${WRITE_TARGET_SUFFIX}`, effect: "deny" }, "__builtin__")
			);
		}
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
	 * @param {string|null} [layer=null] - Explicit precedence layer; derived from `ownerModuleID` when null.
	 * @returns {string} The rule ID (generated or reused).
	 * @throws {SlothletError} PERMISSION_RULE_INVALID if rule is malformed.
	 * @example
	 * pm.addRule({ caller: "payments.**", target: "db.write", effect: "allow" }, "mod_abc123");
	 */
	addRule(rule, ownerModuleID = null, ruleId = null, layer = null) {
		this.#assertNotSealed();
		// The rule is read once: the copy is what is validated and kept (#625).
		rule = this.snapshotRule(rule);
		this.#validateRule(rule);
		this.#trackConditionPins(rule.condition);

		const id = ruleId || `perm-${++this.#ruleIdCounter}`;
		// Detect the hook-target suffix form (`pattern:type`). When present the rule gates hook
		// registration/execution rather than plain calls; `hookType` is the type or "hook" (any),
		// `hookPathPattern` is the path-glob portion. Both null for ordinary call-target rules.
		const hookTarget = this.#parseHookTarget(rule.target);
		// A write target (`pattern:write`, #625) gates module writes rather than calls; null for any other rule.
		const writePathPattern = this.#parseWriteTarget(rule.target);
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
			requires: rule.requires == null ? null : Objects.freeze(copyList(rule.requires)),
			hookType: hookTarget ? hookTarget.hookType : null,
			hookPathPattern: hookTarget ? hookTarget.pathPattern : null,
			writePathPattern,
			ownerModuleID: ownerModuleID,
			layer: ruleLayer,
			layerRank: RULE_LAYER_RANK[ruleLayer],
			registeredAt: this.clock.now(),
			registrationSeq: ++this.#ruleRegistrationSeq
		};

		MapMethods.set(this.#rules, id, entry);
		MapMethods.set(writePathPattern === null ? this.#callRules : this.#writeRules, id, entry);
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
	 * @param {string|string[]|null} [callerModuleID=null] - Module ID of the caller attempting removal; a list when
	 *   the caller acts for several modules (#597), none of which may own the rule.
	 * @returns {boolean} True if the rule was removed.
	 * @throws {SlothletError} PERMISSION_SELF_MODIFY if caller owns the rule.
	 * @example
	 * pm.removeRule("perm-3", "mod_other");
	 */
	removeRule(ruleId, callerModuleID = null) {
		this.#assertNotSealed();
		const entry = MapMethods.get(this.#rules, ruleId);
		if (!entry) return false;

		// Self-modification protection: a module cannot remove the rules registered on its behalf (its manifest's,
		// an api.add's). A rule its own code added (the module layer, #625) is its to remove. The guarded rules are
		// registered with an owner only internally, and their ids are not handed to the module.
		/* v8 ignore start */
		if (
			entry.ownerModuleID &&
			ArrayMethods.includes(runtime_moduleIDList(callerModuleID), entry.ownerModuleID) &&
			entry.layer !== "module" &&
			entry.layer !== "manager"
		) {
			throw new this.SlothletError("PERMISSION_SELF_MODIFY", {
				id: ruleId,
				module: entry.ownerModuleID
			});
		}
		/* v8 ignore stop */
		MapMethods.delete(this.#rules, ruleId);
		MapMethods.delete(this.#callRules, ruleId);
		MapMethods.delete(this.#writeRules, ruleId);
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
	 * @throws {SlothletError} PERMISSION_RULE_INVALID if the rule is malformed.
	 * @example
	 * pm.addEventRule({ caller: "orders.**", event: "orders.*", effect: "allow" }, "mod_orders", null, "manifest");
	 */
	addEventRule(rule, ownerModuleID = null, ruleId = null, layer = null) {
		this.#assertNotSealed();
		this.#validateEventRule(rule);
		this.#trackConditionPins(rule.condition);

		const id = ruleId || `evt-${++this.#ruleIdCounter}`;
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
			registeredAt: this.clock.now(),
			registrationSeq: ++this.#ruleRegistrationSeq
		};

		MapMethods.set(this.#eventRules, id, entry);
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
	 * @param {string|string[]|null} [callerModuleID=null] - Module id attempting removal; a list when the caller
	 *   acts for several modules (#597), none of which may own the rule.
	 * @returns {boolean} True if a rule was removed.
	 * @throws {SlothletError} PERMISSION_SELF_MODIFY if the caller owns the rule.
	 */
	removeEventRule(ruleId, callerModuleID = null) {
		this.#assertNotSealed();
		const entry = MapMethods.get(this.#eventRules, ruleId);
		if (!entry) return false;
		// Self-modification protection, mirroring removeRule: a module cannot remove the event rules registered on its
		// behalf (its manifest's). One its own code added (the module layer, #625) is its to remove. The guarded rules
		// are registered with an owner only internally, and their ids are not handed to the module.
		/* v8 ignore start */
		if (
			entry.ownerModuleID &&
			ArrayMethods.includes(runtime_moduleIDList(callerModuleID), entry.ownerModuleID) &&
			entry.layer !== "module" &&
			entry.layer !== "manager"
		) {
			throw new this.SlothletError("PERMISSION_SELF_MODIFY", { id: ruleId, module: entry.ownerModuleID });
		}
		/* v8 ignore stop */
		MapMethods.delete(this.#eventRules, ruleId);
		this.#eventRulesEpoch++;
		return true;
	}

	/**
	 * Resolve the delivery level for a subscriber/event pair (#407): "deny" | "notify" | "allow".
	 * Most-specific-wins with the layered tiebreak (see {@link RULE_LAYER_RANK}); falls back to the
	 * base default (`permissions.events.policy`, built-in "notify") when no rule matches. A host
	 * subscription (no module caller) is trusted like a host-initiated call and always resolves "allow".
	 *
	 * Event levels are part of the permission system, so the pool follows its mode: while it is not on (`"off"`,
	 * which is also what no `permissions` config means, and `"disabled"`) no event rule is evaluated and every
	 * subscription resolves "allow", as call and read rules are not evaluated there. An instance that has shut down
	 * resolves "deny".
	 *
	 * @param {string|null} subscriberPath - The subscribing module's api path, or null for the host.
	 * @param {string} eventName - The event name being subscribed to / emitted.
	 * @param {object|null} [runtimeContext=null] - Per-request ALS context for condition evaluation.
	 * @returns {"deny"|"notify"|"allow"} The resolved delivery level.
	 */
	resolveEventLevel(subscriberPath, eventName, runtimeContext = null) {
		// Host subscription (no module caller) is trusted like a host-initiated call → full payload.
		if (subscriberPath == null) return "allow";
		// Not on: the event rules are not evaluated, the built-in base level and `events.default` included.
		if (!this.#enabled) return this.#endedOn ? "deny" : "allow";

		const matches = [];
		for (const entry of mapValues(this.#eventRules)) {
			const callerMatcher = this.#getCompiledPattern(entry.caller);
			const eventMatcher = this.#getCompiledPattern(entry.event);
			if (callerMatcher(subscriberPath) && eventMatcher(eventName)) listPush(matches, entry);
		}

		// Event delivery has no call/construct arguments — function conditions receive null callMeta.
		const conditioned = filterList(matches, (entry) => this.#conditionMatches(entry, runtimeContext, null));
		if (conditioned.length === 0) return this.#eventDefault;

		// Most-specific-wins; equal specificity → higher layer; within a layer → last-registered (see #sortBySpecificity).
		this.#sortBySpecificity(
			conditioned,
			(entry) => this.#patternSpecificity(entry.caller, subscriberPath) + this.#patternSpecificity(entry.event, eventName),
			(entry) => this.#literalSegments(entry.caller) + this.#literalSegments(entry.event)
		);
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
		for (const entry of mapValues(this.#eventRules)) {
			if (entry.condition != null) return true;
		}
		return false;
	}

	/**
	 * Validate an event-rule shape (#407). Mirrors {@link #validateRule} for the
	 * `{ caller, event, effect(deny/notify/allow), condition? }` construct.
	 * @param {object} rule - The event rule to validate.
	 * @returns {void}
	 * @throws {SlothletError} PERMISSION_RULE_INVALID on a malformed rule.
	 * @private
	 */
	#validateEventRule(rule) {
		if (!rule || typeof rule !== "object") {
			throw new this.SlothletError("PERMISSION_RULE_INVALID", {
				reason: translate("PERMISSION_RULE_REASON_NOT_OBJECT"),
				received: typeof rule
			});
		}
		if (typeof rule.caller !== "string" || !rule.caller) {
			throw new this.SlothletError("PERMISSION_RULE_INVALID", {
				reason: translate("PERMISSION_RULE_REASON_CALLER_REQUIRED"),
				received: typeof rule.caller
			});
		}
		if (typeof rule.event !== "string" || !rule.event) {
			throw new this.SlothletError("PERMISSION_RULE_INVALID", {
				reason: translate("PERMISSION_EVENT_RULE_REASON_EVENT_REQUIRED"),
				received: typeof rule.event
			});
		}
		if (rule.effect !== "deny" && rule.effect !== "notify" && rule.effect !== "allow") {
			throw new this.SlothletError("PERMISSION_RULE_INVALID", {
				reason: translate("PERMISSION_EVENT_RULE_REASON_EFFECT_INVALID"),
				received: rule.effect
			});
		}
		if (rule.condition !== undefined && rule.condition !== null) {
			this.#assertValidConditionPayload(rule.condition, "PERMISSION_RULE_INVALID");
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
	 * @param {number} [definition.ttl] - Optional time-to-live in milliseconds for a resolved value.
	 * @param {string|string[]|null} [ownerModuleID=null] - Registering module's id; `null` for the host. A list when the
	 *   registrant acts for several modules (#597): each has to own an existing name, the first owns a new one.
	 * @param {function(Function, Array<*>): *} [invoke=null] - Runs the resolver as its registering
	 *   module, so anything the resolver calls is attributed to that module rather than to whichever
	 *   caller's call triggered the resolve. `null` (host registrations) calls `resolve` directly.
	 * @returns {void}
	 * @throws {SlothletError} PERMISSION_SEALED when the control surface is sealed.
	 * @throws {SlothletError} INVALID_ARGUMENT when the name or definition is malformed.
	 * @throws {SlothletError} PERMISSION_PRINCIPAL_NAME_OWNED when another module owns the name.
	 * @example
	 * pm.registerPrincipal("roles", { key: (ctx) => ctx.user?.id, resolve: (id) => loadRoles(id), ttl: 30_000 }, "roles_mod");
	 */
	registerPrincipal(name, definition, ownerModuleID = null, invoke = null) {
		this.#assertNotSealed();
		this.#validatePrincipal(name, definition);

		const existing = MapMethods.get(this.#principals, name);
		// Code supplied to another module's call claims for both modules (#597): each has to own an existing name,
		// and the first — the module whose call it runs inside — owns a new one.
		const claimants = runtime_moduleIDList(ownerModuleID);
		ownerModuleID = claimants[0] ?? null;
		for (let ofIndex = 0, ofList = existing ? claimants : []; ofIndex < ofList.length; ofIndex++) {
			const claimant = ofList[ofIndex];
			if (!this.#sameOwner(existing.ownerModuleID, claimant)) {
				throw new this.SlothletError("PERMISSION_PRINCIPAL_NAME_OWNED", { name, owner: existing.ownerModuleID ?? "host", claimant });
			}
		}

		MapMethods.set(
			this.#principals,
			name,
			this.#newPrincipalRecord(
				name,
				// The host replacing a module's principal keeps that module as the owner — the host acts on a
				// name's behalf, it does not take the name away from the module that defined it.
				existing ? existing.ownerModuleID : ownerModuleID,
				definition,
				invoke,
				definition.ttl ?? null,
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
	 * matching (their calls fall to `policy`).
	 *
	 * @param {string} name - Principal name.
	 * @param {string|string[]|null} [callerModuleID=null] - Calling module's id, or a list of them (#597); `null` for the host.
	 * @returns {boolean} True when a principal was removed.
	 * @throws {SlothletError} PERMISSION_SEALED when the control surface is sealed.
	 * @throws {SlothletError} PERMISSION_PRINCIPAL_NOT_OWNER when a module other than the owner calls it.
	 * @example
	 * pm.unregisterPrincipal("roles");
	 */
	unregisterPrincipal(name, callerModuleID = null) {
		this.#assertNotSealed();
		const record = MapMethods.get(this.#principals, name);
		if (!record) return false;
		this.#assertPrincipalOwner(record, callerModuleID, ["slothlet", "permissions", "principal", "unregister"]);
		MapMethods.delete(this.#principals, name);
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
	 * @param {string|string[]|null} [callerModuleID=null] - Calling module's id, or a list of them (#597); `null` for the host.
	 * @returns {boolean} True when the principal exists.
	 * @throws {SlothletError} PERMISSION_PRINCIPAL_NOT_OWNER when a module other than the owner calls it.
	 * @example
	 * pm.invalidatePrincipal("roles", "user-42");
	 */
	invalidatePrincipal(name, identityKey = undefined, callerModuleID = null) {
		const record = MapMethods.get(this.#principals, name);
		if (!record) return false;
		this.#assertPrincipalOwner(record, callerModuleID, ["slothlet", "permissions", "principal", "invalidate"]);
		if (identityKey === undefined) {
			this.#bumpPrincipal(record);
			return true;
		}
		MapMethods.delete(record.cache, identityKey);
		// Only an identity with a resolve in flight needs a marker; the marker is dropped when it settles.
		if (MapMethods.has(record.inflight, identityKey)) MapMethods.set(record.keyInvalidations, identityKey, ++record.seq);
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
		return MapMethods.has(this.#principals, name);
	}

	/**
	 * Drop every principal (#459) and every rule (#625) owned by a removed module. Called when a whole module is
	 * removed (`api.slothlet.api.remove(moduleID)`), so neither a resolver nor a grant outlives the module.
	 *
	 * @param {string} moduleID - The removed module's id.
	 * @returns {void}
	 * @example
	 * pm.onModuleRemoved("roles_mod");
	 */
	onModuleRemoved(moduleID) {
		// The function conditions it registered stop running, wherever their rules live (a module it mounted keeps
		// its rules): a later module taking the freed id must not reach them (#625).
		const base = splitText(String(moduleID), MODULE_ID_SEPARATOR)[0];
		for (const pin of setValues(MapMethods.get(this.#conditionPins, base))) pin.live = false;
		MapMethods.delete(this.#conditionPins, base);
		for (const ofEntry of mapEntries(this.#principals)) {
			const name = ofEntry[0],
				record = ofEntry[1];
			if (record.ownerModuleID !== null && this.#sameOwner(record.ownerModuleID, moduleID)) {
				MapMethods.delete(this.#principals, name);
			}
		}
		// So do its rules (#625): its manifest's, its code's, and those registered with its api.add. The host's own
		// rules (no owner) stay, whatever paths they name.
		for (const ofEntry of mapEntries(this.#rules)) {
			const id = ofEntry[0],
				entry = ofEntry[1];
			if (entry.ownerModuleID === null || entry.layer === "builtin" || !this.#sameOwner(entry.ownerModuleID, moduleID)) continue;
			MapMethods.delete(this.#rules, id);
			MapMethods.delete(this.#callRules, id);
			MapMethods.delete(this.#writeRules, id);
			if (entry.requires) this.#requiresRuleCount--;
		}
		// And its event rules, the same ones (#625).
		for (const ofEntry of mapEntries(this.#eventRules)) {
			const id = ofEntry[0],
				entry = ofEntry[1];
			if (entry.ownerModuleID === null || entry.layer === "builtin" || !this.#sameOwner(entry.ownerModuleID, moduleID)) continue;
			MapMethods.delete(this.#eventRules, id);
			this.#eventRulesEpoch++;
		}
		this.#clearCache();
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
		for (const record of mapValues(this.#principals)) {
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
		if (MapMethods.has(this.#principals, name)) return;
		const record = this.#newPrincipalRecord(name, ownerModuleID, null, null, null, 0);
		this.#makeDormant(record);
		MapMethods.set(this.#principals, name, record);
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
		if (this.#requiresRuleCount === 0 || MapMethods.size(this.#principals) === 0) return [];
		// Mirror #resolveAccess's pre-rule short-circuits: those calls never reach a rule, so resolving
		// principals for them would be wasted work.
		if (!this.#enabled) return [];
		if (callerFilePath && targetFilePath && callerFilePath === targetFilePath) return [];
		if (runtime_isPrivateName(targetPath) && !StringMethods.startsWith(targetPath, "slothlet.")) return [];

		const ctx = runtimeContext ?? {};
		const stale = [];
		const seen = new Map();
		for (const entry of mapValues(this.#callRules)) {
			if (!entry.requires || entry.hookType != null) continue;
			if (!this.#getCompiledPattern(entry.caller)(callerPath) || !this.#getCompiledPattern(entry.target)(targetPath)) continue;
			for (let r = 0; r < entry.requires.length; r++) {
				const name = entry.requires[r];
				const record = MapMethods.get(this.#principals, name);
				// Absent or dormant → the rule simply does not match; nothing to resolve.
				if (!record || record.resolve === null) continue;
				const identityKey = this.#principalKey(record, ctx);
				if (identityKey == null) continue; // no identity → no facts; the rule does not match
				const hit = MapMethods.get(record.cache, identityKey);
				if (hit && this.#isPrincipalCurrent(record, hit, false)) continue;
				let keys = MapMethods.get(seen, name);
				if (!keys) MapMethods.set(seen, name, (keys = new Set()));
				if (SetMethods.has(keys, identityKey)) continue;
				SetMethods.add(keys, identityKey);
				listPush(stale, { name, identityKey });
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
		await promiseAll(mapList(pairs, ({ name, identityKey }) => this.#resolvePrincipal(name, identityKey)));
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
		const record = MapMethods.get(this.#principals, name);
		// Unregistered or gone dormant between the stale scan and the resolve: nothing to do — the rule no
		// longer matches.
		if (!record || record.resolve === null) return Promises.resolve();
		const pending = MapMethods.get(record.inflight, identityKey);
		if (pending) return pending;

		const epoch = record.epoch;
		const startSeq = record.seq;
		const run = (async () => {
			try {
				const value = await (record.invoke ? record.invoke(record.resolve, [identityKey]) : record.resolve(identityKey));
				// Replaced, unregistered, or invalidated (wholesale or for this identity) while resolving: the
				// answer predates the change, so it must not be cached as current.
				const invalidatedAt = MapMethods.get(record.keyInvalidations, identityKey) ?? 0;
				if (MapMethods.get(this.#principals, name) !== record || record.epoch !== epoch || invalidatedAt > startSeq) return;
				const now = this.clock.now();
				MapMethods.set(record.cache, identityKey, { value, view: this.#principalView(record, value), epoch, resolvedAt: now });
				this.#prunePrincipalCache(record, now);
			} catch (error) {
				this.debug("permissions", {
					key: "DEBUG_PERMISSION_PRINCIPAL_RESOLVE_FAILED",
					principal: name,
					error: error?.message ?? String(error)
				});
			}
		})();
		MapMethods.set(record.inflight, identityKey, run);
		// `run` never rejects (the body catches), so this settle handler never surfaces a rejection.
		PromiseMethods.finally(run, () => {
			if (MapMethods.get(record.inflight, identityKey) === run) {
				MapMethods.delete(record.inflight, identityKey);
				MapMethods.delete(record.keyInvalidations, identityKey);
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
		const principals = Objects.create(null);
		for (let ofIndex = 0, ofList = requires; ofIndex < ofList.length; ofIndex++) {
			const name = ofList[ofIndex];
			const record = MapMethods.get(this.#principals, name);
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
					hit = MapMethods.get(record.cache, identityKey);
					if (!hit || !this.#isPrincipalCurrent(record, hit, this.#principalGrace)) reason = "stale";
				}
			}
			if (reason !== null) {
				this.debug("permissions", { key: "DEBUG_PERMISSION_PRINCIPAL_UNAVAILABLE", principal: name, target, reason });
				return null;
			}
			principals[name] = hit.view;
		}
		return Objects.freeze(principals);
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
			// A module's key function runs as that module, as its resolver does (#625): it is computed while some
			// other caller's call is checked, and must not act with that caller's standing.
			identityKey = record.invoke ? record.invoke(record.key, [ctx]) : record.key(ctx);
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
	 * Whether a cached principal value is current: same epoch, and within `ttl` unless `grace`.
	 *
	 * @param {object} record - Principal record.
	 * @param {{ epoch: number, resolvedAt: number }} hit - Cached entry.
	 * @param {boolean} grace - Ignore `ttl` (a promoted call re-enforcing right after its resolve).
	 * @returns {boolean} True when current.
	 * @private
	 */
	#isPrincipalCurrent(record, hit, grace) {
		if (hit.epoch !== record.epoch) return false;
		if (grace || record.ttl === null) return true;
		return runtime_withinTtl(this.clock.now() - hit.resolvedAt, record.ttl);
	}

	/**
	 * Build a principal record.
	 *
	 * @param {string} name - Principal name.
	 * @param {string|null} ownerModuleID - Owning module's id; `null` for the host.
	 * @param {{ key: Function, resolve: Function }|null} definition - Resolver definition; `null` for a dormant reservation.
	 * @param {Function|null} invoke - Runs the resolver as its owner (see {@link registerPrincipal}).
	 * @param {number|null} ttl - Time-to-live in ms, or `null` for none.
	 * @param {number} epoch - Starting epoch.
	 * @returns {object} The record.
	 * @private
	 */
	#newPrincipalRecord(name, ownerModuleID, definition, invoke, ttl, epoch) {
		return {
			name,
			ownerModuleID,
			key: definition?.key ?? null,
			resolve: definition?.resolve ?? null,
			invoke,
			ttl,
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
		MapMethods.clear(record.cache);
	}

	/**
	 * Drop expired entries once a principal's cache grows past a threshold. Only principals with a
	 * `ttl` can expire; without one, entries live until invalidated.
	 *
	 * @param {object} record - Principal record.
	 * @param {number} now - Current time.
	 * @returns {void}
	 * @private
	 */
	#prunePrincipalCache(record, now) {
		if (record.ttl === null || MapMethods.size(record.cache) <= PRINCIPAL_PRUNE_THRESHOLD) return;
		for (const ofEntry of mapEntries(record.cache)) {
			if (!runtime_withinTtl(now - ofEntry[1].resolvedAt, record.ttl)) MapMethods.delete(record.cache, ofEntry[0]);
		}
	}

	/**
	 * Build (or reuse) a read-only view of a resolved principal value. Reads pass through (nested
	 * plain objects/arrays are viewed on the way out); every write — set, define, delete, prototype
	 * change — throws `PERMISSION_PRINCIPAL_READ_ONLY`. Only slothlet replaces a principal's value, on re-resolve.
	 *
	 * @param {object} record - Principal record (owns the view cache).
	 * @param {*} value - Raw resolved value, or a nested value inside it.
	 * @returns {*} A read-only view for a plain object/array; any other value unchanged.
	 * @private
	 */
	#principalView(record, value) {
		if (!runtime_isViewablePrincipalValue(value)) return value;
		const cached = WeakMapMethods.get(record.views, value);
		if (cached) return cached;
		const refuse = () => {
			throw new this.SlothletError("PERMISSION_PRINCIPAL_READ_ONLY", { name: record.name });
		};
		const view = markSlothletProxy(
			new NativeProxy(value, {
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
			})
		);
		WeakMapMethods.set(record.views, value, view);
		return view;
	}

	/**
	 * Throw unless the caller owns the principal (or is the host).
	 *
	 * @param {object} record - Principal record.
	 * @param {string|string[]|null} callerModuleID - Calling module's id, or a list of them (#597); `null` for the host.
	 * @param {string[]} operation - The method called, as its path from `api` (segments), for the error.
	 * @returns {void}
	 * @throws {SlothletError} PERMISSION_PRINCIPAL_NOT_OWNER when a non-owner module calls.
	 * @private
	 */
	#assertPrincipalOwner(record, callerModuleID, operation) {
		// A caller acting for several modules (#597) has to be the owner as each of them.
		for (let ofIndex = 0, ofList = runtime_moduleIDList(callerModuleID); ofIndex < ofList.length; ofIndex++) {
			const caller = ofList[ofIndex];
			if (this.#sameOwner(record.ownerModuleID, caller)) continue;
			throw new this.SlothletError("PERMISSION_PRINCIPAL_NOT_OWNER", {
				name: record.name,
				operation,
				owner: record.ownerModuleID ?? "host",
				caller
			});
		}
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
		return splitText(String(a), MODULE_ID_SEPARATOR)[0] === splitText(String(b), MODULE_ID_SEPARATOR)[0];
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
			throw new this.SlothletError("INVALID_ARGUMENT", { argument, expected, received });
		};
		if (typeof name !== "string" || name.length === 0) fail("name", "non-empty string", typeof name);
		if (!definition || typeof definition !== "object") fail("definition", "object", definition === null ? "null" : typeof definition);
		if (typeof definition.key !== "function") fail("definition.key", "function", typeof definition.key);
		if (typeof definition.resolve !== "function") fail("definition.resolve", "function", typeof definition.resolve);
		assertOptionKeys(definition, "slothlet.permissions.principal.register");
		const { ttl } = definition;
		if (ttl !== undefined && ttl !== null && !(typeof ttl === "number" && Numbers.isFinite(ttl) && ttl >= 0)) {
			fail("definition.ttl", "finite number >= 0", typeof ttl);
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
		if (typeof normalizedOptions !== "object" || Arrays.isArray(normalizedOptions)) {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "options",
				expected: "object with optional boolean useCache",
				received: Arrays.isArray(normalizedOptions) ? "array" : typeof normalizedOptions
			});
		}

		const { useCache = true } = normalizedOptions;
		if (typeof useCache !== "boolean") {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "options.useCache",
				expected: "boolean",
				received: typeof useCache
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

		if (Arrays.isArray(condition)) {
			return ArrayMethods.some(condition, (entry) => this.#singleConditionMatches(entry, ctx, callMeta));
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
	 * @param {{ principalGrace?: boolean, moduleCaller?: boolean, via?: ReadonlyArray<string> }|null} [options=null] - Enforcement options.
	 * @param {boolean} [options.principalGrace=false] - Accept a principal whose epoch is current even if its
	 *   `ttl` has elapsed (#459). Set only by a promoted call re-enforcing right after its resolve.
	 * @param {boolean} [options.moduleCaller=false] - The caller is a module even though no source file is
	 *   known for it (#508). A module-private target is then denied outright instead of being judged by
	 *   the `permissions.private.host` policy, which is what a null `callerFilePath` otherwise means.
	 * @param {ReadonlyArray<string>} [options.via] - Origin marker added to the audit payload: the method path as segments
	 *   (`via: ["slothlet", "permissions", "global", "check", "call"]`), so an
	 *   audit consumer can tell a query from the gate of a real call.
	 * @param {function(string): boolean} [options.dataMember] - Given for a read of data: whether a path above the
	 *   target is an object member of a module's data. A deny rule naming such a member's path exactly then covers the
	 *   target too, as a rule on `path.**` would, so what the member holds is denied with it unless a more specific rule
	 *   allows it.
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
		// lets those just-resolved values count as current even when `ttl` has elapsed meanwhile.
		// Evaluation is synchronous, so the flag cannot leak into another call's enforcement; it is saved
		// and restored rather than cleared so a nested enforcement cannot end an outer one's grace early.
		const priorGrace = this.#principalGrace;
		this.#principalGrace = options?.principalGrace === true;
		let result;
		try {
			result = this.#resolveAccess(
				callerPath,
				targetPath,
				callerFilePath,
				targetFilePath,
				runtimeContext,
				true,
				callMeta,
				options?.moduleCaller === true,
				options?.dataMember ?? null
			);
		} finally {
			this.#principalGrace = priorGrace;
		}
		if (result.event) {
			// The decision record may be the cached entry itself — spread rather than mutate it.
			const via = Arrays.isArray(options?.via) ? copyList(options.via) : null;
			this.#emitAuditEvent(result.event, via ? { ...result.payload, via } : result.payload);
		}
		return result.allowed;
	}

	/**
	 * Place a rule module code is registering — through `slothlet.permissions.rules.add` / `rules.remove`, or the
	 * `permissions` option of an `api.add` it makes (#625) — and refuse it when the module may not.
	 *
	 * By default a module manages rules only for its own subtree: the rule's target pattern (a call, hook, or
	 * write target alike) must have a non-empty literal prefix (the segments before the first glob segment)
	 * inside the subtree the module owns, and must not name the framework's namespace, root functions, or
	 * internal keys. Reaching any other target is the built-in default `{ caller: "**", target:
	 * "slothlet.permissions.rules.add", effect: "deny" }`, which decides only that reach (calling `rules.add` for the
	 * module's own subtree is not gated by it): an explicit allow on that target for the module — the host's, or
	 * a manifest's — lifts it, and the module then manages rules for any target, as the host does.
	 *
	 * A rule module code adds is that module's rule, at the module layer (`module` for its own subtree, `manager`
	 * for a rule beyond it), ranked with a manifest's: a host rule outranks it at equal specificity. A `module`
	 * rule never lifts a built-in rule; a `manager` rule may, as a manifest's may. Host code is not placed: its
	 * rules keep their usual owner and layer. Code the live runtime cannot attribute is refused.
	 *
	 * @param {object} rule - The rule (`{ target, … }`).
	 * @param {object|null} [writer] - The module code registering it, when an entry point captured it before an await
	 *   lost it; read now when omitted. Null is host code.
	 * @returns {{ownerModuleID: string|null, layer: string|null, writer: object|null}} Owner and layer to register the
	 *   rule with, and the module code registering it (see {@link pinConditions}); all null for host code.
	 * @throws {SlothletError} `PERMISSION_RULE_INVALID` when module code may not manage a rule on that target.
	 * @example
	 * const { ownerModuleID, layer } = pm.placeModuleRule(rule);
	 * pm.addRule(rule, ownerModuleID, null, layer);
	 */
	placeModuleRule(rule, writer) {
		const module = writer === undefined ? runtime_selfModuleReader(this.slothlet) : writer;
		if (module === null) return { ownerModuleID: null, layer: null, writer: null };
		const internal = module.____slothletInternal;
		const refuse = () => {
			throw new this.SlothletError("PERMISSION_RULE_INVALID", {
				reason: translate("PERMISSION_RULE_REASON_TARGET_NOT_OWNED"),
				received: typeof rule?.target === "string" ? rule.target : typeof rule?.target
			});
		};
		// Code the live runtime cannot attribute has no module to register for. Unreachable through the routes that
		// call this: the framework's call gate refuses such code on `slothlet.*` before the rule is looked at.
		/* v8 ignore next */
		if (!internal) refuse();
		// A malformed rule is left to the rule validation, which refuses it.
		if (typeof rule?.target !== "string") return { ownerModuleID: internal.moduleID, layer: "module", writer: module };
		const pattern = this.#parseWriteTarget(rule.target) ?? this.#parseHookTarget(rule.target)?.pathPattern ?? rule.target;
		const prefix = writeTargetLiteralPrefix(pattern);
		const framework = isFrameworkWriteTarget(pattern);
		// Whether a module may manage the rule within its own subtree; refused when it may not manage it at all.
		const ownsTarget = (wrapper) => {
			if (prefix.length > 0 && !framework && this.slothlet.handlers.apiManager.ownsPath(prefix, wrapper)) return true;
			if (!this.#mayReachBeyondOwn(String(wrapper.____slothletInternal?.apiPath ?? ""))) refuse();
			return false;
		};
		// Code a caller supplied to another module's call manages only what every module it acts for may (#597).
		let own = ownsTarget(module);
		for (let i = 0, ceilings = runtime_selfModuleCeilings(this.slothlet, module); i < ceilings.length; i++)
			own = ownsTarget(ceilings[i]) && own;
		return { ownerModuleID: internal.moduleID, layer: own ? "module" : "manager", writer: module };
	}

	/**
	 * A rule's condition as module code registers it: each function in it runs as that module (#625).
	 *
	 * A function condition is called while some other call is checked, so on its own it would run as that call's
	 * caller, and whatever it did through `self` — a write, a call — would be judged as that caller's. Pinned to the
	 * module that registered the rule, it has that module's standing and no other, as the module's own code does.
	 * A plain-data condition, and any condition host code registers, is handed back as it is.
	 *
	 * @param {*} condition - The condition, as {@link snapshotRule} copied it.
	 * @param {object|null} writer - The module code registering the rule, as {@link placeModuleRule} returned it;
	 *   null for host code.
	 * @returns {*} The condition, its functions pinned to `writer`.
	 * @example
	 * const { writer } = pm.placeModuleRule(rule);
	 * pm.addRule({ ...rule, condition: pm.pinConditions(rule.condition, writer) });
	 */
	pinConditions(condition, writer) {
		if (!writer) return condition;
		if (typeof condition === "function") return this.#pinCondition(condition, writer);
		if (Arrays.isArray(condition) && ArrayMethods.some(condition, (entry) => typeof entry === "function")) {
			return Objects.freeze(mapList(condition, (entry) => (typeof entry === "function" ? this.#pinCondition(entry, writer) : entry)));
		}
		return condition;
	}

	/**
	 * One function condition, run as `writer`.
	 *
	 * @param {Function} fn - The condition.
	 * @param {object} writer - The module it runs as.
	 * @returns {Function} The pinned condition.
	 * @private
	 */
	#pinCondition(fn, writer) {
		const slothlet = this.slothlet;
		const pin = { moduleID: splitText(String(writer.____slothletInternal?.moduleID), MODULE_ID_SEPARATOR)[0], live: true };
		// instanceID and contextManager are read when the condition runs, so a rule replayed after a reload runs in
		// the current instance. rawErrors: a throw reaches the condition matcher unchanged, which treats it as no match.
		// Once its module is removed the condition no longer matches.
		const pinned = function slothlet_pinnedCondition(ctx, callMeta) {
			if (!pin.live) return false;
			return slothlet.contextManager.runInContext(slothlet.instanceID, fn, null, [ctx, callMeta], writer, true);
		};
		Objects.defineProperty(pinned, CONDITION_PIN, { __proto__: null, value: pin });
		return pinned;
	}

	/**
	 * Record the pins of a rule's function conditions, so the removal of the module each runs as revokes it (#625).
	 * Called as each rule is registered, a reload's replay included, which registers into a new manager.
	 *
	 * @param {*} condition - The rule's condition.
	 * @returns {void}
	 * @private
	 */
	#trackConditionPins(condition) {
		for (let ofIndex = 0, ofList = Arrays.isArray(condition) ? condition : [condition]; ofIndex < ofList.length; ofIndex++) {
			const entry = ofList[ofIndex];
			const pin = typeof entry === "function" ? entry[CONDITION_PIN] : undefined;
			if (!pin) continue;
			if (!MapMethods.has(this.#conditionPins, pin.moduleID)) MapMethods.set(this.#conditionPins, pin.moduleID, new Set());
			SetMethods.add(MapMethods.get(this.#conditionPins, pin.moduleID), pin);
		}
	}

	/**
	 * Refuse module code removing a rule it may not (#625). Host code removes any rule.
	 *
	 * A module removes the rules owned by its own module — those its code added; the ones registered on its behalf
	 * (its manifest's, an `api.add`'s) then meet the self-modification guard of {@link removeRule}. A module allowed
	 * to manage rules beyond its subtree (see {@link placeModuleRule}) also removes other modules' rules, never the
	 * host's (instance or runtime layer) or the framework's: to override one, it adds a rule of its own, which
	 * normal precedence then weighs.
	 *
	 * @param {string} ruleId - The rule about to be removed.
	 * @returns {void}
	 * @throws {SlothletError} `PERMISSION_RULE_INVALID` when module code may not remove the rule.
	 * @example
	 * pm.assertModuleRuleRemoval("perm-12");
	 */
	assertModuleRuleRemoval(ruleId) {
		this.#assertModuleRemoval(MapMethods.get(this.#rules, ruleId), ruleId);
	}

	/**
	 * Refuse module code removing an event rule it may not (#625), as {@link assertModuleRuleRemoval} does for a call
	 * or write rule. Host code removes any event rule.
	 *
	 * @param {string} ruleId - The event rule about to be removed.
	 * @returns {void}
	 * @throws {SlothletError} `PERMISSION_RULE_INVALID` when module code may not remove the event rule.
	 * @example
	 * pm.assertModuleEventRuleRemoval("evt-12");
	 */
	assertModuleEventRuleRemoval(ruleId) {
		this.#assertModuleRemoval(MapMethods.get(this.#eventRules, ruleId), ruleId);
	}

	/**
	 * Refuse module code removing the rule `entry` unless its own module added it, or the module may manage rules
	 * beyond its subtree and the rule is another module's.
	 *
	 * @param {object|undefined} entry - The rule entry; nothing to check when absent.
	 * @param {string} ruleId - The rule's id, for the error.
	 * @returns {void}
	 * @throws {SlothletError} `PERMISSION_RULE_INVALID` when module code may not remove the rule.
	 * @private
	 */
	#assertModuleRemoval(entry, ruleId) {
		if (!entry) return;
		const module = runtime_selfModuleReader(this.slothlet);
		if (module === null) return;
		const internal = module.____slothletInternal;
		if (internal && entry.ownerModuleID !== null && this.#sameOwner(entry.ownerModuleID, internal.moduleID)) return;
		const moduleOwned = entry.ownerModuleID !== null && entry.layer !== "builtin" && entry.layerRank < RULE_LAYER_RANK.instance;
		if (internal && moduleOwned && this.#mayReachBeyondOwn(String(internal.apiPath))) return;
		throw new this.SlothletError("PERMISSION_RULE_INVALID", {
			reason: translate("PERMISSION_RULE_REASON_REMOVAL_NOT_OWNED"),
			received: String(ruleId)
		});
	}

	/**
	 * A rule as it is registered: its own data fields, read once into a frozen copy (#625).
	 *
	 * The copy, not the object handed in, is what is checked, registered, and replayed on a reload, so a field that
	 * answers differently on a later read, or a change to the object afterwards, changes nothing. A field that is an
	 * accessor is refused. Anything that is no object is handed back for the rule validation to refuse.
	 *
	 * @param {*} rule - The rule handed in.
	 * @returns {*} The frozen copy, or `rule` when it is no object.
	 * @throws {SlothletError} `PERMISSION_RULE_INVALID` when a field is an accessor.
	 * @example
	 * const rule = pm.snapshotRule(input);
	 */
	snapshotRule(rule) {
		return this.#snapshotFields(rule, RULE_FIELDS);
	}

	/**
	 * An event rule as it is registered (`{ caller, event, effect, condition }`), read once into a frozen copy, as
	 * {@link snapshotRule} reads a call or write rule (#625).
	 *
	 * @param {*} rule - The event rule handed in.
	 * @returns {*} The frozen copy, or `rule` when it is no object.
	 * @throws {SlothletError} `PERMISSION_RULE_INVALID` when a field is an accessor.
	 * @example
	 * const rule = pm.snapshotEventRule(input);
	 */
	snapshotEventRule(rule) {
		return this.#snapshotFields(rule, EVENT_RULE_FIELDS);
	}

	/**
	 * Check a call or write rule as {@link addRule} would, without registering it, so a caller that registers rules
	 * after other work can refuse a bad one before doing that work (#872).
	 *
	 * @param {object} rule - The rule, as {@link snapshotRule} copied it.
	 * @returns {void}
	 * @throws {SlothletError} `PERMISSION_RULE_INVALID` or `PERMISSION_RULE_UNKNOWN_TARGET` when the rule is refused.
	 * @example
	 * pm.assertRuleValid(pm.snapshotRule(input));
	 */
	assertRuleValid(rule) {
		this.#validateRule(rule);
	}

	/**
	 * Check an event rule as {@link addEventRule} would, without registering it (#872).
	 *
	 * @param {object} rule - The event rule, as {@link snapshotEventRule} copied it.
	 * @returns {void}
	 * @throws {SlothletError} `PERMISSION_RULE_INVALID` when the rule is refused.
	 * @example
	 * pm.assertEventRuleValid(pm.snapshotEventRule(input));
	 */
	assertEventRuleValid(rule) {
		this.#validateEventRule(rule);
	}

	/**
	 * Read `fields` of a rule once into a frozen copy.
	 *
	 * @param {*} rule - The rule handed in.
	 * @param {ReadonlyArray<string>} fields - The data fields to copy.
	 * @returns {*} The frozen copy, or `rule` when it is no object.
	 * @throws {SlothletError} `PERMISSION_RULE_INVALID` when a field is an accessor.
	 * @private
	 */
	#snapshotFields(rule, fields) {
		if (rule === null || typeof rule !== "object") return rule;
		const copy = {};
		for (let ofIndex = 0, ofList = fields; ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			const descriptor = Reflect.getOwnPropertyDescriptor(rule, key);
			if (descriptor === undefined) continue;
			if (!("value" in descriptor)) {
				throw new this.SlothletError("PERMISSION_RULE_INVALID", {
					reason: translate("PERMISSION_RULE_REASON_FIELD_ACCESSOR"),
					received: key
				});
			}
			if (key === "condition") copy[key] = this.#snapshotCondition(descriptor.value, new Map());
			else
				copy[key] = key === "requires" && Arrays.isArray(descriptor.value) ? Objects.freeze(copyList(descriptor.value)) : descriptor.value;
		}
		return Objects.freeze(copy);
	}

	/**
	 * A rule's condition, copied once and deeply into frozen plain data (#625): arrays and plain objects are copied
	 * member by member, a function (a condition the grammar allows) is kept as it is, and so is any other value. A
	 * member that is an accessor is refused, and so is a Proxy anywhere in it: matching reads the condition on every
	 * check, so a trap of one would run then, as whichever caller is being checked.
	 *
	 * @param {*} value - The condition, or a part of it.
	 * @param {Map<object, object>} seen - Copies made so far, so a shared or cyclic part is copied once.
	 * @param {string} [at="condition"] - Where `value` sits in the rule, for the error.
	 * @returns {*} The frozen copy.
	 * @throws {SlothletError} `PERMISSION_RULE_INVALID` when a member is an accessor or a Proxy.
	 * @private
	 */
	#snapshotCondition(value, seen, at = "condition") {
		if (value === null || typeof value !== "object") return value;
		if (util.types.isProxy(value)) {
			throw new this.SlothletError("PERMISSION_RULE_INVALID", {
				reason: translate("PERMISSION_RULE_REASON_CONDITION_PROXY"),
				received: at
			});
		}
		if (MapMethods.has(seen, value)) return MapMethods.get(seen, value);
		const isArray = Arrays.isArray(value);
		const proto = Reflect.getPrototypeOf(value);
		if (!isArray && proto !== Objects.prototype && proto !== null) return value;
		const copy = isArray ? [] : Objects.create(proto);
		MapMethods.set(seen, value, copy);
		for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
			if (!descriptor.enumerable) continue;
			if (!("value" in descriptor)) {
				throw new this.SlothletError("PERMISSION_RULE_INVALID", {
					reason: translate("PERMISSION_RULE_REASON_FIELD_ACCESSOR"),
					received: `${at}.${String(key)}`
				});
			}
			copy[key] = this.#snapshotCondition(descriptor.value, seen, `${at}.${String(key)}`);
		}
		return Objects.freeze(copy);
	}

	/**
	 * Whether a module may manage rules beyond its own subtree: the call rules for `slothlet.permissions.rules.add`,
	 * the built-in reach default among them, decide for its caller path, and the winner allows. The default
	 * policy plays no part.
	 *
	 * @param {string} callerPath - The module's api path.
	 * @returns {boolean} Whether a rule lifts the built-in default for it.
	 * @private
	 */
	#mayReachBeyondOwn(callerPath) {
		return this.#defaultWinner(callerPath, "slothlet.permissions.rules.add").effect === "allow";
	}

	/**
	 * Refuse module code changing global metadata (#625): `metadata.global` changes what every node reports, every
	 * other module's included, so it is the host's by a built-in deny an allow for the module lifts. Like the other
	 * built-in rules it applies only while the permission system is on. It is checked once the call's arguments are
	 * valid, so a malformed call reports what is wrong with it first; the call gate leaves the built-in deny to this
	 * check, and weighs every other rule on the target as usual. Host code is not checked.
	 *
	 * @param {object|null} module - The calling module's wrapper ({@link runtime_selfModuleReader}), or null.
	 * @returns {void}
	 * @throws {SlothletError} `PERMISSION_DENIED` when no allow lifts the built-in deny for the module.
	 * @example
	 * pm.assertGlobalMetadataWrite(runtime_selfModuleReader(slothlet));
	 */
	assertGlobalMetadataWrite(module) {
		if (module === null || !this.#enabled) return;
		const callerPath = String(module.____slothletInternal?.apiPath ?? "");
		const winner = this.#defaultWinner(callerPath, GLOBAL_METADATA_TARGET);
		if (winner.effect === "allow") return;
		this.#emitAuditEvent("permission:denied", {
			caller: callerPath,
			target: GLOBAL_METADATA_TARGET,
			rule: this.#serializeRule(winner),
			conditionMatched: winner.condition != null
		});
		throw new this.SlothletError("PERMISSION_DENIED", { caller: callerPath, target: GLOBAL_METADATA_TARGET });
	}

	/**
	 * Refuse module code a built-in capability no rule opens for it (see {@link CAPABILITIES}). Only while the permission
	 * system is on; host code is never checked. The rules whose target is exactly `capability:<name>` decide for the
	 * caller's path, ranked as any rule is; a broader target (`**`) never names a capability.
	 *
	 * @param {object|null} caller - The module code's wrapper (the leaf running, or the file's own node for its top
	 *   level), the reader standing for code no one accounts for, or null for the host.
	 * @param {string} name - The capability.
	 * @param {string} route - What the code used, for the error (`new Function`, `vm.runInThisContext`, …).
	 * @param {"foreign-filename"|"binding"|null} [refusal=null] - Refuse whatever the rules say, for this reason: code
	 *   compiled under the name of a real file outside the caller's own folder, or through Node's binding, whose names
	 *   cannot be read.
	 * @returns {void}
	 * @throws {SlothletError} `PERMISSION_CAPABILITY_REFUSED` when no rule opens the capability for the caller, or for `refusal`.
	 * @example
	 * pm.assertCapability(leaf, "code", "new Function");
	 */
	assertCapability(caller, name, route, refusal = null) {
		if (caller === null || !this.#enabled) return;
		const target = `${CAPABILITY_PREFIX}${name}`;
		const callerPath = caller?.____slothletInternal ? String(caller.____slothletInternal.apiPath ?? "") : null;
		const winner = callerPath === null ? null : this.#capabilityWinner(callerPath, target);
		if (winner?.effect === "allow" && refusal === null) return;
		const reasonCode = refusal ?? (callerPath === null ? "unattributed" : "not-opened");
		this.#emitAuditEvent("permission:denied", {
			caller: callerPath,
			target,
			rule: winner ? this.#serializeRule(winner) : null,
			conditionMatched: winner?.condition != null
		});
		const reason = translate(CAPABILITY_REASONS[reasonCode]);
		const error = new this.SlothletError("PERMISSION_CAPABILITY_REFUSED", { caller: callerPath ?? "?", capability: name, route, reason });
		// Carried for code that branches on why; the message reads the translated `reason`.
		error.details.reasonCode = reasonCode;
		throw error;
	}

	/**
	 * Refuse a file's top-level code, as it first loads, a built-in capability (see {@link assertCapability}): decided
	 * for each path the code can run as (its module path, as the loader reads it before the build), all of which have to
	 * be opened.
	 *
	 * @param {ReadonlyArray<string>} paths - The paths.
	 * @param {string} name - The capability.
	 * @param {string} route - What the code used.
	 * @param {"foreign-filename"|"binding"|null} [refusal=null] - Refuse whatever the rules say, for this reason.
	 * @returns {void}
	 * @throws {SlothletError} `PERMISSION_CAPABILITY_REFUSED`.
	 * @example
	 * pm.assertCapabilityForPaths(["ext.render"], "code", "new Function");
	 */
	assertCapabilityForPaths(paths, name, route, refusal = null) {
		if (!this.#enabled) return;
		for (let ofIndex = 0, ofList = paths; ofIndex < ofList.length; ofIndex++) {
			const path = ofList[ofIndex];
			this.assertCapability({ ____slothletInternal: { apiPath: path } }, name, route, refusal);
		}
	}

	/**
	 * The rule that decides a capability for a caller: among the rules whose target is exactly the capability's (the
	 * built-in deny always among them), most specific first, then the higher layer, then the last registered.
	 *
	 * @param {string} callerPath - The caller's api path.
	 * @param {string} target - `capability:<name>`.
	 * @returns {object} The winning rule entry.
	 * @private
	 */
	#capabilityWinner(callerPath, target) {
		const runtimeContext = this.slothlet.contextManager?.tryGetContext?.(this.slothlet.instanceID)?.context ?? null;
		const conditioned = [];
		for (const entry of mapValues(this.#callRules)) {
			if (entry.target !== target || !this.#getCompiledPattern(entry.caller)(callerPath)) continue;
			if (this.#conditionMatches(entry, runtimeContext, null)) listPush(conditioned, entry);
		}
		this.#sortBySpecificity(
			conditioned,
			(entry) => this.#computeSpecificity(entry, callerPath, target),
			(entry) => this.#literalSegments(entry.caller)
		);
		return conditioned[0];
	}

	/**
	 * The built-in capabilities and the callers the rules open each for: for each capability, in the order code,
	 * imports, loader, the `caller` patterns of the allow rules whose target is exactly `capability:<name>`, most
	 * specific first, then the higher layer, then the newest. The built-in denies are not listed; a rule with a
	 * condition is listed as it is, its condition not evaluated.
	 *
	 * @returns {Array<{name: string, allowed: string[]}>} The report.
	 * @example
	 * pm.capabilityReport(); // [{ name: "code", allowed: ["ext.render"] }, { name: "imports", allowed: [] }, …]
	 */
	capabilityReport() {
		return mapList(CAPABILITIES, (name) => {
			const target = `${CAPABILITY_PREFIX}${name}`;
			const allows = [];
			for (const entry of mapValues(this.#callRules)) if (entry.target === target && entry.effect === "allow") listPush(allows, entry);
			this.#sortBySpecificity(
				allows,
				(entry) => this.#patternSpecificity(entry.caller, ""),
				(entry) => this.#literalSegments(entry.caller)
			);
			return { name, allowed: mapList(allows, (entry) => entry.caller) };
		});
	}

	/**
	 * The call rule that wins for `callerPath` on `targetPath` where a built-in default deny always matches: most
	 * specific first, then the higher layer, then the last registered. The default policy plays no part.
	 *
	 * @param {string} callerPath - The module's api path.
	 * @param {string} targetPath - The target the built-in default covers.
	 * @returns {object} The winning rule entry.
	 * @private
	 */
	#defaultWinner(callerPath, targetPath) {
		const runtimeContext = this.slothlet.contextManager?.tryGetContext?.(this.slothlet.instanceID)?.context ?? null;
		const conditioned = [];
		for (const entry of mapValues(this.#callRules)) {
			if (entry.hookType != null) continue;
			if (!this.#getCompiledPattern(entry.caller)(callerPath) || !this.#getCompiledPattern(entry.target)(targetPath)) continue;
			if (this.#conditionMatches(entry, runtimeContext, null)) listPush(conditioned, entry);
		}
		this.#sortBySpecificity(
			conditioned,
			(entry) => this.#computeSpecificity(entry, callerPath, targetPath),
			(entry) => this.#literalSegments(entry.caller) + this.#literalSegments(entry.target)
		);
		// The built-in default always matches, so there is a winner.
		return conditioned[0];
	}

	/**
	 * The write rule that decides a module's write, with no audit.
	 *
	 * Most-specific-wins (kind, then literal segments), then the higher layer, then the last registered, as for call rules. A rule module code
	 * added for its own subtree never lifts a built-in rule, so where a built-in deny matches, such allows are
	 * left out; the host, a manifest, and a module the host or its manifest let manage rules may lift one.
	 *
	 * @param {string} callerPath - Api path of the module writing.
	 * @param {string} targetPath - Api path written.
	 * @param {object|null} runtimeContext - Per-request context for condition evaluation.
	 * @returns {object|null} The deciding rule; null when no write rule matches.
	 * @private
	 */
	#decideWrite(callerPath, targetPath, runtimeContext) {
		const cacheKey = `${callerPath}\u0000${targetPath}${WRITE_TARGET_SUFFIX}`;
		if (MapMethods.has(this.#writeCache, cacheKey)) return MapMethods.get(this.#writeCache, cacheKey);
		let conditioned = [];
		let builtinDenied = false;
		let conditional = false;
		for (const entry of mapValues(this.#writeRules)) {
			if (!this.#getCompiledPattern(entry.caller)(callerPath) || !this.#getCompiledPattern(entry.writePathPattern)(targetPath)) continue;
			if (entry.condition != null || entry.requires != null) conditional = true;
			// A write has no call arguments — function conditions receive null callMeta.
			if (!this.#conditionMatches(entry, runtimeContext, null)) continue;
			listPush(conditioned, entry);
			if (entry.layer === "builtin" && entry.effect === "deny") builtinDenied = true;
		}
		const winner = conditioned.length === 0 ? null : this.#pickWrite(conditioned, builtinDenied, callerPath, targetPath);
		if (!conditional) MapMethods.set(this.#writeCache, cacheKey, winner);
		return winner;
	}

	/**
	 * The write rule that wins among the matching ones ({@link #decideWrite}).
	 *
	 * @param {object[]} conditioned - The matching rules whose conditions hold.
	 * @param {boolean} builtinDenied - Whether a built-in deny is among them.
	 * @param {string} callerPath - Api path of the module writing.
	 * @param {string} targetPath - Api path written.
	 * @returns {object} The deciding rule.
	 * @private
	 */
	#pickWrite(conditioned, builtinDenied, callerPath, targetPath) {
		if (builtinDenied) conditioned = filterList(conditioned, (entry) => entry.effect !== "allow" || entry.layer !== "module");
		this.#sortBySpecificity(
			conditioned,
			(entry) => this.#patternSpecificity(entry.caller, callerPath) + this.#patternSpecificity(entry.writePathPattern, targetPath),
			(entry) => this.#literalSegments(entry.caller) + this.#literalSegments(entry.writePathPattern)
		);
		return conditioned[0];
	}

	/**
	 * Decide a module's write to an api path by the write rules (`pattern:write`, #625): assigning, defining,
	 * or deleting a member at `targetPath` (a symbol-keyed member: the path of the node it is on), or changing
	 * the prototype or extensibility of the node there.
	 *
	 * Write rules are part of the permission system: with the system off (no `permissions` config, `enabled: false`,
	 * or after {@link disable}) none is evaluated, the built-in ones — the framework's namespace and root functions,
	 * and the framework's own keys on api nodes — included, and the ownership rule alone decides. An allow is a
	 * grant, a lift of a built-in rule included: the write goes through whatever the module owns. With no matching
	 * write rule the rules say nothing — `policy` grants nothing here — and the ownership rule alone decides.
	 * A denial is audited like any other.
	 *
	 * @param {string} callerPath - Api path of the module writing.
	 * @param {string} targetPath - Api path written.
	 * @param {object|null} [runtimeContext=null] - Per-request context for condition evaluation.
	 * @returns {"deny"|"grant"|null} The decision; null when no write rule matches or the system is off.
	 * @example
	 * pm.decideWrite("payments.charge", "slothlet.pin"); // "deny" — the built-in rule denies it
	 */
	decideWrite(callerPath, targetPath, runtimeContext = null) {
		if (!this.#enabled && !this.coversWrite(targetPath)) return null;
		const winner = this.#decideWrite(callerPath, targetPath, runtimeContext);
		if (winner === null) return null;
		if (winner.effect === "allow") return "grant";
		this.#emitAuditEvent("permission:denied", {
			caller: callerPath,
			target: `${targetPath}${WRITE_TARGET_SUFFIX}`,
			rule: this.#serializeRule(winner),
			conditionMatched: winner.condition != null
		});
		return "deny";
	}

	/**
	 * The write rules whose caller pattern matches `callerPath`, as one string of their ids: two callers given the same
	 * string are answered alike by the write rules for every write either could make. Kept until the rules change.
	 *
	 * @param {string} callerPath - Api path of a module's function.
	 * @returns {string} The ids, in the order the rules were added; empty while the system is off or no rule names it.
	 * @example
	 * pm.writeRulesFor("reader.x") === pm.writeRulesFor("reader.y"); // true when no write rule tells the two apart
	 */
	writeRulesFor(callerPath) {
		if (!this.#enabled) return "";
		const cached = MapMethods.get(this.#writeRulesForCache, callerPath);
		if (cached !== undefined) return cached;
		const ids = [];
		for (const entry of mapValues(this.#writeRules)) if (this.#getCompiledPattern(entry.caller)(callerPath)) listPush(ids, entry.id);
		const signature = ArrayMethods.join(ids, "\u0000");
		MapMethods.set(this.#writeRulesForCache, callerPath, signature);
		return signature;
	}

	/**
	 * What the write rules say about every write `callerPath` could make at `targetPath` or anywhere beneath it (#667),
	 * read from the rule set alone and kept until the rules change: `"deny"` when a rule could refuse one of them (a
	 * deny whose pattern can reach the subtree, or one with a condition), `"grant"` when allows cover the whole subtree
	 * and nothing could refuse, and null when the rules leave it to ownership. A value held as itself takes no check of
	 * its own, so a reader is handed one only when nothing beneath its path would be refused for it. The built-in rules
	 * on the framework's own keys of api nodes are left out: a value beneath a node is no node.
	 *
	 * @param {string} callerPath - Api path of the module writing.
	 * @param {string} targetPath - Api path of the subtree's root.
	 * @returns {"deny"|"grant"|null} The verdict; null while the system is off.
	 * @example
	 * pm.writeSubtree("reader.x", "owner.Foo.prototype"); // "grant" under { caller: "reader.**", target: "owner.**:write", effect: "allow" }
	 */
	writeSubtree(callerPath, targetPath) {
		if (!this.#enabled) return null;
		const cacheKey = `${callerPath}\u0000${targetPath}`;
		if (MapMethods.has(this.#subtreeCache, cacheKey)) return MapMethods.get(this.#subtreeCache, cacheKey);
		const target = filterList(splitText(targetPath, "."), Boolean);
		let granted = false;
		let verdict = null;
		for (const entry of mapValues(this.#writeRules)) {
			if (SetMethods.has(this.#nodeKeyRuleIds, entry.id) || !this.#getCompiledPattern(entry.caller)(callerPath)) continue;
			const conditional = entry.condition != null || entry.requires != null;
			if (entry.effect === "deny") {
				if (runtime_patternReaches(entry.writePathPattern, target)) {
					verdict = "deny";
					break;
				}
			} else if (
				!conditional &&
				!granted &&
				runtime_patternCovers(entry.writePathPattern, target, (pattern) => this.#getCompiledPattern(pattern))
			) {
				granted = true;
			}
		}
		if (verdict === null && granted) verdict = "grant";
		MapMethods.set(this.#subtreeCache, cacheKey, verdict);
		return verdict;
	}

	/**
	 * Whether the call and read rules could refuse `callerPath` a call or read at `targetPath` or anywhere beneath it,
	 * read from the rule set alone: a deny `policy`, or a deny or conditional rule for the caller whose target
	 * pattern can reach the subtree. A value held as itself takes no check of its own, so a reader is handed one that
	 * reaches a node's own members only when no read of them could be refused. Hook-target rules decide no read.
	 *
	 * @param {string} callerPath - Api path of the module reading.
	 * @param {string} targetPath - Api path of the subtree's root (`""` for the api root).
	 * @returns {boolean} True when some read could be refused; false while the system is off.
	 * @example
	 * pm.readMayRefuseBeneath("reader.at", "zz"); // true under { caller: "reader.**", target: "zz.tag", effect: "deny" }
	 */
	readMayRefuseBeneath(callerPath, targetPath) {
		if (!this.#enabled) return false;
		if (this.#defaultPolicy !== "allow") return true;
		const cacheKey = `${callerPath}\u0000${targetPath}`;
		const cached = MapMethods.get(this.#readSubtreeCache, cacheKey);
		if (cached !== undefined) return cached;
		const target = filterList(splitText(targetPath, "."), Boolean);
		let refuses = false;
		for (const entry of mapValues(this.#callRules)) {
			if (entry.hookType != null || entry.id === this.#reachRuleId || entry.id === this.#globalMetadataRuleId) continue;
			if (entry.effect !== "deny" && entry.condition == null && entry.requires == null) continue;
			if (!this.#getCompiledPattern(entry.caller)(callerPath)) continue;
			if (runtime_patternReaches(entry.target, target)) {
				refuses = true;
				break;
			}
		}
		MapMethods.set(this.#readSubtreeCache, cacheKey, refuses);
		return refuses;
	}

	/**
	 * Whether a write rule grants `callerPath` the write to `targetPath` ({@link decideWrite} answering
	 * `"grant"`), with no audit.
	 *
	 * @param {string} callerPath - Api path of the module writing.
	 * @param {string} targetPath - Api path written.
	 * @param {object|null} [runtimeContext=null] - Per-request context for condition evaluation.
	 * @returns {boolean} Whether the write is granted.
	 * @example
	 * pm.isWriteGranted("guest.x", "victim.v.note"); // true under { caller: "guest.**", target: "victim.**:write", effect: "allow" }
	 */
	isWriteGranted(callerPath, targetPath, runtimeContext = null) {
		if (!this.#enabled && !this.coversWrite(targetPath)) return false;
		return this.#decideWrite(callerPath, targetPath, runtimeContext)?.effect === "allow";
	}

	/**
	 * Call-gate query (#508): would `callerPath` be allowed to CALL `targetPath` with `args`? The
	 * audited, argument-aware twin of {@link checkAccess} — it evaluates exactly what the real call gate
	 * evaluates, for a supplied caller identity, without invoking anything.
	 *
	 * - Function conditions receive `callMeta = { args, target: targetPath }`, the shape the call gate
	 *   builds, so a rule that authorizes on the resource named in the call answers correctly.
	 * - The caller is a MODULE with no source file: the self-call bypass never applies, and a
	 *   module-private (`_`-prefixed) target is denied outright rather than judged by the
	 *   `permissions.private.host` policy.
	 * - A `requires` rule whose principal is stale is resolved first and the decision re-evaluated
	 *   with principal grace, mirroring a promoted call (#459). Only then is the result a Promise; the
	 *   fast path (nothing stale) answers synchronously.
	 * - Audit events emit as for a real call (`permission:denied` always, `allowed`/`default` under
	 *   `audit: "verbose"`), with `via: ["slothlet", "permissions", "global", "check", "call"]` in the payload so a probing peer is visible.
	 * - Disabled enforcement answers `true`, like {@link checkAccess}.
	 *
	 * @param {string} callerPath - The supplied caller's api path (non-empty).
	 * @param {string} targetPath - The target api path being called (non-empty).
	 * @param {Array<*>} [args=[]] - The arguments of the call being asked about; omit for an argument-less call.
	 * @param {object|null} [runtimeContext=null] - Per-request ALS context for condition evaluation.
	 * @returns {boolean|Promise<boolean>} The gate's decision; a Promise only when a stale principal had to be resolved.
	 * @throws {SlothletError} INVALID_ARGUMENT when `callerPath` / `targetPath` is not a non-empty string
	 *   or `args` is neither an array nor null/undefined.
	 * @example
	 * const ok = pm.checkCall("client.app", "project.files.list", ["p1"], { user: "u1" });
	 * if (ok instanceof Promise) await ok;
	 */
	checkCall(callerPath, targetPath, args = [], runtimeContext = null) {
		if (typeof callerPath !== "string" || callerPath.length === 0) {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "callerPath",
				expected: "a non-empty string",
				received: typeof callerPath
			});
		}
		if (typeof targetPath !== "string" || targetPath.length === 0) {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "targetPath",
				expected: "a non-empty string",
				received: typeof targetPath
			});
		}
		// `null`/`undefined` both mean "no arguments", as on every other optional bag in the api.
		const callArgs = args == null ? [] : args;
		if (!Arrays.isArray(callArgs)) {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "args",
				expected: "an array",
				received: typeof callArgs
			});
		}

		const callMeta = { args: callArgs, target: targetPath };
		// Scan-then-enforce, as the promoted call gate does (#459): a stale principal is resolved first,
		// and the enforcement after the scan runs with principal grace so a `ttl` expiring between the
		// two clock reads cannot flip the verdict.
		const stale = this.stalePrincipals(callerPath, targetPath, null, null, runtimeContext);
		if (stale.length > 0) {
			return PromiseMethods.then(this.resolvePrincipals(stale), () =>
				this.enforceAccess(callerPath, targetPath, null, null, runtimeContext, callMeta, CHECK_CALL_OPTIONS)
			);
		}
		return this.enforceAccess(callerPath, targetPath, null, null, runtimeContext, callMeta, CHECK_CALL_OPTIONS);
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
	 * @param {string} hookType - Hook type: "before", "after", "always", "error", or "around".
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
	 * @param {string} hookType - Hook type: "before", "after", "always", "error", or "around".
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
		for (const entry of mapValues(this.#rules)) {
			const targetMatcher = this.#getCompiledPattern(entry.target);
			if (targetMatcher(targetPath)) {
				listPush(matching, this.#serializeRule(entry));
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
		for (const entry of mapValues(this.#rules)) {
			if (entry.ownerModuleID === moduleID) {
				listPush(matching, this.#serializeRule(entry));
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
		for (const entry of mapValues(this.#rules)) {
			const callerMatcher = this.#getCompiledPattern(entry.caller);
			if (callerMatcher(callerPath)) {
				listPush(matching, this.#serializeRule(entry));
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
		this.#assertNotStrict("enable");
		this.#assertNotSealed();
		this.#enabled = true;
		this.#endedOn = false;
		this.#disabled = false;
		// The event pool follows the mode: levels resolved under the old one are resolved again.
		this.#eventRulesEpoch++;
		this.#clearCache();
	}

	/**
	 * Throw if the mode is `"strict"`, which is chosen in the config only and cannot be left or entered at runtime.
	 * @param {string} method - The control method called.
	 * @returns {void}
	 * @throws {SlothletError} PERMISSION_STRICT_FIXED under strict.
	 * @private
	 */
	#assertNotStrict(method) {
		if (this.#strict) throw new this.SlothletError("PERMISSION_STRICT_FIXED", { method });
	}

	/**
	 * Throw if the control surface is sealed. Called at the start of every policy-mutating method.
	 * @returns {void}
	 * @throws {SlothletError} PERMISSION_SEALED when {@link seal} has been called.
	 * @private
	 */
	#assertNotSealed() {
		if (this.#sealed) {
			throw new this.SlothletError("PERMISSION_SEALED", {});
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
	 * Built-in deny rules for the default routines' root paths (#529), applied once the instance's
	 * `routines` config has been normalized.
	 *
	 * @description
	 * A default routine (`slothlet.defaults.routines` — `initialize` → `startup`, `shutdown` →
	 * `shutdown`) is the framework's own lifecycle entry point while it is configured, so its root path
	 * (`api.initialize()`, `api.shutdown()`) is host-only, like `slothlet.shutdown`. The rule is added
	 * only for a default that is present in the effective `routines` list, matched on name AND mode: a
	 * renamed routine, the same name with a different mode, a replaced list or `routines: []` leaves
	 * those paths as ordinary routines with no built-in rule. Decided per instance at load time — a
	 * reload re-runs it against the same config, a restart against the original one. The root entry
	 * points (`api.shutdown()`, a routine's root cascade) check their path at entry only;
	 * framework-internal runs of the same routines are never gated.
	 *
	 * @param {Array<{name: string, mode: string}>|null|undefined} routines - Normalized routines config.
	 * @returns {void}
	 * @example
	 * pm.applyDefaultRoutineRules(config.routines);
	 */
	applyDefaultRoutineRules(routines) {
		if (!Arrays.isArray(routines)) return;
		for (let ofIndex = 0, ofList = DEFAULT_ROUTINES; ofIndex < ofList.length; ofIndex++) {
			const fallback = ofList[ofIndex];
			if (!ArrayMethods.some(routines, (routine) => routine?.name === fallback.name && routine?.mode === fallback.mode)) continue;
			this.addRule({ caller: "**", target: fallback.name, effect: "deny" }, "__builtin__");
		}
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
		this.#assertNotStrict("disable");
		this.#assertNotSealed();
		this.#enabled = false;
		this.#endedOn = false;
		this.#disabled = false;
		// The event pool follows the mode: levels resolved under the old one are resolved again.
		this.#eventRulesEpoch++;
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
	 * Whether the permission system was on when the instance shut down. Values handed to modules as views while it
	 * was on are still held to what their holders could write then.
	 *
	 * @returns {boolean} True when it was.
	 * @example
	 * if (pm.isEnabled() || pm.wasOnAtShutdown()) { ... }
	 */
	wasOnAtShutdown() {
		return this.#endedOn;
	}

	/**
	 * Run the permission baseline as the instance starts (see `helpers/permission-baseline`), when the mode is on or
	 * strict. Under on, each check not met is one warning; under strict, any check not met refuses the start.
	 * @param {"node"|"browser"} envTarget - Where the instance runs.
	 * @returns {Promise<void>}
	 * @throws {SlothletError} PERMISSION_BASELINE_UNMET under strict, naming the checks not met.
	 * @example
	 * await pm.checkBaseline("node");
	 */
	async checkBaseline(envTarget) {
		this.#baseline = null;
		if (!this.#enabled) return;
		const baseline = await runBaseline(envTarget);
		this.#baseline = baseline;
		if (baseline.met) return;
		const unmet = filterList(baseline.checks, (entry) => !entry.met);
		if (this.#strict) {
			throw new this.SlothletError("PERMISSION_BASELINE_UNMET", {
				checks: ArrayMethods.join(
					mapList(unmet, (entry) => entry.id),
					", "
				)
			});
		}
		for (let ofIndex = 0, ofList = unmet; ofIndex < ofList.length; ofIndex++) {
			const entry = ofList[ofIndex];
			new this.SlothletWarning("WARNING_PERMISSION_BASELINE_UNMET", { check: entry.id, reason: entry.reason });
		}
	}

	/**
	 * The mode, what the permission baseline found when the instance started, and the capabilities rules open.
	 * @returns {{mode: string, baseline: {met: boolean|null, checks: Array<{id: string, met: boolean, reason: string|null}>}, capabilities: Array<{name: string, allowed: string[]}>}}
	 *   The report; `baseline.met` is null when no check ran (the mode was off or disabled at start).
	 * @example
	 * pm.report(); // { mode: "on", baseline: { met: true, checks: [...] }, capabilities: [...] }
	 */
	report() {
		const baseline = this.#baseline;
		return {
			mode: this.mode(),
			baseline: baseline
				? { met: baseline.met, checks: mapList(baseline.checks, (entry) => ({ id: entry.id, met: entry.met, reason: entry.reason })) }
				: { met: null, checks: [] },
			// The capabilities and the callers rules open each to, where this copy has them.
			capabilities: typeof this.capabilityReport === "function" ? this.capabilityReport() : []
		};
	}

	/**
	 * The permission system's mode: `"on"` (every rule applies), `"strict"` (as on, chosen in the config only, with the
	 * permission baseline met), `"off"` (only the built-in rules that keep module code off the framework's own namespace,
	 * root functions, and keys on api nodes, and the host rules on what they cover), or `"disabled"` (nothing applies).
	 *
	 * @returns {"on"|"strict"|"off"|"disabled"} The mode.
	 * @example
	 * pm.mode(); // "off" with no permissions config
	 */
	mode() {
		if (this.#enabled) return this.#strict ? "strict" : "on";
		return this.#disabled ? "disabled" : "off";
	}

	/**
	 * Whether a built-in write rule covers a write to `targetPath`: the framework's own namespace, root functions, and
	 * keys on api nodes. Such a write is checked unless the permission system is disabled.
	 *
	 * @param {string} targetPath - Api path written.
	 * @returns {boolean} Whether a built-in write rule covers it.
	 * @example
	 * pm.coversWrite("slothlet.metadata"); // true
	 */
	coversWrite(targetPath) {
		if (this.#disabled) return false;
		// The built-in write rules cover `<root>`, `<root>.**` for each framework root, and `<key>`, `**.<key>` for
		// each framework key on api nodes: decided from the path's first and last segments.
		const first = StringMethods.indexOf(targetPath, ".");
		if (SetMethods.has(FRAMEWORK_ROOTS, first === -1 ? targetPath : StringMethods.slice(targetPath, 0, first))) return true;
		return SetMethods.has(FRAMEWORK_WRITE_KEYS, StringMethods.slice(targetPath, StringMethods.lastIndexOf(targetPath, ".") + 1));
	}

	/**
	 * Whether terminal data-value property reads are permission-gated.
	 * Separate from {@link isEnabled} so call enforcement is unaffected by this default-on
	 * flag (opt out via `permissions.gating.read: false`).
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
				received: typeof value
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
		for (const entry of mapValues(this.#rules)) {
			listPush(rules, {
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
		if (!Arrays.isArray(registrations)) return;
		for (let ofIndex = 0, ofList = registrations; ofIndex < ofList.length; ofIndex++) {
			const reg = ofList[ofIndex];
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
		MapMethods.clear(this.#rules);
		MapMethods.clear(this.#callRules);
		MapMethods.clear(this.#writeRules);
		MapMethods.clear(this.#principals);
		this.#requiresRuleCount = 0;
		MapMethods.clear(this.#resolvedCache);
		MapMethods.clear(this.#compiledCache);
		if (this.#enabled) this.#endedOn = true;
		this.#enabled = false;
		this.#disabled = false;
		this.#strict = false;
		this.#eventRulesEpoch++;
		this.#defaultPolicy = "allow";
		this.#audit = "default";
		this.#readGating = false;
		this.#owner = false;
	}

	// ──────────────────── Private methods ────────────────────

	/**
	 * Validate a rule object.
	 *
	 * @param {object} rule - Rule to validate.
	 * @throws {SlothletError} PERMISSION_RULE_INVALID if malformed.
	 * @private
	 */
	#validateRule(rule) {
		if (!rule || typeof rule !== "object") {
			throw new this.SlothletError("PERMISSION_RULE_INVALID", {
				reason: translate("PERMISSION_RULE_REASON_NOT_OBJECT"),
				received: typeof rule
			});
		}
		if (typeof rule.caller !== "string" || !rule.caller) {
			throw new this.SlothletError("PERMISSION_RULE_INVALID", {
				reason: translate("PERMISSION_RULE_REASON_CALLER_REQUIRED"),
				received: typeof rule.caller
			});
		}
		if (typeof rule.target !== "string" || !rule.target) {
			throw new this.SlothletError("PERMISSION_RULE_INVALID", {
				reason: translate("PERMISSION_RULE_REASON_TARGET_REQUIRED"),
				received: typeof rule.target
			});
		}
		if (rule.effect !== "allow" && rule.effect !== "deny") {
			throw new this.SlothletError("PERMISSION_RULE_INVALID", {
				reason: translate("PERMISSION_RULE_REASON_EFFECT_INVALID"),
				received: rule.effect
			});
		}
		// A target in slothlet's own space names something that exists: a built-in capability, or a member of the fixed
		// `slothlet.*` tree. One that names nothing would never match, so a rule meant to deny it would silently not apply.
		if (
			StringMethods.startsWith(rule.target, CAPABILITY_PREFIX)
				? !ArrayMethods.includes(CAPABILITIES, StringMethods.slice(rule.target, CAPABILITY_PREFIX.length))
				: StringMethods.startsWith(rule.target, "slothlet.") && !namesSlothletMember(rule.target)
		) {
			throw new this.SlothletError("PERMISSION_RULE_UNKNOWN_TARGET", { target: rule.target, capabilities: ArrayMethods.join(CAPABILITIES, ", ") });
		}
		if (rule.condition !== undefined && rule.condition !== null) {
			this.#assertValidConditionPayload(rule.condition, "PERMISSION_RULE_INVALID");
		}
		if (rule.requires !== undefined && rule.requires !== null) {
			const valid =
				Arrays.isArray(rule.requires) &&
				rule.requires.length > 0 &&
				ArrayMethods.every(rule.requires, (name) => typeof name === "string" && name.length > 0);
			if (!valid) {
				throw new this.SlothletError("PERMISSION_RULE_INVALID", {
					reason: translate("PERMISSION_RULE_REASON_PRINCIPALS_INVALID"),
					received: Arrays.isArray(rule.requires) ? "array" : typeof rule.requires
				});
			}
		}
	}

	/**
	 * Validate a condition payload shape for either public helper calls or rule registration.
	 * Conditions must be a plain object, a function, or a non-empty array of those entries.
	 *
	 * @param {unknown} condition - Condition payload to validate.
	 * @param {"INVALID_ARGUMENT"|"PERMISSION_RULE_INVALID"} errorCode - Error code to throw on invalid input.
	 * @returns {void}
	 * @throws {SlothletError} When the condition shape is invalid.
	 * @private
	 */
	#assertValidConditionPayload(condition, errorCode) {
		const getValueType = (value) => {
			if (value === null) return "null";
			if (Arrays.isArray(value)) return "array";
			return typeof value;
		};

		const isPlainObject = (value) => {
			if (value === null || typeof value !== "object") return false;
			const proto = Objects.getPrototypeOf(value);
			return proto === Objects.prototype || proto === null;
		};

		const isValidConditionEntry = (value) => typeof value === "function" || isPlainObject(value);
		const entries = Arrays.isArray(condition) ? condition : [condition];
		const invalidEntry = entries.length === 0 ? condition : ArrayMethods.find(entries, (entry) => !isValidConditionEntry(entry));
		if (entries.length > 0 && invalidEntry === undefined) return;

		const received = getValueType(invalidEntry);
		if (errorCode === "PERMISSION_RULE_INVALID") {
			throw new this.SlothletError("PERMISSION_RULE_INVALID", {
				reason: translate("PERMISSION_RULE_REASON_CONDITION_INVALID"),
				received
			});
		}

		throw new this.SlothletError("INVALID_ARGUMENT", {
			argument: "condition",
			expected: translate("PERMISSION_RULE_REASON_CONDITION_INVALID"),
			received
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
		for (let ofIndex = 0, ofList = Objects.entries(pattern); ofIndex < ofList.length; ofIndex++) {
			const ofEntry = ofList[ofIndex],
				key = ofEntry[0],
				val = ofEntry[1];
			// Only recurse into plain objects; treat class instances / Date / etc. as leaves
			const proto = val !== null && typeof val === "object" ? Objects.getPrototypeOf(val) : null;
			const isPlainNested = proto === Objects.prototype || proto === null;
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
	 * @param {boolean} [moduleCaller=false] - The caller is a module with no known source file (#508), so a
	 *   module-private target is denied instead of judged by the host policy. Decided before the cache,
	 *   so it never affects caching either.
	 * @param {function(string): boolean|null} [dataMember=null] - For a read of data, whether a path above the target is
	 *   an object member of a module's data (see {@link enforceAccess}).
	 * @returns {{ allowed: boolean, event: string|null, payload: object|null, hasConditionalRules?: boolean }} Decision record.
	 * @private
	 */
	#resolveAccess(
		callerPath,
		targetPath,
		callerFilePath,
		targetFilePath,
		runtimeContext,
		useCache,
		callMeta,
		moduleCaller = false,
		dataMember = null
	) {
		// Global toggle: when off, everything is allowed (no event to emit).
		// Exception: slothlet.permissions.control.** is always subject to rule evaluation while the system is off
		// (not disabled), so the built-in deny rule protects the toggle surface.
		// The principal management surface (#459) gets the same always-evaluated treatment, so a module
		// cannot register or replace a resolver while enforcement happens to be switched off.
		const isControlTarget =
			!this.#disabled &&
			((targetPath == null ? undefined : StringMethods.startsWith(targetPath, "slothlet.permissions.control.")) ||
				(targetPath == null ? undefined : StringMethods.startsWith(targetPath, "slothlet.permissions.principal.")));
		if (!this.#enabled && !isControlTarget) return { allowed: true, event: null, payload: null };

		// Self-call bypass: same source file always allowed
		if (callerFilePath && targetFilePath && callerFilePath === targetFilePath) {
			return {
				allowed: true,
				event: "permission:self-bypass",
				payload: { caller: callerPath, target: targetPath, filePath: callerFilePath }
			};
		}

		// Module privacy (#260): a `_`/`__`-prefixed member is private to its module. Enforced HERE —
		// before rules and before the cache — deliberately: the api path is a lossy projection of the
		// module tree, so no rule glob can encode "same module" (the guarantee is absolute, not
		// overridable by user rules), and the decision cache is keyed by path pair alone, which cannot
		// distinguish two callers' module identities. Under `private.scope: "module"` (the default) the
		// module is the module ID that currently owns the member's path, read live from the ownership
		// registry like the owner grant, so it needs no file paths and moves with add/remove/reload.
		// Under `"folder"` it is the directory of the two source files.
		// The injected `slothlet.*` control tree is framework surface, not module exports — its
		// members have no source files and no owning module, and internal machinery probes it with
		// synthetic `__`-prefixed children (`slothlet.permissions.__probe__`). Module privacy never
		// applies there.
		if (runtime_isPrivateName(targetPath) && targetPath !== "slothlet" && !StringMethods.startsWith(targetPath, "slothlet.")) {
			const sameModule =
				this.#privateScope === "folder"
					? Boolean(callerFilePath && targetFilePath && runtime_sameModuleDir(callerFilePath, targetFilePath))
					: this.#privateOwner(callerPath, targetPath) !== null;
			if (sameModule) {
				return {
					allowed: true,
					event: "permission:private-module-bypass",
					payload: { caller: callerPath, target: targetPath, filePath: callerFilePath }
				};
			}
			// No caller identity = the host (module callers always carry a file path at the
			// enforcement sites). The host obeys the configured policy — secure default deny.
			// A caller declared a module without a file (#508: the call-gate query answers for a
			// supplied module identity) is never the host, so the host policy does not apply to it.
			if (!callerFilePath && !moduleCaller && this.#privateHost === "allow") {
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

		// The object members above a data target that a deny rule names exactly: the rule covers what they hold.
		let inherited = NO_PREFIXES;
		if (dataMember !== null) {
			const prefixes = this.#exactDenyPrefixesOf(targetPath);
			if (prefixes.length !== 0) inherited = filterList(prefixes, (prefix) => dataMember(prefix));
		}

		// Check resolved cache
		const cacheKey =
			inherited.length === 0 ? `${callerPath}::${targetPath}` : `${callerPath}::${targetPath}::${ArrayMethods.join(inherited, "::")}`;
		let entry;
		if (useCache && MapMethods.has(this.#resolvedCache, cacheKey)) {
			entry = MapMethods.get(this.#resolvedCache, cacheKey);
		} else {
			// Evaluate rules — returns { allowed, event, payload, hasConditionalRules }
			entry = this.#evaluate(callerPath, targetPath, runtimeContext, callMeta, inherited);
			// Do NOT cache when any matching rule has a condition — results vary by runtime context
			if (useCache && !entry.hasConditionalRules) {
				MapMethods.set(this.#resolvedCache, cacheKey, entry);
			}
		}

		// Owner grant (#509): an implicit allow that stands in for the DEFAULT policy only — a matching
		// explicit rule (allow or deny) has already decided, so a deny rule always wins over it. Applied
		// after the cache, never stored in it: ownership moves with add/remove/reload without touching any
		// rule, so the cached record stays the rules-only verdict and ownership is read live each time.
		if (this.#owner && !entry.allowed && entry.event === "permission:default") {
			const moduleID = this.#sharedOwner(callerPath, targetPath);
			if (moduleID !== null) {
				return {
					allowed: true,
					event: "permission:owner-allow",
					payload: { caller: callerPath, target: targetPath, moduleID }
				};
			}
		}
		return entry;
	}

	/**
	 * The module a private member's reader and the member both belong to, or null (#260).
	 *
	 * @param {string|null} callerPath - The reading leaf's api path; null for the host.
	 * @param {string} targetPath - The private member's api path.
	 * @returns {string|null} The shared owner's moduleID, or null when either has no owner or they differ.
	 * @private
	 *
	 * @description
	 * Both owners are the ownership registry's current owner of the exact path, the identity the owner grant reads: the
	 * base module for the initial load, an `api.add()`'s moduleID (given or generated) for what it composed, and the
	 * add's moduleID for an in-memory object leaf. A caller with no path (the host) or a path nothing owns has no
	 * module, so it is refused here and left to the host policy.
	 */
	#privateOwner(callerPath, targetPath) {
		const ownership = this.slothlet.handlers?.ownership;
		if (!callerPath || !ownership) return null;
		const callerOwner = ownership.getCurrentOwner(callerPath)?.moduleID ?? null;
		const targetOwner = ownership.getCurrentOwner(targetPath)?.moduleID ?? null;
		if (callerOwner === null || targetOwner === null) return null;
		return this.#sameOwner(callerOwner, targetOwner) ? callerOwner : null;
	}

	/**
	 * The module that currently owns both `callerPath` and `targetPath`, or null (#509).
	 *
	 * @param {string|null} callerPath - Caller leaf's api path.
	 * @param {string} targetPath - Target api path.
	 * @returns {string|null} The shared owner's moduleID, or null when the owners differ or either is unknown.
	 * @private
	 *
	 * @description
	 * Ownership is the registry's CURRENT owner of each exact path — the module whose contribution is
	 * live there after collision handling (the initial load's base module, or the moduleID of an
	 * `api.add()`). Matching by owner rather than by path keeps a shared mount honest: a second module
	 * merged into the same namespace owns its own leaves, not the first module's. A path with no
	 * ownership entry grants nothing (fail closed) — the grant never climbs to an ancestor namespace,
	 * whose current owner under a shared mount is whichever module registered it last. The framework's
	 * reserved roots (`slothlet.*`, `shutdown`, `destroy`) are registered to the base module as part of
	 * the composed tree, but they are framework surface, not module code, so they are never granted.
	 */
	#sharedOwner(callerPath, targetPath) {
		if (SetMethods.has(FRAMEWORK_ROOTS, splitText(String(targetPath), ".", 1)[0])) return null;
		const ownership = this.slothlet.handlers.ownership;
		// A caller path with no ownership entry (null/empty, or a path nothing registered) owns nothing.
		const callerOwner = ownership.getCurrentOwner(callerPath)?.moduleID;
		if (!callerOwner) return null;
		return ownership.getCurrentOwner(targetPath)?.moduleID === callerOwner ? callerOwner : null;
	}

	/**
	 * Evaluate all rules for a caller→target pair.
	 * Most-specific-wins (kind, then literal segments); tiebreak: higher layer, then last-registered.
	 * An optional runtimeContext filters rules by their condition field.
	 *
	 * @param {string} callerPath - Caller API path.
	 * @param {string} targetPath - Target API path.
	 * @param {object|null} [runtimeContext=null] - Per-request ALS context for condition evaluation.
	 * @param {PermissionCallMeta|null} callMeta - Call/construct metadata (#455) forwarded to function
	 *   conditions; `null` off the call/construct path.
	 * @param {string[]} [inherited] - Object members above the target whose exact deny rules cover it, each taken as a
	 *   rule on `member.**`.
	 * @returns {{ allowed: boolean, event: string, payload: object, hasConditionalRules: boolean }} Decision record (does not emit; caller must emit).
	 * @private
	 */
	#evaluate(callerPath, targetPath, runtimeContext = null, callMeta, inherited = NO_PREFIXES) {
		// Collect all path-matching rules
		const matches = [];

		for (const entry of mapValues(this.#callRules)) {
			// Hook-target rules (pattern:type) gate interception, never plain calls — skip them here. So is the built-in
			// reach default (see placeModuleRule), which decides only what rules module code may add, never the call to
			// `addRule` itself. Write rules are kept apart and never scanned here.
			if (entry.hookType != null || entry.id === this.#reachRuleId || entry.id === this.#globalMetadataRuleId) continue;
			const callerMatcher = this.#getCompiledPattern(entry.caller);
			const targetMatcher = this.#getCompiledPattern(entry.target);

			if (callerMatcher(callerPath) && targetMatcher(targetPath)) {
				listPush(matches, entry);
			} else if (
				inherited.length !== 0 &&
				entry.effect === "deny" &&
				ArrayMethods.includes(inherited, entry.target) &&
				callerMatcher(callerPath)
			) {
				// A deny naming an object member exactly covers what the member holds, ranked as a rule on `member.**`.
				listPush(matches, { ...entry, target: `${entry.target}.**`, coveredBy: entry });
			}
		}

		// Track whether any path-matching rule has a condition (used for cache safety). A `requires` rule
		// counts too (#459): its verdict depends on principal state, which changes without a rule change.
		const hasConditionalRules = ArrayMethods.some(matches, (m) => m.condition != null || m.requires != null);

		// Filter out rules whose condition does not match the current runtime context. callMeta (#455) is
		// forwarded so a function condition can also gate on the call's own args + concrete target.
		const conditioned = filterList(matches, (entry) => this.#conditionMatches(entry, runtimeContext, callMeta));

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

		// Most-specific-wins (primary: kind, then literal segments). Equal specificity → higher precedence layer wins
		// (runtime > instance > manifest > builtin); within a layer → last-registered wins.
		this.#sortBySpecificity(
			conditioned,
			(entry) => this.#computeSpecificity(entry, callerPath, targetPath),
			(entry) => this.#literalSegments(entry.caller) + this.#literalSegments(entry.target)
		);
		const winner = conditioned[0];
		const allowed = winner.effect === "allow";

		return {
			allowed,
			event: allowed ? "permission:allowed" : "permission:denied",
			payload: {
				caller: callerPath,
				target: targetPath,
				rule: this.#serializeRule(winner.coveredBy ?? winner),
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
	 * Evaluate hook-target rules (`pattern:type`) for a caller→hook pair. Most-specific-wins (a
	 * specific type outranks the any-type `hook`, then literal segments); equal specificity → higher layer, then
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
		for (const entry of mapValues(this.#callRules)) {
			if (entry.hookType == null) continue; // call-target rules don't gate hooks
			if (entry.hookType !== "hook" && entry.hookType !== hookType) continue;
			const callerMatcher = this.#getCompiledPattern(entry.caller);
			const pathMatcher = this.#getCompiledPattern(entry.hookPathPattern);
			if (callerMatcher(callerPath) && pathMatcher(hookPath)) {
				listPush(matches, entry);
			}
		}

		// Hook gating has no call/construct arguments — function conditions receive null callMeta.
		const conditioned = filterList(matches, (entry) => this.#conditionMatches(entry, runtimeContext, null));
		if (conditioned.length === 0) {
			return { matched: false, allowed: false, event: null, payload: null };
		}

		// Specificity: caller + path-pattern kind, plus a point for a specific type over `hook`; then literal segments.
		this.#sortBySpecificity(
			conditioned,
			(entry) =>
				this.#patternSpecificity(entry.caller, callerPath) +
				this.#patternSpecificity(entry.hookPathPattern, hookPath) +
				(entry.hookType === "hook" ? 0 : 1),
			(entry) => this.#literalSegments(entry.caller) + this.#literalSegments(entry.hookPathPattern)
		);
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
	 * token and one of before/after/always/error/around or `hook` (any type) — e.g. `"db.*:error"`, `"**:hook"`.
	 * Ordinary call targets (no recognized hook-type suffix, e.g. `"db.write"`) return null.
	 *
	 * @param {string} target - Rule target string.
	 * @returns {{ pathPattern: string, hookType: string }|null} Parsed parts, or null for a call target.
	 * @private
	 */
	#parseHookTarget(target) {
		const lastColon = StringMethods.lastIndexOf(target, ":");
		if (lastColon === -1) return null;
		const type = StringMethods.substring(target, lastColon + 1);
		if (!SetMethods.has(HOOK_TARGET_TYPES, type)) return null;
		const pathPattern = StringMethods.substring(target, 0, lastColon);
		if (!pathPattern) return null;
		return { pathPattern, hookType: type };
	}

	/**
	 * Parse a permission target into its path pattern when it is a write target (`pattern:write`, #625).
	 *
	 * @param {string} target - Rule target string.
	 * @returns {string|null} The path pattern, or null for any other target.
	 * @private
	 */
	#parseWriteTarget(target) {
		if (!StringMethods.endsWith(target, WRITE_TARGET_SUFFIX)) return null;
		const pathPattern = StringMethods.slice(target, 0, -WRITE_TARGET_SUFFIX.length);
		return pathPattern ? pathPattern : null;
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
		if (!StringMethods.includes(pattern, "*") && !StringMethods.includes(pattern, "?") && !StringMethods.includes(pattern, "{")) {
			return 3;
		}
		// Multi-segment glob (**)
		if (StringMethods.includes(pattern, "**")) {
			return 1;
		}
		// Single-segment glob (*, ?, {a,b})
		return 2;
	}

	/**
	 * Order the rules that match one decision, the one that decides first: the more specific rule (a higher `kind`
	 * score), then among equal kinds the one with more literal segments (`db.write.**` over `db.**` over `**`), then
	 * the higher layer (runtime over instance over manifest over built-in), then the last registered. The same order
	 * decides call, write, hook and event rules, so the narrower rule wins whichever was registered last and layer and
	 * order only break a tie between equally specific rules.
	 *
	 * @param {object[]} rules - The matching rules; sorted in place.
	 * @param {function(object): number} kind - A rule's kind score: its patterns' kinds summed (exact 3, single-segment glob 2, `**` 1).
	 * @param {function(object): number} literal - A rule's literal segments: its patterns' counts summed.
	 * @returns {void}
	 * @private
	 *
	 * @example
	 * this.#sortBySpecificity(matches, (rule) => this.#computeSpecificity(rule, caller, target), (rule) => this.#literalSegments(rule.target));
	 */
	#sortBySpecificity(rules, kind, literal) {
		ArrayMethods.sort(rules, (a, b) => {
			const kindA = kind(a);
			const kindB = kind(b);
			if (kindA !== kindB) return kindB - kindA;
			const literalA = literal(a);
			const literalB = literal(b);
			if (literalA !== literalB) return literalB - literalA;
			if (a.layerRank !== b.layerRank) return b.layerRank - a.layerRank;
			return b.registrationSeq - a.registrationSeq;
		});
	}

	/**
	 * Count a pattern's literal segments: those with no glob character. Rules of the same kind are ranked by this
	 * (see #sortBySpecificity), so `guest.zz.**` (2) is more specific than `guest.**` (1), and that than `**` (0).
	 *
	 * @param {string} pattern - Glob pattern.
	 * @returns {number} The number of `.`-separated segments with no `*`, `?`, `{` or `}`.
	 * @private
	 */
	#literalSegments(pattern) {
		let count = 0;
		for (let ofIndex = 0, ofList = splitText(pattern, "."); ofIndex < ofList.length; ofIndex++) {
			const segment = ofList[ofIndex];
			if (
				!StringMethods.includes(segment, "*") &&
				!StringMethods.includes(segment, "?") &&
				!StringMethods.includes(segment, "{") &&
				!StringMethods.includes(segment, "}")
			)
				count++;
		}
		return count;
	}

	/**
	 * Get or compile a cached pattern matcher.
	 *
	 * @param {string} pattern - Glob pattern.
	 * @returns {function} Matcher function.
	 * @private
	 */
	#getCompiledPattern(pattern) {
		let matcher = MapMethods.get(this.#compiledCache, pattern);
		if (!matcher) {
			// `**` matches any number of segments, none included: `x.**` names `x` itself, the module path code outside
			// every export of `x`'s file runs as (#726).
			matcher = compilePattern(pattern);
			MapMethods.set(this.#compiledCache, pattern, matcher);
		}
		return matcher;
	}

	/**
	 * The paths above `targetPath` that a deny call rule names exactly, deepest first, for the rule epoch.
	 * @param {string} targetPath - The api path.
	 * @returns {string[]} The paths.
	 * @private
	 */
	#exactDenyPrefixesOf(targetPath) {
		let targets = this.#exactDenyTargets;
		if (targets === null) {
			targets = new Set();
			for (const entry of mapValues(this.#callRules)) {
				if (entry.hookType != null || entry.id === this.#reachRuleId || entry.id === this.#globalMetadataRuleId) continue;
				if (entry.effect === "deny" && !(RegExpMethods.exec(/[*?{!]/, entry.target) !== null)) SetMethods.add(targets, entry.target);
			}
			this.#exactDenyTargets = targets;
		}
		if (SetMethods.size(targets) === 0) return NO_PREFIXES;
		let prefixes = MapMethods.get(this.#exactDenyPrefixes, targetPath);
		if (prefixes !== undefined) return prefixes;
		prefixes = [];
		for (let end = StringMethods.lastIndexOf(targetPath, "."); end > 0; end = StringMethods.lastIndexOf(targetPath, ".", end - 1)) {
			const prefix = StringMethods.slice(targetPath, 0, end);
			if (SetMethods.has(targets, prefix)) listPush(prefixes, prefix);
		}
		if (prefixes.length === 0) prefixes = NO_PREFIXES;
		// Paths a module's data holds are many; the record is a cache, so it starts over rather than grow without bound.
		if (MapMethods.size(this.#exactDenyPrefixes) >= PREFIX_CACHE_LIMIT) MapMethods.clear(this.#exactDenyPrefixes);
		MapMethods.set(this.#exactDenyPrefixes, targetPath, prefixes);
		return prefixes;
	}

	/**
	 * Whether an allow rule for `callerPath` names something beneath `path` that a rule on `probePath`, a member of
	 * `path` no rule names, does not stand for: a more specific allow, which lets what it names through though the rules
	 * deny the caller the member's path and what it holds otherwise. It answers for what the rules could allow, so it
	 * errs toward yes: a condition is taken to match. Kept for the rule epoch.
	 * @param {string|null} callerPath - The caller's api path; null for a caller with none, which nothing allows.
	 * @param {string} path - The member's api path.
	 * @param {string} probePath - The path of a member of it no rule names.
	 * @returns {boolean} Whether such a rule exists.
	 * @internal
	 *
	 * @example
	 * // rules: deny reader.** → owner.config.nested, allow reader.** → owner.config.nested.public
	 * pm.allowsBeneath("reader", "owner.config.nested", probe); // true
	 */
	allowsBeneath(callerPath, path, probePath) {
		if (callerPath == null) return false;
		const key = `${callerPath}::${path}`;
		let allows = MapMethods.get(this.#allowsBeneath, key);
		if (allows !== undefined) return allows;
		allows = false;
		const segments = splitText(path, ".");
		for (const entry of mapValues(this.#callRules)) {
			if (entry.hookType != null || entry.id === this.#reachRuleId || entry.id === this.#globalMetadataRuleId) continue;
			if (entry.effect !== "allow" || !this.#getCompiledPattern(entry.caller)(callerPath)) continue;
			if (this.#getCompiledPattern(entry.target)(probePath)) continue;
			if (runtime_patternReaches(entry.target, segments, true)) {
				allows = true;
				break;
			}
		}
		if (MapMethods.size(this.#allowsBeneath) >= PREFIX_CACHE_LIMIT) MapMethods.clear(this.#allowsBeneath);
		MapMethods.set(this.#allowsBeneath, key, allows);
		return allows;
	}

	/**
	 * Clear the resolved result cache. Called when rules or topology change.
	 *
	 * @returns {void}
	 * @private
	 */
	#clearCache() {
		MapMethods.clear(this.#resolvedCache);
		this.#exactDenyTargets = null;
		MapMethods.clear(this.#exactDenyPrefixes);
		MapMethods.clear(this.#allowsBeneath);
		MapMethods.clear(this.#writeCache);
		MapMethods.clear(this.#subtreeCache);
		MapMethods.clear(this.#readSubtreeCache);
		MapMethods.clear(this.#writeRulesForCache);
		this.#ruleEpoch++;
	}

	/**
	 * A number that changes whenever the outcome of a rule may have changed: a rule added or removed, the system
	 * switched on or off, a module's rules dropped. What was decided from the rules and kept beside a value (whether
	 * a function is handed another module's value itself or a view) is good for the epoch it was decided in.
	 * @returns {number} The current rule epoch.
	 * @example
	 * const before = pm.ruleEpoch;
	 * pm.addRule(rule);
	 * pm.ruleEpoch !== before; // true
	 */
	get ruleEpoch() {
		return this.#ruleEpoch;
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
			lifecycle.emit(event, { ...payload, timestamp: this.clock.now() });
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
