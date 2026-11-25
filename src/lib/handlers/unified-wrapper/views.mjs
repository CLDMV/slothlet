/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/views.mjs
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
 * @fileoverview Views layer of the wrapper: the per-reader views `self` hands out, member and data views, and captured views.
 *
 * Upward services (from layers above this one, reached through the method table): CROSSINGS (membrane),
 *  CROSSING_ORIGINS (membrane), HOST_HANDED (membrane), INSPECT_CUSTOM (membrane), SEALED_SHELL_READER (membrane),
 *  STAND_IN_RECORDS (membrane), checkedStandIn (waiting), crossTo (membrane), frontingNodeNow (membrane),
 *  knownPrototype (membrane), ownArguments (membrane), recordOrigin (membrane).
 * @module @cldmv/slothlet/handlers/unified-wrapper/views
 * @internal
 */

import { segmentsOf } from "#helpers/segments";
import { util, EventEmitter } from "#helpers/platform";
import { layerUnderlying } from "#helpers/composition";
import { SlothletError } from "#errors";
import { runtime_isWrappedClassInstance } from "#helpers/class-instance-wrapper";
import { combineCeilings, identityCeilings } from "#handlers/trusted-root";
import { pinnedThen } from "#helpers/promise-context";
import {
	ArrayBuffers,
	ArrayMethods,
	Arrays,
	Boolean,
	concatLists,
	copyList,
	filterList,
	FunctionMethods,
	functionSource,
	Iterator,
	listFromIterable,
	listPush,
	Map,
	mapList,
	MapMethods,
	NativeProxy,
	ObjectMethods,
	Objects,
	Promise,
	Promises,
	PrototypeFunctions,
	Reflect,
	RegExpMethods,
	setFrom,
	SetMethods,
	splitText,
	String,
	StringMethods,
	Symbol,
	SymbolMethods,
	Symbols,
	WeakMap,
	WeakMapMethods,
	WeakRef,
	WeakRefMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
import { builtinKind } from "#helpers/run-snapshot";

import { ownBindingsRefusal } from "#helpers/instance-imports";
import { internals as callerPinningInternals } from "#helpers/caller-pinning";
import { internals as capabilityContextInternals } from "#helpers/capability-context";
import { isFrameworkInternal } from "#handlers/framework-internals";
const { UNATTRIBUTED_READER } = capabilityContextInternals("lib/handlers/unified-wrapper/views");
const { markCallerLocked, isCallerLocked } = callerPinningInternals("lib/handlers/unified-wrapper/views");

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 */
let runtime_unwrapClassInstance,
	runtime_classInstanceCreator,
	trustedRootOwn,
	frameDefiner,
	markFrameworkInternal,
	versionDispatcherRecord,
	isUnchangingDefinition,
	INSPECT_CUSTOM,
	refuseEndedAccess,
	SEALED_SHELL_READER,
	isPrototypeHandle,
	refuseWriteWithoutStanding,
	hasInternalSlots,
	inherits,
	dataKind,
	ACTING_FOR,
	assertReaderWrite,
	isEngineMember,
	holdsDataKind,
	FRAMEWORK_MEMBER_NAMES,
	frameworkViewOf,
	nodeWrapperOf,
	beginAccess,
	endAccess,
	takeAccess,
	accessIdentity,
	readWithAccess,
	describeWithAccess,
	enforceRead,
	isTerminalData,
	readOnBehalf,
	enforceCodeMember,
	checkedStandIn,
	ownsPrototype,
	STAND_IN_RECORDS,
	INTRINSICS,
	isSharedValue,
	makerOf,
	makerInstanceID,
	nodeAtPath,
	HOST_HANDED,
	FUNCTION_NODES,
	nodeRefOf,
	LAYER_FRONTS,
	frontingNodeNow,
	prototypeClassNode,
	prototypeHandleAt,
	readerHoldsPrototype,
	prototypeForHolder,
	classSiteOf,
	prototypeSiteOf,
	knownPrototype,
	prototypeHandleOf,
	prototypeHandedTo,
	CROSSINGS,
	CROSSING_ORIGINS,
	moduleKey,
	recordOrigin,
	crossTo,
	isArrayMember,
	capturedViewSet,
	capturedViewNodes,
	isConstructor,
	isClassInstance,
	resolveWrapper,
	registerProxy,
	nodesShared,
	recordPrototypePath,
	rulesShared,
	hostRunDefiner,
	isIntrinsic,
	FRAMEWORK_VIEW_TARGETS,
	COMMON_READERS,
	TYPED_ARRAY_READERS,
	DATA_READERS,
	MEMBER_HOLDERS,
	isWrapper;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/**
 * Check OWN properties only (not inherited from ComponentBase prototype).
 * ComponentBase defines getters like 'config', 'debug' on prototype that would
 * incorrectly match with `prop in wrapper`, shadowing adopted child wrappers.
 * @param {Object} obj - Object to check
 * @param {string|symbol} key - Property key
 * @returns {boolean} True if obj has own property key
 * @private
 */
const hasOwn = (obj, key) => Objects.hasOwn(obj, key);

/**
 * The views {@link selfView} built, per node and per reader, and the node behind each view.
 * @type {WeakMap<object, WeakMap<object, object>>}
 * @private
 */
const SELF_VIEWS = new WeakMap();

/** @type {WeakMap<object, object>} */
const SELF_VIEW_NODES = new WeakMap();

/**
 * The node and key a view just defined a member on ({@link selfView}), for the one read of the node's
 * descriptor the engine makes right after: a proxy checks its trap's answer against its target, and the view's
 * target is the node. That read answers the engine, never a reader, so the node does not gate the value it
 * holds fixed (a frozen member) on it. Set only as the view's definition returns, and taken by the next read
 * of a node's descriptor, which is that check.
 * @type {{wrapper: object, prop: string|symbol}|null}
 * @private
 */
let PENDING_INVARIANT_READ = null;

/**
 * The traps a self data view and a self member view change their value through (see {@link selfDataView},
 * {@link selfMemberView}): defining, deleting, setting the prototype and closing the value are each a write the
 * reader has to be allowed, made on the value itself, with the view's shadow kept to what the engine checks it against.
 * A definition that changes nothing and closing a value already closed are no writes (#667).
 * @param {object} raw - The value viewed.
 * @param {object} shadow - The view's proxy target.
 * @param {function((PropertyKey|null)): void} assertWrite - Refuses a write the reader may not make.
 * @param {function(PropertyKey): void} mirror - Brings a member's description on the shadow up to date.
 * @param {function(): void} mirrorClosed - Closes the shadow once the value is closed.
 * @returns {ProxyHandler<object>} The traps.
 * @private
 */
function selfViewWriteTraps(raw, shadow, assertWrite, mirror, mirrorClosed) {
	return {
		defineProperty(_, prop, descriptor) {
			mirrorClosed();
			if (!Reflect.isExtensible(raw) && isUnchangingDefinition(raw, prop, descriptor)) return true;
			assertWrite(prop);
			const stored = "value" in descriptor ? { __proto__: null, ...descriptor, value: unwrapSelfView(descriptor.value) } : descriptor;
			if (!Reflect.defineProperty(raw, prop, stored)) return false;
			// A member defined fixed is fixed on the shadow as defined, which is what the engine checks it against.
			if (descriptor.configurable === false) Reflect.defineProperty(shadow, prop, descriptor);
			else mirror(prop);
			return true;
		},
		deleteProperty(_, prop) {
			assertWrite(prop);
			if (!Reflect.deleteProperty(raw, prop)) return false;
			mirror(prop);
			return true;
		},
		setPrototypeOf(_, proto) {
			assertWrite(null);
			if (!Reflect.setPrototypeOf(raw, unwrapSelfView(proto))) return false;
			return Reflect.isExtensible(shadow) || Reflect.getPrototypeOf(shadow) === proto;
		},
		preventExtensions() {
			if (!Reflect.isExtensible(raw)) {
				mirrorClosed();
				return true;
			}
			assertWrite(null);
			// A value that is itself a proxy may decline.
			if (!Reflect.preventExtensions(raw)) return false;
			mirrorClosed();
			return true;
		}
	};
}

/**
 * The reader each view {@link selfView} built belongs to.
 * @type {WeakMap<object, object>}
 */
const SELF_VIEW_READERS = new WeakMap();

/**
 * The node each live-identity value (a class instance, an EventEmitter) was called on as `this`, kept
 * when the wrapper hands the value itself to a method as its receiver (#590, #340), so the value coming
 * back through `self` is held to the node's rule ({@link selfView}).
 * @type {WeakMap<object, object>}
 */
const SELF_INSTANCE_NODES = new WeakMap();

/**
 * Reader of a node read through `self` by host code: a host `run()` / `scope()` callback, which owns the
 * whole tree.
 * @type {object}
 * @private
 */
const HOST_READER = Objects.freeze({ reader: "host" });

/**
 * Reader of a prototype's handle ({@link prototypeHandle}): no one in particular. A class's prototype reached
 * through the api is one handle at its path, the same object to every module and to the host, as a node is, and each
 * read, call and change made through it is decided for whoever makes it at the time.
 * @type {Readonly<{reader: string}>}
 * @private
 */
const PROTOTYPE_HANDLE_READER = Objects.freeze({ reader: "prototype handle" });

/**
 * The views a full-isolation run's `self` hands out (see `makeRunSelf` in `handlers/unified-wrapper/run`), each with what it reads
 * through: the node as its reader was handed it, or an outer run's view. Undefined for a namespace only the run wrote.
 * @type {WeakMap<object, *>}
 * @private
 */
const RUN_VIEWS = new WeakMap();

/**
 * The node behind a value: a view `self` handed out ({@link selfView}), or a member it handed out as the node
 * holds it fixed, stands for its node, which is what is stored when the view is written into the api. Anything
 * else is returned as is.
 *
 * @param {*} value - A value about to be stored.
 * @returns {*} The node a view stands for, or `value`.
 * @internal
 *
 * @example
 * unwrapSelfView(self.callee.ops) === api.callee.ops; // true
 */
function unwrapSelfView(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	// A full-isolation run's view of a node stands for what it reads through (see registerRunView).
	while (WeakMapMethods.has(RUN_VIEWS, value)) value = WeakMapMethods.get(RUN_VIEWS, value);
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	if (WeakSetMethods.has(GUARD_VIEWS, value)) return WeakMapMethods.get(capturedViewTargets, value);
	return WeakMapMethods.get(SELF_VIEW_NODES, value) ?? WeakMapMethods.get(SELF_MEMBER_VIEWS, value)?.value ?? value;
}

/**
 * Who is reading the api through `self` right now: the executing module's wrapper, or one of the two
 * readers that are no module ({@link HOST_READER}, {@link UNATTRIBUTED_READER}).
 *
 * @param {object} slothlet - Instance the node belongs to.
 * @param {object|null} [access=null] - The access the read is part of, when who is making it was resolved already.
 * @returns {object} The reader.
 * @private
 */
function selfReader(slothlet, access = null) {
	const identity = accessIdentity(access, slothlet.contextManager, slothlet.instanceID);
	if (identity?.currentWrapper) return identity.currentWrapper;
	return identity?.unresolved ? UNATTRIBUTED_READER : HOST_READER;
}

/**
 * The module code reading the api right now, for a value the framework hands out (#625): the executing
 * module's wrapper, the reader that owns nothing for code the live runtime could not attribute, or null
 * for host code, which is handed the api itself.
 *
 * @param {object} slothlet - Instance the api belongs to.
 * @returns {object|null} The module reader, or null for the host.
 * @internal
 *
 * @example
 * const reader = selfModuleReader(slothlet);
 * return reader ? selfRootView(slothlet, reader) : slothlet.api;
 */
function selfModuleReader(slothlet) {
	const identity = slothlet?.contextManager?.getCallerIdentity?.(slothlet.instanceID);
	if (identity?.currentWrapper) return identity.currentWrapper;
	return identity?.unresolved ? UNATTRIBUTED_READER : null;
}

/**
 * The calls the code running now acts under besides its own module, when it is code a caller supplied to another
 * module's call (#597): each has to be allowed a change the module makes as well. Empty for a module's own code and
 * for the host.
 *
 * @param {object} slothlet - Instance the code runs in.
 * @param {object|null} [writer] - The module the change is made as; the ceilings are read only while it is the one
 *   executing, so a writer captured earlier gets none from whatever runs now.
 * @returns {ReadonlyArray<object>} The ceiling's calls.
 * @internal
 *
 * @example
 * for (const call of [writer, ...selfModuleCeilings(slothlet, writer)]) apiManager.assertOwnedWrite(parts, call);
 */
function selfModuleCeilings(slothlet, writer) {
	const identity = slothlet?.contextManager?.getCallerIdentity?.(slothlet.instanceID);
	if (!identity?.currentWrapper || (writer !== undefined && identity.currentWrapper !== writer)) return [];
	return identityCeilings(identity);
}

/**
 * Whether a write through a view `self` handed out is made with standing of its own: while a module is
 * executing (the node's own rule then decides, see {@link assertOwnedWrite}), or inside a `run()` /
 * `scope()` the host opened, where `self` itself writes as the host. The same test the live `self` applies
 * before it resolves at all.
 *
 * Inside such a flow only the host's own code has that standing. A module's code running there (a function it handed
 * out that the host calls, or a callback of its own given the flow's async context) is the module's, as a `self`
 * read in the flow is (see {@link selfReadAsDefiner}): it is held to the view's reader, never to the host.
 *
 * @param {object} slothlet - Instance the node belongs to.
 * @returns {boolean} Whether the write stands on the code running now.
 * @private
 */
function selfWriteHasStanding(slothlet) {
	/**
	 * Whether the code running now inside a flow the host opened is a module's rather than the host's: its frames place
	 * it in a module's file, as {@link selfReadAsDefiner} reads them for a `self` read made there. Evaluated code
	 * whose definer the frames cannot tell stays the host's, as it does for that read; code of a file several running
	 * instances hold untold apart, or code at an instance's file running in a script that is not the file's, is not the
	 * host's. With the permission system on and `provenance` or `capture` off, no code is told by its frames and the
	 * flow's code is the host's.
	 *
	 * @param {object} slothlet - Instance the flow belongs to.
	 * @param {string} hostFlowInstanceID - The instance whose flow the host opened.
	 * @returns {boolean} True for a module's code.
	 * @private
	 */
	function hostFlowRunsModuleCode(slothlet, hostFlowInstanceID) {
		if (slothlet.handlers?.permissionManager?.isEnabled?.()) {
			const callerConfig = slothlet.config?.permissions?.caller;
			if (callerConfig?.provenance === false || callerConfig?.capture === false) return false;
		}
		const definer = frameDefiner(hostFlowInstanceID);
		if (definer === null) return false;
		return !(definer.unplaced && !definer.shared && !definer.foreign);
	}

	const contextManager = slothlet.contextManager;
	const identity = contextManager?.getCallerIdentity?.(slothlet.instanceID);
	if (identity?.currentWrapper || identity?.unresolved) return true;
	const store = contextManager?.tryGetContext?.(slothlet.instanceID);
	// A run's store put back for work the run left behind (see `reopenFlowStore` in context-live) is no flow the host
	// has open: the work keeps the run's context, never its standing.
	// Nor is a flow slothlet opened over the instance's own store to carry a build's mark (see `markStoreOver` there).
	if (
		!store?.parentInstanceID ||
		store[trustedRootOwn.TRUSTED_ROOT] !== true ||
		store[trustedRootOwn.REOPENED_FLOW] === true ||
		store[trustedRootOwn.INSTANCE_FLOW] === true
	)
		return false;
	return !hostFlowRunsModuleCode(slothlet, store.parentInstanceID);
}

/**
 * Whether a receiver is a view of the node a method was read from: the node one api path segment above
 * the method, in the same instance. Only such a receiver is handed to the method as its own module's
 * view (#625); a view of any other node a caller supplies through `.call()` / `.apply()` is not.
 *
 * @param {*} thisArg - The receiver of the call.
 * @param {object} method - The wrapper of the method called.
 * @returns {boolean} Whether `thisArg` is a view of the method's own node.
 * @private
 */
function selfIsMethodNode(thisArg, method) {
	if (thisArg === null || (typeof thisArg !== "object" && typeof thisArg !== "function")) return false;
	if (!WeakMapMethods.has(SELF_VIEW_NODES, thisArg)) return false;
	const node = WeakMapMethods.get(SELF_VIEW_NODES, thisArg);
	const owner = resolveWrapper(node) ?? WeakMapMethods.get(capturedViewChildren, node) ?? null;
	if (owner === null || owner.slothlet !== method.slothlet) return false;
	const methodPath = String(method.____slothletInternal.apiPath);
	const dot = StringMethods.lastIndexOf(methodPath, ".");
	if (dot < 0) return false;
	return String(owner.____slothletInternal.apiPath) === StringMethods.slice(methodPath, 0, dot);
}

/**
 * What a call made through a view hands back, as the reader that made it sees it: a node comes back as a
 * view, also once a promise of one settles, so a module cannot take the node itself from a method's return
 * value (its receiver, for one).
 *
 * @param {*} result - What the call returned.
 * @param {object} reader - The reader the view belongs to.
 * @param {object|null} [slothlet] - The instance, to hand the reader what a promise rejects with (see
 *   {@link carryTo}); null leaves the rejection as it is.
 * @returns {*} The result, a view of it, or a promise of either.
 * @private
 */
function selfViewResult(result, reader, slothlet = null, from = null) {
	// Only a plain native promise is followed: any other thenable is handed back exactly as it is.
	if (inherits(result, Promise) && Objects.getPrototypeOf(result) === Promise.prototype) {
		// A promise of the engine's own is reacted to with the language's `then`, never one read off it; a Proxy that
		// reports the promise prototype through its own `then`, as before.
		const then = util.types.isPromise(result) ? FunctionMethods.bind(pinnedThen, null, result) : FunctionMethods.bind(result.then, result);
		if (slothlet === null) return then((value) => selfView(value, reader, from));
		// What it rejects with reaches the reader as values crossing between modules do (#667).
		return then(
			(value) => selfView(value, reader, from),
			(error) => {
				throw crossTo(error, reader, slothlet, from);
			}
		);
	}
	return selfView(result, reader, from);
}

/**
 * The member views {@link selfMemberView} built: per value, per reader, per api path.
 * @type {WeakMap<object, WeakMap<object, Map<string, object>>>}
 * @private
 */
const SELF_MEMBER_VIEW_CACHE = new WeakMap();

/**
 * What each member or data view stands for: the value, who read it, the instance, the api path it was reached at,
 * the view itself, and the member or data view it was read through, if any ({@link selfLap}).
 * @type {WeakMap<object, {value: object, reader: object, slothlet: object, parts: string[], view: object|null, parent: WeakRef<object>|null}>}
 * @private
 */
const SELF_MEMBER_VIEWS = new WeakMap();

/**
 * The well-known symbols (`Symbol.iterator`, `Symbol.hasInstance`, …) and Node's inspect hook. What a member
 * holds under one of them is the language's protocol, not data of the member, and is read as is.
 * @type {Set<symbol>}
 * @private
 */
const PROTOCOL_SYMBOLS = setFrom(
	concatLists(
		filterList(
			mapList(Objects.getOwnPropertyNames(Symbol), (name) => Symbol[name]),
			(value) => typeof value === "symbol"
		),
		[Symbols.for("nodejs.util.inspect.custom")]
	)
);

/**
 * The language's own `Function.prototype[Symbol.hasInstance]` and the brand checks slothlet's own checks use, taken
 * when this file loads, before any module runs: a module can give a global class a `Symbol.hasInstance` of its own,
 * which an `instanceof` in slothlet's code would run with slothlet's values (#632).
 * @private
 */
const INTRINSIC_HAS_INSTANCE = PrototypeFunctions.Function.hasInstance;

/**
 * A value read through `self` at an api path, as the reader is handed it: a node as its view
 * ({@link selfView}), a framework member as its view, a plain value under another node's path as a
 * member view ({@link selfMemberView}), anything else as is.
 *
 * @param {*} value - The value read.
 * @param {object} reader - Who read it.
 * @param {object} slothlet - Instance the api belongs to.
 * @param {string[]} parts - The api path the value was reached at.
 * @param {string|symbol|null} prop - The key it was read under, or null for a prototype.
 * @param {object} [through] - Record of the member or data view it was read through, if any: a value already on
 *   that walk is handed out as the view the walk went through ({@link selfLap}).
 * @returns {*} What the reader is handed.
 * @private
 */
function selfMemberOf(value, reader, slothlet, parts, prop, through) {
	/**
	 * Whether `value` is a plain value of the api rather than a node: no node, view, version dispatcher, or
	 * framework member, each of which is handed out its own way.
	 * @param {object} value - An object or function.
	 * @returns {boolean} Whether it is plain.
	 * @private
	 */
	function isPlainMember(value) {
		return (
			!isIntrinsic(value) &&
			!hasInternalSlots(value) &&
			!WeakMapMethods.has(SELF_VIEW_NODES, value) &&
			!WeakMapMethods.has(SELF_MEMBER_VIEWS, value) &&
			!WeakMapMethods.has(FRAMEWORK_VIEW_TARGETS, value) &&
			!WeakMapMethods.has(FRAMEWORK_MEMBERS, value) &&
			resolveWrapper(value) === null &&
			versionDispatcherRecord(value) === null &&
			!WeakMapMethods.has(capturedViewChildren, value) &&
			!isFrameworkInternal(value)
		);
	}

	/**
	 * The api node a module's function stands for, as a reader reaching the function through a value of the module's (a
	 * prototype's `constructor`, an instance's) is handed it, so its members are read through the node's rules, as
	 * `fn.prototype.constructor === fn` reads them in plain JS: the api root for the root file's function, the node fronting
	 * it for any other, and `undefined` for a function no node of the instance fronts.
	 * @param {object} slothlet - The instance.
	 * @param {Function} fn - The function.
	 * @param {object} reader - Who reads it.
	 * @returns {Function|object|undefined} What the reader is handed, or `undefined`.
	 * @private
	 */
	function frontedFunctionView(slothlet, fn, reader) {
		if (!slothlet || reader === HOST_READER) return undefined;
		const node = frontingNodeNow(slothlet, fn);
		return node === undefined || node === slothlet.boundApi ? node : selfView(node, reader);
	}

	/**
	 * The view a member read walking back into a value already on the walk hands out (#688): that value's view, the one
	 * the walk went through. Following `conn.self = conn` round its cycle therefore hands back the same view on every
	 * lap, so the cycle closes through the views as on the value, and deep equality finds it. A lap is held to the
	 * path of that earlier view, the shorter one. A value at two paths that are no cycle keeps a view per path.
	 *
	 * Each view links to the one it was read through weakly, so the walk keeps no value alive that the views it went
	 * through would not.
	 *
	 * @param {object} record - Record of the view the member is read through.
	 * @param {object|Function} value - The member read.
	 * @returns {object|null} The view of `value` on the walk, or null when `value` is not on it.
	 * @private
	 *
	 * @example
	 * selfLap(SELF_MEMBER_VIEWS.get(conn), raw.self); // conn's view, when raw.self === raw
	 */
	function selfLap(record, value) {
		for (let step = record; step !== undefined; step = step.parent == null ? undefined : WeakRefMethods.deref(step.parent)) {
			if (step.value === value) return step.view;
		}
		return null;
	}

	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	// A reader's view of a prototype a node was given, and a stand-in a closed node holds for its code, are handed on
	// as they are: each checks every read and change itself.
	if (WeakMapMethods.has(GIVEN_VIEWS, value) || WeakMapMethods.has(PINNED_CODE_MEMBERS, value)) return value;
	// A prototype's handle is the same object to every reader it is handed to, as a node is, and the object behind it to
	// code nothing could refuse an access through it.
	if (isPrototypeHandle(value)) return prototypeForHolder(slothlet, reader, value);
	// A function of the module's an api node stands for is that node, read under its own rules (a prototype's
	// `constructor`, say).
	if (typeof value === "function") {
		const fronted = frontedFunctionView(slothlet, value, reader);
		if (fronted !== undefined) return fronted;
	}
	if (typeof prop === "symbol" && SetMethods.has(PROTOCOL_SYMBOLS, prop)) return value;
	if (WeakMapMethods.has(FRAMEWORK_MEMBERS, value)) return selfFrameworkView(value, reader);
	if (through !== undefined) {
		const lap = selfLap(through, value);
		if (lap !== null) return lap;
	}
	if (hasInternalSlots(value) && !WeakMapMethods.has(SELF_MEMBER_VIEWS, value))
		return selfDataView(value, reader, slothlet, parts, through);
	if (!isPlainMember(value)) return selfView(value, reader);
	return selfMemberView(value, reader, slothlet, parts, through);
}

/** The `Set` methods that compare it with another set-like and make no change to it. @type {ReadonlySet<string>} @private */
const SET_COMPARISONS = setFrom([
	"union",
	"intersection",
	"difference",
	"symmetricDifference",
	"isSubsetOf",
	"isSupersetOf",
	"isDisjointFrom"
]);

/**
 * The data views {@link selfDataView} built: per value, per reader, per api path.
 * @type {WeakMap<object, WeakMap<object, Map<string, object>>>}
 * @private
 */
const SELF_DATA_VIEW_CACHE = new WeakMap();

/**
 * Hand out a module's data object — a `Map`, `Set`, `Date`, `ArrayBuffer`, typed array, `DataView`, `RegExp`,
 * `Promise`, `WeakRef` — read through `self` as a view held to the rule of the api path it was reached at (#625).
 *
 * A reader that may write the path (it owns it, or a write rule grants it the write) is handed the object itself, so
 * native code taking it (`fs.write`, `crypto`, `structuredClone`, `ArrayBuffer.isView`) works as on the object. Any
 * other reader gets the view: live, as it reads the object itself, and read-only. Native code refuses a view, so
 * such a reader copies what it passes on (`Buffer.from(view)`, `view.slice()`).
 *
 * The object keeps its contents in itself, so the engine's own methods have to run on it, and the view runs them
 * there: those of its kind that only read it as plain reads, and every other one — one the engine adds later
 * included — as a write at the path, held to the ownership and write rules like an assignment, a definition, a
 * deletion, or a change to its prototype or extensibility. A method its module defined (on a subclass of the kind)
 * runs on the object itself, as a call through a member view does. What it holds — a value `get` returns, what
 * iteration yields, what a callback or a promise is handed, the object itself handed to a callback, a typed array's
 * shared `buffer` and `subarray`, its own members and prototype — comes back held to the same rule; a copy a method
 * makes (`slice()`, `union()`) is the caller's own. The proxy's target is a shadow, never the object, as a member
 * view's is.
 *
 * @param {object} value - The data object.
 * @param {object} reader - Who read it.
 * @param {object} slothlet - Instance the api belongs to.
 * @param {string[]} parts - The api path it was reached at.
 * @param {object} [through] - Record of the member or data view it was read through, if any.
 * @returns {object} The view.
 * @private
 */
function selfDataView(value, reader, slothlet, parts, through) {
	/**
	 * Whether the engine's method `name` of the data object `value` only reads it: on its kind's list, or every
	 * object's; a `Date`'s `get…` and `to…` methods and its primitive conversion; a `DataView`'s `get…` methods.
	 * @param {object} value - The data object.
	 * @param {PropertyKey} name - The method's key.
	 * @returns {boolean} Whether calling it only reads the object.
	 * @private
	 */
	function isDataReader(value, name) {
		if (SetMethods.has(COMMON_READERS, name)) return true;
		const kind = dataKind(value);
		if (kind === "date")
			return (
				name === Symbol.toPrimitive ||
				(typeof name === "string" && (StringMethods.startsWith(name, "get") || StringMethods.startsWith(name, "to")))
			);
		if (kind === "dataview") return typeof name === "string" && StringMethods.startsWith(name, "get");
		if (kind === "typedarray") return SetMethods.has(TYPED_ARRAY_READERS, name);
		// A boxed primitive never changes: every method of its kind reads it.
		if (kind === "boxed") return true;
		{
			const readers = MapMethods.get(DATA_READERS, kind);
			return readers ? SetMethods.has(readers, name) : false;
		}
	}

	/**
	 * Whether `reader` may write the api path `parts` now: the write a change through it would be, judged as one.
	 * @param {object} slothlet - Instance the api belongs to.
	 * @param {object} reader - The module that read it.
	 * @param {string[]} parts - The api path.
	 * @returns {boolean} Whether the write would be allowed.
	 * @private
	 */
	function readerMayWrite(slothlet, reader, parts) {
		try {
			slothlet.handlers.apiManager.assertOwnedWrite(parts, reader);
			return true;
		} catch {
			return false;
		}
	}

	// The host owns the whole tree: it is handed the value itself, as is a module that may change it.
	if (reader === HOST_READER) return value;
	if (reader !== UNATTRIBUTED_READER && readerMayWrite(slothlet, reader, parts)) return value;
	let byReader = WeakMapMethods.get(SELF_DATA_VIEW_CACHE, value);
	if (!byReader) {
		byReader = new WeakMap();
		WeakMapMethods.set(SELF_DATA_VIEW_CACHE, value, byReader);
	}
	let byPath = WeakMapMethods.get(byReader, reader);
	if (!byPath) {
		byPath = new Map();
		WeakMapMethods.set(byReader, reader, byPath);
	}
	const pathKey = ArrayMethods.join(parts, ".");
	const cached = MapMethods.get(byPath, pathKey);
	if (cached) return cached;

	const raw = value;
	const record = { value: raw, reader, slothlet, parts, view: null, parent: through === undefined ? null : new WeakRef(through) };
	const shadow = {};
	// Values it holds are handed back viewed; the buffer a typed array or DataView shares with it too.
	const kind = dataKind(raw);
	const holdsValues = kind === "map" || kind === "set" || kind === "weakmap" || kind === "weakset" || kind === "weakref";
	const isPromise = kind === "promise";
	// A promise's methods run on one that settles as it does, with what it settles with viewed: a callback, and a
	// `then()`, `catch()`, or `finally()` passing the value on, get the view, never what the module holds.
	let settled = null;
	const viewedPromise = () =>
		(settled ??= FunctionMethods.call(
			PrototypeFunctions.Promise.then,
			raw,
			(resolved) => held(resolved),
			(reason) => Promises.reject(held(reason))
		));
	const sharedBuffer = ArrayBuffers.isView(raw) ? raw.buffer : null;
	const assertWrite = (prop) => {
		const target = typeof prop === "string" ? concatLists(parts, [prop]) : parts;
		const writer = selfRootWriter(slothlet, reader, target);
		if (writer !== null) slothlet.handlers.apiManager.assertOwnedWrite(target, writer);
		assertReaderWrite(slothlet, reader, writer, target);
	};
	let view = null;
	const held = (child) => (child === raw ? view : selfMemberOf(child, reader, slothlet, parts, null, record));
	const memberAt = (prop, child) =>
		selfMemberOf(child, reader, slothlet, typeof prop === "string" ? concatLists(parts, [prop]) : parts, prop, record);
	const viewedProto = () => {
		const proto = Reflect.getPrototypeOf(raw);
		return proto === null ? null : selfMemberOf(proto, reader, slothlet, parts, null, record);
	};
	const shownDescriptor = (prop, descriptor) =>
		"value" in descriptor
			? { __proto__: null, ...descriptor, value: memberAt(prop, descriptor.value) }
			: { __proto__: null, ...descriptor, get: memberAt(prop, descriptor.get), set: memberAt(prop, descriptor.set) };
	// A member the object holds fixed is mirrored onto the shadow as the view reports it, and reported from there.
	const mirror = (prop) => {
		const descriptor = Reflect.getOwnPropertyDescriptor(raw, prop);
		if (!descriptor) {
			const stale = Reflect.getOwnPropertyDescriptor(shadow, prop);
			if (stale && stale.configurable) Reflect.deleteProperty(shadow, prop);
			return undefined;
		}
		const fixed = Reflect.getOwnPropertyDescriptor(shadow, prop);
		if (fixed && !fixed.configurable && "value" in fixed && !fixed.writable) return fixed;
		const shown = shownDescriptor(prop, descriptor);
		if (!descriptor.configurable || !Reflect.isExtensible(shadow)) Reflect.defineProperty(shadow, prop, shown);
		return shown;
	};
	// An object closed to extension is mirrored whole, the shadow closed with it, as the engine checks a proxy's
	// answers about a non-extensible target against that target.
	const mirrorClosed = () => {
		if (Reflect.isExtensible(raw)) return;
		for (let ofIndex = 0, ofList = Reflect.ownKeys(shadow); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (!hasOwn(raw, key)) Reflect.deleteProperty(shadow, key);
		}
		if (Reflect.isExtensible(shadow)) {
			const descriptors = Objects.getOwnPropertyDescriptors(raw);
			for (let ofIndex = 0, ofList = Reflect.ownKeys(descriptors); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				Reflect.defineProperty(shadow, key, shownDescriptor(key, descriptors[key]));
			}
			Reflect.setPrototypeOf(shadow, viewedProto());
			Reflect.preventExtensions(shadow);
		} else {
			for (let ofIndex = 0, ofList = Reflect.ownKeys(raw); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				mirror(key);
			}
		}
	};
	// The object itself handed to a callback is the view; what it holds, viewed.
	const callbackArg = (entry) => (entry === raw ? view : holdsValues || isPromise ? held(entry) : entry);
	const result = (returned) => {
		if (returned === raw) return view;
		if (returned === null || (typeof returned !== "object" && typeof returned !== "function")) return returned;
		// A promise a promise's method makes is the caller's: what it settles with comes from the caller's callbacks.
		if (isPromise) return returned;
		// An iterator over what it holds yields it viewed.
		if (holdsValues && typeof returned.next === "function") {
			// An iterator as the engine's are (its helpers, `toArray()`, `map()`, …, and its tag), yielding viewed values.
			const iterator = Objects.create(typeof Iterator === "function" ? Iterator.prototype : Objects.prototype);
			const tag = StringMethods.slice(ObjectMethods.toString(returned), 8, -1);
			Objects.defineProperties(iterator, {
				next: {
					value: (...args) => {
						const step = Reflect.apply(returned.next, returned, args);
						return step.done ? step : { value: held(step.value), done: false };
					}
				},
				return: {
					value: (...args) =>
						typeof returned.return === "function" ? Reflect.apply(returned.return, returned, args) : { value: args[0], done: true }
				},
				throw: {
					value: (...args) => {
						if (typeof returned.throw === "function") return Reflect.apply(returned.throw, returned, args);
						throw args[0];
					}
				},
				[Symbol.iterator]: {
					value() {
						return this;
					}
				},
				[Symbol.toStringTag]: { value: tag }
			});
			return iterator;
		}
		if (holdsValues) return held(returned);
		// Memory it shares is held to the rule too; a copy it made is the caller's own.
		if (sharedBuffer !== null && (returned === sharedBuffer || (ArrayBuffers.isView(returned) && returned.buffer === sharedBuffer))) {
			return held(returned);
		}
		return returned;
	};
	const methods = new Map();
	const method = (prop, fn) => {
		const known = MapMethods.get(methods, prop);
		if (known?.fn === fn) return known.call;
		const reads = isDataReader(raw, prop);
		const compares = kind === "set" && SetMethods.has(SET_COMPARISONS, prop);
		const call = function (...args) {
			if (!reads) assertWrite(null);
			// A comparison runs on a copy holding what the set holds viewed: the set-like it is handed is the caller's,
			// and is shown nothing else, and what it makes is the caller's own.
			// The set-like is handed on as the caller gave it: a view of another object stays that view.
			if (compares) return Reflect.apply(fn, setFrom(listFromIterable(raw, (entry) => held(entry))), args);
			// A key is looked up as the object holds it, so a view of one is unwrapped; what follows a callback (its
			// `this`) is handed on as the caller gave it.
			let afterCallback = false;
			const passed = mapList(args, (arg) => {
				if (afterCallback) return arg;
				const unwrapped = unwrapSelfView(arg);
				if (typeof unwrapped !== "function") return unwrapped;
				afterCallback = true;
				return function (...values) {
					return Reflect.apply(unwrapped, this, mapList(values, callbackArg));
				};
			});
			return result(Reflect.apply(fn, isPromise ? viewedPromise() : raw, passed));
		};
		MapMethods.set(methods, prop, { fn, call });
		return call;
	};
	view = new NativeProxy(shadow, {
		__proto__: null,
		get(_, prop) {
			mirrorClosed();
			const fixed = Reflect.getOwnPropertyDescriptor(shadow, prop);
			if (fixed && !fixed.configurable && "value" in fixed && !fixed.writable) return fixed.value;
			const member = Reflect.get(raw, prop, raw);
			if (sharedBuffer !== null && prop === "buffer") return held(member);
			if (typeof member === "function" && prop !== "constructor") {
				// The engine's own method runs on the object; one its module defined runs as a member view's call does.
				return isEngineMember(raw, prop) ? method(prop, member) : memberAt(prop, member);
			}
			if (typeof prop === "symbol" && SetMethods.has(PROTOCOL_SYMBOLS, prop)) return member;
			return memberAt(prop, member);
		},
		getOwnPropertyDescriptor(_, prop) {
			mirrorClosed();
			return mirror(prop);
		},
		has(_, prop) {
			mirrorClosed();
			return Reflect.has(raw, prop);
		},
		ownKeys() {
			mirrorClosed();
			return Reflect.ownKeys(raw);
		},
		getPrototypeOf() {
			mirrorClosed();
			if (!Reflect.isExtensible(shadow)) return Reflect.getPrototypeOf(shadow);
			return viewedProto();
		},
		isExtensible() {
			mirrorClosed();
			return Reflect.isExtensible(shadow);
		},
		set(_, prop, written, receiver) {
			// A write reaching the view from an object that inherits from it lands on that object, as plain JS has it.
			if (receiver !== view) return Reflect.set(raw, prop, written, receiver);
			assertWrite(prop);
			const done = Reflect.set(raw, prop, unwrapSelfView(written), raw);
			if (done) mirror(prop);
			return done;
		},
		...selfViewWriteTraps(raw, shadow, assertWrite, mirror, mirrorClosed)
	});
	record.view = view;
	MapMethods.set(byPath, pathKey, view);
	WeakMapMethods.set(SELF_MEMBER_VIEWS, view, record);
	return view;
}

/**
 * What {@link selfDataMember} answers for a member it leaves to the node.
 * @type {symbol}
 * @private
 */
const NODE_MEMBER = Symbol("slothlet.nodeMember");

/**
 * The language's own members of the built-in data object a node holds (a file's default export that is a `Map`, a
 * `Set`, a `Date`, …), as a reader is handed them through `self`: as a view of that object at the node's path hands them
 * ({@link selfDataView}), so the node and the same object reached as a named export answer alike. A method that
 * changes the object is a write at the node's path, and what a method hands back of the object (a map's entry, what
 * its iterator yields, the object passed to a callback) is held to the owner's write rules. A reader that may make every
 * write there (and the host, and every module while the permission system is off) gets each method running on the
 * object itself.
 * @param {object|null} inner - The node's wrapper, or null for a view of something else.
 * @param {object} reader - Who reads it.
 * @param {object} slothlet - The instance.
 * @param {string|symbol} prop - The member read.
 * @returns {*} The member, or {@link NODE_MEMBER} when the node's own answer stands.
 * @private
 *
 * @example
 * // single/dmap.mjs: export default new Map([["one", { n: 1 }]]);
 * self.single.dmap.get("one").n = 5; // LOOSE_SET_NOT_OWNED, as self.owner.dmap.get("one").n = 5 is
 */
function selfDataMember(inner, reader, slothlet, prop) {
	/**
	 * The api path of a node, as its segments.
	 * @param {object} node - The node, or its wrapper.
	 * @returns {string[]} The path's segments.
	 * @private
	 */
	function apiPathParts(node) {
		return filterList(splitText(String(resolveWrapper(node)?.____slothletInternal.apiPath ?? ""), "."), Boolean);
	}

	if (inner === null || reader === HOST_READER || prop === "constructor") return NODE_MEMBER;
	const impl = inner.____slothletInternal.impl;
	if (!holdsDataKind(impl) || !isEngineMember(impl, prop)) return NODE_MEMBER;
	const view = selfDataView(impl, reader, slothlet, apiPathParts(inner));
	// A reader handed the object itself gets the node's answer, the object's own member (see frontedDataMember).
	return view !== impl ? Reflect.get(view, prop, view) : NODE_MEMBER;
}

/**
 * Hand out a plain value reached through a node `self` handed out — a class's `prototype`, a method of it,
 * the constructor behind it, what those hold in turn — as a view held to the rule of the api path it was
 * reached at (#625).
 *
 * Such a value is no node of its own, but it is part of the node it was reached through: changing a class's
 * prototype changes what every instance of it does, the host's included. So a change made through the view —
 * an assignment, a definition, or a deletion of a member, a change to its prototype or extensibility — is held
 * to the ownership and write rules at that path, at any depth, exactly as a change to a member of the node
 * itself: refused for a module that does not own the path, and, made later from outside any call, held to
 * the module that read it. Reads, calls, `new`, and use as a prototype (`class extends`) behave as on the value
 * itself; a call runs on the value itself, and what it returns is handed back as it is: an instance a module
 * returns is data it chose to share (#597). A write landing on an object that only inherits from the view
 * (a subclass instance) is that object's own and is left to plain JS. The view stands in for the value it
 * views: stored into the api, the value itself is stored.
 *
 * The proxy's target is a shadow, never the value: what the view reports of a member the value holds fixed is
 * mirrored onto the shadow, so the view can hand that member out as a view too.
 *
 * A member read walking back into a value already on the walk is that value's view ({@link selfLap}), so a
 * cycle closes on the views (#688).
 *
 * @param {object|Function} value - The plain value.
 * @param {object} reader - Who read it.
 * @param {object} slothlet - Instance the api belongs to.
 * @param {string[]} parts - The api path the value was reached at.
 * @param {object} [through] - Record of the member or data view it was read through, if any.
 * @returns {object|Function} The view.
 * @private
 */
function selfMemberView(value, reader, slothlet, parts, through) {
	/**
	 * Whether `value` holds `fn` as a member — its own, or inherited, as a method, a getter, or a setter.
	 * @param {object|Function} value - The value.
	 * @param {Function} fn - The function.
	 * @returns {boolean} Whether `fn` is one of its members.
	 * @private
	 */
	function holdsMember(value, fn) {
		if (WeakMapMethods.get(MEMBER_HOLDERS, fn) == null ? undefined : WeakSetMethods.has(WeakMapMethods.get(MEMBER_HOLDERS, fn), value))
			return true;
		for (
			let proto = value;
			proto !== null && (typeof proto === "object" || typeof proto === "function");
			proto = Reflect.getPrototypeOf(proto)
		) {
			for (let ofIndex = 0, ofList = Reflect.ownKeys(proto); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				const descriptor = Reflect.getOwnPropertyDescriptor(proto, key);
				if (descriptor && (descriptor.value === fn || descriptor.get === fn || descriptor.set === fn)) {
					if (!WeakMapMethods.has(MEMBER_HOLDERS, fn)) WeakMapMethods.set(MEMBER_HOLDERS, fn, new WeakSet());
					WeakSetMethods.add(WeakMapMethods.get(MEMBER_HOLDERS, fn), value);
					return true;
				}
			}
		}
		return false;
	}

	// The host owns the whole tree: it is handed the value itself.
	if (reader === HOST_READER) return value;
	let byReader = WeakMapMethods.get(SELF_MEMBER_VIEW_CACHE, value);
	if (!byReader) {
		byReader = new WeakMap();
		WeakMapMethods.set(SELF_MEMBER_VIEW_CACHE, value, byReader);
	}
	let byPath = WeakMapMethods.get(byReader, reader);
	if (!byPath) {
		byPath = new Map();
		WeakMapMethods.set(byReader, reader, byPath);
	}
	// A prototype's handle with no path of its own (see prototypeHandleFor) is kept apart from every path.
	const pathKey = parts === null ? "\u0000every site" : ArrayMethods.join(parts, ".");
	const cached = MapMethods.get(byPath, pathKey);
	if (cached) return cached;

	const raw = value;
	// A prototype's handle is no one's in particular: each access through it is decided for whoever makes it.
	const handle = reader === PROTOTYPE_HANDLE_READER;
	const who = handle ? () => selfReader(slothlet) : () => reader;
	// The paths a change through the view is decided at: its own, or, for a handle with none of its own, every path the
	// prototype is known at.
	const siteParts = () => {
		if (parts !== null) return [parts];
		const known = knownPrototype(slothlet, raw);
		const found = known === undefined ? [] : mapList(known.sites, (site) => site.parts);
		return found.length === 0 ? [[]] : found;
	};
	const baseParts = () => {
		if (parts !== null) return parts;
		return classSiteOf(slothlet, raw)?.parts ?? siteParts()[0];
	};
	const record = {
		value: raw,
		reader,
		slothlet,
		parts: parts ?? [],
		view: null,
		parent: through === undefined ? null : new WeakRef(through)
	};
	// A shadow of the same kind, so the view calls, constructs, and answers `Array.isArray` as the value does,
	// and carries no fixed member the value lacks.
	let shadow;
	if (Arrays.isArray(raw)) shadow = [];
	else if (typeof raw !== "function") shadow = {};
	else if (!isConstructor(raw)) shadow = () => {};
	else if (hasOwn(raw, "prototype")) shadow = function () {};
	else shadow = FunctionMethods.bind(function () {}, null);

	const member = (prop, child) => {
		const childParts = typeof prop === "string" ? concatLists(baseParts(), [prop]) : baseParts();
		if (!handle) return selfMemberOf(child, reader, slothlet, childParts, prop, record);
		const accessor = who();
		// The prototype's `constructor` is the class's node at the path the handle is reached at (`Alias.prototype` hands
		// back `Alias`), and the host reads any other function an api node stands for as that node, as it reads the node.
		if (typeof child === "function") {
			let fronting;
			const own = baseParts();
			if (prop === "constructor" && own.length > 1 && own[own.length - 1] === "prototype") {
				const classNode = nodeAtPath(slothlet, ArrayMethods.join(copyList(own, 0, own.length - 1), "."));
				if (classNode !== null && functionOf(classNode.____slothletInternal.impl) === child)
					fronting = classNode.____slothletInternal.proxy;
			}
			if (fronting === undefined && accessor === HOST_READER) fronting = frontingNode(slothlet, child);
			// A class no node stands for, reached as this prototype's `constructor`, is one view of it shared as the handle
			// is, whose `prototype` is the handle: `instanceof` against it holds for whatever reports the handle.
			if (
				fronting === undefined &&
				prop === "constructor" &&
				Reflect.getOwnPropertyDescriptor(child, "prototype")?.value === raw &&
				frontingNode(slothlet, child) === undefined
			)
				return selfMemberView(child, PROTOTYPE_HANDLE_READER, slothlet, childParts);
			if (fronting !== undefined) {
				if (accessor === HOST_READER || fronting === slothlet.boundApi) return fronting;
				// Bound to the module reading as a read of that node through `self` is (see functionNodeFor).
				const permissionManager = slothlet.handlers?.permissionManager;
				const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
				const bound =
					permissionManager?.isEnabled() && permissionManager.isCaptureEnabled?.() !== false && identity?.currentWrapper
						? capturedView(fronting, identity.currentWrapper, true, identity.ceiling ?? null)
						: fronting;
				return selfView(bound, accessor);
			}
		}
		// A class's own prototype read off a shared view of the class is its handle.
		if (prop === "prototype" && typeof raw === "function" && child !== null && typeof child === "object") {
			const prototypeHandle = prototypeHandleOf(slothlet, child);
			if (prototypeHandle !== child) return prototypeHandle;
		}
		return selfMemberOf(child, accessor, slothlet, childParts, prop);
	};
	const shownDescriptor = (prop, descriptor) =>
		"value" in descriptor
			? { __proto__: null, ...descriptor, value: member(prop, descriptor.value) }
			: { __proto__: null, ...descriptor, get: member(prop, descriptor.get), set: member(prop, descriptor.set) };
	// A handle's shadow is every reader's, and a closed one must describe each member as it holds it, so a private member
	// a handle holds fixed holds a stand-in for its value, every use of which is checked as reading the member is: the
	// description can go to anyone, and listing a closed prototype (`Object.keys`, `for…in`, `Object.isFrozen`, which read
	// each description) refuses no one. One stand-in per member and value, so a member is the same object each time.
	const privateName = (prop) => handle && typeof prop === "string" && StringMethods.charCodeAt(prop, 0) === 95;
	const standIns = new Map();
	const standIn = (prop, value) => {
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
		const known = MapMethods.get(standIns, prop);
		if (known !== undefined && known.value === value) return known.standIn;
		const made = checkedStandIn(() => refusePrivate(prop), value);
		MapMethods.set(standIns, prop, { value, standIn: made });
		return made;
	};
	const heldDescriptor = (prop, descriptor) => {
		if (!privateName(prop)) return shownDescriptor(prop, descriptor);
		return "value" in descriptor
			? { __proto__: null, ...descriptor, value: standIn(prop, descriptor.value) }
			: { __proto__: null, ...descriptor, get: standIn(prop, descriptor.get), set: standIn(prop, descriptor.set) };
	};
	// Whether a description of a member hands out nothing of its value: each value it holds is a stand-in, or absent.
	const standsIn = (held) => held === undefined || WeakMapMethods.has(PINNED_CODE_MEMBERS, held);
	const withholds = (descriptor) =>
		"value" in descriptor
			? WeakMapMethods.has(PINNED_CODE_MEMBERS, descriptor.value)
			: standsIn(descriptor.get) && standsIn(descriptor.set);
	// A member the value holds fixed is mirrored onto the shadow as the view reports it, and reported from there.
	const mirror = (prop) => {
		const descriptor = Reflect.getOwnPropertyDescriptor(raw, prop);
		if (!descriptor) {
			const stale = Reflect.getOwnPropertyDescriptor(shadow, prop);
			if (stale && stale.configurable) Reflect.deleteProperty(shadow, prop);
			return undefined;
		}
		const held = Reflect.getOwnPropertyDescriptor(shadow, prop);
		if (held && !held.configurable && "value" in held && !held.writable) return held;
		if (!descriptor.configurable || !Reflect.isExtensible(shadow)) {
			const fixed = heldDescriptor(prop, descriptor);
			Reflect.defineProperty(shadow, prop, fixed);
			return fixed;
		}
		return shownDescriptor(prop, descriptor);
	};
	// A value closed to extension is mirrored whole, the shadow closed with it, as the engine checks a proxy's
	// answers about a non-extensible target against that target.
	const mirrorClosed = () => {
		if (Reflect.isExtensible(raw)) return;
		for (let ofIndex = 0, ofList = Reflect.ownKeys(shadow); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (!hasOwn(raw, key)) Reflect.deleteProperty(shadow, key);
		}
		if (Reflect.isExtensible(shadow)) {
			const descriptors = Objects.getOwnPropertyDescriptors(raw);
			for (let ofIndex = 0, ofList = Reflect.ownKeys(descriptors); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				Reflect.defineProperty(shadow, key, heldDescriptor(key, descriptors[key]));
			}
			Reflect.setPrototypeOf(shadow, prototypeOf(false));
			Reflect.preventExtensions(shadow);
		} else {
			for (let ofIndex = 0, ofList = Reflect.ownKeys(raw); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				mirror(key);
			}
		}
	};
	// A private member a prototype holds belongs to the module owning the path the prototype is reached at, as one a node
	// holds does: privacy attaches to the member's name, not to the route. Module code privacy keeps it from is refused
	// reading it, describing it, and creating or changing it, with the error a read of it off the node gets, and is
	// listed none of it. A data value is held to that only while data reads are gated, as on a node. A member found only
	// on a prototype no module made (`Object.prototype`'s `__lookupGetter__`) is no module's, and the host and the owning
	// module's code reach every one, as does everyone while the permission system is off.
	const privateRefused = (prop, audit, writing = false) => {
		if (!handle || typeof prop !== "string" || StringMethods.charCodeAt(prop, 0) !== 95) return null;
		const permissionManager = slothlet.handlers?.permissionManager;
		if (!permissionManager?.isEnabled()) return null;
		const accessor = who();
		if (accessor === HOST_READER) return null;
		if (!accessor?.____slothletInternal) return "";
		if (!writing) {
			let holder = raw;
			for (let depth = 0; holder !== null && depth < 64 && !util.types.isProxy(holder) && !hasOwn(holder, prop); depth++)
				holder = Reflect.getPrototypeOf(holder);
			if (holder === null || util.types.isProxy(holder) || WeakSetMethods.has(INTRINSICS, holder) || isSharedValue(holder)) return null;
			const descriptor = Reflect.getOwnPropertyDescriptor(holder, prop);
			if (!permissionManager.isReadGatingEnabled() && descriptor && "value" in descriptor && isTerminalData(descriptor.value)) return null;
		}
		const internal = accessor.____slothletInternal;
		const callerPath = String(internal.apiPath ?? "");
		const callerFile = internal.filePath ?? null;
		for (let ofIndex = 0, ofList = siteParts(); ofIndex < ofList.length; ofIndex++) {
			const holderParts = ofList[ofIndex];
			const holderPath = ArrayMethods.join(holderParts, ".");
			const holderFile = holderFilePath(slothlet, holderParts);
			const allowed = audit
				? permissionManager.enforceAccess(
						callerPath,
						holderPath === "" ? prop : `${holderPath}.${prop}`,
						callerFile,
						holderFile,
						null,
						null,
						{
							moduleCaller: true,
							heldMember: true
						}
					)
				: permissionManager.mayReachPrivate(callerPath, holderPath, callerFile, holderFile);
			if (!allowed) return callerPath;
		}
		return null;
	};
	const refusePrivate = (prop, writing = false) => {
		const callerPath = privateRefused(prop, true, writing);
		if (callerPath === null) return;
		throw new slothlet.SlothletError("PERMISSION_DENIED", {
			caller: callerPath,
			target: segmentsOf(`${ArrayMethods.join(baseParts(), ".")}.${prop}`)
		});
	};
	// A private member left out of what the handle lists, describes and reports holding, for code privacy keeps it from:
	// one the prototype holds open, so the engine's checks of a proxy's answers against its target allow leaving it out.
	// One it holds fixed, or on a closed prototype, has to be listed and reported held (proxy invariants): it is described
	// holding a stand-in for its value (heldDescriptor), and reading it is refused.
	const privateHidden = (prop) => {
		if (privateRefused(prop, false) === null) return false;
		const descriptor = Reflect.getOwnPropertyDescriptor(raw, prop);
		return !descriptor || (descriptor.configurable && Reflect.isExtensible(raw));
	};
	const assertWrite = (prop) => {
		const accessor = who();
		for (let ofIndex = 0, ofList = siteParts(); ofIndex < ofList.length; ofIndex++) {
			const target = typeof prop === "string" ? concatLists(ofList[ofIndex], [prop]) : ofList[ofIndex];
			// A handle is no one's in particular: a function another module handed over to run (a bound built-in) makes the
			// write for that module too, which has to be allowed it, as through a view the module held.
			if (handle)
				for (let actIndex = 0; actIndex < ACTING_FOR.length; actIndex++) {
					const actor = ACTING_FOR[actIndex];
					if (actor !== accessor && actor.slothlet === slothlet) assertReaderWrite(slothlet, actor, accessor, target);
				}
			const writer = selfRootWriter(slothlet, accessor, target);
			// The view's reader first: the write goes through its view, so a refusal of its own is the answer, whatever the
			// module executing (one it handed a bound built-in to) may write.
			assertReaderWrite(slothlet, accessor, writer, target);
			if (writer !== null) slothlet.handlers.apiManager.assertOwnedWrite(target, writer);
		}
		refusePrivate(prop, true);
	};
	// The value's prototype as the reader is handed it, by `Object.getPrototypeOf` and through `__proto__` alike (#667):
	// a class's prototype a node of the instance fronts the class of is read through that node, as reading its
	// `prototype` is, so each prototype up a subclass's chain is checked against the class that owns it. Unchecked when
	// the view only mirrors it onto a closed shadow, whose answers are checked when they are asked for. Up a handle's
	// chain each prototype is its handle too.
	const prototypeOf = (check = true) => {
		const proto = Reflect.getPrototypeOf(raw);
		// A prototype made by no module (Node's `EventEmitter.prototype`) is the module's to no one, and is the object
		// itself, so `instanceof` against Node's own classes still holds.
		if (isSharedValue(proto)) return proto;
		const classNode = prototypeClassNode(slothlet, proto);
		if (classNode === undefined) {
			if (!handle) return member(null, proto);
			const shown = prototypeHandleAt(slothlet, proto, { parts: baseParts() });
			return check ? prototypeForHolder(slothlet, who(), shown) : shown;
		}
		if (check) {
			const accessor = who();
			return atClassSite(slothlet, accessor === HOST_READER ? classNode.prototype : selfView(classNode, accessor).prototype);
		}
		const classSite = prototypeSiteOf(resolveWrapper(classNode), "prototype");
		if (handle) return prototypeHandleAt(slothlet, proto, classSite);
		return selfMemberOf(proto, reader, slothlet, classSite.parts, "prototype");
	};
	// Once the instance has shut down, the view reads, lists, describes, calls and changes nothing for a module; a
	// handle tells a module's code from the host's by the code making the access.
	const refuseEnded = () => refuseEndedAccess(slothlet, reader);
	const assertLiveWrite = (prop) => {
		refuseEnded();
		assertWrite(prop);
	};
	const view = new NativeProxy(shadow, {
		__proto__: null,
		get(_, prop, receiver) {
			refuseEnded();
			mirrorClosed();
			// An object's `__proto__` is its prototype, the same view `Object.getPrototypeOf` reports (#667).
			const engineProto = prop === "__proto__" && receiver === view && typeof raw !== "function" && readsEngineProto(raw);
			if (!engineProto) refusePrivate(prop);
			const held = Reflect.getOwnPropertyDescriptor(shadow, prop);
			if (held && !held.configurable && "value" in held && !held.writable) return held.value;
			if (engineProto) {
				if (Reflect.isExtensible(shadow)) return prototypeOf();
				prototypeOf();
				return Reflect.getPrototypeOf(shadow);
			}
			return member(prop, Reflect.get(raw, prop, receiver === view ? raw : receiver));
		},
		getOwnPropertyDescriptor(_, prop) {
			refuseEnded();
			mirrorClosed();
			if (privateHidden(prop)) return undefined;
			const described = mirror(prop);
			// A fixed private member whose value no stand-in can hold (a primitive while data reads are gated) is described
			// as it is held, so describing it is refused as reading it is.
			if (described !== undefined && privateName(prop) && !withholds(described)) refusePrivate(prop);
			return described;
		},
		has(_, prop) {
			refuseEnded();
			mirrorClosed();
			if (privateHidden(prop)) return false;
			return Reflect.has(raw, prop);
		},
		ownKeys() {
			refuseEnded();
			mirrorClosed();
			if (!handle) return Reflect.ownKeys(raw);
			return filterList(Reflect.ownKeys(raw), (key) => !privateHidden(key));
		},
		getPrototypeOf() {
			refuseEnded();
			mirrorClosed();
			if (Reflect.isExtensible(shadow)) return prototypeOf();
			// A closed view reports what its shadow holds (proxy invariant), once the reader may have it.
			prototypeOf();
			return Reflect.getPrototypeOf(shadow);
		},
		isExtensible() {
			refuseEnded();
			mirrorClosed();
			return Reflect.isExtensible(shadow);
		},
		apply(_, thisArg, args) {
			refuseEnded();
			// The call runs on the value it was read from: a view of that value as `this` is the value, and a view of any
			// other value stays the view (#625), so a method cannot be pointed at another value to run on it as is.
			const record = WeakMapMethods.get(SELF_MEMBER_VIEWS, thisArg);
			const receiver = record && holdsMember(record.value, raw) ? record.value : thisArg;
			return selfViewResult(Reflect.apply(raw, receiver, args), who());
		},
		construct(_, args, newTarget) {
			refuseEnded();
			return Reflect.construct(raw, args, newTarget === view ? raw : newTarget);
		},
		set(_, prop, written, receiver) {
			refuseEnded();
			// A write reaching the view from an object that inherits from it lands on that object, as plain JS has it.
			if (receiver !== view) return Reflect.set(raw, prop, written, receiver);
			assertWrite(prop);
			const done = Reflect.set(raw, prop, unwrapSelfView(written));
			if (done) mirror(prop);
			return done;
		},
		...selfViewWriteTraps(raw, shadow, assertLiveWrite, mirror, mirrorClosed)
	});
	record.view = view;
	// A handle's privacy is decided for an instance's reads of what it inherits, too ({@link inheritedPrivate}).
	if (handle) {
		record.refusePrivate = refusePrivate;
		// A member an instance only inherits is no own member of the instance, so it can always be left out.
		record.privateHidden = (prop) => privateRefused(prop, false) !== null;
	}
	MapMethods.set(byPath, pathKey, view);
	WeakMapMethods.set(SELF_MEMBER_VIEWS, view, record);
	return view;
}

/**
 * The source file of the node nearest above or at an api path: the file of the node a value at that path (a class's
 * prototype) is beneath.
 * @param {object} slothlet - The instance.
 * @param {string[]} parts - The api path.
 * @returns {string|null} The file, or null when no node is found.
 * @private
 */
function holderFilePath(slothlet, parts) {
	for (let count = parts.length; count > 0; count--) {
		const node = nodeAtPath(slothlet, ArrayMethods.join(copyList(parts, 0, count), "."));
		if (node !== null) return node.____slothletInternal.filePath ?? null;
	}
	return null;
}

/**
 * `instanceof` against a callable node's view: whether `instance` inherits from the node's `prototype`, also
 * through the member view a reader got of that prototype (`class extends` a node's view makes one).
 *
 * @param {object} prototype - The node's own `prototype`.
 * @param {*} instance - The value tested.
 * @returns {boolean} Whether `instance` inherits from it.
 * @private
 */
function selfHasInstance(prototype, instance) {
	if (instance === null || (typeof instance !== "object" && typeof instance !== "function")) return false;
	// A node fronting an instance of a class a node fronts is tested as the instance it fronts (#667): the walk compares
	// prototypes by identity and runs none of the module's code, so a module the class's prototype is withheld from still
	// gets the answer `instanceof` gives on the plain instance, as it does testing against the class (see
	// hasInstanceOf).
	let behind = instance;
	while (WeakMapMethods.has(SELF_VIEW_NODES, behind) || WeakMapMethods.has(capturedViewTargets, behind))
		behind = WeakMapMethods.get(SELF_VIEW_NODES, behind) ?? WeakMapMethods.get(capturedViewTargets, behind);
	const instanceNode = resolveWrapper(behind);
	if (instanceNode && instanceNode.___instanceClassFront() !== null) instance = instanceNode.____slothletInternal.impl;
	// The class's prototype may be handed to the reader as a view or as the object itself (#667): compared as what it stands for.
	prototype = behindMemberView(prototype);
	for (let proto = Reflect.getPrototypeOf(instance); proto !== null; proto = Reflect.getPrototypeOf(proto)) {
		if (behindMemberView(proto) === prototype) return true;
	}
	return false;
}

/**
 * Hand out a node of the api reached through `self` as a view that keeps who read it (#625).
 *
 * `self.X = …` with no module executing is refused (`CONTEXT_NOT_ACTIVE_SELF`): nobody is there to
 * own the write. A node a module took through `self` and wrote into later from outside any call would
 * otherwise reach the node with no caller, which is the host's standing. So a write through the view made
 * with no module executing (outside a `run()` / `scope()` the host opened) is held to the module that read
 * the node: it goes through when that module owns the node's path, and is refused when it does not. A
 * module's own node therefore stays writable from a callback it hands the host, and the host can write
 * through a node a module handed back from its own subtree; another module's node cannot be written that
 * way. While a module is executing the write reaches the node, whose own rule then applies.
 *
 * The view reads, calls, and enumerates as the node does. What it hands back of the node — a member read,
 * a property descriptor's value, what a method returns — comes back as a view for the same reader, also a
 * view another reader handed back (a module returning its own node). A method called through it runs as
 * its own module: called on the node it was read from, it gets that module's view of the node as its
 * receiver, the one it reads through `self` itself, so it can keep its receiver and write its own node
 * later. A receiver supplied for another node and every argument reach it as the caller passed them, so a
 * node lent to it, even one of its own module's, stays held to the caller. A class instance or EventEmitter a method gets as
 * its receiver (#590, #340) comes back as a view of the node it was called on. The same node reached
 * through the host's `api` is not a view and is not affected. One view per node and reader, so a module
 * comparing what it read twice sees the same object. A node inside a plain object or array a module
 * returns is handed over as it is: the module chose to share it.
 *
 * @param {*} node - Value read through `self`.
 * @param {object} [reader] - Who read it; the code executing now when omitted.
 * @param {object|null} [from=null] - The module handing the value on, when one is.
 * @param {object|null} [access=null] - The read of `self` this is part of, when who is making it was resolved already
 *   (see `resolvedAccess` in `helpers/access-record`); used only to tell the reader, within this call.
 * @returns {*} A view of an api node, or `node` unchanged.
 * @internal
 *
 * @example
 * const ops = self.callee.ops; // a view of api.callee.ops
 * ops.note = "x"; // inside a call: the node's own ownership rule decides
 */
function selfView(node, reader, from = null, access = null) {
	/**
	 * A view handed to another reader: that reader's view of the same node. Anything that is not a view is
	 * returned as is.
	 *
	 * @param {*} value - A receiver.
	 * @param {object} reader - The reader it is handed to.
	 * @returns {*} The reader's view, or `value`.
	 * @private
	 */
	function selfViewFor(value, reader) {
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
		return WeakMapMethods.has(SELF_VIEW_NODES, value) ? selfView(value, reader) : value;
	}

	if (node === null || (typeof node !== "object" && typeof node !== "function")) return node;
	// A prototype's handle is the same object to every reader, as a node is: each access through it is decided for whoever
	// makes it.
	const memberRecord = WeakMapMethods.get(SELF_MEMBER_VIEWS, node);
	if (memberRecord?.reader === PROTOTYPE_HANDLE_READER)
		return prototypeForHolder(memberRecord.slothlet, reader ?? selfReader(memberRecord.slothlet, access), node);
	// A prototype of a module's a module held as itself and handed on reaches the reader as reading it at its path would
	// (#667): its handle. One handed out for a holder not known yet (a view deciding each write when it is
	// made) is decided now for the reader it reaches.
	const handed = memberRecord === undefined ? node : memberRecord.reader === SEALED_SHELL_READER ? memberRecord.value : undefined;
	// One handed out before anything read it is known by its class's names (see knownPrototype).
	const handedPrototype =
		handed === undefined
			? undefined
			: memberRecord === undefined
				? WeakMapMethods.get(PROTOTYPE_PATHS, handed)
				: knownPrototype(memberRecord.slothlet, handed);
	if (handedPrototype !== undefined) return prototypeHandedTo(handed, reader ?? selfReader(handedPrototype.slothlet, access));
	// A member view handed to another reader is that reader's view of the same value at the same path.
	if (memberRecord) {
		if (reader === undefined || reader === memberRecord.reader) return node;
		return selfMemberView(memberRecord.value, reader, memberRecord.slothlet, memberRecord.parts);
	}
	// A view already keeps its reader. Handed to another reader, it is that reader's view of the same node.
	if (WeakMapMethods.has(SELF_VIEW_NODES, node)) {
		if (reader === undefined) return node;
		node = WeakMapMethods.get(SELF_VIEW_NODES, node);
	}
	// A view that only holds changes to its reader stands for the node behind it.
	if (WeakSetMethods.has(GUARD_VIEWS, node)) node = WeakMapMethods.get(capturedViewTargets, node);
	// A live-identity instance a method got as its receiver stands for the node it was called on.
	// The async runtime hands such a value back in a context-preserving Proxy: the same value.
	node = WeakMapMethods.get(SELF_INSTANCE_NODES, runtime_unwrapClassInstance(node)) ?? node;
	// A version dispatcher is no node of its own: it routes every access to the versioned node it resolves to.
	const dispatch = versionDispatcherRecord(node);
	const inner = dispatch ? null : (resolveWrapper(node) ?? WeakMapMethods.get(capturedViewChildren, node) ?? null);
	// Any other value another module hands on reaches the reader through the class prototype guard.
	if (inner === null && dispatch === null) {
		if (reader === undefined && from?.slothlet) reader = selfReader(from.slothlet, access);
		if (from === null) {
			// Handed on by no known module (the host's own value in a hook's arguments, say), it is handed on as it is,
			// unless a module's call returned it to the host.
			from = WeakMapMethods.get(HOST_HANDED, node) ?? null;
			if (from === null && !WeakMapMethods.has(CROSSINGS, node)) return node;
		}
		return crossTo(node, reader, null, from);
	}
	const slothlet = dispatch ? dispatch.slothlet : inner.slothlet;
	if (reader === undefined) reader = selfReader(slothlet, access);
	let byReader = WeakMapMethods.get(SELF_VIEWS, node);
	if (!byReader) {
		byReader = new WeakMap();
		WeakMapMethods.set(SELF_VIEWS, node, byReader);
	}
	const cached = WeakMapMethods.get(byReader, reader);
	if (cached) return cached;

	// A write made with no standing of its own is the reader's: it goes through only under a path the
	// reader owns. The host owns the whole tree; code that could not be attributed owns none of it.
	// Through a dispatcher, the write lands on the versioned node it resolves to now: that path decides.
	const refuseWithoutStanding = (prop) =>
		refuseWriteWithoutStanding(slothlet, dispatch ? resolveWrapper(dispatch.resolve()) : inner, reader, prop);
	// A change this view lets through is made on the node as decided here, never decided again by a view under it.
	const vouched = (change) => {
		const previous = VOUCHED_CHANGE;
		VOUCHED_CHANGE = node;
		try {
			return change();
		} finally {
			VOUCHED_CHANGE = previous;
		}
	};
	// What a dispatcher hands back of its own — `valueOf()`, its inspect function — is no node, but answers
	// with the dispatcher or the versioned node: what it returns is viewed for the reader, and so is the node
	// its inspect function passes to the `inspect` it is given.
	const dispatcherFunction = (prop, fn) =>
		function slothlet_selfDispatcherMember(...args) {
			if (prop === INSPECT_CUSTOM && typeof args[2] === "function") {
				const inspectFn = args[2];
				args[2] = (value, options) => inspectFn(selfView(value, reader), options);
			}
			return selfViewResult(Reflect.apply(fn, this === view ? node : this, args), reader);
		};
	// The api path of a member of the node: through a dispatcher, of the versioned node it resolves to now.
	const memberParts = (prop) => {
		const owner = dispatch ? resolveWrapper(dispatch.resolve()) : inner;
		// A dispatcher hands out a member only of the node it has just resolved to, so it resolves to one here too;
		// the empty path is the defensive answer should it not, owned only by who owns the whole tree.
		/* v8 ignore next */
		const parts = owner ? filterList(splitText(String(owner.____slothletInternal.apiPath), "."), Boolean) : [];
		if (typeof prop === "string") listPush(parts, prop);
		return parts;
	};
	const viewMember = (prop, value) => {
		// A node is viewed as one, including the captured view a dispatcher hands a module in lazy mode for a node
		// not loaded yet; only what the dispatcher answers itself is its own function.
		if (
			dispatch &&
			typeof value === "function" &&
			resolveWrapper(value) === null &&
			!WeakMapMethods.has(capturedViewChildren, value) &&
			!WeakMapMethods.has(SELF_VIEW_NODES, value)
		) {
			return dispatcherFunction(prop, value);
		}
		// A prototype of the module's is its handle, the same to every reader (#667). A class's `prototype` is the handle at
		// the path it is read at now, whichever name the class was read under first; an instance's prototype, the handle its
		// class's `prototype` is.
		const prototype = behindMemberView(value);
		if (prop === "prototype" && WeakMapMethods.has(PROTOTYPE_PATHS, prototype)) {
			const parts = memberParts(prop);
			if (readerHoldsPrototype(slothlet, reader, prototype, parts)) return prototype;
			return prototypeHandleAt(slothlet, prototype, { parts });
		}
		if (prop === null && WeakMapMethods.has(PROTOTYPE_PATHS, prototype))
			return prototypeForHolder(slothlet, reader, prototypeHandleOf(slothlet, prototype));
		// A plain value the node holds (a class's prototype, a method of it) is held to the node's path (#625).
		return selfMemberOf(value, reader, slothlet, memberParts(prop), prop);
	};
	// `instanceof` against the view reads its `prototype`, which is handed out as a member view: it tests the
	// node's own prototype, as `instanceof` against the node does.
	let hasInstance = null;
	// A member the node holds read-only and non-configurable must be reported as it is (proxy invariant).
	const isFixed = (descriptor) => descriptor && "value" in descriptor && !descriptor.configurable && !descriptor.writable;
	// A member the node holds fixed is handed out as the node holds it, and so with no view of this one to hold a
	// change made through it to the reader. A module's view of a node no captured view stands for (capture off, a
	// top-level node) therefore works through a view of the node that only holds such changes to the reader, and
	// holds what the node holds fixed as views of the same kind ({@link capturedView}). That view is built
	// whether or not permissions are on, since it is cached for the reader: it asks whether the ownership rule
	// applies at each change, so with no permissions it holds nothing, and a view built then still holds a change
	// once the permission system is enabled.
	const held = node;
	if (inner && reader !== HOST_READER && !WeakMapMethods.has(capturedViewShadows, node)) {
		// A top-level node a module reads is held to that module: kept and used later, from outside any call (the host
		// calling a function the module left behind), each read and call through it has to be the module's to make as
		// well as whoever runs it (#597).
		const holds =
			reader !== UNATTRIBUTED_READER &&
			WeakSetMethods.has(trustedRootOwn.genuineWrappers, reader) &&
			slothlet.handlers?.permissionManager?.isCaptureEnabled?.() !== false;
		node = capturedView(node, reader, holds && "held");
	}
	// The prototype an instance of a class of the module's reports (#667) is that class's, read as the reader reads the
	// class's `prototype` through the node standing for it (see instanceClassFront): the same view that read gives,
	// checked the same way. Null for any other prototype.
	const classPrototype = (prototype) => {
		const classNode = inner ? inner.___instanceClassFront() : null;
		if (classNode === null || classNode === undefined) return null;
		// The class was found by descriptors (see heldInstanceClass): a `constructor` accessor of the module's is
		// never run to compare it.
		if (prototype !== Reflect.getPrototypeOf(inner.____slothletInternal.impl)) return null;
		return atClassSite(slothlet, selfView(classNode, reader).prototype);
	};
	// The prototype the node reports, as the reader is handed it, by `Object.getPrototypeOf` and through `__proto__`
	// alike (#667): a node (a class's base class) as its view, a class's prototype as its class's node hands it out, and
	// the own prototype of an instance whose class cannot be told as a member view held to the instance's path. An
	// emitter's own prototype is held to that path too for a reader not owning it, whoever is running now, and a view the
	// node already made for who is running stands. Any other prototype, or the stand-in for one withheld, is handed out
	// as the node reports it.
	const shownPrototype = (prototype) => {
		if (prototype === null || (typeof prototype !== "object" && typeof prototype !== "function")) return prototype;
		if (resolveWrapper(prototype) !== null || WeakMapMethods.has(capturedViewChildren, prototype)) return selfView(prototype, reader);
		const heldEmitterPrototype = inner ? emitterOwnPrototype(inner) : undefined;
		if (heldEmitterPrototype !== undefined) {
			// A closed node's answer is fixed, per reader, on what this view stands over.
			if (!Reflect.isExtensible(node) && behindMemberView(prototype) === heldEmitterPrototype) return Reflect.getPrototypeOf(node);
			if (prototype === heldEmitterPrototype) return prototypeForHolder(slothlet, reader, inner.___emitterPrototypeHandle(prototype));
			if (behindMemberView(prototype) === heldEmitterPrototype) return prototype;
		}
		// A closed node holding a class instance fixes its prototype per reader too, on every path (#725).
		if (inner && !Reflect.isExtensible(node) && behindMemberView(prototype) === inner.___instancePrototypeSite()?.prototype)
			return Reflect.getPrototypeOf(node);
		const shown = classPrototype(prototype);
		if (shown !== null) return shown;
		if (inner && prototype === inner.___unclassedInstancePrototype()) return viewMember(null, prototype);
		return prototype;
	};
	// What a read of a member hands out, the read and the description that follows it made as one access.
	const readMember = (prop, access) => {
		const value = readWithAccess(access, node, node, prop, node);
		// The language's own member of the data object the node holds is handed out as the object's view hands it, once
		// the node's own read of it has been made (and checked).
		const dataMember = selfDataMember(inner, reader, slothlet, prop);
		if (dataMember !== NODE_MEMBER) return dataMember;
		// A class instance's `__proto__` is its prototype, the same view `Object.getPrototypeOf` reports (#667).
		if (prop === "__proto__" && typeof node !== "function" && value !== null && typeof value === "object" && !hasOwn(node, prop)) {
			const impl = inner?.____slothletInternal.impl;
			if (impl !== null && typeof impl === "object" && !util.types.isProxy(impl) && isClassInstance(impl) && readsEngineProto(impl))
				return shownPrototype(value);
		}
		// A node whose prototype is its own record's answers `__proto__` with what it reports, as it is handed out.
		if (prop === "__proto__" && value !== null && typeof value === "object" && inner && !hasOwn(node, prop)) {
			if (ownsPrototype(inner) && value === Reflect.getPrototypeOf(node)) return value;
		}
		if (prop === Symbol.hasInstance && value === undefined && typeof node === "function") {
			hasInstance ??= (instance) => selfHasInstance(Reflect.get(node, "prototype"), instance);
			return hasInstance;
		}
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
		if (isFixed(describeWithAccess(access, node, node, prop))) return value;
		return viewMember(prop, value);
	};
	// A view over a captured view stands over that view's shadow, which holds what the captured view has reported
	// fixed: the engine checks this view's answers against it, never by asking the captured view again, which
	// refuses a fixed member its reader may not read. Every trap works on the node itself (#625, #655).
	// Once the instance has shut down, the view reads, lists, describes, calls and changes nothing for a module.
	const refuseEnded = () => refuseEndedAccess(slothlet, reader);
	const view = new NativeProxy(WeakMapMethods.get(capturedViewShadows, node) ?? node, {
		get(_, prop) {
			refuseEnded();
			// The read, and the description of the member that follows it, are one access by the same code.
			const access = WeakMapMethods.has(capturedViewShadows, node) ? beginAccess() : null;
			try {
				return readMember(prop, access);
			} finally {
				endAccess(access);
			}
		},
		getOwnPropertyDescriptor(_, prop) {
			refuseEnded();
			const descriptor = Reflect.getOwnPropertyDescriptor(node, prop);
			if (!descriptor || isFixed(descriptor)) return descriptor;
			if (!("value" in descriptor)) {
				// An accessor's functions are plain values the node holds; a fixed one is reported as it is. A node reports
				// its accessors configurable, and a node frozen through a view reports data members, so the suite has no
				// node that reports a fixed accessor; the guard keeps the proxy's answer valid if one ever does.
				/* v8 ignore next */
				if (!descriptor.configurable) return descriptor;
				return { __proto__: null, ...descriptor, get: viewMember(prop, descriptor.get), set: viewMember(prop, descriptor.set) };
			}
			return { __proto__: null, ...descriptor, value: viewMember(prop, descriptor.value) };
		},
		ownKeys(_) {
			refuseEnded();
			return Reflect.ownKeys(node);
		},
		// A call reaches the node as one made on it would. The method runs as its own module: called on the
		// node it was read from, it gets that module's view of the node as its receiver, the one it reads
		// through `self` itself. Any other receiver (`.call()` / `.apply()` onto some other node) and every
		// argument reach it exactly as the caller passed them, so a method that keeps or returns them hands
		// back what it was given, and nothing it is handed carries its module's standing. What it returns is
		// viewed for the reader that called it. Construction never sees the view as the new target.
		// While the permission system is on, what the call throws or rejects with reaches the reader as values crossing
		// between modules do (#667).
		apply(_, thisArg, args) {
			refuseEnded();
			const ownThis = inner && selfIsMethodNode(thisArg, inner) ? selfViewFor(thisArg, inner) : thisArg;
			let result;
			try {
				result = Reflect.apply(node, ownThis, args);
			} catch (error) {
				throw crossTo(error, reader, slothlet, inner);
			}
			return selfViewResult(result, reader, slothlet, inner);
		},
		construct(_, args, newTarget) {
			refuseEnded();
			// A class the reader constructs for is its own: what it makes the instance's prototype comes back as it is.
			if (newTarget !== view && WeakSetMethods.has(trustedRootOwn.genuineWrappers, reader)) {
				recordOrigin(newTarget, reader);
				const prototype = typeof newTarget === "function" ? Reflect.getOwnPropertyDescriptor(newTarget, "prototype")?.value : null;
				if (prototype !== null && typeof prototype === "object") recordOrigin(prototype, reader);
			}
			let made;
			try {
				made = Reflect.construct(node, args, newTarget === view ? held : newTarget);
			} catch (error) {
				throw crossTo(error, reader, slothlet, inner);
			}
			return crossTo(made, reader, slothlet, inner);
		},
		set(_, prop, value) {
			refuseEnded();
			refuseWithoutStanding(prop);
			return vouched(() => Reflect.set(node, prop, unwrapSelfView(value)));
		},
		defineProperty(_, prop, descriptor) {
			refuseEnded();
			// A definition that changes nothing (freezing an already frozen node) is no write of the reader's (#667): it goes
			// on to the node, which decides whether it changes what the node holds.
			if (Reflect.isExtensible(node) || !isUnchangingDefinition(WeakMapMethods.get(capturedViewShadows, node) ?? node, prop, descriptor))
				refuseWithoutStanding(prop);
			if ("value" in descriptor) descriptor = { __proto__: null, ...descriptor, value: unwrapSelfView(descriptor.value) };
			const defined = vouched(() => Reflect.defineProperty(node, prop, descriptor));
			// The engine now reads the node's descriptor to check the definition (freezing a node through its view
			// fixes each member): that read is no reader's, so the node answers it ungated.
			if (defined && inner && node === inner.____slothletInternal.proxy) PENDING_INVARIANT_READ = { wrapper: inner, prop };
			return defined;
		},
		deleteProperty(_, prop) {
			refuseEnded();
			refuseWithoutStanding(prop);
			return vouched(() => Reflect.deleteProperty(node, prop));
		},
		setPrototypeOf(_, proto) {
			refuseEnded();
			refuseWithoutStanding(null);
			return vouched(() => Reflect.setPrototypeOf(node, proto));
		},
		preventExtensions(_) {
			refuseEnded();
			// Closing a node already closed is no write of the reader's (#667): the node answers it.
			if (Reflect.isExtensible(node)) refuseWithoutStanding(null);
			return vouched(() => Reflect.preventExtensions(node));
		},
		has(_, prop) {
			refuseEnded();
			return Reflect.has(node, prop);
		},
		getPrototypeOf(_) {
			refuseEnded();
			const prototype = Reflect.getPrototypeOf(node);
			// A closed node reports what its target holds (proxy invariant).
			if (prototype === null || !Reflect.isExtensible(node)) return prototype;
			return shownPrototype(prototype);
		},
		isExtensible(_) {
			refuseEnded();
			return Reflect.isExtensible(node);
		}
	});
	WeakMapMethods.set(byReader, reader, view);
	WeakMapMethods.set(SELF_VIEW_NODES, view, held);
	WeakMapMethods.set(SELF_VIEW_READERS, view, reader);
	// The framework treats the view as the node it stands for (metadata, hooks, permissions), and a view of a
	// dispatcher as a dispatcher.
	if (inner) registerProxy(view, inner);
	else markFrameworkInternal(view);
	return view;
}

/**
 * The instance each of the framework's own root members (the `slothlet` namespace, `shutdown`, `destroy`)
 * belongs to ({@link registerFrameworkMember}).
 * @type {WeakMap<object, object>}
 * @private
 */
const FRAMEWORK_MEMBERS = new WeakMap();

/**
 * The framework's own namespace (`self.slothlet`) and root functions (`self.shutdown`, `self.destroy`) as a
 * module reads them (#625).
 *
 * What they do depends on who calls: `diag.api()` hands module code a view of the api and the host the
 * api itself, `hook.on()` / `lifecycle.on()` register for the module calling or for the host. A function a
 * module read and kept, called later from outside any call, would run as the host. Through the view it runs
 * as the module that read it, and so does every other use of the view — a member read, a write — made with
 * no standing of its own. While a module executes, or while the host's own code runs inside a `run()` / `scope()`
 * it opened, the view behaves as the member itself; a module's code running in such a flow uses it as the reader
 * (see {@link selfWriteHasStanding}). The host is handed the member itself.
 *
 * A module never changes them (#625): they are shared by every module and the host, so an assignment,
 * definition, or deletion of a member at any depth, or a change to a member's prototype or extensibility
 * (freezing, sealing), meets the built-in write rules of the permission system (`slothlet.**:write` and the
 * like), which refuse it with `PERMISSION_DENIED` unless a host rule lifted them. A symbol key is held to the
 * same rules as a string key: a change under one meets the rules of the member it is made on.
 *
 * @param {*} member - A root member read through `self`.
 * @param {object} [reader] - Who read it; the code executing now when omitted.
 * @param {object} [slothlet] - Instance it belongs to; looked up when omitted.
 * @returns {*} A view of the member, or `member` unchanged.
 * @internal
 *
 * @example
 * const diag = selfFrameworkView(api.slothlet).diag; // later diag.api() still answers the module
 */
function selfFrameworkView(member, reader, slothlet = WeakMapMethods.get(FRAMEWORK_MEMBERS, member)) {
	if (!slothlet || member === null || (typeof member !== "object" && typeof member !== "function")) return member;
	if (reader === undefined) reader = selfReader(slothlet);
	if (reader === HOST_READER) return member;
	return frameworkViewOf(member, slothlet, reader, WeakMapMethods.get(FRAMEWORK_MEMBER_NAMES, member) ?? "slothlet");
}

/**
 * Where a change to `self` itself lands, once the code running now may make it (#625): defining or deleting a
 * member of `self`, or a symbol-keyed member of it.
 *
 * `self` is one object shared by every module of every instance; it stands for the api of the instance the
 * running code belongs to. A change to it follows the rule a top-level `self.X = …` does: a module changes
 * only what it owns (the framework's own members never, by the built-in write rules), a symbol key or a change
 * to `self` as a whole is held to the root of the tree, and code the live runtime cannot attribute is refused.
 * The change is made on that instance's api — or on the isolated scope's own view of it — never on the object
 * behind `self`.
 *
 * @param {object} ctx - The active context store (`self`, `slothlet`).
 * @param {string|symbol|null} prop - Member of `self` changed, or null for `self` as a whole.
 * @returns {object} The object the change is made on.
 * @throws {SlothletError} `LOOSE_SET_NOT_OWNED` / `PERMISSION_DENIED` when module code changes a member it may
 *   not, and `LOOSE_SET_UNATTRIBUTED` when the live runtime cannot tell which call is executing.
 * @internal
 *
 * @example
 * return Reflect.deleteProperty(selfChangeTarget(ctx, prop), prop);
 */
function selfChangeTarget(ctx, prop) {
	// A store holding `self` holds its instance too: both are set together when the instance loads.
	const slothlet = ctx.slothlet;
	const parts = typeof prop === "string" ? [prop] : [];
	// The bound api forwards every change to the api, its own target taking what the invariants bind there.
	const target = ctx.self;
	if (slothlet.handlers.apiManager.writeChecked(parts)) {
		const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
		// Unreachable from the runtime traps, which are this function's callers: the live `self` refuses code it
		// cannot attribute before it resolves a context at all, and the async runtime always attributes. Kept so a
		// caller that did reach it would fail closed rather than write with the host's standing.
		/* v8 ignore next 3 */
		if (identity?.unresolved) {
			throw new slothlet.SlothletError("LOOSE_SET_UNATTRIBUTED", { path: segmentsOf(ArrayMethods.join(parts, ".")) });
		}
		if (identity?.currentWrapper) {
			for (
				let ofIndex = 0, ofList = concatLists([identity.currentWrapper], identityCeilings(identity));
				ofIndex < ofList.length;
				ofIndex++
			) {
				const writer = ofList[ofIndex];
				slothlet.handlers.apiManager.assertOwnedWrite(parts, writer);
			}
		}
	}
	// The framework's namespace and root functions are reserved names: defined or deleted, as assigned, they are
	// refused whether or not permissions are on, after the write rules a module meets first.
	if (SetMethods.has(SELF_FRAMEWORK_ROOTS, prop)) slothlet.handlers.apiManager.normalizeApiPath([prop]);
	return target;
}

/**
 * Root members the framework itself serves on the api (`slothlet`, `shutdown`, `destroy`). Read through a
 * root view they are handed over as they are, as the runtime `self` hands them over.
 * @type {Set<string>}
 * @private
 */
const SELF_FRAMEWORK_ROOTS = setFrom(["slothlet", "shutdown", "destroy"]);

/**
 * The root views {@link selfRootView} built, per bound api and per reader.
 * @type {WeakMap<object, WeakMap<object, object>>}
 * @private
 */
const SELF_ROOT_VIEWS = new WeakMap();

/**
 * Who a change made through a root view at `parts` is made as: the module executing now, the host
 * (`null`) inside a `run()` / `scope()` it opened, or else the reader the view belongs to, when that reader
 * owns the path. Code the live runtime cannot attribute is refused, as it is through a node's view.
 *
 * @param {object} slothlet - Instance the api belongs to.
 * @param {object} reader - The reader the view belongs to.
 * @param {string[]} parts - Segments of the api path changed.
 * @returns {object|null} The writer, null for the host.
 * @throws {SlothletError} `LOOSE_SET_UNATTRIBUTED` for code the live runtime cannot attribute, and
 *   `CONTEXT_NOT_ACTIVE_SELF` for a change made with no standing outside what the reader owns.
 * @private
 */
function selfRootWriter(slothlet, reader, parts) {
	const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
	// With the permission system off nothing is refused, but the change is still recorded as whoever made it, the
	// executing module or the reader, as a top-level `self.X = …` is: the ownership it records must not depend on
	// whether permissions were on at the time.
	if (!slothlet.handlers.apiManager.ownershipEnforced()) {
		// Code the live runtime cannot attribute is refused here as through `self.X = …`: recorded as anyone's, the
		// change would run with standing it was never given once the system is on.
		if (identity?.unresolved) {
			throw new slothlet.SlothletError("LOOSE_SET_UNATTRIBUTED", { path: segmentsOf(ArrayMethods.join(parts, ".")) });
		}
		if (identity?.currentWrapper) return identity.currentWrapper;
		// The readers' own checks first: each answers as standing would, without the frame read standing may make.
		if (reader === HOST_READER || reader === UNATTRIBUTED_READER || reader === SEALED_SHELL_READER || selfWriteHasStanding(slothlet))
			return null;
		return reader;
	}
	if (identity?.unresolved) {
		throw new slothlet.SlothletError("LOOSE_SET_UNATTRIBUTED", { path: segmentsOf(ArrayMethods.join(parts, ".")) });
	}
	if (identity?.currentWrapper) return identity.currentWrapper;
	if (reader === HOST_READER || reader === SEALED_SHELL_READER || selfWriteHasStanding(slothlet)) return null;
	if (reader !== UNATTRIBUTED_READER && slothlet.handlers.apiManager.mayWrite(parts, reader)) return reader;
	throw new slothlet.SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
}

/**
 * The whole api as a reader reads it through `self`, for a payload the framework hands a module (#625): the
 * `api` a hook handler a module registered is handed. Every member read through it is the reader's view
 * ({@link selfView}), and a change to a root member follows the rule a top-level `self.X = …` does:
 * made while a module executes, it is that module's; made later from outside any call, it is held to the
 * reader, so a module cannot keep the `api` a hook was handed and write another module's subtree through it
 * once the host calls it back.
 *
 * @param {object} slothlet - Instance the api belongs to.
 * @param {object} reader - The module the view belongs to.
 * @returns {object} The root view.
 * @internal
 *
 * @example
 * const api = selfRootView(slothlet, moduleWrapper);
 * api.callee.ops; // the module's view of api.callee.ops
 */
function selfRootView(slothlet, reader) {
	const root = slothlet.boundApi;
	let byReader = WeakMapMethods.get(SELF_ROOT_VIEWS, root);
	if (!byReader) {
		byReader = new WeakMap();
		WeakMapMethods.set(SELF_ROOT_VIEWS, root, byReader);
	}
	const cached = WeakMapMethods.get(byReader, reader);
	if (cached) return cached;
	const member = (prop, value) => {
		if (typeof prop !== "string") return value;
		return SetMethods.has(SELF_FRAMEWORK_ROOTS, prop) ? selfFrameworkView(value, reader, slothlet) : selfView(value, reader);
	};
	// A symbol key, like a change to the root itself, is held to the root's own path: only who owns the whole
	// tree changes it (#625).
	const assertChange = (prop) => {
		const parts = typeof prop === "string" ? [prop] : [];
		const writer = selfRootWriter(slothlet, reader, parts);
		if (writer !== null) slothlet.handlers.apiManager.assertOwnedWrite(parts, writer);
		// A reserved name is refused whoever changes it, as an assignment to it is.
		if (SetMethods.has(SELF_FRAMEWORK_ROOTS, prop)) slothlet.handlers.apiManager.normalizeApiPath([prop]);
	};
	const view = new NativeProxy(root, {
		get(target, prop) {
			return member(prop, Reflect.get(target, prop));
		},
		getOwnPropertyDescriptor(target, prop) {
			const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
			if (!descriptor || !("value" in descriptor) || !descriptor.configurable) return descriptor;
			return { __proto__: null, ...descriptor, value: member(prop, descriptor.value) };
		},
		set(target, prop, value) {
			value = unwrapSelfView(value);
			if (typeof prop === "symbol") {
				assertChange(prop);
				return Reflect.set(target, prop, value);
			}
			slothlet.handlers.apiManager.setOwnedProperty(prop, value, selfRootWriter(slothlet, reader, [prop]));
			return true;
		},
		defineProperty(target, prop, descriptor) {
			assertChange(prop);
			if ("value" in descriptor) descriptor = { __proto__: null, ...descriptor, value: unwrapSelfView(descriptor.value) };
			return Reflect.defineProperty(target, prop, descriptor);
		},
		deleteProperty(target, prop) {
			assertChange(prop);
			return Reflect.deleteProperty(target, prop);
		},
		setPrototypeOf(target, proto) {
			assertChange(null);
			return Reflect.setPrototypeOf(target, proto);
		},
		preventExtensions(target) {
			assertChange(null);
			return Reflect.preventExtensions(target);
		}
	});
	WeakMapMethods.set(byReader, reader, view);
	return view;
}

/**
 * Hook handlers {@link selfHookHandler} built.
 * @type {WeakSet<Function>}
 * @private
 */
const SELF_HOOK_VIEWED = new WeakSet();

/**
 * A hook handler a module registered, handed its payload as that module reads the api through `self` (#625).
 *
 * The pipeline hands a hook the call's own values: the arguments as the caller passed them, the result as
 * the method returned it (its own module's view of a node, for one), what `next()` hands back, and the
 * whole api. Kept by a handler a module registered, any of them would let that module write another
 * module's node later, with the standing of whoever's view it is. So the handler gets its own module's
 * view of every node among them, and a root view ({@link selfRootView}) as `api`. What it hands
 * back — the args or result it was given, or an array of them — reaches the pipeline as the call's own
 * values again, and a change it makes to the `args` array in place reaches the call too.
 *
 * @param {Function} handler - The handler, pinned to its module.
 * @param {object} slothlet - Instance the hook is registered on.
 * @param {object} reader - The module that registered the hook.
 * @returns {Function} The handler with its payload viewed for the module.
 * @internal
 *
 * @example
 * hook.handler = selfHookHandler(pinned, slothlet, ownerWrapper);
 */
function selfHookHandler(handler, slothlet, reader) {
	/**
	 * The module a value in a hooked call's arguments comes from, as far as slothlet saw: the module whose call returned
	 * it to the host, the module whose stand-in or wrapped instance it is, a module seen holding it as itself, the module
	 * called when it made the value, and otherwise the module making the call. Null for a value the host built itself.
	 * @param {*} value - The value, as the function called holds it.
	 * @param {object|null} caller - The wrapper of the module making the call, or null for the host.
	 * @param {object|null} called - The wrapper of the node called.
	 * @returns {object|null} The wrapper of the module it comes from.
	 * @private
	 */
	function argumentSource(value, caller, called) {
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return null;
		const behind = typeof value === "object" ? runtime_unwrapClassInstance(value) : value;
		const relayed = WeakMapMethods.get(HOST_HANDED, value) ?? WeakMapMethods.get(HOST_HANDED, behind);
		if (relayed) return relayed;
		const standIn = WeakMapMethods.get(STAND_IN_RECORDS, value);
		if (standIn) return standIn.owner;
		const creator = typeof value === "object" ? runtime_classInstanceCreator(value) : null;
		if (creator) return creator;
		const origin = WeakMapMethods.get(CROSSING_ORIGINS, value);
		if (origin) return origin.wrapper;
		if (called?.____slothletInternal && called.slothlet && WeakMapMethods.has(makerOf(called).made, value)) return called;
		return caller;
	}

	if (WeakSetMethods.has(SELF_HOOK_VIEWED, handler)) return handler;
	const viewed = function slothlet_viewedHook(payload, ...rest) {
		if (payload === null || typeof payload !== "object") return Reflect.apply(handler, this, concatLists([payload], rest));
		const originals = new Map();
		// What the call returned or threw comes from the node called, so a module's hook on its own function is handed
		// its own values as they are.
		const called = typeof payload.path === "string" ? nodeAtPath(slothlet, payload.path) : null;
		const toView = (value, from = null) => {
			const view = selfView(value, reader, from);
			if (view !== value) MapMethods.set(originals, view, value);
			return view;
		};
		// A promise of a node settles to the view. Its rejection is still the call's: the viewed promise
		// is marked handled, so a handler that never awaits it reports nothing the call did not.
		const viewValue = (value) => {
			if (!inherits(value, Promise)) return toView(value, called);
			const view = value.then((settled) => toView(settled, called));
			view.catch(() => {});
			MapMethods.set(originals, view, value);
			return view;
		};
		const fromView = (value) => (MapMethods.has(originals, value) ? MapMethods.get(originals, value) : value);
		const fromViews = (list) => (ArrayMethods.some(list, (value) => MapMethods.has(originals, value)) ? mapList(list, fromView) : list);
		const handed = { ...payload };
		if ("api" in payload) handed.api = payload.api === slothlet.boundApi ? selfRootView(slothlet, reader) : toView(payload.api);
		const callArgs = Arrays.isArray(payload.args) ? payload.args : null;
		// An argument comes from whoever handed it to the call: another module's reaches this one as a view, its own as
		// itself, and what the host built as it is.
		const caller = permissionsOn(reader) ? callingModule(slothlet) : null;
		const argView = (value) => {
			if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
			if (!permissionsOn(reader)) return toView(value);
			const view = toView(value, WeakMapMethods.has(CROSSINGS, value) ? null : argumentSource(value, caller, called));
			const own = reader.___ownInstances(reader.___ownArguments([view]))[0];
			if (own !== view) MapMethods.set(originals, own, MapMethods.has(originals, view) ? MapMethods.get(originals, view) : value);
			return own;
		};
		const handedArgs = callArgs ? mapList(callArgs, argView) : null;
		let snapshot = handedArgs ? copyList(handedArgs) : null;
		if (handedArgs) handed.args = handedArgs;
		if ("result" in payload) handed.result = viewValue(payload.result);
		// What the call threw, when that is a node: the handler's own view of it, as a result is.
		if ("error" in payload) handed.error = toView(crossTo(payload.error, reader, slothlet, called), called);
		// A change the handler makes to the args array in place reaches the call, as it would unviewed: before
		// `next()` forwards them, and once the handler returns.
		const writeBack = () => {
			if (!handedArgs) return;
			if (handedArgs.length === snapshot.length && ArrayMethods.every(handedArgs, (value, i) => value === snapshot[i])) return;
			// Refilled through listPush, never `callArgs[i] =`: an index past the old length would run a setter module code put
			// on the shared prototypes.
			callArgs.length = 0;
			for (let i = 0; i < handedArgs.length; i++) listPush(callArgs, fromView(handedArgs[i]));
			snapshot = copyList(handedArgs);
		};
		if (typeof payload.next === "function") {
			const next = payload.next;
			handed.next = (nextArgs) => {
				if (nextArgs === undefined) writeBack();
				return viewValue(next(Arrays.isArray(nextArgs) ? fromViews(nextArgs) : nextArgs));
			};
		}
		const settle = (out) => (Arrays.isArray(out) ? fromViews(out) : fromView(out));
		const out = Reflect.apply(handler, this, concatLists([handed], rest));
		writeBack();
		if (inherits(out, Promise) && !MapMethods.has(originals, out)) {
			return out.then((value) => {
				writeBack();
				return settle(value);
			});
		}
		return settle(out);
	};
	WeakSetMethods.add(SELF_HOOK_VIEWED, viewed);
	// A pinned handler stays recognised as pinned (the around pipeline, reload replay), and keeps its original visible.
	if (isCallerLocked(handler)) {
		viewed.____slothletOriginal = handler.____slothletOriginal;
		markCallerLocked(viewed);
	}
	return viewed;
}

/**
 * The captured view a view `self` handed out ({@link selfView}) is changing, while it changes it: that
 * view's reader already decided whether the change stands, so the captured view does not decide it again for its
 * own reader, which may be another module (a method's receiver views the caller's captured view of its node).
 * @type {object|null}
 * @private
 */
let VOUCHED_CHANGE = null;

/**
 * The built-in data object a value is, or a node of one fronts (a node over a `Map` a module exports): what a run
 * copies and what the instance saves before handing it out. Null for anything else.
 * @param {*} value - The value, as read.
 * @returns {object|null} The built-in.
 * @internal
 */
function builtinBehind(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return null;
	const behind = unwrapSelfView(value);
	if (behind !== null && typeof behind === "object" && !util.types.isProxy(behind) && builtinKind(behind) !== null) return behind;
	const wrapper = nodeWrapperOf(value);
	if (wrapper === null) return null;
	const impl = wrapper.____slothletInternal.impl;
	if (impl === null || typeof impl !== "object") return null;
	const held = layerUnderlying(impl);
	return held !== null && typeof held === "object" && !util.types.isProxy(held) && builtinKind(held) !== null ? held : null;
}

/**
 * The stand-ins a lazy node hands out for members it has not loaded yet (waiting proxies). A kept node never hands
 * one its reader: a stand-in reads its node's members, running their code, before any gate (#661).
 * @type {WeakSet<object>}
 * @private
 */
const STAND_INS = new WeakSet();

/**
 * The reader a kept node reads for while it reads through a stand-in for a node not loaded yet: the stand-in takes it
 * first, before any code the read runs, and offers it only to running a getter of the node it stands for (#661).
 * @type {{standIn: object, reader: object}|null}
 * @private
 */
const viewsShared = {
	__proto__: null,
	standInKeptRead: null,
	heldStandInRead: null
};

/**
 * The reader a held view reads for while it reads through a node not loaded yet: a stand-in made for the read is the
 * reader's, so a call through it later is made as the reader, whoever runs it (#597).
 * @type {{wrapper: object, reader: object, ceiling: object|ReadonlyArray<object>|null}|null}
 * @private
 */

/**
 * The views module code is handed of prototypes given to a node or to the api root (see {@link givenView}),
 * each with what it stands for.
 * @type {WeakMap<object, {value: object|Function, gate: object, node: object|null, reader: object}>}
 * @private
 */
const GIVEN_VIEWS = new WeakMap();

/**
 * The stand-ins a closed function node or function root holds fixed for a member holding the module's code (see
 * {@link pinnedCodeMember}), each with the value it stands for.
 * @type {WeakMap<object, object|Function>}
 * @private
 */
const PINNED_CODE_MEMBERS = new WeakMap();

/**
 * Each runtime's `self`, by the context manager it reads its context from (see {@link registerRuntimeSelf}).
 * @type {Map<object, object>}
 * @private
 */
const RUNTIME_SELVES = new Map();

/**
 * Each runtime's callable `self` (#803), by its context manager: a call of `self` made while no call runs is made
 * through it, as a read is made through {@link RUNTIME_SELVES}.
 * @type {Map<object, Function>}
 * @private
 */
const RUNTIME_CALLABLE_SELVES = new Map();

/**
 * A read of `self` made while no call runs — the host running code a module handed out, or code nested in data it
 * returned (#726) — by code whose frames place it in a module's file: read as that code's definer, the leaf whose
 * source range holds it (or the file's module, for code outside every export), so the definer's rules hold for it and
 * the host's standing adds nothing. Code whose definer the frames cannot tell (evaluated code, a file several instances
 * load untold apart, code outside every export where no node was built for the file) is refused with
 * `PERMISSION_DENIED`, naming the identity it was read as. Code of the host's own gets `null`: `self` is not for it.
 * @param {object} selfProxy - The runtime's `self`.
 * @param {string|symbol} prop - The member.
 * @param {string|null} [loadingInstanceID=null] - The instance whose file load the flow belongs to, when the read is
 *   made in such a flow with no module to run as: that instance's own code gets `null` there, another instance's is
 *   read as its definer.
 * @param {string|null} [hostFlowInstanceID=null] - The instance whose `run()` / `scope()` flow the host opened, when
 *   the read is made in one: a module's code running there (a function it handed out) is read as its definer, as it
 *   is outside the flow, and the host's own code gets `null` and reads `self` as the host.
 * @param {function(object): *|null} [use=null] - What is done with the runtime's `self` as the definer instead of
 *   reading `prop` (a call of `self` itself, #803), or null to read it.
 * @returns {{value: *}|null} The member read as the definer, or null when the host's own code is doing the read.
 * @internal
 */
function selfReadAsDefiner(selfProxy, prop, loadingInstanceID = null, hostFlowInstanceID = null, use = null) {
	const definer = frameDefiner(loadingInstanceID ?? hostFlowInstanceID);
	if (definer === null) return null;
	// In a flow the host opened, code whose definer the frames cannot tell for want of a file (evaluated code) is
	// the host's as before: only a file several running instances hold untold apart, and code at a file of theirs
	// running in a script that is not the file's, are refused there.
	if (hostFlowInstanceID !== null && definer.unplaced && !definer.shared && !definer.foreign) return null;
	if (loadingInstanceID !== null) {
		const owner = (definer.wrapper ?? definer.leaves?.[0])?.slothlet;
		if (!owner || owner.instanceID === loadingInstanceID) return null;
	}
	const target = typeof prop === "symbol" ? String(SymbolMethods.description(prop) ?? "") : String(prop);
	if (definer.unplaced) throw new SlothletError("PERMISSION_DENIED", { caller: null, target: segmentsOf(target) });
	// Several leaves and none the file's own node: the file's module path is the identity, and no node answers for it.
	// With the permission system off nothing is checked: any of them gives the code its context (#726).
	if (definer.leaves && !definer.leaves[0].slothlet?.handlers?.permissionManager?.isEnabled?.()) definer.wrapper = definer.leaves[0];
	else if (definer.leaves) {
		const paths = mapList(definer.leaves, (leaf) => splitText(String(leaf.____slothletInternal.apiPath ?? ""), "."));
		const common = [];
		for (let i = 0; ArrayMethods.every(paths, (parts) => i < parts.length - 1 && parts[i] === paths[0][i]); i++)
			listPush(common, paths[0][i]);
		throw new SlothletError("PERMISSION_DENIED", { caller: ArrayMethods.join(common, ".") || null, target: segmentsOf(target) });
	}
	const leaf = definer.wrapper;
	const checks = Boolean(leaf.slothlet?.handlers?.permissionManager?.isEnabled?.());
	// With `provenance` off no code is told by its frames: it runs under its caller, and the host's code has no `self`.
	if (checks && leaf.slothlet.config?.permissions?.caller?.provenance === false) return null;
	// With `references.capture` off a node read here would carry no reader, and a call through it, made while no call
	// runs, would be taken for the host's: such code gets no `self`, as before it could be read as its definer at all.
	if (checks && leaf.slothlet.config?.permissions?.caller?.capture === false) return null;
	const contextManager = leaf.slothlet?.contextManager;
	// Calls are in flight and the live runtime cannot tell which of them runs this code (two api paths of one module
	// resuming in a file they share), or that it is none of them: the caller is unknown, so the read is refused. Its
	// definer is not read as the caller, and nor is the host. Only code no call accounts for is read by its frames.
	if (checks) {
		const identity = contextManager?.getCallerIdentity?.(leaf.slothlet.instanceID);
		if (identity?.unresolved && !identity.unaccounted)
			throw new SlothletError("PERMISSION_DENIED", { caller: null, target: segmentsOf(target) });
	}
	const instanceID = contextManager?.runInContext ? makerInstanceID(leaf.slothlet) : null;
	if (instanceID === null) return null;
	const read =
		use === null
			? (MapMethods.get(RUNTIME_SELVES, contextManager) ?? selfProxy)
			: (MapMethods.get(RUNTIME_CALLABLE_SELVES, contextManager) ?? selfProxy);
	// The leaves whose code is further out on the stack ran this code: they have to be allowed as well.
	const ceiling = checks && definer.callers?.length ? Reflect.apply(combineCeilings, undefined, definer.callers) : null;
	return {
		value: readOnBehalf(undefined, () =>
			contextManager.runInContext(
				instanceID,
				() => (use === null ? read[prop] : use(read)),
				undefined,
				[],
				leaf,
				true,
				false,
				ceiling,
				null,
				false,
				true
			)
		)
	};
}

/**
 * Whether the permission system of a wrapper's instance is on.
 * @param {object|null|undefined} wrapper - A wrapper.
 * @returns {boolean} True while it is.
 * @private
 */
function permissionsOn(wrapper) {
	return wrapper?.slothlet?.handlers?.permissionManager?.isEnabled?.() === true;
}

/**
 * The module whose call is executing now, or null for the host.
 * @param {object} slothlet - The instance.
 * @returns {object|null} The module's wrapper.
 * @private
 */
function callingModule(slothlet) {
	const current = slothlet.contextManager?.tryGetContext?.(slothlet.instanceID)?.currentWrapper ?? null;
	return current?.____slothletInternal && WeakSetMethods.has(trustedRootOwn.genuineWrappers, current) ? current : null;
}

/**
 * The api node standing for a module's function: the api root for the root file's function, the node fronting it for
 * any other (see {@link FUNCTION_NODES} and {@link LAYER_FRONTS}), or `undefined` when no node of the instance does.
 * @param {object} slothlet - The instance.
 * @param {Function} fn - The function.
 * @returns {Function|undefined} The node.
 * @private
 */
function frontingNode(slothlet, fn) {
	if (!slothlet) return undefined;
	const root = slothlet.api;
	if (typeof root === "function" && slothlet.boundApi && (root === fn || layerUnderlying(root) === fn)) return slothlet.boundApi;
	return nodeRefOf(FUNCTION_NODES, slothlet, fn) ?? nodeRefOf(LAYER_FRONTS, slothlet, fn);
}

/**
 * An instance's prototype as the handle at its class's site ({@link classSiteOf}), whichever of the class's
 * nodes it was read through: an instance reports one prototype. Anything that is no prototype's handle is returned as is.
 * @param {object} slothlet - The instance.
 * @param {*} shown - What reading the class's `prototype` handed out.
 * @returns {*} The handle at the class's site, or `shown`.
 * @private
 */
function atClassSite(slothlet, shown) {
	const record = WeakMapMethods.get(SELF_MEMBER_VIEWS, shown);
	if (record?.reader !== PROTOTYPE_HANDLE_READER) return shown;
	const instance = slothlet ?? record.slothlet;
	const site = classSiteOf(instance, record.value);
	return site === undefined ? shown : prototypeHandleAt(instance, record.value, site);
}

/**
 * Every api path each prototype of a module's has been read at (#667): a class's `prototype` under each name the class
 * is exported as, an instance's prototype at its class's `prototype`, or an instance's own prototype at the instance's
 * path when its class cannot be told. A read is decided at the path it is made at; a holder handing the object on
 * hands it as reading it at each of them would ({@link prototypeHandedTo}).
 * @type {WeakMap<object, {slothlet: object, sites: Map<string, {parts: string[], key: string, prop: string|null}>}>}
 * @private
 */
const PROTOTYPE_PATHS = new WeakMap();

/**
 * Whether two wrappers are of the same module, told without making any record of either.
 * @param {object|null} a - A wrapper.
 * @param {object|null} b - Another.
 * @returns {boolean} True when they are.
 * @private
 */
function sameModule(a, b) {
	if (a === b) return true;
	const left = moduleKey(a);
	return left !== null && left === moduleKey(b) && a.slothlet === b.slothlet;
}

/**
 * The value a member view stands for ({@link selfMemberView}), or the value itself when it is no such view.
 * @param {*} value - The value.
 * @returns {*} What is behind it.
 * @private
 */
function behindMemberView(value) {
	// A full-isolation run's view of a value stands for what it reads through (see registerRunView).
	while (WeakMapMethods.has(RUN_VIEWS, value)) value = WeakMapMethods.get(RUN_VIEWS, value);
	return WeakMapMethods.get(SELF_MEMBER_VIEWS, value)?.value ?? value;
}

/**
 * The prototype an emitter a node fronts holds, read from the emitter's own `[[Prototype]]`, so none of the module's code
 * runs to find it. `undefined` for any other node.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {object|undefined} The prototype, or `undefined`.
 * @private
 */
function emitterOwnPrototype(wrapper) {
	const impl = wrapper.____slothletInternal.impl;
	if (impl === null || typeof impl !== "object" || !EventEmitter || !inherits(impl, EventEmitter)) return undefined;
	return Reflect.getPrototypeOf(impl);
}

/**
 * Whether reading `__proto__` on a value reaches the engine's own `Object.prototype.__proto__`, found by descriptors so
 * none of the module's code runs to find it: no prototype below `Object.prototype` holds a `__proto__` of its own. A
 * Proxy among the prototypes answers for the prototype it stands as, the value's prototype, as a Proxy forwarding to
 * its target does.
 * @param {object} value - The value, not a Proxy.
 * @returns {boolean} Whether `value.__proto__` is its prototype.
 * @private
 */
function readsEngineProto(value) {
	for (let holder = value, depth = 0; holder !== null && depth < 64; depth++) {
		if (holder !== value && util.types.isProxy(holder)) return true;
		if (Reflect.getOwnPropertyDescriptor(holder, "__proto__")) return holder === Objects.prototype;
		holder = Reflect.getPrototypeOf(holder);
	}
	return false;
}

/**
 * The function a callable node's impl stands for: the impl itself, or the `default` of a `{ default: fn }` impl (the
 * CJS shape), or null for any other impl.
 * @param {*} impl - The node's impl.
 * @returns {Function|null} The function.
 * @private
 */
function functionOf(impl) {
	if (typeof impl === "function") return impl;
	return impl && typeof impl === "object" && typeof impl.default === "function" ? impl.default : null;
}

/**
 * The `Symbol.hasInstance` a loaded callable node answers for each function, the same one every read.
 * @type {WeakMap<Function, Function>}
 * @private
 */
const HAS_INSTANCE_BY_IMPL = new WeakMap();

/**
 * The language's own `Function.prototype[Symbol.hasInstance]`, taken before any module runs.
 * @type {Function}
 * @private
 */
const FUNCTION_HAS_INSTANCE = INTRINSIC_HAS_INSTANCE;

/**
 * The serializer behind each `toJSON` a node hands out, by that function: it takes the reader to redact for and the
 * node to read arrays through, so a node a module kept serializes for that module wherever it is serialized.
 * @type {WeakMap<Function, function(Array<{currentWrapper: object, context: object}|undefined>, object): *>}
 * @private
 */
const SERIALIZERS = new WeakMap();

/**
 * Per-reader views over shared child wrappers.
 *
 * Shape: `WeakMap<capturingModule, WeakMap<ceiling, WeakMap<childWrapper, view>>>` — the ceiling level is the
 * capturing module itself when the read had no ceiling (#597). Child wrappers are memoized onto
 * their parent and shared by every reader, so the reader's identity cannot be stamped on the wrapper
 * itself — it goes on a thin per-reader view instead. The cache is what keeps `self.a.b === self.a.b`
 * true; a fresh view per read would break every comparison, `Map` key, and de-duplication a consumer
 * does on an api function. Weak on both keys so neither a module nor a leaf is kept alive by it.
 *
 * @type {WeakMap<object, WeakMap<object, WeakMap<object, object>>>}
 * @private
 */
const capturedViews = new WeakMap();

/**
 * The views {@link capturedView} built that gate nothing, per reader and node: the same cache as
 * {@link capturedViews}, for the views a module's `self` works through where no captured view stands for a node.
 * @type {WeakMap<object, WeakMap<object, object>>}
 * @private
 */
const guardViews = new WeakMap();

/**
 * The views {@link capturedView} built that hold their reader alongside whoever accesses through them, per
 * reader, ceiling and node: the same cache as {@link capturedViews}, for a top-level node a module reads through `self`.
 * @type {WeakMap<object, WeakMap<object, WeakMap<object, object>>>}
 * @private
 */
const heldViews = new WeakMap();

/**
 * Every view {@link capturedView} built that gates nothing or is held, so storing one stores the node it guards, as
 * storing a view `self` handed out does ({@link unwrapSelfView}).
 * @type {WeakSet<object>}
 * @private
 */
const GUARD_VIEWS = new WeakSet();

/**
 * The node behind each per-reader view {@link capturedView} built, so a view reached through
 * `self` can be told apart from host data and held to `self`'s rule ({@link selfView}).
 * @type {WeakMap<object, object>}
 * @private
 */
const capturedViewChildren = new WeakMap();

/**
 * The node each captured view ({@link capturedView}) stands for, as it sits in the tree.
 * @type {WeakMap<object, object>}
 * @private
 */
const capturedViewTargets = new WeakMap();

/**
 * The shadow each captured view ({@link capturedView}) stands over, so a view built over a captured view
 * ({@link selfView}) can stand over it too.
 * @type {WeakMap<object, object>}
 * @private
 */
const capturedViewShadows = new WeakMap();

/**
 * The members every function holds of its own, which an inspect snapshot of a function node takes from its stand-in.
 * @type {Set<string>}
 * @private
 */
const FUNCTION_OWN_KEYS = setFrom(["name", "length", "prototype", "arguments", "caller"]);

/**
 * Build (or reuse) the view of a child wrapper that remembers who read it.
 *
 * Only `apply`, `construct`, and `get` are trapped; every other operation falls through to the child
 * unchanged, so the view is indistinguishable from it apart from carrying the reader's identity.
 * `get` re-wraps so a captured *namespace* keeps its floor down the whole path — capturing
 * `self.db.write` and calling `.insert()` later has to be refused for the same reason capturing the
 * leaf directly is.
 *
 * A change made through the view with no standing of its own is its reader's, and goes through only under a
 * path the reader owns ({@link refuseWriteWithoutStanding}): a member the child holds fixed is handed
 * out as the view of the child the view's own target holds, so such a change has no other view to meet.
 *
 * Built with `gated` false, the view gates no read and no call, and reads and calls as the child does: it only
 * holds those changes to its reader, for `self` where no captured view stands for a node (#625).
 *
 * @param {object} child - Shared child UnifiedWrapper.
 * @param {object} capturedCaller - Module that read it.
 * Built with `gated` `"held"`, the view gates reads and calls against its reader as well as against whoever makes
 * them, and never takes an access the stack cannot attribute as its reader's: it holds a node a module read through
 * `self` to that module, without vouching for code the module's own call did not run.
 *
 * @param {boolean|"held"} [gated=true] - Whether reads and calls through the view are gated against its reader.
 * @param {object|ReadonlyArray<object>|null} [ceiling=null] - The calls the reading code ran inside, when the code was supplied to it
 *   by the reader (#597); enforced alongside the reader.
 * @returns {object} The per-reader view.
 * @private
 */
function capturedView(child, capturedCaller, gated = true, ceiling = null) {
	/**
	 * A call made through a node a module read while no call runs (#726): when the code making it is a module's (see
	 * {@link hostRunDefiner}), the call is entered as that code's definer, as the `self` read that reached the node
	 * was, so the target's `metadata.caller()` names the identity its checks used. Anywhere else the call is made as it is.
	 * @param {object} target - The wrapper of the node called.
	 * @param {Function} call - Makes the call.
	 * @returns {Function} What makes the call.
	 * @private
	 */
	function callAsDefiner(target, call) {
		return () => {
			const slothlet = target.slothlet;
			// A caller identity already handed to the call (one resolved before an await) stands.
			const resolved = rulesShared.handedEntry !== null && rulesShared.handedEntry.wrapper === target ? null : {};
			const held = {};
			const leaf = hostRunDefiner(slothlet, false, resolved, held);
			const instanceID = leaf ? makerInstanceID(slothlet) : null;
			// The call is made as it is, by the code whose identity was just read: the target's gate takes that identity
			// as it starts, with nothing but slothlet's own code run in between, instead of reading the stack again.
			if (instanceID === null) return resolved?.identity ? target.___applyWithEntry(resolved, call) : call();
			return slothlet.contextManager.runInContext(
				instanceID,
				call,
				undefined,
				[],
				leaf,
				true,
				false,
				held.ceiling ?? null,
				null,
				false,
				true
			);
		};
	}

	/**
	 * The prototype a closed node's captured view fixes on its shadow (#667, #725): the handle of an emitter's own prototype,
	 * or of a class instance's, the same one every holder of the node is handed.
	 * @param {UnifiedWrapper} wrapper - The node's wrapper.
	 * @param {object} prototype - The prototype, as the module holds it.
	 * @returns {object} What the view fixes.
	 * @private
	 */
	function closedPrototypeHandle(wrapper, prototype) {
		const found = wrapper.___instancePrototypeSite();
		if (found === undefined || found.prototype !== prototype) return wrapper.___emitterPrototypeHandle(prototype);
		recordPrototypePath(wrapper.slothlet, prototype, found.site);
		return prototypeHandleOf(wrapper.slothlet, prototype);
	}

	/**
	 * The prototype a node holds, read by slothlet itself without the reader's check (#632): a view mirroring a closed
	 * node onto its shadow has to hold what the node holds. Only the node's own trap runs for the read, so no module code
	 * can run while it is unchecked.
	 * @param {object} node - A node's proxy.
	 * @returns {object|null} Its prototype.
	 * @private
	 */
	function heldPrototypeOf(node) {
		const previous = nodesShared.heldPrototypeRead;
		nodesShared.heldPrototypeRead = resolveWrapper(node);
		try {
			return Reflect.getPrototypeOf(node);
		} finally {
			nodesShared.heldPrototypeRead = previous;
		}
	}

	/**
	 * An empty function named as `fn` is: what `util.inspect` shows of a function, to hold the members a reader may read.
	 * @param {Function} fn - The function.
	 * @returns {Function} An empty function of the same name.
	 * @private
	 *
	 * @example
	 * namedFunction(function load() {}).name; // "load"
	 */
	function namedFunction(fn) {
		const name = typeof fn.name === "string" ? fn.name : "";
		// A class shows as a class, an async or generator function as one, and a function with no `prototype` (an arrow,
		// a method) shows none.
		if (RegExpMethods.exec(/^class\b/, functionSource(fn)) !== null) return { [name]: class {} }[name];
		if (util.types.isAsyncFunction(fn) && util.types.isGeneratorFunction(fn)) return { [name]: async function* () {} }[name];
		if (util.types.isAsyncFunction(fn)) return { [name]: async () => {} }[name];
		if (util.types.isGeneratorFunction(fn)) return { [name]: function* () {} }[name];
		if (!Objects.hasOwn(fn, "prototype")) return { [name]: () => {} }[name];
		return { [name]: function () {} }[name];
	}

	// One ceiling per set of calls, without the reader's own: the cache key below.
	ceiling = Reflect.apply(combineCeilings, undefined, identityCeilings({ currentWrapper: capturedCaller, ceiling }));
	const views = gated === "held" ? heldViews : gated ? capturedViews : guardViews;
	let byCeiling = WeakMapMethods.get(views, capturedCaller);
	if (!byCeiling) {
		byCeiling = new WeakMap();
		WeakMapMethods.set(views, capturedCaller, byCeiling);
	}
	const ceilingKey = ceiling ?? capturedCaller;
	let byChild = WeakMapMethods.get(byCeiling, ceilingKey);
	if (!byChild) {
		byChild = new WeakMap();
		WeakMapMethods.set(byCeiling, ceilingKey, byChild);
	}
	const existing = WeakMapMethods.get(byChild, child);
	if (existing) return existing;

	// Enforcement reads `slothlet`, `apiPath`, and `filePath` off the internal wrapper. Those are
	// deliberately invisible through the proxy, so resolve to the object behind it once, here, rather
	// than reaching through the facade on every call.
	const inner = resolveWrapper(child);
	// What the view does to its child, made for the view's reader (#661) — only when the child is the node, or a proxy
	// of it from before it became callable (#533), whose traps take the reader first; never a stand-in for a node not
	// loaded yet, which runs its node's code before any gate.
	// A held view never answers for whoever accesses through it: the access is theirs, and the reader's as well.
	const asKept = (access) =>
		!gated || gated === "held" || WeakSetMethods.has(STAND_INS, child) ? access() : inner.___accessAsKept(capturedCaller, access);
	// A read through a stand-in says who it reads for to the stand-in alone (see standInKeptRead).
	const readKept = (access) => {
		if (gated === "held") {
			const previous = viewsShared.heldStandInRead;
			viewsShared.heldStandInRead = { wrapper: inner, reader: capturedCaller, ceiling };
			try {
				return access();
			} finally {
				viewsShared.heldStandInRead = previous;
			}
		}
		if (!gated || !WeakSetMethods.has(STAND_INS, child)) return asKept(access);
		const previous = viewsShared.standInKeptRead;
		viewsShared.standInKeptRead = { standIn: inner, reader: capturedCaller };
		try {
			return access();
		} finally {
			viewsShared.standInKeptRead = previous;
		}
	};
	// A change made through the view with no standing of its own is the reader's.
	const refuseWithoutStanding = (prop) => {
		if (VOUCHED_CHANGE === view) return;
		refuseWriteWithoutStanding(inner.slothlet, inner, capturedCaller, prop);
	};

	// The view stands over a shadow, never the child (#655): a member the child holds fixed (a frozen node's, a
	// frozen array's element) is checked by the engine against the view's own target, so it is mirrored onto the
	// shadow as the view hands it out — a child node as its view — and the reader's identity goes with it too. A
	// shadow of the same kind keeps the view callable, constructible, and an array where the child is; a function's
	// shadow owns no `prototype`, so the view reports the child's own, or none where the child has none.
	let shadow;
	if (Arrays.isArray(child)) shadow = [];
	else if (typeof child !== "function") shadow = {};
	else if (isConstructor(child)) shadow = FunctionMethods.bind(function () {}, null);
	else shadow = () => {};
	let view = null;
	// `util.inspect` describes a proxy by its target, without its traps: the shadow describes what the reader can
	// read of the child instead, member by member through the view, leaving out what it may not read.
	const shown = () => {
		// A function is shown by the name the module gave it, not the name of the api path it sits at.
		const impl = inner.____slothletInternal.impl;
		// An instance of a class keeps its class's prototype, so it shows as one; any other object shows as plain.
		const proto = impl !== null && typeof impl === "object" ? Reflect.getPrototypeOf(impl) : null;
		const out = Arrays.isArray(child)
			? []
			: typeof child === "function"
				? namedFunction(typeof impl === "function" ? impl : child)
				: proto !== null && proto !== Objects.prototype
					? Objects.create(proto)
					: {};
		// A function's stand-in shows the methods its `prototype` holds, read through the view.
		if (typeof out === "function" && out.prototype) {
			try {
				const proto = view.prototype;
				if (proto !== null && typeof proto === "object") {
					for (let ofIndex = 0, ofList = Reflect.ownKeys(proto); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						const descriptor = key === "constructor" ? undefined : Reflect.getOwnPropertyDescriptor(proto, key);
						if (descriptor) Reflect.defineProperty(out.prototype, key, { __proto__: null, ...descriptor, configurable: true });
					}
				}
			} catch (error) {
				if (error?.code !== "PERMISSION_DENIED") throw error;
			}
		}
		for (let k = 0, childKeys = asKept(() => Reflect.ownKeys(child)); k < childKeys.length; k++) {
			const key = childKeys[k];
			// Symbol members are left out, as the node's own inspect leaves them, and so are a function's own
			// `name`, `length` and `prototype`, which the stand-in has of its own.
			if (typeof key === "symbol") continue;
			if (typeof child === "function" && SetMethods.has(FUNCTION_OWN_KEYS, key)) continue;
			if (key === util.inspect.custom || (Arrays.isArray(child) && key === "length")) continue;
			try {
				const descriptor = Reflect.getOwnPropertyDescriptor(view, key);
				if (!descriptor) continue;
				// An accessor is shown as one, read through the view only when inspect is asked to read getters; a hidden
				// member stays hidden, shown only when inspect is asked for those.
				const member =
					"value" in descriptor
						? { __proto__: null, value: view[key], writable: true }
						: { get: descriptor.get && (() => view[key]), set: descriptor.set && ((next) => (view[key] = next)) };
				Reflect.defineProperty(out, key, { __proto__: null, ...member, enumerable: descriptor.enumerable, configurable: true });
			} catch (error) {
				if (error?.code !== "PERMISSION_DENIED") throw error;
			}
		}
		return out;
	};
	Reflect.defineProperty(shadow, util.inspect.custom, {
		__proto__: null,
		// Called by hand, with none of inspect's arguments, it shows the node as `util.inspect` would.
		value: (depth, options, inspect = util.inspect) => inspect(shown(), depth === undefined ? { ...options } : { ...options, depth }),
		configurable: true
	});
	// What the view hands out for a member it read: terminal data read-gated against the reader, a child node as its
	// view, anything else as it is.
	const handOut = (prop, resolved) => {
		// A view that gates nothing hands out what the child does, a node as a view of the same kind: a member handed
		// out fixed reaches module code with no view of `self` over it, and so does every node read through that member.
		if (!gated) return resolveWrapper(resolved) === null ? resolved : capturedView(resolved, capturedCaller, false, ceiling);
		// `undefined` is skipped deliberately, and not as an optimisation. Awaiting or inspecting a
		// wrapper probes for properties that are not there — `then` above all — and every absent
		// property classifies as terminal data. Gating those would turn a denied *enumeration*, which
		// is answered by redaction, into a thrown read.
		// A symbol-keyed member the node holds is gated like a string-keyed one; any other symbol (the wrapper's
		// own `Symbol.toStringTag`, an inspect hook) is no member and reads as it did.
		const isMember = typeof prop === "string" || (typeof prop === "symbol" && inner.___hasOwnSymbolMember(prop));
		// A node standing for a plain value (a leaf a descriptor hands out as its node) is read as that value; a lazy
		// node not loaded yet holds no value of its own (`impl` is empty) and stays a node.
		const leaf = resolved !== undefined && !isTerminalData(resolved) ? resolveWrapper(resolved) : null;
		const leafValue = leaf?.____slothletInternal.impl;
		const value = leafValue !== null && leafValue !== undefined && isTerminalData(leafValue) ? leafValue : resolved;
		if (value !== undefined && isMember && isTerminalData(value)) {
			// Terminal data read off a captured namespace: gate it against the module that captured
			// it, using the same override the lazy waiting-proxy resolver uses for its own snapshot.
			const context = inner.slothlet.contextManager?.tryGetContext?.()?.context ?? null;
			enforceRead(inner, prop, value, { currentWrapper: capturedCaller, ceiling, context });
			if (value === resolved) return resolved;
		}
		// The node's `toJSON` serializes as the module that kept the node, through this view, wherever it is called.
		const serialize = typeof resolved === "function" ? WeakMapMethods.get(SERIALIZERS, resolved) : undefined;
		// It also serializes for whoever serializes it, as each read through the view is gated for both.
		if (serialize) {
			return (...args) =>
				serialize(
					[
						{ currentWrapper: capturedCaller, ceiling, context: inner.slothlet.contextManager?.tryGetContext?.()?.context ?? null },
						undefined
					],
					view,
					{ wrapper: inner, reader: capturedCaller },
					args
				);
		}
		if (resolveWrapper(resolved) === null) return resolved;
		return capturedView(resolved, capturedCaller, gated, ceiling);
	};
	// The value the shadow holds for a fixed member: a child node as its view, anything else as it is. The read gate
	// is no transformation of the value, so it stays with each read (see get) rather than with the mirroring.
	const shownValue = (value) => (resolveWrapper(value) === null ? value : capturedView(value, capturedCaller, gated, ceiling));
	// An array's `length` is its shape, not a member it holds: mirrored as it is, never refused.
	const isMemberRead = (key, descriptor) => descriptor && "value" in descriptor && !(key === "length" && Arrays.isArray(child));
	// The child's descriptor of a member as the child holds it, whoever is reading. The shadow holds what the node
	// holds, never an answer that depends on the reader or on when it read (rules change); each read through the view
	// is gated as it is made.
	const rawDescriptor = (key, access = null) => inner.___describeAsHeld(child, key, access);
	// Whether the reader may read a member now.
	const readable = (key) => {
		try {
			const descriptor = asKept(() => Reflect.getOwnPropertyDescriptor(child, key));
			if (isMemberRead(key, descriptor)) handOut(key, descriptor.value);
			return true;
		} catch (error) {
			if (error?.code === "PERMISSION_DENIED") return false;
			throw error;
		}
	};
	// A member the child holds fixed is mirrored onto the shadow as the view reports it, and reported from there. A
	// member read for the reader is read as the reader may read it (the read gate, as for a plain read); one mirrored
	// after the reader's own write is mirrored as the write left it.
	const mirror = (prop, asRead = true, access = null) => {
		// A closed shadow's inspect hook is its own, whatever the child holds at that key: the engine checks the view
		// against the shadow, and the child's hook would describe the child unchecked.
		if (prop === util.inspect.custom && !Reflect.isExtensible(shadow)) return Reflect.getOwnPropertyDescriptor(shadow, prop);
		const descriptor = asRead ? asKept(() => describeWithAccess(access, inner, child, prop)) : rawDescriptor(prop, access);
		if (asRead && isMemberRead(prop, descriptor)) handOut(prop, descriptor.value);
		if (!descriptor) {
			const stale = prop === util.inspect.custom ? undefined : Reflect.getOwnPropertyDescriptor(shadow, prop);
			if (stale && stale.configurable) Reflect.deleteProperty(shadow, prop);
			return undefined;
		}
		if (descriptor.configurable && Reflect.isExtensible(shadow)) return descriptor;
		// The inspect hook a closed shadow keeps for the child's own describes the child as it is now.
		if (prop === util.inspect.custom && descriptor.configurable) return descriptor;
		const held = Reflect.getOwnPropertyDescriptor(shadow, prop);
		// A fixed member keeps what it holds; one the child can still write is refreshed with its value now.
		if (held && !held.configurable && !("value" in held && held.writable)) return held;
		const shown =
			"value" in descriptor && !descriptor.writable ? { __proto__: null, ...descriptor, value: shownValue(descriptor.value) } : descriptor;
		Reflect.defineProperty(shadow, prop, shown);
		return shown;
	};
	// A child closed to extension is mirrored whole, the shadow closed with it, as the engine checks a proxy's answers
	// about a non-extensible target against that target.
	const mirrorClosed = () => {
		if (Reflect.isExtensible(child) || !Reflect.isExtensible(shadow)) return;
		// Closed, the shadow holds the child's members and keeps its inspect hook, which the view lists as well: the
		// shadow holds what the module holds, so `util.inspect` must never describe it directly.
		const keys = asKept(() => Reflect.ownKeys(child));
		for (let k = 0; k < keys.length; k++) {
			const key = keys[k];
			// What the module holds, for every member: one the reader may not read is still refused when it is read.
			if (key === util.inspect.custom) continue;
			const descriptor = rawDescriptor(key);
			const shown =
				"value" in descriptor && !descriptor.writable
					? { __proto__: null, ...descriptor, value: shownValue(descriptor.value) }
					: descriptor;
			Reflect.defineProperty(shadow, key, shown);
		}
		// The hook is fixed with the shadow, so closing the view member by member (as `Object.freeze` does) finds it fixed.
		Reflect.defineProperty(shadow, util.inspect.custom, { __proto__: null, configurable: false, writable: false });
		// The prototype the node holds, read without the reader's check: the shadow has to hold it, and the view checks
		// it when it reports it (see getPrototypeOf below, #632). A closed emitter's shell holds its own prototype as a view
		// no reader keeps: this view's reader is handed it as an open emitter's reader is (#667).
		const heldProto = heldPrototypeOf(child);
		const behindProto = behindMemberView(heldProto);
		if (behindProto === heldProto) Reflect.setPrototypeOf(shadow, heldProto);
		else {
			// Fixed for this view's reader: the object itself to code nothing could refuse an access through it, the handle
			// to any other.
			Reflect.setPrototypeOf(shadow, prototypeForHolder(inner.slothlet, capturedCaller, closedPrototypeHandle(inner, behindProto)));
		}
		Reflect.preventExtensions(shadow);
	};
	// A closed shadow lists exactly what the child has: a member the child has since lost — deleted, or cut off by a
	// shorter length — goes from the shadow too.
	const pruneClosed = () => {
		if (Reflect.isExtensible(shadow)) return;
		for (let ofIndex = 0, ofList = Reflect.ownKeys(shadow); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (key !== util.inspect.custom && !rawDescriptor(key)) Reflect.deleteProperty(shadow, key);
		}
	};

	// The view's description of a member, made as part of one access.
	const describeMember = (prop, access) => {
		mirrorClosed();
		try {
			return mirror(prop, true, access);
		} catch (error) {
			if (error?.code !== "PERMISSION_DENIED") throw error;
			// A member the reader may not read is absent from an open view, as it is in a call. A closed view must
			// describe every member it holds: one it may still change is described with its value withheld, as the
			// node describes it in a call; only a fixed value, which must be reported as it is, is refused.
			const held = Reflect.getOwnPropertyDescriptor(shadow, prop);
			if (Reflect.isExtensible(shadow) && !(held && !held.configurable)) return undefined;
			if (held && "value" in held && (held.writable || held.configurable)) return { __proto__: null, ...held, value: undefined };
			throw error;
		}
	};

	view = new NativeProxy(shadow, {
		apply(_, thisArg, args) {
			// What the call hands back is the reader's, as what a call through its view of `self` hands back is: a member
			// handed out fixed is called with no view of `self` over it.
			if (!gated) return selfViewResult(Reflect.apply(child, thisArg, args), capturedCaller, null, inner);
			// A stand-in a held view read was made for its reader, and checks the reader against the node it resolves
			// to when called; a check here could only be made against the stand-in's base.
			if (gated === "held" && WeakSetMethods.has(STAND_INS, child))
				return selfViewResult(Reflect.apply(child, thisArg, args), capturedCaller, null, inner);
			// A stale principal defers the captured check (#459); the live caller is still enforced by the
			// child's own applyTrap once the call proceeds.
			const pending = inner.___enforceCapturedPair(capturedCaller, ceiling, undefined, args, true);
			const call = callAsDefiner(inner, () =>
				selfViewResult(
					asKept(() => Reflect.apply(child, thisArg, args)),
					capturedCaller,
					null,
					inner
				)
			);
			if (pending) {
				// The live caller is read now: once the gate's await settles, the stack no longer holds it.
				const entry = inner.___liveEntry();
				return inner.___runAfterPrincipalGate(pending, () => inner.___applyWithEntry(entry, call));
			}
			return call();
		},
		construct(_, args, newTarget) {
			if (gated && !(gated === "held" && WeakSetMethods.has(STAND_INS, child)))
				inner.___enforceCapturedPair(capturedCaller, ceiling, undefined, args);
			// `new view(...)` makes the view itself the newTarget, which downstream would use to derive the
			// instance's prototype and to decide how to wrap it. Hand the child through instead, so
			// construction sees exactly what it saw before a view was interposed.
			return asKept(() => Reflect.construct(child, args, newTarget === view ? child : newTarget));
		},
		get(_, prop, receiver) {
			// The access a view of `self` over this one is making, taken as the trap starts; a read made on this view
			// itself is an access of its own. Its checks of the node ask who is reading once (see beginAccess).
			const handed = takeAccess(view);
			const access = handed ?? beginAccess();
			try {
				mirrorClosed();
				if (prop === util.inspect.custom && !Reflect.isExtensible(shadow)) return Reflect.get(shadow, prop);
				const descriptor = rawDescriptor(prop, access);
				if (descriptor && !descriptor.configurable && "value" in descriptor && !descriptor.writable) {
					// Read through the child, so its own read rules run, then gated against the reader; what is handed out
					// is what the shadow holds, as the engine requires.
					handOut(
						prop,
						asKept(() => readWithAccess(access, inner, child, prop, child))
					);
					return mirror(prop, true, access).value;
				}
				return handOut(
					prop,
					readKept(() => readWithAccess(access, inner, child, prop, receiver === view ? child : receiver))
				);
			} finally {
				if (handed === null) endAccess(access);
			}
		},
		getOwnPropertyDescriptor(_, prop) {
			const handed = takeAccess(view);
			const access = handed ?? beginAccess();
			try {
				return describeMember(prop, access);
			} finally {
				if (handed === null) endAccess(access);
			}
		},
		has(_, prop) {
			mirrorClosed();
			pruneClosed();
			// `in` decides no read: it is asked as it is, never for the view's reader, so code the node runs to answer
			// (a Proxy among its prototypes) has no reader to take (#661).
			return Reflect.has(child, prop);
		},
		ownKeys() {
			mirrorClosed();
			pruneClosed();
			const keys = asKept(() => Reflect.ownKeys(child));
			// An open view lists what its reader may read, as it is listed in a call; a closed one lists every member,
			// as the engine requires, and refuses those the reader may not read when they are read, and its inspect hook.
			if (!Reflect.isExtensible(shadow))
				return ArrayMethods.includes(keys, util.inspect.custom) ? keys : concatLists(keys, [util.inspect.custom]);
			return filterList(keys, (key) => readable(key) || Reflect.getOwnPropertyDescriptor(shadow, key)?.configurable === false);
		},
		getPrototypeOf() {
			mirrorClosed();
			if (Reflect.isExtensible(shadow)) return shownValue(Reflect.getPrototypeOf(child));
			// A closed view reports what its shadow holds, the module's own prototype for an emitter of its own: reaching it
			// is checked as a call of the node, for the module holding the view (#632).
			const fixed = Reflect.getPrototypeOf(shadow);
			// Checked for whoever reads it now, as the view's other traps and its open branch are: a view handed on to another
			// module answers that module as the node would, never as the module that kept it.
			// A view of a prototype the node was given checks each read made through it itself.
			if (inner && !WeakMapMethods.has(GIVEN_VIEWS, fixed)) {
				const behind = behindMemberView(fixed);
				enforceCodeMember(inner.___prototypeCheckedBy(behind), behind);
			}
			return fixed;
		},
		isExtensible() {
			mirrorClosed();
			return Reflect.isExtensible(shadow);
		},
		set(_, prop, value, receiver) {
			refuseWithoutStanding(prop);
			return Reflect.set(child, prop, value, receiver === view ? child : receiver);
		},
		defineProperty(_, prop, descriptor) {
			// A definition that changes nothing (freezing an already frozen node) is no write of the reader's (#667): it goes
			// on to the node, which decides whether it changes what the node holds.
			mirrorClosed();
			if (Reflect.isExtensible(shadow) || !isUnchangingDefinition(shadow, prop, descriptor)) refuseWithoutStanding(prop);
			// A closed shadow lists an inspect hook even for a child that holds none (see ownKeys), such as a lazy node
			// not loaded yet, which could not define one: freezing the view fixes the shadow's own there.
			if (prop === util.inspect.custom && !Reflect.isExtensible(shadow) && !rawDescriptor(prop)) {
				return Reflect.defineProperty(shadow, prop, descriptor);
			}
			if (!Reflect.defineProperty(child, prop, descriptor)) return false;
			// A member made fixed, or made read-only where the shadow already holds it fixed, is mirrored as it is now.
			mirror(prop, false);
			return true;
		},
		deleteProperty(_, prop) {
			refuseWithoutStanding(prop);
			if (!Reflect.deleteProperty(child, prop)) return false;
			mirror(prop, false);
			return true;
		},
		setPrototypeOf(_, proto) {
			refuseWithoutStanding(null);
			if (!Reflect.setPrototypeOf(child, proto)) return false;
			if (!Reflect.isExtensible(shadow)) return Reflect.getPrototypeOf(shadow) === proto;
			return true;
		},
		preventExtensions() {
			// Closing a node already closed is no write of the reader's (#667): the node answers it.
			mirrorClosed();
			if (Reflect.isExtensible(shadow)) refuseWithoutStanding(null);
			if (!Reflect.preventExtensions(child)) return false;
			mirrorClosed();
			return true;
		}
	});

	WeakMapMethods.set(byChild, child, view);
	WeakMapMethods.set(capturedViewChildren, view, inner);
	WeakMapMethods.set(capturedViewTargets, view, child);
	WeakMapMethods.set(capturedViewShadows, view, shadow);
	// A held view stands for its node as a view that gates nothing does: stored, it stores the node.
	if (gated !== true) WeakSetMethods.add(GUARD_VIEWS, view);
	WeakSetMethods.add(capturedViewSet, view);
	WeakMapMethods.set(capturedViewNodes, view, child);
	return view;
}

/**
 * The module reading the api now, when its identity is to travel with what it takes out of the api: the same
 * test {@link bindCapturedIdentity} applies. `null` when permissions or capture are off, or when the
 * host is reading.
 *
 * @param {object} wrapper - Wrapper being read.
 * @returns {{wrapper: object, ceiling: object|null}|null} The reading module's wrapper, with the call it read
 *   inside when the reading code was supplied to that call (#597).
 * @private
 */
function capturedReader(wrapper) {
	const permissionManager = wrapper.slothlet.handlers?.permissionManager;
	if (!permissionManager || !permissionManager.isEnabled()) return null;
	if (permissionManager.isCaptureEnabled?.() === false) return null;
	const identity = wrapper.slothlet.contextManager?.getCallerIdentity?.();
	return identity?.currentWrapper ? { wrapper: identity.currentWrapper, ceiling: identity.ceiling ?? null } : null;
}

/**
 * The object a value stands for once every layer slothlet put around it is taken off: a prototype's handle, a view
 * `self` hands out, a full-isolation run's view, a crossing view, a stand-in, a view of a given prototype, a pinned code
 * member, the async runtime's context wrapper of a class instance, and a node, which stands for its module's value (the
 * function of a function node). Anything else is the value itself. Nothing of the module's code runs: only slothlet's own
 * records are read.
 * @param {*} value - The value.
 * @returns {*} What it stands for.
 * @private
 */
function underlyingValue(value) {
	for (let depth = 0; depth < 64; depth++) {
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
		let next = value;
		if (WeakMapMethods.has(RUN_VIEWS, next)) next = WeakMapMethods.get(RUN_VIEWS, next);
		else if (WeakMapMethods.has(CROSSINGS, next)) next = WeakMapMethods.get(CROSSINGS, next).original;
		else if (WeakMapMethods.has(SELF_MEMBER_VIEWS, next)) next = WeakMapMethods.get(SELF_MEMBER_VIEWS, next).value;
		else if (WeakMapMethods.has(SELF_VIEW_NODES, next)) next = WeakMapMethods.get(SELF_VIEW_NODES, next);
		else if (WeakMapMethods.has(capturedViewTargets, next)) next = WeakMapMethods.get(capturedViewTargets, next);
		else if (WeakMapMethods.has(STAND_IN_RECORDS, next)) next = WeakMapMethods.get(STAND_IN_RECORDS, next).original;
		else if (WeakMapMethods.has(GIVEN_VIEWS, next)) next = WeakMapMethods.get(GIVEN_VIEWS, next).value;
		else if (WeakMapMethods.has(PINNED_CODE_MEMBERS, next)) next = WeakMapMethods.get(PINNED_CODE_MEMBERS, next);
		else {
			const unwrapped = runtime_unwrapClassInstance(next);
			if (unwrapped !== next) next = unwrapped;
			else {
				const wrapper = resolveWrapper(next);
				if (wrapper === null) return next;
				const impl = wrapper.____slothletInternal.impl;
				next = functionOf(impl) ?? impl;
			}
		}
		if (next === value) return value;
		value = next;
	}
	return value;
}

/**
 * `slothlet.same(a, b)`: whether two values stand for the same object once slothlet's own layers are taken off each
 * ({@link underlyingValue}), so a module handed a prototype's handle can tell it is the prototype it imported.
 * @param {*} a - One value.
 * @param {*} b - The other.
 * @returns {boolean} True when both stand for the same object (or are the same primitive, as `Object.is` tells).
 * @internal
 *
 * @example
 * sameValue(self.owner.Box.prototype, Box.prototype); // true
 */
function sameValue(a, b) {
	return Objects.is(underlyingValue(a), underlyingValue(b));
}

/** Whether {@link ViewsLayer} has built its class: it builds one, for the wrapper's chain. @type {boolean} */
let built = false;

/**
 * Build this layer of the wrapper class over `Base`, once (see `unified-wrapper.mjs`).
 * @param {Function} Base - The class below this layer.
 * @returns {Function} The layer's class.
 * @internal
 */
export function ViewsLayer(Base) {
	if (built) throw ownBindingsRefusal("lib/handlers/unified-wrapper/views", import.meta.url);
	built = true;
	return Base.layer(
		class Views extends Base {
			static {
				Base.define("has", { own: hasOwn });
				Base.define("views", {
					SELF_VIEW_NODES,
					SELF_VIEW_READERS,
					SELF_INSTANCE_NODES,
					HOST_READER,
					PROTOTYPE_HANDLE_READER,
					RUN_VIEWS,
					unwrapSelfView,
					SELF_MEMBER_VIEWS,
					INTRINSIC_HAS_INSTANCE,
					NODE_MEMBER,
					holderFilePath,
					FRAMEWORK_MEMBERS,
					SELF_FRAMEWORK_ROOTS,
					builtinBehind,
					STAND_INS,
					viewsShared,
					GIVEN_VIEWS,
					PINNED_CODE_MEMBERS,
					RUNTIME_SELVES,
					RUNTIME_CALLABLE_SELVES,
					permissionsOn,
					callingModule,
					frontingNode,
					atClassSite,
					PROTOTYPE_PATHS,
					sameModule,
					behindMemberView,
					emitterOwnPrototype,
					readsEngineProto,
					SERIALIZERS,
					GUARD_VIEWS,
					sameValue,
					PENDING_INVARIANT_READ,
					HAS_INSTANCE_BY_IMPL,
					FUNCTION_HAS_INSTANCE
				});
				Base.define("self", {
					reader: selfReader,
					moduleReader: selfModuleReader,
					moduleCeilings: selfModuleCeilings,
					writeHasStanding: selfWriteHasStanding,
					isMethodNode: selfIsMethodNode,
					memberOf: selfMemberOf,
					memberView: selfMemberView,
					view: selfView,
					frameworkView: selfFrameworkView,
					changeTarget: selfChangeTarget,
					rootView: selfRootView,
					hookHandler: selfHookHandler,
					readAsDefiner: selfReadAsDefiner,
					hasInstance: selfHasInstance
				});
				Base.define("function", { of: functionOf });
				Base.define("captured", {
					viewChildren: capturedViewChildren,
					viewTargets: capturedViewTargets,
					viewShadows: capturedViewShadows,
					view: capturedView,
					reader: capturedReader
				});
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					capturedViewSet = methods.captured.viewSet;
					INTRINSICS = methods.values.INTRINSICS;
					dataKind = methods.values.dataKind;
					hasInternalSlots = methods.has.internalSlots;
					holdsDataKind = methods.holds.dataKind;
					inherits = methods.values.inherits;
					isArrayMember = methods.is.arrayMember;
					isConstructor = methods.is.constructor;
					isEngineMember = methods.is.engineMember;
					isPrototypeHandle = methods.is.prototypeHandle;
					isSharedValue = methods.is.sharedValue;
					isTerminalData = methods.is.terminalData;
					isUnchangingDefinition = methods.is.unchangingDefinition;
					ownsPrototype = methods.values.ownsPrototype;
					capturedViewNodes = methods.captured.viewNodes;
					FUNCTION_NODES = methods.nodes.FUNCTION_NODES;
					LAYER_FRONTS = methods.nodes.LAYER_FRONTS;
					nodeRefOf = methods.node.refOf;
					classSiteOf = methods.nodes.classSiteOf;
					makerInstanceID = methods.nodes.makerInstanceID;
					makerOf = methods.nodes.makerOf;
					moduleKey = methods.module.key;
					nodeAtPath = methods.node.atPath;
					nodeWrapperOf = methods.node.wrapperOf;
					prototypeClassNode = methods.prototype.classNode;
					prototypeForHolder = methods.prototype.forHolder;
					prototypeHandedTo = methods.prototype.handedTo;
					prototypeHandleAt = methods.prototype.handleAt;
					prototypeHandleOf = methods.prototype.handleOf;
					prototypeSiteOf = methods.prototype.siteOf;
					readerHoldsPrototype = methods.nodes.readerHoldsPrototype;
					FRAMEWORK_MEMBER_NAMES = methods.rules.FRAMEWORK_MEMBER_NAMES;
					accessIdentity = methods.access.identity;
					assertReaderWrite = methods.rules.assertReaderWrite;
					beginAccess = methods.rules.beginAccess;
					describeWithAccess = methods.rules.describeWithAccess;
					endAccess = methods.rules.endAccess;
					enforceCodeMember = methods.rules.enforceCodeMember;
					enforceRead = methods.rules.enforceRead;
					frameworkViewOf = methods.framework.viewOf;
					readOnBehalf = methods.read.onBehalf;
					readWithAccess = methods.read.withAccess;
					refuseEndedAccess = methods.rules.refuseEndedAccess;
					refuseWriteWithoutStanding = methods.rules.refuseWriteWithoutStanding;
					takeAccess = methods.rules.takeAccess;
					CROSSING_ORIGINS = methods.membrane.CROSSING_ORIGINS;
					CROSSINGS = methods.membrane.CROSSINGS;
					HOST_HANDED = methods.membrane.HOST_HANDED;
					INSPECT_CUSTOM = methods.membrane.INSPECT_CUSTOM;
					crossTo = methods.membrane.crossTo;
					frontingNodeNow = methods.membrane.frontingNodeNow;
					knownPrototype = methods.membrane.knownPrototype;
					recordOrigin = methods.membrane.recordOrigin;
					SEALED_SHELL_READER = methods.membrane.SEALED_SHELL_READER;
					STAND_IN_RECORDS = methods.membrane.STAND_IN_RECORDS;
					checkedStandIn = methods.waiting.checkedStandIn;
					ACTING_FOR = methods.uw.ACTING_FOR;
					frameDefiner = methods.uw.frameDefiner;
					isClassInstance = methods.is.classInstance;
					markFrameworkInternal = methods.uw.markFrameworkInternal;
					resolveWrapper = methods.uw.resolveWrapper;
					runtime_classInstanceCreator = methods.uw.runtime_classInstanceCreator;
					runtime_unwrapClassInstance = methods.uw.runtime_unwrapClassInstance;
					trustedRootOwn = methods.uw.trustedRootOwn;
					versionDispatcherRecord = methods.uw.versionDispatcherRecord;
					registerProxy = methods.values.registerProxy;
					nodesShared = methods.nodes.nodesShared;
					recordPrototypePath = methods.nodes.recordPrototypePath;
					rulesShared = methods.rules.rulesShared;
					hostRunDefiner = methods.rules.hostRunDefiner;
					isIntrinsic = methods.is.intrinsic;
					FRAMEWORK_VIEW_TARGETS = methods.rules.FRAMEWORK_VIEW_TARGETS;
					COMMON_READERS = methods.values.COMMON_READERS;
					TYPED_ARRAY_READERS = methods.values.TYPED_ARRAY_READERS;
					DATA_READERS = methods.values.DATA_READERS;
					MEMBER_HOLDERS = methods.values.MEMBER_HOLDERS;
					isWrapper = methods.brand.isWrapper;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/views", import.meta.url);
				super(slothlet);
			}

			/**
			 * The arguments a call into a module is handed, with each class instance of the module's own that comes back in the
			 * async runtime's context wrapper (#328) handed in as the instance itself, as in plain JavaScript: the module's own
			 * object is `===` the one it made, and its private fields are there.
			 * @param {object} wrapper - The wrapper being called.
			 * @param {ArrayLike<*>} args - The call's arguments.
			 * @returns {ArrayLike<*>} The arguments, the same list when nothing changed.
			 * @private
			 */
			___ownInstances(args) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/views", import.meta.url);
				const wrapper = this;
				let result = args;
				const count = args?.length ?? 0;
				for (let index = 0; index < count; index++) {
					const value = args[index];
					if (value === null || typeof value !== "object" || !runtime_isWrappedClassInstance(value)) continue;
					const creator = runtime_classInstanceCreator(value);
					if (creator === null || !sameModule(creator, wrapper)) continue;
					if (result === args) result = copyList(args);
					result[index] = runtime_unwrapClassInstance(value);
				}
				return result;
			}

			/**
			 * Whether the node holds `prop`, a symbol, as a member the module put there (adopted onto the wrapper, or
			 * still on the value), read through a child wrapper like a string-keyed one. Symbols the value inherits, such as an array's
			 * `Symbol.iterator`, are not members.
			 *
			 * @param {object} wrapper - The node's wrapper.
			 * @param {symbol} prop - The key.
			 * @returns {boolean} True when the value has `prop` as an own key.
			 * @private
			 */
			___hasOwnSymbolMember(prop) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/views", import.meta.url);
				const wrapper = this;
				// Adoption moves an object's members, symbol-keyed ones included, onto the wrapper; an array keeps its own.
				if (hasOwn(wrapper, prop)) return true;
				const impl = wrapper.____slothletInternal.impl;
				// An array's members include those a prototype the module gave it supplies (see isArrayMember).
				if (Arrays.isArray(impl)) return isArrayMember(impl, prop);
				// A user proxy answers through its own descriptor; reading one may run its trap, as a read of the member does.
				return (
					impl !== null &&
					(typeof impl === "object" || typeof impl === "function") &&
					Reflect.getOwnPropertyDescriptor(impl, prop) !== undefined
				);
			}

			/**
			 * The caller identity executing right now on a wrapper's instance, with the store it was read on, or null
			 * when permissions are off or nothing is in context.
			 * @param {object} wrapper - The wrapper about to be called.
			 * @returns {{store: object|null, identity: object}|null} The identity.
			 * @private
			 */
			___liveEntry() {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/views", import.meta.url);
				const wrapper = this;
				const contextManager = wrapper.slothlet.contextManager;
				const identity = contextManager?.getCallerIdentity?.(wrapper.slothlet.instanceID);
				if (!identity) return null;
				return { store: contextManager.tryGetContext?.(wrapper.slothlet.instanceID) ?? null, identity };
			}
		}
	);
}
