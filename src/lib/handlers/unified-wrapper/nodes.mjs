/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/nodes.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T00:00:00-08:00 (1795593600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Nodes layer of the wrapper: node identity, versions and reports, module objects and what a module made, instance-class nodes and prototype handles.
 *
 * Upward services (from layers above this one, reached through the method table): FRAMEWORK_WRITES (rules),
 *  HOST_READER (views), PROTOTYPE_HANDLE_READER (views), PROTOTYPE_PATHS (views), SELF_MEMBER_VIEWS (views),
 *  SELF_VIEW_NODES (views), SELF_VIEW_READERS (views), STAND_INS (views), capturedViewChildren (views),
 *  capturedViewTargets (views), defineAdoptedAccessor (materialize), emitterOwnPrototype (views),
 *  enforceNodeReportRead (rules), frameworkWrite (rules), guardOn (membrane), hasOwn (views), holderFilePath
 *  (views), implDefault (rules), knownPrototype (membrane), memberHoldsCode (rules), recordedPrototype (run),
 *  resolveRestartTarget (rules), retireChanges (waiting), searchBudget (membrane), searchDepth (membrane),
 *  selfMemberView (views), selfModuleReader (views), selfView (views), standInNode (waiting).
 * @module @cldmv/slothlet/handlers/unified-wrapper/nodes
 * @internal
 */

import { util, EventEmitter } from "#helpers/platform";
import { copySourceOf, layerMethodOriginal, layerUnderlying } from "#helpers/composition";
import { isFrameworkReservedKey } from "#helpers/reserved-keys";
import {
	ArrayMethods,
	Arrays,
	Boolean,
	concatLists,
	copyList,
	filterList,
	generatorSteps,
	listPush,
	Map,
	mapEntries,
	mapList,
	MapMethods,
	Objects,
	PrototypeFunctions,
	Reflect,
	Set,
	setFrom,
	SetMethods,
	setToArray,
	splitText,
	String,
	StringMethods,
	Symbol,
	WeakMap,
	WeakMapMethods,
	WeakRefMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";

import { ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 */
let trustedRootOwn,
	hasOwn,
	FRAMEWORK_WRITES,
	frameworkWrite,
	SELF_VIEW_NODES,
	SELF_VIEW_READERS,
	HOST_READER,
	PROTOTYPE_HANDLE_READER,
	selfModuleReader,
	SELF_MEMBER_VIEWS,
	isIntrinsic,
	inherits,
	NODE_VALUE_OFS,
	selfMemberView,
	holderFilePath,
	selfView,
	STAND_INS,
	enforceNodeReportRead,
	defineAdoptedAccessor,
	ownsPrototype,
	INTRINSICS,
	isSharedValue,
	isModuleProxy,
	isBuiltinFunction,
	memberHoldsCode,
	searchDepth,
	searchBudget,
	PROTOTYPE_PATHS,
	knownPrototype,
	guardOn,
	emitterOwnPrototype,
	isHeldPrimitive,
	implDefault,
	capturedViewChildren,
	capturedViewTargets,
	isRestartStale,
	standInNode,
	isClassInstance,
	resolveWrapper,
	registeredWrapper,
	isWrapper;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/**
 * The `valueOf` a callable node answers (#630): `Object.prototype.valueOf` on whatever it is called on, as a function's
 * own `valueOf()` answers the function, and the node when it is called detached.
 * @param {Function} node - The node's proxy.
 * @returns {Function} The method.
 * @private
 */
function valueOfFor(node) {
	let method = WeakMapMethods.get(NODE_VALUE_OF_BY_NODE, node);
	if (method) return method;
	method = function valueOf() {
		return this === undefined || this === null ? node : Reflect.apply(PrototypeFunctions.Object.valueOf, this, []);
	};
	WeakSetMethods.add(NODE_VALUE_OFS, method);
	WeakMapMethods.set(NODE_VALUE_OF_BY_NODE, node, method);
	return method;
}

/** The method {@link valueOfFor} made for each node, made once per node. @type {WeakMap<Function, Function>} @private */
const NODE_VALUE_OF_BY_NODE = new WeakMap();

/**
 * The module's own accessor a node holds for a member (one it adopted from the module's object), for a full-isolation
 * run's view to run with the view as `this`: what the getter reads and the setter writes is then what the run reads
 * and writes (see `makeRunSelf` in `handlers/unified-wrapper/run`). Null for any other member, a forward the node keeps to a
 * live value among them.
 * @param {*} node - The node, as the view reads through it.
 * @param {string|symbol} prop - The member.
 * @returns {{wrapper: object, get: (Function|undefined), set: (Function|undefined)}|null} The accessor.
 * @internal
 */
function viewAccessor(node, prop) {
	if (typeof prop !== "string") return null;
	const wrapper = nodeWrapperOf(node);
	if (wrapper === null || isFrameworkReservedKey(prop)) return null;
	const held = Reflect.getOwnPropertyDescriptor(wrapper, prop);
	if (held === undefined || "value" in held) return null;
	const original = originalAccessor(held);
	if (original.get === held.get && original.set === held.set) return null;
	return { wrapper, get: original.get, set: original.set };
}

/**
 * The wrapper behind a node as a reader is handed it (see {@link isApiNode}), or null.
 * @param {*} value - The node.
 * @returns {object|null} The wrapper.
 * @internal
 */
function nodeWrapperOf(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return null;
	const node = WeakMapMethods.get(SELF_VIEW_NODES, value) ?? value;
	return resolveWrapper(node) ?? WeakMapMethods.get(capturedViewChildren, node) ?? null;
}

/**
 * Each node's proxy target, by its wrapper: what tells whether the node was closed, read without running its traps.
 * @type {WeakMap<object, object>}
 * @private
 */
const NODE_TARGETS = new WeakMap();

/**
 * Whether a node takes new members now: its proxy target is open. Read without running any trap.
 * @param {*} node - The node's wrapper, or the node as read.
 * @returns {boolean} True while it does (or when it cannot be told).
 * @internal
 */
function nodeOpen(node) {
	let target = WeakMapMethods.get(NODE_TARGETS, node);
	if (target === undefined) {
		const wrapper = nodeWrapperOf(node);
		target = wrapper === null ? undefined : WeakMapMethods.get(NODE_TARGETS, wrapper);
	}
	return target === undefined || Reflect.isExtensible(target);
}

/**
 * Whether two lookups (see {@link inheritedLookup}) answer the same: the same member found, or the same end.
 * @param {{from: (object|null), described: (object|undefined)}} a - One.
 * @param {{from: (object|null), described: (object|undefined)}|undefined} b - The other.
 * @returns {boolean} True when they do.
 * @private
 */
function sameLookup(a, b) {
	if (b === undefined) return false;
	if (a.described === undefined || b.described === undefined) return a.described === b.described && a.from === b.from;
	const x = a.described;
	const y = b.described;
	return Objects.is(x.value, y.value) && x.get === y.get && x.set === y.set && "value" in x === "value" in y;
}

/**
 * The node a value read out of the api stands for: through any per-reader view (`self`'s or a captured one) to the
 * node itself, and from a node a restart replaced to the live one at its path.
 * @param {*} value - A value read out of the api.
 * @returns {*} The node, or the value itself when it is none.
 * @private
 * @example
 * reportedNode(self.math); // the api.math proxy behind the view
 */
function reportedNode(value) {
	let current = value;
	for (let guard = 0; guard < 16 && current !== null && (typeof current === "object" || typeof current === "function"); guard++) {
		const next = WeakMapMethods.get(SELF_VIEW_NODES, current) ?? WeakMapMethods.get(capturedViewTargets, current);
		if (next === undefined || next === current) break;
		// A node's own proxy is the node: a view mapping that leads off it (to the value it holds) is not followed.
		if (resolveWrapper(current) !== null && resolveWrapper(next) === null) break;
		current = next;
	}
	return liveThis(current);
}

/**
 * The node a metadata call on a value means (#918): for a stand-in a lazy node handed out for a member it had not loaded,
 * the node the stand-in reaches once that node has loaded, or while it has not, the node's wrapper with the chain below
 * it, so the call keys the metadata where the loaded node keeps it. Any other value is its own wrapper.
 * @param {*} value - A function or node, as the metadata api is handed it.
 * @returns {{wrapper: UnifiedWrapper, chain: string[]|null}|null} The wrapper, with the chain below it for a stand-in
 *   that reaches no loaded node, or null when the value is no node.
 * @internal
 *
 * @example
 * metadataNodeOf(api.calls.ping); // { wrapper: <calls>, chain: ["ping"] } before calls has loaded
 */
function metadataNodeOf(value) {
	const wrapper = resolveWrapper(value);
	if (wrapper === null) return null;
	const chain = WeakMapMethods.get(WAITING_CHAINS, value) ?? WeakMapMethods.get(WAITING_CHAINS, reportedNode(value));
	if (!chain || chain.length === 0) return { wrapper, chain: null };
	let reached;
	try {
		reached = standInNode(wrapper, chain);
	} catch {
		// A reader the rules deny what the chain reaches: the path names the node all the same.
		reached = STAND_IN_UNLOADED;
	}
	if (reached !== STAND_IN_UNLOADED && reached !== null && (typeof reached === "object" || typeof reached === "function")) {
		const reachedNode = reportedNode(reached);
		const reachedWrapper = resolveWrapper(reachedNode);
		if (reachedWrapper !== null && !WeakSetMethods.has(STAND_INS, reachedNode) && !WeakMapMethods.has(WAITING_CHAINS, reachedNode))
			return { wrapper: reachedWrapper, chain: null };
	}
	return { wrapper, chain: mapList(chain, String) };
}

/**
 * `slothlet.node(target)`: one frozen report of what slothlet knows about an api node.
 *
 * @description
 * `target` is a node (as read from the api, `self`, or a module's held reference) or its api path (a dotted string or a
 * segment array). The caller must be allowed to reach the target: the report is decided as a read of the node's own
 * path (with permissions on and read gating on), so a caller the rules deny the node is refused it.
 *
 * Reports `{ callable, file, folder, loading, materialized, mode, module, path, type }`, plus `logical` on a versioned
 * node read through its logical path and `manifest` on a node of a package mount. `type` is
 * `slothlet.types.UNMATERIALIZED` / `IN_FLIGHT` until a lazy node has loaded, then `"function"`, `"data"` or
 * `"namespace"`. `path` and `logical` are segment arrays.
 *
 * @param {object} slothlet - Slothlet instance.
 * @param {*} target - Node, dotted api path, or segment array.
 * @returns {object|undefined} The frozen report, or undefined when `target` is no api node.
 * @throws {SlothletError} PERMISSION_DENIED when the caller may not reach the target.
 * @internal
 * @example
 * nodeReport(slothlet, api.math.add).path; // ["math", "add"]
 */
function nodeReport(slothlet, target) {
	/**
	 * The api path of the node a view of `self` stands over: the node's own, or for a stand-in kept from before its folder
	 * loaded, its node's path and the chain read off it.
	 * @param {object} child - The view's child: a node or a stand-in.
	 * @param {object} inner - The child's wrapper.
	 * @returns {string} The api path.
	 * @private
	 *
	 * @example
	 * viewNodePath(standIn, wrapper); // "d.fn"
	 */
	function viewNodePath(child, inner) {
		const chain = WeakMapMethods.get(WAITING_CHAINS, child);
		const base = inner.____slothletInternal.apiPath;
		if (!chain || chain.length === 0) return base;
		const tail = ArrayMethods.join(mapList(chain, String), ".");
		return base ? base + "." + tail : tail;
	}

	// A segment array names a path; an array-backed node (its proxy is an array too) is a node.
	if (typeof target === "string" || (Arrays.isArray(target) && resolveWrapper(reportedNode(target)) === null)) {
		const segments = typeof target === "string" ? (target === "" ? [] : splitText(target, ".")) : target;
		if (!ArrayMethods.every(segments, (segment) => typeof segment === "string" && segment !== "")) return undefined;
		if (segments.length === 0) return undefined;
		let current = slothlet.api;
		let parent = null;
		for (let i = 0; i < segments.length; i++) {
			if (current === null || current === undefined || (typeof current !== "object" && typeof current !== "function")) return undefined;
			parent = current;
			current = current[segments[i]];
		}
		if (current === undefined) return undefined;
		// A path that reaches plain data is reported as data of the node holding it.
		const holder = resolveWrapper(reportedNode(current));
		if (holder === null && !slothlet.handlers?.versionManager?.dispatcherOf?.(reportedNode(current))) {
			const parentWrapper = resolveWrapper(reportedNode(parent));
			if (parentWrapper === null) return undefined;
			return Objects.freeze(parentWrapper.___wrapperReport(mapList(segments, String), { value: current }));
		}
		target = current;
	}

	const node = reportedNode(target);
	const wrapper = resolveWrapper(node);
	if (wrapper === null) {
		// A version dispatcher mounted as the logical path's node itself.
		const dispatcher = slothlet.handlers?.versionManager?.dispatcherOf?.(node);
		if (!dispatcher) return undefined;
		const resolved = dispatcher.resolve();
		const resolvedWrapper = resolved ? resolveWrapper(reportedNode(resolved)) : null;
		if (!resolvedWrapper) return undefined;
		enforceNodeReportRead(resolvedWrapper, String(resolvedWrapper.____slothletInternal.apiPath ?? ""), undefined);
		const report = resolvedWrapper.___wrapperReport();
		report.logical = Objects.freeze(splitText(dispatcher.logicalPath, "."));
		return Objects.freeze(report);
	}

	const chain = WeakMapMethods.get(WAITING_CHAINS, node);
	if (chain && chain.length > 0) {
		// A stand-in for a chain below a lazy node: once the node has loaded, the report of what the chain reads as.
		const viewPath = viewNodePath(node, wrapper);
		enforceNodeReportRead(wrapper, viewPath, undefined);
		const reached = standInNode(wrapper, chain);
		if (reached !== STAND_IN_UNLOADED) {
			if (reached === undefined) return undefined;
			const reachedNode = reportedNode(reached);
			if (resolveWrapper(reachedNode) !== null && !WeakSetMethods.has(STAND_INS, reachedNode)) return nodeReport(slothlet, reachedNode);
			const base = slothlet.handlers?.versionManager?.pathSegments?.(String(wrapper.____slothletInternal.apiPath ?? "")) ?? [];
			return Objects.freeze(wrapper.___wrapperReport(concatLists(base, mapList(chain, String)), { value: reached }));
		}
		const base = slothlet.handlers?.versionManager?.pathSegments?.(String(wrapper.____slothletInternal.apiPath ?? "")) ?? [];
		return Objects.freeze(wrapper.___wrapperReport(concatLists(base, mapList(chain, String))));
	}

	enforceNodeReportRead(wrapper, String(wrapper.____slothletInternal.apiPath ?? ""), undefined);

	// A version dispatcher reports the version it resolves to for this caller, with the logical path it was read at.
	const dispatcher = slothlet.handlers?.versionManager?.dispatcherOf?.(wrapper.____slothletInternal.impl);
	if (dispatcher) {
		const logical = Objects.freeze(splitText(dispatcher.logicalPath, "."));
		const resolved = dispatcher.resolve();
		const resolvedWrapper = resolved ? resolveWrapper(reportedNode(resolved)) : null;
		if (resolvedWrapper) enforceNodeReportRead(resolvedWrapper, String(resolvedWrapper.____slothletInternal.apiPath ?? ""), undefined);
		const report = resolvedWrapper ? resolvedWrapper.___wrapperReport() : wrapper.___wrapperReport();
		report.logical = logical;
		return Objects.freeze(report);
	}
	return Objects.freeze(wrapper.___wrapperReport());
}

/**
 * The module's own getter or setter behind each half of an accessor adoption puts on a wrapper, so a
 * copy of the member onto another node runs it on the node it lands on (#585 review).
 * @type {WeakMap<Function, Function>}
 */
const ADOPTED_ACCESSORS = new WeakMap();

/**
 * Whether a node has the prototype it was given through the node (`Object.setPrototypeOf(node, …)`), rather than the
 * one its value came with (see {@link ownsPrototype}).
 * @param {object} wrapper - The node's wrapper.
 * @returns {boolean} Whether it was given one.
 * @private
 */
function prototypeGiven(wrapper) {
	if (!ownsPrototype(wrapper)) return false;
	wrapper.___recordedPrototype();
	return wrapper.____slothletInternal.prototypeGiven;
}

/**
 * The module's own object a node fronts, when the node was built from a copy of it (#746): a plain object a module
 * exports, or one held inside such an object. Adoption works on a copy (see copyForComposition), so the module's object
 * stays whole, and a write made through the node is made to that object too, as a write to the object itself is. Null
 * for a node whose impl is the module's value itself (a class instance, an emitter, an array, a wrap-on-set value),
 * which takes its writes directly, and for a namespace slothlet composed (a file's module node, a folder), which is no
 * object of a module's.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {PropertyKey} [prop] - A member about to be written: null is answered for one the object does not hold
 *   because the build put a named export of the file there.
 * @returns {object|null} The module's object, or null.
 * @private
 *
 * @example
 * moduleObjectOf(resolveWrapper(api.m.config)); // the `config` object m.mjs exports
 */
function moduleObjectOf(wrapper, prop = undefined) {
	const internal = wrapper.____slothletInternal;
	const object = internal.moduleObject;
	if (object === null || object === undefined || object === internal.impl) return null;
	const impl = internal.impl;
	if (impl === null || typeof impl !== "object" || Arrays.isArray(impl) || util.types.isProxy(impl)) return null;
	// A named export the build put beside an object default's members is the file's binding, not a member of the
	// default: the node holds it, and the module's object never does.
	if (prop !== undefined) {
		const origin = internal.memberExportPaths?.[prop];
		if (Arrays.isArray(origin) && origin[0] !== "default" && !hasOwn(object, prop)) return null;
	}
	return object;
}

/**
 * The plain object each reconstruction of a node's value stands for ({@link UnifiedWrapper._extractFullImpl}): the
 * module's object the node fronts, so a node rebuilt from the reconstruction (a reload reusing it) still finds it.
 * @type {WeakMap<object, object>}
 * @private
 */
const RECONSTRUCTED_FROM = new WeakMap();

/**
 * The module's own object behind the value a node is built from (#746): the value itself, or what the build's copies
 * of it were copied from (see copySourceOf), when that is a plain object the node's file exports, or (`asMember`) one
 * held inside such an object. A namespace the build composed from a file's exports is no module's object, and neither
 * is a Proxy, an array, a class instance or a node.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {*} value - The value the node is built from.
 * @param {boolean} asMember - True when the value was read off the value of the node's parent.
 * @returns {object|null} The module's object, or null.
 * @private
 */
function moduleObjectFor(wrapper, value, asMember) {
	let root = value;
	for (let depth = 0; depth < 8; depth++) {
		const source =
			root !== null && typeof root === "object" ? (WeakMapMethods.get(RECONSTRUCTED_FROM, root) ?? copySourceOf(root)) : undefined;
		if (source === undefined) break;
		root = source;
	}
	if (root === null || typeof root !== "object" || Arrays.isArray(root) || util.types.isProxy(root)) return null;
	const prototype = Reflect.getPrototypeOf(root);
	if (prototype !== null && prototype !== Objects.prototype) return null;
	const ownership = wrapper.slothlet?.handlers?.ownership;
	const filePath = wrapper.____slothletInternal.filePath;
	if (!ownership || !filePath) return null;
	if (ownership.resolveExportPath(filePath, root) || (asMember && !ownership.resolveMemberExportPaths(filePath, root))) {
		moduleObjectKeys(root);
		WeakMapMethods.set(MODULE_OBJECT_SEEN, wrapper, { object: root, members: moduleObjectMembers(root) });
		return root;
	}
	return null;
}

/**
 * The members each module object a node fronts has held since slothlet first built a node from it (#757), so a member
 * the module deletes from its object later is told from one the node alone holds.
 * @type {WeakMap<object, Set<string>>}
 * @private
 */
const MODULE_OBJECT_KEYS = new WeakMap();

/**
 * The members a module's object has held since slothlet first built a node from it (see {@link MODULE_OBJECT_KEYS}).
 * @param {object} object - The module's object.
 * @returns {Set<string>} Its keys, recorded on first sight.
 * @private
 */
function moduleObjectKeys(object) {
	let keys = WeakMapMethods.get(MODULE_OBJECT_KEYS, object);
	if (keys === undefined) {
		keys = setFrom(Objects.keys(object));
		WeakMapMethods.set(MODULE_OBJECT_KEYS, object, keys);
	}
	return keys;
}

/**
 * What the module's object each node fronts held when the node was built from it, and at each member the node has
 * followed since (#757). The build decides what a node holds under a key (a collision's winner, a named export beside
 * an object default's member, a co-owner's value after a removal), so a node follows a member only when the module
 * has changed it on its object since: a member the object still holds as the build saw it is left as the build put it.
 * @type {WeakMap<UnifiedWrapper, {object: object, members: Map<string, PropertyDescriptor>}>}
 * @private
 */
const MODULE_OBJECT_SEEN = new WeakMap();

/**
 * The enumerable-or-not own string-keyed members of a module's object as they are now, for {@link MODULE_OBJECT_SEEN}.
 * @param {object} object - The module's object.
 * @returns {Map<string, PropertyDescriptor>} Each member's descriptor.
 * @private
 */
function moduleObjectMembers(object) {
	const members = new Map();
	for (let ofIndex = 0, ofList = Objects.getOwnPropertyNames(object); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		MapMethods.set(members, key, Reflect.getOwnPropertyDescriptor(object, key));
	}
	return members;
}

/**
 * What {@link nodePrimitive} answers for a node holding no primitive.
 * @type {symbol}
 * @private
 */
const NO_NODE_PRIMITIVE = Symbol("slothlet.noNodePrimitive");

/**
 * The primitive a loaded node holds as its impl: a number, a string, a boolean, a bigint or a symbol. A parent hands
 * out such a value in the node's place, so only a node kept from before it loaded (a lazy folder whose only file,
 * named like it, exports a primitive by default) is still read as one (#797).
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {*} The primitive, or {@link NO_NODE_PRIMITIVE}.
 * @private
 */
function nodePrimitive(wrapper) {
	const internal = wrapper.____slothletInternal;
	if (internal.mode === "lazy" && !internal.state.materialized) return NO_NODE_PRIMITIVE;
	const impl = internal.impl;
	return isHeldPrimitive(impl) ? impl : NO_NODE_PRIMITIVE;
}

/**
 * Bring a node in step with the module's own object it fronts (#757), before a read, a description, a key check or a
 * listing answers from the node: one member (`prop`), or every member and the object's extensibility (`prop`
 * undefined). A node fronting no module object, the framework's own reads, and a closed node (whose members are fixed
 * on its shell, as the object's are) are left as they are.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {object} target - The proxy's target.
 * @param {PropertyKey} [prop] - The member read, or undefined for all.
 * @param {boolean} [integrity=true] - With every member, whether the object's extensibility is followed too.
 * @returns {void}
 * @private
 */
function followModuleObject(wrapper, target, prop, integrity = true) {
	const internal = wrapper.____slothletInternal;
	if (internal.moduleObject === null || internal.moduleObject === undefined) return;
	if (prop !== undefined && typeof prop !== "string") return;
	if (
		internal.followingModule ||
		internal.integritySyncing ||
		wrapper.slothlet.____buildDepth > 0 ||
		MapMethods.has(FRAMEWORK_WRITES, wrapper)
	)
		return;
	if (!Reflect.isExtensible(target)) return;
	const object = moduleObjectOf(wrapper);
	if (object === null) return;
	internal.followingModule = true;
	try {
		const seen = moduleObjectKeys(object);
		if (prop !== undefined) {
			wrapper.___followModuleMember(object, seen, prop);
			return;
		}
		for (let ofIndex = 0, ofList = Objects.keys(object); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			wrapper.___followModuleMember(object, seen, key);
		}
		for (let ofIndex = 0, ofList = setToArray(seen); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (!hasOwn(object, key)) wrapper.___followModuleMember(object, seen, key);
		}
	} finally {
		internal.followingModule = false;
	}
	if (prop === undefined && integrity) wrapper.___followModuleIntegrity(target);
}

/**
 * Whether a data member a node reports takes a write (#749): as the module's object holds it where the node fronts
 * one, or as the node's live value holds it; a member only the node holds is written through the node, so it is
 * writable unless it was defined read-only through the node.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {PropertyKey} prop - The member's key.
 * @returns {boolean} What the member's description reports as `writable`.
 * @private
 */
function reportsWritable(wrapper, prop) {
	if (wrapper.____slothletInternal.readOnlyKeys && SetMethods.has(wrapper.____slothletInternal.readOnlyKeys, prop)) return false;
	const impl = wrapper.____slothletInternal.impl;
	const live = impl !== null && (typeof impl === "object" || typeof impl === "function") && !util.types.isProxy(impl) ? impl : null;
	const holder = moduleObjectOf(wrapper) ?? live;
	const held = holder === null ? undefined : Reflect.getOwnPropertyDescriptor(holder, prop);
	return held !== undefined && "value" in held ? held.writable === true : true;
}

/**
 * The module's own getter and setter behind an accessor descriptor, undoing an adoption's rebinding.
 * @param {PropertyDescriptor} descriptor - An accessor descriptor.
 * @returns {{get: Function|undefined, set: Function|undefined}} The original halves.
 * @private
 *
 * @example
 * originalAccessor(Object.getOwnPropertyDescriptor(wrapper, "total"));
 */
function originalAccessor(descriptor) {
	return {
		get: (descriptor.get && WeakMapMethods.get(ADOPTED_ACCESSORS, descriptor.get)) ?? descriptor.get,
		set: (descriptor.set && WeakMapMethods.get(ADOPTED_ACCESSORS, descriptor.set)) ?? descriptor.set
	};
}

/**
 * Each module's record of the code it made and the values handed to it (#597), by slothlet instance and then by
 * module: `{ owner, made, handedIn, exposed }`. `owner` is the first wrapper of the module seen, `made` maps each
 * value the module handed out to the stand-in it is handed out as, `handedIn` holds the values other code handed the
 * module, which are never the module's own, and `exposed` the prototypes of the classes it exports, handed out as
 * they are (see exposePrototype).
 * @type {WeakMap<object, {byID: Map<string, object>, byWrapper: WeakMap<object, object>}>}
 * @private
 */
const MAKERS = new WeakMap();

/**
 * The node whose prototype slothlet itself is reading, unchecked (see {@link heldPrototypeOf}).
 * @type {object|null}
 * @private
 */
const nodesShared = {
	__proto__: null,
	heldPrototypeRead: null
};

/**
 * The record of the module a wrapper belongs to (see {@link MAKERS}): one per module of an instance, so the same
 * value a module hands out from any of its functions is the same stand-in.
 * @param {object} wrapper - A wrapper of the module.
 * @returns {{owner: object, made: WeakMap<object, object>, madeBy: WeakMap<object, WeakMap<object, object>>|null, handedIn: WeakSet<object>, exposed: WeakSet<object>}} The module's record.
 * @private
 */
function makerOf(wrapper) {
	const slothlet = wrapper.slothlet;
	let makers = WeakMapMethods.get(MAKERS, slothlet);
	if (!makers) WeakMapMethods.set(MAKERS, slothlet, (makers = { byID: new Map(), byWrapper: new WeakMap() }));
	const moduleID = wrapper.____slothletInternal?.moduleID;
	let maker = moduleID ? MapMethods.get(makers.byID, moduleID) : WeakMapMethods.get(makers.byWrapper, wrapper);
	// A module removed and added again under the same id is a new module: what the old one made is not its.
	if (maker && maker.owner.____slothletInternal?.invalid && maker.owner !== wrapper && !wrapper.____slothletInternal?.invalid) maker = null;
	if (!maker) {
		maker = { owner: wrapper, made: new WeakMap(), madeBy: null, handedIn: new WeakSet(), exposed: new WeakSet() };
		if (moduleID) {
			// Records of modules whose every node is gone are dropped as a new one is made, so none outlives its module.
			for (const ofEntry of mapEntries(makers.byID)) {
				const id = ofEntry[0],
					other = ofEntry[1];
				if (other.owner.____slothletInternal?.invalid) MapMethods.delete(makers.byID, id);
			}
			MapMethods.set(makers.byID, moduleID, maker);
		} else WeakMapMethods.set(makers.byWrapper, wrapper, maker);
	}
	return maker;
}

/**
 * The context a module's code runs in as its maker: the instance's (#597). A reload switches the instance to its new
 * ID only once that ID's context is set up, so the instance's ID always names a context while it runs.
 * @param {object} slothlet - The instance.
 * @returns {string|null} The context's ID, or null when the instance has none.
 * @private
 */
function makerInstanceID(slothlet) {
	const current = slothlet.instanceID;
	return current && MapMethods.has(slothlet.contextManager.instances, current) ? current : null;
}

/**
 * The node at an api path of an instance, walked from its root through the nodes' own members, so no trap of a node
 * runs and nothing loads (#726): how the file's module node of a lazy tree, built with no file of its own, is found.
 * The api root alone is read through a Proxy, which it is when a root file's default function makes the api callable.
 * @param {object} slothlet - The instance.
 * @param {string} apiPath - The path.
 * @returns {object|null} The node's wrapper, or null when no node is there.
 * @private
 */
function nodeAtPath(slothlet, apiPath) {
	let current = slothlet?.api;
	// Whether the walk read through the root as a Proxy: the api is one when a root file's default function makes it
	// callable. The root is the instance's own, so it alone is read through a Proxy, and the node found that way has
	// to record the path asked for.
	let throughRoot = false;
	try {
		for (let ofIndex = 0, ofList = splitText(String(apiPath), "."); ofIndex < ofList.length; ofIndex++) {
			const segment = ofList[ofIndex];
			const holder = resolveWrapper(current) ?? current;
			if (holder === null || (typeof holder !== "object" && typeof holder !== "function")) return null;
			if (util.types.isProxy(holder)) {
				if (current !== slothlet.api) return null;
				throughRoot = true;
			}
			const descriptor = Reflect.getOwnPropertyDescriptor(holder, segment);
			if (!descriptor || !("value" in descriptor)) return null;
			current = descriptor.value;
		}
	} catch {
		// A tree that refuses to be read has no node to offer.
		return null;
	}
	const node = resolveWrapper(current);
	if (throughRoot && node !== null && String(node.____slothletInternal.apiPath ?? "") !== String(apiPath)) return null;
	return node;
}

const FUNCTION_NODES = new WeakMap();

/**
 * The node a function stands for in one instance, from a table of {@link FUNCTION_NODES} or `LAYER_FRONTS`: the
 * instance's map of function → reference to its node, read with the functions taken at load.
 * @param {WeakMap<object, WeakMap<Function, WeakRef<object>>>} table - The table.
 * @param {object} slothlet - The instance.
 * @param {Function} fn - The function.
 * @returns {object|undefined} The node, or undefined when none is held.
 * @private
 */
function nodeRefOf(table, slothlet, fn) {
	const byFunction = WeakMapMethods.get(table, slothlet);
	const reference = byFunction === undefined ? undefined : WeakMapMethods.get(byFunction, fn);
	return reference === undefined ? undefined : WeakRefMethods.deref(reference);
}

/**
 * The node fronting each function slothlet laid a layer over (a folder's or a mount's default function, see
 * {@link recordFunctionNode}), per instance, held weakly as {@link FUNCTION_NODES} is.
 * @type {WeakMap<object, WeakMap<Function, WeakRef<Function>>>}
 * @private
 */
const LAYER_FRONTS = new WeakMap();

/**
 * Every node fronting each function of a module's, per instance (#667): a class exported under two names
 * (`export { Foo, Foo as Alias }`) has a node at each. Held weakly, as {@link FUNCTION_NODES} is.
 * @type {WeakMap<object, WeakMap<Function, Array<WeakRef<Function>>>>}
 * @private
 */
const FUNCTION_NODE_SETS = new WeakMap();

/**
 * The site of the `prototype` of every node fronting the class whose own prototype `prototype` is (#667), found by
 * descriptors alone as {@link prototypeClassNode} finds the first: one per name the class is exported as. Empty
 * for any other prototype.
 * @param {object} slothlet - The instance.
 * @param {*} prototype - The prototype.
 * @returns {Array<{parts: string[], key: string, prop: string|null}>} The sites.
 * @private
 */
function classPrototypeSites(slothlet, prototype) {
	if (prototypeClassNode(slothlet, prototype) === undefined) return [];
	const owner = Reflect.getOwnPropertyDescriptor(prototype, "constructor").value;
	const sites = [];
	for (
		let ofIndex = 0,
			ofList =
				(WeakMapMethods.get(FUNCTION_NODE_SETS, slothlet) == null
					? undefined
					: WeakMapMethods.get(WeakMapMethods.get(FUNCTION_NODE_SETS, slothlet), owner)) ?? [];
		ofIndex < ofList.length;
		ofIndex++
	) {
		const ref = ofList[ofIndex];
		const node = WeakRefMethods.deref(ref);
		if (node === undefined) continue;
		const site = prototypeSiteOf(resolveWrapper(node), "prototype");
		if (!ArrayMethods.some(sites, (known) => known.key === site.key)) listPush(sites, site);
	}
	return sites;
}

/**
 * The node fronting the class whose own prototype `prototype` is (#667), found by descriptors alone so none of the
 * module's code runs to find it: the prototype's own `constructor` is a class a node of the instance fronts, and that
 * class's own `prototype` is this prototype. `undefined` for any other prototype.
 * @param {object} slothlet - The instance.
 * @param {*} prototype - The prototype.
 * @returns {Function|undefined} The class's node.
 * @private
 */
function prototypeClassNode(slothlet, prototype) {
	if (prototype === null || typeof prototype !== "object" || util.types.isProxy(prototype)) return undefined;
	const owner = Reflect.getOwnPropertyDescriptor(prototype, "constructor")?.value;
	if (typeof owner !== "function" || util.types.isProxy(owner)) return undefined;
	if (Reflect.getOwnPropertyDescriptor(owner, "prototype")?.value !== prototype) return undefined;
	return nodeRefOf(FUNCTION_NODES, slothlet, owner);
}

/**
 * A class's prototype, or an instance's, as a node hands it to whoever reads it (#667): its handle at the node's path
 * ({@link prototypeHandle}), the same to every module and to the host, so each read and change through it is
 * decided at that path for whoever makes it, and each prototype further up its chain is its own class's handle. The path
 * is recorded, so a holder handing the object on hands it as reading it there would ({@link prototypeHandedTo}).
 * @param {UnifiedWrapper} wrapper - The node it is read through: the class's, or the instance's.
 * @param {*} prototype - The prototype.
 * @param {string|null} prop - The key it is read under (`"prototype"`), or null for an instance's own prototype.
 * @returns {*} What the reader is handed.
 * @private
 */
function prototypeForReader(wrapper, prototype, prop) {
	if (prototype === null || typeof prototype !== "object") return prototype;
	const slothlet = wrapper.slothlet;
	// The site is kept per node, so recording it costs no path built per read, with the permission system on or off.
	const site = prototypeSiteOf(wrapper, prop);
	recordPrototypePath(slothlet, prototype, site);
	// Code nothing could refuse an access through it holds the object itself, as plain JS hands it.
	if (readerHoldsPrototype(slothlet, selfModuleReader(slothlet), prototype, site.parts)) return prototype;
	return prototypeHandleAt(slothlet, prototype, site);
}

/**
 * The handle of a class's prototype, or an instance's, at the path it is reached at: one object per prototype and path,
 * handed to every module and to the host alike, as a node is. It reads, lists and calls as the prototype does, and each
 * access is decided for whoever makes it at the time ({@link PROTOTYPE_HANDLE_READER}): a private member the prototype
 * holds is the owning module's, read and created by that module's code alone, and a change through the handle is held to
 * the ownership and write rules at its path. A class exported under two names has a handle at each, each decided at its
 * own path. A prototype no module made (`Object.prototype`, Node's own) and one that is itself a Proxy are handed out as
 * they are.
 * @param {object|null} slothlet - The instance.
 * @param {*} prototype - The prototype, as the module holds it.
 * @param {{parts: string[], key: string, prop: string|null}|null} site - The site it is reached at; null for one handed
 *   on with no path of its own (see {@link prototypeHandleFor}).
 * @returns {*} The handle, or the prototype itself.
 * @private
 */
function prototypeHandleAt(slothlet, prototype, site) {
	if (!slothlet || prototype === null || typeof prototype !== "object") return prototype;
	if (util.types.isProxy(prototype) || WeakSetMethods.has(INTRINSICS, prototype) || isSharedValue(prototype)) return prototype;
	// A prototype no class a node exports owns and holding none of a module's code (an object the host gave a node as
	// its prototype) is data, and is handed out as it is.
	if (
		classPrototypeSites(slothlet, prototype).length === 0 &&
		!memberHoldsCode(prototype, searchDepth(slothlet) + 1, searchBudget(slothlet))
	)
		return prototype;
	if (site === null) return selfMemberView(prototype, PROTOTYPE_HANDLE_READER, slothlet, null);
	return selfMemberView(prototype, PROTOTYPE_HANDLE_READER, slothlet, site.parts);
}

/**
 * Whether a reader is handed a prototype of a module's as the object itself rather than its handle (#667): code nothing
 * could refuse an access through it. That is the host, every reader while the permission system is off or disabled, and
 * the module the prototype belongs to (the module owning the path the class, or the instance, is exported at, whose
 * private members module privacy lets it reach) while no write rule could refuse it a write at the prototype's path or
 * beneath it. Any other reader gets the
 * handle, which decides each access for whoever makes it.
 * @param {object|null} slothlet - The instance.
 * @param {object|null|undefined} reader - Who reads: a module's wrapper, the host (`null` or {@link HOST_READER}), or a
 *   reader standing for no module.
 * @param {object} prototype - The prototype, as the module holds it.
 * @param {string[]|null} [parts=null] - The path it is read at, when it is read at one.
 * @returns {boolean} True when the reader gets the object itself.
 * @private
 */
function readerHoldsPrototype(slothlet, reader, prototype, parts = null) {
	if (!slothlet || !guardOn(slothlet)) return true;
	if (reader === null || reader === undefined || reader === HOST_READER) return true;
	const readerFile = reader?.____slothletInternal?.filePath ?? null;
	if (!readerFile) return false;
	// The module a prototype belongs to is the one exporting its class, or, for a class no node exports, the one holding
	// the instance whose prototype it is.
	let sites = prototype !== null && typeof prototype === "object" ? classPrototypeSites(slothlet, prototype) : [];
	if (sites.length === 0 && parts !== null && parts.length > 0) sites = [{ parts }];
	if (sites.length === 0 && prototype !== null && typeof prototype === "object") sites = knownPrototype(slothlet, prototype)?.sites ?? [];
	if (sites.length === 0) return false;
	// The module owning each site, as the ownership rule decides a write there, whose code module privacy lets reach the
	// private members held there, and no write rule for which could refuse a write at the site or beneath it (a deny on
	// its own prototype's member, say): the object itself would take no check of its own.
	const permissionManager = slothlet.handlers.permissionManager;
	const apiManager = slothlet.handlers.apiManager;
	const readerPath = String(reader.____slothletInternal.apiPath ?? "");
	// Held as itself, the prototype hands its `constructor` out with no node's checks around it: not while the rules could
	// refuse the reader a read of that function's members (a deny on the class's own member, say).
	if (prototype !== null && typeof prototype === "object" && constructorReadMayRefuse(slothlet, readerPath, prototype)) return false;
	return ArrayMethods.every(sites, (site) => {
		const sitePath = ArrayMethods.join(site.parts, ".");
		if (!apiManager.ownsPath(site.parts, reader)) return false;
		if (!permissionManager.mayReachPrivate(readerPath, sitePath, readerFile, holderFilePath(slothlet, site.parts))) return false;
		return permissionManager.writeSubtree(readerPath, sitePath) !== "deny";
	});
}

/**
 * A prototype's handle as a reader is handed it (#667): the object behind it to a reader that holds it so
 * ({@link readerHoldsPrototype}), and the handle to any other. Anything that is no handle is returned as is.
 * @param {object|null} slothlet - The instance.
 * @param {object|null|undefined} reader - Who reads.
 * @param {*} shown - What would be handed out.
 * @returns {*} What the reader gets.
 * @private
 */
function prototypeForHolder(slothlet, reader, shown) {
	if (shown === null || (typeof shown !== "object" && typeof shown !== "function")) return shown;
	const record = WeakMapMethods.get(SELF_MEMBER_VIEWS, shown);
	if (record?.reader !== PROTOTYPE_HANDLE_READER) return shown;
	const instance = slothlet ?? record.slothlet;
	// A class no node stands for, shared as its prototype's handle is, stands for that prototype.
	const prototype = typeof record.value === "function" ? Reflect.getOwnPropertyDescriptor(record.value, "prototype")?.value : record.value;
	const parts = record.parts.length > 0 ? record.parts : null;
	return readerHoldsPrototype(instance, reader, prototype, parts) ? record.value : shown;
}

/**
 * The handle a prototype of a module's reaches a holder as when it is handed on with no path of its own (a module
 * holding the object itself hands it on, an instance reports it): the handle at the one path it is known at, the
 * `prototype` of its class when the class is exported under one name; for a class exported under several names, a
 * handle deciding each change at every one of them, as reading it at each would.
 * @param {object} slothlet - The instance.
 * @param {object} prototype - The prototype.
 * @param {Array<{parts: string[], key: string, prop: string|null}>} sites - Where it is known to be read.
 * @returns {*} The handle.
 * @private
 */
function prototypeHandleFor(slothlet, prototype, sites) {
	const classSites = classPrototypeSites(slothlet, prototype);
	if (classSites.length === 1) return prototypeHandleAt(slothlet, prototype, classSites[0]);
	if (classSites.length === 0 && sites.length === 1) return prototypeHandleAt(slothlet, prototype, sites[0]);
	return prototypeHandleAt(slothlet, prototype, null);
}

/**
 * The site of a class's `prototype` an instance's prototype is reported at: of the names the class is exported as, the
 * one that is the class's own `name`, else the first. A class exported under one name has that one.
 * @param {object} slothlet - The instance.
 * @param {object} prototype - The class's prototype.
 * @returns {{parts: string[], key: string, prop: string|null}|undefined} The site, or `undefined` for no class a node exports.
 * @private
 */
function classSiteOf(slothlet, prototype) {
	const sites = classPrototypeSites(slothlet, prototype);
	if (sites.length < 2) return sites[0];
	const name = Reflect.getOwnPropertyDescriptor(Reflect.getOwnPropertyDescriptor(prototype, "constructor").value, "name")?.value;
	return ArrayMethods.find(sites, (site) => site.parts[site.parts.length - 2] === name) ?? sites[0];
}

/**
 * The site a node reports a prototype at, per node and key: its path's segments, with the key appended when there is
 * one, and that path as a string. Kept while the node keeps its path.
 * @type {WeakMap<UnifiedWrapper, {apiPath: string, byProp: Map<string|null, {parts: string[], key: string, prop: string|null}>}>}
 * @private
 */
const PROTOTYPE_SITES = new WeakMap();

/**
 * The site a node reports a prototype at under `prop` (see {@link PROTOTYPE_SITES}).
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {string|null} prop - The key (`"prototype"`), or null for an instance's own prototype.
 * @returns {{parts: string[], key: string, prop: string|null}} The site. Its `parts` are shared: never change them.
 * @private
 */
function prototypeSiteOf(wrapper, prop) {
	const apiPath = String(wrapper.____slothletInternal.apiPath ?? "");
	let sites = WeakMapMethods.get(PROTOTYPE_SITES, wrapper);
	if (sites === undefined || sites.apiPath !== apiPath)
		WeakMapMethods.set(PROTOTYPE_SITES, wrapper, (sites = { apiPath, byProp: new Map() }));
	let site = MapMethods.get(sites.byProp, prop);
	if (site === undefined) {
		const parts = filterList(splitText(apiPath, "."), Boolean);
		if (prop !== null) listPush(parts, prop);
		site = { parts, key: ArrayMethods.join(parts, "."), prop };
		MapMethods.set(sites.byProp, prop, site);
	}
	return site;
}

/**
 * Record a path a prototype of a module's is read at (see {@link PROTOTYPE_PATHS}).
 * @param {object} slothlet - The instance.
 * @param {object} prototype - The prototype.
 * @param {{parts: string[], key: string, prop: string|null}} site - The site it is read at.
 * @returns {void}
 * @private
 */
function recordPrototypePath(slothlet, prototype, site) {
	if (!slothlet || prototype === null || typeof prototype !== "object") return;
	let record = WeakMapMethods.get(PROTOTYPE_PATHS, prototype);
	if (record == null ? undefined : MapMethods.has(record.sites, site.key)) return;
	if (WeakSetMethods.has(INTRINSICS, prototype) || isSharedValue(prototype)) return;
	if (record === undefined) WeakMapMethods.set(PROTOTYPE_PATHS, prototype, (record = { slothlet, sites: new Map() }));
	MapMethods.set(record.sites, site.key, site);
}

/**
 * The handle of a prototype of a module's reached with no path of its own (an instance's prototype, one handed on): see
 * {@link prototypeHandleFor}. Anything not known as a prototype of a module's is returned as it is.
 * @param {object|null} slothlet - The instance, when known.
 * @param {*} value - The value.
 * @returns {*} The handle, or the value.
 * @private
 */
function prototypeHandleOf(slothlet, value) {
	const known = knownPrototype(slothlet, value);
	if (known === undefined || known.sites.length === 0) return value;
	return prototypeHandleFor(known.slothlet, value, known.sites);
}

/**
 * A prototype of a module's as it reaches a module when a module holding the object itself hands it on (#667): as a
 * return value, an argument, an event, a thrown error, or inside any of them. While the permission system is on it is
 * its handle ({@link prototypeHandleOf}), whoever it reaches, so each access is decided for whoever makes it.
 * Anything else, and everything while the system is off, passes as it is.
 * @param {*} value - The value handed on.
 * @param {object|null} reader - Who it reaches.
 * @param {object|null} [slothlet] - The instance it crossed in, when known.
 * @returns {*} What the reader gets.
 * @private
 */
function prototypeHandedTo(value, reader, slothlet = null) {
	if (slothlet && !guardOn(slothlet)) return value;
	const known = knownPrototype(slothlet, value);
	if (known === undefined || known.sites.length === 0) return value;
	if (!guardOn(known.slothlet)) return value;
	// The host, and the module the prototype belongs to, hold it as it is, as plain JS hands it on.
	if (readerHoldsPrototype(known.slothlet, reader, value)) return value;
	return prototypeHandleFor(known.slothlet, value, known.sites);
}

/**
 * Each class of a module's a node fronts, with the instance it belongs to (#667): a prototype handed on before anything
 * read it is told by its class, wherever it turns up.
 * @type {WeakMap<Function, WeakRef<object>>}
 * @private
 */
const CLASS_INSTANCES = new WeakMap();

/**
 * The wrapper of the api node a value is, or is a per-reader view of (a view `self` or a captured reference hands a
 * module), or null for any other value. Only the registries are read, so none of the value's traps run.
 * @param {*} value - The value.
 * @returns {UnifiedWrapper|null} The node's wrapper.
 * @private
 */
function viewedNodeWrapper(value) {
	let current = value;
	for (let depth = 0; depth < 4 && current !== null && (typeof current === "object" || typeof current === "function"); depth++) {
		const wrapper = registeredWrapper(current);
		if (wrapper) return wrapper;
		current = WeakMapMethods.get(capturedViewNodes, current) ?? WeakMapMethods.get(SELF_VIEW_NODES, current);
	}
	return null;
}

/**
 * Who a wrapper's module is, for the guard: its module id, or the wrapper itself when it has none.
 * @param {object|null} wrapper - A wrapper.
 * @returns {string|object|null} The key.
 * @private
 */
function moduleKey(wrapper) {
	if (!wrapper?.____slothletInternal) return null;
	return wrapper.____slothletInternal.moduleID ?? wrapper;
}

/**
 * Whether a prototype's own `constructor` is a function an api node stands for (the api root's function, or one a node
 * fronts) whose members the rules could refuse the reader a read of: held as itself, the prototype would hand the
 * function out with no node's checks around it. Found by descriptors alone, so none of the module's code runs.
 * @param {object} slothlet - The instance.
 * @param {string} readerPath - The reader's api path.
 * @param {object} prototype - The prototype.
 * @returns {boolean} True when a read could be refused.
 * @private
 */
function constructorReadMayRefuse(slothlet, readerPath, prototype) {
	const constructor = Reflect.getOwnPropertyDescriptor(prototype, "constructor")?.value;
	if (typeof constructor !== "function") return false;
	const root = slothlet.api;
	let path;
	if (typeof root === "function" && (root === constructor || layerUnderlying(root) === constructor)) path = "";
	else {
		const node = nodeRefOf(FUNCTION_NODES, slothlet, constructor) ?? nodeRefOf(LAYER_FRONTS, slothlet, constructor);
		if (node === undefined) return false;
		path = String(resolveWrapper(node)?.____slothletInternal.apiPath ?? "");
	}
	return slothlet.handlers.permissionManager.readMayRefuseBeneath(readerPath, path);
}

/**
 * The prototype site each node holding a class instance found, with what it was found for (see
 * {@link instancePrototypeSite}).
 * @type {WeakMap<UnifiedWrapper, {impl: object, current: object|null|undefined, apiPath: string, found: object|undefined}>}
 * @private
 */
const INSTANCE_PROTOTYPE_SITES = new WeakMap();

/**
 * The stand-in for a prototype withheld from a reader, per node: see {@link withheldPrototype}.
 * @type {WeakMap<UnifiedWrapper, {nearest: object, standIn: object}>}
 * @private
 */
const WITHHELD_PROTOTYPES = new WeakMap();

/**
 * The member nodes an instance's node built for the class its instance was made by, keyed by that node's wrapper
 * (see {@link instanceClassNode}).
 * @type {WeakMap<UnifiedWrapper, {fn: Function, node: Function}>}
 * @private
 */
const INSTANCE_CLASS_NODES = new WeakMap();

/**
 * The class of the instance a node fronts, as a member node of that node, when the class is the module's code and no
 * node of the instance fronts it (#667): an instance whose module keeps its class to itself answers `constructor` with
 * it, as the plain instance does. Built once per node and class, so `inst.constructor === inst.constructor` holds.
 * Null for a node fronting no instance held as the module holds it, or one whose class is not the module's.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {Function|null} [instanceClass] - The class, when the instance answered it itself (a `constructor` accessor
 *   of its prototype's, run as the module); found by descriptors otherwise.
 * @returns {Function|null} The class's member node, or null.
 * @private
 */
function instanceClassNode(wrapper, instanceClass = wrapper.___heldInstanceClass()) {
	if (instanceClass === null) return null;
	if (isIntrinsic(instanceClass) || isBuiltinFunction(instanceClass) || isSharedValue(instanceClass)) return null;
	const held = WeakMapMethods.get(INSTANCE_CLASS_NODES, wrapper);
	if (held?.fn === instanceClass) return held.node;
	const node = wrapper.___createChildWrapper("constructor", instanceClass);
	if (typeof node !== "function") return null;
	// Its node sits at the instance's `constructor`, but answers the class's own name, as the class does; a `name` the
	// class computes (a static getter) is its code, and the node keeps the name its path gives.
	const name = Reflect.getOwnPropertyDescriptor(instanceClass, "name");
	if (name && "value" in name && typeof name.value === "string") resolveWrapper(node).____slothletInternal.className = name.value;
	WeakMapMethods.set(INSTANCE_CLASS_NODES, wrapper, { fn: instanceClass, node });
	return node;
}

/**
 * The object and each prototype above it, once each. A proxy's `getPrototypeOf` may legally return an object
 * already visited (itself, or an earlier link), which a plain walk would follow forever.
 *
 * @param {object} start - The object whose chain is walked.
 * @returns {Generator<object>} The chain, nearest first.
 * @private
 *
 * @example
 * [...prototypeChain([])]; // [[], Array.prototype, Object.prototype]
 */
function* prototypeChain(start) {
	const seen = new Set();
	for (
		let holder = start;
		holder !== null && holder !== undefined && !SetMethods.has(seen, holder);
		holder = Reflect.getPrototypeOf(holder)
	) {
		SetMethods.add(seen, holder);
		yield holder;
	}
}

/**
 * The node a function member of a node stands for when the function is the node's own or an ancestor's: in plain JS
 * `fn.me === fn`, so `api.x.me` is `api.x`, and a member referring further up is the node further up, never a new node
 * below that would open another level on every read. A node's own function is its implementation, or the module's
 * function under it when the implementation is a composition layer (a callable folder with siblings). A function a
 * collision merged into the node is the one its leaf function was recorded for at the node's own path (see
 * {@link registerLeafFunction}). Further up, a node recorded for the function on the node's path is the one;
 * walking up, the nodes the api holds on the node's path are looked at as well.
 * @param {object} wrapper - The node holding the member.
 * @param {*} member - The member's value.
 * @param {boolean} [walkUp=true] - Look at the nodes the api holds above the node. A build passes false: the nodes it
 *   is building are not in the api yet, and only the recorded node can answer there.
 * @returns {object|null} The node's wrapper, or null when the value is no function of the node or an ancestor.
 * @private
 */
function nodeInCycle(wrapper, member, walkUp = true) {
	if (typeof member !== "function") return null;
	// A layer hands a function of the value under it out bound to that value: the function it stands for is the member.
	const value = layerMethodOriginal(member) ?? member;
	const ownFunction = (node) => {
		const impl = node.____slothletInternal.impl;
		return impl === value || (typeof impl === "function" && layerUnderlying(impl) === value);
	};
	if (ownFunction(wrapper)) return wrapper;
	const path = String(wrapper.____slothletInternal.apiPath ?? "");
	let owner = WeakMapMethods.get(trustedRootOwn.implWrappers, value);
	// A node whose implementation is an object recorded the object's `default` as its leaf function (see
	// registerLeafFunction), the function a call of the node runs. In plain JS that function is a member of
	// the object, `obj.default !== obj`: the node stands for the object, so the function is no reference back to it.
	if (owner !== undefined && implDefault(owner.____slothletInternal.impl) === value) owner = undefined;
	if (owner !== undefined && owner.slothlet === wrapper.slothlet && !owner.____slothletInternal.invalid) {
		const at = String(owner.____slothletInternal.apiPath ?? "");
		if (at === path) return wrapper;
		if (!walkUp && at !== "" && StringMethods.startsWith(path, `${at}.`)) return owner;
	}
	if (!walkUp) return null;
	const segments = splitText(path, ".");
	for (let depth = segments.length - 1; depth > 0; depth--) {
		const node = nodeAtPath(wrapper.slothlet, ArrayMethods.join(copyList(segments, 0, depth), "."));
		if (node !== null && (ownFunction(node) || (owner !== undefined && node === owner))) return node;
	}
	return null;
}

/**
 * The api node each per-reader view is over, so what a view's node holds can be told (#597).
 * @type {WeakMap<object, object>}
 * @private
 */
const capturedViewNodes = new WeakMap();

/**
 * Whether an api node holds code that the paths running a module's code as that module do not reach (#597): an
 * accessor its impl holds that adoption did not put on the node, or a function under a symbol on the node or its
 * impl — an iterator a spread runs returns a generator whose body resumes as whoever iterates it — or an impl that is a
 * module's own Proxy, whose traps run on every operation on the node. A node holding
 * any of these, handed to a call, counts as able to carry its holder's code, so the call is checked for supplied code.
 * Decided from descriptors alone; nothing of the node's runs.
 * @param {*} value - An api value.
 * @returns {boolean} True when it holds such code.
 * @private
 */
function nodeHarborsCode(value) {
	const wrapper = registeredWrapper(WeakMapMethods.get(capturedViewNodes, value) ?? value);
	if (!wrapper) return false;
	const holdsSymbolFunction = (holder) => {
		for (let ofIndex = 0, ofList = Objects.getOwnPropertySymbols(holder); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			const descriptor = Reflect.getOwnPropertyDescriptor(holder, key);
			if (descriptor && typeof descriptor.value === "function" && !isFrameworkReservedKey(key)) return true;
		}
		return false;
	};
	try {
		if (holdsSymbolFunction(wrapper)) return true;
		const impl = wrapper.____slothletInternal?.impl;
		if (impl === null || (typeof impl !== "object" && typeof impl !== "function")) return false;
		// A module's own Proxy runs its traps on every operation on the node (#597).
		if (util.types.isProxy(impl)) return isModuleProxy(impl);
		for (let ofIndex = 0, ofList = Reflect.ownKeys(impl); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			const descriptor = Reflect.getOwnPropertyDescriptor(impl, key);
			if (!descriptor) continue;
			if (
				(typeof descriptor.get === "function" && !WeakMapMethods.has(ADOPTED_ACCESSORS, descriptor.get)) ||
				(typeof descriptor.set === "function" && !WeakMapMethods.has(ADOPTED_ACCESSORS, descriptor.set))
			)
				return true;
			if (typeof key === "symbol" && typeof descriptor.value === "function" && !isFrameworkReservedKey(key)) return true;
		}
		return false;
	} catch {
		// A node that refuses to be described cannot be told to hold nothing.
		return true;
	}
}

/**
 * Map a `this` argument that is itself a stale (restart-replaced) proxy to its live counterpart, so
 * a method reached through a held reference runs against the live node rather than the old one.
 *
 * @param {unknown} value - The `this` argument (or `new.target`).
 * @returns {unknown} The live node when `value` is a stale wrapper proxy, the same reader's view of it when
 *   `value` is a view of one, otherwise `value`.
 * @private
 *
 * @example
 * Reflect.apply(live, liveThis(thisArg), args);
 */
function liveThis(value) {
	// A view `self` handed out stays a view, of the live node, for the same reader (#625): the method
	// never gets the node itself.
	if (WeakMapMethods.has(SELF_VIEW_NODES, value)) {
		const node = WeakMapMethods.get(SELF_VIEW_NODES, value);
		const live = liveThis(node);
		return live === node ? value : selfView(live, WeakMapMethods.get(SELF_VIEW_READERS, value));
	}
	const wrapper = registeredWrapper(value);
	// A stand-in for a chain below the wrapper resolves to the chain's live end (`new.target` of a construction
	// through one, #685).
	if (wrapper && isRestartStale(wrapper)) return wrapper.___resolveRestartTarget(WeakMapMethods.get(WAITING_CHAINS, value));
	return value;
}

/**
 * The property chain each waiting proxy stands for below its wrapper, for {@link liveThis}.
 * @type {WeakMap<object, Array<string|symbol>>}
 * @private
 */
const WAITING_CHAINS = new WeakMap();

/**
 * The value an array holds at an index as a plain value, read from its descriptor so no getter runs.
 * @param {Array} array - The array.
 * @param {string} index - The index.
 * @returns {unknown} The value, or `undefined` for a hole or an accessor.
 * @private
 *
 * @example
 * elementAt(["a"], "0"); // "a"
 */
function elementAt(array, index) {
	const descriptor = elementDescriptor(array, index);
	return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

/**
 * The descriptor of an array's element, from the array's own descriptors and then those of its prototypes:
 * an element the array inherits is still its element. No getter runs.
 * @param {Array} array - The array.
 * @param {string} index - The index.
 * @returns {PropertyDescriptor|undefined} The first descriptor found along the chain.
 * @private
 *
 * @example
 * elementDescriptor(["a"], "0"); // { value: "a", ... }
 */
function elementDescriptor(array, index) {
	for (const holder of generatorSteps(prototypeChain(array))) {
		const descriptor = Reflect.getOwnPropertyDescriptor(holder, index);
		if (descriptor) return descriptor;
	}
	return undefined;
}

/**
 * What a stand-in answers while the node it stands for has not loaded (see {@link standInNode}).
 * @type {symbol}
 * @private
 */
const STAND_IN_UNLOADED = Symbol("slothlet.standInUnloaded");

/**
 * The node behind a value read out of the api: a per-reader view a read under a module's identity hands back stands
 * for the node it was built over; anything else is the value itself (#625).
 * @param {*} value - A value read out of the api.
 * @returns {*} The node behind it.
 * @internal
 *
 * @example
 * nodeBehind(heldReference) === api.victim.v; // true for a view of victim.v
 */
function nodeBehind(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	return WeakMapMethods.get(capturedViewTargets, value) ?? value;
}

/** Whether {@link NodesLayer} has built its class: it builds one, for the wrapper's chain. @type {boolean} */
let built = false;

/**
 * Build this layer of the wrapper class over `Base`, once (see `unified-wrapper.mjs`).
 * @param {Function} Base - The class below this layer.
 * @returns {Function} The layer's class.
 * @internal
 */
export function NodesLayer(Base) {
	if (built) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
	built = true;
	return Base.layer(
		class Nodes extends Base {
			static {
				Base.define("nodes", {
					valueOfFor,
					viewAccessor,
					NODE_TARGETS,
					sameLookup,
					metadataNodeOf,
					ADOPTED_ACCESSORS,
					RECONSTRUCTED_FROM,
					NO_NODE_PRIMITIVE,
					followModuleObject,
					reportsWritable,
					originalAccessor,
					MAKERS,
					nodesShared,
					makerOf,
					makerInstanceID,
					FUNCTION_NODES,
					LAYER_FRONTS,
					classPrototypeSites,
					readerHoldsPrototype,
					classSiteOf,
					viewedNodeWrapper,
					liveThis,
					WAITING_CHAINS,
					STAND_IN_UNLOADED,
					constructorReadMayRefuse,
					CLASS_INSTANCES,
					FUNCTION_NODE_SETS,
					recordPrototypePath,
					WITHHELD_PROTOTYPES,
					elementAt,
					elementDescriptor
				});
				Base.define("node", {
					wrapperOf: nodeWrapperOf,
					open: nodeOpen,
					report: nodeReport,
					primitive: nodePrimitive,
					atPath: nodeAtPath,
					refOf: nodeRefOf,
					inCycle: nodeInCycle,
					harborsCode: nodeHarborsCode,
					behind: nodeBehind
				});
				Base.define("module", { objectOf: moduleObjectOf, objectFor: moduleObjectFor, objectKeys: moduleObjectKeys, key: moduleKey });
				Base.define("prototype", {
					given: prototypeGiven,
					classNode: prototypeClassNode,
					forReader: prototypeForReader,
					handleAt: prototypeHandleAt,
					forHolder: prototypeForHolder,
					siteOf: prototypeSiteOf,
					handleOf: prototypeHandleOf,
					handedTo: prototypeHandedTo,
					chain: prototypeChain
				});
				Base.define("instance", { classNode: instanceClassNode });
				Base.define("captured", { viewNodes: capturedViewNodes });
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					INTRINSICS = methods.values.INTRINSICS;
					NODE_VALUE_OFS = methods.values.NODE_VALUE_OFS;
					inherits = methods.values.inherits;
					isBuiltinFunction = methods.is.builtinFunction;
					isHeldPrimitive = methods.is.heldPrimitive;
					isIntrinsic = methods.is.intrinsic;
					isModuleProxy = methods.is.moduleProxy;
					isRestartStale = methods.is.restartStale;
					isSharedValue = methods.is.sharedValue;
					ownsPrototype = methods.values.ownsPrototype;
					FRAMEWORK_WRITES = methods.rules.FRAMEWORK_WRITES;
					enforceNodeReportRead = methods.rules.enforceNodeReportRead;
					frameworkWrite = methods.framework.write;
					implDefault = methods.impl.default;
					memberHoldsCode = methods.rules.memberHoldsCode;
					capturedViewChildren = methods.captured.viewChildren;
					capturedViewTargets = methods.captured.viewTargets;
					hasOwn = methods.has.own;
					HOST_READER = methods.views.HOST_READER;
					PROTOTYPE_HANDLE_READER = methods.views.PROTOTYPE_HANDLE_READER;
					PROTOTYPE_PATHS = methods.views.PROTOTYPE_PATHS;
					emitterOwnPrototype = methods.views.emitterOwnPrototype;
					holderFilePath = methods.views.holderFilePath;
					selfMemberView = methods.self.memberView;
					selfModuleReader = methods.self.moduleReader;
					selfView = methods.self.view;
					SELF_MEMBER_VIEWS = methods.views.SELF_MEMBER_VIEWS;
					SELF_VIEW_NODES = methods.views.SELF_VIEW_NODES;
					SELF_VIEW_READERS = methods.views.SELF_VIEW_READERS;
					STAND_INS = methods.views.STAND_INS;
					guardOn = methods.membrane.guardOn;
					knownPrototype = methods.membrane.knownPrototype;
					searchBudget = methods.membrane.searchBudget;
					searchDepth = methods.membrane.searchDepth;
					standInNode = methods.stand.inNode;
					defineAdoptedAccessor = methods.materialize.defineAdoptedAccessor;
					isClassInstance = methods.is.classInstance;
					resolveWrapper = methods.uw.resolveWrapper;
					trustedRootOwn = methods.uw.trustedRootOwn;
					registeredWrapper = methods.values.registeredWrapper;
					isWrapper = methods.brand.isWrapper;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				super(slothlet);
			}

			/**
			 * {@link classPrototypeOf}, by the node's wrapper.
			 * @param {UnifiedWrapper} wrapper - The node's wrapper.
			 * @returns {object|null} The prototype.
			 * @private
			 */
			___wrapperClassPrototype() {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				const impl = wrapper.____slothletInternal.impl;
				if (typeof impl !== "function") return null;
				const described = Reflect.getOwnPropertyDescriptor(layerUnderlying(impl), "prototype");
				const value = described !== undefined && "value" in described ? described.value : null;
				return value !== null && typeof value === "object" ? value : null;
			}

			/**
			 * The prototype a member reaches a node fronting a module's own object from, when the object inherits it from a
			 * prototype set on it (#757) and the node's own copy of the object holds no member by that key: null otherwise, and
			 * for a member of `Object.prototype`, which the node's copy inherits too.
			 * @param {object} wrapper - The node's wrapper.
			 * @param {PropertyKey} prop - The member's key.
			 * @returns {object|null} The prototype to read it from, or null.
			 * @private
			 */
			___moduleInheritance(prop) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				const internal = wrapper.____slothletInternal;
				if (internal.moduleObject === null || internal.moduleObject === undefined) return null;
				const impl = internal.impl;
				if (impl === null || typeof impl !== "object" || Reflect.has(impl, prop)) return null;
				const object = moduleObjectOf(wrapper);
				if (object === null) return null;
				const prototype = Reflect.getPrototypeOf(object);
				return prototype !== null && prototype !== Objects.prototype && Reflect.has(prototype, prop) ? prototype : null;
			}

			/**
			 * A member of a function node's function, as the node reads it: one the function does not hold itself comes from the
			 * prototype on the node's record (see {@link ownsPrototype}), read on the function.
			 * @param {object} wrapper - The node's wrapper.
			 * @param {Function} fn - The function.
			 * @param {PropertyKey} prop - The member's key.
			 * @returns {*} The member.
			 * @private
			 */
			___functionMember(fn, prop) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				// While the node's prototype is its function's own, the function answers for what it inherits.
				if (fn !== wrapper.____slothletInternal.impl || !prototypeGiven(wrapper)) return fn[prop];
				const prototype = wrapper.___nodeInherits(prop);
				if (prototype === undefined) return fn[prop];
				return prototype === null ? undefined : Reflect.get(prototype, prop, fn);
			}

			/**
			 * Bring one member a node fronts in step with the module's own object (#757): the module may change its object
			 * itself after the node was built (`config.port = 90` in its own code), and a read through the node gives what the
			 * object holds, as a read of the object does. A member the module replaced is adopted again, as the build adopts
			 * one; one it added is adopted; one it deleted is taken off the node. Only the node is changed, as the framework's
			 * own write: the module made the change.
			 * @param {UnifiedWrapper} wrapper - The node's wrapper.
			 * @param {object} object - The module's object.
			 * @param {Set<string>} seen - The members the object has held (see {@link moduleObjectKeys}).
			 * @param {string} key - The member's key.
			 * @returns {void}
			 * @private
			 */
			___followModuleMember(object, seen, key) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				/**
				 * Whether what a node holds under a key is what the module's object holds there now (#757): the same primitive or
				 * built-in value, a child node built from the same object, or an adoption of the same accessor.
				 * @param {PropertyDescriptor} mine - The node's own member.
				 * @param {PropertyDescriptor} held - The module's object's member.
				 * @returns {boolean} True when the node is in step with the object for this member.
				 * @private
				 */
				function holdsModuleMember(mine, held) {
					if (!("value" in held)) {
						if ("value" in mine) return false;
						const original = originalAccessor(mine);
						return original.get === held.get && original.set === held.set;
					}
					if (!("value" in mine)) return false;
					if (Objects.is(mine.value, held.value)) return true;
					const child = resolveWrapper(mine.value);
					if (child === null) return false;
					// A child node that keeps no record of what it was built from is not one this follows.
					const internal = child.____slothletInternal;
					if (!hasOwn(internal, "sourceValue")) return true;
					// A child a reload reused fronts the reloaded value through its impl or its module object, not what it was built from.
					return (
						internal.sourceValue === held.value ||
						internal.moduleObject === held.value ||
						internal.impl === held.value ||
						(internal.impl !== null && typeof internal.impl === "object" && layerUnderlying(internal.impl) === held.value)
					);
				}

				/**
				 * Whether the module has changed a member of its object since the node last saw it (see {@link MODULE_OBJECT_SEEN}),
				 * recording what the object holds now.
				 * @param {UnifiedWrapper} wrapper - The node's wrapper.
				 * @param {object} object - The module's object.
				 * @param {string} key - The member's key.
				 * @param {PropertyDescriptor|undefined} held - The object's member now.
				 * @returns {boolean} True when the member was added, replaced, redefined or deleted.
				 * @private
				 */
				function moduleMemberChanged(wrapper, object, key, held) {
					let seen = WeakMapMethods.get(MODULE_OBJECT_SEEN, wrapper);
					if (seen === undefined || seen.object !== object) {
						// A node handed another node's object (a reload reusing it) was just built from that object as it is.
						seen = { object, members: moduleObjectMembers(object) };
						WeakMapMethods.set(MODULE_OBJECT_SEEN, wrapper, seen);
						return false;
					}
					const before = MapMethods.get(seen.members, key);
					if (held === undefined) {
						if (before === undefined) return false;
						MapMethods.delete(seen.members, key);
						return true;
					}
					if (
						before !== undefined &&
						before.enumerable === held.enumerable &&
						"value" in before === "value" in held &&
						("value" in held ? Objects.is(before.value, held.value) : before.get === held.get && before.set === held.set)
					) {
						return false;
					}
					MapMethods.set(seen.members, key, held);
					return true;
				}

				if (isFrameworkReservedKey(key)) return;
				const internal = wrapper.____slothletInternal;
				// A member the other side of a collision won, and a named export beside an object default's members, is the node's.
				if (
					(internal.collisionMergedKeys ? SetMethods.has(internal.collisionMergedKeys, key) : false) ||
					moduleObjectOf(wrapper, key) === null
				)
					return;
				const held = Reflect.getOwnPropertyDescriptor(object, key);
				if (!moduleMemberChanged(wrapper, object, key, held)) return;
				const mine = Reflect.getOwnPropertyDescriptor(wrapper, key);
				if (mine !== undefined && !mine.configurable) return;
				if (held === undefined) {
					if (mine === undefined || !SetMethods.has(seen, key)) return;
					SetMethods.delete(seen, key);
					const displaced = "value" in mine ? resolveWrapper(mine.value) : null;
					if (displaced) displaced.___retireChanges();
					Reflect.deleteProperty(wrapper, key);
					if (internal.readOnlyKeys) SetMethods.delete(internal.readOnlyKeys, key);
					return;
				}
				// The build adopts an object's enumerable members only.
				if (!held.enumerable) return;
				SetMethods.add(seen, key);
				if (mine !== undefined && holdsModuleMember(mine, held)) return;
				if (!("value" in held)) {
					defineAdoptedAccessor(wrapper, key, held);
					return;
				}
				const value = held.value;
				let stored = value;
				if (
					value !== null &&
					(typeof value === "object" || typeof value === "function") &&
					!util.types.isProxy(value) &&
					resolveWrapper(value) === null
				) {
					const displaced = mine !== undefined && "value" in mine ? resolveWrapper(mine.value) : null;
					if (displaced) displaced.___retireChanges();
					const wrapped = wrapper.___createChildWrapper(key, value, null, internal.deferChildAdopt);
					if (wrapped !== null && wrapped !== undefined) stored = wrapped;
				}
				Objects.defineProperty(wrapper, key, { __proto__: null, value: stored, writable: false, enumerable: true, configurable: true });
			}

			/**
			 * Close a node when the module closed its own object itself (#757), as the build closes a node over a closed object:
			 * its members are brought in step first, then it is frozen, sealed or made non-extensible as the object is.
			 * @param {UnifiedWrapper} wrapper - The node's wrapper.
			 * @param {object} target - The proxy's target.
			 * @returns {void}
			 * @private
			 */
			___followModuleIntegrity(target) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				const internal = wrapper.____slothletInternal;
				if (internal.moduleObject === null || internal.moduleObject === undefined) return;
				if (
					internal.followingModule ||
					internal.integritySyncing ||
					wrapper.slothlet.____buildDepth > 0 ||
					MapMethods.has(FRAMEWORK_WRITES, wrapper)
				)
					return;
				if (!Reflect.isExtensible(target)) return;
				const object = moduleObjectOf(wrapper);
				if (object === null || Reflect.isExtensible(object)) return;
				followModuleObject(wrapper, target, undefined, false);
				const { proxy } = internal;
				const syncing = internal.integritySyncing;
				internal.integritySyncing = true;
				try {
					frameworkWrite(wrapper, () => {
						if (Objects.isFrozen(object)) Objects.freeze(proxy);
						else if (Objects.isSealed(object)) Objects.seal(proxy);
						else Objects.preventExtensions(proxy);
					});
				} finally {
					internal.integritySyncing = syncing;
				}
			}

			/**
			 * Record a prototype of a class a module exports as one handed out as it is (#597): `api.x.Class.prototype` reads
			 * the class's own, so an instance of the class reports that very object as its prototype. Its members are still the
			 * module's when read through an instance.
			 * @param {object} wrapper - The class's node.
			 * @param {*} prototype - The prototype.
			 * @returns {*} The prototype.
			 * @private
			 */
			___exposePrototype(prototype) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				if (prototype === null || typeof prototype !== "object") return prototype;
				if (!wrapper?.slothlet?.instanceID || !wrapper.slothlet.contextManager?.runInContext) return prototype;
				WeakSetMethods.add(makerOf(wrapper).exposed, prototype);
				return prototype;
			}

			/**
			 * The class a node's instance was made by (#667): the node holds an object built by a class (not a plain object, not
			 * an array) as the module holds it, so it is the value itself rather than a copy the framework built from it, and the
			 * class's own `prototype` is the instance's prototype. Found by descriptors alone, so none of the module's code runs to
			 * find it: an instance with a `constructor` of its own, one whose prototype holds `constructor` as an accessor, and a
			 * Proxy anywhere on the way answer null, as does any other node.
			 * @param {UnifiedWrapper} wrapper - The node's wrapper.
			 * @returns {Function|null} The class, or null.
			 * @private
			 */
			___heldInstanceClass() {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				const internal = wrapper.____slothletInternal;
				const impl = internal.impl;
				if (impl === null || typeof impl !== "object" || util.types.isProxy(impl)) return null;
				if (!isClassInstance(impl) || !hasOwn(internal, "sourceValue") || internal.sourceValue !== impl || hasOwn(impl, "constructor"))
					return null;
				const prototype = Reflect.getPrototypeOf(impl);
				if (util.types.isProxy(prototype)) return null;
				const instanceClass = Reflect.getOwnPropertyDescriptor(prototype, "constructor")?.value;
				if (typeof instanceClass !== "function" || util.types.isProxy(instanceClass)) return null;
				return Reflect.getOwnPropertyDescriptor(instanceClass, "prototype")?.value === prototype ? instanceClass : null;
			}

			/**
			 * An emitter's own prototype as a node hands it to whoever may call the node (#667): its handle at the node's path, or
			 * at its class's `prototype` when a node exports the class, the same to every reader, which reads and calls as the
			 * prototype does and decides each change made through it for whoever makes it. A prototype made by no module is no
			 * one's to hold back, and is handed out as it is.
			 * @param {UnifiedWrapper} wrapper - The emitter's node's wrapper.
			 * @param {object} prototype - The emitter's own prototype.
			 * @returns {object} What the reader is handed.
			 * @private
			 */
			___emitterPrototypeHandle(prototype) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				const slothlet = wrapper.slothlet;
				const site = prototypeSiteOf(wrapper, null);
				recordPrototypePath(slothlet, prototype, site);
				return prototypeHandleOf(slothlet, prototype);
			}

			/**
			 * Where a node holding an instance of a class of the module's finds the instance's prototype (#725): its class's
			 * `prototype`, at the path of the node standing for the class, or for an instance whose class cannot be told from
			 * descriptors its own prototype at the instance's path. `undefined` for any other node, an emitter among them. Kept per
			 * node for as long as it holds the same instance with the same prototype.
			 * @param {UnifiedWrapper} wrapper - The node's wrapper.
			 * @returns {{prototype: object, checked: UnifiedWrapper, site: {parts: string[], key: string, prop: string|null}}|undefined}
			 *   The prototype, the node reaching it is checked against, and the site it is read at.
			 * @private
			 */
			___instancePrototypeSite() {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				const impl = wrapper.____slothletInternal.impl;
				if (impl === null || typeof impl !== "object") return undefined;
				const held = WeakMapMethods.get(INSTANCE_PROTOTYPE_SITES, wrapper);
				const current = util.types.isProxy(impl) ? undefined : Reflect.getPrototypeOf(impl);
				if (held !== undefined && held.impl === impl && held.current === current && held.apiPath === wrapper.____slothletInternal.apiPath)
					return held.found;
				let found;
				if (emitterOwnPrototype(wrapper) === undefined) {
					const classNode = wrapper.___instanceClassFront();
					if (classNode) {
						const checked = resolveWrapper(classNode);
						found = { prototype: Reflect.getPrototypeOf(impl), checked, site: prototypeSiteOf(checked, "prototype") };
					} else {
						const unclassed = wrapper.___unclassedInstancePrototype();
						if (unclassed !== undefined) found = { prototype: unclassed, checked: wrapper, site: prototypeSiteOf(wrapper, null) };
					}
				}
				WeakMapMethods.set(INSTANCE_PROTOTYPE_SITES, wrapper, { impl, current, apiPath: wrapper.____slothletInternal.apiPath, found });
				return found;
			}

			/**
			 * The node reaching a closed node's prototype is checked against (#725): a class instance's prototype is checked as a
			 * call of its class's node, as on an open node, and any other as a call of the node itself.
			 * @param {UnifiedWrapper} wrapper - The closed node's wrapper.
			 * @param {*} prototype - The prototype it reports, as the module holds it.
			 * @returns {UnifiedWrapper} The node to check.
			 * @private
			 */
			___prototypeCheckedBy(prototype) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				const site = wrapper.___instancePrototypeSite();
				return site !== undefined && site.prototype === prototype ? site.checked : wrapper;
			}

			/**
			 * The prototype of an instance a node holds as its module holds it, when the class that made it cannot be told from
			 * descriptors (see {@link heldInstanceClass}): its prototype's `constructor` is an accessor, the instance has a
			 * `constructor` of its own, the prototype has none, or the prototype is a Proxy. The node reports it as the instance
			 * does, by `Object.getPrototypeOf` and through `__proto__` alike (#667); no class node stands for it, so reaching it is
			 * checked as a call of the instance's own node. Read from the instance's own `[[Prototype]]`, so none of the module's
			 * code runs to find it. `undefined` for any other node, an emitter or a live grafted object among them, which answer
			 * their own prototype.
			 * @param {UnifiedWrapper} wrapper - The node's wrapper.
			 * @returns {object|undefined} The prototype, or `undefined`.
			 * @private
			 */
			___unclassedInstancePrototype() {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				const internal = wrapper.____slothletInternal;
				const impl = internal.impl;
				if (impl === null || typeof impl !== "object" || util.types.isProxy(impl)) return undefined;
				if (!isClassInstance(impl) || !hasOwn(internal, "sourceValue") || internal.sourceValue !== impl) return undefined;
				if (internal.deferChildAdopt || (EventEmitter && inherits(impl, EventEmitter))) return undefined;
				if (wrapper.___heldInstanceClass() !== null) return undefined;
				return Reflect.getPrototypeOf(impl);
			}

			/**
			 * The class of the instance a node fronts, when a node of the instance fronts that class too (#667). Such a node
			 * answers its class and prototype as the instance does, through the class's node. An instance of a class no node
			 * fronts answers null here: the class would reach the reader with no node around it.
			 * @param {UnifiedWrapper} wrapper - The node's wrapper.
			 * @returns {Function|null} The class, or null.
			 * @private
			 */
			___exportedInstanceClass() {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				const instanceClass = wrapper.___heldInstanceClass();
				if (instanceClass === null) return null;
				return nodeRefOf(FUNCTION_NODES, wrapper.slothlet, instanceClass) !== undefined ? instanceClass : null;
			}

			/**
			 * The node standing for the class of the instance a node fronts (#667): the node fronting the class when its module
			 * exports it, or else the class's member node at the instance's `constructor` (see instanceClassNode), so an
			 * instance of a class its module keeps to itself answers its prototype as one of an exported class does. Null for a
			 * node fronting no such instance, and for an emitter or a live grafted object, which answer their own prototype.
			 * @param {UnifiedWrapper} wrapper - The node's wrapper.
			 * @returns {Function|null} The class's node, or null.
			 * @private
			 */
			___instanceClassFront() {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				const internal = wrapper.____slothletInternal;
				const exported = wrapper.___exportedInstanceClass();
				if (exported !== null)
					return WeakRefMethods.deref(WeakMapMethods.get(WeakMapMethods.get(FUNCTION_NODES, wrapper.slothlet), exported));
				if (internal.deferChildAdopt || (EventEmitter && inherits(internal.impl, EventEmitter))) return null;
				return instanceClassNode(wrapper);
			}

			/**
			 * Whether a lazy node loaded as a namespace: its impl is a plain object, not a function, an array or a callable. Its
			 * proxy's function target stood in while it loaded, and its own `length` and `name` are no members of the node.
			 * @param {object} wrapper - The node's wrapper.
			 * @returns {boolean} True for such a node.
			 * @private
			 */
			___loadedAsNamespace() {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				const wrapper = this;
				const internal = wrapper.____slothletInternal;
				if (internal.mode !== "lazy" || !internal.state.materialized) return false;
				const impl = internal.impl;
				return (
					impl !== null &&
					typeof impl === "object" &&
					!Arrays.isArray(impl) &&
					resolveWrapper(impl)?.____slothletInternal.isCallable !== true
				);
			}
		}
	);
}
