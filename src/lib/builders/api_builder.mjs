/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/builders/api_builder.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:44-08:00 (1794882524)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Builds the final API object and attaches the slothlet built-in namespace.
 * @module @cldmv/slothlet/builders/api_builder
 * @internal
 * @package
 *
 * @description
 * Clones the user API, attaches built-in helpers, and wires lifecycle utilities for
 * each Slothlet instance.
 *
 * @example
 * const builder = new ApiBuilder(slothlet);
 * const api = await builder.buildFinalAPI(userApi);
 */
// Node-only AsyncResource resolved in the platform module so node:async_hooks stays out of the
// browser graph (#123). AsyncResource.bind only captures ALS context under Node — in a browser
// (live context) bind is identity. loadJson reads package.json for the version (Node only).
import { segmentsOf } from "#helpers/segments";
import { isNode, AsyncResource, loadJson } from "#helpers/platform";
import { ComponentBase } from "#factories/component-base";
import { TYPE_STATES, isCallableValue, internals as unifiedWrapperInternals } from "#handlers/unified-wrapper";
import { DELIVERY_REASONS } from "#handlers/event-manager";
import { internals as framePlacementInternals } from "#handlers/frame-placement";
import { internals as frameworkInternalsInternals } from "#handlers/framework-internals";
import { ceilingMembers, combineCeilings, identityCeilings, internals as trustedRootInternals } from "#handlers/trusted-root";
import { getLanguage, t, translate, internals as translationsInternals } from "#i18n";
import { assertOptionKeys } from "#helpers/config-schema";
import {
	ArrayMethods,
	Arrays,
	concatLists,
	copyList,
	filterList,
	FunctionMethods,
	Functions,
	listPush,
	listUnshift,
	Map,
	mapEntriesToArray,
	mapKeys,
	mapKeysToArray,
	mapList,
	mapValues,
	MapMethods,
	Math,
	NativeProxy,
	NumberMethods,
	Objects,
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
	Symbols,
	URL,
	WeakMap,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
const {
	resolveWrapper,
	runtime_selfModuleCeilings,
	runtime_selfModuleReader,
	runtime_selfRootView,
	runtime_selfView,
	runtime_markCallerLocked,
	runtime_registerFrameworkMember,
	runtime_registerFrameworkMemberCopy,
	runtime_selfFrameworkView,
	runtime_frameworkViewCaller,
	runtime_codeLabel,
	runtime_inheritsBuiltin,
	runtime_isLanguageNameDescriptor,
	runtime_nodeBehind,
	runtime_nodeReport,
	runtime_unwrapSelfView
} = unifiedWrapperInternals("lib/builders/api_builder");
const { runtime_codeWritersOnStack } = framePlacementInternals("lib/builders/api_builder");
const { markSlothletProxy } = frameworkInternalsInternals("lib/builders/api_builder");
const trustedRootOwn = trustedRootInternals("lib/builders/api_builder");
const { initI18n, setLanguage } = translationsInternals("lib/builders/api_builder");

/** The key `util.inspect` reads a custom hook from (the platform shim gives the same one in a browser). */
const INSPECT_KEY = Symbols.for("nodejs.util.inspect.custom");

/**
 * The inspect hooks the slothlet namespace put on its own objects.
 * @type {WeakSet<Function>}
 */
const NAMESPACE_INSPECT_HOOKS = new WeakSet();

/**
 * Root members the framework itself serves on the api, handed to module code as they are (#625).
 * @type {Set<string>}
 * @private
 */
const SELF_FRAMEWORK_ROOT_KEYS = setFrom(["slothlet", "shutdown", "destroy"]);

/**
 * i18n translation helpers exposed on every Slothlet namespace.
 * @typedef {Object} I18nNamespace
 * @property {Function} init - Initialise the i18n system with options (the language is detected when none is given).
 * @property {{get: Function, set: Function}} language - `get()` returns the current locale; `set(lang)` switches it, returning a promise only where the load is asynchronous (a browser), so `await language.set(x)` works everywhere.
 * @property {Function} translate - Translate an error code with optional params.
 * @property {Function} t - Alias for translate.
 */

/**
 * Resolve a pathOrModuleId string to a dot-notation apiPath.
 *
 * @description
 * Checks whether the given string matches a moduleID recorded in `addHistory`.
 * If it does, returns the `apiPath` that was registered with it. Otherwise
 * returns the string as-is (treating it as a dot-notation path), consistent
 * with the resolution logic used by `api.reload()` and `api.remove()`.
 *
 * @param {object} slothlet - Slothlet instance
 * @param {string} pathOrModuleId - Dot-notation API path or a registered moduleID
 * @returns {string} Resolved dot-notation apiPath
 */
// --- API-RULES condition markers (see docs/API-RULES/API-BUILTIN-CONDITIONS.md) ---
// Rule 21 (B01): Reserved root keys protected (slothlet/shutdown/destroy) — ~L271 / ~L260
// Rule 21 (B02): slothlet.diag namespace gated by config.diagnostics — ~L3144
// Rule 21 (B03): api.add() locks caller collision options — ~L785
// Rule 21 (B04): versioning.remove unknown tag → no-op — ~L2678

function _resolvePathOrModuleId(slothlet, pathOrModuleId) {
	const history = slothlet.handlers?.apiManager?.state?.addHistory;
	// reload/remove are always called after at least one add(), so addHistory is always populated;
	// the false branch (no history → return pathOrModuleId unchanged) is never triggered in tests.
	/* v8 ignore next */
	if (history) {
		let match = null;
		for (let i = history.length - 1; i >= 0; i--) {
			const entry = history[i];
			if (entry?.moduleID === pathOrModuleId) {
				match = entry;
				break;
			}
		}
		if (match) return match.apiPath;
	}
	return pathOrModuleId;
}

/**
 * The node a metadata call on a node acts on: a version dispatcher (`api.auth`) stands for the version it resolves to
 * for the caller, as any read through it does; any other node is itself.
 *
 * @param {object} slothlet - Slothlet instance.
 * @param {*} target - A function or node.
 * @returns {*} The node to act on.
 * @private
 * @example
 * _metadataNode(slothlet, api.auth); // api.v2.auth for a caller routed to v2
 */
function _metadataNode(slothlet, target) {
	const dispatcher = slothlet.handlers?.versionManager?.dispatcherOf?.(runtime_nodeBehind(target));
	return dispatcher ? (dispatcher.resolve() ?? target) : target;
}

/**
 * The api path a metadata call names, or null when it names a function or node.
 *
 * @param {object} slothlet - Slothlet instance.
 * @param {*} target - A function or node, a dotted api path, a segment array, or a module id.
 * @returns {string|null} The dotted api path (a module id resolved to where it was added), or null for a function or node.
 * @throws {SlothletError} METADATA_TARGET_INVALID when the target is none of these.
 * @private
 * @example
 * _metadataTargetPath(slothlet, ["v1", "auth"]); // "v1.auth"
 */
function _metadataTargetPath(slothlet, target) {
	if (typeof target === "function" || (target !== null && typeof target === "object" && !Arrays.isArray(target))) return null;
	// An array-backed node is a node, not a segment array.
	if (Arrays.isArray(target) && resolveWrapper(runtime_nodeBehind(target)) !== null) return null;
	if (
		Arrays.isArray(target) &&
		target.length > 0 &&
		ArrayMethods.every(target, (segment) => typeof segment === "string" && segment !== "")
	) {
		return ArrayMethods.join(target, ".");
	}
	if (typeof target === "string" && target !== "") return _resolvePathOrModuleId(slothlet, target);
	throw new slothlet.SlothletError("METADATA_TARGET_INVALID", {
		target: Arrays.isArray(target) ? "array" : typeof target,
		expected: "function, node, api path or module id"
	});
}

/**
 * Run framework-internal teardown (the dispose path's routines and hooks) as the host (#529).
 *
 * @description
 * A module allowed to trigger teardown (for example `api.destroy()`) must not be refused halfway: the
 * teardown invokes the user's routine contributions and root hooks, whose own call gate would
 * otherwise see that module as the caller and apply the host-only rule on a default routine's root
 * path. Runs `fn` with no module caller when one is active; host-initiated teardown runs as is.
 *
 * @param {object} slothlet - Slothlet instance.
 * @param {Function} fn - The teardown body.
 * @returns {unknown} Whatever `fn` returns.
 * @private
 *
 * @example
 * await runTeardownAsHost(slothlet, () => slothlet._runShutdown());
 */
function runTeardownAsHost(slothlet, fn) {
	const contextManager = slothlet.contextManager;
	const identity = contextManager?.getCallerIdentity?.(slothlet.instanceID);
	if (!identity?.currentWrapper && !identity?.unresolved) return fn();
	return contextManager.runInContext(slothlet.instanceID, fn, null, [], null, true, true);
}

/**
 * The identity a `run()` / `scope()` store opened from the current flow carries (#597): the store's own
 * `currentWrapper`, unless the code opening the scope was supplied to the running call by a call above it —
 * then that supplier, with the running call as its ceiling.
 *
 * @param {object} slothlet - The instance.
 * @param {object} currentStore - The store the scope descends from.
 * @returns {{currentWrapper: object|null|undefined, currentCeiling: object|null, record: object|null}} The scope's identity,
 *   with the running call's record when the scope is that call's own.
 * @private
 */
function runtime_scopeIdentity(slothlet, currentStore) {
	const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
	if (identity?.ceiling) return { currentWrapper: identity.currentWrapper, currentCeiling: identity.ceiling, record: null };
	// The scope stays inside the running call: code that call was handed and runs inside the scope is still told
	// apart from the call's own (#597).
	const record = identity?.record ?? currentStore.record ?? null;
	return {
		currentWrapper: currentStore.currentWrapper,
		currentCeiling: currentStore.currentCeiling ?? null,
		record: record && record.wrapper === currentStore.currentWrapper ? record : null
	};
}

/**
 * The module ids an ownership decision is taken for (#597): the caller's, and — for code supplied to another
 * module's call — the module of every call of its ceiling as well, first. Any of them may be refused, so the
 * decision holds for all of them.
 *
 * @param {{currentWrapper?: object|null, ceiling?: object|ReadonlyArray<object>|null}|undefined} identity - The caller identity.
 * @returns {string|string[]|null} One module id, several (the ceiling's first), or `null` for the host.
 * @private
 */
function runtime_ownerModuleIDs(identity) {
	const supplier = identity?.currentWrapper?.____slothletInternal?.moduleID ?? null;
	const ids = new Set();
	for (let i = 0, ceilings = identityCeilings(identity); i < ceilings.length; i++) {
		const ceiling = ceilings[i];
		const moduleID = ceiling.____slothletInternal?.moduleID ?? null;
		if (moduleID !== null && moduleID !== supplier) SetMethods.add(ids, moduleID);
	}
	return SetMethods.size(ids) ? concatLists(setToArray(ids), [supplier]) : supplier;
}

/**
 * Describe a value's shape for a `scope()`/`run()` validation error's `received` context field.
 *
 * @description
 * A bare `typeof` is unhelpful for the shapes callers most often get wrong for `protect`/`owners`:
 * both an array and an array holding a non-string entry report as `"object"`, giving no hint about
 * what's actually wrong. This produces a more actionable descriptor for those shapes while leaving
 * every other `typeof` result (e.g. `"string"`, `"number"`, `"undefined"`) unchanged.
 *
 * @param {*} value - The value being described (e.g. the raw `protect` or `owners` option).
 * @returns {string} `"array"` for a clean array, `"array with non-string entry (<type> at index <n>)"`
 *   for an array whose first non-string element is at index `n`, or `typeof value` otherwise.
 */
function describeScopeReceived(value) {
	if (Arrays.isArray(value)) {
		const badIndex = ArrayMethods.findIndex(value, (entry) => typeof entry !== "string");
		if (badIndex !== -1) {
			return `array with non-string entry (${typeof value[badIndex]} at index ${badIndex})`;
		}
		return "array";
	}
	return typeof value;
}

/**
 * Resolve the folder (or folders) an add names against where the add was asked for, as the build would (#597): resolved
 * here, before the build runs, the build and the folders told apart from the host's code are the same absolute paths.
 * Anything not a non-empty string path — inline content, or what the build rejects — is passed on as it is.
 * @param {object} slothlet - The instance.
 * @param {*} folderPath - What the add was given.
 * @returns {*} The folder resolved, the folders resolved, or what was given.
 * @private
 */
function runtime_resolveAddFolder(slothlet, folderPath) {
	const resolver = slothlet.helpers?.resolver;
	if (!resolver || slothlet.envTarget === "browser") return folderPath;
	const resolve = (entry) => (typeof entry === "string" && entry ? resolver.resolvePathFromCaller(entry) : entry);
	return Arrays.isArray(folderPath) ? mapList(folderPath, resolve) : resolve(folderPath);
}

/**
 * The `api.add` options the instance's collision policy locks (see `config.api.collision.override`), by the internal
 * name the build reads, with the option name a caller writes.
 * @type {ReadonlyArray<[string, string]>}
 * @private
 */
const LOCKED_ADD_OPTIONS = Objects.freeze([
	["collisionMode", "collision.mode"],
	["mutateExisting", "collision.mutate"],
	["recordHistory", "replay"]
]);

/**
 * Read `api.add`'s options into the shape the build takes. The `{ exports, ...options }` inline form gives its sibling
 * keys as options (an explicit options key wins); every key is checked against the method's schema first, so a key
 * `api.add` does not take is refused rather than ignored. `collision` (or a bare mode string), `id`, `replay` and
 * `version` become the build's `collisionMode` / `forceOverwrite` / `mutateExisting`, `moduleID`, `recordHistory` and
 * version config.
 * @param {object} slothlet - The instance.
 * @param {*} source - What the add mounts.
 * @param {*} options - The options as given.
 * @returns {{ source: *, options: object, versionConfig: object|null }} The content to mount, the build's options and
 *   the version config (`null` when no `version` is given).
 * @throws {SlothletError} INVALID_CONFIG_UNKNOWN_KEY for a key `api.add` does not take; INVALID_ARGUMENT for an options,
 *   `collision` or `version` value that is not an object.
 * @private
 */
function runtime_readAddOptions(slothlet, source, options) {
	const objectArgument = (value, argument) => {
		if (value === null || typeof value !== "object" || Arrays.isArray(value)) {
			throw new slothlet.SlothletError("INVALID_ARGUMENT", {
				argument,
				expected: "object",
				received: value === null ? "null" : Arrays.isArray(value) ? "array" : typeof value
			});
		}
	};
	const given = options == null ? {} : options;
	objectArgument(given, "options");
	assertOptionKeys(given, "slothlet.api.add");
	let content = source;
	let merged = given;
	if (
		source &&
		typeof source === "object" &&
		!Arrays.isArray(source) &&
		FunctionMethods.call(Objects.prototype.hasOwnProperty, source, "exports")
	) {
		const sibling = { ...source };
		delete sibling.exports;
		assertOptionKeys(sibling, "slothlet.api.add");
		content = { exports: source.exports };
		merged = { ...sibling, ...given };
	}
	const { collision, id, replay, version, ...rest } = merged;
	const read = rest;
	if (collision !== undefined) {
		const group = typeof collision === "string" ? { mode: collision } : collision;
		objectArgument(group, "options.collision");
		if (group.mode !== undefined) read.collisionMode = group.mode;
		if (group.force !== undefined) read.forceOverwrite = group.force;
		if (group.mutate !== undefined) read.mutateExisting = group.mutate;
	}
	if (id !== undefined) read.moduleID = id;
	if (replay !== undefined) read.recordHistory = replay;
	let versionConfig = null;
	if (version != null) {
		objectArgument(version, "options.version");
		versionConfig = { version: version.tag };
		if (version.default !== undefined) versionConfig.default = version.default;
		if (version.metadata !== undefined) versionConfig.metadata = version.metadata;
	}
	return { source: content, options: read, versionConfig };
}

/**
 * Run work that builds modules — an add or a reload — as no module's code (#597): what runs while modules are built
 * (their top level, and their exports' getters and Proxy traps as slothlet reads them) is the code being built, never
 * the code of a module that asked for the build. Outside any module's call it runs as it is.
 * @param {object} slothlet - The instance.
 * @param {function(): Promise<*>} build - The work.
 * @param {*} [folderPath] - The folder (or folders) being added, whose code is the instance's while it is built.
 * @returns {Promise<*>} What it resolves to.
 * @private
 */
function runtime_buildAsNoModule(slothlet, build, folderPath) {
	const contextManager = slothlet.contextManager;
	const roots = filterList(Arrays.isArray(folderPath) ? folderPath : [folderPath], (root) => typeof root === "string" && root);
	return contextManager?.runUnattributed ? contextManager.runUnattributed(slothlet.instanceID, build, { slothlet, roots }) : build();
}

/**
 * Build a recursive copy-on-write `self` view for a `.run()` / `.scope()`
 * child store.
 *
 * @description
 * `.run()`/`.scope()` are a sandbox: any mutation of `self` inside the callback
 * must not leak to the live instance. This proxy reads **through** to the
 * parent `self` — primitive and top-level reads re-resolve `parentSelf[prop]`
 * on every access — and captures **writes** in a per-scope overlay `Map`.
 * Object-valued children are wrapped in their own COW view on **first** access
 * and **memoized** for the scope's lifetime: repeated `self.X` reads return the
 * same view, so an in-scope deep-path write (`self.X.Y.Z = …`) is read back
 * consistently — and top-level `self.X = …` is captured too. Memoizing pins
 * each child view to the object `parentSelf[prop]` resolved to at first access;
 * if the live tree swaps that object mid-scope (e.g. an `api.reload()`
 * overlapping an open scope) in-scope reads keep seeing the first-access
 * object. That stability is intentional — dropping the view to follow the swap
 * would also drop any in-scope writes to that subtree, breaking the
 * "writes visible for the scope" contract. The whole COW tree is discarded when
 * the child store is discarded on scope exit, so `.run()` / `.scope()` hold no
 * `self` mutations. No tree clone — only the accessed subtree is wrapped,
 * lazily.
 *
 * Functions and primitives pass through unwrapped; identity of a COW-wrapped
 * object differs from the underlying object (acceptable — slothlet API calls
 * go through property access, not identity comparison).
 *
 * @param {object} parentSelf - Parent scope's `self` (the `boundApi`, or an outer COW view for nested scopes).
 * @returns {Proxy} A copy-on-write proxy over `parentSelf`.
 */
function makeCopyOnWriteSelf(parentSelf) {
	const overlay = new Map(); // prop → value written inside this scope
	const childViews = new Map(); // prop → memoized child COW view (read-through objects)
	/**
	 * What the scope reads at `prop`: its own write, or the live value, an object child as its memoized COW view.
	 * @param {string|symbol} prop - Member read.
	 * @returns {*} The value.
	 */
	const read = (prop) => {
		if (MapMethods.has(overlay, prop)) return MapMethods.get(overlay, prop);
		const real = parentSelf[prop];
		// Wrap object children in their own COW so deep-path writes are
		// captured. Memoized so `self.X` returns the same view each time
		// and in-scope writes to it are read back consistently.
		if (real !== null && typeof real === "object") {
			let view = MapMethods.get(childViews, prop);
			if (view === undefined) {
				// The framework's namespace read in the scope is still the framework's: module code is handed its
				// view of it, with the limits that view keeps, over the scope's copy (#625).
				view = runtime_registerFrameworkMemberCopy(makeCopyOnWriteSelf(real), real);
				MapMethods.set(childViews, prop, view);
			}
			return view;
		}
		return real;
	};
	// A function root's view is a function too (#803): called or constructed, it calls the root as `self` does outside
	// the scope, and it reports the root's prototype. The target is a bound function, as the api root's own is.
	const callable = typeof parentSelf === "function";
	const callTraps = callable
		? {
				apply: (_t, thisArg, args) => Reflect.apply(parentSelf, thisArg, args),
				construct: (_t, args) => Reflect.construct(parentSelf, args),
				getPrototypeOf: () => Reflect.getPrototypeOf(parentSelf)
			}
		: {};
	return markSlothletProxy(
		new NativeProxy(copyOnWriteShell(callable ? FunctionMethods.bind(function () {}) : {}, parentSelf), {
			__proto__: null,
			...callTraps,
			get(_t, prop) {
				return read(prop);
			},
			set(_t, prop, value) {
				MapMethods.set(overlay, prop, value);
				MapMethods.delete(childViews, prop);
				return true;
			},
			has(_t, prop) {
				return MapMethods.has(overlay, prop) || prop in parentSelf;
			},
			// `delete self.X` / `Object.defineProperty(self, …)` inside the scope reach here through the runtime
			// `self` (#625): the overlay takes them as it takes a write. A deletion hides nothing of the live tree
			// (reads still go through to it), as before. An accessor is no value the overlay can hold: it is refused.
			deleteProperty(_t, prop) {
				MapMethods.delete(overlay, prop);
				MapMethods.delete(childViews, prop);
				return true;
			},
			defineProperty(_t, prop, descriptor) {
				if (!("value" in descriptor)) return false;
				MapMethods.set(overlay, prop, descriptor.value);
				MapMethods.delete(childViews, prop);
				return true;
			},
			ownKeys() {
				const keys = setFrom(Reflect.ownKeys(parentSelf));
				for (const k of mapKeys(overlay)) SetMethods.add(keys, k);
				return setToArray(keys);
			},
			getOwnPropertyDescriptor(_t, prop) {
				if (MapMethods.has(overlay, prop)) {
					return { __proto__: null, value: MapMethods.get(overlay, prop), writable: true, enumerable: true, configurable: true };
				}
				const desc = Reflect.getOwnPropertyDescriptor(parentSelf, prop);
				// Always configurable — the proxy target is an empty object, so a
				// non-configurable descriptor would violate proxy invariants. A data member's value is what the scope
				// reads there, its COW view for an object, so a write through the descriptor stays in the scope.
				if (!desc) return undefined;
				return "value" in desc
					? { __proto__: null, ...desc, value: read(prop), configurable: true }
					: { __proto__: null, ...desc, configurable: true };
			},
			// The proxy target is an empty object that holds none of what the view lists: closed, it could no longer
			// answer for any member, so the scope's view of `self` and of each node in it stays open (#625).
			preventExtensions() {
				return false;
			}
		})
	);
}

/**
 * The target of a scope's copy-on-write view of `self` (#803), holding the hook Node's `util.inspect` reads: Node shows a
 * Proxy's target rather than what its traps report, so the hook hands it the `self` the view reads through, which shows
 * what the reading code may read, as `self` shows outside the scope. What the scope wrote to its own overlay is not
 * shown.
 * @param {object|Function} shell - The empty target.
 * @param {object} parentSelf - The `self` the view reads through.
 * @returns {object|Function} The target.
 * @private
 */
function copyOnWriteShell(shell, parentSelf) {
	Objects.defineProperty(shell, INSPECT_KEY, {
		__proto__: null,
		value: function inspectScopeSelf() {
			return parentSelf;
		},
		writable: false,
		enumerable: false,
		configurable: true
	});
	return shell;
}

/**
 * A target for the Proxy a module's view of a slothlet function is (#597), of the same kind as the function: a plain
 * function when it has its own `prototype`, a bound one — constructible, with no `prototype` — when it can be
 * constructed without one, and an arrow function otherwise. What a Proxy reports about its target's fixed members
 * (`prototype`) and constructibility then agrees with the function's own.
 * @param {Function} fn - The function captured.
 * @returns {Function} An empty function of its kind.
 * @private
 *
 * @example
 * runtime_captureShell(async () => {}); // an arrow function
 */
function runtime_captureShell(fn) {
	if (Objects.hasOwn(fn, "prototype")) return function slothlet_capturedFunction() {};
	let constructible = true;
	try {
		// A construct trap answers without running or reading the function: `new` refuses a target that cannot be constructed.
		new new NativeProxy(fn, { construct: () => ({}) })();
	} catch {
		constructible = false;
	}
	if (constructible) return FunctionMethods.call(Functions.prototype.bind, function slothlet_capturedFunction() {}, null);
	return () => {};
}

/**
 * Builds final API with built-in methods attached
 * @class ApiBuilder
 * @extends ComponentBase
 * @package
 *
 * @description
 * Class-based builder for final API construction with built-in namespace attachment.
 * Extends ComponentBase for common Slothlet property access.
 *
 * @example
 * const builder = new ApiBuilder(slothlet);
 * const api = await builder.buildFinalAPI(userApi);
 */
export class ApiBuilder extends ComponentBase {
	static slothletProperty = "apiBuilder";

	/**
	 * Create an ApiBuilder instance.
	 * @param {object} slothlet - Slothlet class instance.
	 * @package
	 *
	 * @description
	 * Creates ApiBuilder with ComponentBase support for config, debug, instanceID access.
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Build final API with built-in methods attached
	 * @param {Object} userApi - User API object from mode builder
	 * @returns {Promise<Object>} Final API with built-ins attached
	 * @public
	 */
	async buildFinalAPI(userApi) {
		this.slothlet.debug("api", {
			key: "DEBUG_MODE_BUILD_FINAL_API_CALLED",
			diagnostics: this.____config.diagnostics,
			userApiKeys: Objects.keys(userApi)
		});

		// No clone needed - all exports are already instance-specific UnifiedWrapper proxies
		// Mode builders return wrapped APIs where each wrapper has its own ____impl storage
		// Mutating userApi in place to add builtins is safe and eliminates unnecessary object allocation

		// Strip any previously-attached slothlet builtins from userApi before checking for user hooks.
		// When the API root is a function module (e.g. a root-function.mjs default export), the mode
		// builder may return the SAME function object on successive calls if the ESM module cache is
		// not busted (e.g. an `instance: "keep"` reload keeps the same instanceID query param, so Node's ESM
		// loader serves the cached module). That function still carries shutdown/slothlet/destroy from
		// the previous buildFinalAPI invocation. Without stripping them we'd mistake our own builtins
		// for user-provided lifecycle hooks, creating infinite recursion in createShutdownFunction.
		//
		// IMPORTANT: Only strip the property if its current value IS the exact function reference we
		// previously attached (saved on this.slothlet._ownBuiltins). This prevents incorrectly
		// discarding a user-exported shutdown/destroy function that was fresh-assigned by
		// applyRootContributor's Object.assign() just before buildFinalAPI was called.
		if (this.slothlet._ownBuiltins) {
			for (let ofIndex = 0, ofList = Objects.entries(this.slothlet._ownBuiltins); ofIndex < ofList.length; ofIndex++) {
				const ofEntry = ofList[ofIndex],
					key = ofEntry[0],
					ref = ofEntry[1];
				if (ref && FunctionMethods.call(Objects.prototype.hasOwnProperty, userApi, key) && userApi[key] === ref) {
					try {
						delete userApi[key];
					} catch (_) {
						// Non-configurable - shouldn't happen since attachBuiltins uses configurable:true
					}
				}
			}
		}

		// Save user's shutdown/destroy functions if they exist (to call them during lifecycle)
		// Store these on the instance so they can be updated during add/remove API operations
		// All built API fixtures define shutdown and destroy functions; the null fallback arm is never taken.
		/* v8 ignore start */
		this.slothlet.userHooks = {
			shutdown: typeof userApi.shutdown === "function" ? userApi.shutdown : null,
			destroy: typeof userApi.destroy === "function" ? userApi.destroy : null
		};
		/* v8 ignore stop */
		// The api's `shutdown` / `destroy` are the lifecycle methods, so a user module at either root name
		// is held here off the api surface and loads only when the lifecycle calls it. Loading the api can
		// never reach it, so a lazy one must not count toward the materialization total, or remaining
		// never reaches 0 and materialize.wait() never resolves (#588). It is parked, not discarded, so a load
		// that still reaches it (in the background, or at shutdown) parks the wrappers it makes too (#585 review).
		for (let ofIndex = 0, ofList = Objects.values(this.slothlet.userHooks); ofIndex < ofList.length; ofIndex++) {
			const hook = ofList[ofIndex];
			const hookWrapper = resolveWrapper(hook);
			if (!hookWrapper) continue;
			hookWrapper.___trackLazyLoad("park");
			hookWrapper.___parkChildren();
		}

		// Warn if user has 'slothlet' property (reserved namespace)
		if (userApi.slothlet) {
			// The warning prints unless the instance is silent (decided inside the warning, #838); the impl:warning
			// event below is additive and fires regardless of `silent` (#148).
			new this.SlothletWarning("WARNING_RESERVED_PROPERTY_CONFLICT", { properties: "slothlet" });
			// Also surface as an init-time impl:warning so construction-time `lifecycle` subscribers
			// observe non-throwing diagnostics raised during cold-start buildAPI (#148).
			await this.emitImplDiagnostic("warning", {
				apiPath: "slothlet",
				code: "WARNING_RESERVED_PROPERTY_CONFLICT",
				context: { properties: "slothlet" },
				source: "buildAPI"
			});
		}

		// Create slothlet namespace with all built-in methods
		const slothletNamespace = await this.createSlothletNamespace(userApi);

		this.slothlet.debug("api", {
			key: "DEBUG_MODE_SLOTHLET_NAMESPACE_CREATED",
			namespaceKeys: Objects.keys(slothletNamespace),
			hasDiag: !!slothletNamespace.diag
		});

		// Create root-level convenience methods (use getters for dynamic user hooks)
		const shutdownFn = this.createShutdownFunction();

		// Attach built-ins to API in place (except destroy which needs api reference)
		this.attachBuiltins(userApi, {
			slothlet: slothletNamespace,
			shutdown: shutdownFn,
			destroy: null
		});

		this.slothlet.debug("api", {
			key: "DEBUG_MODE_BUILT_INS_ATTACHED",
			userApiKeys: Objects.keys(userApi),
			hasSlothlet: !!userApi.slothlet,
			hasDiag: !!userApi.slothlet?.diag
		});

		// Now create destroy with dynamic user hooks
		const destroyWithApi = this.createDestroyFunction(userApi);
		Objects.defineProperty(userApi, "destroy", {
			__proto__: null,
			value: destroyWithApi,
			enumerable: true,
			writable: false,
			configurable: true
		});

		// Save references to our own builtin functions so the next buildFinalAPI call
		// (e.g. on an `instance: "keep"` reload) can distinguish them from user-exported functions.
		this.slothlet._ownBuiltins = {
			shutdown: shutdownFn,
			slothlet: slothletNamespace,
			destroy: destroyWithApi
		};
		// Module code reads these through `self` as views that run as the module (#625).
		for (let ofIndex = 0, ofList = Objects.entries(this.slothlet._ownBuiltins); ofIndex < ofList.length; ofIndex++) {
			const ofEntry = ofList[ofIndex],
				name = ofEntry[0],
				member = ofEntry[1];
			runtime_registerFrameworkMember(member, this.slothlet, name);
		}

		return userApi;
	}

	/**
	 * @param {object} userApi - User API object (for diagnostics).
	 * @returns {Promise<object>} Slothlet namespace object.
	 * @private
	 *
	 * @description
	 * Builds the slothlet namespace with version metadata, API controls, and lifecycle
	 * helpers for the current instance.
	 *
	 * @example
	 * const namespace = await this.createSlothletNamespace(api);
	 */
	async createSlothletNamespace(userApi) {
		const slothlet = this.slothlet;
		const config = this.____config;

		/**
		 * Enforce permission checks for built-in plain-object methods under `api.slothlet.*`.
		 * These methods bypass UnifiedWrapper.applyTrap and must perform explicit checks.
		 *
		 * @param {string} targetPath - Synthetic target path used for rule matching.
		 * @returns {object|null|undefined} The module identity the access was allowed for (#597), or null/undefined
		 *   for the host.
		 * @throws {SlothletError} When the current caller is denied access to `targetPath`.
		 * @example
		 * enforceInternalPermission("slothlet.permissions.rules.add");
		 */
		const enforceInternalPermission = (targetPath) => {
			const ctx = slothlet.contextManager?.tryGetContext?.(slothlet.instanceID);
			// Identity via the context manager, not off the store: under the live runtime
			// `currentWrapper` is one field shared by every in-flight call, so a call resuming from an
			// `await` would read whichever module entered last and inherit its rights — here, on the
			// high-privilege `slothlet.*` surface.
			const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
			// Ambiguous and unattributable: deny rather than fall through to the host exemption below.
			// Same AMBIGUOUS signal as the other enforcement points; see context-live. Refusing here is
			// what keeps the internal namespace closed to a caller that cannot be attributed.
			if (identity?.unresolved) {
				throw new slothlet.SlothletError("PERMISSION_DENIED", { caller: null, target: segmentsOf(targetPath) });
			}
			const callerWrapper = identity?.currentWrapper;
			if (!callerWrapper) return null;
			// Code of a module that is gone reaches none of the framework's surface, permissions on or off (#625): what it
			// could register there (a hook, a listener, a subscriber) would outlive it.
			if (slothlet.handlers.apiManager.isRemovedCaller(callerWrapper)) {
				throw new slothlet.SlothletError("PERMISSION_DENIED", {
					caller: String(callerWrapper.____slothletInternal.apiPath ?? ""),
					target: segmentsOf(targetPath)
				});
			}

			const permissionManager = slothlet.handlers?.permissionManager;
			/* v8 ignore start */
			if (!permissionManager?.enforceAccess) {
				throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
			}
			/* v8 ignore stop */

			/* v8 ignore start */
			const callerPath = callerWrapper.____slothletInternal?.apiPath ?? "";
			const callerFilePath = callerWrapper.____slothletInternal?.filePath ?? null;
			// ctx.context carries per-request values from context.run(); when no active
			// context scope exists, it can be null/undefined and falls back to null.
			const runtimeContext = ctx?.context ?? null;
			/* v8 ignore stop */

			if (!permissionManager.enforceAccess(callerPath, targetPath, callerFilePath, null, runtimeContext)) {
				throw new slothlet.SlothletError("PERMISSION_DENIED", {
					caller: callerPath,
					target: segmentsOf(targetPath)
				});
			}
			// Code a caller supplied to another call: every call of its ceiling has to be allowed as well (#597).
			for (let i = 0, ceilings = identityCeilings(identity); i < ceilings.length; i++) {
				const ceiling = ceilings[i];
				/* v8 ignore start -- apiPath/filePath are always set on a genuine wrapper. */
				const ceilingPath = ceiling.____slothletInternal?.apiPath ?? "";
				const ceilingFilePath = ceiling.____slothletInternal?.filePath ?? null;
				/* v8 ignore stop */
				if (
					!WeakSetMethods.has(trustedRootOwn.genuineWrappers, ceiling) ||
					!permissionManager.enforceAccess(ceilingPath, targetPath, ceilingFilePath, null, runtimeContext)
				) {
					throw new slothlet.SlothletError("PERMISSION_DENIED", { caller: ceilingPath, target: segmentsOf(targetPath) });
				}
			}
			return identity;
		};

		// The root routine entry points (`api.shutdown()`, a default routine's root cascade) live outside
		// the `slothlet.*` route proxy, so they check their permission target through this same enforcer
		// at entry (#529). Re-set on every load, alongside the namespace it belongs to.
		slothlet._enforceInternalPermission = enforceInternalPermission;

		/**
		 * Determine whether a denied namespace read can be traversed because an allow rule
		 * for the same caller explicitly targets a deeper descendant under that namespace.
		 *
		 * @param {string} targetPath - Namespace route that was denied (e.g. "slothlet.permissions").
		 * @returns {boolean} True when traversal should be permitted to reach gated descendants.
		 * @example
		 * canTraverseInternalNamespace("slothlet.permissions");
		 */
		const canTraverseInternalNamespace = (targetPath) => {
			const ctx = slothlet.contextManager?.tryGetContext?.(slothlet.instanceID);
			// Per-flow identity, for the same reason as enforceInternalPermission above.
			const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
			// Unattributable under concurrency — refuse the traversal rather than guess.
			if (identity?.unresolved) return false;
			const callerWrapper = identity?.currentWrapper;
			// Defensive guard: only reached from the proxy get trap while a currentWrapper is active.
			// tryGetContext() returning non-null without currentWrapper is an impossible state.
			/* v8 ignore next */
			if (!callerWrapper) return false;
			if (slothlet.handlers.apiManager.isRemovedCaller(callerWrapper)) return false;

			const permissionManager = slothlet.handlers?.permissionManager;
			// Defensive guard: this proxy helper runs only when permissionManager is initialized.
			/* v8 ignore next */
			if (!permissionManager?.getRulesForCaller || !permissionManager?.checkAccess) {
				return false;
			}

			// Code supplied to another module's call traverses only where every call of its ceiling may as well (#597).
			if (!canTraverseAs(targetPath, callerWrapper, ctx, permissionManager)) return false;
			return ArrayMethods.every(identityCeilings(identity), (ceiling) => canTraverseAs(targetPath, ceiling, ctx, permissionManager));
		};

		/**
		 * Whether one caller's rules may reach a descendant of a denied internal namespace — the check behind
		 * {@link canTraverseInternalNamespace}.
		 *
		 * @param {string} targetPath - Namespace route that was denied.
		 * @param {object} callerWrapper - The caller to check.
		 * @param {object|null|undefined} ctx - The caller's context store.
		 * @param {object} permissionManager - The instance's PermissionManager.
		 * @returns {boolean} True when traversal should be permitted for this caller.
		 * @private
		 */
		const canTraverseAs = (targetPath, callerWrapper, ctx, permissionManager) => {
			// callerWrapper.____slothletInternal is always set by UnifiedWrapper — the ?? fallbacks are
			// defensive guards that are structurally unreachable through the public API.
			/* v8 ignore start */
			const callerPath = callerWrapper.____slothletInternal?.apiPath ?? "";
			const callerFilePath = callerWrapper.____slothletInternal?.filePath ?? null;
			// ctx.context carries per-request values from context.run(); when no active
			// context scope exists, it can be null/undefined and falls back to null.
			const runtimeContext = ctx?.context ?? null;
			/* v8 ignore stop */
			const callerRules = permissionManager.getRulesForCaller(callerPath);

			const conditionMatches = (condition) =>
				typeof permissionManager.matchesCondition === "function" ? permissionManager.matchesCondition(condition, runtimeContext) : false;

			const prefix = `${targetPath}.`;
			for (let i = 0; i < callerRules.length; i++) {
				const rule = callerRules[i];
				if (!rule || rule.effect !== "allow" || typeof rule.target !== "string") continue;

				const couldMatchDescendant = StringMethods.startsWith(rule.target, prefix) || rule.target === "**" || rule.target === "*";
				if (!couldMatchDescendant) continue;

				if (StringMethods.startsWith(rule.target, prefix) && conditionMatches(rule.condition)) {
					return true;
				}

				const probePaths = [`${targetPath}.__probe__`];
				if (StringMethods.startsWith(rule.target, prefix)) {
					const suffix =
						typeof rule.target === "string" ? StringMethods.slice(rule.target, prefix.length) : copyList(rule.target, prefix.length);
					const firstSegment = splitText(suffix, ".")[0];
					if (firstSegment && !(RegExpMethods.exec(/[*!?{}]/u, firstSegment) !== null)) {
						listUnshift(probePaths, `${targetPath}.${firstSegment}`);
						listPush(probePaths, `${targetPath}.${firstSegment}.__probe__`);
					}
				}

				for (let ofIndex = 0, ofList = probePaths; ofIndex < ofList.length; ofIndex++) {
					const probePath = ofList[ofIndex];
					if (
						permissionManager.checkAccess(callerPath, probePath, callerFilePath, null, runtimeContext, {
							useCache: false
						})
					) {
						return true;
					}
				}
			}

			return false;
		};

		/**
		 * Functions of the namespace as each module read them (#597), by function, reading module and ceiling: one per
		 * reader, so `self.slothlet.event.on === self.slothlet.event.on` holds within a module.
		 * @type {WeakMap<Function, WeakMap<object, WeakMap<object, Function>>>}
		 */
		const capturedRouteFunctions = new WeakMap();

		/**
		 * The value each route proxy {@link createInternalRouteProxy} built is over.
		 * @type {WeakMap<object, object>}
		 */
		const routeProxyTargets = new WeakMap();

		/**
		 * Every function {@link captureRouteFunction} built.
		 * @type {WeakSet<Function>}
		 */
		const capturedRouteFunctionSet = new WeakSet();

		/**
		 * The function a module reads out of the slothlet namespace, kept as that module's (#597).
		 *
		 * A slothlet function decides from who is calling it: `event.on` and `hook.on` whose subscription it makes,
		 * `principal.register` whose principal, `scope` whose scope. Handed to another module — bound to its arguments,
		 * say — and called there, it would decide as that module, which could then be made to subscribe, hook or
		 * register what the reader may not. The function a module reads therefore runs as that module: its identity
		 * when it read it, with whoever is calling it now as a ceiling as well, so it can never do more than either.
		 * Called by the module that read it, as it normally is, it runs exactly as before.
		 *
		 * The host reads functions as they are. Properties read off a captured function are read as the module
		 * reading them, so `pin.caller` taken from a captured `pin` is captured too.
		 *
		 * @param {*} value - A value the namespace proxy is returning.
		 * @param {object|null|undefined} identity - Who read it.
		 * @returns {*} The value, or the reader's function.
		 */
		const captureRouteFunction = (value, identity) => {
			const reader = identity?.currentWrapper;
			if (typeof value !== "function" || !reader || WeakSetMethods.has(capturedRouteFunctionSet, value)) return value;
			const readerCeiling = Reflect.apply(combineCeilings, undefined, identityCeilings(identity));
			let byReader = WeakMapMethods.get(capturedRouteFunctions, value);
			if (!byReader) WeakMapMethods.set(capturedRouteFunctions, value, (byReader = new WeakMap()));
			let byCeiling = WeakMapMethods.get(byReader, reader);
			if (!byCeiling) WeakMapMethods.set(byReader, reader, (byCeiling = new WeakMap()));
			const existing = WeakMapMethods.get(byCeiling, readerCeiling ?? reader);
			if (existing) return existing;
			const readerCalls = ceilingMembers(readerCeiling);
			const callerWrapper = identity.callerWrapper ?? null;
			const callerCeiling = identity.callerCeiling ?? null;
			const liveIdentity = () => slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
			// Run `invoke` as the reader, under whoever is calling now as well — or, for the reader calling it itself under no
			// ceiling it did not already have, as it always ran.
			const asReader = (invoke) => {
				const live = liveIdentity();
				if (live?.unresolved) throw new slothlet.SlothletError("PERMISSION_DENIED", { caller: null, target: segmentsOf("slothlet") });
				const liveCalls = identityCeilings(live);
				if (
					live?.currentWrapper === reader &&
					ArrayMethods.every(readerCalls, (call) =>
						typeof liveCalls === "string" ? StringMethods.includes(liveCalls, call) : ArrayMethods.includes(liveCalls, call)
					)
				)
					return invoke();
				const ceiling = Reflect.apply(
					combineCeilings,
					undefined,
					filterList(
						ceilingMembers(
							Reflect.apply(combineCeilings, undefined, concatLists([readerCeiling, live?.currentWrapper ?? null], liveCalls))
						),
						(call) => call !== reader
					)
				);
				return slothlet.contextManager.runAsIdentity(
					slothlet.instanceID,
					{ currentWrapper: reader, ceiling, callerWrapper, callerCeiling },
					invoke
				);
			};
			// A target of its own: the function's own properties include ones a Proxy of it would have to report as they
			// are (`pin.caller`), and a captured reader's has to be handed out instead. The shell is the same kind of
			// function as the one it captures, so what a Proxy has to report from its target agrees with the function: a
			// plain function when it has its own `prototype`, a bound one (constructible, with none) when it can be
			// constructed without one, and an arrow otherwise.
			// Decided on the function the route proxy is over: asking the route proxy would run its permission checks.
			const underlying = WeakMapMethods.get(routeProxyTargets, value) ?? value;
			const shell = runtime_captureShell(underlying);
			// The shell inherits what the function does (an async function's `AsyncFunction.prototype`), so a Proxy over it
			// reports the function's prototype even once the shell is fixed.
			Reflect.setPrototypeOf(shell, Reflect.getPrototypeOf(underlying));
			// Whether the shell holds a member the Proxy has to report as the shell holds it: one it cannot reconfigure, or
			// any once it is no longer extensible.
			const fixedOnShell = (prop) => {
				const own = Reflect.getOwnPropertyDescriptor(shell, prop);
				return own !== undefined && (!own.configurable || !Reflect.isExtensible(shell));
			};
			// Put the function's member on the shell as the function holds it, a function value as this reader's.
			const mirror = (prop) => {
				const descriptor = Reflect.getOwnPropertyDescriptor(value, prop);
				if (!descriptor) return Reflect.deleteProperty(shell, prop);
				if ("value" in descriptor) descriptor.value = captureRouteFunction(descriptor.value, identity);
				return Reflect.defineProperty(shell, prop, descriptor);
			};
			// A function made non-extensible since the shell was made (by the host, or by another reader) is followed: the
			// shell takes its members as it holds them and stops taking new ones, so what the Proxy reports agrees with it.
			const followIntegrity = () => {
				if (Reflect.isExtensible(value) || !Reflect.isExtensible(shell)) return;
				for (let ofIndex = 0, ofList = Reflect.ownKeys(shell); ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					if (!Reflect.getOwnPropertyDescriptor(value, key)) Reflect.deleteProperty(shell, key);
				}
				for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					mirror(key);
				}
				Reflect.preventExtensions(shell);
			};
			// A member the function holds fixed is fixed on the shell from the start, so it is reported as the function holds it —
			// one the reader may read: a member it may not stays off the shell, and describing it is refused as before.
			// The shell's own `prototype` takes the function's when that is fixed (a class's is read-only), so the Proxy
			// reports it read-only, as the function does, and hands out the function's own prototype object.
			for (let ofIndex = 0, ofList = Reflect.ownKeys(underlying); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				if (Reflect.getOwnPropertyDescriptor(underlying, key)?.configurable !== false) continue;
				if (Objects.hasOwn(shell, key) && key !== "prototype") continue;
				try {
					mirror(key);
				} catch (error) {
					// Only a refusal of slothlet's own is passed over.
					const refusal = slothlet.SlothletError;
					if (!(error instanceof refusal)) throw error;
				}
			}
			const captured = new NativeProxy(shell, {
				apply(_target, thisArg, args) {
					return asReader(() => Reflect.apply(value, thisArg, args));
				},
				construct(_target, args, newTarget) {
					return asReader(() => Reflect.construct(value, args, newTarget === captured ? value : newTarget));
				},
				get(target, prop) {
					// A member the shell fixed is read as it holds it (the Proxy must report it so).
					if (fixedOnShell(prop)) {
						const own = Reflect.getOwnPropertyDescriptor(target, prop);
						if ("value" in own && !own.writable) return own.value;
					}
					return captureRouteFunction(Reflect.get(value, prop), liveIdentity());
				},
				has(target, prop) {
					return Reflect.has(value, prop) || fixedOnShell(prop);
				},
				ownKeys(target) {
					followIntegrity();
					if (!Reflect.isExtensible(target)) return Reflect.ownKeys(target);
					const keys = Reflect.ownKeys(value);
					for (let ofIndex = 0, ofList = Reflect.ownKeys(target); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						if (fixedOnShell(key) && !ArrayMethods.includes(keys, key)) listPush(keys, key);
					}
					return keys;
				},
				getOwnPropertyDescriptor(target, prop) {
					followIntegrity();
					if (fixedOnShell(prop)) {
						const own = Reflect.getOwnPropertyDescriptor(target, prop);
						// A writable member the shell fixed reports the function's current value.
						if ("value" in own && own.writable) {
							const descriptor = Reflect.getOwnPropertyDescriptor(value, prop);
							if (descriptor && "value" in descriptor) return { __proto__: null, ...own, value: descriptor.value };
						}
						return own;
					}
					if (!Reflect.isExtensible(target)) return undefined;
					const descriptor = Reflect.getOwnPropertyDescriptor(value, prop);
					// Reported as configurable: the shell does not hold it, so it cannot be reported otherwise.
					return descriptor ? { __proto__: null, ...descriptor, configurable: true } : undefined;
				},
				defineProperty(target, prop, descriptor) {
					followIntegrity();
					if (!Reflect.defineProperty(value, prop, descriptor)) return false;
					// What the shell has to report as the function now holds it: a member the definition left non-configurable
					// (one that names only a value is), or one the shell already fixed.
					if (
						Reflect.getOwnPropertyDescriptor(value, prop)?.configurable === false ||
						Reflect.getOwnPropertyDescriptor(target, prop)?.configurable === false
					) {
						return mirror(prop);
					}
					return true;
				},
				getPrototypeOf(target) {
					// The function's own, which the shell keeps up with while it can still change.
					if (Reflect.isExtensible(target)) Reflect.setPrototypeOf(target, Reflect.getPrototypeOf(value));
					return Reflect.getPrototypeOf(target);
				},
				setPrototypeOf(target, prototype) {
					if (!Reflect.setPrototypeOf(value, prototype)) return false;
					return Reflect.setPrototypeOf(target, prototype);
				},
				isExtensible(target) {
					followIntegrity();
					return Reflect.isExtensible(target);
				},
				preventExtensions(target) {
					if (!Reflect.preventExtensions(value)) return false;
					// The shell takes every member as the function holds it before it stops taking new ones, so the Proxy reports
					// the function's members and nothing else.
					for (let ofIndex = 0, ofList = Reflect.ownKeys(target); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						if (!Reflect.getOwnPropertyDescriptor(value, key)) Reflect.deleteProperty(target, key);
					}
					for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						mirror(key);
					}
					return Reflect.preventExtensions(target);
				},
				set(_target, prop, newValue) {
					return Reflect.set(value, prop, newValue);
				},
				deleteProperty(target, prop) {
					if (fixedOnShell(prop) && Reflect.getOwnPropertyDescriptor(target, prop).configurable === false) return false;
					if (!Reflect.deleteProperty(value, prop)) return false;
					return Reflect.deleteProperty(target, prop);
				}
			});
			WeakSetMethods.add(capturedRouteFunctionSet, markSlothletProxy(captured));
			WeakMapMethods.set(byCeiling, readerCeiling ?? reader, captured);
			return captured;
		};

		/**
		 * Refuse module code a change to the namespace at `routePath`, however the module came to hold it: through
		 * `self` (a view of its own, which checks the same), or the namespace the host holds, handed to it as an argument,
		 * inside plain data, or stored on an object the module holds as itself. The built-in write rules keep the
		 * framework's namespace from module code with the permission system on or off, and a host rule lifts one for the
		 * callers it names; only `mode: "disabled"` leaves it open. The host's own changes go through. While a module's
		 * call runs, the module it runs as decides; while none does, whose code makes the change decides (a function a
		 * module left on an object of the host's, or on `globalThis`, is that module's whoever calls it later).
		 *
		 * @param {string} changedPath - The path changed (`slothlet.planted`, or `slothlet` for the namespace itself).
		 * @returns {void}
		 * @throws {SlothletError} `PERMISSION_DENIED` when module code changes what a built-in write rule protects, and
		 *   `LOOSE_SET_UNATTRIBUTED` when the live runtime cannot tell which call is executing, or the code making it is
		 *   the instance's but no module's.
		 * @example
		 * assertNamespaceChange("slothlet.planted"); // throws inside a module call
		 */
		const assertNamespaceChange = (changedPath) => {
			const apiManager = slothlet.handlers.apiManager;
			if (!apiManager.frameworkProtected()) return;
			const parts = splitText(changedPath, ".");
			const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
			if (identity?.unresolved) {
				throw new slothlet.SlothletError("LOOSE_SET_UNATTRIBUTED", { path: segmentsOf(changedPath) });
			}
			if (identity?.currentWrapper) {
				// Code a caller supplied to another module's call changes it only where every module it acts for may (#597).
				for (
					let ofIndex = 0, ofList = concatLists([identity.currentWrapper], identityCeilings(identity));
					ofIndex < ofList.length;
					ofIndex++
				) {
					const writer = ofList[ofIndex];
					apiManager.assertOwnedWrite(parts, writer);
				}
				return;
			}
			// No call is running: whose code makes the change decides, so a function a module left where the host calls it
			// later is still that module's.
			const writers = runtime_codeWritersOnStack(slothlet);
			if (writers === null) throw new slothlet.SlothletError("LOOSE_SET_UNATTRIBUTED", { path: segmentsOf(changedPath) });
			for (let i = 0; i < writers.length; i++) apiManager.assertOwnedWrite(parts, writers[i]);
		};

		/**
		 * Recursively proxy the slothlet namespace so every `api.slothlet.*`
		 * property route is permission-gated, including primitives on objects.
		 *
		 * @param {unknown} value - Value to proxy.
		 * @param {string} routePath - Dot path used for permission matching.
		 * @param {WeakMap<object, Map<string, object>>} [seen=new WeakMap()] - Route-aware cycle guard.
		 * @returns {unknown} Route-gated proxy or primitive.
		 * @example
		 * const gated = createInternalRouteProxy(namespace, "slothlet");
		 */
		const createInternalRouteProxy = (value, routePath, seen = new WeakMap()) => {
			if (!value || (typeof value !== "object" && typeof value !== "function")) return value;

			const isMetaProperty = (prop) =>
				prop === "__proto__" || prop === "prototype" || prop === "constructor" || prop === "caller" || prop === "arguments";

			let routeCache = WeakMapMethods.get(seen, value);
			if (!routeCache) {
				routeCache = new Map();
				WeakMapMethods.set(seen, value, routeCache);
			}

			if (MapMethods.has(routeCache, routePath)) {
				return MapMethods.get(routeCache, routePath);
			}

			const proxy = new NativeProxy(value, {
				get(target, prop, receiver) {
					if (typeof prop !== "string") {
						const result = Reflect.get(target, prop, receiver);
						// The namespace's own inspect hook, as it is: it shows whoever calls it only what that code may read.
						if (prop === INSPECT_KEY && WeakSetMethods.has(NAMESPACE_INSPECT_HOOKS, result)) return result;
						return createInternalRouteProxy(result, routePath, seen);
					}

					// A name the object does not hold itself reads as in plain JS, as at an api node: undefined when nothing has it
					// (serializers and Node 22/24's util.inspect probe objects for such names, `$$typeof`, `0`), and what the
					// language's own prototypes give every object or function (`constructor`, `toString`) as it is.
					const own = Reflect.getOwnPropertyDescriptor(target, prop);
					if (!own) {
						if (!Reflect.has(target, prop)) return undefined;
						if (runtime_inheritsBuiltin(target, prop)) return Reflect.get(target, prop, receiver);
					}
					// A function's own `name` and `length` are read as plain JS reads them, whatever the rules say of the
					// function: consoles and formatters read them of every function they show.
					if (typeof target === "function" && runtime_isLanguageNameDescriptor(prop, own)) return own.value;

					const childRoutePath = `${routePath}.${prop}`;
					let deniedError = null;
					let reader = null;
					try {
						reader = enforceInternalPermission(childRoutePath);
					} catch (error) {
						deniedError = error;
					}

					if (deniedError) {
						if (canTraverseInternalNamespace(childRoutePath)) {
							const result = Reflect.get(target, prop, receiver);
							if (result && (typeof result === "object" || typeof result === "function")) {
								return captureRouteFunction(
									createInternalRouteProxy(result, childRoutePath, seen),
									slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID)
								);
							}
						}
						throw deniedError;
					}

					const result = Reflect.get(target, prop, receiver);

					if (isMetaProperty(prop)) {
						return result;
					}

					// Proxy invariants: for non-configurable, non-writable data props,
					// the trap must return the exact underlying value.
					const descriptor = Objects.getOwnPropertyDescriptor(target, prop);
					if (descriptor && "value" in descriptor && descriptor.configurable === false && descriptor.writable === false) {
						return descriptor.value;
					}

					// A function read by a module keeps the module as who calls it, whoever calls it later (#597).
					return captureRouteFunction(createInternalRouteProxy(result, childRoutePath, seen), reader);
				},

				getOwnPropertyDescriptor(target, prop) {
					const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
					if (!descriptor) return undefined;

					if (typeof prop !== "string") {
						return descriptor;
					}

					// A function's own `name` and `length` are described without a check, as they are read (see get).
					if (typeof target === "function" && runtime_isLanguageNameDescriptor(prop, descriptor)) return descriptor;

					const childRoutePath = `${routePath}.${prop}`;

					if (isMetaProperty(prop)) {
						try {
							enforceInternalPermission(childRoutePath);
						} catch (error) {
							// A function's own `prototype` is fixed (non-configurable), so a listing has to report it: it is
							// described with its value withheld, as the invariants allow for a writable member, and a read of it
							// stays refused. Any other refused member is refused as before.
							if (error?.code !== "PERMISSION_DENIED" || descriptor.configurable || !("value" in descriptor) || !descriptor.writable)
								throw error;
							return { __proto__: null, ...descriptor, value: undefined };
						}
						return descriptor;
					}

					if ("get" in descriptor || "set" in descriptor) {
						enforceInternalPermission(childRoutePath);

						// For configurable accessors, wrap getter/setter so cached descriptor
						// functions re-check permissions at invocation time.
						if (descriptor.configurable === true) {
							return {
								__proto__: null,
								...descriptor,
								get:
									typeof descriptor.get === "function"
										? function slothlet_internal_descriptor_getter(...args) {
												enforceInternalPermission(childRoutePath);
												return Reflect.apply(descriptor.get, this, args);
											}
										: descriptor.get,
								set:
									typeof descriptor.set === "function"
										? function slothlet_internal_descriptor_setter(...args) {
												enforceInternalPermission(childRoutePath);
												return Reflect.apply(descriptor.set, this, args);
											}
										: descriptor.set
							};
						}

						return descriptor;
					}

					// Generic descriptors are not produced by slothlet namespace objects or built-in reflection paths.
					/* v8 ignore next */
					if (!("value" in descriptor)) {
						return descriptor;
					}

					const descriptorValue = descriptor.value;

					// Proxy invariants: non-configurable + non-writable data properties
					// must expose the exact underlying value.
					if (descriptor.configurable === false && descriptor.writable === false) {
						enforceInternalPermission(childRoutePath);
						return descriptor;
					}

					if (
						!descriptorValue ||
						(typeof descriptorValue !== "object" && typeof descriptorValue !== "function") ||
						typeof descriptorValue === "function"
					) {
						const reader = enforceInternalPermission(childRoutePath);

						if (typeof descriptorValue === "function" && descriptor.configurable === true) {
							return {
								__proto__: null,
								...descriptor,
								value: captureRouteFunction(createInternalRouteProxy(descriptorValue, childRoutePath, seen), reader)
							};
						}

						return descriptor;
					}

					return { __proto__: null, ...descriptor, value: createInternalRouteProxy(descriptorValue, childRoutePath, seen) };
				},

				// A change under a symbol meets the rules of the member it is made on; one under a string, those of its path.
				set(target, prop, newValue, receiver) {
					if (typeof prop !== "string") {
						assertNamespaceChange(routePath);
						return Reflect.set(target, prop, newValue, receiver);
					}

					const childRoutePath = `${routePath}.${prop}`;
					enforceInternalPermission(childRoutePath);
					assertNamespaceChange(childRoutePath);
					return Reflect.set(target, prop, newValue, receiver);
				},

				defineProperty(target, prop, descriptor) {
					if (typeof prop !== "string") {
						assertNamespaceChange(routePath);
						return Reflect.defineProperty(target, prop, descriptor);
					}

					const childRoutePath = `${routePath}.${prop}`;
					enforceInternalPermission(childRoutePath);
					assertNamespaceChange(childRoutePath);
					return Reflect.defineProperty(target, prop, descriptor);
				},

				deleteProperty(target, prop) {
					if (typeof prop !== "string") {
						assertNamespaceChange(routePath);
						return Reflect.deleteProperty(target, prop);
					}

					const childRoutePath = `${routePath}.${prop}`;
					enforceInternalPermission(childRoutePath);
					assertNamespaceChange(childRoutePath);
					return Reflect.deleteProperty(target, prop);
				},

				setPrototypeOf(target, prototype) {
					assertNamespaceChange(routePath);
					return Reflect.setPrototypeOf(target, prototype);
				},

				preventExtensions(target) {
					assertNamespaceChange(routePath);
					return Reflect.preventExtensions(target);
				},

				// The members listed are the ones the reader is given, as `Object.keys` of a plain object lists what reading it
				// gives: a member whose read or description would be refused is left out, so listing the namespace, spreading it
				// or taking its entries never throws. A member the target fixes (non-configurable, or any of a closed target) is
				// listed whatever the reader may, as a Proxy has to.
				ownKeys(target) {
					const keys = Reflect.ownKeys(target);
					if (!Reflect.isExtensible(target)) return keys;
					return filterList(keys, (prop) => {
						const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
						if (!descriptor?.configurable) return true;
						// A member named like a function's own (`slothlet.caller`, `pin.caller`) is described only to a reader
						// that may read it (see getOwnPropertyDescriptor), so it is listed only to that reader.
						if (isMetaProperty(prop)) {
							try {
								enforceInternalPermission(`${routePath}.${prop}`);
								return true;
							} catch (error) {
								if (error?.code !== "PERMISSION_DENIED") throw error;
								return false;
							}
						}
						// The inspect hook is slothlet's, not a member of the namespace.
						if (prop === INSPECT_KEY) return !WeakSetMethods.has(NAMESPACE_INSPECT_HOOKS, descriptor.value);
						if (typeof prop !== "string") return true;
						const childRoutePath = `${routePath}.${prop}`;
						try {
							enforceInternalPermission(childRoutePath);
							return true;
						} catch (error) {
							if (error?.code !== "PERMISSION_DENIED") throw error;
						}
						// Denied, yet reached through it: a namespace an allow rule on a member below it opens, which the `get` and
						// `getOwnPropertyDescriptor` traps both hand out.
						const value = "value" in descriptor ? descriptor.value : undefined;
						return value !== null && typeof value === "object" && canTraverseInternalNamespace(childRoutePath);
					});
				},

				apply(target, thisArg, argArray) {
					enforceInternalPermission(routePath);
					return Reflect.apply(target, thisArg, argArray);
				},

				construct(target, argArray, newTarget) {
					enforceInternalPermission(routePath);
					return Reflect.construct(target, argArray, newTarget);
				}
			});

			MapMethods.set(routeCache, routePath, markSlothletProxy(proxy));
			WeakMapMethods.set(routeProxyTargets, proxy, value);
			return proxy;
		};

		/**
		 * The namespace as the route proxies hand it out, set once it is built: what an inspect hook reads through.
		 * @type {object|null}
		 */
		let namespaceRoutes = null;

		/**
		 * Objects in the namespace that are not this namespace's own and never take its hook: the ones the host handed
		 * slothlet (`reference`, `context`) and the one every instance shares (`types`). They are still shown inside it.
		 * @type {Set<object>}
		 */
		const notHooked = setFrom(
			filterList([slothlet.reference, slothlet.context, TYPE_STATES], (value) => value && typeof value === "object")
		);

		/**
		 * What `util.inspect` shows for a label: the text as it is, as it shows `[Function: name]` or `[Getter]`.
		 * @param {string} text - The text.
		 * @returns {object} The label.
		 */
		const inspectLabel = (text) => Objects.freeze(Objects.create(null, { [INSPECT_KEY]: { value: () => text } }));

		/**
		 * A namespace object as `util.inspect` shows it to the code inspecting it now: the members that code lists, each
		 * read through the route proxy as it reads it, a function and an accessor by their form (nothing is run), and a
		 * nested object the same way to the depth asked for. A plain copy, so `util.inspect` formats no route proxy and no
		 * object behind one (Node formats a Proxy's target, not what its traps answer, and Node 22/24 one level of it only).
		 * @param {object} view - The route proxy over `raw`, as the reader reaches it.
		 * @param {object} raw - The namespace object.
		 * @param {string} routePath - Its route (`slothlet.env`).
		 * @param {number|null} depth - Levels still to show; null for all.
		 * @param {Map<object, object>} made - The copies made so far, so a cycle shows as one.
		 * @returns {object} The copy.
		 */
		const namespaceShown = (view, raw, routePath, depth, made) => {
			const shown = Reflect.getPrototypeOf(raw) === null ? Objects.create(null) : {};
			MapMethods.set(made, raw, shown);
			// A frozen object (the environment snapshot) lists every member, so listing it is refused once a rule denies one
			// of them: its names are then taken from the object itself, and each is still read through the route proxy.
			let keys;
			try {
				keys = Objects.keys(view);
			} catch (error) {
				if (error?.code !== "PERMISSION_DENIED") throw error;
				keys = Objects.keys(raw);
			}
			for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				const descriptor = Reflect.getOwnPropertyDescriptor(raw, key);
				/* v8 ignore next -- a key the route proxy lists is one of the object's own */
				if (!descriptor) continue;
				const childRoutePath = `${routePath}.${key}`;
				try {
					if (!("value" in descriptor)) {
						enforceInternalPermission(childRoutePath);
						shown[key] = inspectLabel(descriptor.get && descriptor.set ? "[Getter/Setter]" : descriptor.get ? "[Getter]" : "[Setter]");
						continue;
					}
					const value = view[key];
					const held = descriptor.value;
					if (typeof held === "function") shown[key] = inspectLabel(runtime_codeLabel(held));
					else if (held === null || typeof held !== "object") shown[key] = value;
					else if (MapMethods.has(made, held)) shown[key] = MapMethods.get(made, held);
					else if (depth === null || depth > 0)
						shown[key] = namespaceShown(value, held, childRoutePath, depth === null ? null : depth - 1, made);
					else shown[key] = inspectLabel(Arrays.isArray(held) ? "[Array]" : "[Object]");
				} catch (error) {
					if (error?.code !== "PERMISSION_DENIED") throw error;
				}
			}
			return shown;
		};

		/**
		 * Give a namespace object the `util.inspect` hook that shows it as {@link namespaceShown} does, to whoever inspects
		 * it: Node formats the object behind a route proxy (the innermost one on Node 26, the next one on Node 22/24), so
		 * without it a module would be shown members it may not read, or Node 22/24 would list the next proxy itself.
		 * @param {object} raw - The namespace object.
		 * @param {string} routePath - Its route.
		 * @returns {void}
		 */
		const defineNamespaceInspect = (raw, routePath) => {
			const hook = function slothlet_namespaceInspect(depth) {
				if (typeof depth === "number" && depth < 0) return inspectLabel("[Object]");
				let view = namespaceRoutes;
				try {
					for (let ofIndex = 0, ofList = copyList(splitText(routePath, "."), 1); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						view = view[key];
					}
				} catch (error) {
					if (error?.code !== "PERMISSION_DENIED") throw error;
					return {};
				}
				return namespaceShown(view, raw, routePath, typeof depth === "number" ? depth : null, new Map());
			};
			WeakSetMethods.add(NAMESPACE_INSPECT_HOOKS, hook);
			Reflect.defineProperty(raw, INSPECT_KEY, { __proto__: null, value: hook, writable: false, enumerable: false, configurable: true });
		};

		/**
		 * Give every object of slothlet's own in the namespace its inspect hook (see {@link defineNamespaceInspect}).
		 * @param {object} raw - A namespace object.
		 * @param {string} routePath - Its route.
		 * @returns {void}
		 */
		const hookNamespace = (raw, routePath) => {
			if (raw === null || typeof raw !== "object" || SetMethods.has(notHooked, raw) || !Reflect.isExtensible(raw)) return;
			if (Reflect.getOwnPropertyDescriptor(raw, INSPECT_KEY)) return;
			const prototype = Reflect.getPrototypeOf(raw);
			if (prototype !== null && prototype !== Reflect.getPrototypeOf({})) return;
			defineNamespaceInspect(raw, routePath);
			for (let ofIndex = 0, ofList = Reflect.ownKeys(raw); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				if (typeof key !== "string") continue;
				const descriptor = Reflect.getOwnPropertyDescriptor(raw, key);
				if ("value" in descriptor) hookNamespace(descriptor.value, `${routePath}.${key}`);
			}
		};

		/**
		 * The environment snapshot as the namespace holds it: a frozen copy carrying the inspect hook, which the frozen
		 * snapshot cannot take.
		 * @param {object|null} snapshot - The instance's snapshot.
		 * @returns {object|null} The copy.
		 */
		const inspectableSnapshot = (snapshot) => {
			if (!snapshot) return snapshot;
			const copy = Objects.create(Reflect.getPrototypeOf(snapshot));
			for (let ofIndex = 0, ofList = Reflect.ownKeys(snapshot); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				Reflect.defineProperty(copy, key, Reflect.getOwnPropertyDescriptor(snapshot, key));
			}
			defineNamespaceInspect(copy, "slothlet.env");
			return Objects.freeze(copy);
		};

		// Read version from package.json (Node only; a browser keeps "unknown" — no fs access, #123).
		// loadJson swallows read/parse failures (returns null), so no try/catch is needed here.
		let version = "unknown";
		if (isNode) {
			const pkg = loadJson(new URL("../../../package.json", import.meta.url));
			/* v8 ignore else - node-only defensive: the else-arm is unreachable; this block runs only under Node where the repo's own package.json always has a version */
			if (pkg?.version) version = pkg?.version;
		}

		const namespace = {
			/**
			 * i18n translation helpers.
			 *
			 * @description
			 * Dev-facing convenience alias for the process-global Slothlet translation system.
			 * The i18n state is shared across all Slothlet instances in the current Node.js
			 * process (not per-instance). Prefer this for ergonomic access when you already
			 * have an API instance.
			 *
			 * @type {I18nNamespace}
			 */
			i18n: {
				// A locale that fails to load is warned about through this instance: its warning class.
				init: (options = {}) => initI18n({ SlothletWarning: slothlet.SlothletWarning, ...options }),
				language: {
					get: getLanguage,
					// A promise only where the load is asynchronous (a browser); `await` works everywhere.
					set: (lang) => setLanguage(lang, { SlothletWarning: slothlet.SlothletWarning })
				},
				translate,
				t
			},

			/**
			 * Slothlet version from package.json
			 * @type {string}
			 */
			version,

			/**
			 * Read-only facts about this instance.
			 * @type {Readonly<{id: string}>}
			 */
			instance: {
				/**
				 * This instance's id, read at access (a reload with a new id answers the new one).
				 * @returns {string} The id.
				 * @example
				 * api.slothlet.instance.id; // "slothlet_1794877110644_b1nk0g540"
				 */
				get id() {
					return slothlet.instanceID;
				}
			},

			/**
			 * Type state symbols to compare `api.slothlet.node(target).type` against
			 * @type {Object}
			 * @property {symbol} UNMATERIALIZED - Module not loaded yet
			 * @property {symbol} IN_FLIGHT - Materialization in progress
			 * @public
			 *
			 * @example
			 * if (api.slothlet.node(api.math).type === api.slothlet.types.IN_FLIGHT) {
			 *   console.log("Math module is loading...");
			 * }
			 */
			types: TYPE_STATES,

			/**
			 * API control object for hot reload operations
			 */
			api: {
				/**
				 * @param {string} apiPath - API path to add modules to.
				 * @param {string|string[]|Function|Record<string, unknown>} folderPath - What to mount: a directory to scan,
				 *   a single file (`.mjs`/`.cjs`/`.js`), or an array of file/folder paths. When an array is
				 *   provided, each path is processed sequentially and the return value is an array of
				 *   module ids in the same order. May also be inline content (synthetic / in-memory leaf, no
				 *   filesystem): a bare function mounts as one callable leaf; a plain object IS the export
				 *   map (its own keys mount as leaves — option-named keys included — never auto-extracted as
				 *   options); and an object with an `exports` key splits into content (`exports`) plus
				 *   sibling call-options (an explicit 3rd-arg option wins on conflict). Inline exports
				 *   flatten exactly as a file with those exports would.
				 * @param {object} [options={}] - Add options. A key not listed here throws `INVALID_CONFIG_UNKNOWN_KEY`.
				 * @param {string} [options.id] - The module id (generated when omitted).
				 * @param {object} [options.metadata] - Metadata attached to every mounted function.
				 * @param {string|object} [options.collision] - What happens when the mount meets an existing path; a string is
				 *   the mode alone.
				 * @param {string} [options.collision.mode] - Collision mode (same values as config `api.collision.mode`).
				 *   Locked unless config `api.collision.override` is true.
				 * @param {boolean} [options.collision.force] - Replace whatever is at the path, regardless of the mode.
				 * @param {boolean} [options.collision.mutate] - Merge into the existing node in place. Locked like `mode`.
				 * @param {boolean} [options.replay=true] - Whether `reload()` replays this add. Locked like `collision.mode`.
				 * @param {string|string[]} [options.hidden] - Globs (relative to the added folder) of files to leave out.
				 * @param {{ allow?: Array<string|object>, deny?: Array<string|object> }} [options.permissions] - Rules the
				 *   module mounts with.
				 * @param {object} [options.version] - Mount as one version of the path.
				 * @param {string} options.version.tag - The version tag (e.g. "v1", "2.3.0").
				 * @param {boolean} [options.version.default] - Mark this as the explicit default version.
				 * @param {object} [options.version.metadata] - Version metadata, stored in the version manager only.
				 * @returns {Promise<string|string[]>} Resolves with the module id, or an array of module ids
				 *   when `folderPath` is an array.
				 * @public
				 *
				 * @description
				 * Adds API modules from a folder into the current instance at runtime.
				 * With `options.version`, the module is mounted at `${options.version.tag}.${apiPath}` and a
				 * dispatcher proxy is created (or updated) at `${apiPath}`.
				 *
				 * @example
				 * await api.slothlet.api.add("plugins", "./plugins");
				 *
				 * @example
				 * // Synthetic / in-memory leaves (no filesystem)
				 * await api.slothlet.api.add("synth.greet", (name) => `Hello, ${name}`); // one callable leaf
				 * await api.slothlet.api.add("tools", { exports: { ping: () => "pong" } }); // named leaves
				 *
				 * @example
				 * // Versioned registration
				 * await api.slothlet.api.add("auth", "./api/v1", { version: { tag: "v1", default: true } });
				 * await api.slothlet.api.add("auth", "./api/v2", { version: { tag: "v2" } });
				 */
				add: async function slothlet_api_add(apiPath, folderPath, options = {}, ...extra) {
					// Check if add mutation is allowed
					if (!config.api?.mutations?.add) {
						throw new slothlet.SlothletError("API_MUTATION_DISABLED", { operation: ["slothlet", "api", "add"] });
					}
					// api.add takes (path, source, options); a further argument would otherwise be dropped unread.
					if (extra.length > 0 && extra[0] !== undefined) {
						throw new slothlet.SlothletError("INVALID_ARGUMENT", {
							argument: "arguments",
							expected: "(path, source, options)",
							received: `${3 + extra.length} arguments`
						});
					}
					const read = runtime_readAddOptions(slothlet, folderPath, options);
					folderPath = read.source;
					const versionConfig = read.versionConfig;
					// collision.mode / collision.mutate / replay are init-time or internal policy, not
					// per-call knobs — honoring a per-call override could bypass the instance's collision
					// config (#380). Locked by default: they are IGNORED (kept out of the mount) but WARN
					// loudly instead of the old silent strip — a throw here could break a live app that
					// still passes them. Opt in with config.api.collision.override to honor
					// them. collision.force stays the always-available targeted escape hatch regardless.
					let effectiveOptions = read.options;
					if (!config.api?.collision?.override) {
						const passed = filterList(LOCKED_ADD_OPTIONS, (entry) => entry[0] in effectiveOptions);
						if (passed.length > 0) {
							// The warning prints unless the instance is silent (decided inside the warning, #838).
							new slothlet.SlothletWarning("WARNING_COLLISION_OPTION_LOCKED", {
								option: ArrayMethods.join(
									mapList(passed, (entry) => entry[1]),
									", "
								)
							});
							// Strip the locked options so the override does not take effect.
							const unlocked = {};
							for (let ofIndex = 0, ofList = Objects.keys(effectiveOptions); ofIndex < ofList.length; ofIndex++) {
								const key = ofList[ofIndex];
								if (!ArrayMethods.some(passed, (entry) => entry[0] === key)) unlocked[key] = effectiveOptions[key];
							}
							effectiveOptions = unlocked;
						}
					}
					// When allowed (or none passed) forward options as-is so a per-call override is honored;
					// collision.force / id / metadata pass through in every case.
					// Building the module runs its code — its top level, and its exports' getters and Proxy traps as the
					// build reads them — which is the module's, never the code of a module that asked for the add (#597).
					const resolvedFolder = runtime_resolveAddFolder(slothlet, folderPath);
					// The module asking for the add is read here, before the build runs as no module: the add's ownership
					// checks are that module's (#625).
					const writer = runtime_selfModuleReader(slothlet);
					const writerCeilings = runtime_selfModuleCeilings(slothlet, writer);
					const build = () =>
						slothlet.handlers.apiManager.addApiComponent({
							apiPath,
							folderPath: resolvedFolder,
							options: effectiveOptions,
							versionConfig: versionConfig || null,
							writer,
							writerCeilings
						});
					const addResult = await runtime_buildAsNoModule(slothlet, build, resolvedFolder);
					// Stackable lifecycle routines (#341): a runtime mount can introduce new contributors
					// to an already-established routine chain — re-derive every chain's stacked callable
					// and root cascade so they reflect the newly mounted module(s). Does not re-fire
					// `mode: "startup"` routines (those run once, at the end of initial compose).
					// routineManager is always auto-registered (slothletProperty); the false arm is unreachable.
					/* v8 ignore next */
					if (slothlet.handlers.routineManager) {
						await slothlet.handlers.routineManager.rebuildStacks(userApi);
					}
					return addResult;
				},

				/**
				 * @param {string} target - API path or module ID to remove.
				 * @param {string} [id] - Optional module ID to scope the removal to. When given, `target` is the api
				 *   path and ONLY module `id`'s node at that path is removed — other modules sharing the path, and
				 *   that module's other mounts, are left untouched. Omit it for the whole-module (by id) or
				 *   whole-subtree (by path) removal.
				 * @returns {Promise<boolean>} True if something was removed, false if nothing matched.
				 * @public
				 *
				 * @description
				 * Removes API modules by apiPath or moduleID from the current instance. `remove(id)` removes
				 * every path the module owns; `remove(apiPath)` removes that path's whole subtree; and the
				 * two-argument `remove(apiPath, id)` removes only that module's single node at the path.
				 *
				 * @example
				 * await api.slothlet.api.remove("plugins.tools"); // by api path
				 * @example
				 * await api.slothlet.api.remove("plugins-core");  // by module id (all its paths)
				 * @example
				 * await api.slothlet.api.remove("plugins.tools", "plugins-core"); // just that module's node
				 */
				remove: async function slothlet_api_remove(target, id) {
					// Check if remove mutation is allowed
					if (!config.api?.mutations?.remove) {
						throw new slothlet.SlothletError("API_MUTATION_DISABLED", { operation: ["slothlet", "api", "remove"] });
					}
					if (typeof target !== "string") {
						throw new slothlet.SlothletError("INVALID_ARGUMENT", {
							argument: "target",
							expected: "string",
							received: typeof target
						});
					}
					// The optional scoping module id, when supplied, must be a string.
					if (id !== undefined && typeof id !== "string") {
						throw new slothlet.SlothletError("INVALID_ARGUMENT", {
							argument: "id",
							expected: "string",
							received: typeof id
						});
					}
					// Scoped: module `id`'s node at the path `target`. Unscoped: `target` is a path or a module id.
					const removeResult =
						id === undefined
							? await slothlet.handlers.apiManager.removeApiComponent(target, { scopedApiPath: undefined })
							: await slothlet.handlers.apiManager.removeApiComponent(id, { scopedApiPath: target });
					// Mirror add()'s rebuild above: a removal can leave 2+ contributors still stacked at a
					// path whose sole remaining live property is a bare function reinstalled by ownership's
					// "restore" (removeApiComponent never touches RoutineManager's stacked-callable
					// installs) — so a DIRECT call to that property silently drops every remaining
					// contributor except the one restore happened to reinstall, even though a `^`-anchored
					// cascade (reading RoutineManager.raw directly) still sees all of them (#372 review —
					// confirmed via a 3-contributor add/remove-one repro).
					// routineManager is always auto-registered (slothletProperty); the false arm is unreachable.
					/* v8 ignore next */
					if (slothlet.handlers.routineManager) {
						await slothlet.handlers.routineManager.rebuildStacks(userApi);
					}
					return removeResult;
				},

				/**
				 * @param {string} key - A moduleID returned by {@link add}, a mount endpoint or any api
				 *   path the module owns, or `"."` / `""` for the base load.
				 * @param {object} [options={}] - Enumeration options.
				 * @param {boolean} [options.details=false] - Return every owned path tagged with its kind
				 *   instead of the callable paths alone.
				 * @param {boolean} [options.private=false] - Include module-private members the
				 *   caller could not read. Host only — a module asking for it is refused.
				 * @returns {Promise<string[][]|Array<{path: string[], kind: "function"|"namespace"|"data"}>>}
				 *   Sorted callable leaf paths, or `{ path, kind }` records under `details`.
				 * @throws {SlothletError} INVALID_ARGUMENT when `key` is not a string, `options` is not an
				 *   object, or `options.details`/`options.private` is not a boolean.
				 * @throws {SlothletError} INVALID_CONFIG_UNKNOWN_KEY when `options` has a key other than `details`/`private`.
				 * @throws {SlothletError} PERMISSION_DENIED when a MODULE caller passes `private`.
				 * @throws {SlothletError} MODULE_UNKNOWN when the key resolves to no module.
				 * @public
				 *
				 * @description
				 * Enumerates the api paths a module owns, read from the loader's ownership records rather
				 * than by walking the live api object — so the answer is complete under lazy (the owned
				 * subtree is settled first) and reports the flattened callable paths a caller actually
				 * invokes. For the base load, the injected control tree (`slothlet.*`, `shutdown`,
				 * `destroy`) is not a module contribution and is excluded.
				 *
				 * Enumeration is a disclosure surface, so the answer is scoped to the CALLER:
				 * module-private members (#260) the caller could not read are omitted, which keeps this
				 * in step with the redaction `Object.keys` already performs on the composed surface. A
				 * module therefore sees its own module's privates and no other module's. `private`
				 * asks for the unredacted list and is host-only: reaching `slothlet.api.leaves` at all is
				 * gated like the rest of `slothlet.*`, but that gate says nothing about another module's
				 * privates, so a module cannot self-grant sight of them. With permissions disabled
				 * nothing is private and nothing is filtered.
				 *
				 * @example
				 * const moduleID = await api.slothlet.api.add("shop", "./ext/shop/api");
				 * await api.slothlet.api.leaves(moduleID); // [["shop", "connect"], ["shop", "search"]]
				 * await api.slothlet.api.leaves("shop"); // same, by mount endpoint
				 * await api.slothlet.api.leaves("shop", { details: true }); // [{ path: ["shop", "connect"], kind }, ...]
				 */
				leaves: async function slothlet_api_leaves(key, options = {}) {
					enforceInternalPermission("slothlet.api.leaves");
					if (typeof key !== "string") {
						throw new slothlet.SlothletError("INVALID_ARGUMENT", {
							argument: "key",
							expected: "string",
							received: typeof key
						});
					}
					// Same option-bag normalization the other public entry points use (see
					// PermissionManager.checkAccess): null and undefined both mean "no options", and a
					// wrong-shaped bag gets a named error rather than a raw TypeError from the first
					// property read.
					const normalizedOptions = options == null ? {} : options;
					if (typeof normalizedOptions !== "object" || Arrays.isArray(normalizedOptions)) {
						throw new slothlet.SlothletError("INVALID_ARGUMENT", {
							argument: "options",
							expected: "object with optional boolean details/private",
							received: Arrays.isArray(normalizedOptions) ? "array" : typeof normalizedOptions
						});
					}
					assertOptionKeys(normalizedOptions, "slothlet.api.leaves");
					const { details = false, private: includePrivate = false } = normalizedOptions;
					for (
						let ofIndex = 0,
							ofList = [
								["details", details],
								["private", includePrivate]
							];
						ofIndex < ofList.length;
						ofIndex++
					) {
						const ofEntry = ofList[ofIndex],
							name = ofEntry[0],
							value = ofEntry[1];
						if (typeof value !== "boolean") {
							throw new slothlet.SlothletError("INVALID_ARGUMENT", {
								argument: `options.${name}`,
								expected: "boolean",
								received: typeof value
							});
						}
					}
					const ownership = slothlet.handlers.ownership;

					// Enumeration is a disclosure surface, so it answers with what THIS caller may
					// reach. `slothlet.api.leaves` being reachable at all is gated above; that gate
					// says nothing about another module's module-private members (#260), which the
					// composed surface already redacts from `Object.keys`. Reading identity the same
					// way enforceInternalPermission does — a host caller has no currentWrapper.
					const leavesIdentity = slothlet.contextManager?.getCallerIdentity?.();
					const leavesCaller = leavesIdentity?.currentWrapper ?? null;
					if (includePrivate && leavesCaller) {
						// The unredacted list is a host/tooling capability. A module asking for it would
						// be self-granting sight of every other module's privates, so it is refused
						// rather than quietly downgraded to the redacted list.
						throw new slothlet.SlothletError("PERMISSION_DENIED", {
							// `apiPath` is set on every constructed wrapper, so the fallback guards a state
							// a module caller cannot be in — the same defensive read, with the same
							// justification, as enforceInternalPermission above.
							/* v8 ignore next */
							caller: leavesCaller.____slothletInternal?.apiPath ?? "",
							target: segmentsOf("slothlet.api.leaves:private")
						});
					}

					// Resolve the key to an owning module: moduleID first (the add() return value), then
					// mount endpoint, then any owned path — matching how remove()/reload() take either.
					let moduleID = null;
					if (key === "." || key === "") {
						moduleID = ArrayMethods.find(mapEntriesToArray(ownership.moduleEndpoints), (entry1) => {
							const endpoint = entry1[1];
							return endpoint === ".";
						})?.[0];
					} else if (MapMethods.has(ownership.moduleToPath, key)) {
						moduleID = key;
					} else {
						// Current owner first — the same resolution remove()/reload() use. Scanning the
						// endpoint map instead would return whichever moduleID was inserted first, which
						// is not the active owner once several live mounts share an endpoint.
						moduleID = ownership.getCurrentOwner(key)?.moduleID ?? null;
						if (!moduleID) {
							// A mount whose endpoint is not itself an owned path (it only registered
							// children) is still addressable by that endpoint.
							moduleID =
								ArrayMethods.find(mapEntriesToArray(ownership.moduleEndpoints), (entry2) => {
									const endpoint = entry2[1];
									return endpoint === key;
								})?.[0] ?? null;
						}
					}
					if (!moduleID || !MapMethods.has(ownership.moduleToPath, moduleID)) {
						throw new slothlet.SlothletError("MODULE_UNKNOWN", { key });
					}

					// Under lazy an untouched subtree has only namespace records — its leaf names genuinely
					// do not exist until the files load. Settle the owned subtree so the records are
					// complete; materialization itself registers the leaves.
					const endpoint = MapMethods.get(ownership.moduleEndpoints, moduleID);
					const boundApi = slothlet.boundApi;
					if (config.mode === "lazy" && boundApi) {
						// Cycle-safe rather than depth-capped. `apiDepth` is unbounded by default, so an
						// arbitrary cutoff would silently under-settle a legitimately deep tree and return
						// an incomplete answer — the exact failure this method exists to avoid. Wrapper
						// identities are stable across reads, so a visited set terminates on a
						// runtime-introduced cycle (a module assigning a parent onto a child) without
						// putting a ceiling on real depth.
						const seen = new WeakSet();
						// The endpoint is registry-resolved, so its path exists on the bound api by construction.
						let root = boundApi;
						if (endpoint !== ".") {
							for (let i = 0, segments = splitText(endpoint, "."); i < segments.length; i++) root = root[segments[i]];
						}
						// Child discovery cannot rely on live enumeration alone: the walk reads the composed
						// surface under the CALLER's permission context, and a module-private SUBDIRECTORY is
						// redacted from that enumeration while still being its own materialization unit — so
						// key-only discovery would never load it and the records would stay silently
						// incomplete, even under includePrivate. The ownership records supply the segments
						// enumeration cannot see — read LIVE per node, because a directory's namespace record
						// registers when its parent materializes, mid-walk; the property READ itself is not
						// key-gated, and the visited set absorbs the overlap between the two sources.
						//
						// An explicit stack, not recursion, for the same unbounded-depth reason: the walk's
						// depth is caller-controlled, and a recursive descent would turn a deep-but-finite
						// subtree into a call-stack overflow. A node carries its api path only while it is a
						// recorded path itself — runtime-grafted subtrees walk with a null path, so an
						// arbitrarily deep graft never accumulates path strings.
						const pending = [{ node: root, path: endpoint === "." ? "" : endpoint }];
						while (pending.length > 0) {
							const { node, path } = ArrayMethods.pop(pending);
							if (node === null || (typeof node !== "object" && typeof node !== "function")) continue;
							if (WeakSetMethods.has(seen, node)) continue;
							WeakSetMethods.add(seen, node);
							// Settling is slothlet's own bookkeeping: the node's state is read from its wrapper, not through the
							// caller's view, where a `__`-named marker would be held to the caller's rules (#816).
							const raw = resolveWrapper(runtime_nodeBehind(runtime_unwrapSelfView(node)));
							if (raw && raw.____slothletInternal.state.materialized === false) {
								await raw.___materialize();
							}
							const childKeys = setFrom(Objects.keys(node));
							// Read after the materialize await: that is what registers this node's children,
							// and a concurrent remove() may have deleted the record set entirely (the
							// post-settle re-check below turns that into the named error).
							const records = MapMethods.get(ownership.moduleToPath, moduleID);
							if (path !== null && records) {
								const prefix = path === "" ? "" : `${path}.`;
								for (const ownedPath of setValues(records)) {
									if (ownedPath === "" || (prefix !== "" && !StringMethods.startsWith(ownedPath, prefix))) continue;
									const rest =
										typeof ownedPath === "string" ? StringMethods.slice(ownedPath, prefix.length) : copyList(ownedPath, prefix.length);
									const segmentEnd = typeof rest === "string" ? StringMethods.indexOf(rest, ".") : ArrayMethods.indexOf(rest, ".");
									SetMethods.add(
										childKeys,
										segmentEnd === -1
											? rest
											: typeof rest === "string"
												? StringMethods.slice(rest, 0, segmentEnd)
												: copyList(rest, 0, segmentEnd)
									);
								}
							}
							for (const childKey of setValues(childKeys)) {
								// The injected control tree (slothlet/shutdown/destroy) lives ONLY on the
								// base-load root's plain object, so skip those names there and nowhere else.
								// The same names NESTED under a mount are legitimate module exports — reserved
								// only at the root, never below it (issue #176) — and skipping them at every
								// level left a nested `shop.shutdown.*` subtree unsettled under lazy.
								if (path === "" && (childKey === "slothlet" || childKey === "shutdown" || childKey === "destroy")) continue;
								let child;
								try {
									child = node[childKey];
								} catch {
									// A record-derived key can be a private TERMINAL export, and reading one is
									// caller-gated (unlike a private subdirectory's node, whose read passes). A
									// refused read owes the walk nothing: the terminal is already registered by
									// its file's materialization, and a subtree this caller cannot read it also
									// cannot see in its answer — settling stays scoped to the caller's reach.
									continue;
								}
								// A user-assigned wrap-on-set override contributes no owned module paths and can be an
								// arbitrarily deep runtime graft — walking it settles nothing and would pay a wrapper
								// materialization per level. Skip descending into it (#329 / #247 unbounded depth).
								const childWrapper = child ? resolveWrapper(child) : null;
								if (childWrapper?.____slothletInternal?.userAssigned) continue;
								const childPath = path === null ? null : path === "" ? childKey : `${path}.${childKey}`;
								listPush(pending, {
									node: child,
									path: (records == null ? undefined : SetMethods.has(records, childPath)) ? childPath : null
								});
							}
						}
					}

					// Settling above awaits, and the instance stays live across it — a concurrent
					// remove()/reload() can unregister this module while we wait. Re-check rather than
					// spreading `undefined` into a raw TypeError from inside the framework.
					if (!MapMethods.has(ownership.moduleToPath, moduleID)) {
						throw new slothlet.SlothletError("MODULE_UNKNOWN", { key });
					}

					// Classify from the records: the registered value names the kind, and a path with an
					// owned strict child is a namespace regardless of its own shape.
					const ownedPaths = filterList(setToArray(MapMethods.get(ownership.moduleToPath, moduleID)), (path) => {
						// No mount registers the empty-string root path in moduleToPath — the base load, a root
						// object mount, and a root folder mount all register named leaves — so this is a defensive
						// skip for a momentarily-inconsistent record, mirroring the settle guard above.
						/* v8 ignore next */
						if (path === "") return false;
						if (
							endpoint === "." &&
							(path === "slothlet" || StringMethods.startsWith(path, "slothlet.") || path === "shutdown" || path === "destroy")
						)
							return false;
						// Drop a path only when ANOTHER module currently owns it — i.e. it has been taken
						// over on a shared mount — so leaves attributes it to the current owner, matching
						// how an endpoint key already resolves. A single unshared mount owns its whole
						// subtree (no-op). A path with no resolvable current owner (a momentarily
						// inconsistent record) is kept, not silently dropped — the resilience contract.
						const currentOwner = ownership.getCurrentOwner(path);
						return !currentOwner || currentOwner.moduleID === moduleID;
					});
					ArrayMethods.sort(ownedPaths);
					// Precomputed once. A path is a namespace iff some owned path has it as a strict
					// prefix; collecting each owned path's ancestors costs one pass over the segments,
					// where re-scanning the whole list per path was quadratic and showed up on modules
					// with many owned paths — including on the default (non-details) call, which
					// classifies every path to filter for callables.
					const namespaces = new Set();
					for (let ofIndex = 0, ofList = ownedPaths; ofIndex < ofList.length; ofIndex++) {
						const owned = ofList[ofIndex];
						let cut = StringMethods.lastIndexOf(owned, ".");
						while (cut > 0) {
							SetMethods.add(namespaces, typeof owned === "string" ? StringMethods.slice(owned, 0, cut) : copyList(owned, 0, cut));
							cut = StringMethods.lastIndexOf(owned, ".", cut - 1);
						}
					}
					const kindOf = (path) => {
						// A namespace is a path with an owned strict child — the registry granularity. That
						// check runs first, so a wrapper proxy's callable TARGET (callable regardless of the
						// impl) can never misreport a namespace: anything function-typed left after it is a
						// real callable leaf, and everything else — strings, numbers, childless object
						// exports — is data.
						if (SetMethods.has(namespaces, path)) return "namespace";
						const entry = ArrayMethods.find(
							MapMethods.get(ownership.pathToModule, path) ?? [],
							(candidate) => candidate.moduleID === moduleID
						);
						return typeof entry?.value === "function" ? "function" : "data";
					};

					// Redact the module-private members this caller could not read, so enumeration agrees
					// with the composed surface for the same caller. `includePrivate` (host only, gated
					// above) asks for the unredacted list — the tooling case this method exists for.
					// With permissions disabled nothing is private, so nothing is filtered and the
					// answer is exactly what it was before privacy existed.
					const permissionManager = slothlet.handlers?.permissionManager;
					let visiblePaths = ownedPaths;
					if (!includePrivate && permissionManager?.isEnabled?.()) {
						const callerPath = leavesCaller?.____slothletInternal?.apiPath ?? "";
						const callerFilePath = leavesCaller?.____slothletInternal?.filePath ?? null;
						const runtimeContext = slothlet.contextManager?.tryGetContext?.()?.context ?? null;
						visiblePaths = filterList(ownedPaths, (path) => {
							if (!permissionManager.isPrivateTarget(path)) return true;
							const entry = ArrayMethods.find(
								MapMethods.get(ownership.pathToModule, path) ?? [],
								(candidate) => candidate.moduleID === moduleID
							);
							// No `?? null` on the file path: checkAccess already defaults that parameter to
							// null, so the fallback only added an arm nothing could drive.
							return permissionManager.checkAccess(callerPath, path, callerFilePath, entry?.filePath, runtimeContext);
						});
					}

					// Reported as segments arrays (D-1); kindOf and the filters above work on the stored dotted form.
					if (details) {
						return mapList(visiblePaths, (path) => ({ path: segmentsOf(path), kind: kindOf(path) }));
					}
					return mapList(
						filterList(visiblePaths, (path) => kindOf(path) === "function"),
						(path) => segmentsOf(path)
					);
				},

				/**
				 * @param {string|null} [pathOrModuleId] - API path, module ID, or base module identifier.
				 *   Pass null, undefined, "", or "." to reload the base module.
				 *   Pass a string matching a loaded moduleID to reload that specific module.
				 *   Pass an API path string to reload the module(s) that contribute to that path.
				 * @param {Object} [options] - Optional reload options.
				 * @param {Object} [options.metadata] - Metadata to merge/update for the reloaded path.
				 *   Applied after the cache rebuild so it takes effect on all freshly-tagged wrappers.
				 * @returns {Promise<void>}
				 * @public
				 *
				 * @description
				 * Reloads API modules from disk, preserving wrapper references and custom properties.
				 * Requires `api.mutations.reload: true` in configuration.
				 *
				 * For base module reload, pass null, undefined, empty string, or ".".
				 * For specific module reload, pass the moduleID from an add operation.
				 * For path-based reload, pass a dot-separated API path - the system
				 * finds the owning cache(s) automatically (exact match, children,
				 * ownership history, or parent scope).
				 *
				 * @example
				 * // Reload the base module
				 * await api.slothlet.api.reload(".");
				 * await api.slothlet.api.reload();
				 *
				 * @example
				 * // Reload a specific API path
				 * await api.slothlet.api.reload("plugins");
				 *
				 * @example
				 * // Reload by module ID
				 * await api.slothlet.api.reload("myModule_abc123");
				 */
				reload: async function slothlet_api_reload(pathOrModuleId, options) {
					// Check if reload mutation is allowed
					if (!config.api?.mutations?.reload) {
						throw new slothlet.SlothletError("API_MUTATION_DISABLED", { operation: ["slothlet", "api", "reload"] });
					}
					assertOptionKeys(options, "slothlet.api.reload");

					// Normalize base module identifiers: null, undefined, "", "." all mean base module
					if (pathOrModuleId == null || pathOrModuleId === "" || pathOrModuleId === ".") {
						// Module code rebuilds only what it may write (#625): the base reaches the whole tree.
						slothlet.handlers.apiManager.assertModuleReload(null, "");
						return runtime_buildAsNoModule(slothlet, () => slothlet.handlers.apiManager.reloadApiComponent({ apiPath: ".", options }));
					}

					if (typeof pathOrModuleId !== "string") {
						throw new slothlet.SlothletError("INVALID_ARGUMENT", {
							argument: "pathOrModuleId",
							expected: "string, null, undefined, or '.'",
							received: typeof pathOrModuleId
						});
					}

					// Check if string matches a loaded moduleID
					const isModuleId = ArrayMethods.some(slothlet.handlers.apiManager.state.addHistory, (entry) => entry.moduleID === pathOrModuleId);

					if (isModuleId) {
						// Module code rebuilds only what it may write (#625).
						slothlet.handlers.apiManager.assertModuleReload(pathOrModuleId, null);
						return runtime_buildAsNoModule(slothlet, () =>
							slothlet.handlers.apiManager.reloadApiComponent({ moduleID: pathOrModuleId, options })
						);
					}

					// Treat as API path - validate it exists in the user-facing API
					const normalizedPath = slothlet.handlers.apiManager.normalizeApiPath(pathOrModuleId).apiPath;
					const pathParts = splitText(normalizedPath, ".");
					// A loaded module's endpoint is reloadable even while nothing is live there: a scoped removal that
					// emptied it pruned the namespace, and the reload puts the module's members back.
					const cacheManager = slothlet.handlers.apiCacheManager;
					const isLoadedEndpoint = ArrayMethods.some(
						cacheManager.getAllModuleIDs(),
						(id) => cacheManager.get(id).endpoint === normalizedPath
					);
					let current = slothlet.api;
					for (let i = 0; i < pathParts.length; i++) {
						const part = pathParts[i];
						if (!current || (typeof current !== "object" && typeof current !== "function")) {
							current = undefined;
							break;
						}
						current = current[part];
					}

					if (current === undefined && !isLoadedEndpoint) {
						throw new slothlet.SlothletError("API_PATH_NOT_FOUND", {
							path: segmentsOf(pathOrModuleId)
						});
					}

					// Module code rebuilds only what it may write (#625).
					slothlet.handlers.apiManager.assertModuleReload(null, normalizedPath);
					// Reload by API path - _findAffectedCaches resolves which caches to rebuild
					return runtime_buildAsNoModule(slothlet, () =>
						slothlet.handlers.apiManager.reloadApiComponent({ apiPath: normalizedPath, options })
					);
				},

				/**
				 * Module discovery + mount sub-namespace. Wraps the ModuleManager handler.
				 * Provides the discover/sort/add/remove pipeline for slothlet plugin modules
				 * shipped as separate npm packages with `slothlet.module.json` manifests.
				 *
				 * See `docs/MODULE-DISCOVERY.md` for the canonical reference and the
				 * `MODULE_*` i18n entries for the full surface and error codes.
				 */
				modules: {
					/**
					 * @param {import("../helpers/module-discovery.mjs").DiscoverOptions} [options]
					 * @returns {Promise<import("../helpers/module-discovery.mjs").DiscoverResult[]>}
					 */
					discover: function slothlet_modules_discover(options) {
						return slothlet.handlers.moduleManager.discover(options);
					},

					/**
					 * @param {import("../helpers/module-discovery.mjs").DiscoverResult[]} results
					 * @param {(a, b) => number} [comparator]
					 * @returns {import("../helpers/module-discovery.mjs").DiscoverResult[]}
					 */
					sort: function slothlet_modules_sort(results, comparator) {
						return slothlet.handlers.moduleManager.sort(results, comparator);
					},

					/**
					 * Mount modules. The target says which:
					 * - a package name, or a result this instance's `discover()` / `cache.get()` returned: mounts that one module;
					 * - an array of those: mounts the batch;
					 * - nothing (or only an options object): runs `discover()`, `sort()` and mounts every result.
					 * Only results this instance's discovery returned count as a result; any other object is the options.
					 * @param {string|import("../helpers/module-discovery.mjs").DiscoverResult|Array<string|import("../helpers/module-discovery.mjs").DiscoverResult>|object} [target]
					 * @param {object} [options] - `collision`, `version` (one module), `failure` and `concurrency` (a batch or a
					 *   discover run), `discover` (the discover options) and `sort` (a comparator, discover run only).
					 * @returns {Promise<*>} The mount result (one module) or the batch result.
					 * @example
					 * await api.slothlet.api.modules.add("@org/driver");
					 * await api.slothlet.api.modules.add(["@org/a", "@org/b"], { concurrency: 2 });
					 * await api.slothlet.api.modules.add({ discover: { prefix: "@org/" } });
					 */
					add: async function slothlet_modules_add(target, options) {
						if (!config.api?.mutations?.add) {
							throw new slothlet.SlothletError("API_MUTATION_DISABLED", { operation: ["slothlet", "api", "modules", "add"] });
						}
						// The calling module, read before any await (#625): see ModuleManager#addModule.
						const writer = runtime_selfModuleReader(slothlet);
						const manager = slothlet.handlers.moduleManager;
						// One argument that is a plain object this instance's discovery did not return is the options of a discover run.
						if (target !== null && typeof target === "object" && !Arrays.isArray(target) && !manager.issued(target)) {
							if (options !== undefined) {
								throw new slothlet.SlothletError("INVALID_ARGUMENT", {
									argument: "target",
									expected: "module name, discover result or array of them",
									received: "object"
								});
							}
							options = target;
							target = undefined;
						}
						// Only a missing target is a discover run; `null` is a wrong argument, as for any other non-name.
						if (target === undefined) {
							const given = options ?? {};
							assertOptionKeys(given, "slothlet.api.modules.add.run", "slothlet.api.modules.add");
							const { sort: comparator, discover: discoverOptions = {}, collision, failure, concurrency } = given;
							const found = await manager.discover(discoverOptions);
							const ordered = manager.sort(found, comparator);
							return manager.addModules(ordered, { collision, failure, concurrency }, writer);
						}
						if (Arrays.isArray(target)) return manager.addModules(target, options, writer);
						return manager.addModule(target, options, writer);
					},

					/**
					 * @param {string} name
					 * @param {{version?: string}} [opts]
					 * @returns {Promise<boolean>}
					 */
					remove: async function slothlet_modules_remove(name, opts) {
						if (!config.api?.mutations?.remove) {
							throw new slothlet.SlothletError("API_MUTATION_DISABLED", { operation: ["slothlet", "api", "modules", "remove"] });
						}
						// The calling module, read before any await (#625): see ModuleManager#removeModule.
						return slothlet.handlers.moduleManager.removeModule(name, opts, runtime_selfModuleReader(slothlet));
					},

					/**
					 * The discovery cache: what the last `discover()` found.
					 * @type {object}
					 */
					cache: {
						/**
						 * @returns {import("../helpers/module-discovery.mjs").DiscoverResult[]} Snapshot of the current discovery cache.
						 */
						get: function slothlet_modules_cache_get() {
							return slothlet.handlers.moduleManager.getDiscoveryCache();
						},

						/**
						 * Empty the discovery cache. Does not unmount any modules.
						 * @returns {void}
						 */
						clear: function slothlet_modules_cache_clear() {
							return slothlet.handlers.moduleManager.clearDiscoveryCache();
						}
					},

					/**
					 * @returns {import("../handlers/module-manager.mjs").MountResult[]} Mounts whose package+version no longer appears in the discovery cache (S3b).
					 */
					stale: function slothlet_modules_stale() {
						return slothlet.handlers.moduleManager.getStaleMounts();
					}
				}
			},

			/**
			 * @param {string} str - String to sanitize (e.g., filename, path segment)
			 * @returns {string} Sanitized property name safe for API use
			 * @public
			 *
			 * @description
			 * Sanitizes a string using the same rules applied during API path construction,
			 * including any sanitize options set in the Slothlet config.
			 * Useful for predicting what API path a given filename will become.
			 *
			 * @example
			 * api.slothlet.sanitize("my-module.mjs")  // => "myModule"
			 * api.slothlet.sanitize("auto-IP.mjs")    // => "autoIP"
			 */
			sanitize: function slothlet_sanitize(str) {
				if (typeof str !== "string") {
					throw new slothlet.SlothletError("INVALID_ARGUMENT", {
						argument: "str",
						expected: "string",
						received: typeof str
					});
				}
				return slothlet.helpers.sanitize.sanitizePropertyName(str, slothlet.config.sanitize || {});
			},

			/**
			 * Freeze caller identity onto a callback so it always runs as the registering module.
			 * @param {Function} fn - The callback whose caller identity should be pinned.
			 * @returns {Function} A wrapper that invokes `fn` with the frozen caller identity.
			 * @throws {SlothletError} INVALID_ARGUMENT when `fn` is not a function.
			 * @public
			 *
			 * @description
			 * Callbacks stored in plain arrays — Fastify's `server.addHook()`, third-party
			 * event registries, and similar mechanisms — never pass through slothlet's
			 * `EventEmitter` patch, so they inherit whatever async context happens to be
			 * ambient when they fire. A `self.*` call inside such a callback is then attributed
			 * to the wrong module and permission rules keyed to the registering module fail.
			 *
			 * `pin` captures the registering module's `currentWrapper` at call time and,
			 * on every invocation of the returned wrapper, overrides **only** the caller
			 * identity on the live context store. The request-scoped context set later in the
			 * lifecycle stays live and visible; `self` stays the live proxy. This is
			 * intentionally not `AsyncResource.bind` — use {@link bind} to freeze the whole
			 * async context.
			 *
			 * Called with no active context (no module wrapper to capture) it is a no-op
			 * passthrough — `pin` is meaningful only when called from inside a module
			 * (during `init()` or a request).
			 *
			 * Errors thrown by `fn` propagate unchanged — the original error type, `code`,
			 * and `status` are preserved, never re-typed as `CONTEXT_EXECUTION_FAILED`.
			 *
			 * **Runtime-mode caveat.** In **async** runtime mode the pinned identity propagates
			 * through `AsyncLocalStorage` for the callback's entire async lifetime — `self.*`
			 * calls after an `await` still resolve to the registering module. In **live** runtime
			 * mode the caller is pinned only for the **synchronous** portion of `fn`: the live
			 * context manager restores the previous wrapper as soon as `fn` returns its promise.
			 * Once that synchronous stack has unwound there may be **no slothlet caller at all**,
			 * so an async callback that `await`s before calling `self.*` resumes under whatever
			 * context is then active — typically none, and an identity check sees `unknown`.
			 * Live mode keeps no per-async-task context, so this cannot be preserved across
			 * awaits — use **async** runtime mode for async callbacks (such as `async` Fastify
			 * hooks) that must keep locked identity past their first `await`.
			 *
			 * @example
			 * // Inside a module's init(): pin caller identity onto a Fastify hook.
			 * // Async hook → use async runtime mode so identity survives awaits.
			 * server.addHook("onRequest", self.slothlet.pin(handler));
			 */
			pin: function slothlet_pin(fn) {
				if (typeof fn !== "function") {
					throw new slothlet.SlothletError("INVALID_ARGUMENT", {
						argument: "fn",
						expected: "function",
						received: typeof fn
					});
				}
				// Capture the registering module's identity now (null when called outside a module).
				// Resolved per flow: the whole point of pin is to pin *this* module, so reading
				// the live runtime's shared field could pin whichever module happened to enter last.
				// Scoped to this instance, as enforcement is: with another instance in flight the live
				// runtime's shared active-instance field can name that one instead (#592).
				const capturedIdentity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
				const capturedWrapper = capturedIdentity?.currentWrapper ?? null;
				// Code a caller supplied to another call pins as that caller under the call as its ceiling, so
				// the pin cannot carry it past what the call it ran inside may do (#597).
				const capturedCeiling = capturedIdentity?.ceiling ?? null;
				// No wrapper to capture — return `fn` itself so this is a true no-op
				// passthrough. Wrapping would still route through runInContext(), which
				// creates/switches to this instance's context instead of leaving `fn`'s
				// own ambient context untouched.
				if (!capturedWrapper) return fn;
				const locked = function slothlet_lockedCaller(...args) {
					// rawErrors: a locked framework callback must surface its own errors
					// unchanged, not re-typed as CONTEXT_EXECUTION_FAILED.
					// instanceID/contextManager are resolved live off the long-lived
					// slothlet object so a callback held across a reload() (which swaps
					// both) still targets the current instance.
					return slothlet.contextManager.runInContext(slothlet.instanceID, fn, this, args, capturedWrapper, true, false, capturedCeiling);
				};
				// Parity with the EventEmitter patch metadata.
				locked.____slothletOriginal = fn;
				return runtime_markCallerLocked(locked);
			},

			/**
			 * Freeze the entire async context onto a callback (re-export of `AsyncResource.bind`).
			 * @param {Function} fn - The callback to bind.
			 * @returns {Function} The bound callback.
			 * @throws {SlothletError} INVALID_ARGUMENT when `fn` is not a function.
			 * @public
			 *
			 * @description
			 * Convenience re-export of Node's `AsyncResource.bind`. Unlike {@link pin},
			 * which overrides only the caller identity and leaves the request-scoped context
			 * live, `bind` freezes the **entire** async context captured at registration time —
			 * every `AsyncLocalStorage`, including slothlet's caller and request context.
			 *
			 * `AsyncResource.bind` only meaningfully captures slothlet's caller/context in
			 * **async** runtime mode; in live mode the slothlet store is kept off the ALS, so
			 * `bind` degrades to binding whatever other async context exists.
			 *
			 * @example
			 * server.addHook("onRequest", self.slothlet.bind(handler));
			 */
			bind: function slothlet_bind(fn) {
				if (typeof fn !== "function") {
					throw new slothlet.SlothletError("INVALID_ARGUMENT", {
						argument: "fn",
						expected: "function",
						received: typeof fn
					});
				}
				// Browser host: no AsyncResource (live context), so bind is identity (`: fn`). This nested
				// method lives outside api_builder's instrumented coverage region (the v8 map stops inside
				// createSlothletNamespace, before its returned object's methods), so neither the node run nor
				// the browser merge can count this arm — mark the browser-only `: fn` honestly.
				/* v8 ignore next - browser-only: `: fn` identity bind; outside the file's instrumented region */
				return AsyncResource ? AsyncResource.bind(fn, "slothlet-bound") : fn;
			},

			/**
			 * Context API for per-request context isolation.
			 * @type {object}
			 */
			context: {
				/**
				 * Get context value or full context object.
				 * @param {string} [key] - Optional key to get specific value
				 * @returns {*} Context value if key provided, full context object if no key
				 * @public
				 */
				get: (key) => {
					// SIMPLIFIED APPROACH: Just lookup by instance ID
					// With child instance approach, we always find the right context by current instanceID

					// For live mode, use currentInstanceID tracking
					if (slothlet.contextManager.constructor.name === "LiveContextManager") {
						const currentID = slothlet.contextManager.currentInstanceID;

						// Check if current is this instance or a child of this instance.
						// Also check parentInstanceID so that child __run_ contexts created
						// before a reload() (whose base instanceID changed) still resolve.
						if (currentID) {
							const activeStore = MapMethods.get(slothlet.contextManager.instances, currentID);
							const isOurInstance =
								currentID === slothlet.instanceID ||
								StringMethods.startsWith(currentID, slothlet.instanceID + "__run_") ||
								activeStore?.parentInstanceID === slothlet.instanceID;

							if (isOurInstance && activeStore) {
								return key ? activeStore.context[key] : { ...activeStore.context };
							}
						}

						// Fallback to base instance
						const store = MapMethods.get(slothlet.contextManager.instances, slothlet.instanceID);
						// unreachable via tests (2026-03-05): instances map always contains the base
						// instanceID after initialization; only fires if store was externally deleted.
						/* v8 ignore next */
						if (!store) {
							const baseContext = slothlet.context || {};
							return key ? baseContext[key] : { ...baseContext };
						}
						// live-mode context; spread (no-key) form never requested in tests.
						/* v8 ignore next */
						return key ? store.context[key] : { ...store.context };
					}

					// For async mode, get current store from ALS and lookup by its instanceID
					if (slothlet.contextManager.constructor.name === "AsyncContextManager") {
						let currentStore = slothlet.contextManager.tryGetContext();

						// If we're in a .run() scope, currentStore will be the child instance
						// If we're not in .run(), get base store for this instance
						if (!currentStore) {
							const baseStore = MapMethods.get(slothlet.contextManager.instances, slothlet.instanceID);
							// baseStore always has context; || {} fallback and spread form never triggered.
							/* v8 ignore start */
							const baseContext = baseStore?.context || {};
							return key ? baseContext[key] : { ...baseContext };
							/* v8 ignore stop */
						}

						// Check if current store belongs to this instance (base or child)
						const isOurInstance =
							currentStore.instanceID === slothlet.instanceID ||
							currentStore.parentInstanceID === slothlet.instanceID ||
							StringMethods.startsWith(currentStore.instanceID, slothlet.instanceID + "__run_");

						if (isOurInstance) {
							// We're in our own context (either base or .run() child)
							return key ? currentStore.context[key] : { ...currentStore.context };
						}

						// We're in a different instance's context - return our base context
						const baseStore = MapMethods.get(slothlet.contextManager.instances, slothlet.instanceID);
						// baseStore always has context; || {} fallback and cross-instance path not exercised in tests.
						/* v8 ignore start */
						const baseContext = baseStore?.context || {};
						return key ? baseContext[key] : { ...baseContext };
						/* v8 ignore stop */
					}

					// Fallback for unknown context manager type — only reachable if a
					// third-party contextManager is injected that is neither AsyncContextManager
					// nor LiveContextManager. Never exercised in the current test suite.
					/* v8 ignore start */
					const baseContext = slothlet.context || {};
					return key ? baseContext[key] : { ...baseContext };
					/* v8 ignore stop */
				},

				/**
				 * Change the instance-level context every leaf reads: `set(key, value)` for one key, `set(object)` for
				 * several. A `run()` / `scope()` in progress sees the new value too, except for the keys it supplied
				 * itself (or protected / owned), which still win inside it. Host only by default: module code needs a rule
				 * allowing `slothlet.context.set`. A key owned or protected by the active `scope()` is enforced as a
				 * runtime `context` write is (`CONTEXT_KEY_PROTECTED`).
				 * @param {string|object} keyOrValues - The key to set, or an object of keys and values.
				 * @param {*} [value] - The value, when a key is given.
				 * @returns {void}
				 * @throws {SlothletError} INVALID_ARGUMENT for anything but a key string or a plain object, or a key such
				 *   as `__proto__`; CONTEXT_KEY_PROTECTED for a key the active scope protects or another owner owns.
				 * @public
				 * @example
				 * api.slothlet.context.set("tenant", "acme");
				 * api.slothlet.context.set({ tenant: "acme", region: "eu" });
				 */
				set: (...args) => {
					const keyOrValues = args[0];
					let entries;
					if (typeof keyOrValues === "string" && args.length >= 2) {
						entries = [[keyOrValues, args[1]]];
					} else if (args.length === 1 && keyOrValues !== null && typeof keyOrValues === "object" && !Arrays.isArray(keyOrValues)) {
						entries = Objects.entries(keyOrValues);
					} else {
						throw new slothlet.SlothletError("INVALID_ARGUMENT", {
							argument: "keyOrValues",
							expected: "a key and a value, or an object",
							received: describeScopeReceived(keyOrValues)
						});
					}
					for (let i = 0; i < entries.length; i++) {
						const key = entries[i][0];
						if (key === "__proto__" || key === "constructor" || key === "prototype") {
							throw new slothlet.SlothletError("INVALID_ARGUMENT", {
								argument: "key",
								expected: "a context key other than __proto__, constructor or prototype",
								received: key
							});
						}
					}
					const contextManager = slothlet.contextManager;
					const instances = contextManager.instances;
					const instanceID = slothlet.instanceID;
					const ours = (store) =>
						!!store &&
						(store.instanceID === instanceID ||
							store.parentInstanceID === instanceID ||
							StringMethods.startsWith(store.instanceID, instanceID + "__run_"));
					// The active store, when the call runs inside this instance's base or one of its run()/scope() stores:
					// a key that store protects, or that another owner owns there, is refused as a runtime write is.
					const active =
						contextManager.constructor.name === "LiveContextManager"
							? contextManager.currentInstanceID
								? MapMethods.get(instances, contextManager.currentInstanceID)
								: null
							: contextManager.tryGetContext();
					if (ours(active)) {
						for (let i = 0; i < entries.length; i++) trustedRootOwn.enforceContextKeyWrite(active, entries[i][0]);
					}
					const base = MapMethods.get(instances, instanceID);
					// The base context is the instance's own: plain assignment, as on any object.
					/* v8 ignore next -- the base store exists from load() until shutdown(). */
					const baseContext = base ? base.context : slothlet.context;
					for (let i = 0; i < entries.length; i++) baseContext[entries[i][0]] = entries[i][1];
					if (slothlet.context !== baseContext && slothlet.context) {
						for (let i = 0; i < entries.length; i++) slothlet.context[entries[i][0]] = entries[i][1];
					}
					// Every run()/scope() in progress took a copy of the context when it started: give it the new value for
					// each key it did not supply itself.
					for (const store of mapValues(instances)) {
						if (store === base || !ours(store) || store.context === baseContext) continue;
						for (let i = 0; i < entries.length; i++) {
							const key = entries[i][0];
							if (store.__ownKeys && SetMethods.has(store.__ownKeys, key)) continue;
							store.context[key] = entries[i][1];
						}
					}
				},

				/**
				 * Diagnostics about this instance's context (for testing/debugging), on either runtime.
				 * @returns {{ instance: string, runtime: "async"|"live", at: number|null, base: object|null, context: object|null, current: { context: object, nested: boolean }|null }}
				 *   This instance's id, the runtime it runs on, when its context record was made, the context it started
				 *   with, its context now, and the running call's context (with whether it is a nested run/scope), or null.
				 * @internal
				 */
				diagnostics: () => {
					// config.diagnostics is always enabled in the instances that expose the
					// diagnostics() function; the guard only fires if called on an instance
					// without the diagnostics feature enabled.
					/* v8 ignore next */
					if (!slothlet.config?.diagnostics) return undefined;
					// This instance only (#837): the manager is process-wide, so nothing about the other instances it
					// serves is reported. `context` is the context data alone; the manager's own state is `runtime`.
					const info = slothlet.contextManager.getInstanceDiagnostics(slothlet.instanceID);
					return {
						instance: slothlet.instanceID,
						runtime: info.type,
						at: info.at,
						base: slothlet.context,
						context: info.context,
						current: info.current
					};
				},

				/**
				 * Execute a callback with isolated context data.
				 * @param {Object} contextData - Context data to merge
				 * @param {Function} callback - Function to execute
				 * @param {...*} args - Additional arguments to pass to callback
				 * @returns {Promise<*>} Result of callback execution
				 * @public
				 */
				run: this.createRunFunction(),

				/**
				 * Execute a function with isolated context using structured options.
				 * @param {Object} options - Scope options
				 * @param {Object} options.context - Context data to merge
				 * @param {Function} options.fn - Function to execute
				 * @param {Array} [options.args] - Arguments array for the function
				 * @param {string} [options.merge] - Merge strategy: "shallow" or "deep"
				 * @param {string[]} [options.protect] - Context keys to lock write-once/unowned for the
				 *   scope: after their initial value is set from `context`, any later write via the runtime
				 *   `context` proxy throws `CONTEXT_KEY_PROTECTED`. Owner-locking is declared ONLY here —
				 *   never through `run()`'s positional arguments (its 3rd+ args are forwarded to the callback).
				 * @param {Object<string,string>} [options.owners] - Map of context key → owner identity (a
				 *   caller apiPath). Only that owner may write the key; other writers throw
				 *   `CONTEXT_KEY_PROTECTED`. A nested `scope()` cannot re-own a key owned by another owner
				 *   (`CONTEXT_KEY_OWNED`).
				 * @returns {Promise<*>} Result of function execution
				 * @public
				 */
				scope: this.createScopeFunction()
			},

			/**
			 * Hook API for intercepting function calls.
			 * @type {object}
			 */
			hook: {
				/**
				 * Register a hook for API functions.
				 * @param {string} typePattern - Path pattern then hook type, `"pattern:type"` (e.g. `"math.*:before"`).
				 * @param {function} handler - Hook handler function
				 * @param {object} [options={}] - Hook options
				 * @param {string} [options.id] - Unique identifier (auto-generated if not provided)
				 * @param {number} [options.priority=0] - Higher = earlier execution
				 * @param {string} [options.subset=DEFAULT_HOOK_SUBSET] - Phase: "before", "primary", or "after" (`DEFAULT_HOOK_SUBSET` / `HOOK_SUBSETS` in `handlers/hook-manager.mjs`)
				 * @param {boolean} [options.async] - Declare a before/after/around handler asynchronous when the native async brand cannot show it
				 * @param {string} [options.pattern] - Path pattern; overrides the one in `typePattern`
				 * @param {boolean} [options.pin=true] - Pin the registering module's identity onto the handler
				 * @param {{ enabled?: boolean, dispatcher?: Function }} [options.versioning] - Resolve the pattern through version
				 *   dispatch (`enabled`), or through this hook's own `dispatcher(allVersions, caller)`
				 * @returns {string} Hook ID
				 * @public
				 *
				 * @example
				 * api.slothlet.hook.on("math.*:before", ({ args }) => {
				 *   console.log("Calling math function with:", args);
				 *   return args;
				 * });
				 *
				 * @example
				 * // around: wrap the rest of the pipeline; next() runs it and returns its result
				 * api.slothlet.hook.on("db.**:around", ({ next, entry }) => (entry ? db.transaction(() => next()) : next()));
				 */
				on: function slothlet_hook_on(typePattern, handler, options = {}) {
					if (!slothlet.handlers?.hookManager) {
						throw new slothlet.SlothletError("HOOK_MANAGER_NOT_AVAILABLE", {});
					}
					assertOptionKeys(options, "slothlet.hook.on");
					return slothlet.handlers.hookManager.on(typePattern, handler, options);
				},

				/**
				 * Remove hooks matching filter criteria.
				 * @param {object} [filter={}] - Filter criteria
				 * @param {string} [filter.id] - Remove hook by ID
				 * @param {string} [filter.type] - Remove hooks by type (before/after/always/error/around)
				 * @param {string} [filter.pattern] - Remove hooks matching pattern
				 * @returns {number} Number of hooks removed
				 * @public
				 *
				 * @example
				 * api.slothlet.hook.remove({ id: "my-hook" });
				 * api.slothlet.hook.remove({ type: "before", pattern: "math.*" });
				 */
				remove: function slothlet_hook_remove(filter = {}) {
					if (!slothlet.handlers?.hookManager) {
						throw new slothlet.SlothletError("HOOK_MANAGER_NOT_AVAILABLE", {});
					}
					assertOptionKeys(filter, "slothlet.hook.filter", "slothlet.hook.remove");
					return slothlet.handlers.hookManager.remove(filter);
				},

				/**
				 * Alias for remove() - removes hooks matching filter.
				 * @param {object} [filter={}] - Filter criteria
				 * @returns {number} Number of hooks removed
				 * @public
				 */
				clear: function slothlet_hook_clear(filter = {}) {
					return this.remove(filter);
				},

				/**
				 * Alias for remove() for V2 compatibility - removes hooks by ID.
				 * @param {string|object} idOrFilter - Hook ID (string) or filter object
				 * @returns {number} Number of hooks removed
				 * @public
				 *
				 * @example
				 * api.slothlet.hook.off("my-hook"); // Remove by ID
				 * api.slothlet.hook.off({ pattern: "math.*" }); // Remove by pattern
				 */
				off: function slothlet_hook_off(idOrFilter) {
					if (!slothlet.handlers?.hookManager) {
						throw new slothlet.SlothletError("HOOK_MANAGER_NOT_AVAILABLE", {});
					}
					// If string, treat as ID
					const filter = typeof idOrFilter === "string" ? { id: idOrFilter } : idOrFilter;
					assertOptionKeys(filter, "slothlet.hook.filter", "slothlet.hook.off");
					return slothlet.handlers.hookManager.remove(filter);
				},

				/**
				 * Enable hooks matching filter criteria.
				 * @param {object} [filter={}] - Filter criteria (empty = enable all)
				 * @param {string} [filter.id] - Enable hook by ID
				 * @param {string} [filter.type] - Enable hooks by type
				 * @param {string} [filter.pattern] - Enable hooks matching pattern
				 * @returns {number} Number of hooks enabled
				 * @public
				 *
				 * @example
				 * api.slothlet.hook.enable(); // Enable all
				 * api.slothlet.hook.enable({ pattern: "math.*" });
				 */
				enable: function slothlet_hook_enable(filter = {}) {
					if (!slothlet.handlers?.hookManager) {
						throw new slothlet.SlothletError("HOOK_MANAGER_NOT_AVAILABLE", {});
					}
					assertOptionKeys(filter, "slothlet.hook.filter", "slothlet.hook.enable");
					return slothlet.handlers.hookManager.enable(filter);
				},

				/**
				 * Disable hooks matching filter criteria.
				 * @param {object} [filter={}] - Filter criteria (empty = disable all)
				 * @param {string} [filter.id] - Disable hook by ID
				 * @param {string} [filter.type] - Disable hooks by type
				 * @param {string} [filter.pattern] - Disable hooks matching pattern
				 * @returns {number} Number of hooks disabled
				 * @public
				 *
				 * @example
				 * api.slothlet.hook.disable(); // Disable all
				 * api.slothlet.hook.disable({ pattern: "database.*" });
				 */
				disable: function slothlet_hook_disable(filter = {}) {
					if (!slothlet.handlers?.hookManager) {
						throw new slothlet.SlothletError("HOOK_MANAGER_NOT_AVAILABLE", {});
					}
					assertOptionKeys(filter, "slothlet.hook.filter", "slothlet.hook.disable");
					return slothlet.handlers.hookManager.disable(filter);
				},

				/**
				 * The runtime global path filter: which api paths the hook system applies to.
				 * @type {object}
				 */
				pattern: {
					/**
					 * Restrict hook execution to an API path pattern at runtime (global path filter).
					 * Unlike enable/disable (which toggle individual registered hooks), this narrows
					 * which API paths the hook system applies to — the runtime form of `hook.pattern`.
					 * @param {string} pattern - Glob path pattern to restrict execution to (e.g. "math.*").
					 * @returns {number} Number of patterns now in the active filter.
					 * @public
					 *
					 * @example
					 * api.slothlet.hook.pattern.enable("database.*"); // only intercept database.* paths
					 */
					enable: function slothlet_hook_pattern_enable(pattern) {
						if (!slothlet.handlers?.hookManager) {
							throw new slothlet.SlothletError("HOOK_MANAGER_NOT_AVAILABLE", {});
						}
						return slothlet.handlers.hookManager.enablePattern(pattern);
					},

					/**
					 * Remove a path pattern from the runtime global path filter. When the last pattern
					 * is removed the filter deactivates and hooks apply to every path again.
					 * @param {string} pattern - The previously-enabled path pattern to remove.
					 * @returns {number} Number of patterns remaining in the filter.
					 * @public
					 *
					 * @example
					 * api.slothlet.hook.pattern.disable("database.*");
					 */
					disable: function slothlet_hook_pattern_disable(pattern) {
						if (!slothlet.handlers?.hookManager) {
							throw new slothlet.SlothletError("HOOK_MANAGER_NOT_AVAILABLE", {});
						}
						return slothlet.handlers.hookManager.disablePattern(pattern);
					},

					/**
					 * Reset the runtime global path filter back to the configured `hook.pattern` default.
					 * @returns {void}
					 * @public
					 *
					 * @example
					 * api.slothlet.hook.pattern.reset();
					 */
					reset: function slothlet_hook_pattern_reset() {
						if (!slothlet.handlers?.hookManager) {
							throw new slothlet.SlothletError("HOOK_MANAGER_NOT_AVAILABLE", {});
						}
						return slothlet.handlers.hookManager.resetPatternFilter();
					}
				},

				/**
				 * List registered hooks matching filter criteria.
				 * @param {object} [filter={}] - Filter criteria (empty = list all)
				 * @param {string} [filter.id] - List hook by ID
				 * @param {string} [filter.type] - List hooks by type
				 * @param {string} [filter.pattern] - List hooks matching pattern
				 * @param {boolean} [filter.enabled] - Filter by enabled state
				 * @returns {Array<object>} Array of hook objects
				 * @public
				 *
				 * @example
				 * const allHooks = api.slothlet.hook.list();
				 * const beforeHooks = api.slothlet.hook.list({ type: "before" });
				 */
				list: function slothlet_hook_list(filter = {}) {
					if (!slothlet.handlers?.hookManager) {
						throw new slothlet.SlothletError("HOOK_MANAGER_NOT_AVAILABLE", {});
					}
					assertOptionKeys(filter, "slothlet.hook.filter", "slothlet.hook.list");
					return slothlet.handlers.hookManager.list(filter);
				},

				/**
				 * Host-only runtime control over hook pinning enforcement, mirroring `permissions.control`.
				 *
				 * Pinning is enabled by default: a module hook's `lockCaller: false` is ignored so the hook
				 * runs under its owner's identity (an unpinned module hook is a permission-bypass vector).
				 * `disable()` permits unpinned module hooks; `enable()` restores enforcement. The whole `pin`
				 * surface is host-only when permissions are enabled (covered by the `slothlet.hook.**` deny).
				 * @type {object}
				 * @public
				 */
				pin: {
					/**
					 * Whether hook pinning is currently enforced. Exposed as an accessor so descriptor-based
					 * reads stay permission-gated.
					 * @returns {boolean} True when module hooks are force-pinned (the default).
					 * @public
					 * @example
					 * const enforced = api.slothlet.hook.pin.enabled;
					 */
					get enabled() {
						if (!slothlet.handlers?.hookManager) {
							throw new slothlet.SlothletError("HOOK_MANAGER_NOT_AVAILABLE", {});
						}
						return slothlet.handlers.hookManager.pinEnforced;
					},

					/**
					 * Enforce hook pinning: a module hook's `lockCaller: false` is ignored (force-pinned).
					 * @returns {boolean} The policy value now in effect (true).
					 * @public
					 * @example
					 * api.slothlet.hook.pin.enable(); // force-pin module hooks (host only)
					 */
					enable: function slothlet_hook_pin_enable() {
						if (!slothlet.handlers?.hookManager) {
							throw new slothlet.SlothletError("HOOK_MANAGER_NOT_AVAILABLE", {});
						}
						return slothlet.handlers.hookManager.setPinEnforced(true);
					},

					/**
					 * Stop enforcing hook pinning: permit a per-registration `lockCaller: false` on module hooks.
					 * @returns {boolean} The policy value now in effect (false).
					 * @public
					 * @example
					 * api.slothlet.hook.pin.disable(); // permit unpinned module hooks (host only)
					 */
					disable: function slothlet_hook_pin_disable() {
						if (!slothlet.handlers?.hookManager) {
							throw new slothlet.SlothletError("HOOK_MANAGER_NOT_AVAILABLE", {});
						}
						return slothlet.handlers.hookManager.setPinEnforced(false);
					}
				}
			},

			/**
			 * Metadata API for function introspection and tagging.
			 * @type {object}
			 */
			metadata: {
				/**
				 * @param {string|Object<string, unknown>} keyOrObj - Metadata key string or object payload.
				 * @param {unknown} [value] - Metadata value when keyOrObj is a string key.
				 * @returns {void}
				 * @public
				 *
				 * @description
				 * Sets global metadata that applies to every function in the instance.
				 * Global metadata has the lowest priority: path and function metadata override it.
				 * When an object payload is provided, nested objects are recursively copied
				 * into the metadata tree so reads preserve their original structure.
				 *
				 * @example
				 * api.slothlet.metadata.global("version", "1.0.0");
				 *
				 * @example
				 * // Bulk set via object (nested shape is preserved)
				 * api.slothlet.metadata.global({ env: "production", build: { region: "us" } });
				 */
				global: function slothlet_metadata_global(keyOrObj, value) {
					// The calling module, checked once the arguments are valid (#625).
					const caller = runtime_selfModuleReader(slothlet);
					// Defensive: metadata handler is always registered during load().
					// This guard fires only if metadata.global is called before load() completes
					// or on an instance that explicitly omits the metadata handler.
					/* v8 ignore start */
					if (!slothlet.handlers?.metadata) {
						throw new slothlet.SlothletError("METADATA_NOT_AVAILABLE", {});
					}
					/* v8 ignore stop */

					/**
					 * Validate a metadata key path and reject prototype-pollution segments.
					 *
					 * @param {string} keyPath - Dot-notation metadata key.
					 * @returns {void}
					 * @throws {SlothletError} METADATA_KEY_INVALID when the key path is unsafe.
					 * @example
					 * validateGlobalMetadataKeyPath("build.region");
					 */
					const validateGlobalMetadataKeyPath = (keyPath) => {
						const blocked = setFrom(["__proto__", "prototype", "constructor"]);
						if (typeof keyPath !== "string" || keyPath.length === 0) {
							throw new slothlet.SlothletError("METADATA_KEY_INVALID", {
								key: keyPath,
								type: typeof keyPath,
								expected: "non-empty string"
							});
						}

						const segments = splitText(keyPath, ".");
						for (let ofIndex = 0, ofList = segments; ofIndex < ofList.length; ofIndex++) {
							const segment = ofList[ofIndex];
							if (!segment || SetMethods.has(blocked, segment)) {
								throw new slothlet.SlothletError("METADATA_KEY_INVALID", {
									key: keyPath,
									type: typeof keyPath,
									expected: "safe dot-notation key without reserved segments"
								});
							}
						}
					};

					/**
					 * Copy global metadata from a nested object while preserving its shape.
					 *
					 * @param {Object<string, unknown>} source - Source metadata object.
					 * @param {string} [prefix=""] - Dot-notation key prefix for validation.
					 * @param {WeakSet<object>} [ancestors=new WeakSet()] - Objects in the current recursion path.
					 * @returns {Object<string, unknown>} Normalized metadata copy.
					 * @example
					 * normalizeGlobalMetadataObject({ env: { mode: "prod" } });
					 */
					const normalizeGlobalMetadataObject = (source, prefix = "", ancestors = new WeakSet()) => {
						if (WeakSetMethods.has(ancestors, source)) {
							throw new slothlet.SlothletError("INVALID_ARGUMENT", {
								argument: "keyOrObj",
								expected: "acyclic object",
								received: "circular reference"
							});
						}

						WeakSetMethods.add(ancestors, source);
						try {
							const normalized = {};
							for (let ofIndex = 0, ofList = Objects.entries(source); ofIndex < ofList.length; ofIndex++) {
								const ofEntry = ofList[ofIndex],
									key = ofEntry[0],
									nestedValue = ofEntry[1];
								const fullKey = prefix ? `${prefix}.${key}` : key;
								validateGlobalMetadataKeyPath(fullKey);
								const nestedProto = nestedValue && typeof nestedValue === "object" ? Objects.getPrototypeOf(nestedValue) : null;
								const isPlainNested = nestedProto === Objects.prototype || nestedProto === null;
								if (nestedValue && typeof nestedValue === "object" && !Arrays.isArray(nestedValue) && isPlainNested) {
									normalized[key] = normalizeGlobalMetadataObject(nestedValue, fullKey, ancestors);
									continue;
								}
								normalized[key] = nestedValue;
							}
							return normalized;
						} finally {
							WeakSetMethods.delete(ancestors, source);
						}
					};

					if (keyOrObj && typeof keyOrObj === "object" && !Arrays.isArray(keyOrObj)) {
						const normalizedMetadata = normalizeGlobalMetadataObject(keyOrObj);
						slothlet.handlers.permissionManager.assertGlobalMetadataWrite(caller);
						for (let ofIndex = 0, ofList = Objects.entries(normalizedMetadata); ofIndex < ofList.length; ofIndex++) {
							const ofEntry = ofList[ofIndex],
								key = ofEntry[0],
								nestedValue = ofEntry[1];
							slothlet.handlers.metadata.setGlobalMetadata(key, nestedValue);
						}
						return;
					}

					if (typeof keyOrObj !== "string") {
						throw new slothlet.SlothletError("INVALID_ARGUMENT", {
							argument: "keyOrObj",
							expected: "string or object",
							received: typeof keyOrObj
						});
					}

					validateGlobalMetadataKeyPath(keyOrObj);
					slothlet.handlers.permissionManager.assertGlobalMetadataWrite(caller);

					return slothlet.handlers.metadata.setGlobalMetadata(keyOrObj, value);
				},

				/**
				 * @param {Function|object|string|string[]} target - A function or node, an api path (dotted string or segment
				 *   array, a versioned path such as `"v1.auth"` included), or a module id from a previous `api.add()`.
				 * @param {string|Object<string, unknown>} keyOrObj - Metadata key, or an object of keys to merge.
				 * @param {unknown} [value] - Value when `keyOrObj` is a key.
				 * @returns {void}
				 * @public
				 *
				 * @description
				 * Sets user metadata. A function or node gets metadata of its own (the highest priority); a path or module id
				 * sets it for every function at or under that path, now and later (descendants inherit it, the closer entry
				 * wins). Later calls merge over earlier ones.
				 *
				 * @example
				 * api.slothlet.metadata.set(api.math.add, "description", "Adds two numbers");
				 *
				 * @example
				 * api.slothlet.metadata.set("math", { category: "math", version: "2.0.0" });
				 *
				 * @example
				 * api.slothlet.metadata.set("v1.auth", "stable", true);
				 */
				set: function slothlet_metadata_set(target, keyOrObj, value) {
					if (!slothlet.handlers?.metadata) {
						throw new slothlet.SlothletError("METADATA_NOT_AVAILABLE", {});
					}
					const path = _metadataTargetPath(slothlet, target);
					if (path === null) {
						target = _metadataNode(slothlet, target);
						// Module code sets a node's metadata only where it may write (#625).
						const node = resolveWrapper(target);
						if (node) slothlet.handlers.apiManager.assertModuleWrite(String(node.____slothletInternal.apiPath));
						if (keyOrObj && typeof keyOrObj === "object" && !Arrays.isArray(keyOrObj)) {
							for (let ofIndex = 0, ofList = Objects.entries(keyOrObj); ofIndex < ofList.length; ofIndex++) {
								slothlet.handlers.metadata.setUserMetadata(target, ofList[ofIndex][0], ofList[ofIndex][1]);
							}
							return;
						}
						return slothlet.handlers.metadata.setUserMetadata(target, keyOrObj, value);
					}
					// Module code sets metadata only where it may write (#625).
					slothlet.handlers.apiManager.assertModuleWrite(path);
					return slothlet.handlers.metadata.setPathMetadata(path, keyOrObj, value);
				},

				/**
				 * @param {Function|object|string|string[]} target - A function or node, an api path, or a module id.
				 * @param {string|string[]} [key] - Key(s) to remove. Omit to remove all of the target's metadata.
				 * @returns {void}
				 * @public
				 *
				 * @description
				 * Removes user metadata set on the target: the named key(s), or all of it. A path removes only what was set
				 * for that exact path; it does not walk descendants.
				 *
				 * @example
				 * api.slothlet.metadata.remove(api.math.add, "description");
				 *
				 * @example
				 * api.slothlet.metadata.remove("math");
				 */
				remove: function slothlet_metadata_remove(target, key) {
					const path = _metadataTargetPath(slothlet, target);
					if (path === null) {
						target = _metadataNode(slothlet, target);
						// Module code removes a node's metadata only where it may write (#625).
						const node = resolveWrapper(target);
						if (node) slothlet.handlers.apiManager.assertModuleWrite(String(node.____slothletInternal.apiPath));
						return slothlet.handlers.metadata.removeUserMetadata(target, key);
					}
					/* v8 ignore next */
					if (!slothlet.handlers?.metadata) return;
					// Module code removes metadata only where it may write (#625).
					slothlet.handlers.apiManager.assertModuleWrite(path);
					return slothlet.handlers.metadata.removePathMetadata(path, key);
				},

				/**
				 * @param {Function|object|string|string[]} target - A function or node, an api path (dotted string or segment
				 *   array, a versioned path such as `"v1.auth"` included), or a module id from a previous `api.add()`.
				 * @param {object} [options] - Read options.
				 * @param {string} [options.version] - A version tag: read the metadata of that version of the logical path
				 *   `target` (`get("auth", { version: "v1" })` reads what `get("v1.auth")` reads).
				 * @returns {Object} The target's user metadata (a copy): global < path chain < the function's own.
				 * @public
				 *
				 * @description
				 * Reads user metadata only, synchronously. The facts slothlet records about a node (its file, folder,
				 * path and module) are not metadata: `api.slothlet.node(target)` reports them.
				 *
				 * @example
				 * api.slothlet.metadata.get(api.math.add); // { category: "math", description: "Adds two numbers" }
				 *
				 * @example
				 * api.slothlet.metadata.get("auth", { version: "v1" }); // { stable: true }
				 */
				get: function slothlet_metadata_get(target, options) {
					/* v8 ignore next */
					if (!slothlet.handlers?.metadata) return {};
					const version = options && typeof options === "object" ? options.version : undefined;
					if (version !== undefined) {
						const logical = Arrays.isArray(target) ? ArrayMethods.join(target, ".") : target;
						const info = typeof logical === "string" ? slothlet.handlers?.versionManager?.list(logical) : undefined;
						const entry = info?.versions?.[version];
						if (!entry) return {};
						// The version's real path, as segments, so a dotted tag ("2.3.0") stays one segment.
						target = Arrays.isArray(entry.versionedParts) ? mapList(entry.versionedParts, String) : `${version}.${logical}`;
					}
					const path = _metadataTargetPath(slothlet, target);
					// A node's metadata is a deeply frozen object built for this read; a path's is a copy. Either way changing it
					// never changes what is stored, which only the setters do (#625).
					if (path === null) return slothlet.handlers.metadata.getMetadata(_metadataNode(slothlet, target));
					return slothlet.helpers.utilities.deepClone(slothlet.handlers.metadata.getPathMetadata(path));
				}
			},

			/**
			 * @param {Function|object|string|string[]} target - An api node (as read from `api`, `self`, or a reference a
			 *   module kept), or its api path as a dotted string or a segment array.
			 * @returns {{callable: boolean, file: string|null, folder: string|null, loading: boolean, logical?: string[], manifest?: object, materialized: boolean, mode: string, module: string|null, path: string[], type: symbol|string}|undefined}
			 *   One frozen report, or undefined when `target` is no api node.
			 * @throws {SlothletError} PERMISSION_DENIED when the caller may not reach the target.
			 * @public
			 *
			 * @description
			 * Reports what slothlet knows about a node: its api path (segments), the file and folder it came from, the
			 * module that owns it (the id used with `api.add` / `api.remove`), its mode and load state, whether it can be
			 * called, and its type. Nodes carry no framework keys of their own; this is where those facts are read.
			 *
			 * `type` is `api.slothlet.types.UNMATERIALIZED` or `IN_FLIGHT` until a lazy node has loaded (reading the
			 * report never starts the load), then `"function"`, `"data"` or `"namespace"` (a node with members; a callable
			 * folder is a namespace with `callable: true`). `logical` is present on a
			 * versioned node read through its logical path (`api.auth` → `logical: ["auth"]`, `path: ["v2", "auth"]`), and
			 * `manifest` (the parsed `slothlet.module.json`) on a node of a package mount.
			 *
			 * The caller must be allowed to reach the target: with permissions on, the report is decided as a read of the
			 * node's own path. Calling `node` itself is allowed by a built-in rule.
			 *
			 * @example
			 * api.slothlet.node(api.math.add);
			 * // { callable: true, file: "/app/api/math.mjs", folder: "/app/api", loading: false, materialized: true,
			 * //   mode: "eager", module: "base", path: ["math", "add"], type: "function" }
			 *
			 * @example
			 * api.slothlet.node("math").type === "namespace"; // true
			 */
			node: function slothlet_node(target) {
				return runtime_nodeReport(slothlet, target);
			},

			/**

			 * Reload entire instance (creates new references)
			 * @param {Object} [options={}] - Reload options forwarded to Slothlet#reload.
			 * @param {"keep"|"new"} [options.instance="new"] - `"keep"` keeps the same instance id (resets the context store in place).
			 * @returns {Promise<void>}
			 */
			reload: async (options = {}) => {
				// Check if reload mutation is allowed
				if (!config.api?.mutations?.reload) {
					throw new slothlet.SlothletError("API_MUTATION_DISABLED", { operation: ["slothlet", "reload"] });
				}
				return slothlet.reload(options);
			},

			/**
			 * Clean-slate restart (#504): shut this instance down and build a new one from the original
			 * `slothlet({...})` config behind the same `api` reference. Nothing runtime is carried over.
			 * Gated by `api.mutations.reload`, like `reload()` — it re-reads every module from disk.
			 * @returns {Promise<Object>} The same bound API reference.
			 */
			restart: async () => {
				if (!config.api?.mutations?.reload) {
					throw new slothlet.SlothletError("API_MUTATION_DISABLED", { operation: ["slothlet", "restart"] });
				}
				return slothlet.restart();
			},

			/**
			 * Shutdown instance and cleanup resources — framework-only teardown.
			 * @returns {Promise<void>}
			 *
			 * @description
			 * Runs every `mode: "shutdown"` routine's cascade (when `routines.auto` is `true`; a root
			 * `shutdown` export then runs once, as a contribution), then releases the instance. It never
			 * calls the root `shutdown`/`destroy` user hooks itself, so with `routines.auto: false` no module
			 * code runs. `api.shutdown()` is the entry point that also calls the root `shutdown` hook.
			 */
			shutdown: async () => {
				// Stackable lifecycle routines (#341): this is the OTHER of the two shutdown entry
				// points (the root `api.shutdown()` built by `createShutdownFunction()` is the other) —
				// it skips user hooks / collectLifecycleHooks by design, but must still run every
				// `mode: "shutdown"` routine's cascade, since `api.slothlet.shutdown()` is the form the
				// framework's own docs lead with. Same capture-then-rethrow-after-teardown shape as the
				// root entry point: a failing contributor must not block internal teardown from running.
				let routineError = null;
				try {
					await slothlet.handlers.routineManager?.runShutdownModeRoutines();
				} catch (error) {
					routineError = error;
				}
				const result = await slothlet.shutdown();
				if (routineError) throw routineError;
				return result;
			},

			/**
			 * Ownership management namespace
			 * @type {object}
			 */
			owner: {
				/**
				 * Get ownership info for a specific API path
				 * @param {string} apiPath - API path to check
				 * @returns {Set<string>|null} Set of moduleIDs that own this path, or null if path not found
				 */
				get: (apiPath) => {
					if (slothlet.handlers?.ownership) {
						return slothlet.handlers.ownership.getPathOwnership(apiPath);
					}
					return null;
				}
			},

			/**
			 * The warnings this instance raised (#819), whether or not they were printed.
			 * @type {object}
			 * @public
			 */
			warnings: {
				/**
				 * This instance's warnings, oldest first.
				 * @returns {Array<import("#errors").SlothletWarning>} A copy of the list.
				 * @public
				 * @example
				 * const codes = api.slothlet.warnings.get().map((w) => w.code);
				 */
				get: function slothlet_warnings_get() {
					return copyList(slothlet.warnings);
				},

				/**
				 * Empty this instance's warning list.
				 * @returns {void}
				 * @public
				 * @example
				 * api.slothlet.warnings.clear();
				 */
				clear: function slothlet_warnings_clear() {
					slothlet.warnings.length = 0;
				}
			},

			/**
			 * The caller object of the identity currently in context — the identity in effect for the running
			 * code: `{ path, module, metadata, version }` (the same object `metadata.caller()` and `metadata.self()`
			 * return) — or `null` for the host (no module caller). It reports the executing module's OWN path:
			 * the same value slothlet attributes calls, hooks, and event subscriptions to, not the identity of
			 * whoever called that module. A module therefore learns nothing it could not already assert about
			 * itself, so this accessor is not gated.
			 *
			 * The motivating consumer is a cross-boundary event-forwarding layer such as `@cldmv/slothlet-vine`:
			 * when a module subscribes to a far event through the vine, the vine reads this to attribute the
			 * forwarded subscription to that module's real identity on the trusted (serving) side — rather than
			 * trusting a caller-supplied identity — and resolves its delivery level there with `event.level`.
			 * It is the grow-side counterpart of that host-only query, and because it reports the same identity
			 * `event.on` captures at subscribe, `event.level(caller(), evt)` agrees with the level an actual
			 * subscription at that identity would be granted.
			 *
			 * @returns {{path: string[], module: string|null, metadata: object, version: {tag: string, default: string, metadata: object}|null}|null}
			 *   The current identity as a caller object, or `null` when there is no module caller in context
			 *   (the host, or a call made outside any module extent).
			 *
			 * @example
			 * // Inside a module leaf, reports that module's own path:
			 * const me = self.slothlet.caller(); // e.g. { path: ["renderer", "dashboard"], module, metadata, version }
			 * me?.path.join("."); // "renderer.dashboard"
			 */
			caller: () => {
				// Scoped to THIS instance: the shared-singleton AsyncLocalStorage propagates across `await`/
				// `queueMicrotask`, so a DIFFERENT instance's active flow (a nested slothlet() boot, or a
				// same-process transport handing this instance a frame — the domain of @cldmv/slothlet-vine) is
				// not this instance's caller. Mismatched flow reports host; this instance's own flow reports the
				// real module — the same instance-scoping the read-gate (#290) already applies.
				const wrapper = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID)?.currentWrapper;
				if (!wrapper) return null;
				return slothlet.handlers?.versionManager?.buildCallerArg?.(wrapper) ?? null;
			},

			/**
			 * Lazy materialization tracking namespace
			 * Provides access to lazy folder materialization state
			 * @type {object}
			 *
			 * @example
			 * // Check if fully materialized
			 * if (api.slothlet.materialize.complete) {
			 *   console.log("All lazy folders loaded!");
			 * }
			 *
			 * @example
			 * // Get statistics
			 * const stats = api.slothlet.materialize.get();
			 * console.log(`${stats.percentage}% loaded`);
			 *
			 * @example
			 * // Wait for full materialization
			 * await api.slothlet.materialize.wait();
			 */
			materialize: (() => {
				const mgr = slothlet.handlers?.materialize;

				/**
				 * Read materialization state with an internal permission re-check.
				 * @returns {boolean} Current materialized state.
				 * @example
				 * const done = api.slothlet.materialize.complete;
				 */
				const getMaterializedState = () => {
					enforceInternalPermission("slothlet.materialize.complete");
					return mgr?.materialized ?? false;
				};

				/**
				 * Read materialization statistics with an internal permission re-check.
				 * @returns {object} Materialization statistics.
				 * @example
				 * const stats = api.slothlet.materialize.get();
				 */
				const getMaterializeStats = () => {
					enforceInternalPermission("slothlet.materialize.get");
					return mgr ? mgr.get() : { total: 0, materialized: 0, remaining: 0, percentage: 100 };
				};

				/**
				 * Wait for full materialization with an internal permission re-check.
				 * @returns {Promise<void>} Resolves when lazy materialization completes.
				 * @example
				 * await api.slothlet.materialize.wait();
				 */
				const waitForMaterialization = async () => {
					enforceInternalPermission("slothlet.materialize.wait");
					// MaterializeManager is always auto-registered via slothletProperty; mgr is never null here.
					/* v8 ignore next */
					if (!mgr) return;
					return mgr.wait();
				};
				// materialize handler is always auto-registered via slothletProperty; if (!mgr) is unreachable.
				/* v8 ignore start */
				if (!mgr) {
					return {
						get complete() {
							return getMaterializedState();
						},
						get: getMaterializeStats,
						wait: waitForMaterialization
					};
				}
				/* v8 ignore stop */
				// Not frozen: a frozen member is handed to a module as it is, so a module could change `get` / `wait`
				// themselves; as configurable members they come to it as the framework's view of them, which refuses
				// any change and runs a kept one as the module that read it (#625).
				return {
					get complete() {
						return getMaterializedState();
					},
					get: getMaterializeStats,
					wait: waitForMaterialization
				};
			})(),

			/**
			 * Lifecycle event manager for subscribing to API events.
			 * Exposes `on` and `off`.
			 * @type {object}
			 * @public
			 *
			 * @example
			 * const handler = (data) => console.log(`${data.total} modules materialized`);
			 * api.slothlet.lifecycle.on('materialized:complete', handler);
			 * api.slothlet.lifecycle.off('materialized:complete', handler);
			 */
			lifecycle: (() => {
				const handler = slothlet.handlers?.lifecycle;
				const noop = () => {};
				if (!handler) return { on: noop, off: noop };
				return {
					on: FunctionMethods.bind(handler.on, handler),
					off: FunctionMethods.bind(handler.off, handler)
				};
			})(),

			/**
			 * Instance-wide, permission-gated event system (#407) — named pub/sub scoped to this
			 * composed instance, the third member of the family alongside `hook` and `lifecycle`.
			 * `on`/`once` return `{ level, off, id }` (the granted deny/notify/allow level, an unsubscribe,
			 * and the listener id); `emit` is open to any caller — delivery is enforced per subscriber, not
			 * on the emit side. `resolveLevel(subscriberPath, event)` answers the level a supplied identity
			 * WOULD be granted without subscribing (host-only; for trusted boundary layers such as
			 * `@cldmv/slothlet-vine` to enforce delivery on the serving side). `rules.add`/`rules.remove`
			 * mutate the event-rule pool at runtime, gated by `config.api.mutations.events` (defaults to
			 * true) and host-only, mirroring `permissions.rules.add`. `strategy(fn)` hands every emit to a host
			 * delivery strategy and `deliver(envelope, listenerId)` delivers a strategy-held envelope to one
			 * listener (#497) — both host-only.
			 * @type {object}
			 * @public
			 *
			 * @example
			 * const { level, off } = api.slothlet.event.on("orders.created", (payload, meta) => {});
			 * await api.slothlet.event.emit("orders.created", { id: 42 });
			 */
			event: (() => {
				const handler = slothlet.handlers?.eventManager;
				// eventManager is always registered (slothletProperty); this guard mirrors lifecycle's and
				// is unreachable in practice — the defensive no-op surface (incl. `noop`) is never built.
				/* v8 ignore start */
				if (!handler) {
					const noop = () => {};
					return {
						on: () => ({ level: "deny", off: noop }),
						once: () => ({ level: "deny", off: noop }),
						off: () => false,
						emit: async () => {},
						level: () => "notify",
						strategy: noop,
						deliver: async () => ({ delivered: false, reason: DELIVERY_REASONS.LISTENER_GONE }),
						rules: { add: noop, remove: noop }
					};
				}
				/* v8 ignore stop */
				return {
					on: FunctionMethods.bind(handler.on, handler),
					once: FunctionMethods.bind(handler.once, handler),
					off: FunctionMethods.bind(handler.off, handler),
					emit: FunctionMethods.bind(handler.emit, handler),
					level: FunctionMethods.bind(handler.resolveLevel, handler),
					strategy: FunctionMethods.bind(handler.strategy, handler),
					deliver: FunctionMethods.bind(handler.deliver, handler),
					rules: {
						/**
						 * Add an event rule at runtime (gated by `config.api.mutations.events`). The host's rule enters the
						 * highest "runtime" precedence layer. Module code reaches this only while the permission system is
						 * off (a built-in rule keeps it host-only otherwise), and is then held to its own events, as its
						 * `permissions.rules.add` is (#625).
						 * @param {object} rule - `{ caller, event, effect }` (effect: deny/notify/allow).
						 * @returns {string} The rule id.
						 */
						add: function slothlet_event_rules_add(rule) {
							if (!config.api?.mutations?.events) {
								throw new slothlet.SlothletError("API_MUTATION_DISABLED", { operation: ["slothlet", "event", "rules", "add"] });
							}
							const permissionManager = slothlet.handlers?.permissionManager;
							/* v8 ignore start */
							if (!permissionManager?.addEventRule) {
								throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
							}
							/* v8 ignore stop */
							// The rule is read once; module code's is placed as its call rules are, at the module layer, and
							// its condition runs as the module.
							rule = permissionManager.snapshotEventRule(rule);
							const { ownerModuleID, layer, writer } = permissionManager.placeModuleRule({ target: rule?.event });
							if (writer) rule = { ...rule, condition: permissionManager.pinConditions(rule.condition, writer) };
							const ruleLayer = layer ?? "runtime";
							const ruleId = permissionManager.addEventRule(rule, ownerModuleID, null, ruleLayer);
							if (slothlet.handlers?.apiManager?.state?.operationHistory) {
								listPush(slothlet.handlers.apiManager.state.operationHistory, {
									type: "addEventRule",
									rule,
									ownerModuleID,
									ruleId,
									layer: ruleLayer,
									timestamp: slothlet.clock.now()
								});
							}
							return ruleId;
						},

						/**
						 * Remove an event rule by id at runtime (gated by `config.api.mutations.events`). Module code removes
						 * only the event rules it could add (#625).
						 * @param {string} ruleId - The event-rule id.
						 * @returns {boolean} True if a rule was removed.
						 */
						remove: function slothlet_event_rules_remove(ruleId) {
							if (!config.api?.mutations?.events) {
								throw new slothlet.SlothletError("API_MUTATION_DISABLED", { operation: ["slothlet", "event", "rules", "remove"] });
							}
							const permissionManager = slothlet.handlers?.permissionManager;
							/* v8 ignore start */
							if (!permissionManager?.removeEventRule) {
								throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
							}
							/* v8 ignore stop */
							// Code supplied to another module's call removes for both modules (#597).
							const callerModuleID = runtime_ownerModuleIDs(slothlet.contextManager?.getCallerIdentity?.());
							permissionManager.assertModuleEventRuleRemoval(ruleId);
							const result = slothlet.handlers.permissionManager.removeEventRule(ruleId, callerModuleID);
							if (result && slothlet.handlers?.apiManager?.state?.operationHistory) {
								listPush(slothlet.handlers.apiManager.state.operationHistory, {
									type: "removeEventRule",
									ruleId,
									callerModuleID,
									timestamp: slothlet.clock.now()
								});
							}
							return result;
						}
					}
				};
			})(),

			/**
			 * Frozen snapshot of `process.env` captured at instance initialization time,
			 * before any module `register()` / `init()` lifecycle runs.
			 *
			 * @description
			 * The object is created from the current `process.env` values (or a filtered
			 * subset when the `env.include` config option was provided) and then frozen.
			 * When `env.include` is used, the result has a null prototype to safely handle
			 * env var names such as `__proto__`. It is immutable for
			 * the lifetime of this Slothlet instance — reloads do NOT refresh the snapshot.
			 *
			 * Access any environment variable by key:
			 * ```
			 * import { self } from "@cldmv/slothlet/runtime";
			 * self.slothlet.env.NODE_ENV;        // e.g. "production"
			 * self.slothlet.env.MY_API_KEY;      // string or undefined
			 * ```
			 *
			 * @type {Readonly<Record<string, string|undefined>>}
			 * @public
			 *
			 * @example
			 * // Full snapshot (default — no include filter configured)
			 * api.slothlet.env.NODE_ENV    // => "production"
			 * api.slothlet.env.PORT        // => "3000"
			 *
			 * @example
			 * // Filtered snapshot (env: { include: ["NODE_ENV"] } in config)
			 * api.slothlet.env.NODE_ENV    // => "production"
			 * api.slothlet.env.PORT        // => undefined (not captured)
			 */
			env: inspectableSnapshot(slothlet.envSnapshot),

			/**
			 * Version management API for versioned API paths.
			 * @type {object}
			 * @public
			 */
			versioning: {
				/**
				 * List all registered versions for a logical API path.
				 * @param {string} logicalPath - Logical API path (e.g. "auth").
				 * @returns {{ versions: object, default: string|null } | undefined} Version snapshot, or `undefined` when the path is not registered.
				 * @public
				 * @example
				 * const info = api.slothlet.versioning.list("auth");
				 * if (info) console.log(info.default); // "v2"
				 */
				list: function slothlet_version_list(logicalPath) {
					// versionManager is always registered when versioning is used; guard for completeness
					/* v8 ignore next */
					if (!slothlet.handlers?.versionManager) return undefined;
					// A copy: changing it never changes the registry a version dispatcher routes by (#625).
					return slothlet.helpers.utilities.deepClone(slothlet.handlers.versionManager.list(logicalPath));
				},

				/**
				 * Override the default version for a logical API path at runtime.
				 * @param {string} logicalPath - Logical API path.
				 * @param {string} versionTag - Version tag to set as default.
				 * @returns {void}
				 * @public
				 * @example
				 * api.slothlet.versioning.default("auth", "v1");
				 */
				default: function slothlet_version_default(logicalPath, versionTag) {
					// versionManager is always registered when versioning is used; guard for completeness
					/* v8 ignore next */
					if (!slothlet.handlers?.versionManager) return;
					// Module code points the dispatcher at a version only where it may write (#625).
					slothlet.handlers.apiManager.assertModuleWrite(logicalPath);
					return slothlet.handlers.versionManager.setDefault(logicalPath, versionTag);
				},

				/**
				 * Unregister a specific version from a logical API path.
				 * Removes the versioned namespace and updates or tears down the dispatcher.
				 * @param {string} logicalPath - Logical API path.
				 * @param {string} versionTag - Version tag to remove.
				 * @returns {Promise<boolean>} Resolves `true` when the version was removed.
				 * @public
				 * @example
				 * await api.slothlet.versioning.remove("auth", "v2");
				 */
				remove: async function slothlet_version_remove(logicalPath, versionTag) {
					// versionManager is always registered when versioning is used; guard for completeness
					/* v8 ignore next */
					if (!slothlet.handlers?.versionManager) return false;
					// Check version exists before attempting removal
					const info = slothlet.handlers.versionManager.list(logicalPath);
					if (!info || !info.versions?.[versionTag]) return false;
					// Use the stored moduleID rather than reconstructing a dot-delimited path string.
					// Path string reconstruction would re-split on "." and fragment dotted version
					// tags (e.g. "2.3.0" → ["2","3","0"]) when passed to removeApiComponent.
					const { moduleID: versionedModuleID } = info.versions[versionTag];
					// Remove the versioned module from the API tree.
					// removeApiComponent internally calls versionManager.unregisterVersion via its
					// version-lifecycle hook, so we do NOT call unregisterVersion again here.
					await slothlet.handlers.apiManager.removeApiComponent(versionedModuleID);
					return true;
				},

				/**
				 * VersionManager-only metadata (not the store `metadata.set` writes).
				 * @type {object}
				 */
				metadata: {
					/**
					 * Retrieve the VersionManager-only metadata stored at registration time via `versionConfig.metadata`.
					 * @param {string} logicalPath - Logical API path (e.g. `"auth"`).
					 * @param {string} versionTag - Version tag (e.g. `"v1"`, `"2.3.0"`).
					 * @returns {object | undefined} Version metadata or `undefined` when the path/tag is not registered.
					 * @public
					 * @example
					 * const meta = api.slothlet.versioning.metadata.get("auth", "v1");
					 * // { version: "v1", logicalPath: "auth", stable: true }
					 */
					get: function slothlet_version_metadata_get(logicalPath, versionTag) {
						// versionManager is always registered when versioning is used; guard for completeness
						/* v8 ignore next */
						if (!slothlet.handlers?.versionManager) return undefined;
						// A copy: changing it never changes the stored version metadata, which only versioning.metadata.set does (#625).
						return slothlet.helpers.utilities.deepClone(slothlet.handlers.versionManager.getVersionMetadataByPath(logicalPath, versionTag));
					},

					/**
					 * Patch (merge) the VersionManager-only metadata for a registered version at runtime.
					 * The injected `version` and `logicalPath` keys in the stored object always win over `patch`.
					 * @param {string} logicalPath - Logical API path (e.g. `"auth"`).
					 * @param {string} versionTag - Version tag (e.g. `"v1"`, `"2.3.0"`).
					 * @param {object} patch - Keys to merge into the stored version metadata.
					 * @returns {void}
					 * @throws {SlothletError} When the logical path or version is not registered.
					 * @public
					 * @example
					 * api.slothlet.versioning.metadata.set("auth", "v1", { stable: true });
					 */
					set: function slothlet_version_metadata_set(logicalPath, versionTag, patch) {
						// versionManager is always registered when versioning is used; guard for completeness
						/* v8 ignore next */
						if (!slothlet.handlers?.versionManager) return;
						// Module code changes a version's metadata only where it may write: that version's mount (#625).
						slothlet.handlers.apiManager.assertModuleWrite(
							concatLists([String(versionTag)], splitText(StringMethods.trim(String(logicalPath)), "."))
						);
						return slothlet.handlers.versionManager.setVersionMetadataByPath(logicalPath, versionTag, patch);
					}
				}
			},

			/**
			 * Permission management API for access control.
			 * @type {object}
			 * @public
			 */
			permissions: {
				/**
				 * Runtime permission rules: add and remove.
				 * @type {object}
				 */
				rules: {
					/**
					 * Add a permission rule.
					 * Gated by `config.api.mutations.permissions` (defaults to `true`).
					 *
					 * @param {object} rule - Rule definition: `{ caller, target, effect }`.
					 * @param {string} rule.caller - Glob pattern matching caller API paths.
					 * @param {string} rule.target - Glob pattern matching target API paths.
					 * @param {string} rule.effect - "allow" or "deny".
					 * @returns {string} The generated rule ID.
					 * @public
					 * @example
					 * api.slothlet.permissions.rules.add({ caller: "untrusted.**", target: "**", effect: "deny" });
					 */
					add: function slothlet_permissions_rules_add(rule) {
						// Check if permissions mutation is allowed
						if (!config.api?.mutations?.permissions) {
							throw new slothlet.SlothletError("API_MUTATION_DISABLED", { operation: ["slothlet", "permissions", "rules", "add"] });
						}

						// Check if permission manager is available
						const permissionManager = slothlet.handlers?.permissionManager;
						/* v8 ignore start */
						if (!permissionManager?.addRule) {
							throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
						}
						/* v8 ignore stop */

						// The rule is read once, and that copy is what is placed, registered, and replayed (#625). A rule module
						// code adds is held to its own subtree unless an explicit allow lifts the built-in reach default, and is
						// that module's rule, at the module layer, below the host's.
						rule = permissionManager.snapshotRule(rule);
						const { ownerModuleID, layer, writer } = permissionManager.placeModuleRule(rule);
						// Its condition runs as the module, whichever call it is checked for.
						if (writer) rule = { ...rule, condition: permissionManager.pinConditions(rule.condition, writer) };
						const ruleId = permissionManager.addRule(rule, ownerModuleID, null, layer);

						// Record in operationHistory for replay on reload
						if (slothlet.handlers?.apiManager?.state?.operationHistory) {
							listPush(slothlet.handlers.apiManager.state.operationHistory, {
								type: "addPermissionRule",
								rule,
								ownerModuleID,
								ruleId,
								layer,
								timestamp: slothlet.clock.now()
							});
						}

						return ruleId;
					},

					/**
					 * Remove a permission rule by ID.
					 * Self-modification is blocked (a module cannot remove its own rules).
					 *
					 * @param {string} ruleId - The rule ID to remove.
					 * @returns {boolean} True if the rule was removed.
					 * @public
					 * @example
					 * api.slothlet.permissions.rules.remove("perm-3");
					 */
					remove: function slothlet_permissions_rules_remove(ruleId) {
						// Check if permissions mutation is allowed
						if (!config.api?.mutations?.permissions) {
							throw new slothlet.SlothletError("API_MUTATION_DISABLED", { operation: ["slothlet", "permissions", "rules", "remove"] });
						}

						// Check if permission manager is available
						const permissionManager = slothlet.handlers?.permissionManager;
						/* v8 ignore start */
						if (!permissionManager?.removeRule) {
							throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
						}
						/* v8 ignore stop */

						// Per-flow identity: this moduleID decides whether the caller owns the rule it is
						// removing, so attributing it to a concurrently-suspended module would let one
						// module drop another's rule.
						// Code supplied to another module's call removes for both modules (#597).
						const callerModuleID = runtime_ownerModuleIDs(slothlet.contextManager?.getCallerIdentity?.());
						// Module code removes only the rules it could add (#625).
						permissionManager.assertModuleRuleRemoval(ruleId);
						const result = slothlet.handlers.permissionManager.removeRule(ruleId, callerModuleID);

						// Record in operationHistory for replay on reload
						if (result && slothlet.handlers?.apiManager?.state?.operationHistory) {
							listPush(slothlet.handlers.apiManager.state.operationHistory, {
								type: "removePermissionRule",
								ruleId,
								callerModuleID,
								timestamp: slothlet.clock.now()
							});
						}

						return result;
					}
				},

				/**
				 * Principals (#459): named, module-owned resolvers that turn a caller identity into
				 * authorization facts for rules declaring `requires`. Host-only by default — the built-in
				 * `slothlet.permissions.principal.**` deny keeps modules out until the host grants access.
				 * Gated by `config.api.mutations.permissions`, like `addRule`.
				 * @type {object}
				 * @public
				 */
				principal: {
					/**
					 * Register (or replace) a principal. The first registrant owns the name; only that module or
					 * the host may register it again, unregister it, or invalidate it. Recorded for replay on reload.
					 *
					 * @param {string} name - Principal name, as rules list it in `requires`.
					 * @param {object} definition - `{ key, resolve, ttl? }`.
					 * @param {function(object): *} definition.key - Maps the runtime context to this principal's identity key.
					 * @param {function(*): *} definition.resolve - Resolves the facts for an identity key (may be async).
					 * @param {number} [definition.ttl] - Optional time-to-live (ms) for a resolved value.
					 * @returns {void}
					 * @public
					 * @example
					 * api.slothlet.permissions.principal.register("roles", {
					 *   key: (ctx) => ctx.user?.id,
					 *   resolve: async (userId) => loadRoles(userId),
					 *   ttl: 30_000
					 * });
					 */
					register: function slothlet_permissions_principal_register(name, definition) {
						if (!config.api?.mutations?.permissions) {
							throw new slothlet.SlothletError("API_MUTATION_DISABLED", {
								operation: ["slothlet", "permissions", "principal", "register"]
							});
						}
						const permissionManager = slothlet.handlers?.permissionManager;
						/* v8 ignore start */
						if (!permissionManager?.registerPrincipal) {
							throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
						}
						/* v8 ignore stop */

						// Per-flow identity: the registrant becomes the name's owner, so attributing it to a
						// concurrently-suspended module would hand that module the name.
						const identity = slothlet.contextManager?.getCallerIdentity?.();
						const currentWrapper = identity?.currentWrapper ?? null;
						// Code supplied to another module's call registers for both modules, and the call it runs
						// inside owns a new name (#597).
						const claimants = runtime_ownerModuleIDs(identity);
						const ownerModuleID = Arrays.isArray(claimants) ? claimants[0] : claimants;
						// A module's resolver runs AS that module: whatever it calls is attributed to the owner, not
						// to the module whose call happened to trigger the resolve — under the call it was registered
						// inside as its ceiling, when that was another module's (#597). `slothlet.instanceID` is read at
						// invocation time because a full reload rotates it.
						const ceiling = currentWrapper && identity.ceiling && identity.ceiling !== currentWrapper ? identity.ceiling : null;
						const invoke = currentWrapper
							? (fn, args) =>
									slothlet.contextManager.runInContext(slothlet.instanceID, fn, null, args, currentWrapper, true, false, ceiling)
							: null;
						permissionManager.registerPrincipal(name, definition, claimants, invoke);

						if (slothlet.handlers?.apiManager?.state?.operationHistory) {
							listPush(slothlet.handlers.apiManager.state.operationHistory, {
								type: "registerPrincipal",
								name,
								definition,
								ownerModuleID,
								timestamp: slothlet.clock.now()
							});
						}
					},

					/**
					 * Unregister a principal (owner or host only). Rules that require it stop matching.
					 *
					 * @param {string} name - Principal name.
					 * @returns {boolean} True when a principal was removed.
					 * @public
					 * @example
					 * api.slothlet.permissions.principal.unregister("roles");
					 */
					unregister: function slothlet_permissions_principal_unregister(name) {
						if (!config.api?.mutations?.permissions) {
							throw new slothlet.SlothletError("API_MUTATION_DISABLED", {
								operation: ["slothlet", "permissions", "principal", "unregister"]
							});
						}
						const permissionManager = slothlet.handlers?.permissionManager;
						/* v8 ignore start */
						if (!permissionManager?.unregisterPrincipal) {
							throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
						}
						/* v8 ignore stop */

						// Code supplied to another module's call has to own the name as both modules (#597).
						const callerModuleID = runtime_ownerModuleIDs(slothlet.contextManager?.getCallerIdentity?.());
						const result = permissionManager.unregisterPrincipal(name, callerModuleID);

						if (result && slothlet.handlers?.apiManager?.state?.operationHistory) {
							listPush(slothlet.handlers.apiManager.state.operationHistory, {
								type: "unregisterPrincipal",
								name,
								callerModuleID,
								timestamp: slothlet.clock.now()
							});
						}
						return result;
					},

					/**
					 * Invalidate a principal's cached facts — for one identity, or for every identity when
					 * `identityKey` is omitted (owner or host only). Still works after `control.seal()`. Not
					 * recorded for replay: a reload starts every principal with an empty cache anyway.
					 *
					 * @param {string} name - Principal name.
					 * @param {*} [identityKey] - Identity to invalidate; omit to invalidate every identity.
					 * @returns {boolean} True when the principal exists.
					 * @public
					 * @example
					 * api.slothlet.permissions.principal.invalidate("roles", "user-42");
					 */
					invalidate: function slothlet_permissions_principal_invalidate(name, identityKey) {
						const permissionManager = slothlet.handlers?.permissionManager;
						/* v8 ignore start */
						if (!permissionManager?.invalidatePrincipal) {
							throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
						}
						/* v8 ignore stop */

						// Code supplied to another module's call has to own the name as both modules (#597).
						const callerModuleID = runtime_ownerModuleIDs(slothlet.contextManager?.getCallerIdentity?.());
						return permissionManager.invalidatePrincipal(name, identityKey, callerModuleID);
					}
				},

				/**
				 * Self-scoped permission introspection (always available).
				 * @type {object}
				 * @public
				 */
				self: {
					/**
					 * Check if the calling module is allowed to reach a target path.
					 *
					 * @param {string} target - Target API path to check.
					 * @returns {boolean} True if access is allowed.
					 * @public
					 * @example
					 * const canWrite = api.slothlet.permissions.self.access("db.write");
					 */
					access: function slothlet_permissions_self_access(target) {
						// Check if permission manager is available
						const permissionManager = slothlet.handlers?.permissionManager;
						/* v8 ignore start */
						if (!permissionManager?.checkAccess) {
							throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
						}
						/* v8 ignore stop */

						const ctx = slothlet.contextManager?.tryGetContext?.();
						// Per-flow identity — otherwise this answers for whichever module entered last.
						const identity = slothlet.contextManager?.getCallerIdentity?.();
						const currentWrapper = identity?.currentWrapper;
						const callerPath = currentWrapper?.____slothletInternal?.apiPath ?? "";
						const callerFilePath = currentWrapper?.____slothletInternal?.filePath ?? null;
						const runtimeContext = ctx?.context ?? null;
						if (!slothlet.handlers.permissionManager.checkAccess(callerPath, target, callerFilePath, null, runtimeContext)) return false;
						// Code supplied to another module's call may reach only what every call of its ceiling may as well (#597).
						return ArrayMethods.every(identityCeilings(identity), (ceiling) =>
							slothlet.handlers.permissionManager.checkAccess(
								ceiling.____slothletInternal.apiPath,
								target,
								ceiling.____slothletInternal.filePath ?? null,
								null,
								runtimeContext
							)
						);
					},

					/**
					 * List all permission rules that apply to the calling module.
					 *
					 * @returns {Array<object>} Rules where the caller pattern matches this module.
					 * @public
					 * @example
					 * const rules = api.slothlet.permissions.self.rules();
					 */
					rules: function slothlet_permissions_self_rules() {
						// Check if permission manager is available
						const permissionManager = slothlet.handlers?.permissionManager;
						/* v8 ignore start */
						if (!permissionManager?.getRulesForCaller) {
							throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
						}
						/* v8 ignore stop */

						// Per-flow identity: this returns the caller's own rules, so mis-attribution would
						// disclose another module's rule set.
						const identity = slothlet.contextManager?.getCallerIdentity?.();
						const currentWrapper = identity?.currentWrapper;
						const callerPath = currentWrapper?.____slothletInternal?.apiPath ?? "";
						const rules = slothlet.handlers.permissionManager.getRulesForCaller(callerPath);
						// Code supplied to another module's call sees only the rules that apply to that call as well
						// (#597), so it discloses neither module's rules beyond what both share.
						let shared = rules;
						for (let i = 0, ceilings = identityCeilings(identity); i < ceilings.length; i++) {
							const ceiling = ceilings[i];
							const ids = setFrom(
								mapList(slothlet.handlers.permissionManager.getRulesForCaller(ceiling.____slothletInternal.apiPath), (rule) => rule.id)
							);
							shared = filterList(shared, (rule) => SetMethods.has(ids, rule.id));
						}
						return shared;
					}
				},

				/**
				 * Global permission diagnostics (gatable via rules).
				 * @type {object}
				 * @public
				 */
				global: {
					/**
					 * Permission queries for any caller identity.
					 * @type {object}
					 */
					check: {
						/**
						 * Check if an arbitrary caller path is allowed to reach a target path.
						 *
						 * @param {string} caller - Caller API path.
						 * @param {string} target - Target API path.
						 * @returns {boolean} True if access is allowed.
						 * @public
						 * @example
						 * const ok = api.slothlet.permissions.global.check.access("payments.charge", "db.write");
						 */
						access: function slothlet_permissions_global_check_access(caller, target) {
							// Check if permission manager is available
							const permissionManager = slothlet.handlers?.permissionManager;
							/* v8 ignore start */
							if (!permissionManager?.checkAccess) {
								throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
							}
							/* v8 ignore stop */

							const runtimeContext = slothlet.contextManager?.tryGetContext?.()?.context ?? null;
							return slothlet.handlers.permissionManager.checkAccess(caller, target, null, null, runtimeContext);
						},

						/**
						 * Would `caller` be allowed to CALL `target` with `args`? The call-gate twin of
						 * `event.level` (#508): it evaluates exactly what the real call gate evaluates for a
						 * supplied caller identity — function conditions receive `{ args, target }`, a stale
						 * `requires` principal is resolved first (the only case that returns a Promise), the caller
						 * is treated as a module with no source file (no self-call bypass; a module-private target
						 * is denied), and audit events emit with `via: ["slothlet", "permissions", "global", "check", "call"]`. Conditions are evaluated
						 * against the ambient `context.run()` context, like `check.access`. Answers `true` when
						 * enforcement is disabled.
						 *
						 * Host-only: a built-in rule denies modules `slothlet.permissions.global.check.call`; the host
						 * grants it to a trusted boundary layer with an instance rule on that exact target.
						 *
						 * @param {string} caller - Caller API path (non-empty).
						 * @param {string} target - Target API path (non-empty).
						 * @param {Array<*>} [args=[]] - The arguments of the call being asked about.
						 * @returns {boolean|Promise<boolean>} True if the call would be allowed; a Promise only when a stale principal had to be resolved.
						 * @throws {SlothletError} INVALID_ARGUMENT for a non-string / empty `caller` or `target`, or a non-array `args`.
						 * @public
						 * @example
						 * const ok = await api.slothlet.permissions.global.check.call("client.app", "project.files.list", ["p1"]);
						 */
						call: function slothlet_permissions_global_check_call(caller, target, args) {
							// Check if permission manager is available
							const permissionManager = slothlet.handlers?.permissionManager;
							/* v8 ignore start */
							if (!permissionManager?.checkCall) {
								throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
							}
							/* v8 ignore stop */

							const runtimeContext = slothlet.contextManager?.tryGetContext?.()?.context ?? null;
							return slothlet.handlers.permissionManager.checkCall(caller, target, args, runtimeContext);
						}
					},

					/**
					 * The rules that apply, by target path or by owning module.
					 * @type {object}
					 */
					rules: {
						/**
						 * List all rules that match a given target path.
						 *
						 * @param {string} path - Target API path.
						 * @returns {Array<object>} Matching rules.
						 * @public
						 * @example
						 * const rules = api.slothlet.permissions.global.rules.path("db.write");
						 */
						path: function slothlet_permissions_global_rules_path(path) {
							// Check if permission manager is available
							const permissionManager = slothlet.handlers?.permissionManager;
							/* v8 ignore start */
							if (!permissionManager?.getRulesForPath) {
								throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
							}
							/* v8 ignore stop */

							return slothlet.handlers.permissionManager.getRulesForPath(path);
						},

						/**
						 * List all rules owned by a module.
						 *
						 * @param {string} moduleID - Module ID to look up.
						 * @returns {Array<object>} Rules owned by the module.
						 * @public
						 * @example
						 * const rules = api.slothlet.permissions.global.rules.module("mod_abc123");
						 */
						module: function slothlet_permissions_global_rules_module(moduleID) {
							// Check if permission manager is available
							const permissionManager = slothlet.handlers?.permissionManager;
							/* v8 ignore start */
							if (!permissionManager?.getRulesByModule) {
								throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
							}
							/* v8 ignore stop */

							return slothlet.handlers.permissionManager.getRulesByModule(moduleID);
						}
					}
				},

				/**
				 * Global permission control (deny-by-default).
				 * @type {object}
				 * @public
				 */
				control: {
					/**
					 * The permission system's mode, or switch it. Without an argument, returns `"on"` (every rule applies),
					 * `"strict"` (as on, with the permission baseline met), `"off"` (only the built-in rules that keep module
					 * code off the framework's own namespace, root functions, and keys on api nodes), or `"disabled"`
					 * (nothing applies). With `"on"` / `true` or `"off"` / `false` it switches, then returns the mode.
					 * `"strict"` is config-only (never entered or left at runtime, `PERMISSION_STRICT_FIXED`); `"disabled"`
					 * can be left but not entered; after `seal()` switching throws `PERMISSION_SEALED`.
					 *
					 * @param {"on"|"off"|boolean} [value] - The mode to switch to.
					 * @returns {"on"|"strict"|"off"|"disabled"} The mode (after the switch, when one was asked for).
					 * @public
					 * @example
					 * api.slothlet.permissions.control.mode(); // "off" with no permissions config
					 * api.slothlet.permissions.control.mode("on");
					 */
					mode: function slothlet_permissions_control_mode(...args) {
						const permissionManager = slothlet.handlers.permissionManager;
						if (args.length > 0) permissionManager.setMode(args[0]);
						return permissionManager.mode();
					},

					/**
					 * Read-level gating: whether terminal data-value reads are permission-gated.
					 * @type {object}
					 */
					gating: {
						/**
						 * Read-level gating state, or switch it. Without an argument, returns whether terminal data-value reads
						 * are permission-gated; with a boolean, switches it and returns the new state.
						 *
						 * @param {boolean} [value] - True to gate terminal data-value reads, false to stop.
						 * @returns {boolean} The read-gating state (after the switch, when one was asked for).
						 * @throws {SlothletError} INVALID_ARGUMENT for a non-boolean; PERMISSION_SEALED once sealed.
						 * @public
						 * @example
						 * api.slothlet.permissions.control.gating.read(); // true
						 * api.slothlet.permissions.control.gating.read(false);
						 */
						read: function slothlet_permissions_control_gating_read(...args) {
							const permissionManager = slothlet.handlers.permissionManager;
							if (args.length > 0) permissionManager.setReadGating(args[0]);
							return permissionManager.isReadGatingEnabled();
						}
					},

					/**
					 * Seal the permission control surface (one-way, no unseal). After sealing, switching `mode(value)` or
					 * `gating.read(value)`, addRule/removeRule, and principal.register/unregister throw PERMISSION_SEALED.
					 * Enforcement continues to evaluate; principal.invalidate and shutdown() still work. Idempotent.
					 *
					 * @returns {void}
					 * @public
					 * @example
					 * api.slothlet.permissions.control.seal();
					 */
					seal: function slothlet_permissions_control_seal() {
						const permissionManager = slothlet.handlers?.permissionManager;
						/* v8 ignore start */
						if (!permissionManager?.seal) {
							throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
						}
						/* v8 ignore stop */

						slothlet.handlers.permissionManager.seal();
					},

					/**
					 * The permission system's mode, what the permission baseline found when the instance started, and the
					 * capabilities rules open to module code. A met baseline means only that the checks slothlet can make
					 * passed: code that ran before slothlet (a page's own scripts, an extension, a compromised dependency)
					 * can have replaced globals or faked what the checks read (docs/PERMISSIONS.md).
					 *
					 * @returns {{mode: "on"|"strict"|"off"|"disabled", baseline: {met: boolean|null, checks: Array<{id: string, met: boolean, reason: string|null}>}, capabilities: Array<{name: string, allowed: string[]}>}}
					 *   The report. `baseline.met` is null and `baseline.checks` empty when no check ran (the mode was off
					 *   or disabled when the instance started); `reason` is null for a check that is met.
					 * @public
					 * @example
					 * const { mode, baseline } = api.slothlet.permissions.control.report();
					 * if (!baseline.met) console.warn(baseline.checks.filter((check) => !check.met));
					 */
					report: function slothlet_permissions_control_report() {
						return slothlet.handlers.permissionManager.report();
					},

					/**
					 * Whether the permission control surface has been sealed.
					 *
					 * @returns {boolean} True when the control surface is sealed.
					 * @public
					 * @example
					 * const sealed = api.slothlet.permissions.control.sealed;
					 */
					get sealed() {
						const permissionManager = slothlet.handlers?.permissionManager;
						/* v8 ignore start */
						if (!permissionManager?.isSealed) {
							throw new slothlet.SlothletError("PERMISSION_MANAGER_NOT_AVAILABLE", {});
						}
						/* v8 ignore stop */

						return permissionManager.isSealed();
					}
				}
			}
		};

		// Remove the `hook` namespace when hooks are disabled (unless diagnostics mode)
		if (!config.hook?.enabled && config.diagnostics !== true) {
			delete namespace.hook;
		}

		// Add diagnostics if enabled
		if (config.diagnostics === true) {
			namespace.diag = {
				/**
				 * Describe API structure (like v2)
				 * @param {boolean} [showAll=false] - If true, returns full API object; if false, returns top-level keys
				 * @returns {Array|Object}
				 */
				describe: (showAll = false) => {
					// Read through the bound api, as `self` reads the root: a member the reader may not read is left
					// out and refused there, as at any node, and a file's primitive default export is its value.
					const root = slothlet.boundApi ?? userApi;
					if (showAll) {
						// Return full API structure (like v2 eager mode). Module code gets its own views of the
						// nodes, as it reads them through `self`, never the nodes themselves (#625).
						const reader = runtime_selfModuleReader(slothlet);
						if (!reader) return { ...root };
						const described = {};
						for (let ofIndex = 0, ofList = Reflect.ownKeys(root); ofIndex < ofList.length; ofIndex++) {
							const key = ofList[ofIndex];
							// A key the root lists but does not describe to the reader (the root function's own `prototype`
							// to a reader that may not call the root) is not handed over, as a read of it is refused.
							if (Reflect.getOwnPropertyDescriptor(root, key) === undefined) continue;
							const value = root[key];
							if (typeof key !== "string") described[key] = value;
							else if (SetMethods.has(SELF_FRAMEWORK_ROOT_KEYS, key)) described[key] = runtime_selfFrameworkView(value, reader, slothlet);
							else described[key] = runtime_selfView(value, reader);
						}
						return described;
					}
					// Return top-level keys (like v2)
					return Reflect.ownKeys(root);
				},

				/**
				 * Reference object passed to slothlet initialization (merged into API)
				 * @type {Object|null}
				 */
				reference: slothlet.reference || null,

				/**
				 * Context object (user-provided context from config)
				 * @type {Object}
				 */
				context: slothlet.context || {},

				/**
				 * Inspect instance state
				 * @returns {Object}
				 */
				inspect: () => {
					return slothlet.getDiagnostics();
				},

				/**
				 * Get the live bound API object
				 * @returns {Object} The bound API proxy
				 */
				api: () => {
					// Module code gets the api as it reads it through `self` (#625).
					const reader = runtime_selfModuleReader(slothlet);
					const api = slothlet.getAPI();
					return reader ? runtime_selfRootView(slothlet, reader) : api;
				},

				/**
				 * Ownership diagnostics
				 * @type {object}
				 */
				owner: {
					/**
					 * Get ownership info for a specific API path
					 * @param {string} apiPath - API path to check
					 * @returns {Set<string>|null} Set of moduleIDs that own this path, or null if path not found
					 */
					get: (apiPath) => {
						if (slothlet.handlers?.ownership) {
							return slothlet.handlers.ownership.getPathOwnership(apiPath);
						}
						return null;
					},

					/**
					 * Get ownership diagnostics for all registered API paths
					 * @returns {Object|null} Ownership diagnostic data, or null if ownership tracking is disabled
					 */
					list: () => {
						return slothlet.getOwnership();
					}
				},

				/**
				 * Cache system diagnostics
				 * @type {object}
				 */
				caches: {
					/**
					 * Get cache diagnostics information
					 * @returns {{ caches: Array<{ module: string, path: string[], folder: string, mode: string, count: number, at: number }> }}
					 *   One entry per cached module.
					 * @example
					 * const diag = api.slothlet.diag.caches.get();
					 * // {
					 * //   caches: [
					 * //     { module: "base_abc", path: [], folder: "/app/api", mode: "eager", count: 45, at: 1708012345 },
					 * //     { module: "plugins_xyz", path: ["plugins"], folder: "/app/plugins", mode: "eager", count: 12, at: 1708012399 }
					 * //   ]
					 * // }
					 */
					get: () => {
						if (slothlet.handlers?.apiCacheManager) {
							return slothlet.handlers.apiCacheManager.getCacheDiagnostics();
						}
						return { caches: [] };
					},

					/**
					 * Get all moduleIDs in cache
					 * @returns {string[]} Array of moduleIDs
					 */
					ids: () => {
						if (slothlet.handlers?.apiCacheManager) {
							return slothlet.handlers.apiCacheManager.getAllModuleIDs();
						}
						return [];
					},

					/**
					 * Check if cache exists for moduleID
					 * @param {string} moduleID - Module identifier
					 * @returns {boolean} True if cache exists
					 */
					has: (moduleID) => {
						if (slothlet.handlers?.apiCacheManager) {
							return slothlet.handlers.apiCacheManager.has(moduleID);
						}
						return false;
					}
				},

				/**
				 * Hook system diagnostics (only when hooks enabled)
				 * @type {object}
				 */
				// hookManager is always auto-registered via slothletProperty; false arm is unreachable.
				/* v8 ignore start */
				hook: slothlet.handlers?.hookManager
					? {
							/**
							 * Hook manager enabled state
							 * @type {boolean}
							 */
							get enabled() {
								return slothlet.handlers.hookManager.enabled;
							},

							/**
							 * Compile a glob pattern into a matcher function for diagnostic use.
							 * @param {string} pattern - Glob pattern
							 * @returns {Function} Compiled matcher function
							 */
							compile: (pattern) => {
								return slothlet.handlers.hookManager.getCompilePatternForDiagnostics()(pattern);
							}
						}
					: undefined
				/* v8 ignore stop */
			};
		}

		/**
		 * Freeze the current leaf's CALLER identity onto a callback (#477).
		 * @param {Function} fn - The callback whose caller identity should be pinned.
		 * @returns {Function} A wrapper that invokes `fn` as the current leaf's caller.
		 * @throws {SlothletError} PERMISSION_DENIED when the calling module has not been granted
		 *   `slothlet.pin.caller`; INVALID_ARGUMENT when `fn` is not a function.
		 * @public
		 *
		 * @description
		 * `pin` pins the leaf that calls it, so a service leaf accepting a callback on
		 * behalf of whoever called it (a scheduler's `every(interval, fn)`, a registry) can only
		 * pin itself — the callback would run as the service. `pin.caller` pins the
		 * identity `self.slothlet.metadata.caller()` reports at the moment of the call (the same
		 * resolution, shared through the metadata handler), so the callback runs as the module
		 * that called the service.
		 *
		 * Acting as your caller is a privilege: the api path `slothlet.pin.caller` is
		 * denied to every module by a built-in rule, and the host grants it, e.g.
		 * `{ caller: "scheduler.**", target: "slothlet.pin.caller", effect: "allow" }`.
		 * The check runs when the wrapper is created, not when it is invoked.
		 *
		 * When the leaf itself was called from outside any module (the host, a transport edge),
		 * the callback is pinned to **no module caller**: it runs as the host, and
		 * `metadata.caller()` returns null inside it. This is a real pin, not a passthrough.
		 *
		 * Otherwise identical to `pin`: captured once at call time and immutable after;
		 * `this` and arguments are forwarded; errors from `fn` propagate unchanged; the returned
		 * wrapper exposes `____slothletOriginal`; instanceID/contextManager are resolved live so a
		 * callback held across `reload()` targets the current instance. Runtime-mode behaviour is
		 * the same as `pin`'s — in **async** mode the identity propagates through
		 * `AsyncLocalStorage` across every `await`; in **live** mode there is one identity slot per
		 * instance, so an async callback resumed while other calls are also suspended is attributed
		 * from the call stack (failing closed, never to the host) — see docs/HOOKS.md.
		 *
		 * @example
		 * // scheduler/service.mjs — runs each job as the module that scheduled it.
		 * export function every(ms, job) {
		 *   setInterval(self.slothlet.pin.caller(job), ms);
		 * }
		 */
		const pinCaller = function slothlet_pin_caller(fn) {
			// Enforced here as well as on the route: the function is handed out as a plain value
			// (`caller` is a meta-property of the route proxy), so a reference passed on to another
			// module must still be refused for that module.
			enforceInternalPermission("slothlet.pin.caller");
			if (typeof fn !== "function") {
				throw new slothlet.SlothletError("INVALID_ARGUMENT", {
					argument: "fn",
					expected: "function",
					received: typeof fn
				});
			}
			// The identity metadata.caller() reports right now — null when the current leaf was
			// called from outside any module, which pins "no module caller" (run as the host). A module
			// that kept this function and calls it later from outside any call has no caller either, but
			// is no host: it is pinned to that module (#625).
			// Code a module made and handed out, run as that module, has no caller of its own either: run by the host, it
			// is still no host, and is pinned to that module (#597).
			const running = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
			const madeRun = running?.made === true || running?.record?.made === true;
			const fromCaller = slothlet.handlers.metadata.callerWrapper() ?? runtime_frameworkViewCaller(slothlet);
			const capturedCaller = fromCaller ?? (madeRun ? (running.currentWrapper ?? null) : null);
			// A caller that was code supplied to another call keeps that call as its ceiling (#597); the module the made
			// code runs as keeps its own.
			const capturedCeiling = fromCaller ? (running?.callerCeiling ?? null) : capturedCaller ? (running.ceiling ?? null) : null;
			const locked = function slothlet_lockedCallerCaller(...args) {
				// rawErrors: surface fn's own errors unchanged. instanceID/contextManager resolved live
				// so a callback held across a reload() targets the current instance.
				return capturedCaller
					? slothlet.contextManager.runInContext(slothlet.instanceID, fn, this, args, capturedCaller, true, false, capturedCeiling)
					: slothlet.contextManager.runInContext(slothlet.instanceID, fn, this, args, null, true, true);
			};
			// Parity with pin / the EventEmitter patch metadata.
			locked.____slothletOriginal = fn;
			return runtime_markCallerLocked(locked);
		};
		// `pin.caller` is its own api path (`slothlet.pin.caller`), so the permission
		// system gates it independently of `pin`, whose call behaviour is unchanged.
		// Configurable (still read-only) so the view a module reads `self.slothlet` through can hand it
		// over wrapped, as it does every other member: kept and called later, it runs as that module (#625).
		Objects.defineProperty(namespace.pin, "caller", {
			__proto__: null,
			value: pinCaller,
			enumerable: true,
			writable: false,
			configurable: true
		});

		hookNamespace(namespace, "slothlet");
		namespaceRoutes = createInternalRouteProxy(namespace, "slothlet");
		return namespaceRoutes;
	}

	/**
	 * Create root-level shutdown function (convenience)
	 * @returns {Function} Shutdown function that dynamically calls user hooks
	 * @private
	 */
	createShutdownFunction() {
		const slothlet = this.slothlet;
		/**
		 * The root dispose path, ungated: what the `api.shutdown()` entry below runs after its permission
		 * check, and what framework-internal callers (`api.destroy()`) run directly, so an allowed caller
		 * is never refused halfway (#529).
		 * @returns {Promise<void>}
		 */
		const runShutdown = () => runTeardownAsHost(slothlet, runShutdownBody);
		/**
		 * The dispose path's body — see `runShutdown`.
		 * @returns {Promise<void>}
		 */
		const runShutdownBody = async () => {
			// Stackable lifecycle routines (#341) — this IS the dispose path, replacing what used
			// to be a separate `collectLifecycleHooks` walk (`_collectLifecycleHooks`, removed):
			// `collectLifecycleHooks: true` now expands into an implicit root-anchored
			// `mode: "shutdown"` routine (see `Config.normalizeRoutines`), so this single call
			// covers both the default `shutdown` routine and that legacy option alike. A failing
			// contributor must not block the rest of teardown below, but must still surface to the
			// caller, so its error is captured and re-thrown only after everything else has run.
			let routineError = null;
			try {
				await slothlet.handlers.routineManager?.runShutdownModeRoutines();
			} catch (error) {
				routineError = error;
			}

			// Call user's shutdown hook first if they provided one (check dynamically) — unless the routine
			// run above already invoked it as a `mode: "shutdown"` contribution (#542).
			if (
				slothlet.userHooks?.shutdown &&
				(await isCallableValue(slothlet.userHooks.shutdown)) &&
				!slothlet.handlers.routineManager?.ranInModeRun("shutdown", slothlet.userHooks.shutdown)
			) {
				await slothlet.userHooks.shutdown();
			}
			const result = await slothlet.shutdown();
			if (routineError) throw routineError;
			return result;
		};
		slothlet._runShutdown = runShutdown;
		const shutdownFunction = {
			shutdown: async () => {
				// #529: the root `shutdown` path is permission-checked at entry, like a call to any other api
				// path — ordinary rules on `shutdown` govern it, and while the default `shutdown` routine is
				// configured a built-in rule makes it host-only. Entry only: internal teardown is not gated.
				slothlet._enforceInternalPermission?.("shutdown");
				return runShutdown();
			}
		}.shutdown;
		return shutdownFunction;
	}

	/**
	 * Create root-level run function (per-request context isolation)
	 * @returns {Function} Run function that executes callbacks with isolated context
	 * @private
	 */
	createRunFunction() {
		const slothlet = this.slothlet;
		// Get the scope function reference (created first)
		const scopeFunc = this.createScopeFunction();

		const runFunction = {
			run: async (contextData, callback, ...args) => {
				// Check if per-request context is disabled
				if (slothlet.config.scope === false) {
					throw new slothlet.SlothletError("SCOPE_DISABLED", {});
				}

				// Validate parameters
				if (!contextData || typeof contextData !== "object") {
					throw new slothlet.SlothletError("SCOPE_CONTEXT_INVALID", { received: typeof contextData });
				}
				if (typeof callback !== "function") {
					throw new slothlet.SlothletError("SCOPE_CALLBACK_INVALID", { received: typeof callback });
				}

				// Delegate to scope with structured options
				// Use defaults from config for merge and isolation
				return scopeFunc({
					context: contextData,
					fn: callback,
					args: args,
					merge: slothlet.config.scope?.merge || "shallow",
					isolation: slothlet.config.scope?.isolation || "partial"
				});
			}
		}.run;
		return runFunction;
	}

	/**
	 * Create root-level scope function (structured per-request context with options)
	 * @returns {Function} Scope function that executes functions with isolated context
	 * @private
	 */
	createScopeFunction() {
		const slothlet = this.slothlet;
		const scopeFunction = {
			scope: async (options) => {
				// Check if per-request context is disabled
				if (slothlet.config.scope === false) {
					throw new slothlet.SlothletError("SCOPE_DISABLED", {});
				}

				// Validate parameters
				if (!options || typeof options !== "object") {
					throw new slothlet.SlothletError("SCOPE_OPTIONS_INVALID", { received: typeof options });
				}
				assertOptionKeys(options, "slothlet.context.scope");
				if (!options.fn || typeof options.fn !== "function") {
					throw new slothlet.SlothletError("SCOPE_FUNCTION_INVALID", { received: typeof options?.fn });
				}
				if (!options.context || typeof options.context !== "object") {
					throw new slothlet.SlothletError("SCOPE_CONTEXT_OBJECT_INVALID", { received: typeof options?.context });
				}

				const { context: contextData, fn, args = [], merge = "shallow", isolation, protect, owners } = options;

				// Validate merge strategy
				if (merge !== "shallow" && merge !== "deep") {
					throw new slothlet.SlothletError("SCOPE_MERGE_STRATEGY_INVALID", { merge });
				}

				// Get isolation mode (from options or config)
				const isolationMode = isolation || slothlet.config.scope?.isolation || "partial";

				// Validate isolation mode
				if (isolationMode !== "partial" && isolationMode !== "full") {
					throw new slothlet.SlothletError("SCOPE_ISOLATION_MODE_INVALID", { isolation: isolationMode });
				}

				// Owner-locked context keys (opt-in). `protect` is a write-once/unowned lock (owner =
				// PROTECT_SENTINEL); `owners` binds a key to a named owner (a caller apiPath). Owner-locking
				// is declared ONLY via scope()/run() options — never via run()'s positional args, whose 3rd+
				// arguments are forwarded to the callback.
				if (protect !== undefined && (!Arrays.isArray(protect) || ArrayMethods.some(protect, (k) => typeof k !== "string"))) {
					throw new slothlet.SlothletError("SCOPE_PROTECTED_KEYS_INVALID", { received: describeScopeReceived(protect) });
				}
				if (owners !== undefined) {
					if (typeof owners !== "object" || owners === null || Arrays.isArray(owners)) {
						throw new slothlet.SlothletError("SCOPE_KEY_OWNERS_INVALID", { received: describeScopeReceived(owners) });
					}
					// Owner VALUES are used as owner-name strings later (`enforceContextKeyWrite`'s
					// `writer.startsWith(owner + ".")`). A non-string or empty-string owner would produce
					// incorrect ownership matching (or a TypeError for a non-coercible value like a Symbol),
					// so reject it up front rather than let it surface far from the actual mistake.
					for (let ofIndex = 0, ofList = Objects.entries(owners); ofIndex < ofList.length; ofIndex++) {
						const ofEntry = ofList[ofIndex],
							key = ofEntry[0],
							owner = ofEntry[1];
						if (typeof owner !== "string" || owner.length === 0) {
							throw new slothlet.SlothletError("INVALID_ARGUMENT", {
								argument: `owners.${key}`,
								expected: "non-empty string",
								received: typeof owner === "string" ? "empty string" : typeof owner
							});
						}
					}
				}

				// Build the child store's __contextOwners map: inherit the parent's owners, then claim the
				// keys named by `protect` / `owners`. A nested scope cannot re-own a key already owned by a
				// different owner (CONTEXT_KEY_OWNED); re-claiming with the same owner is idempotent. Claims
				// are checked against the current in-progress map (not just the parent snapshot) so a key
				// named by BOTH `protect` and `owners` in the same call is caught as a within-call collision
				// instead of the later claim silently overwriting the earlier one.
				//
				// SECURITY: `protect`/`owners` keys are caller-supplied strings, so a key like "__proto__" or
				// "constructor" must never be resolved through the prototype chain. The map is always a
				// null-prototype object (`Object.create(null)`), and every read/write goes through
				// `Object.prototype.hasOwnProperty.call` — never a bare `map[key]` / `key in map` — so an
				// inherited `Object.prototype` property can neither be misread as an existing claim nor let a
				// caller-supplied key mutate the map's prototype.
				const buildContextOwners = (parentOwners) => {
					const base = parentOwners ?? null;
					let child = base;
					const claim = (key, owner) => {
						const existing = child && FunctionMethods.call(Objects.prototype.hasOwnProperty, child, key) ? child[key] : undefined;
						if (existing !== undefined && existing !== owner) {
							throw new slothlet.SlothletError("CONTEXT_KEY_OWNED", { key: String(key) });
						}
						if (child === base) child = base ? Objects.assign(Objects.create(null), base) : Objects.create(null);
						child[key] = owner;
					};
					if (Arrays.isArray(protect))
						for (let ofIndex = 0, ofList = protect; ofIndex < ofList.length; ofIndex++) {
							const k = ofList[ofIndex];
							claim(k, trustedRootOwn.PROTECT_SENTINEL);
						}
					if (owners && typeof owners === "object")
						for (let ofIndex = 0, ofList = Objects.entries(owners); ofIndex < ofList.length; ofIndex++) {
							const ofEntry = ofList[ofIndex],
								k = ofEntry[0],
								o = ofEntry[1];
							claim(k, o);
						}
					return child;
				};

				// The keys this scope supplies itself (with those of the scopes it runs inside): `context.set()` while the
				// scope runs leaves them as the scope has them.
				const buildOwnKeys = (parentOwnKeys) => {
					const own = parentOwnKeys ? setFrom(setToArray(parentOwnKeys)) : new Set();
					for (let i = 0, keys = Objects.keys(contextData); i < keys.length; i++) SetMethods.add(own, keys[i]);
					if (Arrays.isArray(protect)) for (let i = 0; i < protect.length; i++) SetMethods.add(own, protect[i]);
					if (owners && typeof owners === "object")
						for (let i = 0, keys = Objects.keys(owners); i < keys.length; i++) SetMethods.add(own, keys[i]);
					return own;
				};

				// Get current context manager
				const contextManager = slothlet.contextManager;
				if (!contextManager) {
					throw new slothlet.SlothletError("CONTEXT_RUNTIME_NOT_AVAILABLE", {});
				}

				const { utilities } = slothlet.helpers;

				// For live binding mode, use child instance approach
				if (contextManager.constructor.name === "LiveContextManager") {
					// CRITICAL: Always get THIS instance's store (base or child), not just current active
					let currentStore = null;

					// Check if current is THIS instance or a child of THIS instance
					const currentID = contextManager.currentInstanceID;
					if (currentID) {
						const activeStore = MapMethods.get(contextManager.instances, currentID);
						const isOurContext =
							currentID === slothlet.instanceID ||
							activeStore?.parentInstanceID === slothlet.instanceID ||
							StringMethods.startsWith(currentID, slothlet.instanceID + "__run_");

						if (isOurContext) {
							currentStore = activeStore;
						}
					}

					// Fall back to base store if not in our context
					if (!currentStore) {
						currentStore = MapMethods.get(contextManager.instances, slothlet.instanceID);
					}

					if (!currentStore) {
						throw new slothlet.SlothletError("CONTEXT_NOT_FOUND", {
							instance: slothlet.instanceID,
							instances: ArrayMethods.join(mapKeysToArray(contextManager.instances), ", ") || "none"
						});
					}

					// Create merged context with deep clone to prevent mutation leakage
					// SECURITY: deep-clone so nested DATA objects are not shared by reference across calls. deepClone (not raw
					// structuredClone) keeps live references — functions/proxies/service handles — BY REFERENCE while still
					// deep-cloning the surrounding data, so a transport injected into context can ride run()/scope() (#408).
					let mergedContext;
					if (merge === "deep") {
						mergedContext = utilities.deepMerge(currentStore.context, contextData);
						// Deep merge still needs cloning to prevent shared references
						mergedContext = utilities.deepClone(mergedContext);
					} else {
						// Shallow merge: clone parent context first, then merge new data
						const clonedParent = utilities.deepClone(currentStore.context);
						mergedContext = { ...clonedParent, ...contextData };
					}

					// Create temporary child instance
					const childInstanceID = `${slothlet.instanceID}__run_${slothlet.clock.now()}_${StringMethods.slice(NumberMethods.toString(Math.random(), 36), 2, 9)}`;

					const childStore = {
						instanceID: childInstanceID,
						context: mergedContext,
						// Isolation mode governs `self` only:
						//  - `partial` (default): `self` is the SHARED live reference —
						//    mutations inside the callback persist (by design).
						//  - `full`: `self` is a copy-on-write view — reads pass through
						//    to the live `self`, writes (incl. deep-path) land on a
						//    per-scope overlay discarded on exit, so nothing leaks.
						// Context is isolated in both modes (child store discarded).
						self: isolationMode === "full" ? makeCopyOnWriteSelf(currentStore.self) : currentStore.self,
						config: currentStore.config,
						createdAt: currentStore.createdAt,
						parentInstanceID: slothlet.instanceID,
						// Carry the caller identity from the parent store so a `self.*`
						// call inside the run()/scope() callback is still attributed to
						// the module that invoked it. run()/scope() isolate context
						// data, not caller identity.
						// Code a caller supplied to the running call scopes as that caller, under the call as its
						// ceiling (#597); otherwise the store's own caller identity carries over as it is.
						...runtime_scopeIdentity(slothlet, currentStore),
						callerWrapper: currentStore.callerWrapper,
						// Inherit slothlet ref so runtime self set-traps can reach apiManager
						// from inside `api.slothlet.context.run()` / `.scope()` callbacks.
						slothlet: currentStore.slothlet,
						// Inherit + extend owner-locked context keys (opt-in); null when no key is owned.
						__contextOwners: buildContextOwners(currentStore.__contextOwners),
						// The keys this scope supplied itself, which `context.set()` leaves alone while it runs.
						__ownKeys: buildOwnKeys(currentStore.__ownKeys)
					};
					// Propagate the trusted-root marker so a host-level `run()`/`scope()` (whose parent
					// is the trusted base store and which carries no module caller) stays trusted. A
					// module-initiated scope inherits the module as `currentWrapper`, so it is enforced
					// as an inter-module call regardless of this marker.
					if (currentStore[trustedRootOwn.TRUSTED_ROOT] === true) {
						Objects.defineProperty(childStore, trustedRootOwn.TRUSTED_ROOT, { __proto__: null, value: true, configurable: true });
					}

					// Register child instance
					MapMethods.set(contextManager.instances, childInstanceID, childStore);
					const previousInstanceID = contextManager.currentInstanceID;

					try {
						// Set as current instance
						contextManager.currentInstanceID = childInstanceID;

						// Execute callback
						return await Reflect.apply(fn, undefined, args);
					} finally {
						// Restore previous instance ID and cleanup child
						contextManager.currentInstanceID = previousInstanceID;
						MapMethods.delete(contextManager.instances, childInstanceID);
					}
				}

				// For async mode, use child instance approach
				if (contextManager.constructor.name === "AsyncContextManager") {
					// CRITICAL: Get THIS instance's store (base or child), not just any active store
					let currentStore = null;

					// Check if active ALS context is THIS instance or a child of THIS instance
					const activeStore = contextManager.tryGetContext();
					if (activeStore) {
						const isOurContext =
							activeStore.instanceID === slothlet.instanceID ||
							activeStore.parentInstanceID === slothlet.instanceID ||
							StringMethods.startsWith(activeStore.instanceID, slothlet.instanceID + "__run_");

						if (isOurContext) {
							currentStore = activeStore;
						}
					}

					// Fall back to base store if not in our context
					if (!currentStore) {
						const baseStore = MapMethods.get(contextManager.instances, slothlet.instanceID);
						if (!baseStore) {
							throw new slothlet.SlothletError("CONTEXT_NOT_FOUND", {
								instance: slothlet.instanceID,
								instances: ArrayMethods.join(mapKeysToArray(contextManager.instances), ", ") || "none"
							});
						}
						currentStore = baseStore;
					}

					// Create new store with merged context (deep cloned for isolation)
					// SECURITY: deep-clone so nested DATA objects are not shared by reference across calls. deepClone (not raw
					// structuredClone) keeps live references — functions/proxies/service handles — BY REFERENCE while still
					// deep-cloning the surrounding data, so a transport injected into context can ride run()/scope() (#408).
					let mergedContext;
					if (merge === "deep") {
						mergedContext = utilities.deepMerge(currentStore.context, contextData);
						// Deep merge still needs cloning to prevent shared references
						mergedContext = utilities.deepClone(mergedContext);
					} else {
						// Shallow merge: clone parent context first, then merge new data
						const clonedParent = utilities.deepClone(currentStore.context);
						mergedContext = { ...clonedParent, ...contextData };
					}

					// Create temporary child instance
					const childInstanceID = `${slothlet.instanceID}__run_${slothlet.clock.now()}_${StringMethods.slice(NumberMethods.toString(Math.random(), 36), 2, 9)}`;

					const childStore = {
						instanceID: childInstanceID,
						context: mergedContext,
						// Isolation mode governs `self` only:
						//  - `partial` (default): `self` is the SHARED live reference —
						//    mutations inside the callback persist (by design).
						//  - `full`: `self` is a copy-on-write view — reads pass through
						//    to the live `self`, writes (incl. deep-path) land on a
						//    per-scope overlay discarded on exit, so nothing leaks.
						// Context is isolated in both modes (child store discarded).
						self: isolationMode === "full" ? makeCopyOnWriteSelf(currentStore.self) : currentStore.self,
						config: currentStore.config,
						createdAt: currentStore.createdAt,
						parentInstanceID: slothlet.instanceID,
						// Carry the caller identity from the parent store so a `self.*`
						// call inside the run()/scope() callback is still attributed to
						// the module that invoked it. run()/scope() isolate context
						// data, not caller identity.
						// Code a caller supplied to the running call scopes as that caller, under the call as its
						// ceiling (#597); otherwise the store's own caller identity carries over as it is.
						...runtime_scopeIdentity(slothlet, currentStore),
						callerWrapper: currentStore.callerWrapper,
						// Inherit slothlet ref so runtime self set-traps can reach apiManager
						// from inside `api.slothlet.context.run()` / `.scope()` callbacks.
						slothlet: currentStore.slothlet,
						// Inherit + extend owner-locked context keys (opt-in); null when no key is owned.
						__contextOwners: buildContextOwners(currentStore.__contextOwners),
						// The keys this scope supplied itself, which `context.set()` leaves alone while it runs.
						__ownKeys: buildOwnKeys(currentStore.__ownKeys)
					};
					// Propagate the trusted-root marker so a host-level `run()`/`scope()` (whose parent
					// is the trusted base store and which carries no module caller) stays trusted. A
					// module-initiated scope inherits the module as `currentWrapper`, so it is enforced
					// as an inter-module call regardless of this marker.
					if (currentStore[trustedRootOwn.TRUSTED_ROOT] === true) {
						Objects.defineProperty(childStore, trustedRootOwn.TRUSTED_ROOT, { __proto__: null, value: true, configurable: true });
					}

					// Register child instance
					MapMethods.set(contextManager.instances, childInstanceID, childStore);

					try {
						// Run callback in new ALS context
						// The callback's own result is awaited, as the caller's await would: no promise of slothlet's own is made
						// and awaited around it.
						return await contextManager.als.run(childStore, () => Reflect.apply(fn, undefined, args));
					} finally {
						// Cleanup: Remove temporary child instance
						MapMethods.delete(contextManager.instances, childInstanceID);
					}
				}

				throw new slothlet.SlothletError("CONTEXT_RUNTIME_UNSUPPORTED", {
					manager: contextManager.constructor.name
				});
			}
		}.scope;
		return scopeFunction;
	}

	/**
	 * Create root-level destroy function (permanent destruction)
	 * @param {Object} api - Full API object
	 * @returns {Function} Destroy function that dynamically calls user hooks
	 * @private
	 */
	createDestroyFunction(api) {
		const slothlet = this.slothlet;
		const destroyFunction = {
			// Framework-internal teardown runs as the host (#529), so a module that may call destroy() is
			// not refused halfway by a routine contribution's own call gate.
			destroy: async () => {
				// #529: the root `destroy` path is permission-checked at entry against ordinary rules on
				// `destroy` (it is not a default routine, so no built-in rule applies). Entry only.
				slothlet._enforceInternalPermission?.("destroy");
				return runTeardownAsHost(slothlet, destroyBody);
			}
		}.destroy;
		/**
		 * The destroy path's body — see `destroyFunction`.
		 * @returns {Promise<void>}
		 */
		const destroyBody = async () => {
			// Stackable lifecycle routines (#341) — this IS the dispose path for `destroy`,
			// replacing what used to be a separate `collectLifecycleHooks` walk
			// (`_collectLifecycleHooks("destroy")`, removed): `collectLifecycleHooks: true` now
			// expands into an implicit root-anchored `mode: "destroy"` routine (see
			// `Config.normalizeRoutines`). `mode: "shutdown"` routines still run too, via the
			// `api.shutdown()` call below — this only covers routines meant to fire on `destroy()`
			// specifically. Same capture-then-rethrow-after-teardown shape as
			// `createShutdownFunction()`: a failing contributor must not block the rest of
			// teardown, but must still surface to the caller.
			let routineError = null;
			try {
				await slothlet.handlers.routineManager?.runDestroyModeRoutines();
			} catch (error) {
				routineError = error;
			}

			// Call user's destroy hook first if they provided one (check dynamically) — unless the routine
			// run above already invoked it as a `mode: "destroy"` contribution (#542).
			if (
				slothlet.userHooks?.destroy &&
				(await isCallableValue(slothlet.userHooks.destroy)) &&
				!slothlet.handlers.routineManager?.ranInModeRun("destroy", slothlet.userHooks.destroy)
			) {
				await slothlet.userHooks.destroy();
			}

			// Then shutdown cleanly using wrapped api.shutdown() (which calls user's shutdown hook).
			// `api.shutdown()` can itself throw a deferred `mode: "shutdown"` routine aggregate
			// (createShutdownFunction() has the same capture-then-rethrow-after-teardown shape) —
			// capture that here too, rather than letting it propagate immediately, so a shutdown-mode
			// routine failure can't abort destroy() before isDestroyed/key-clearing/api-nulling below.
			try {
				if (api && typeof api.shutdown === "function") {
					// The ungated dispose path: destroy()'s own shutdown is framework-internal, so a caller
					// allowed to destroy is not refused halfway by the root `shutdown` rule (#529).
					await slothlet._runShutdown();
				} else {
					// Fallback if api.shutdown not available
					await slothlet.shutdown();
				}
			} catch (error) {
				if (!routineError) routineError = error;
			}

			// Then try to destroy the API object itself
			// Note: This can't truly delete properties from the returned object
			// but we can mark it as destroyed and prevent further use
			slothlet.isDestroyed = true;

			// Clear all references we can from both api and slothlet.api
			const objectsToClear = filterList([api, slothlet.api], (obj) => obj && typeof obj === "object");

			for (let ofIndex = 0, ofList = objectsToClear; ofIndex < ofList.length; ofIndex++) {
				const obj = ofList[ofIndex];
				const keys = Objects.keys(obj);
				for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					try {
						delete obj[key];
					} catch (_) {
						// Some properties may not be deletable
					}
				}
			}

			// Clear slothlet.api reference
			slothlet.api = null;

			if (routineError) throw routineError;
		};
		return destroyFunction;
	}

	/**
	 * Attach built-in methods to user API
	 * @param {Object} userApi - User API object
	 * @param {Object} builtins - Built-in methods to attach
	 * @private
	 */
	attachBuiltins(userApi, builtins) {
		// Attach slothlet namespace
		// Note: Using configurable: true for vitest compatibility (worker reuse)
		Objects.defineProperty(userApi, "slothlet", {
			__proto__: null,
			value: builtins.slothlet,
			enumerable: true,
			writable: false,
			configurable: true
		});

		// Attach root-level shutdown (convenience)
		Objects.defineProperty(userApi, "shutdown", {
			__proto__: null,
			value: builtins.shutdown,
			enumerable: true,
			writable: false,
			configurable: true
		});

		// Note: destroy is always attached separately after api is built via
		// Object.defineProperty directly (needs api reference for createDestroyFunction).
		// The only current call site passes destroy: null, so this block is never reached.
		// Kept as a fallback for any future caller that pre-builds the destroy fn.
		/* v8 ignore start */
		if (builtins.destroy !== null) {
			Objects.defineProperty(userApi, "destroy", {
				__proto__: null,
				value: builtins.destroy,
				enumerable: true,
				writable: false,
				configurable: true
			});
		}
		/* v8 ignore stop */
	}
}
