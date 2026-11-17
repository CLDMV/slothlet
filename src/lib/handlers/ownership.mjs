/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/ownership.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:16:10-08:00 (1794874570)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Centralized ownership tracking for hot reload
 * @module @cldmv/slothlet/ownership
 * @internal
 */
import { ComponentBase } from "#factories/component-base";
import { internals as unifiedWrapperInternals } from "#handlers/unified-wrapper";
import {
	ArrayMethods,
	Arrays,
	Boolean,
	concatLists,
	copyList,
	filterList,
	FunctionMethods,
	listPush,
	listSplice,
	Map,
	mapEntries,
	mapEntriesToArray,
	mapFrom,
	mapList,
	MapMethods,
	Objects,
	Reflect,
	Set,
	setFrom,
	SetMethods,
	setToArray,
	setValues,
	StringMethods,
	WeakMap,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
const { resolveWrapper } = unifiedWrapperInternals("lib/handlers/ownership");

/**
 * `register()`'s `source` value for a post-hoc "confirm this moduleID still owns this subtree"
 * re-touch (registerSubtree()'s own recursive walk) — as opposed to a genuine, freshly-evaluated
 * collision-mode decision. Never influences `isMergeLoss` (#372): the confirming call's
 * `collisionMode` is a fixed, context-free label, not a real outcome, so it must never override
 * an already-correctly-decided entry's position just because it happens to run after the real,
 * authoritative registration.
 * @type {string}
 */
// --- API-RULES condition markers (see docs/API-RULES/API-COLLISION-CONDITIONS.md) ---
// Rule 17 (O01): Collision mode `merge` — ~L145 (+ api-assignment.mjs)
// Rule 17 (O02): Collision mode `merge-replace` — api-assignment.mjs ~L405
// Rule 17 (O03): Collision mode `replace` — api-assignment.mjs ~L351
// Rule 17 (O04): Collision mode `skip` — ~L147
// Rule 17 (O05): Collision mode `warn` (context-dependent) — ~L150
// Rule 17 (O06): Collision mode `error` — ~L160
// Rule 17 (O07): forceOverwrite → replace — api-manager.mjs ~L1905
// Rule 17 (O08): Merge-loss (fn-vs-fn under merge) — ~L254 / ~L265
// Rule 17 (O09): Namespace-vs-callable → callable wins — api-assignment.mjs ~L602
// Rule 17 (O10): Wrapper/plain fall-through winners — api-assignment.mjs ~L715
// Rule 17 (O11): mergeApiObjects removeMissing — api-assignment.mjs ~L856
// Rule 17 (O12): Load/mount order (collision precedence) — module-sort.mjs ~L80
// Rule 17 (O13): Mount preflight collision throw — module-manager.mjs ~L427
// Rule 12 (F07) (O14): Cross-module replace shadow capture/restore — api-manager.mjs ~L941 / ~L3214
// Rule 12 (F07) (O15): userAssigned overrides survive replace/reload — api-manager.mjs ~L711

const REGISTRATION_SOURCE_CONFIRM = "subtree-confirm";

/**
 * `register()`'s `source` value for the one call site that genuinely evaluates a fresh,
 * per-call-aware collision decision (`ModesProcessor`, `src/lib/builders/modes-processor.mjs`) —
 * the only source a DUPLICATE registration's `isMergeLoss` correction may trust (#372).
 *
 * Every other source that can reach the duplicate branch is unreliable there, even though it's
 * perfectly fine for a FRESH (non-duplicate) registration:
 * - The generic `impl:created`/`impl:changed` subscriber (slothlet.mjs) registers with the
 *   instance's DEFAULT collision mode, not knowing a specific call's real, resolved mode. Its
 *   FIRST touch of a genuinely new (moduleID, apiPath) pair is a correct, standalone
 *   `isMergeLoss` computation (there is nothing yet to "correct") — but a SECOND, duplicate
 *   touch of that pair is not a new decision, just a re-fire (the same event fires twice per
 *   wrapper construction) or a side effect of an unrelated module's merge composition
 *   re-touching this module's already-decided wrapper. Trusting it there previously flipped an
 *   already-correct "replace" winner into a false merge-loss the moment ANY other module shared
 *   its path (an auth1/auth2 routines regression this exact scenario produced).
 * - `registerSubtree()`'s own confirming re-touch (`REGISTRATION_SOURCE_CONFIRM`) never carried a
 *   real decision to begin with.
 * @type {string}
 */
const REGISTRATION_SOURCE_AUTHORITATIVE = "core";

/**
 * Whether a value can key a WeakMap (an object or function).
 * @param {*} value - Value to test.
 * @returns {boolean} True for a non-null object or a function.
 * @private
 */
function isIndexable(value) {
	return (typeof value === "object" && value !== null) || typeof value === "function";
}

/**
 * Own enumerable string keys of `value` whose descriptor is a plain data property — an accessor is
 * skipped so indexing a module's exports never runs user getter code.
 * @param {object|Function} value - Value whose keys to list.
 * @returns {string[]} Data-property keys.
 * @private
 */
function ownDataKeys(value) {
	const keys = [];
	for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (typeof key !== "string") continue;
		try {
			const descriptor = Objects.getOwnPropertyDescriptor(value, key);
			if (descriptor && descriptor.enumerable && "value" in descriptor) listPush(keys, key);
		} catch {
			// A namespace binding still in its temporal dead zone throws on inspection — skip it.
		}
	}
	return keys;
}

/**
 * Enumerable own string keys of a module namespace, tolerating a binding still in its temporal dead
 * zone (inspecting one throws during a circular import).
 * @param {object} mod - Module namespace.
 * @returns {string[]} Binding names.
 * @private
 */
function namespaceKeys(mod) {
	const keys = [];
	for (let ofIndex = 0, ofList = Reflect.ownKeys(mod); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (typeof key !== "string") continue;
		try {
			if (Objects.getOwnPropertyDescriptor(mod, key)?.enumerable) listPush(keys, key);
		} catch {
			// Temporal-dead-zone binding — skip it.
		}
	}
	return keys;
}

/**
 * Read one module-namespace binding, tolerating a binding still in its temporal dead zone.
 * @param {object} mod - Module namespace.
 * @param {string} key - Binding name.
 * @returns {*} The bound value, or `undefined` when unreadable.
 * @private
 */
function readBinding(mod, key) {
	try {
		return mod[key];
	} catch {
		return undefined;
	}
}

/**
 * Read an own data property without invoking a getter, tolerating a binding still in its temporal
 * dead zone (a module namespace read during a circular import throws on access).
 * @param {object|Function} value - Object to read from.
 * @param {string} key - Property key.
 * @returns {*} The property value, or `undefined` when unreadable or an accessor.
 * @private
 */
