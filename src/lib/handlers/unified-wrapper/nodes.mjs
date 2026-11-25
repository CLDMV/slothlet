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
 * @module @cldmv/slothlet/handlers/unified-wrapper/nodes
 * @internal
 */

import { util, EventEmitter } from "#helpers/platform";
import { copySourceOf, isCompositionLayer, layerMethodOriginal, layerUnderlying } from "#helpers/composition";
import { isFrameworkReservedKey } from "#helpers/reserved-keys";
import { handsOutAsModule } from "#handlers/frame-placement";
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
	NativeProxy,
	Number,
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
	WeakRef,
	WeakRefMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
import { CURRENT, handOutRaw, declaresPrivate, isLanguagePrototype, rawContent, versionAt } from "#helpers/run-snapshot";

import { ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 *
 * Upward (from layers above this one): hasOwn, FRAMEWORK_WRITES, runtime_frameworkWrite, SELF_VIEW_NODES, SELF_VIEW_READERS, HOST_READER, PROTOTYPE_HANDLE_READER, runtime_selfModuleReader, SELF_MEMBER_VIEWS, runtime_selfMemberView, runtime_holderFilePath, runtime_selfView, runtime_startPrototypes, runtime_checkpointFile, STAND_INS, runtime_retireChanges, runtime_enforceNodeReportRead, runtime_defineAdoptedAccessor, runtime_enforceCodeMember, runtime_recordedPrototype, runtime_memberHoldsCode, searchDepth, searchBudget, runtime_membrane, runtime_kindStandIn, runtime_atClassSite, PROTOTYPE_PATHS, runtime_knownPrototype, runtime_guardOn, runtime_emitterOwnPrototype, enforcePermission, runtime_implDefault, capturedViewChildren, capturedViewTargets, runtime_resolveRestartTarget, runtime_standInNode.
 */
let trustedRootOwn,
	leafOfCopy,
	markFrameworkInternal,
	hasOwn,
	FRAMEWORK_WRITES,
	runtime_frameworkWrite,
	SELF_VIEW_NODES,
	SELF_VIEW_READERS,
	HOST_READER,
	PROTOTYPE_HANDLE_READER,
	runtime_selfModuleReader,
	SELF_MEMBER_VIEWS,
	runtime_isIntrinsic,
	runtime_inherits,
	NODE_VALUE_OFS,
	runtime_selfMemberView,
	runtime_holderFilePath,
	runtime_selfView,
	runtime_startPrototypes,
	runtime_checkpointFile,
	STAND_INS,
	runtime_retireChanges,
	runtime_enforceNodeReportRead,
	runtime_wrapperReport,
	runtime_defineAdoptedAccessor,
	runtime_enforceCodeMember,
	runtime_recordedPrototype,
	runtime_ownsPrototype,
	runtime_inheritsFrom,
	runtime_holdsModuleMember,
	INTRINSICS,
	runtime_isSharedValue,
	runtime_isSlothletValue,
	runtime_isModuleProxy,
	runtime_isBuiltinFunction,
	runtime_memberHoldsCode,
	searchDepth,
	searchBudget,
	runtime_membrane,
	runtime_kindStandIn,
	runtime_atClassSite,
	PROTOTYPE_PATHS,
	runtime_knownPrototype,
	runtime_guardOn,
	runtime_emitterOwnPrototype,
	runtime_isHeldPrimitive,
	enforcePermission,
	runtime_implDefault,
	capturedViewChildren,
	capturedViewTargets,
	runtime_isRestartStale,
	runtime_resolveRestartTarget,
	runtime_isPosition,
	runtime_standInNode,
	isClassInstance,
	resolveWrapper,
	registeredWrapper;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/**
 * The `valueOf` a callable node answers (#630): `Object.prototype.valueOf` on whatever it is called on, as a function's
 * own `valueOf()` answers the function, and the node when it is called detached.
 * @param {Function} node - The node's proxy.
 * @returns {Function} The method.
 * @private
 */
function runtime_valueOfFor(node) {
	let method = WeakMapMethods.get(NODE_VALUE_OF_BY_NODE, node);
	if (method) return method;
	method = function valueOf() {
		return this === undefined || this === null ? node : Reflect.apply(PrototypeFunctions.Object.valueOf, this, []);
	};
	WeakSetMethods.add(NODE_VALUE_OFS, method);
	WeakMapMethods.set(NODE_VALUE_OF_BY_NODE, node, method);
	return method;
}

/** The method {@link runtime_valueOfFor} made for each node, made once per node. @type {WeakMap<Function, Function>} @private */
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
function runtime_viewAccessor(node, prop) {
	if (typeof prop !== "string") return null;
	const wrapper = runtime_nodeWrapperOf(node);
	if (wrapper === null || isFrameworkReservedKey(prop)) return null;
	const held = Reflect.getOwnPropertyDescriptor(wrapper, prop);
	if (held === undefined || "value" in held) return null;
	const original = runtime_originalAccessor(held);
	if (original.get === held.get && original.set === held.set) return null;
	return { wrapper, get: original.get, set: original.set };
}

/**
 * Whether `node.__proto__ = x` on a node runs the language's own `__proto__` setter, as the set trap does for a node
 * fronting a module's own object that holds no `__proto__` member (#757); any other node takes it as a member write.
 * @param {*} node - The node, as a run's view reads through it.
 * @returns {boolean} True when the assignment sets the prototype.
 * @internal
 */
function runtime_protoAssignSetsPrototype(node) {
	const wrapper = runtime_nodeWrapperOf(node);
	return wrapper !== null && !hasOwn(wrapper, "__proto__") && runtime_moduleObjectOf(wrapper) !== null;
}

/**
 * The wrapper behind a node as a reader is handed it (see {@link runtime_isApiNode}), or null.
 * @param {*} value - The node.
 * @returns {object|null} The wrapper.
 * @internal
 */
function runtime_nodeWrapperOf(value) {
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
function runtime_nodeOpen(node) {
	let target = WeakMapMethods.get(NODE_TARGETS, node);
	if (target === undefined) {
		const wrapper = runtime_nodeWrapperOf(node);
		target = wrapper === null ? undefined : WeakMapMethods.get(NODE_TARGETS, wrapper);
	}
	return target === undefined || Reflect.isExtensible(target);
}

/**
 * The prototype a run reads a node as inheriting from, when that differs from what the node reports now: the one it
 * held when the run started, when the instance set another on it since, or the run's view of it, when the instance
 * changed that prototype of a module's own since (see {@link runtime_inheritedAtStart}). Undefined when the run reads
 * the node's prototype as the node reports it.
 * @param {*} node - The node, as the run's view reads through it.
 * @param {{prototype?: (object|null|symbol)}|null} version - The node's saved version, if any.
 * @param {object} snap - The run's snapshot.
 * @returns {{prototype: (object|null)}|undefined} The prototype.
 * @internal
 */
function runtime_prototypeAtStart(node, version, snap) {
	const wrapper = runtime_nodeWrapperOf(node);
	if (wrapper === null || snap === null || snap === undefined || snap.closed) return undefined;
	const held = runtime_startPrototypes(wrapper, version);
	if (held === undefined) return undefined;
	const { start, now } = held;
	if (start === null || isLanguagePrototype(start) || resolveWrapper(start) !== null)
		return start === now ? undefined : { prototype: start };
	if (start === now && !runtime_contentChanged(rawContent(snap, start), start)) return undefined;
	return { prototype: handOutRaw(snap, start) };
}

/**
 * Whether a saved version of an object holds other than the object does now: other members, other attributes, or
 * another prototype. Read by descriptors only.
 * @param {object} content - The version (or the object itself).
 * @param {object} raw - The object.
 * @returns {boolean} True when it does.
 * @private
 */
function runtime_contentChanged(content, raw) {
	if (content === raw) return false;
	if (Reflect.getPrototypeOf(content) !== Reflect.getPrototypeOf(raw)) return true;
	const keys = Reflect.ownKeys(raw);
	if (Reflect.ownKeys(content).length !== keys.length) return true;
	for (let index = 0; index < keys.length; index++) {
		const now = Reflect.getOwnPropertyDescriptor(raw, keys[index]);
		const then = Reflect.getOwnPropertyDescriptor(content, keys[index]);
		if (then === undefined || !runtime_sameLookup({ from: content, described: then }, { from: raw, described: now })) return true;
	}
	return false;
}

/**
 * Whether two lookups (see {@link runtime_inheritedLookup}) answer the same: the same member found, or the same end.
 * @param {{from: (object|null), described: (object|undefined)}} a - One.
 * @param {{from: (object|null), described: (object|undefined)}|undefined} b - The other.
 * @returns {boolean} True when they do.
 * @private
 */
function runtime_sameLookup(a, b) {
	if (b === undefined) return false;
	if (a.described === undefined || b.described === undefined) return a.described === b.described && a.from === b.from;
	const x = a.described;
	const y = b.described;
	return Objects.is(x.value, y.value) && x.get === y.get && x.set === y.set && "value" in x === "value" in y;
}

/**
 * The prototype of a class a function node fronts (its function's own `prototype`), as the module holds it, or null.
 * @param {*} node - The node.
 * @returns {object|null} The prototype.
 * @internal
 */
function runtime_classPrototypeOf(node) {
	const wrapper = runtime_nodeWrapperOf(node);
	return wrapper === null ? null : runtime_wrapperClassPrototype(wrapper);
}

/**
 * {@link runtime_classPrototypeOf}, by the node's wrapper.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {object|null} The prototype.
 * @private
 */
function runtime_wrapperClassPrototype(wrapper) {
	const impl = wrapper.____slothletInternal.impl;
	if (typeof impl !== "function") return null;
	const described = Reflect.getOwnPropertyDescriptor(layerUnderlying(impl), "prototype");
	const value = described !== undefined && "value" in described ? described.value : null;
	return value !== null && typeof value === "object" ? value : null;
}

/**
 * The receiver a function a run's view handed out runs with when it is called on the run's view of a node fronting an
 * instance of a class that declares `#private` fields: the instance itself, where its private fields are, once the
 * node's file is saved for the runs open (see {@link runtime_checkpointFile}), as before a call through the node. Null
 * for any other node.
 * @param {*} node - The node the view reads through.
 * @returns {object|null} The instance.
 * @internal
 */
function runtime_privateCallReceiver(node) {
	const wrapper = runtime_nodeWrapperOf(node);
	const impl = wrapper?.____slothletInternal?.impl;
	if (impl === null || impl === undefined || typeof impl !== "object") return null;
	const instance = layerUnderlying(impl);
	// A Proxy is asked nothing: reading its prototype would run its traps.
	if (instance === null || typeof instance !== "object" || util.types.isProxy(instance) || !declaresPrivate(instance)) return null;
	runtime_checkpointFile(wrapper);
	return instance;
}

/**
 * The content a node had when a run started, when the instance has changed it since (see {@link runtime_captureNode}),
 * or null when the node is as it was.
 * @param {*} node - The node, as the run's view reads through it.
 * @param {object|null|undefined} snap - The run's snapshot (see `helpers/run-snapshot`).
 * @returns {{members: Map<PropertyKey, (object|symbol)>}|null} The content.
 * @internal
 */
function runtime_nodeVersion(node, snap) {
	if (snap === null || snap === undefined || snap.closed) return null;
	const wrapper = runtime_nodeWrapperOf(node);
	if (wrapper === null) return null;
	const held = versionAt(snap.instance, wrapper, snap.base);
	return held === CURRENT ? null : held;
}

/**
 * Whether a value read through a node now is the member a node's saved version holds: the same child node (or a view of
 * it), the node fronting the same object, or the same value.
 * @param {*} live - What the node hands out now.
 * @param {*} held - What the version holds.
 * @returns {boolean} True when they are one.
 * @internal
 */
function runtime_sameSnapshotMember(live, held) {
	if (live === held) return true;
	if (live === null || (typeof live !== "object" && typeof live !== "function")) return false;
	if (held === null || (typeof held !== "object" && typeof held !== "function")) return false;
	const liveWrapper = runtime_nodeWrapperOf(live);
	if (liveWrapper === null) return false;
	const heldWrapper = runtime_nodeWrapperOf(held);
	if (heldWrapper !== null) return heldWrapper === liveWrapper;
	const internal = liveWrapper.____slothletInternal;
	return internal.impl === held || internal.sourceValue === held || internal.moduleObject === held;
}

/**
 * The api path of the node a view of `self` stands over: the node's own, or for a stand-in kept from before its folder
 * loaded, its node's path and the chain read off it.
 * @param {object} child - The view's child: a node or a stand-in.
 * @param {object} inner - The child's wrapper.
 * @returns {string} The api path.
 * @private
 *
 * @example
 * runtime_viewNodePath(standIn, wrapper); // "d.fn"
 */
function runtime_viewNodePath(child, inner) {
	const chain = WeakMapMethods.get(WAITING_CHAINS, child);
	const base = inner.____slothletInternal.apiPath;
	if (!chain || chain.length === 0) return base;
	const tail = ArrayMethods.join(mapList(chain, String), ".");
	return base ? base + "." + tail : tail;
}

/**
 * The node a value read out of the api stands for: through any per-reader view (`self`'s or a captured one) to the
 * node itself, and from a node a restart replaced to the live one at its path.
 * @param {*} value - A value read out of the api.
 * @returns {*} The node, or the value itself when it is none.
 * @private
 * @example
 * runtime_reportedNode(self.math); // the api.math proxy behind the view
 */
function runtime_reportedNode(value) {
	let current = value;
	for (let guard = 0; guard < 16 && current !== null && (typeof current === "object" || typeof current === "function"); guard++) {
		const next = WeakMapMethods.get(SELF_VIEW_NODES, current) ?? WeakMapMethods.get(capturedViewTargets, current);
		if (next === undefined || next === current) break;
		// A node's own proxy is the node: a view mapping that leads off it (to the value it holds) is not followed.
		if (resolveWrapper(current) !== null && resolveWrapper(next) === null) break;
		current = next;
	}
	return runtime_liveThis(current);
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
 * runtime_metadataNodeOf(api.calls.ping); // { wrapper: <calls>, chain: ["ping"] } before calls has loaded
 */
function runtime_metadataNodeOf(value) {
	const wrapper = resolveWrapper(value);
	if (wrapper === null) return null;
	const chain = WeakMapMethods.get(WAITING_CHAINS, value) ?? WeakMapMethods.get(WAITING_CHAINS, runtime_reportedNode(value));
	if (!chain || chain.length === 0) return { wrapper, chain: null };
	let reached;
	try {
		reached = runtime_standInNode(wrapper, chain);
	} catch {
		// A reader the rules deny what the chain reaches: the path names the node all the same.
		reached = STAND_IN_UNLOADED;
	}
	if (reached !== STAND_IN_UNLOADED && reached !== null && (typeof reached === "object" || typeof reached === "function")) {
		const reachedNode = runtime_reportedNode(reached);
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
 * runtime_nodeReport(slothlet, api.math.add).path; // ["math", "add"]
 */
function runtime_nodeReport(slothlet, target) {
	// A segment array names a path; an array-backed node (its proxy is an array too) is a node.
	if (typeof target === "string" || (Arrays.isArray(target) && resolveWrapper(runtime_reportedNode(target)) === null)) {
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
		const holder = resolveWrapper(runtime_reportedNode(current));
		if (holder === null && !slothlet.handlers?.versionManager?.dispatcherOf?.(runtime_reportedNode(current))) {
			const parentWrapper = resolveWrapper(runtime_reportedNode(parent));
			if (parentWrapper === null) return undefined;
			return Objects.freeze(runtime_wrapperReport(parentWrapper, mapList(segments, String), { value: current }));
		}
		target = current;
	}

	const node = runtime_reportedNode(target);
	const wrapper = resolveWrapper(node);
	if (wrapper === null) {
		// A version dispatcher mounted as the logical path's node itself.
		const dispatcher = slothlet.handlers?.versionManager?.dispatcherOf?.(node);
		if (!dispatcher) return undefined;
		const resolved = dispatcher.resolve();
		const resolvedWrapper = resolved ? resolveWrapper(runtime_reportedNode(resolved)) : null;
		if (!resolvedWrapper) return undefined;
		runtime_enforceNodeReportRead(resolvedWrapper, String(resolvedWrapper.____slothletInternal.apiPath ?? ""), undefined);
		const report = runtime_wrapperReport(resolvedWrapper);
		report.logical = Objects.freeze(splitText(dispatcher.logicalPath, "."));
		return Objects.freeze(report);
	}

	const chain = WeakMapMethods.get(WAITING_CHAINS, node);
	if (chain && chain.length > 0) {
		// A stand-in for a chain below a lazy node: once the node has loaded, the report of what the chain reads as.
		const viewPath = runtime_viewNodePath(node, wrapper);
		runtime_enforceNodeReportRead(wrapper, viewPath, undefined);
		const reached = runtime_standInNode(wrapper, chain);
		if (reached !== STAND_IN_UNLOADED) {
			if (reached === undefined) return undefined;
			const reachedNode = runtime_reportedNode(reached);
			if (resolveWrapper(reachedNode) !== null && !WeakSetMethods.has(STAND_INS, reachedNode))
				return runtime_nodeReport(slothlet, reachedNode);
			const base = slothlet.handlers?.versionManager?.pathSegments?.(String(wrapper.____slothletInternal.apiPath ?? "")) ?? [];
			return Objects.freeze(runtime_wrapperReport(wrapper, concatLists(base, mapList(chain, String)), { value: reached }));
		}
		const base = slothlet.handlers?.versionManager?.pathSegments?.(String(wrapper.____slothletInternal.apiPath ?? "")) ?? [];
		return Objects.freeze(runtime_wrapperReport(wrapper, concatLists(base, mapList(chain, String))));
	}

	runtime_enforceNodeReportRead(wrapper, String(wrapper.____slothletInternal.apiPath ?? ""), undefined);

	// A version dispatcher reports the version it resolves to for this caller, with the logical path it was read at.
	const dispatcher = slothlet.handlers?.versionManager?.dispatcherOf?.(wrapper.____slothletInternal.impl);
	if (dispatcher) {
		const logical = Objects.freeze(splitText(dispatcher.logicalPath, "."));
		const resolved = dispatcher.resolve();
		const resolvedWrapper = resolved ? resolveWrapper(runtime_reportedNode(resolved)) : null;
		if (resolvedWrapper)
			runtime_enforceNodeReportRead(resolvedWrapper, String(resolvedWrapper.____slothletInternal.apiPath ?? ""), undefined);
		const report = resolvedWrapper ? runtime_wrapperReport(resolvedWrapper) : runtime_wrapperReport(wrapper);
		report.logical = logical;
		return Objects.freeze(report);
	}
	return Objects.freeze(runtime_wrapperReport(wrapper));
}

/**
 * The module's own getter or setter behind each half of an accessor adoption puts on a wrapper, so a
 * copy of the member onto another node runs it on the node it lands on (#585 review).
 * @type {WeakMap<Function, Function>}
 */
const ADOPTED_ACCESSORS = new WeakMap();

/**
 * The prototype a member reaches a node fronting a module's own object from, when the object inherits it from a
 * prototype set on it (#757) and the node's own copy of the object holds no member by that key: null otherwise, and
 * for a member of `Object.prototype`, which the node's copy inherits too.
 * @param {object} wrapper - The node's wrapper.
 * @param {PropertyKey} prop - The member's key.
 * @returns {object|null} The prototype to read it from, or null.
 * @private
 */
function runtime_moduleInheritance(wrapper, prop) {
	const internal = wrapper.____slothletInternal;
	if (internal.moduleObject === null || internal.moduleObject === undefined) return null;
	const impl = internal.impl;
	if (impl === null || typeof impl !== "object" || Reflect.has(impl, prop)) return null;
	const object = runtime_moduleObjectOf(wrapper);
	if (object === null) return null;
	const prototype = Reflect.getPrototypeOf(object);
	return prototype !== null && prototype !== Objects.prototype && Reflect.has(prototype, prop) ? prototype : null;
}

/**
 * Whether a node has the prototype it was given through the node (`Object.setPrototypeOf(node, …)`), rather than the
 * one its value came with (see {@link runtime_ownsPrototype}).
 * @param {object} wrapper - The node's wrapper.
 * @returns {boolean} Whether it was given one.
 * @private
 */
function runtime_prototypeGiven(wrapper) {
	if (!runtime_ownsPrototype(wrapper)) return false;
	runtime_recordedPrototype(wrapper);
	return wrapper.____slothletInternal.prototypeGiven;
}

/**
 * Whether a prototype set on a node would be set on a value the module holds (its own object, its array, a class
 * instance or emitter it exports) rather than on the node's own record (see the node's setPrototypeOf trap).
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {boolean} True when the module's value takes it.
 * @private
 */
function runtime_prototypeOnSharedValue(wrapper) {
	if (MapMethods.has(FRAMEWORK_WRITES, wrapper)) return false;
	const internal = wrapper.____slothletInternal;
	const impl = internal.impl;
	if (runtime_moduleObjectOf(wrapper) !== null || Arrays.isArray(impl)) return true;
	return (
		impl !== null &&
		typeof impl === "object" &&
		!util.types.isProxy(impl) &&
		hasOwn(internal, "sourceValue") &&
		internal.sourceValue === impl
	);
}

/**
 * A member of a function node's function, as the node reads it: one the function does not hold itself comes from the
 * prototype on the node's record (see {@link runtime_ownsPrototype}), read on the function.
 * @param {object} wrapper - The node's wrapper.
 * @param {Function} fn - The function.
 * @param {PropertyKey} prop - The member's key.
 * @returns {*} The member.
 * @private
 */
function runtime_functionMember(wrapper, fn, prop) {
	// While the node's prototype is its function's own, the function answers for what it inherits.
	if (fn !== wrapper.____slothletInternal.impl || !runtime_prototypeGiven(wrapper)) return fn[prop];
	const prototype = runtime_inheritsFrom(wrapper, prop);
	if (prototype === undefined) return fn[prop];
	return prototype === null ? undefined : Reflect.get(prototype, prop, fn);
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
 * runtime_moduleObjectOf(resolveWrapper(api.m.config)); // the `config` object m.mjs exports
 */
function runtime_moduleObjectOf(wrapper, prop = undefined) {
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
function runtime_moduleObjectFor(wrapper, value, asMember) {
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
		runtime_moduleObjectKeys(root);
		WeakMapMethods.set(MODULE_OBJECT_SEEN, wrapper, { object: root, members: runtime_moduleObjectMembers(root) });
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
function runtime_moduleObjectKeys(object) {
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
function runtime_moduleObjectMembers(object) {
	const members = new Map();
	for (let ofIndex = 0, ofList = Objects.getOwnPropertyNames(object); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		MapMethods.set(members, key, Reflect.getOwnPropertyDescriptor(object, key));
	}
	return members;
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
function runtime_moduleMemberChanged(wrapper, object, key, held) {
	let seen = WeakMapMethods.get(MODULE_OBJECT_SEEN, wrapper);
	if (seen === undefined || seen.object !== object) {
		// A node handed another node's object (a reload reusing it) was just built from that object as it is.
		seen = { object, members: runtime_moduleObjectMembers(object) };
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

/**
 * Bring one member a node fronts in step with the module's own object (#757): the module may change its object
 * itself after the node was built (`config.port = 90` in its own code), and a read through the node gives what the
 * object holds, as a read of the object does. A member the module replaced is adopted again, as the build adopts
 * one; one it added is adopted; one it deleted is taken off the node. Only the node is changed, as the framework's
 * own write: the module made the change.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {object} object - The module's object.
 * @param {Set<string>} seen - The members the object has held (see {@link runtime_moduleObjectKeys}).
 * @param {string} key - The member's key.
 * @returns {void}
 * @private
 */
function runtime_followModuleMember(wrapper, object, seen, key) {
	if (isFrameworkReservedKey(key)) return;
	const internal = wrapper.____slothletInternal;
	// A member the other side of a collision won, and a named export beside an object default's members, is the node's.
	if (
		(internal.collisionMergedKeys ? SetMethods.has(internal.collisionMergedKeys, key) : false) ||
		runtime_moduleObjectOf(wrapper, key) === null
	)
		return;
	const held = Reflect.getOwnPropertyDescriptor(object, key);
	if (!runtime_moduleMemberChanged(wrapper, object, key, held)) return;
	const mine = Reflect.getOwnPropertyDescriptor(wrapper, key);
	if (mine !== undefined && !mine.configurable) return;
	if (held === undefined) {
		if (mine === undefined || !SetMethods.has(seen, key)) return;
		SetMethods.delete(seen, key);
		const displaced = "value" in mine ? resolveWrapper(mine.value) : null;
		if (displaced) runtime_retireChanges(displaced);
		Reflect.deleteProperty(wrapper, key);
		if (internal.readOnlyKeys) SetMethods.delete(internal.readOnlyKeys, key);
		return;
	}
	// The build adopts an object's enumerable members only.
	if (!held.enumerable) return;
	SetMethods.add(seen, key);
	if (mine !== undefined && runtime_holdsModuleMember(mine, held)) return;
	if (!("value" in held)) {
		runtime_defineAdoptedAccessor(wrapper, key, held);
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
		if (displaced) runtime_retireChanges(displaced);
		const wrapped = wrapper.___createChildWrapper(key, value, null, internal.deferChildAdopt);
		if (wrapped !== null && wrapped !== undefined) stored = wrapped;
	}
	Objects.defineProperty(wrapper, key, { __proto__: null, value: stored, writable: false, enumerable: true, configurable: true });
}

/**
 * What {@link runtime_nodePrimitive} answers for a node holding no primitive.
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
function runtime_nodePrimitive(wrapper) {
	const internal = wrapper.____slothletInternal;
	if (internal.mode === "lazy" && !internal.state.materialized) return NO_NODE_PRIMITIVE;
	const impl = internal.impl;
	return runtime_isHeldPrimitive(impl) ? impl : NO_NODE_PRIMITIVE;
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
function runtime_followModuleObject(wrapper, target, prop, integrity = true) {
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
	const object = runtime_moduleObjectOf(wrapper);
	if (object === null) return;
	internal.followingModule = true;
	try {
		const seen = runtime_moduleObjectKeys(object);
		if (prop !== undefined) {
			runtime_followModuleMember(wrapper, object, seen, prop);
			return;
		}
		for (let ofIndex = 0, ofList = Objects.keys(object); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			runtime_followModuleMember(wrapper, object, seen, key);
		}
		for (let ofIndex = 0, ofList = setToArray(seen); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (!hasOwn(object, key)) runtime_followModuleMember(wrapper, object, seen, key);
		}
	} finally {
		internal.followingModule = false;
	}
	if (prop === undefined && integrity) runtime_followModuleIntegrity(wrapper, target);
}

/**
 * Close a node when the module closed its own object itself (#757), as the build closes a node over a closed object:
 * its members are brought in step first, then it is frozen, sealed or made non-extensible as the object is.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {object} target - The proxy's target.
 * @returns {void}
 * @private
 */
function runtime_followModuleIntegrity(wrapper, target) {
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
	const object = runtime_moduleObjectOf(wrapper);
	if (object === null || Reflect.isExtensible(object)) return;
	runtime_followModuleObject(wrapper, target, undefined, false);
	const { proxy } = internal;
	const syncing = internal.integritySyncing;
	internal.integritySyncing = true;
	try {
		runtime_frameworkWrite(wrapper, () => {
			if (Objects.isFrozen(object)) Objects.freeze(proxy);
			else if (Objects.isSealed(object)) Objects.seal(proxy);
			else Objects.preventExtensions(proxy);
		});
	} finally {
		internal.integritySyncing = syncing;
	}
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
function runtime_reportsWritable(wrapper, prop) {
	if (wrapper.____slothletInternal.readOnlyKeys && SetMethods.has(wrapper.____slothletInternal.readOnlyKeys, prop)) return false;
	const impl = wrapper.____slothletInternal.impl;
	const live = impl !== null && (typeof impl === "object" || typeof impl === "function") && !util.types.isProxy(impl) ? impl : null;
	const holder = runtime_moduleObjectOf(wrapper) ?? live;
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
 * runtime_originalAccessor(Object.getOwnPropertyDescriptor(wrapper, "total"));
 */
function runtime_originalAccessor(descriptor) {
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
 * they are (see runtime_exposePrototype).
 * @type {WeakMap<object, {byID: Map<string, object>, byWrapper: WeakMap<object, object>}>}
 * @private
 */
const MAKERS = new WeakMap();

/**
 * The node whose prototype slothlet itself is reading, unchecked (see {@link runtime_heldPrototypeOf}).
 * @type {object|null}
 * @private
 */
const nodesShared = {
	__proto__: null,
	heldPrototypeRead: null
};

/**
 * The prototype a node holds, read by slothlet itself without the reader's check (#632): a view mirroring a closed
 * node onto its shadow has to hold what the node holds. Only the node's own trap runs for the read, so no module code
 * can run while it is unchecked.
 * @param {object} node - A node's proxy.
 * @returns {object|null} Its prototype.
 * @private
 */
function runtime_heldPrototypeOf(node) {
	const previous = nodesShared.heldPrototypeRead;
	nodesShared.heldPrototypeRead = resolveWrapper(node);
	try {
		return Reflect.getPrototypeOf(node);
	} finally {
		nodesShared.heldPrototypeRead = previous;
	}
}

/**
 * The record of the module a wrapper belongs to (see {@link MAKERS}): one per module of an instance, so the same
 * value a module hands out from any of its functions is the same stand-in.
 * @param {object} wrapper - A wrapper of the module.
 * @returns {{owner: object, made: WeakMap<object, object>, madeBy: WeakMap<object, WeakMap<object, object>>|null, handedIn: WeakSet<object>, exposed: WeakSet<object>}} The module's record.
 * @private
 */
function runtime_makerOf(wrapper) {
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
 * Run a lazy node's load apart from every instance's flow (#726): what the load runs is the module's own code, as an
 * eager tree's build runs it before any call, so it never runs inside the call that asked for the load.
 * @param {object} slothlet - The instance.
 * @param {function(): Promise<*>} load - The load.
 * @returns {Promise<*>} What it resolves to.
 * @private
 */
function runtime_loadApart(slothlet, load, wrapper) {
	const contextManager = slothlet?.contextManager;
	// The live runtime keeps, apart from every flow, the marks the asking flow carries (a load into a run's tree is that
	// tree's build): it carries them with its flows, which a detached load would leave.
	const apart = () =>
		typeof contextManager?.runLoadApart === "function"
			? contextManager.runLoadApart(load)
			: typeof contextManager?.runDetached === "function"
				? contextManager.runDetached(load, undefined, [])
				: load();
	// A node of a copy a run keeps across a reload loads as that copy did (see Slothlet#loadID), and a node of a tree a
	// run owns loads into that tree's own handlers.
	return typeof slothlet?.loadAsCaller === "function" ? slothlet.loadAsCaller(apart, wrapper) : apart();
}

/**
 * The context a module's code runs in as its maker: the instance's (#597). A reload switches the instance to its new
 * ID only once that ID's context is set up, so the instance's ID always names a context while it runs.
 * @param {object} slothlet - The instance.
 * @returns {string|null} The context's ID, or null when the instance has none.
 * @private
 */
function runtime_makerInstanceID(slothlet) {
	const current = slothlet.instanceID;
	return current && MapMethods.has(slothlet.contextManager.instances, current) ? current : null;
}

/**
 * What a module is handed for a node's own function, or a module's copy of one (see {@link runtime_gateLeafCopy}),
 * another module passes it: the node, for the node's own function (as handing it out gives, #726), and for a copy a
 * stand-in checked as a call of the node each time it runs. Null when the function is neither, belongs to the
 * receiving module itself, or the permission system is off or disabled: the function is then handed in as it is.
 * @param {object} maker - The receiving module's record.
 * @param {object} owner - The wrapper of the module's leaf it is handed to.
 * @param {Function} value - The function.
 * @returns {Function|null} What the module gets, or null.
 * @private
 */
function runtime_leafFunctionHandedIn(maker, owner, value) {
	const slothlet = owner?.slothlet ?? maker?.owner?.slothlet;
	if (!slothlet?.handlers?.permissionManager?.isEnabled?.() || util.types.isProxy(value)) return null;
	const leaf = WeakMapMethods.get(trustedRootOwn.implWrappers, value);
	if (leaf !== undefined) {
		if (!WeakSetMethods.has(trustedRootOwn.genuineWrappers, leaf) || leaf.slothlet !== slothlet || runtime_makerOf(leaf) === maker)
			return null;
		const node = leaf.____slothletInternal.proxy;
		return typeof node === "function" ? node : null;
	}
	const node = leafOfCopy(slothlet, value);
	if (node === null) return null;
	const nodeMaker = runtime_makerOf(node);
	if (nodeMaker === maker) return null;
	if (util.types.isGeneratorFunction(value) || util.types.isAsyncFunction(value)) return runtime_kindStandIn(nodeMaker, node, value);
	return runtime_membrane(nodeMaker, node, value);
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
function runtime_nodeAtPath(slothlet, apiPath) {
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

/**
 * Whether an instance a module constructs through a node is handed out as the node's module's, under `"fast"` as under
 * `"precise"`: its `constructor` is the node's function, whose members the rules could refuse the module a read of
 * (see {@link runtime_constructorReadMayRefuse}), so the instance has to hand back the node, not the function. The host
 * constructing, and a module no read beneath the node could be refused to, get the instance itself.
 * @param {object} wrapper - The node's wrapper.
 * @returns {boolean} True when the instance is handed out as the module's.
 * @private
 */
/**
 * Whether an object's prototype chain holds a `constructor` that is a function an api node stands for whose members
 * the rules could refuse `reader` a read of (see {@link runtime_constructorReadMayRefuse}). Found by descriptors alone.
 * @param {object} slothlet - The instance.
 * @param {object|null} reader - The module the object reaches.
 * @param {object} value - The object.
 * @returns {boolean} True when a read could be refused.
 * @private
 */
function runtime_instanceReadMayRefuse(slothlet, reader, value) {
	if (!reader?.____slothletInternal) return false;
	const readerPath = String(reader.____slothletInternal.apiPath ?? "");
	for (let link = Reflect.getPrototypeOf(value), depth = 0; link !== null && depth < 64; depth++) {
		// A Proxy on the chain runs code of its own to answer: what lies beyond it cannot be told without running it.
		if (util.types.isProxy(link)) return false;
		if (runtime_constructorReadMayRefuse(slothlet, readerPath, link)) return true;
		link = Reflect.getPrototypeOf(link);
	}
	return false;
}

/**
 * Whether an instance a module constructs through a node is handed out as the node's module's under `"fast"`, as
 * under `"precise"` (see {@link runtime_instanceHoldsReads}).
 * @param {object} wrapper - The node's wrapper.
 * @returns {boolean} True when the instance is handed out as the module's.
 * @private
 */
function runtime_instanceHoldsReads(wrapper) {
	const slothlet = wrapper.slothlet;
	const permissionManager = slothlet.handlers?.permissionManager;
	if (!permissionManager?.isEnabled?.()) return false;
	const reader = runtime_selfModuleReader(slothlet);
	if (reader === null) return false;
	if (!reader?.____slothletInternal) return true;
	return permissionManager.readMayRefuseBeneath(
		String(reader.____slothletInternal.apiPath ?? ""),
		String(wrapper.____slothletInternal.apiPath ?? "")
	);
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
function runtime_exposePrototype(wrapper, prototype) {
	if (prototype === null || typeof prototype !== "object") return prototype;
	if (!wrapper?.slothlet?.instanceID || !wrapper.slothlet.contextManager?.runInContext) return prototype;
	WeakSetMethods.add(runtime_makerOf(wrapper).exposed, prototype);
	return prototype;
}

/**
 * Record a value written onto a module's node as handed to that module (#597), unless the module itself writes it:
 * handed back out, it is the writer's value as it was, never the module's code.
 * @param {object} wrapper - The node's wrapper.
 * @param {*} value - The value written.
 * @returns {void}
 * @private
 */
function runtime_markWritten(wrapper, value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
	if (!wrapper?.slothlet?.instanceID || !wrapper.slothlet.contextManager?.runInContext || !handsOutAsModule(wrapper)) return;
	if (runtime_isSlothletValue(value) || WeakSetMethods.has(INTRINSICS, value)) return;
	const maker = runtime_makerOf(wrapper);
	if (WeakMapMethods.has(maker.made, value)) return;
	const writer = wrapper.slothlet.contextManager.tryGetContext?.(wrapper.slothlet.instanceID)?.currentWrapper ?? null;
	if (writer && WeakSetMethods.has(trustedRootOwn.genuineWrappers, writer) && runtime_makerOf(writer) === maker) return;
	WeakSetMethods.add(maker.handedIn, value);
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
 * Record `wrapper`'s node as the one fronting its function, when its file exports that function, unless another node of
 * the instance already does.
 * @param {UnifiedWrapper} wrapper - The node's wrapper, whose proxy exists.
 * @returns {void}
 * @private
 */
function runtime_recordFunctionNode(wrapper) {
	const { impl, proxy, filePath } = wrapper.____slothletInternal;
	if (typeof impl !== "function" || !wrapper.slothlet) return;
	// A function node built over a folder's or a mount's default function holds slothlet's layer over it: the function
	// behind the layer is the one its `prototype.constructor` names, so it is fronted by this node too.
	if (isCompositionLayer(impl)) runtime_recordLayerFront(wrapper.slothlet, layerUnderlying(impl), proxy);
	// Only a function its file exports stands for it: a node built for one the module did not export (a class reached
	// through an instance's members) is a member of that instance, not the class's own node.
	if (!filePath || !wrapper.slothlet.handlers?.ownership?.resolveExportPath?.(filePath, impl)) return;
	let byFunction = WeakMapMethods.get(FUNCTION_NODES, wrapper.slothlet);
	if (!byFunction) WeakMapMethods.set(FUNCTION_NODES, wrapper.slothlet, (byFunction = new WeakMap()));
	if ((WeakMapMethods.get(byFunction, impl) == null ? undefined : WeakRefMethods.deref(WeakMapMethods.get(byFunction, impl))) === undefined)
		WeakMapMethods.set(byFunction, impl, new WeakRef(proxy));
	WeakMapMethods.set(CLASS_INSTANCES, impl, new WeakRef(wrapper.slothlet));
	// Every node fronting it, for a class exported under more than one name (#667).
	let everyFunction = WeakMapMethods.get(FUNCTION_NODE_SETS, wrapper.slothlet);
	if (!everyFunction) WeakMapMethods.set(FUNCTION_NODE_SETS, wrapper.slothlet, (everyFunction = new WeakMap()));
	const live = filterList(WeakMapMethods.get(everyFunction, impl) ?? [], (ref) => WeakRefMethods.deref(ref) !== undefined);
	if (!ArrayMethods.some(live, (ref) => WeakRefMethods.deref(ref) === proxy)) listPush(live, new WeakRef(proxy));
	WeakMapMethods.set(everyFunction, impl, live);
}

/**
 * The node fronting each function slothlet laid a layer over (a folder's or a mount's default function, see
 * {@link runtime_recordFunctionNode}), per instance, held weakly as {@link FUNCTION_NODES} is.
 * @type {WeakMap<object, WeakMap<Function, WeakRef<Function>>>}
 * @private
 */
const LAYER_FRONTS = new WeakMap();

/**
 * Record `node` as the one fronting `fn` behind its layer, unless another live node of the instance already does.
 * @param {object} slothlet - The instance.
 * @param {*} fn - The function behind the layer.
 * @param {Function} node - The node.
 * @returns {void}
 * @private
 */
function runtime_recordLayerFront(slothlet, fn, node) {
	if (typeof fn !== "function") return;
	let byFunction = WeakMapMethods.get(LAYER_FRONTS, slothlet);
	if (!byFunction) WeakMapMethods.set(LAYER_FRONTS, slothlet, (byFunction = new WeakMap()));
	if ((WeakMapMethods.get(byFunction, fn) == null ? undefined : WeakRefMethods.deref(WeakMapMethods.get(byFunction, fn))) === undefined)
		WeakMapMethods.set(byFunction, fn, new WeakRef(node));
}

/**
 * Every node fronting each function of a module's, per instance (#667): a class exported under two names
 * (`export { Foo, Foo as Alias }`) has a node at each. Held weakly, as {@link FUNCTION_NODES} is.
 * @type {WeakMap<object, WeakMap<Function, Array<WeakRef<Function>>>>}
 * @private
 */
const FUNCTION_NODE_SETS = new WeakMap();

/**
 * The site of the `prototype` of every node fronting the class whose own prototype `prototype` is (#667), found by
 * descriptors alone as {@link runtime_prototypeClassNode} finds the first: one per name the class is exported as. Empty
 * for any other prototype.
 * @param {object} slothlet - The instance.
 * @param {*} prototype - The prototype.
 * @returns {Array<{parts: string[], key: string, prop: string|null}>} The sites.
 * @private
 */
function runtime_classPrototypeSites(slothlet, prototype) {
	if (runtime_prototypeClassNode(slothlet, prototype) === undefined) return [];
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
		const site = runtime_prototypeSiteOf(resolveWrapper(node), "prototype");
		if (!ArrayMethods.some(sites, (known) => known.key === site.key)) listPush(sites, site);
	}
	return sites;
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
function runtime_heldInstanceClass(wrapper) {
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
 * The node fronting the class whose own prototype `prototype` is (#667), found by descriptors alone so none of the
 * module's code runs to find it: the prototype's own `constructor` is a class a node of the instance fronts, and that
 * class's own `prototype` is this prototype. `undefined` for any other prototype.
 * @param {object} slothlet - The instance.
 * @param {*} prototype - The prototype.
 * @returns {Function|undefined} The class's node.
 * @private
 */
function runtime_prototypeClassNode(slothlet, prototype) {
	if (prototype === null || typeof prototype !== "object" || util.types.isProxy(prototype)) return undefined;
	const owner = Reflect.getOwnPropertyDescriptor(prototype, "constructor")?.value;
	if (typeof owner !== "function" || util.types.isProxy(owner)) return undefined;
	if (Reflect.getOwnPropertyDescriptor(owner, "prototype")?.value !== prototype) return undefined;
	return nodeRefOf(FUNCTION_NODES, slothlet, owner);
}

/**
 * A class's prototype, or an instance's, as a node hands it to whoever reads it (#667): its handle at the node's path
 * ({@link runtime_prototypeHandle}), the same to every module and to the host, so each read and change through it is
 * decided at that path for whoever makes it, and each prototype further up its chain is its own class's handle. The path
 * is recorded, so a holder handing the object on hands it as reading it there would ({@link runtime_prototypeHandedTo}).
 * @param {UnifiedWrapper} wrapper - The node it is read through: the class's, or the instance's.
 * @param {*} prototype - The prototype.
 * @param {string|null} prop - The key it is read under (`"prototype"`), or null for an instance's own prototype.
 * @returns {*} What the reader is handed.
 * @private
 */
function runtime_prototypeForReader(wrapper, prototype, prop) {
	if (prototype === null || typeof prototype !== "object") return prototype;
	const slothlet = wrapper.slothlet;
	// The site is kept per node, so recording it costs no path built per read, with the permission system on or off.
	const site = runtime_prototypeSiteOf(wrapper, prop);
	runtime_recordPrototypePath(slothlet, prototype, site);
	// Code nothing could refuse an access through it holds the object itself, as plain JS hands it.
	if (runtime_readerHoldsPrototype(slothlet, runtime_selfModuleReader(slothlet), prototype, site.parts)) return prototype;
	return runtime_prototypeHandle(slothlet, prototype, site);
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
 *   on with no path of its own (see {@link runtime_prototypeHandleFor}).
 * @returns {*} The handle, or the prototype itself.
 * @private
 */
function runtime_prototypeHandle(slothlet, prototype, site) {
	if (!slothlet || prototype === null || typeof prototype !== "object") return prototype;
	if (util.types.isProxy(prototype) || WeakSetMethods.has(INTRINSICS, prototype) || runtime_isSharedValue(prototype)) return prototype;
	// A prototype no class a node exports owns and holding none of a module's code (an object the host gave a node as
	// its prototype) is data, and is handed out as it is.
	if (
		runtime_classPrototypeSites(slothlet, prototype).length === 0 &&
		!runtime_memberHoldsCode(prototype, searchDepth(slothlet) + 1, searchBudget(slothlet))
	)
		return prototype;
	if (site === null) return runtime_selfMemberView(prototype, PROTOTYPE_HANDLE_READER, slothlet, null);
	return runtime_selfMemberView(prototype, PROTOTYPE_HANDLE_READER, slothlet, site.parts);
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
function runtime_readerHoldsPrototype(slothlet, reader, prototype, parts = null) {
	if (!slothlet || !runtime_guardOn(slothlet)) return true;
	if (reader === null || reader === undefined || reader === HOST_READER) return true;
	const readerFile = reader?.____slothletInternal?.filePath ?? null;
	if (!readerFile) return false;
	// The module a prototype belongs to is the one exporting its class, or, for a class no node exports, the one holding
	// the instance whose prototype it is.
	let sites = prototype !== null && typeof prototype === "object" ? runtime_classPrototypeSites(slothlet, prototype) : [];
	if (sites.length === 0 && parts !== null && parts.length > 0) sites = [{ parts }];
	if (sites.length === 0 && prototype !== null && typeof prototype === "object")
		sites = runtime_knownPrototype(slothlet, prototype)?.sites ?? [];
	if (sites.length === 0) return false;
	// The module owning each site, as the ownership rule decides a write there, whose code module privacy lets reach the
	// private members held there, and no write rule for which could refuse a write at the site or beneath it (a deny on
	// its own prototype's member, say): the object itself would take no check of its own.
	const permissionManager = slothlet.handlers.permissionManager;
	const apiManager = slothlet.handlers.apiManager;
	const readerPath = String(reader.____slothletInternal.apiPath ?? "");
	// Held as itself, the prototype hands its `constructor` out with no node's checks around it: not while the rules could
	// refuse the reader a read of that function's members (a deny on the class's own member, say).
	if (prototype !== null && typeof prototype === "object" && runtime_constructorReadMayRefuse(slothlet, readerPath, prototype))
		return false;
	return ArrayMethods.every(sites, (site) => {
		const sitePath = ArrayMethods.join(site.parts, ".");
		if (!apiManager.ownsPath(site.parts, reader)) return false;
		if (!permissionManager.mayReachPrivate(readerPath, sitePath, readerFile, runtime_holderFilePath(slothlet, site.parts))) return false;
		return permissionManager.writeSubtree(readerPath, sitePath) !== "deny";
	});
}

/**
 * A prototype's handle as a reader is handed it (#667): the object behind it to a reader that holds it so
 * ({@link runtime_readerHoldsPrototype}), and the handle to any other. Anything that is no handle is returned as is.
 * @param {object|null} slothlet - The instance.
 * @param {object|null|undefined} reader - Who reads.
 * @param {*} shown - What would be handed out.
 * @returns {*} What the reader gets.
 * @private
 */
function runtime_prototypeForHolder(slothlet, reader, shown) {
	if (shown === null || (typeof shown !== "object" && typeof shown !== "function")) return shown;
	const record = WeakMapMethods.get(SELF_MEMBER_VIEWS, shown);
	if (record?.reader !== PROTOTYPE_HANDLE_READER) return shown;
	const instance = slothlet ?? record.slothlet;
	// A class no node stands for, shared as its prototype's handle is, stands for that prototype.
	const prototype = typeof record.value === "function" ? Reflect.getOwnPropertyDescriptor(record.value, "prototype")?.value : record.value;
	const parts = record.parts.length > 0 ? record.parts : null;
	return runtime_readerHoldsPrototype(instance, reader, prototype, parts) ? record.value : shown;
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
function runtime_prototypeHandleFor(slothlet, prototype, sites) {
	const classSites = runtime_classPrototypeSites(slothlet, prototype);
	if (classSites.length === 1) return runtime_prototypeHandle(slothlet, prototype, classSites[0]);
	if (classSites.length === 0 && sites.length === 1) return runtime_prototypeHandle(slothlet, prototype, sites[0]);
	return runtime_prototypeHandle(slothlet, prototype, null);
}

/**
 * The site of a class's `prototype` an instance's prototype is reported at: of the names the class is exported as, the
 * one that is the class's own `name`, else the first. A class exported under one name has that one.
 * @param {object} slothlet - The instance.
 * @param {object} prototype - The class's prototype.
 * @returns {{parts: string[], key: string, prop: string|null}|undefined} The site, or `undefined` for no class a node exports.
 * @private
 */
function runtime_classSiteOf(slothlet, prototype) {
	const sites = runtime_classPrototypeSites(slothlet, prototype);
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
function runtime_prototypeSiteOf(wrapper, prop) {
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
function runtime_recordPrototypePath(slothlet, prototype, site) {
	if (!slothlet || prototype === null || typeof prototype !== "object") return;
	let record = WeakMapMethods.get(PROTOTYPE_PATHS, prototype);
	if (record == null ? undefined : MapMethods.has(record.sites, site.key)) return;
	if (WeakSetMethods.has(INTRINSICS, prototype) || runtime_isSharedValue(prototype)) return;
	if (record === undefined) WeakMapMethods.set(PROTOTYPE_PATHS, prototype, (record = { slothlet, sites: new Map() }));
	MapMethods.set(record.sites, site.key, site);
}

/**
 * The instance whose node fronts the class a prototype is the `prototype` of, found by descriptors (see
 * {@link CLASS_INSTANCES}), or null.
 * @param {object} prototype - The prototype.
 * @returns {object|null} The instance.
 * @private
 */
function runtime_classInstanceOf(prototype) {
	if (util.types.isProxy(prototype)) return null;
	const owner = Reflect.getOwnPropertyDescriptor(prototype, "constructor")?.value;
	return typeof owner === "function"
		? ((WeakMapMethods.get(CLASS_INSTANCES, owner) == null
				? undefined
				: WeakRefMethods.deref(WeakMapMethods.get(CLASS_INSTANCES, owner))) ?? null)
		: null;
}

/**
 * The handle of a prototype of a module's reached with no path of its own (an instance's prototype, one handed on): see
 * {@link runtime_prototypeHandleFor}. Anything not known as a prototype of a module's is returned as it is.
 * @param {object|null} slothlet - The instance, when known.
 * @param {*} value - The value.
 * @returns {*} The handle, or the value.
 * @private
 */
function runtime_prototypeHandleOf(slothlet, value) {
	const known = runtime_knownPrototype(slothlet, value);
	if (known === undefined || known.sites.length === 0) return value;
	return runtime_prototypeHandleFor(known.slothlet, value, known.sites);
}

/**
 * A prototype of a module's as it reaches a module when a module holding the object itself hands it on (#667): as a
 * return value, an argument, an event, a thrown error, or inside any of them. While the permission system is on it is
 * its handle ({@link runtime_prototypeHandleOf}), whoever it reaches, so each access is decided for whoever makes it.
 * Anything else, and everything while the system is off, passes as it is.
 * @param {*} value - The value handed on.
 * @param {object|null} reader - Who it reaches.
 * @param {object|null} [slothlet] - The instance it crossed in, when known.
 * @returns {*} What the reader gets.
 * @private
 */
function runtime_prototypeHandedTo(value, reader, slothlet = null) {
	if (slothlet && !runtime_guardOn(slothlet)) return value;
	const known = runtime_knownPrototype(slothlet, value);
	if (known === undefined || known.sites.length === 0) return value;
	if (!runtime_guardOn(known.slothlet)) return value;
	// The host, and the module the prototype belongs to, hold it as it is, as plain JS hands it on.
	if (runtime_readerHoldsPrototype(known.slothlet, reader, value)) return value;
	return runtime_prototypeHandleFor(known.slothlet, value, known.sites);
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
function runtime_viewedNodeWrapper(value) {
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
function runtime_moduleKey(wrapper) {
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
function runtime_constructorReadMayRefuse(slothlet, readerPath, prototype) {
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
 * An emitter's own prototype as a node hands it to whoever may call the node (#667): its handle at the node's path, or
 * at its class's `prototype` when a node exports the class, the same to every reader, which reads and calls as the
 * prototype does and decides each change made through it for whoever makes it. A prototype made by no module is no
 * one's to hold back, and is handed out as it is.
 * @param {UnifiedWrapper} wrapper - The emitter's node's wrapper.
 * @param {object} prototype - The emitter's own prototype.
 * @returns {object} What the reader is handed.
 * @private
 */
function runtime_emitterPrototypeHandle(wrapper, prototype) {
	const slothlet = wrapper.slothlet;
	const site = runtime_prototypeSiteOf(wrapper, null);
	runtime_recordPrototypePath(slothlet, prototype, site);
	return runtime_prototypeHandleOf(slothlet, prototype);
}

/**
 * The prototype a closed emitter's shell holds (#667). A closed node reports its shell's prototype to every holder of
 * the node, for as long as the node lives: the host, and each module the host or another module hands the node to. The
 * shell therefore holds a view standing as the node does whenever the prototype is the module's code, whether the
 * permission system is on now or not: a write through it is decided when it is made, so turning the system on later
 * still holds a module not owning the emitter to it. A prototype made by no module is held as it is.
 * @param {UnifiedWrapper} wrapper - The emitter's node's wrapper.
 * @param {object} prototype - The emitter's own prototype.
 * @returns {object} What the shell holds.
 * @private
 */
function runtime_sealedShellPrototype(wrapper, prototype) {
	if (!wrapper.slothlet || WeakSetMethods.has(INTRINSICS, prototype) || runtime_isSharedValue(prototype)) return prototype;
	runtime_recordPrototypePath(wrapper.slothlet, prototype, runtime_prototypeSiteOf(wrapper, null));
	return runtime_prototypeHandleOf(wrapper.slothlet, prototype);
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
function runtime_instancePrototypeSite(wrapper) {
	const impl = wrapper.____slothletInternal.impl;
	if (impl === null || typeof impl !== "object") return undefined;
	const held = WeakMapMethods.get(INSTANCE_PROTOTYPE_SITES, wrapper);
	const current = util.types.isProxy(impl) ? undefined : Reflect.getPrototypeOf(impl);
	if (held !== undefined && held.impl === impl && held.current === current && held.apiPath === wrapper.____slothletInternal.apiPath)
		return held.found;
	let found;
	if (runtime_emitterOwnPrototype(wrapper) === undefined) {
		const classNode = runtime_instanceClassFront(wrapper);
		if (classNode) {
			const checked = resolveWrapper(classNode);
			found = { prototype: Reflect.getPrototypeOf(impl), checked, site: runtime_prototypeSiteOf(checked, "prototype") };
		} else {
			const unclassed = runtime_unclassedInstancePrototype(wrapper);
			if (unclassed !== undefined) found = { prototype: unclassed, checked: wrapper, site: runtime_prototypeSiteOf(wrapper, null) };
		}
	}
	WeakMapMethods.set(INSTANCE_PROTOTYPE_SITES, wrapper, { impl, current, apiPath: wrapper.____slothletInternal.apiPath, found });
	return found;
}

/**
 * The prototype site each node holding a class instance found, with what it was found for (see
 * {@link runtime_instancePrototypeSite}).
 * @type {WeakMap<UnifiedWrapper, {impl: object, current: object|null|undefined, apiPath: string, found: object|undefined}>}
 * @private
 */
const INSTANCE_PROTOTYPE_SITES = new WeakMap();

/**
 * The node reaching a closed node's prototype is checked against (#725): a class instance's prototype is checked as a
 * call of its class's node, as on an open node, and any other as a call of the node itself.
 * @param {UnifiedWrapper} wrapper - The closed node's wrapper.
 * @param {*} prototype - The prototype it reports, as the module holds it.
 * @returns {UnifiedWrapper} The node to check.
 * @private
 */
function runtime_prototypeCheckedBy(wrapper, prototype) {
	const site = runtime_instancePrototypeSite(wrapper);
	return site !== undefined && site.prototype === prototype ? site.checked : wrapper;
}

/**
 * The prototype a closed node holding a class instance keeps on its shell (#725). A closed node reports its shell's
 * prototype to every holder, so the shell holds the instance's prototype as a view standing as the node does, at the
 * path reading it is checked at: a write through it is decided when it is made, so turning the permission system on
 * later still holds a module not allowed the write to it. A prototype made by no module is held as it is.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {object|null|undefined} What the shell holds, or `undefined` for a node holding no such instance.
 * @private
 */
function runtime_instanceShellPrototype(wrapper) {
	const site = runtime_instancePrototypeSite(wrapper);
	if (site === undefined) return undefined;
	const { prototype, checked } = site;
	if (prototype === null || WeakSetMethods.has(INTRINSICS, prototype) || runtime_isSharedValue(prototype) || !wrapper.slothlet)
		return prototype;
	runtime_recordPrototypePath(wrapper.slothlet, runtime_exposePrototype(checked, prototype), site.site);
	return runtime_prototypeHandleOf(wrapper.slothlet, prototype);
}

/**
 * The prototype a closed node's captured view fixes on its shadow (#667, #725): the handle of an emitter's own prototype,
 * or of a class instance's, the same one every holder of the node is handed.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {object} prototype - The prototype, as the module holds it.
 * @returns {object} What the view fixes.
 * @private
 */
function runtime_closedPrototypeHandle(wrapper, prototype) {
	const found = runtime_instancePrototypeSite(wrapper);
	if (found === undefined || found.prototype !== prototype) return runtime_emitterPrototypeHandle(wrapper, prototype);
	runtime_recordPrototypePath(wrapper.slothlet, prototype, found.site);
	return runtime_prototypeHandleOf(wrapper.slothlet, prototype);
}

/**
 * The prototype of an instance a node holds as its module holds it, when the class that made it cannot be told from
 * descriptors (see {@link runtime_heldInstanceClass}): its prototype's `constructor` is an accessor, the instance has a
 * `constructor` of its own, the prototype has none, or the prototype is a Proxy. The node reports it as the instance
 * does, by `Object.getPrototypeOf` and through `__proto__` alike (#667); no class node stands for it, so reaching it is
 * checked as a call of the instance's own node. Read from the instance's own `[[Prototype]]`, so none of the module's
 * code runs to find it. `undefined` for any other node, an emitter or a live grafted object among them, which answer
 * their own prototype.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {object|undefined} The prototype, or `undefined`.
 * @private
 */
function runtime_unclassedInstancePrototype(wrapper) {
	const internal = wrapper.____slothletInternal;
	const impl = internal.impl;
	if (impl === null || typeof impl !== "object" || util.types.isProxy(impl)) return undefined;
	if (!isClassInstance(impl) || !hasOwn(internal, "sourceValue") || internal.sourceValue !== impl) return undefined;
	if (internal.deferChildAdopt || (EventEmitter && runtime_inherits(impl, EventEmitter))) return undefined;
	if (runtime_heldInstanceClass(wrapper) !== null) return undefined;
	return Reflect.getPrototypeOf(impl);
}

/**
 * The stand-in for a prototype withheld from a reader, per node: see {@link runtime_withheldPrototype}.
 * @type {WeakMap<UnifiedWrapper, {nearest: object, standIn: object}>}
 * @private
 */
const WITHHELD_PROTOTYPES = new WeakMap();

/**
 * What a node whose own prototype holds the module's code (an emitter of a class of the module's) reports to a reader
 * that may not call it (#632, #667): an object inheriting from the nearest prototype above it holding none of the
 * module's code, so `instanceof` against the language's or Node's own classes still holds, by `Object.getPrototypeOf`
 * and through `__proto__` alike. It holds nothing of its own and takes no change: a write meant for the module's class
 * is refused, never landing on a prototype other values share. The same object each time, for the same node and
 * nearest prototype.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {object|null} nearest - The nearest prototype holding none of the module's code.
 * @returns {object|null} The stand-in, or `null` when there is no such prototype.
 * @private
 */
function runtime_withheldPrototype(wrapper, nearest) {
	if (nearest === null) return null;
	const held = WeakMapMethods.get(WITHHELD_PROTOTYPES, wrapper);
	if (held?.nearest === nearest) return held.standIn;
	// A change through it is checked as a call of the node, so a reader it was withheld from is refused as reading the
	// prototype itself would refuse it; any other reader finds it closed, as a frozen object is.
	const refuse = () => {
		enforcePermission(wrapper, [], false);
		return false;
	};
	const standIn = new NativeProxy(Objects.freeze(Objects.create(nearest)), {
		set: (target, prop, value, receiver) => (receiver === standIn ? refuse() : Reflect.set(target, prop, value, receiver)),
		defineProperty: refuse,
		deleteProperty: refuse,
		setPrototypeOf: refuse,
		preventExtensions: (target) => {
			refuse();
			return Reflect.preventExtensions(target);
		}
	});
	markFrameworkInternal(standIn);
	WeakMapMethods.set(WITHHELD_PROTOTYPES, wrapper, { nearest, standIn });
	return standIn;
}

/**
 * The class of the instance a node fronts, when a node of the instance fronts that class too (#667). Such a node
 * answers its class and prototype as the instance does, through the class's node. An instance of a class no node
 * fronts answers null here: the class would reach the reader with no node around it.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {Function|null} The class, or null.
 * @private
 */
function runtime_exportedInstanceClass(wrapper) {
	const instanceClass = runtime_heldInstanceClass(wrapper);
	if (instanceClass === null) return null;
	return nodeRefOf(FUNCTION_NODES, wrapper.slothlet, instanceClass) !== undefined ? instanceClass : null;
}

/**
 * The member nodes an instance's node built for the class its instance was made by, keyed by that node's wrapper
 * (see {@link runtime_instanceClassNode}).
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
function runtime_instanceClassNode(wrapper, instanceClass = runtime_heldInstanceClass(wrapper)) {
	if (instanceClass === null) return null;
	if (runtime_isIntrinsic(instanceClass) || runtime_isBuiltinFunction(instanceClass) || runtime_isSharedValue(instanceClass)) return null;
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
 * The node standing for the class of the instance a node fronts (#667): the node fronting the class when its module
 * exports it, or else the class's member node at the instance's `constructor` (see runtime_instanceClassNode), so an
 * instance of a class its module keeps to itself answers its prototype as one of an exported class does. Null for a
 * node fronting no such instance, and for an emitter or a live grafted object, which answer their own prototype.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {Function|null} The class's node, or null.
 * @private
 */
function runtime_instanceClassFront(wrapper) {
	const internal = wrapper.____slothletInternal;
	const exported = runtime_exportedInstanceClass(wrapper);
	if (exported !== null) return WeakRefMethods.deref(WeakMapMethods.get(WeakMapMethods.get(FUNCTION_NODES, wrapper.slothlet), exported));
	if (internal.deferChildAdopt || (EventEmitter && runtime_inherits(internal.impl, EventEmitter))) return null;
	return runtime_instanceClassNode(wrapper);
}

/**
 * The prototype a node fronting an instance of a class of the module's reports, by `Object.getPrototypeOf` and through
 * `__proto__` (#667): the instance's own, its class's `prototype`. It holds the class's methods and `constructor`, so
 * reaching it is checked as a call of the class's node (see runtime_instanceClassFront), whoever holds the instance's
 * node — read through `self` or handed to the module as an argument — exactly as reading the class's `prototype` is. A
 * reader the class is closed to is refused it: the prototype is never stood in for by another, so no write meant for
 * the class lands on a prototype every value shares.
 * @param {UnifiedWrapper} wrapper - The instance's node's wrapper.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making into the instance.
 * @returns {object|undefined} The prototype, or `undefined` for a node fronting no such instance.
 * @throws {SlothletError} PERMISSION_DENIED when the reader may not call the class's node.
 * @private
 */
function runtime_instanceClassPrototype(wrapper, kept = null) {
	const classNode = runtime_instanceClassFront(wrapper);
	if (!classNode) return undefined;
	const classWrapper = resolveWrapper(classNode);
	const prototype = Reflect.getPrototypeOf(wrapper.____slothletInternal.impl);
	runtime_enforceCodeMember(classWrapper, prototype, kept);
	return runtime_atClassSite(
		wrapper.slothlet,
		runtime_prototypeForReader(classWrapper, runtime_exposePrototype(classWrapper, prototype), "prototype")
	);
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
 * [...runtime_prototypeChain([])]; // [[], Array.prototype, Object.prototype]
 */
function* runtime_prototypeChain(start) {
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
 * Whether a lazy node loaded as a namespace: its impl is a plain object, not a function, an array or a callable. Its
 * proxy's function target stood in while it loaded, and its own `length` and `name` are no members of the node.
 * @param {object} wrapper - The node's wrapper.
 * @returns {boolean} True for such a node.
 * @private
 */
function runtime_loadedAsNamespace(wrapper) {
	const internal = wrapper.____slothletInternal;
	if (internal.mode !== "lazy" || !internal.state.materialized) return false;
	const impl = internal.impl;
	return (
		impl !== null && typeof impl === "object" && !Arrays.isArray(impl) && resolveWrapper(impl)?.____slothletInternal.isCallable !== true
	);
}

/**
 * The node a function member of a node stands for when the function is the node's own or an ancestor's: in plain JS
 * `fn.me === fn`, so `api.x.me` is `api.x`, and a member referring further up is the node further up, never a new node
 * below that would open another level on every read. A node's own function is its implementation, or the module's
 * function under it when the implementation is a composition layer (a callable folder with siblings). A function a
 * collision merged into the node is the one its leaf function was recorded for at the node's own path (see
 * {@link runtime_registerLeafFunction}). Further up, a node recorded for the function on the node's path is the one;
 * walking up, the nodes the api holds on the node's path are looked at as well.
 * @param {object} wrapper - The node holding the member.
 * @param {*} member - The member's value.
 * @param {boolean} [walkUp=true] - Look at the nodes the api holds above the node. A build passes false: the nodes it
 *   is building are not in the api yet, and only the recorded node can answer there.
 * @returns {object|null} The node's wrapper, or null when the value is no function of the node or an ancestor.
 * @private
 */
function runtime_cycleNode(wrapper, member, walkUp = true) {
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
	// runtime_registerLeafFunction), the function a call of the node runs. In plain JS that function is a member of
	// the object, `obj.default !== obj`: the node stands for the object, so the function is no reference back to it.
	if (owner !== undefined && runtime_implDefault(owner.____slothletInternal.impl) === value) owner = undefined;
	if (owner !== undefined && owner.slothlet === wrapper.slothlet && !owner.____slothletInternal.invalid) {
		const at = String(owner.____slothletInternal.apiPath ?? "");
		if (at === path) return wrapper;
		if (!walkUp && at !== "" && StringMethods.startsWith(path, `${at}.`)) return owner;
	}
	if (!walkUp) return null;
	const segments = splitText(path, ".");
	for (let depth = segments.length - 1; depth > 0; depth--) {
		const node = runtime_nodeAtPath(wrapper.slothlet, ArrayMethods.join(copyList(segments, 0, depth), "."));
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
function runtime_nodeHarborsCode(value) {
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
		if (util.types.isProxy(impl)) return runtime_isModuleProxy(impl);
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
 * Reflect.apply(live, runtime_liveThis(thisArg), args);
 */
function runtime_liveThis(value) {
	// A view `self` handed out stays a view, of the live node, for the same reader (#625): the method
	// never gets the node itself.
	if (WeakMapMethods.has(SELF_VIEW_NODES, value)) {
		const node = WeakMapMethods.get(SELF_VIEW_NODES, value);
		const live = runtime_liveThis(node);
		return live === node ? value : runtime_selfView(live, WeakMapMethods.get(SELF_VIEW_READERS, value));
	}
	const wrapper = registeredWrapper(value);
	// A stand-in for a chain below the wrapper resolves to the chain's live end (`new.target` of a construction
	// through one, #685).
	if (wrapper && runtime_isRestartStale(wrapper)) return runtime_resolveRestartTarget(wrapper, WeakMapMethods.get(WAITING_CHAINS, value));
	return value;
}

/**
 * The property chain each waiting proxy stands for below its wrapper, for {@link runtime_liveThis}.
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
 * runtime_elementAt(["a"], "0"); // "a"
 */
function runtime_elementAt(array, index) {
	const descriptor = runtime_elementDescriptor(array, index);
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
 * runtime_elementDescriptor(["a"], "0"); // { value: "a", ... }
 */
function runtime_elementDescriptor(array, index) {
	for (const holder of generatorSteps(runtime_prototypeChain(array))) {
		const descriptor = Reflect.getOwnPropertyDescriptor(holder, index);
		if (descriptor) return descriptor;
	}
	return undefined;
}

/**
 * The first index whose plain value is `value`, found from the array's own descriptors: neither an
 * `indexOf` the array holds nor an element's getter runs.
 * @param {Array} array - The array.
 * @param {unknown} value - The element.
 * @returns {string|null} The index, or `null` when no index holds it.
 * @private
 *
 * @example
 * runtime_indexOfElement(["a", "b"], "b"); // "1"
 */
function runtime_indexOfElement(array, value) {
	// The positions the array holds and those its prototypes supply, lowest first; each is read as the array
	// reads it, so a position an earlier object shadows answers with the shadowing value.
	const keys = new Set();
	for (const holder of generatorSteps(runtime_prototypeChain(array))) {
		for (let ofIndex = 0, ofList = Reflect.ownKeys(holder); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (runtime_isPosition(key)) SetMethods.add(keys, key);
		}
	}
	for (let ofIndex = 0, ofList = ArrayMethods.sort(setToArray(keys), (a, b) => Number(a) - Number(b)); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (runtime_elementAt(array, key) === value) return key;
	}
	return null;
}

/**
 * Make a child wrapper's api path follow its position (#603 review). For an array element, the path
 * names the index the element sits at now: its recorded index while the element is still there, the
 * first index holding it after an array method moved it, and the array's own path once it has left the
 * array. A wrapper below an element extends its parent's current path. Permission checks, hooks and
 * `slothlet.node` all read this path, so a rule for `arr.0` applies to whatever sits at `arr[0]`,
 * including through a reference taken before the element moved there.
 *
 * @param {object} internal - The child wrapper's internal state.
 * @param {UnifiedWrapper} parent - The wrapper it was created under.
 * @param {PropertyKey} key - The child's key under `parent`.
 * @param {boolean} byIndex - True when `parent` is an array and `key` an index.
 * @returns {void}
 * @private
 *
 * @example
 * runtime_followPosition(internal, arrayWrapper, "1", true);
 */
function runtime_followPosition(internal, parent, key, byIndex) {
	internal.followsPosition = true;
	let index = key;
	// An element the array holds no descriptor for at its index (a proxy's get trap supplied it) keeps the index it was
	// read at once nothing else holds it. Recorded now, from what the array holds, not rediscovered by proxy detection.
	const parentArray = parent.____slothletInternal.impl;
	const isVirtual = byIndex && Arrays.isArray(parentArray) && runtime_elementAt(parentArray, key) !== internal.sourceValue;
	Objects.defineProperty(internal, "apiPath", {
		__proto__: null,
		configurable: true,
		enumerable: true,
		get() {
			const base = parent.____slothletInternal.apiPath;
			if (!byIndex) return `${base}.${typeof key === "symbol" ? String(key) : key}`;
			const array = parent.____slothletInternal.impl;
			// The array is read through its own descriptors, so resolving a path never runs the array's code:
			// not an `indexOf` it holds, nor an element's getter (#603 review). An element held through a getter
			// keeps the index it was read at.
			if (Arrays.isArray(array) && runtime_elementAt(array, index) !== internal.sourceValue) {
				const current = runtime_elementDescriptor(array, index);
				if (current && !("value" in current)) return `${base}.${index}`;
				const found = runtime_indexOfElement(array, internal.sourceValue);
				// Resolving a path runs none of the array's code: an element it supplied from a trap keeps its index.
				if (found === null) return isVirtual ? `${base}.${index}` : base;
				index = found;
			}
			return `${base}.${index}`;
		}
	});
}

/**
 * What a stand-in answers while the node it stands for has not loaded (see {@link runtime_standInNode}).
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
 * runtime_nodeBehind(heldReference) === api.victim.v; // true for a view of victim.v
 */
function runtime_nodeBehind(value) {
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
					runtime_valueOfFor,
					runtime_viewAccessor,
					runtime_protoAssignSetsPrototype,
					runtime_nodeWrapperOf,
					NODE_TARGETS,
					runtime_nodeOpen,
					runtime_prototypeAtStart,
					runtime_sameLookup,
					runtime_classPrototypeOf,
					runtime_wrapperClassPrototype,
					runtime_privateCallReceiver,
					runtime_nodeVersion,
					runtime_sameSnapshotMember,
					runtime_metadataNodeOf,
					runtime_nodeReport,
					ADOPTED_ACCESSORS,
					runtime_moduleInheritance,
					runtime_prototypeGiven,
					runtime_prototypeOnSharedValue,
					runtime_functionMember,
					runtime_moduleObjectOf,
					RECONSTRUCTED_FROM,
					runtime_moduleObjectFor,
					runtime_moduleObjectKeys,
					NO_NODE_PRIMITIVE,
					runtime_nodePrimitive,
					runtime_followModuleObject,
					runtime_followModuleIntegrity,
					runtime_reportsWritable,
					runtime_originalAccessor,
					MAKERS,
					nodesShared,
					runtime_heldPrototypeOf,
					runtime_makerOf,
					runtime_loadApart,
					runtime_makerInstanceID,
					runtime_leafFunctionHandedIn,
					runtime_nodeAtPath,
					runtime_instanceReadMayRefuse,
					runtime_instanceHoldsReads,
					runtime_exposePrototype,
					runtime_markWritten,
					FUNCTION_NODES,
					nodeRefOf,
					runtime_recordFunctionNode,
					LAYER_FRONTS,
					runtime_classPrototypeSites,
					runtime_prototypeClassNode,
					runtime_prototypeForReader,
					runtime_prototypeHandle,
					runtime_readerHoldsPrototype,
					runtime_prototypeForHolder,
					runtime_classSiteOf,
					runtime_prototypeSiteOf,
					runtime_classInstanceOf,
					runtime_prototypeHandleOf,
					runtime_prototypeHandedTo,
					runtime_viewedNodeWrapper,
					runtime_moduleKey,
					runtime_emitterPrototypeHandle,
					runtime_sealedShellPrototype,
					runtime_instancePrototypeSite,
					runtime_prototypeCheckedBy,
					runtime_instanceShellPrototype,
					runtime_closedPrototypeHandle,
					runtime_unclassedInstancePrototype,
					runtime_withheldPrototype,
					runtime_exportedInstanceClass,
					runtime_instanceClassNode,
					runtime_instanceClassFront,
					runtime_instanceClassPrototype,
					runtime_prototypeChain,
					runtime_loadedAsNamespace,
					runtime_cycleNode,
					capturedViewNodes,
					runtime_nodeHarborsCode,
					runtime_liveThis,
					WAITING_CHAINS,
					runtime_followPosition,
					STAND_IN_UNLOADED,
					runtime_nodeBehind
				});
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					INTRINSICS = methods.values.INTRINSICS;
					NODE_VALUE_OFS = methods.values.NODE_VALUE_OFS;
					runtime_holdsModuleMember = methods.values.runtime_holdsModuleMember;
					runtime_inherits = methods.values.runtime_inherits;
					runtime_inheritsFrom = methods.values.runtime_inheritsFrom;
					runtime_isBuiltinFunction = methods.values.runtime_isBuiltinFunction;
					runtime_isHeldPrimitive = methods.values.runtime_isHeldPrimitive;
					runtime_isIntrinsic = methods.values.runtime_isIntrinsic;
					runtime_isModuleProxy = methods.values.runtime_isModuleProxy;
					runtime_isPosition = methods.values.runtime_isPosition;
					runtime_isRestartStale = methods.values.runtime_isRestartStale;
					runtime_isSharedValue = methods.values.runtime_isSharedValue;
					runtime_isSlothletValue = methods.values.runtime_isSlothletValue;
					runtime_ownsPrototype = methods.values.runtime_ownsPrototype;
					runtime_wrapperReport = methods.values.runtime_wrapperReport;
					enforcePermission = methods.rules.enforcePermission;
					FRAMEWORK_WRITES = methods.rules.FRAMEWORK_WRITES;
					runtime_enforceCodeMember = methods.rules.runtime_enforceCodeMember;
					runtime_enforceNodeReportRead = methods.rules.runtime_enforceNodeReportRead;
					runtime_frameworkWrite = methods.rules.runtime_frameworkWrite;
					runtime_implDefault = methods.rules.runtime_implDefault;
					runtime_memberHoldsCode = methods.rules.runtime_memberHoldsCode;
					runtime_resolveRestartTarget = methods.rules.runtime_resolveRestartTarget;
					runtime_checkpointFile = methods.run.runtime_checkpointFile;
					runtime_recordedPrototype = methods.run.runtime_recordedPrototype;
					runtime_startPrototypes = methods.run.runtime_startPrototypes;
					capturedViewChildren = methods.views.capturedViewChildren;
					capturedViewTargets = methods.views.capturedViewTargets;
					hasOwn = methods.views.hasOwn;
					HOST_READER = methods.views.HOST_READER;
					PROTOTYPE_HANDLE_READER = methods.views.PROTOTYPE_HANDLE_READER;
					PROTOTYPE_PATHS = methods.views.PROTOTYPE_PATHS;
					runtime_atClassSite = methods.views.runtime_atClassSite;
					runtime_emitterOwnPrototype = methods.views.runtime_emitterOwnPrototype;
					runtime_holderFilePath = methods.views.runtime_holderFilePath;
					runtime_selfMemberView = methods.views.runtime_selfMemberView;
					runtime_selfModuleReader = methods.views.runtime_selfModuleReader;
					runtime_selfView = methods.views.runtime_selfView;
					SELF_MEMBER_VIEWS = methods.views.SELF_MEMBER_VIEWS;
					SELF_VIEW_NODES = methods.views.SELF_VIEW_NODES;
					SELF_VIEW_READERS = methods.views.SELF_VIEW_READERS;
					STAND_INS = methods.views.STAND_INS;
					runtime_guardOn = methods.membrane.runtime_guardOn;
					runtime_kindStandIn = methods.membrane.runtime_kindStandIn;
					runtime_knownPrototype = methods.membrane.runtime_knownPrototype;
					runtime_membrane = methods.membrane.runtime_membrane;
					searchBudget = methods.membrane.searchBudget;
					searchDepth = methods.membrane.searchDepth;
					runtime_retireChanges = methods.waiting.runtime_retireChanges;
					runtime_standInNode = methods.waiting.runtime_standInNode;
					runtime_defineAdoptedAccessor = methods.materialize.runtime_defineAdoptedAccessor;
					isClassInstance = methods.uw.isClassInstance;
					leafOfCopy = methods.uw.leafOfCopy;
					markFrameworkInternal = methods.uw.markFrameworkInternal;
					resolveWrapper = methods.uw.resolveWrapper;
					trustedRootOwn = methods.uw.trustedRootOwn;
					registeredWrapper = methods.values.registeredWrapper;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/nodes", import.meta.url);
				super(slothlet);
			}
		}
	);
}