function readOwnData(value, key) {
	try {
		const descriptor = Objects.getOwnPropertyDescriptor(value, key);
		return descriptor && "value" in descriptor ? descriptor.value : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Read `proxy[key]` for a bookkeeping walk without starting a lazy child's materialization (#462).
 *
 * @param {object} proxy - The wrapper proxy being walked.
 * @param {object} inner - The wrapper behind it (from `resolveWrapper`).
 * @param {string} key - Child key.
 * @returns {*} Exactly what `proxy[key]` returns, or `undefined` for a getter, which the walk does not run.
 * @internal
 *
 * @description
 * The proxy's get trap is the authoritative read: it builds child wrappers from the impl, unwraps
 * primitive leaves, and so on, so the walk reads through it. The one exception is a child that is
 * itself an unmaterialized lazy wrapper: for that child the trap returns the same stored proxy
 * unchanged, and its only other effect is to start a fire-and-forget `___materialize()`. That child
 * is read from the wrapper directly, so observing the tree never loads it.
 */
function readWithoutMaterializing(proxy, inner, key) {
	let stored;
	const own = Objects.getOwnPropertyDescriptor(inner, key);
	// A member that is a getter is read only when the program reads it, as in plain JavaScript; running
	// it here would run user code at load, and a getter that throws would fail the load.
	if (own && typeof own.get === "function") return undefined;
	if (own) {
		stored = inner[key];
	} else {
		const impl = inner.____slothletInternal?.impl;
		if (impl !== null && (typeof impl === "object" || typeof impl === "function")) {
			// The same holds for a getter the module's value owns (#585 review).
			if (typeof Objects.getOwnPropertyDescriptor(impl, key)?.get === "function") return undefined;
			stored = impl[key];
		}
	}
	const child = resolveWrapper(stored);
	if (child && child.____slothletInternal.mode === "lazy" && !child.____slothletInternal.state.materialized) {
		return stored;
	}
	return proxy[key];
}

/**
 * Summary result of an unregister operation.
 * @typedef {Object} UnregisterResult
 * @property {string[]} removed - API paths that were removed.
 * @property {Object[]} rolledBack - Entries that were rolled back to a previous owner.
 */

/**
 * Tracks which modules own which API paths for hot reload and rollback
 * @class OwnershipManager
 * @extends ComponentBase
 * @public
 */
export class OwnershipManager extends ComponentBase {
	static slothletProperty = "ownership";

	/**
	 * Create an OwnershipManager instance.
	 * @param {object} slothlet - Slothlet class instance.
	 */
	constructor(slothlet) {
		super(slothlet);
		/** @type {Map<string, Set<string>>} */
		this.moduleToPath = new Map(); // moduleID → Set<apiPath>
		/** @type {Map<string, Array<object>>} */
		this.pathToModule = new Map(); // apiPath → Array<{moduleID, source, timestamp, value}>
		this._unregisteredModules = new Set(); // moduleIDs that have been explicitly unregistered
		this.moduleEndpoints = new Map(); // moduleID → mount endpoint (e.g. ".", "lib.config")
		/** @type {Map<string, Set<string>>} */
		this.moduleMounts = new Map(); // moduleID → every live mount endpoint (a host may mount one id at several paths, #625)
		// moduleID → Map<endpoint, "replace"|"merge-replace"> — the winning collision mode each of the
		// module's api.add() calls placed its content under (#524). See setPlacementMode().
		/** @type {Map<string, Map<string, string>>} */
		this.placementModes = new Map();
		// filePath → { values: WeakMap<value, exportPath>, members: WeakMap<value, {key: exportPath}> } —
		// where each value a loaded file exported sits inside that file's module namespace (#484).
		this.exportIndex = new Map();
		// clone → the value it was cloned from, so an origin lookup sees through an eager-mode clone.
		this.cloneSources = new WeakMap();
	}

	/**
	 * Index where each value of a freshly loaded module sits in that module's namespace (#484).
	 * @param {string} filePath - Absolute path of the loaded file.
	 * @param {object} mod - The module namespace as loaded (`import()` result, or the CJS loader's
	 *   `{ default: module.exports, ...ownKeys }` namespace).
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * Wrappers built from this file later look their impl up here to learn their `exportPath` — the
	 * access path within the namespace that produced the value (`["add"]`, `["default"]`,
	 * `["default", "member"]`). A named export wins over the same value reached through `default`.
	 * For a CommonJS module every path is rooted at `["default"]` (`module.exports`), since the
	 * named keys a CommonJS namespace carries are copies of `module.exports`' own keys.
	 *
	 * @example
	 * ownership.indexModuleExports("/abs/api/math.mjs", await import("/abs/api/math.mjs"));
	 */
	indexModuleExports(filePath, mod) {
		if (typeof filePath !== "string" || !filePath || !isIndexable(mod)) return;
		// Merge into an existing entry rather than replace it: the same file loaded again (a reload, or
		// a second mount of it) yields new value identities, while wrappers from an earlier load may
		// still be looked up against the earlier ones.
		const isCommonJS =
			StringMethods.endsWith(filePath, ".cjs") || FunctionMethods.call(Objects.prototype.hasOwnProperty, mod, "module.exports");
		let entry = MapMethods.get(this.exportIndex, filePath);
		if (!entry) {
			entry = { values: new WeakMap(), members: new WeakMap(), keys: new Map(), commonJS: isCommonJS };
			MapMethods.set(this.exportIndex, filePath, entry);
		}
		// Top-level keys by NAME, with the value each held, for a value that has no identity to look up (a
		// primitive — objects and functions resolve through the WeakMaps above, so they are not held here).
		// The latest load of the file wins (a reload can change a primitive's value); within one load a named
		// binding is recorded before, and wins over, a default-object member of the same name.
		const keysThisLoad = new Set();
		const setKey = (key, value, exportPath) => {
			if (isIndexable(value) || SetMethods.has(keysThisLoad, key)) return;
			SetMethods.add(keysThisLoad, key);
			MapMethods.set(entry.keys, key, { value, exportPath });
		};
		const setPath = (value, exportPath) => {
			if (isIndexable(value) && !WeakMapMethods.has(entry.values, value)) WeakMapMethods.set(entry.values, value, exportPath);
		};
		// The namespace's own bindings are read through `[[Get]]`: a real ESM namespace exposes them as
		// data properties, but a loader-provided namespace (a test runner's module runner, a custom
		// `config.import`) may expose each binding as an accessor. Members BELOW the namespace are read
		// as plain data only, so indexing never runs a module's own getter code.
		const namedKeys = isCommonJS ? [] : filterList(namespaceKeys(mod), (key) => key !== "default" && key !== "module.exports");
		for (let ofIndex = 0, ofList = namedKeys; ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			const value = readBinding(mod, key);
			setPath(value, [key]);
			setKey(key, value, [key]);
		}
		const defaultValue = readBinding(mod, "default");
		setPath(defaultValue, ["default"]);
		if (isIndexable(defaultValue)) {
			for (let ofIndex = 0, ofList = ownDataKeys(defaultValue); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				const value = readOwnData(defaultValue, key);
				setPath(value, ["default", key]);
				setKey(key, value, ["default", key]);
			}
		}
		for (let ofIndex = 0, ofList = namedKeys; ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			const value = readBinding(mod, key);
			if (!isIndexable(value)) continue;
			for (let ofIndex = 0, ofList = ownDataKeys(value); ofIndex < ofList.length; ofIndex++) {
				const member = ofList[ofIndex];
				setPath(readOwnData(value, member), [key, member]);
			}
		}
	}

	/**
	 * Whether `filePath` was loaded as a CommonJS module (its exports are `module.exports`) (#484).
	 * @param {string} filePath - Absolute path of a loaded file.
	 * @returns {boolean} True for a CommonJS module; false for ES modules and files never indexed.
	 * @public
	 *
	 * @example
	 * ownership.isCommonJSModule("/abs/api/text.cjs"); // true
	 */
	isCommonJSModule(filePath) {
		return MapMethods.get(this.exportIndex, filePath)?.commonJS === true;
	}

	/**
	 * Record the per-key origins of a value composed from a module's exports (#484).
	 * @param {string} filePath - Absolute path of the file the content was built from.
	 * @param {object|Function} content - The composed content (a fresh namespace object, or a default
	 *   export the named exports were attached onto).
	 * @param {Object<string, string[]>|null} members - Composed key → the exportPath it came from.
	 * @param {string[]|null} [self=null] - The content's own exportPath, when it is itself an export.
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * Flattening merges a module's default and named exports into one content value, so a key's
	 * position under that content no longer tells where it came from. Recording the map lets a
	 * wrapper built from the content hand each child — including a primitive child, which has no
	 * identity to look up — its real exportPath.
	 *
	 * @example
	 * ownership.recordComposedContent(file, content, { add: ["add"], VERSION: ["VERSION"] });
	 */
	recordComposedContent(filePath, content, members, self = null) {
		if (typeof filePath !== "string" || !isIndexable(content)) return;
		const entry = MapMethods.get(this.exportIndex, filePath);
		if (!entry) return;
		if (self && !WeakMapMethods.has(entry.values, content)) WeakMapMethods.set(entry.values, content, self);
		if (members && Objects.keys(members).length > 0) {
			WeakMapMethods.set(entry.members, content, { ...(WeakMapMethods.get(entry.members, content) || {}), ...members });
		}
	}

	/**
	 * Remember that `clone` was cloned from `original`, so an origin lookup sees through the clone.
	 * @param {*} clone - The clone.
	 * @param {*} original - The value it was cloned from.
	 * @returns {void}
	 * @public
	 *
	 * @example
	 * ownership.noteClone(copy, exported);
	 */
	noteClone(clone, original) {
		if (clone !== original && isIndexable(clone) && isIndexable(original)) WeakMapMethods.set(this.cloneSources, clone, original);
	}

	/**
	 * Look up where `value` sits in the module namespace of `filePath` (#484).
	 * @param {string|null} filePath - File the value was loaded from.
	 * @param {*} value - The value (or an eager-mode clone of it).
	 * @returns {string[]|null} The exportPath, or `null` when the value is not a known export of that file.
	 * @public
	 *
	 * @example
	 * ownership.resolveExportPath("/abs/api/math.mjs", addFn); // ["add"]
	 */
	resolveExportPath(filePath, value) {
		const found = this.#lookupIndexed(filePath, value, "values");
		return found ? copyList(found) : null;
	}

	/**
	 * Look up an export of `filePath` by the NAME it was placed under, confirmed by value (#484).
	 * @param {string|null} filePath - File the value was loaded from.
	 * @param {string} key - The key the value sits under in the composed api.
	 * @param {*} value - The value itself; must be the value that export held (`Object.is`).
	 * @returns {string[]|null} The exportPath, or `null` when `filePath` has no export of that name
	 *   holding that value.
	 * @public
	 *
	 * @description
	 * For a value with no identity to look up — a primitive — merged into a namespace that several
	 * files compose (a folder whose files flatten into it), where no per-key map was recorded for the
	 * namespace itself. The value check keeps a same-named but different value from borrowing the path.
	 *
	 * @example
	 * ownership.resolveExportPathByKey("/abs/api/tuning/tuning.mjs", "TUNE_STEP", 5); // ["TUNE_STEP"]
	 */
	resolveExportPathByKey(filePath, key, value) {
		if (typeof filePath !== "string") return null;
		const found =
			MapMethods.get(this.exportIndex, filePath) == null ? undefined : MapMethods.get(MapMethods.get(this.exportIndex, filePath).keys, key);
		return found && Objects.is(found.value, value) ? copyList(found.exportPath) : null;
	}

	/**
	 * Look up the per-key origins recorded for a composed content value (#484).
	 * @param {string|null} filePath - File the content was built from.
	 * @param {*} value - The content (or an eager-mode clone of it).
	 * @returns {Object<string, string[]>|null} Composed key → exportPath, or `null`.
	 * @public
	 *
	 * @example
	 * ownership.resolveMemberExportPaths(file, content); // { add: ["add"] }
	 */
	resolveMemberExportPaths(filePath, value) {
		return this.#lookupIndexed(filePath, value, "members") ?? null;
	}

	/**
	 * Shared lookup for {@link OwnershipManager#resolveExportPath} / {@link OwnershipManager#resolveMemberExportPaths}.
	 * @param {string|null} filePath - File the value came from.
	 * @param {*} value - Value to look up; clone links are followed back to the original.
	 * @param {"values"|"members"} table - Which index table to read.
	 * @returns {*} The indexed entry, or `undefined`.
	 * @private
	 */
	#lookupIndexed(filePath, value, table) {
		if (typeof filePath !== "string") return undefined;
		const entry = MapMethods.get(this.exportIndex, filePath);
		if (!entry) return undefined;
		let current = value;
		const seen = new Set();
		while (isIndexable(current) && !SetMethods.has(seen, current)) {
			// `table` is "values" or "members": both WeakMaps.
			const found = WeakMapMethods.get(entry[table], current);
			if (found) return found;
			SetMethods.add(seen, current);
			current = WeakMapMethods.get(this.cloneSources, current);
		}
		return undefined;
	}

	/**
	 * Read where the value currently at `apiPath` came from (#484).
	 * @param {string} apiPath - API path to look up.
	 * @returns {{moduleID: string, filePath: (string|null), exportPath: (string[]|null), members: (Object<string, string[]>|null)}|null}
	 *   The current owner's origin, or `null` when nothing owns the path.
	 * @public
	 *
	 * @description
	 * `exportPath` is the access path within `filePath`'s module namespace that produced the value;
	 * `null` when the value has no module origin (a runtime `self.X = value`, a synthetic in-memory
	 * `api.add()`, a namespace container slothlet created). `members` carries per-key origins for a
	 * value composed from several exports.
	 *
	 * @example
	 * ownership.getOrigin("math.add"); // { moduleID, filePath: "/abs/api/math.mjs", exportPath: ["add"], members: null }
	 */
	getOrigin(apiPath) {
		const owner = this.getCurrentOwner(apiPath);
		if (!owner) return null;
		return {
			moduleID: owner.moduleID,
			filePath: owner.filePath ?? null,
			exportPath: owner.exportPath ? copyList(owner.exportPath) : null,
			members: owner.memberExportPaths ?? null
		};
	}

	/**
	 * Refresh the origin recorded for a module's entry at `apiPath` without touching its position,
	 * source, or collision state — for a wrapper whose impl arrived after it was registered (lazy
	 * materialization, hot reload).
	 * @param {string} moduleID - Module whose entry to refresh.
	 * @param {string} apiPath - API path of the entry.
	 * @param {{filePath?: (string|null), exportPath?: (string[]|null), memberExportPaths?: (Object|null)}} origin - New origin.
	 * @returns {void}
	 * @public
	 *
	 * @example
	 * ownership.refreshOrigin("base", "math.add", { filePath, exportPath: ["add"] });
	 */
	refreshOrigin(moduleID, apiPath, origin) {
		const entry =
			MapMethods.get(this.pathToModule, apiPath) == null
				? undefined
				: ArrayMethods.find(MapMethods.get(this.pathToModule, apiPath), (candidate) => candidate.moduleID === moduleID);
		if (!entry || !origin?.exportPath) return;
		if (origin.filePath) entry.filePath = origin.filePath;
		entry.exportPath = origin.exportPath;
		entry.memberExportPaths = origin.memberExportPaths ?? null;
	}

	/**
	 * Pin the entries at `apiPath` that record a live wrapper by reference to a snapshot of its impl,
	 * before the wrapper's impl is replaced in place (#533).
	 *
	 * @description
	 * A module that created a namespace records the namespace's own wrapper as its value, so its
	 * contribution reads through to whatever impl the wrapper holds now. When a later module's function
	 * is merged into that namespace, the wrapper's impl becomes that function; without a snapshot, a
	 * rollback to the creating module would re-apply the function it never supplied.
	 * @param {string} apiPath - API path of the entries.
	 * @param {object} wrapper - The raw wrapper whose impl is about to change.
	 * @param {*} impl - The wrapper's impl before the change.
	 * @param {Function} resolve - Maps a recorded value to its raw wrapper (or null).
	 * @returns {void}
	 * @public
	 *
	 * @example
	 * ownership.pinLiveEntries("plugins", wrapper, previousImpl, resolveWrapper);
	 */
	pinLiveEntries(apiPath, wrapper, impl, resolve) {
		for (let ofIndex = 0, ofList = MapMethods.get(this.pathToModule, apiPath) ?? []; ofIndex < ofList.length; ofIndex++) {
			const entry = ofList[ofIndex];
			if (resolve(entry.value) === wrapper) entry.value = impl;
		}
	}

	/**
	 * Record a module's mount endpoint (the apiPath it was loaded/added at).
	 * This is the module's ownership root — the subtree it is allowed to write
	 * to via `self.X = …`. Base modules use `"."`.
	 * @param {string} moduleID - Module identifier.
	 * @param {string} endpoint - Mount endpoint (`"."` for base modules).
	 * @returns {void}
	 * @public
	 */
	setModuleEndpoint(moduleID, endpoint) {
		// Callers (addApiComponent, base load) always pass a real string moduleID;
		// the type guard is defensive against a malformed/absent ID.
		/* v8 ignore next */
		if (typeof moduleID === "string" && moduleID) {
			MapMethods.set(this.moduleEndpoints, moduleID, endpoint);
			let mounts = MapMethods.get(this.moduleMounts, moduleID);
			if (!mounts) {
				mounts = new Set();
				MapMethods.set(this.moduleMounts, moduleID, mounts);
			}
			SetMethods.add(mounts, endpoint);
		}
	}

	/**
	 * Every live mount endpoint of a module (#625): one id may be mounted at several paths.
	 * @param {string} moduleID - Module identifier.
	 * @returns {string[]} The endpoints; empty when the module is not mounted.
	 * @public
	 */
	getModuleMounts(moduleID) {
		return setToArray(MapMethods.get(this.moduleMounts, moduleID));
	}

	/**
	 * Forget one mount endpoint of a module (#625). When another mount remains and the recorded endpoint was this
	 * one, the recorded endpoint becomes a remaining mount.
	 * @param {string} moduleID - Module identifier.
	 * @param {string} endpoint - The mount endpoint removed.
	 * @returns {number} How many mounts the module has left.
	 * @public
	 */
	releaseMount(moduleID, endpoint) {
		const mounts = MapMethods.get(this.moduleMounts, moduleID);
		if (!mounts) return 0;
		SetMethods.delete(mounts, endpoint);
		if (SetMethods.size(mounts) === 0) {
			MapMethods.delete(this.moduleMounts, moduleID);
			return 0;
		}
		if (MapMethods.get(this.moduleEndpoints, moduleID) === endpoint)
			MapMethods.set(this.moduleEndpoints, moduleID, ArrayMethods.at(setToArray(mounts), -1));
		return SetMethods.size(mounts);
	}

	/**
	 * Look up a module's mount endpoint.
	 * @param {string} moduleID - Module identifier.
	 * @returns {string|undefined} The mount endpoint, or undefined if unknown.
	 * @public
	 */
	getModuleEndpoint(moduleID) {
		return MapMethods.get(this.moduleEndpoints, moduleID);
	}

	/**
	 * Record the collision mode an `api.add()` places a module's content under at `endpoint` (#524).
	 * @param {string} moduleID - Module identifier.
	 * @param {string} endpoint - The add's mount path (`""` for a root-level add).
	 * @param {string|null} collisionMode - The add's resolved collision mode. Only `"replace"` and
	 *   `"merge-replace"` are recorded; any other value (or `null`) clears the endpoint's record.
	 * @returns {string|null} The mode previously recorded for this endpoint, for a caller to restore
	 *   with a second call when the add is abandoned.
	 * @public
	 *
	 * @description
	 * Under `"replace"`/`"merge-replace"` (`forceOverwrite` included) the incoming module's content is
	 * what goes live at every path it provides. The registrations made while that content is built and
	 * materialized — wrapper construction, lazy materialization, impl reassignment — come through the
	 * generic `impl:created`/`impl:changed` subscribers, which otherwise only know the instance's default
	 * collision mode and would record the incoming module as a merge loser wherever another module's
	 * function already sits. {@link OwnershipManager#getPlacementMode} lets them register with the mode
	 * that actually decided placement instead, including for a lazy leaf that materializes after the
	 * add has returned.
	 *
	 * @example
	 * const previous = ownership.setPlacementMode("shadow", "launcher.session", "replace");
	 */
	setPlacementMode(moduleID, endpoint, collisionMode) {
		const modes = MapMethods.get(this.placementModes, moduleID);
		const previous = (modes == null ? undefined : MapMethods.get(modes, endpoint)) ?? null;
		if (collisionMode === "replace" || collisionMode === "merge-replace") {
			if (modes) MapMethods.set(modes, endpoint, collisionMode);
			else MapMethods.set(this.placementModes, moduleID, mapFrom([[endpoint, collisionMode]]));
		} else if (modes) {
			MapMethods.delete(modes, endpoint);
			if (MapMethods.size(modes) === 0) MapMethods.delete(this.placementModes, moduleID);
		}
		return previous;
	}

	/**
	 * Look up the collision mode a module's content at `apiPath` was placed under (#524).
	 * @param {string} moduleID - Module identifier.
	 * @param {string} apiPath - API path being registered.
	 * @returns {string|null} `"replace"` or `"merge-replace"` when `apiPath` lies at or below an endpoint
	 *   the module was added at under that mode (the deepest such endpoint wins); otherwise `null`.
	 * @public
	 *
	 * @example
	 * ownership.getPlacementMode("shadow", "launcher.session.store.create"); // "replace"
	 */
	getPlacementMode(moduleID, apiPath) {
		const modes = MapMethods.get(this.placementModes, moduleID);
		if (!modes || typeof apiPath !== "string") return null;
		let match = null;
		let matchLength = -1;
		for (const ofEntry of mapEntries(modes)) {
			const endpoint = ofEntry[0],
				mode = ofEntry[1];
			const covers = endpoint === "" || apiPath === endpoint || StringMethods.startsWith(apiPath, `${endpoint}.`);
			if (covers && endpoint.length > matchLength) {
				match = mode;
				matchLength = endpoint.length;
			}
		}
		return match;
	}

	/**
	 * Register module ownership of API path with its value
	 * @param {Object} options - Registration options
	 * @param {string} options.moduleID - Module identifier
	 * @param {string} options.apiPath - API path being registered
	 * @param {*} options.value - The actual function/object being registered
	 * @param {string} [options.source="core"] - Source of registration
	 * @param {string} [options.collisionMode="error"] - Collision mode: skip, warn, error, merge, replace
	 * @param {string} [options.filePath=null] - File path of the module source (for metadata tracking)
	 * @param {string[]|null} [options.exportPath=null] - Access path within `filePath`'s module namespace
	 *   that produced `value` (`["add"]`, `["default"]`, `["default", "member"]`); `null` when the value
	 *   has no module origin (#484).
	 * @param {Object<string, string[]>|null} [options.memberExportPaths=null] - Per-key exportPaths for a
	 *   value composed from several exports (#484).
	 * @returns {Object|null} Registration entry or null if skipped
	 * @public
	 */
	register({
		moduleID,
		apiPath,
		value,
		source = "core",
		collisionMode = "error",
		filePath = null,
		exportPath = null,
		memberExportPaths = null
	}) {
		// Validate inputs
		if (!moduleID || typeof moduleID !== "string") {
			throw new this.SlothletError("OWNERSHIP_INVALID_MODULE_ID", { moduleID }, null, { validationError: true });
		}
		// Allow empty string for root-level registrations
		if (apiPath !== "" && (!apiPath || typeof apiPath !== "string")) {
			throw new this.SlothletError("OWNERSHIP_INVALID_API_PATH", { apiPath }, null, { validationError: true });
		}

		// Guard: reject registration for modules that have been explicitly unregistered.
		// This prevents stale ownership entries from being re-created when async lazy
		// materialization completes after a module has already been removed via api.remove().
		if (SetMethods.has(this._unregisteredModules, moduleID)) {
			return null;
		}

		// Check for conflicts
		const currentOwner = this.getCurrentOwner(apiPath);
		if (currentOwner && currentOwner.moduleID !== moduleID) {
			// Handle conflict based on collision mode
			if (collisionMode === "merge" || collisionMode === "replace" || collisionMode === "merge-replace") {
				// Allow registration - will merge or replace
			} else if (collisionMode === "skip") {
				// Skip registration silently
				return null;
			} else if (collisionMode === "warn") {
				// Skip registration but emit warning (printed unless the instance is silent)
				new this.SlothletWarning("WARNING_OWNERSHIP_CONFLICT", {
					apiPath,
					existingModuleId: currentOwner.moduleID,
					newModuleId: moduleID
				});
				return null;
			} else {
				// error mode - throw
				throw new this.SlothletError("OWNERSHIP_CONFLICT", {
					apiPath,
					existingModuleId: currentOwner.moduleID,
					newModuleId: moduleID,
					validationError: true
				});
			}
		}

		// Add to moduleToPath
		if (!MapMethods.has(this.moduleToPath, moduleID)) {
			MapMethods.set(this.moduleToPath, moduleID, new Set());
		}
		SetMethods.add(MapMethods.get(this.moduleToPath, moduleID), apiPath);

		// Add to pathToModule stack
		if (!MapMethods.has(this.pathToModule, apiPath)) {
			MapMethods.set(this.pathToModule, apiPath, []);
		}

		// Check for duplicate registration - if this moduleID is already in the stack, don't add again
		const stack = MapMethods.get(this.pathToModule, apiPath);
		const existingEntry = ArrayMethods.find(stack, (entry) => entry.moduleID === moduleID);
		if (existingEntry) {
			// Update existing entry instead of creating duplicate
			existingEntry.source = source;
			existingEntry.timestamp = this.clock.now();
			// Do not downgrade a known value to `undefined`: the same path is registered more than
			// once for a leaf (a namespace/marker registration omits the value while the leaf's own
			// registration carries the callable), and under lazy the value-less one can arrive last.
			// Overwriting unconditionally erased the function value, so kindOf misclassified the leaf
			// as data and leaves() dropped it. Guard it exactly as filePath below already is.
			if (value !== undefined) {
				existingEntry.value = value;
			}
			// The origin (#484) is a (filePath, exportPath) pair: a registration from a DIFFERENT file
			// replaces both together (a stale exportPath must never pair with a new file), while a
			// same-file registration that carries no exportPath — a value-less namespace/marker touch —
			// never downgrades one already recorded, exactly like `value` above.
			if (filePath !== null && filePath !== existingEntry.filePath) {
				existingEntry.exportPath = exportPath;
				existingEntry.memberExportPaths = memberExportPaths;
			} else {
				if (exportPath !== null) existingEntry.exportPath = exportPath;
				if (memberExportPaths !== null) existingEntry.memberExportPaths = memberExportPaths;
			}
			if (filePath !== null) {
				existingEntry.filePath = filePath;
			}
			// A later, more-authoritative registration for the SAME (moduleID, apiPath) pair can
			// correct an earlier call's `isMergeLoss` determination. The framework's generic
			// `impl:created` listener (slothlet.mjs) registers every construction with the
			// instance's DEFAULT collision mode — it has no visibility into a per-call override
			// (e.g. `forceOverwrite`, or a `merge` override on a `replace`-default instance) — and
			// typically fires (from inside the wrapper constructor) BEFORE the caller's own,
			// correctly-collisionMode-aware registration (modes-processor.mjs) for the same pair.
			// Since only the FIRST call for a pair decides the initial flag, this duplicate call,
			// now carrying the real mode, must be able to correct it (#365, #372).
			//
			// ONLY when this duplicate call's source is REGISTRATION_SOURCE_AUTHORITATIVE — see its
			// own doc comment for the full reasoning. In short: every OTHER source that reaches this
			// branch (the generic subscriber's own duplicate re-fire, an unrelated module's merge
			// composition re-touching this module's wrapper, registerSubtree()'s confirming walk)
			// carries no real, freshly-evaluated collision decision, and trusting any of them here
			// flipped an already-correctly-decided entry into a false merge-loss the moment ANY
			// other module shared its path — regressing the ownership rollback-chain test AND (in a
			// second attempt) a routines auth1/auth2 collision test, each via a different one of
			// these unreliable sources (#372 review).
			// Scoped to the same `typeof value === "function"` leaf case the fresh-registration
			// branch below uses — a container/namespace entry is never flagged a merge loss,
			// matching that restriction.
			if (typeof existingEntry.value === "function" && source === REGISTRATION_SOURCE_AUTHORITATIVE) {
				if (collisionMode === "replace" || collisionMode === "merge-replace") {
					existingEntry.isMergeLoss = false;
					// #currentEntry() returns the LAST non-loss entry, so clearing isMergeLoss alone
					// isn't enough when a LATER module has since taken the path: replace/merge-replace
					// means this registration's write genuinely overwrote whatever was live, so it must
					// also become the most-recent entry positionally, or a later module's own (still
					// non-loss) entry keeps winning the scan even though this one is what's actually
					// live now (#372 review — A/merge-B/replace-C, then re-add B with replace: without
					// repositioning, C stays reported as current even after B's replace overwrote it).
					const idx = ArrayMethods.indexOf(stack, existingEntry);
					if (idx !== -1 && idx !== stack.length - 1) {
						listSplice(stack, idx, 1);
						listPush(stack, existingEntry);
					}
				} else if (collisionMode === "merge") {
					// A real collision only exists when some OTHER entry is CURRENTLY the non-loser
					// this one must defer to — not merely because other entries exist at all. In the
					// normal A-wins/B-loses merge stack, an authoritative re-registration of A itself
					// must stay non-loss: `stack.length > 1` (true because B is also present) wrongly
					// flagged A too, and #currentEntry() then fell back to B — ownership diverging
					// from the composed tree (#372 review).
					//
					// That OTHER entry must ALSO be function-valued — mirroring the fresh-registration
					// isMergeLoss check below. An object/namespace entry is never itself flagged a loss
					// (a container has no single "winner"), so it always reads as non-loss regardless
					// of whether it genuinely still owns the path; api-assignment.mjs's merge resolution
					// falls through to a direct replace when the existing side is a plain object and
					// the incoming side is callable, meaning a function re-registering here can be the
					// actual live winner even with an object entry sitting in the stack. Treating that
					// object entry as "the non-loser to defer to" wrongly re-flagged the function a
					// loser (#372 review, suppressed finding).
					existingEntry.isMergeLoss = ArrayMethods.some(
						stack,
						(entry) => entry !== existingEntry && !entry.isMergeLoss && typeof entry.value === "function"
					);
				}
				// skip/warn/error duplicates are defensive/rejected re-touches, not a fresh
				// collision outcome — never second-guess an already-established isMergeLoss
				// determination here.
			}
			return existingEntry;
		}

		// A genuine LEAF "merge" collision (a different module's function already owns this exact
		// path) must NOT become the new current owner: merge mode's real tree composition
		// (syncWrapper()) keeps the EXISTING function at a colliding leaf, never the incoming one —
		// unlike replace/merge-replace, where the incoming value does win. Scoped to `typeof value
		// === "function"` deliberately: a CONTAINER/namespace merge (value is an object — two
		// modules' namespaces combining their distinct children under the same path) has no single
		// "winner" to prefer — both genuinely coexist as children, so last-registered-wins is the
		// right (existing) behavior there and must be left alone. Tagged on the entry itself,
		// rather than encoded via stack position, so the determination survives an unrelated LATER
		// entry at this path being removed — #currentEntry()/getCurrentOwner() skip a flagged entry
		// regardless of where it sits in the stack (#372: a merge loser must stay suppressed even
		// after whichever module beat it is itself later removed, not resurface as an accidental
		// new "winner"). Excludes an administrative re-touch (see the duplicate branch above for
		// why) since its `collisionMode` label carries no real collision decision either.
		// Also requires the EXISTING owner's value to be a function: api-assignment.mjs's merge
		// resolution only keeps the existing side when it's actually a callable (wrapper vs wrapper,
		// or wrapper vs plain-merged-into-impl) — when the existing value is a plain object/namespace
		// and the incoming value is callable, mergeApiObjects has no way to merge a function INTO a
		// plain object and falls through to a direct replace, so the incoming registration is the
		// actual live winner despite arriving under "merge". Flagging it a loser there made
		// getCurrentOwner()/getCurrentValue() report the stale, no-longer-live object (#372 review).
		// The mirror shape of the function-vs-function case above: api-assignment.mjs's merge
		// resolution only swaps `targetApi[key]` to the incoming value when the EXISTING side is
		// non-callable and the incoming side is callable (`!existingIsCallable && valueIsCallable`).
		// When it's the other way around — the existing owner is already callable and the incoming
		// registration is a plain object/namespace — there is no matching branch to reassign the
		// slot; the generic wrapper-merge loop below it runs instead, which merges the incoming
		// object's children ONTO the existing callable wrapper and leaves that wrapper's own
		// identity (and therefore `targetApi[key]`) untouched. The incoming object is never the live
		// value in that shape, so its registration must be flagged a loss too, or `#currentEntry()`'s
		// "last non-loss wins" scan hands callers the no-longer-live namespace instead of the
		// still-live callable (#372/#373 review, suppressed finding).
		const isMergeLoss =
			source !== REGISTRATION_SOURCE_CONFIRM &&
			Boolean(currentOwner) &&
			currentOwner.moduleID !== moduleID &&
			collisionMode === "merge" &&
			((typeof value === "function" && typeof currentOwner.value === "function") ||
				(typeof currentOwner.value === "function" && typeof value === "object" && value !== null));

		const entry = {
			moduleID,
			source,
			timestamp: this.clock.now(),
			value,
			filePath,
			exportPath,
			memberExportPaths,
			isMergeLoss
		};

		listPush(stack, entry);
		return entry;
	}

	/**
	 * Find the entry a stack's readers should treat as "current": the last entry, in registration
	 * order, that isn't flagged `isMergeLoss`.
	 * @param {Array<{moduleID: string, isMergeLoss?: boolean}>} stack - A path's ownership stack.
	 * @returns {Object|undefined} The current entry, or `undefined` for an empty stack.
	 * @private
	 *
	 * @description
	 * Falls back to the literal last entry when every entry in the stack is flagged — the
	 * first-ever registration at a path is never itself a merge loss, so this only matters for a
	 * stack this invariant has somehow already broken; kept as a defensive floor so a lookup never
	 * returns nothing for a non-empty stack.
	 */
	#currentEntry(stack) {
		// Unreachable: every caller passes a non-empty stack — getCurrentOwner() returns early on an
		// empty/absent stack before calling here, and the removePath() call sites reach here only after
		// their own non-empty guard / the stack.length===0 delete branch. Kept as a defensive floor.
		/* v8 ignore next */
		if (!stack || stack.length === 0) return undefined;
		for (let i = stack.length - 1; i >= 0; i--) {
			if (!stack[i].isMergeLoss) return stack[i];
		}
		return stack[stack.length - 1];
	}

	/**
	 * @param {string} moduleID - Module to unregister.
	 * @returns {UnregisterResult} Removal summary.
	 * @public
	 *
	 * @description
	 * Removes all paths owned by the provided moduleID and reports removals and rollbacks.
	 *
	 * @example
	 * const result = ownership.unregister("module-a");
	 */
	unregister(moduleID) {
		const paths = MapMethods.get(this.moduleToPath, moduleID);
		if (!paths) {
			return { removed: [], rolledBack: [] };
		}

		// Mark this module as unregistered so that late-arriving async registrations
		// (e.g., from in-flight lazy materialization) are silently rejected.
		SetMethods.add(this._unregisteredModules, moduleID);

		const removed = [];
		const rolledBack = [];

		for (const apiPath of setValues(paths)) {
			const result = this.removePath(apiPath, moduleID);

			if (result.action === "delete") {
				listPush(removed, apiPath);
			} else if (result.action === "restore") {
				listPush(rolledBack, {
					apiPath,
					restoredTo: result.restoreModuleId
				});
			}
		}

		MapMethods.delete(this.moduleToPath, moduleID);
		MapMethods.delete(this.moduleEndpoints, moduleID);
		MapMethods.delete(this.moduleMounts, moduleID);
		MapMethods.delete(this.placementModes, moduleID);

		return { removed, rolledBack };
	}

	/**
	 * Block a moduleID from any further path registration without removing its current paths.
	 *
	 * @param {string} moduleID - Module to block from re-registration.
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * Sets the same async-race guard {@link OwnershipManager#unregister} sets, but standalone: the scoped
	 * `remove(moduleID, apiPath)` path detaches nodes one at a time via {@link OwnershipManager#removePath}
	 * and never calls `unregister`. Tearing down a lazy node materializes it, and that materialization can
	 * register previously-unregistered descendants (a lazy submodule's leaves) AFTER the removal's target
	 * list was computed — which, on a reload replay, leak back and resurrect the removed subtree. When a
	 * scoped removal empties a module, call this BEFORE the walk so those late registrations are rejected
	 * (register() returns null for a module in this set). Cleared on the next {@link OwnershipManager#clear}
	 * (reload). Only for a full removal — a partial one keeps sibling paths that must still materialize.
	 *
	 * Because this is called only when the module is fully gone, it also drops its {@link OwnershipManager#moduleEndpoints}
	 * entry — `removePath()` deletes the emptied `moduleToPath` set but not the endpoint, and `unregister()`
	 * (the moduleID-only remove's analog) does delete it, so the scoped full-removal must too or a stale
	 * endpoint leaks until the next reload.
	 *
	 * @example
	 * ownership.markUnregistered("plugins-core");
	 */
	markUnregistered(moduleID) {
		SetMethods.add(this._unregisteredModules, moduleID);
		MapMethods.delete(this.moduleEndpoints, moduleID);
		MapMethods.delete(this.moduleMounts, moduleID);
		MapMethods.delete(this.placementModes, moduleID);
	}

	/**
	 * Re-arm a moduleID for registration after a prior removal, for a deliberate new `api.add()`.
	 * @param {string} moduleID - Module identifier about to be (re-)registered.
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * `register()`'s guard against `_unregisteredModules` (see its own doc comment) is meant to
	 * reject a STALE, late-arriving registration from a removed module's own in-flight lazy
	 * materialization — not to permanently block that moduleID from ever registering again. Without
	 * this call, a deliberate `api.add()` reusing a moduleID that was previously removed had every
	 * one of its registrations silently dropped (`register()` returns `null` unconditionally),
	 * losing ownership tracking entirely for content that WAS actually assigned onto the live tree —
	 * confirmed via a remove-then-re-add-same-moduleID repro (#372 review, suppressed finding on
	 * ownership.mjs's merge-loss correction). Called at the very start of `addApiComponent()`, before
	 * any registration for this build, so a genuinely new add's own registrations are never rejected;
	 * a stale materialization from the module's PREVIOUS lifetime that fires after this point is a
	 * separate, pre-existing race this call does not change the risk profile of.
	 *
	 * @example
	 * ownership.clearUnregistered("plugins-core");
	 */
	clearUnregistered(moduleID) {
		SetMethods.delete(this._unregisteredModules, moduleID);
	}

	/**
	 * @param {string} apiPath - API path to modify.
	 * @param {string|null} [moduleID=null] - Module to remove (defaults to current owner).
	 * @returns {{ action: "delete"|"none"|"restore", removedModuleId: string|null,
	 * restoreModuleId: string|null }} Action taken for the path.
	 * @public
	 *
	 * @description
	 * Removes a module owner from a specific API path. If the current owner is removed and
	 * previous owners exist, the path is restored to the previous owner.
	 *
	 * @example
	 * const result = ownership.removePath("plugins.tools", "module-a");
	 */
	removePath(apiPath, moduleID = null) {
		const stack = MapMethods.get(this.pathToModule, apiPath);
		if (!stack) {
			return { action: "none", removedModuleId: null, restoreModuleId: null };
		}

		// Find and remove entry — an explicit moduleID targets it directly; the default (remove
		// "current") must resolve the same skip-merge-loss entry getCurrentOwner() would, not just
		// the literal last element (#372: a merge loser can sit anywhere in the stack).
		const index = moduleID
			? ArrayMethods.findIndex(stack, (entry) => entry.moduleID === moduleID)
			: ArrayMethods.indexOf(stack, this.#currentEntry(stack));
		if (index === -1) {
			return { action: "none", removedModuleId: null, restoreModuleId: null };
		}
		const unpacked1 = listSplice(stack, index, 1),
			removed = unpacked1[0];
		const removedModuleId = removed.moduleID;
		if (removedModuleId && MapMethods.has(this.moduleToPath, removedModuleId)) {
			const pathSet = MapMethods.get(this.moduleToPath, removedModuleId);
			SetMethods.delete(pathSet, apiPath);
			if (SetMethods.size(pathSet) === 0) {
				MapMethods.delete(this.moduleToPath, removedModuleId);
			}
		}

		// If stack empty, delete path entirely
		if (stack.length === 0) {
			MapMethods.delete(this.pathToModule, apiPath);
			return { action: "delete", removedModuleId, restoreModuleId: null };
		}

		// Otherwise, restore to previous owner — skip a stale merge-loss entry so a module that
		// lost a collision earlier doesn't accidentally resurface as "current" just because
		// whichever module beat it is the one being removed now (#372).
		const previous = this.#currentEntry(stack);
		return {
			action: "restore",
			removedModuleId,
			restoreModuleId: previous.moduleID
		};
	}

	/**
	 * Drop every module's entries for the paths strictly below `apiPath` (#799).
	 * @param {string} apiPath - The path whose subtree left the api.
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * `remove(apiPath)` takes the whole live subtree off the api, whoever owns each node, while
	 * {@link OwnershipManager#removePath} drops only the entry at the path itself. Without this, the entries below
	 * stay recorded: a later add at the path stacks over them, and removing that add reverts its members to the
	 * removed module's values instead of removing them.
	 *
	 * @example
	 * ownership.removePath("extra", "base");
	 * ownership.removeSubtree("extra"); // "extra.ping" is no longer anyone's
	 */
	removeSubtree(apiPath) {
		const prefix = `${apiPath}.`;
		for (let ofIndex = 0, ofList = mapEntriesToArray(this.pathToModule); ofIndex < ofList.length; ofIndex++) {
			const ofEntry = ofList[ofIndex],
				path = ofEntry[0],
				stack = ofEntry[1];
			if (!StringMethods.startsWith(path, prefix)) continue;
			for (let ofIndex = 0, ofList = stack; ofIndex < ofList.length; ofIndex++) {
				const entry = ofList[ofIndex];
				const pathSet = MapMethods.get(this.moduleToPath, entry.moduleID);
				if (!pathSet) continue;
				SetMethods.delete(pathSet, path);
				if (SetMethods.size(pathSet) === 0) MapMethods.delete(this.moduleToPath, entry.moduleID);
			}
			MapMethods.delete(this.pathToModule, path);
		}
	}

	/**
	 * Get current owner of API path
	 * @param {string} apiPath - API path to check
	 * @returns {Object|null} Current owner entry or null
	 * @public
	 */
	getCurrentOwner(apiPath) {
		const stack = MapMethods.get(this.pathToModule, apiPath);
		if (!stack || stack.length === 0) return null;
		// The `?? null` is unreachable. #currentEntry() returns undefined in two cases: an empty/absent
		// stack (excluded by the guard above) OR a non-empty stack whose every entry is a merge-loss
		// (the loop finds no non-loss entry). The latter never occurs: register() flags an entry
		// isMergeLoss only when a non-loss currentOwner already exists (see its `Boolean(currentOwner)`
		// condition), so a stack always retains at least one non-loss owner, and removePath() promotes
		// the next owner rather than leaving an all-loss stack — so for a non-empty stack #currentEntry
		// always returns an entry.
		/* v8 ignore next */
		return this.#currentEntry(stack) ?? null;
	}

	/**
	 * Get current value for API path
	 * @param {string} apiPath - API path to check
	 * @returns {*} Current value or undefined
	 * @public
	 */
	getCurrentValue(apiPath) {
		const owner = this.getCurrentOwner(apiPath);
		if (!owner) return undefined;

		const value = owner.value;

		// If value is a wrapper proxy, unwrap it to get the raw implementation.
		// Use resolveWrapper (checks the internal _proxyRegistry WeakMap directly) rather than
		// `"____impl" in value`, which goes through the hasTrap - and ____impl is now blocked there.
		const rawWrapper = resolveWrapper(value);
		if (rawWrapper) {
			return rawWrapper.____impl;
		}

		return value;
	}

	/**
	 * Get all paths owned by module
	 * @param {string} moduleID - Module to query
	 * @returns {Array<string>} Array of API paths
	 * @public
	 */
	getModulePaths(moduleID) {
		return setToArray(MapMethods.get(this.moduleToPath, moduleID));
	}

	/**
	 * Get ownership history for path
	 * @param {string} apiPath - API path to query
	 * @returns {Array<Object>} Ownership history stack
	 * @public
	 */
	getPathHistory(apiPath) {
		return MapMethods.get(this.pathToModule, apiPath) || [];
	}

	/**
	 * Check if module owns path
	 * @param {string} moduleID - Module to check
	 * @param {string} apiPath - API path to check
	 * @returns {boolean} True if module owns path
	 * @public
	 */
	ownsPath(moduleID, apiPath) {
		const owner = this.getCurrentOwner(apiPath);
		return owner && owner.moduleID === moduleID;
	}

	/**
	 * Get diagnostic info about ownership
	 * @returns {Object} Diagnostic information
	 * @public
	 */
	getDiagnostics() {
		return {
			totalModules: MapMethods.size(this.moduleToPath),
			totalPaths: MapMethods.size(this.pathToModule),
			modules: mapList(mapEntriesToArray(this.moduleToPath), (entry2) => {
				const id = entry2[0],
					paths = entry2[1];
				return {
					moduleID: id,
					pathCount: SetMethods.size(paths)
				};
			}),
			conflictedPaths: mapList(
				filterList(mapEntriesToArray(this.pathToModule), (entry3) => {
					const _ = entry3[0],
						stack = entry3[1];
					return stack.length > 1;
				}),
				(entry4) => {
					const path = entry4[0],
						stack = entry4[1];
					return {
						apiPath: path,
						ownerStack: mapList(stack, (e) => e.moduleID)
					};
				}
			)
		};
	}

	/**
	 * Get ownership info for a specific API path
	 * @param {string} apiPath - API path to check
	 * @returns {Set<string>|null} Set of moduleIDs that own this path, or null if path not found
	 * @public
	 */
	getPathOwnership(apiPath) {
		const stack = MapMethods.get(this.pathToModule, apiPath);
		if (!stack || stack.length === 0) {
			return null;
		}
		return setFrom(mapList(stack, (entry) => entry.moduleID));
	}

	/**
	 * Recursively register API subtree with ownership
	 * @param {object} api - API object or subtree
	 * @param {string} moduleID - Module identifier (owner)
	 * @param {string} path - Current API path
	 * @param {object} [options] - Walk options.
	 * @param {string} [options.collisionMode="merge"] - The collision mode the subtree was placed on the
	 *   live api under. `"replace"`/`"merge-replace"` make `moduleID` the current owner of every path the
	 *   walk reaches (#524); any other value only confirms the paths without changing their order.
	 * @param {WeakSet} [options.visited] - Visited objects (prevents circular refs)
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * Registers entire API subtree structure with ownership manager.
	 * Used during load, reload, and api.add to establish ownership relationships.
	 *
	 * Under `"replace"`/`"merge-replace"` the subtree's content is what is live at each of its paths, so the
	 * walk also claims them: the module's entry is un-flagged as a merge loss and moved to the top of the
	 * path's stack. That overrides registrations made while the add was in progress that do not reflect the
	 * placement — in lazy mode the replaced module's wrappers are materialized during the collision and
	 * register after the incoming module's own construction-time entries.
	 *
	 * @example
	 * ownership.registerSubtree(api, "base_abc123", "");
	 *
	 * @example
	 * ownership.registerSubtree(apiToMerge, "shadow", "launcher.session", { collisionMode: "replace" });
	 */
	registerSubtree(api, moduleID, path, { collisionMode = "merge", visited = new WeakSet() } = {}) {
		if (!api || typeof api !== "object") return;

		// Prevent infinite recursion on circular references
		if (WeakSetMethods.has(visited, api)) {
			return;
		}
		WeakSetMethods.add(visited, api);

		const claims = collisionMode === "replace" || collisionMode === "merge-replace";

		// Register this level if path exists
		if (path) {
			this.#confirm(moduleID, path, api, claims);
		}

		// Recursively register children. Reads go through the proxy (its get trap produces the values
		// callers see) EXCEPT for a child that is an unmaterialized lazy wrapper: reading that one
		// through the trap returns the same stored proxy but also starts a fire-and-forget
		// `___materialize()`, which left a freshly added lazy mount mid-materialization when
		// `api.slothlet.api.add()` resolved and made what add() returned depend on timing (#462). Such a
		// child registers its own descendants when it materializes.
		const inner = resolveWrapper(api);
		const entries = inner ? mapList(Objects.keys(api), (key) => [key, readWithoutMaterializing(api, inner, key)]) : Objects.entries(api);
		for (let ofIndex = 0, ofList = entries; ofIndex < ofList.length; ofIndex++) {
			const ofEntry = ofList[ofIndex],
				key = ofEntry[0],
				value = ofEntry[1];
			// Skip internal properties
			const skipProps = ["___materialize", "____impl", "____slothletInternal"];
			if (ArrayMethods.includes(skipProps, key)) {
				continue;
			}

			const childPath = path ? `${path}.${key}` : key;
			if (typeof value === "function" || (value && typeof value === "object")) {
				this.#confirm(moduleID, childPath, value, claims);

				// Recurse for objects (not functions with properties)
				if (typeof value === "object" && !Arrays.isArray(value)) {
					this.registerSubtree(value, moduleID, childPath, { collisionMode, visited });
				}
			}
		}
	}

	/**
	 * One {@link OwnershipManager#registerSubtree} registration, optionally claiming the path (#524).
	 * @param {string} moduleID - Module identifier (owner).
	 * @param {string} apiPath - API path to register.
	 * @param {*} value - The value at the path.
	 * @param {boolean} claim - Whether `moduleID`'s content is what is live at the path, so its entry must
	 *   become the path's current owner.
	 * @returns {void}
	 * @private
	 */
	#confirm(moduleID, apiPath, value, claim) {
		const entry = this.register({
			moduleID,
			apiPath,
			value,
			source: REGISTRATION_SOURCE_CONFIRM,
			collisionMode: "merge",
			filePath: null
		});
		if (!claim || !entry) return;
		entry.isMergeLoss = false;
		const stack = MapMethods.get(this.pathToModule, apiPath);
		const index = ArrayMethods.indexOf(stack, entry);
		if (index !== stack.length - 1) {
			listSplice(stack, index, 1);
			listPush(stack, entry);
		}
	}

	/**
	 * Snapshot the entries moduleID currently owns, keyed by apiPath, for later restoration
	 * @param {string} moduleID - Module identifier to snapshot.
	 * @returns {Map<string, {value: *, filePath: (string|null), exportPath: (string[]|null), memberExportPaths: (Object|null), source: string, isMergeLoss: boolean}>}
	 *   One entry per apiPath the module currently owns, capturing exactly the fields a duplicate
	 *   registration can overwrite.
	 * @public
	 *
	 * @description
	 * Call this BEFORE a candidate build's construction (buildAPI) runs, so a later revert can tell
	 * a path moduleID genuinely already owned (whose entry must be restored, not deleted) from one
	 * the candidate build's own speculative registration fabricated (which must be deleted outright).
	 *
	 * @example
	 * const snapshot = ownership.snapshotModuleEntries("same-mod");
	 */
	snapshotModuleEntries(moduleID) {
		const snapshot = new Map();
		for (const path of setValues(MapMethods.get(this.moduleToPath, moduleID))) {
			const entry =
				MapMethods.get(this.pathToModule, path) == null
					? undefined
					: ArrayMethods.find(MapMethods.get(this.pathToModule, path), (candidate) => candidate.moduleID === moduleID);
			// `entry` is always found here: a path present in moduleToPath[moduleID] always has a matching
			// pathToModule entry, because register(), removePath() and unregister() update both maps in
			// lockstep. The `!entry` arm is a defensive floor against a map desync no public path produces
			// (reproducing it would require hand-corrupting the internal maps — a tautology, not a test).
			/* v8 ignore next */
			if (!entry) continue;
			MapMethods.set(snapshot, path, {
				value: entry.value,
				filePath: entry.filePath,
				exportPath: entry.exportPath ?? null,
				memberExportPaths: entry.memberExportPaths ?? null,
				source: entry.source,
				isMergeLoss: entry.isMergeLoss
			});
		}
		return snapshot;
	}

	/**
	 * Restore a single entry's value/filePath/source/isMergeLoss, undoing a later registration's
	 * overwrite without changing its position in the ownership stack
	 * @param {string} moduleID - Module identifier.
	 * @param {string} apiPath - API path whose entry to restore.
	 * @param {{value: *, filePath: (string|null), exportPath?: (string[]|null), memberExportPaths?: (Object|null), source: string, isMergeLoss: boolean}} snapshot -
	 *   Prior field values, from {@link OwnershipManager#snapshotModuleEntries}.
	 * @returns {void}
	 * @public
	 *
	 * @example
	 * ownership.restoreEntry("same-mod", "thing", snapshot.get("thing"));
	 */
	restoreEntry(moduleID, apiPath, snapshot) {
		const entry =
			MapMethods.get(this.pathToModule, apiPath) == null
				? undefined
				: ArrayMethods.find(MapMethods.get(this.pathToModule, apiPath), (candidate) => candidate.moduleID === moduleID);
		if (!entry) return;
		entry.value = snapshot.value;
		entry.filePath = snapshot.filePath;
		entry.exportPath = snapshot.exportPath ?? null;
		entry.memberExportPaths = snapshot.memberExportPaths ?? null;
		entry.source = snapshot.source;
		entry.isMergeLoss = snapshot.isMergeLoss;
	}

	/**
	 * Snapshot exactly one (apiPath, moduleID) pair's current entry — the single-path analog of
	 * {@link OwnershipManager#snapshotModuleEntries}, for an internal candidate's own revert.
	 * @param {string} apiPath - Full api path the candidate is about to (re-)contribute to.
	 * @param {string} moduleID - Module identifier making the contribution.
	 * @returns {{value: *, filePath: (string|null), exportPath: (string[]|null), memberExportPaths: (Object|null), source: string, isMergeLoss: boolean}|undefined}
	 *   The prior entry's snapshot, or `undefined` if none exists yet.
	 * @public
	 *
	 * @description
	 * `ModesProcessor`'s internal collision branches each construct a `UnifiedWrapper` (firing
	 * `impl:created` unconditionally) BEFORE `assignToApiPath()`'s real, per-call-aware collision
	 * decision is known. The generic `impl:created` subscriber (`src/slothlet.mjs`) reacts to that
	 * same construction and registers ownership using the INSTANCE's configured default mode,
	 * clamped to `"replace"`/`"merge-replace"` only (never `"skip"`/`"warn"`/`"error"`, exactly like
	 * `ModesProcessor#resolveOwnershipCollisionMode` clamps its own authoritative registration) —
	 * so that call always succeeds, regardless of what the real per-call mode later turns out to
	 * be. A `skip`/`warn`-rejected (or thrown) internal candidate therefore leaves a real,
	 * unrevertable ownership entry behind unless the caller snapshots-before/restores-or-drops-after
	 * around its own construction+assignment attempt (#372/#373 review, suppressed finding).
	 *
	 * @example
	 * const priorEntry = ownership.snapshotPathEntry("thing.initialize", moduleID);
	 * // ...wrapper construction + assignToApiPath() run...
	 * if (!assigned) {
	 *   if (priorEntry) ownership.restoreEntry(moduleID, "thing.initialize", priorEntry);
	 *   else ownership.removePath("thing.initialize", moduleID);
	 * }
	 */
	snapshotPathEntry(apiPath, moduleID) {
		const entry =
			MapMethods.get(this.pathToModule, apiPath) == null
				? undefined
				: ArrayMethods.find(MapMethods.get(this.pathToModule, apiPath), (candidate) => candidate.moduleID === moduleID);
		if (!entry) return undefined;
		return {
			value: entry.value,
			filePath: entry.filePath,
			exportPath: entry.exportPath ?? null,
			memberExportPaths: entry.memberExportPaths ?? null,
			source: entry.source,
			isMergeLoss: entry.isMergeLoss
		};
	}

	/**
	 * Revert a speculative API subtree's ownership registrations
	 * @param {object} api - API object or subtree (same shape registerSubtree() would have walked)
	 * @param {string} moduleID - Module identifier whose speculative registrations to revert
	 * @param {string} path - Current API path
	 * @param {Map<string, {value: *, filePath: (string|null), source: string}>} priorEntries -
	 *   Snapshot from {@link OwnershipManager#snapshotModuleEntries}, taken before the candidate
	 *   build ran, of what moduleID already legitimately owned.
	 * @param {WeakSet} [visited] - Visited objects (prevents circular refs)
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * Mirrors registerSubtree()'s traversal. A candidate build's wrapper construction fires
	 * impl:created before the caller's own collision decision runs (buildAPI's apiPathPrefix
	 * already targets the final mount path), so the framework's generic impl:created subscriber
	 * (slothlet.mjs) auto-registers ownership for it — clamped to "merge" so it never throws —
	 * even when that build is a hot-reload api.add() candidate still pending its own
	 * setValueAtPath check. When that check then rejects the assignment under skip/warn, the live
	 * api tree is untouched but the speculative registration is not (#366 review). At each level:
	 * if `priorEntries` has this exact path, moduleID already owned it before this build — restore
	 * its value/filePath/source (register()'s duplicate-entry path overwrote them unconditionally,
	 * even for what turned out to be a rejected candidate), rather than deleting a genuine,
	 * pre-existing registration. Otherwise the path is purely speculative — remove it outright.
	 *
	 * @example
	 * const priorEntries = ownership.snapshotModuleEntries("same-mod");
	 * // ...buildAPI runs, candidate is rejected...
	 * ownership.revertSpeculativeSubtree(apiToMerge, "same-mod", "thing", priorEntries);
	 */
	revertSpeculativeSubtree(api, moduleID, path, priorEntries, visited = new WeakSet()) {
		// A callable leaf (a function-typed wrapper proxy) is a common top-level shape here — unlike
		// registerSubtree()'s callers, which only ever pass its own already-`typeof === "object"`
		// children recursively, addApiComponent's cleanup call passes `apiToMerge` directly, which is
		// frequently a Rule-13-hoisted callable. Excluding functions here would silently no-op the
		// exact case this method exists for.
		if (!api || (typeof api !== "object" && typeof api !== "function")) return;

		// Prevent infinite recursion on circular references
		if (WeakSetMethods.has(visited, api)) {
			return;
		}
		WeakSetMethods.add(visited, api);

		const revert = (revertPath) => {
			const prior = MapMethods.get(priorEntries, revertPath);
			if (prior) {
				this.restoreEntry(moduleID, revertPath, prior);
			} else {
				this.removePath(revertPath, moduleID);
			}
		};

		// Revert this level if path exists
		if (path) {
			revert(path);
		}

		// Recursively revert children
		for (let ofIndex = 0, ofList = Objects.entries(api); ofIndex < ofList.length; ofIndex++) {
			const ofEntry = ofList[ofIndex],
				key = ofEntry[0],
				value = ofEntry[1];
			// Skip internal properties
			const skipProps = ["___materialize", "____impl", "____slothletInternal"];
			if (ArrayMethods.includes(skipProps, key)) {
				continue;
			}

			const childPath = path ? `${path}.${key}` : key;
			if (typeof value === "function" || (value && typeof value === "object")) {
				revert(childPath);

				// Recurse for objects (not functions with properties)
				if (typeof value === "object" && !Arrays.isArray(value)) {
					this.revertSpeculativeSubtree(value, moduleID, childPath, priorEntries, visited);
				}
			}
		}
	}

	/**
	 * Revert every speculative registration currently on record for a module, driven by the
	 * module's own current ownership state rather than a candidate api-tree reference
	 * @param {string} moduleID - Module identifier whose speculative state to revert.
	 * @param {Map<string, {value: *, filePath: (string|null), source: string, isMergeLoss: boolean}>} priorEntries -
	 *   Snapshot from {@link OwnershipManager#snapshotModuleEntries}, taken before the candidate
	 *   build ran.
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * {@link OwnershipManager#revertSpeculativeSubtree} needs a concrete api-tree value to walk —
	 * fine when the caller has one (a rejected `skip`/`warn` candidate whose `apiToMerge` was still
	 * built successfully). It has nothing to walk when `buildAPI()` or `setValueAtPath()` itself
	 * THROWS (a genuine `collisionMode: "error"` collision, or any other failure) partway through —
	 * the candidate's speculative registrations still exist (whatever fired `impl:created` before
	 * the throw), but there may be no valid `newApi`/`apiToMerge` reference left to walk. This reads
	 * `moduleToPath.get(moduleID)` directly instead: whatever paths this moduleID currently owns,
	 * restore the ones already present in `priorEntries` and delete the rest — the same outcome as
	 * `revertSpeculativeSubtree`, without needing the tree shape at all (#372 review).
	 *
	 * @example
	 * const priorEntries = ownership.snapshotModuleEntries("same-mod");
	 * try {
	 *   // ...buildAPI/setValueAtPath run and throw...
	 * } catch (err) {
	 *   ownership.revertSpeculativeState("same-mod", priorEntries);
	 *   throw err;
	 * }
	 */
	revertSpeculativeState(moduleID, priorEntries) {
		for (let ofIndex = 0, ofList = setToArray(MapMethods.get(this.moduleToPath, moduleID)); ofIndex < ofList.length; ofIndex++) {
			const path = ofList[ofIndex];
			const prior = MapMethods.get(priorEntries, path);
			if (prior) {
				this.restoreEntry(moduleID, path, prior);
			} else {
				this.removePath(path, moduleID);
			}
		}
	}

	/**
	 * Snapshot the ownership stacks at and under an api path, before a reload rebuilds a module there.
	 * @param {string} apiPath - The reloaded module's endpoint ("" or "." for the root).
	 * @returns {Map<string, Array<{entry: Object, isMergeLoss: boolean}>>} Each path's stack, in order,
	 *   with every entry's merge-loss flag as it was.
	 * @public
	 *
	 * @description
	 * Rebuilding a module constructs its wrappers afresh, and each construction registers the module
	 * again under the instance's collision mode — which, under `replace`/`merge-replace`, moves it back
	 * on top of paths another module had since overridden. The reload itself keeps those paths'
	 * live values (#525), so {@link OwnershipManager#restoreStacks} puts their stacks back in order.
	 */
	snapshotStacks(apiPath) {
		const prefix = apiPath === "." ? "" : apiPath;
		const snapshot = new Map();
		for (const ofEntry of mapEntries(this.pathToModule)) {
			const path = ofEntry[0],
				stack = ofEntry[1];
			if (prefix === "" || path === prefix || StringMethods.startsWith(path, `${prefix}.`)) {
				MapMethods.set(
					snapshot,
					path,
					mapList(stack, (entry) => ({ entry, isMergeLoss: entry.isMergeLoss }))
				);
			}
		}
		return snapshot;
	}

	/**
	 * The module that owned a path in a {@link OwnershipManager#snapshotStacks} snapshot.
	 * @param {Array<{entry: Object, isMergeLoss: boolean}>|undefined} prior - One path's snapshotted stack.
	 * @returns {string|undefined} The owning moduleID, or undefined when the path had no stack.
	 * @public
	 */
	snapshotOwner(prior) {
		if (!prior || prior.length === 0) return undefined;
		for (let i = prior.length - 1; i >= 0; i--) {
			if (!prior[i].isMergeLoss) return prior[i].entry.moduleID;
		}
		// Defensive floor, as in #currentEntry: register() never leaves a stack all merge-losses.
		/* v8 ignore next */
		return prior[prior.length - 1].entry.moduleID;
	}

	/**
	 * Put back the ownership order a reload's rebuild disturbed, on every path the reloaded modules did
	 * not own before the reload (#525).
	 * @param {Map<string, Array<{entry: Object, isMergeLoss: boolean}>>} snapshot - From
	 *   {@link OwnershipManager#snapshotStacks}, taken before the rebuild.
	 * @param {Set<string>} moduleIDs - The modules rebuilt in this reload cycle.
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * On a path another module owned, that module stays the owner: the entries that were on the stack
	 * return to their prior order and merge-loss flags (keeping any value a rebuild refreshed, so a later
	 * remove of the owner reverts to the reloaded module's current code), and an entry the rebuild added
	 * goes beneath them. Paths the reloaded modules owned are left as the rebuild registered them.
	 */
	restoreStacks(snapshot, moduleIDs) {
		for (const ofEntry of mapEntries(snapshot)) {
			const path = ofEntry[0],
				prior = ofEntry[1];
			if (SetMethods.has(moduleIDs, this.snapshotOwner(prior))) continue;
			const stack = MapMethods.get(this.pathToModule, path);
			if (!stack) continue;
			const kept = filterList(prior, ({ entry }) => ArrayMethods.includes(stack, entry));
			const keptEntries = setFrom(mapList(kept, ({ entry }) => entry));
			const added = filterList(stack, (entry) => !SetMethods.has(keptEntries, entry));
			for (let ofIndex = 0, ofList = kept; ofIndex < ofList.length; ofIndex++) {
				const { entry, isMergeLoss } = ofList[ofIndex];
				entry.isMergeLoss = isMergeLoss;
			}
			Reflect.apply(
				ArrayMethods.splice,
				undefined,
				concatLists(
					[stack],
					concatLists(
						[0, stack.length],
						added,
						mapList(kept, ({ entry }) => entry)
					)
				)
			);
		}
	}

	/**
	 * Clear all ownership data
	 * @public
	 */
	clear() {
		MapMethods.clear(this.moduleToPath);
		MapMethods.clear(this.pathToModule);
		SetMethods.clear(this._unregisteredModules);
		MapMethods.clear(this.moduleEndpoints);
		MapMethods.clear(this.moduleMounts);
		MapMethods.clear(this.placementModes);
		MapMethods.clear(this.exportIndex);
	}

	/**
	 * Export ownership state for preservation during reload
	 * @returns {Object} Serializable ownership state
	 * @public
	 */
	exportState() {
		return {
			moduleToPath: mapList(mapEntriesToArray(this.moduleToPath), (entry5) => {
				const id = entry5[0],
					paths = entry5[1];
				return [id, setToArray(paths)];
			}),
			pathToModule: mapEntriesToArray(this.pathToModule)
		};
	}

	/**
	 * Import ownership state from exported data
	 * @param {Object} state - Previously exported state
	 * @public
	 */
	importState(state) {
		// Clear current state
		this.clear();

		// Restore moduleToPath
		// `state` is what exportState() made: arrays of [key, value] entries.
		for (let i = 0; i < state.moduleToPath.length; i++) {
			MapMethods.set(this.moduleToPath, state.moduleToPath[i][0], setFrom(state.moduleToPath[i][1]));
		}

		// Restore pathToModule
		for (let i = 0; i < state.pathToModule.length; i++) {
			MapMethods.set(this.pathToModule, state.pathToModule[i][0], state.pathToModule[i][1]);
		}
	}
}
