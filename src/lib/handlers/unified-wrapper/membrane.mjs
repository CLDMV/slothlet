/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/membrane.mjs
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
 * @fileoverview Membrane layer of the wrapper: crossings between modules, carrying values across, hand-outs and given views.
 * @module @cldmv/slothlet/handlers/unified-wrapper/membrane
 * @internal
 */

import { segmentsOf } from "#helpers/segments";
import { DEFAULT_SEARCH_DEPTH, DEFAULT_SEARCH_PROPERTIES } from "#helpers/defaults";
import { isNode, util } from "#helpers/platform";
import { SlothletError } from "#errors";
import { identityCeilings } from "#handlers/trusted-root";
import { handsOutAsModule } from "#handlers/frame-placement";
import { isFrameworkInternal } from "#handlers/framework-internals";
import { isSharedExport } from "#handlers/shared-values";
import { engineThenOf } from "#helpers/promise-context";
import { isFunctionSourcePatch } from "#helpers/function-source-context";
import {
	ArrayMethods,
	Arrays,
	asyncGeneratorSteps,
	Boolean,
	concatLists,
	copyList,
	filterList,
	FunctionMethods,
	Functions,
	functionSource,
	functionToString,
	generatorSteps,
	Iterator,
	listPush,
	Map,
	mapList,
	MapMethods,
	mapValuesToArray,
	NativeProxy,
	Objects,
	Promise,
	Promises,
	PrototypeFunctions,
	Reflect,
	Set,
	setFrom,
	SetMethods,
	setValues,
	splitText,
	String,
	StringMethods,
	Symbol,
	Symbols,
	WeakMap,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods,
	WeakRefMethods,
	ObjectMethods
} from "#helpers/intrinsics";

import { ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 */
let runtime_unwrapClassInstance,
	runtime_classInstanceCreator,
	trustedRootOwn,
	isLeafFileFunction,
	SELF_VIEW_NODES,
	SELF_INSTANCE_NODES,
	HOST_READER,
	PROTOTYPE_HANDLE_READER,
	runtime_isPrototypeHandle,
	runtime_unwrapSelfView,
	runtime_selfReader,
	runtime_selfModuleReader,
	SELF_MEMBER_VIEWS,
	runtime_hasInternalSlots,
	runtime_inherits,
	runtime_selfMemberOf,
	ACTING_FOR,
	runtime_runsNoModuleCode,
	runtime_runsForHander,
	runtime_inheritedPrivate,
	runtime_selfView,
	runtime_assertOwnedWrite,
	runtime_isTerminalData,
	runtime_readGateDecision,
	runtime_readGateFor,
	GIVEN_VIEWS,
	runtime_recordedPrototype,
	runtime_prototypeGiven,
	runtime_ownsPrototype,
	MAKERS,
	INTRINSICS,
	runtime_isBindingMethod,
	runtime_isSharedValue,
	runtime_isSlothletValue,
	runtime_isModuleProxy,
	runtime_isBuiltinFunction,
	runtime_makerOf,
	runtime_runAsMaker,
	runtime_isSlotObject,
	runtime_isNativeIterator,
	VM_SCRIPT,
	VM_NATIVE_SCRIPT,
	runtime_memberHoldsCode,
	runtime_holdsCode,
	runtime_gateLeafCopy,
	runtime_isCodeObject,
	runtime_isShared,
	runtime_permissionsOn,
	runtime_runningLeafOf,
	runtime_exposePrototype,
	FUNCTION_NODES,
	nodeRefOf,
	runtime_frontingNode,
	runtime_classPrototypeSites,
	runtime_prototypeForHolder,
	runtime_atClassSite,
	PROTOTYPE_PATHS,
	runtime_prototypeHandedTo,
	runtime_isCarrier,
	runtime_moduleKey,
	runtime_sameModule,
	runtime_isOwnOrigin,
	runtime_isStepResult,
	runtime_behindMemberView,
	GUARD_VIEWS,
	capturedViewChildren,
	runtime_isConstructor,
	runtime_capturedView,
	resolveWrapper,
	leafOfCopy,
	runtime_constructorReadMayRefuse,
	CLASS_INSTANCES,
	WELL_KNOWN_SYMBOLS,
	TYPED_ARRAY_BYTE_LENGTH,
	TYPED_ARRAY_LENGTH,
	runtime_readerHoldsPrototype;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/**
 * The key Node's `util.inspect` reads a custom inspect function from.
 * @type {symbol}
 * @private
 */
const INSPECT_CUSTOM = Symbols.for("nodejs.util.inspect.custom");

/**
 * Reader of the view a closed emitter's shell holds as its prototype (#667). The shell reports one prototype to whoever
 * asks, so the view stands as the node does: a change made through it is the running module's, and with none running it
 * has the standing a change through the node has.
 * @type {Readonly<{reader: string}>}
 * @private
 */
const SEALED_SHELL_READER = Objects.freeze({ reader: "sealed shell" });

/**
 * Run a function handed over from another module through its crossing view: a function of the engine's own runs for
 * that module ({@link ACTING_FOR}), and so does what it registers to run later (a promise's reaction it was bound to,
 * `Promise.prototype.then.bind(p, write)`), to which the runtime carries the module; any other runs its own module's
 * code, whose frames attribute what it does.
 * @param {object} state - The crossing view's state.
 * @param {function(): *} run - The call.
 * @returns {*} What it returned.
 * @private
 */
function runtime_crossRun(state, run) {
	if (!runtime_crossRunsForHander(state)) return run();
	listPush(ACTING_FOR, state.from);
	try {
		return run();
	} finally {
		ArrayMethods.pop(ACTING_FOR);
	}
}

/**
 * Whether a crossing view's function runs for the module that handed it over ({@link runtime_crossRun}).
 * @param {object} state - The crossing view's state.
 * @returns {boolean} True when it does.
 * @private
 */
function runtime_crossRunsForHander(state) {
	if (!state.from?.____slothletInternal || typeof state.original !== "function") return false;
	return state.handed || runtime_runsNoModuleCode(state.original);
}

/**
 * A member of its own a crossing view hands its reader, when it is a function that runs for the module the value came
 * from ({@link runtime_runsForHander}): its view, which runs it for that module ({@link runtime_handedView}), as when the
 * module hands it over as an argument. `undefined` for any other member.
 * @param {object} state - The crossing view's state.
 * @param {string|symbol} prop - The member.
 * @param {*} value - What it holds.
 * @returns {Function|undefined} The view, or `undefined`.
 * @private
 */
function runtime_crossHandedMember(state, prop, value) {
	if (typeof value !== "function" || WeakMapMethods.has(CROSSINGS, value) || !state.reader?.____slothletInternal) return undefined;
	if (!runtime_runsForHander(value, state.from) || !runtime_guardOn(state.slothlet)) return undefined;
	const own = Reflect.getOwnPropertyDescriptor(state.original, prop);
	if (!own || !("value" in own) || own.value !== value) return undefined;
	return runtime_handedView(value, state.reader, state.slothlet, state.from);
}

/**
 * The views of functions of the language's and Node's own that modules handed to others ({@link runtime_handedView}):
 * by function, then by the module handing it, then by the reader. One function is handed by many modules, and each view
 * runs for the module that handed it.
 * @type {WeakMap<Function, WeakMap<object, Map<*, Function>>>}
 * @private
 */
const HANDED_VIEWS = new WeakMap();

/**
 * A function of the language's or Node's own (`Reflect.set`, `util._extend`) that one module hands another as an
 * argument, as the other gets it: a view that runs it for the module that handed it ({@link runtime_crossRun}), with
 * what the reader calls it with reaching that module, so a target the reader holds as itself is the handing module's
 * view of it again. Such a function shared by everyone passes between modules as itself everywhere else.
 * @param {Function} fn - The function.
 * @param {object} reader - The wrapper of the module it is handed to.
 * @param {object} slothlet - The instance.
 * @param {object} from - The wrapper of the module handing it.
 * @returns {Function} The view, the same one for the same function, module and reader every time.
 * @private
 */
function runtime_handedView(fn, reader, slothlet, from) {
	let byFrom = WeakMapMethods.get(HANDED_VIEWS, fn);
	if (!byFrom) WeakMapMethods.set(HANDED_VIEWS, fn, (byFrom = new WeakMap()));
	let byReader = WeakMapMethods.get(byFrom, from);
	if (!byReader) WeakMapMethods.set(byFrom, from, (byReader = new Map()));
	const key = runtime_crossKey(reader);
	const held = MapMethods.get(byReader, key);
	if (held) return held;
	const view = runtime_crossView(fn, reader, slothlet, from, true);
	MapMethods.set(byReader, key, view);
	return view;
}

/**
 * The object a view of a given prototype stands for ({@link runtime_givenView}), or the value itself when it is no
 * such view: a view handed back in (`Object.setPrototypeOf(node, view)`) is the object.
 * @param {*} value - The value.
 * @returns {*} What is behind it.
 * @private
 */
function runtime_behindGivenView(value) {
	return WeakMapMethods.get(GIVEN_VIEWS, value)?.value ?? value;
}

/**
 * Whether a value handed out of a given prototype is handed out as it is: nothing a view is made of, one of
 * slothlet's own values, or the language's own.
 * @param {*} value - The value.
 * @returns {boolean} True when it is.
 * @private
 */
function runtime_givenAsIs(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return true;
	return WeakSetMethods.has(INTRINSICS, value) || runtime_isSlothletValue(value) || WeakMapMethods.has(GIVEN_VIEWS, value);
}

/**
 * The read gate's verdict on a member read from a given prototype, at the path a member of the node by that name is
 * read at: decided for whoever reads now, and, when that is no module (a callback the host runs), for the module the
 * view was handed to, so a view a module kept reads no more than the module may.
 * @param {{gate: object, reader: object}} record - The view's record.
 * @param {string|symbol} prop - The member's key.
 * @param {string} [target] - The path decided, when it is not the member's own (a probe beneath it).
 * @returns {{allowed: boolean, caller: string|null, target: string}} The verdict, with the path decided.
 * @private
 */
function runtime_givenReadDecision(record, prop, target = runtime_memberPathOf(record.gate, prop)) {
	const { gate, reader } = record;
	const pm = gate.slothlet.handlers?.permissionManager;
	if (!pm || !pm.isEnabled() || !pm.isReadGatingEnabled()) return { allowed: true, caller: null, target };
	const live = runtime_readGateDecision(gate, target, undefined);
	if (!live.allowed || live.caller !== null || !reader?.____slothletInternal) return { ...live, target };
	if (gate.slothlet.handlers.apiManager.isRemovedCaller(reader)) {
		return { allowed: false, caller: String(reader.____slothletInternal.apiPath ?? ""), target };
	}
	return { ...runtime_readGateFor(gate, target, reader, { context: null }), target };
}

/**
 * Whether a member a given prototype holds is left out of what its view lists and describes: data the reader may not
 * read, and a getter whose path it may not read, as a node leaves them out of its own listing (see
 * {@link runtime_isReadRedacted}), and, from a listing, an object member the reader may read nothing beneath, as a node
 * leaves out the same member of its own (see {@link runtime_givenReadsNothingBeneath}). Read by descriptor: nothing of
 * the prototype runs.
 * @param {{value: object, gate: object, reader: object}} record - The view's record.
 * @param {string|symbol} prop - The member's key.
 * @param {boolean} [listing=false] - Whether the key is being listed (`ownKeys`): an object member is described still.
 * @returns {boolean} True when it is left out.
 * @private
 */
function runtime_givenWithheld(record, prop, listing = false) {
	/**
	 * Whether the rules leave the reader nothing to read at an object member of a given prototype: a read of the member's
	 * path is refused, and so is a read of any member beneath it, with no more specific allow beneath it, as
	 * {@link runtime_readsNothingBeneath} decides for the same member of a node's own.
	 * @param {{gate: object, reader: object}} record - The view's record.
	 * @param {string} prop - The member's key.
	 * @returns {boolean} Whether the reader may read nothing there.
	 * @private
	 *
	 * @example
	 * // rule: allow reader.** → owner.config.partly.a; the prototype holds { nothing: {...}, partly: {...} }
	 * Object.keys(Object.getPrototypeOf(self.owner.config)); // ["partly"]
	 */
	function runtime_givenReadsNothingBeneath(record, prop) {
		const targetPath = runtime_memberPathOf(record.gate, prop);
		if (runtime_givenReadDecision(record, prop, targetPath).allowed) return false;
		const probePath = `${targetPath}.${ANY_MEMBER_SEGMENT}`;
		const beneath = runtime_givenReadDecision(record, prop, probePath);
		if (beneath.allowed) return false;
		return !record.gate.slothlet.handlers.permissionManager.allowsBeneath(beneath.caller, targetPath, probePath);
	}

	const descriptor = Reflect.getOwnPropertyDescriptor(record.value, prop);
	if (!descriptor) return false;
	const isData = "value" in descriptor;
	// An object member is listed only while the reader may read something beneath it, as the same member of the node's
	// own is. What slothlet hands out as it is (a node, a view) is listed whatever the rules on its path say.
	if (listing && isData && typeof prop === "string") {
		const member = descriptor.value;
		if (member !== null && typeof member === "object" && !runtime_isTerminalData(member) && !runtime_givenAsIs(member))
			return runtime_givenReadsNothingBeneath(record, prop);
	}
	if (isData ? !runtime_isTerminalData(descriptor.value) : typeof descriptor.get !== "function") return false;
	return !runtime_givenReadDecision(record, prop).allowed;
}

/**
 * A member read from a given prototype, as the reader is handed it: data once the reader may read it at the node's
 * path plus the member's name, a function as the node at that path a read through the node hands out (call-gated
 * there), and an object as a view of its own one level down, whose members are read beneath that path.
 * @param {{value: object, gate: object, node: object|null, reader: object, members: Map}} record - The view's record.
 * @param {string|symbol} prop - The member's key.
 * @param {*} value - What the prototype answered.
 * @returns {*} What the reader is handed.
 * @throws {SlothletError} PERMISSION_DENIED when the reader may not read the member.
 * @private
 */
function runtime_givenMember(record, prop, value) {
	if (value === undefined) return undefined;
	if (runtime_isTerminalData(value)) {
		const decision = runtime_givenReadDecision(record, prop);
		if (!decision.allowed)
			throw new record.gate.SlothletError("PERMISSION_DENIED", { caller: decision.caller, target: segmentsOf(decision.target) });
		return value;
	}
	if (runtime_givenAsIs(value)) return value;
	if (typeof value === "function") {
		// The engine's own functions are no one's code; any other is read as a member of the node is.
		if (runtime_isBuiltinFunction(value) || record.node === null || typeof record.node.___createChildWrapper !== "function") return value;
		return record.node.___createChildWrapper(prop, value) ?? value;
	}
	const held = MapMethods.get(record.members, prop);
	if (held !== undefined && held.value === value) return held.view;
	const gate = record.gate;
	const beneath = {
		slothlet: gate.slothlet,
		SlothletError: gate.SlothletError,
		____slothletInternal: { apiPath: runtime_memberPathOf(gate, prop), filePath: gate.____slothletInternal.filePath ?? null, impl: value }
	};
	const view = runtime_givenView(beneath, null, value, record.reader, record.assertWrite);
	MapMethods.set(record.members, prop, { value, view });
	return view;
}

/**
 * A prototype given to a node or to the api root, as module code reading that node is handed it: a view that reads
 * each member under the rules a member of the node by that name is read under, leaves out of its listings what the
 * reader may not read, answers `in` as the node does for a member of its own, and holds a change made through it to
 * the rules of a write at the node's path. The host is handed the object itself, and so is everyone while the
 * permission system is off. A prototype further up the chain is viewed the same way, at the same path.
 * @param {object} gate - What the read gate decides against: the node's wrapper, or a stand-in holding the path
 *   (see {@link runtime_rootGate}).
 * @param {object|null} node - The node's wrapper, which hands out the functions the prototype holds; null beneath it
 *   and at the root.
 * @param {object|Function} value - The prototype.
 * @param {object} reader - The module the view is handed to, or the reader standing for every holder of a closed node.
 * @param {function(): void} assertWrite - Refuses a change the code running now may not make at the node's path.
 * @returns {object} The view.
 * @private
 */
function runtime_givenView(gate, node, value, reader, assertWrite) {
	const record = { value, gate, node, reader, assertWrite, members: new Map(), link: null };
	const shadow = {};
	const view = new NativeProxy(shadow, {
		get: (_, prop, receiver) => runtime_givenMember(record, prop, Reflect.get(value, prop, receiver === view ? view : receiver)),
		has: (_, prop) => Reflect.has(value, prop),
		ownKeys: () => filterList(Reflect.ownKeys(value), (key) => !runtime_givenWithheld(record, key, true)),
		getOwnPropertyDescriptor: (_, prop) => {
			const descriptor = Reflect.getOwnPropertyDescriptor(value, prop);
			if (!descriptor || runtime_givenWithheld(record, prop)) return undefined;
			// The view holds nothing fixed, so each member is described as one that can still change.
			if ("value" in descriptor)
				return { __proto__: null, ...descriptor, value: runtime_givenMember(record, prop, descriptor.value), configurable: true };
			return {
				__proto__: null,
				get: typeof descriptor.get === "function" ? () => view[prop] : undefined,
				set:
					typeof descriptor.set === "function"
						? (written) => {
								view[prop] = written;
							}
						: undefined,
				enumerable: descriptor.enumerable,
				configurable: true
			};
		},
		getPrototypeOf: () => {
			const link = Reflect.getPrototypeOf(value);
			if (runtime_givenAsIs(link)) return link;
			if (record.link === null || record.link.value !== link) {
				record.link = { value: link, view: runtime_givenView(gate, node, link, reader, assertWrite) };
			}
			return record.link.view;
		},
		set: (_, prop, written, receiver) => {
			// A write reaching the view from an object that inherits from it lands on that object, as plain JS has it.
			if (receiver !== view) return Reflect.set(value, prop, written, receiver);
			assertWrite();
			return Reflect.set(value, prop, runtime_behindGivenView(runtime_unwrapSelfView(written)));
		},
		defineProperty: (_, prop, descriptor) => {
			assertWrite();
			// The view holds nothing fixed: a definition that would fix a member is made on the object itself, not here.
			if (descriptor.configurable !== true && !Reflect.getOwnPropertyDescriptor(value, prop)?.configurable) return false;
			return Reflect.defineProperty(value, prop, descriptor);
		},
		deleteProperty: (_, prop) => {
			assertWrite();
			return Reflect.deleteProperty(value, prop);
		},
		setPrototypeOf: (_, prototype) => {
			assertWrite();
			return Reflect.setPrototypeOf(value, runtime_behindGivenView(runtime_unwrapSelfView(prototype)));
		},
		// A view stays open: the object is closed on the object itself.
		preventExtensions: () => {
			assertWrite();
			return false;
		}
	});
	WeakMapMethods.set(GIVEN_VIEWS, view, record);
	return view;
}

/**
 * The prototype a node was given, as whoever reads the node now is handed it (see {@link runtime_givenView}): the
 * object itself to the host and while the permission system is off, and to module code its own view, the same one on
 * every read, kept on the node's record for as long as the node has that prototype.
 * @param {object} wrapper - The node's wrapper.
 * @param {object|Function|null} prototype - The prototype the node was given.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making.
 * @returns {object|Function|null} What the reader is handed.
 * @private
 */
function runtime_givenPrototypeFor(wrapper, prototype, kept = null) {
	if (runtime_givenAsIs(prototype)) return prototype;
	const slothlet = wrapper.slothlet;
	if (!slothlet?.handlers?.permissionManager?.isEnabled()) return prototype;
	const reader = runtime_selfModuleReader(slothlet) ?? kept?.reader ?? null;
	if (reader === null || reader === HOST_READER) return prototype;
	return runtime_givenViewOn(wrapper.____slothletInternal, wrapper, wrapper, prototype, reader, () =>
		runtime_assertOwnedWrite(wrapper, null)
	);
}

/**
 * The view of a given prototype kept for a reader on a record (a node's, or the api root's): made once per prototype
 * and reader.
 * @param {object} holder - The record: its `prototypeViews` holds the views of the prototype it has now.
 * @param {object} gate - What the read gate decides against.
 * @param {object|null} node - The node's wrapper, or null at the root.
 * @param {object|Function} prototype - The prototype.
 * @param {object} reader - Who the view is for.
 * @param {function(): void} assertWrite - Refuses a change the code running now may not make at the path.
 * @returns {object} The view.
 * @private
 */
function runtime_givenViewOn(holder, gate, node, prototype, reader, assertWrite) {
	let views = holder.prototypeViews;
	if (views === undefined || views === null || views.of !== prototype) {
		views = { of: prototype, byReader: new WeakMap() };
		holder.prototypeViews = views;
	}
	let view = WeakMapMethods.get(views.byReader, reader);
	if (view === undefined) {
		view = runtime_givenView(gate, node, prototype, reader, assertWrite);
		WeakMapMethods.set(views.byReader, reader, view);
	}
	return view;
}

/**
 * Each stand-in's maker, the wrapper it runs as, and its original. Internal: nothing reachable through a stand-in
 * reads it.
 * @type {WeakMap<object, {maker: object, owner: object, original: object}>}
 * @private
 */
const STAND_IN_RECORDS = new WeakMap();

/**
 * For each stand-in of a function made for what a call returned to a call's own code (see `ownReceiver`), that call,
 * or {@link MOVED} once slothlet has seen the stand-in handed anywhere else: handed out again, handed in to a call,
 * returned by a call. Read by {@link runtime_originOf}.
 * @type {WeakMap<object, object|symbol>}
 * @private
 */
const STAND_IN_ORIGINS = new WeakMap();

/**
 * What {@link STAND_IN_ORIGINS} holds for a stand-in seen handed somewhere other than the call it was made for.
 * @type {symbol}
 * @private
 */
const MOVED = Symbol("moved");

/**
 * The call whose own code receives what is being handed out right now (see {@link runtime_attributeResult}), or null.
 * @type {object|null}
 * @private
 */
let handOutReceiver = null;

/**
 * Record a function stand-in just made as handed to {@link handOutReceiver}, when there is one.
 * @param {object} standIn - The stand-in.
 * @returns {void}
 * @private
 */
function runtime_recordStandInOrigin(standIn) {
	if (handOutReceiver !== null) WeakMapMethods.set(STAND_IN_ORIGINS, standIn, handOutReceiver);
}

/**
 * Note that slothlet sees a value handed on: a stand-in recorded as handed to one call (see
 * {@link runtime_recordStandInOrigin}) is no longer that call's alone, unless it is being handed out to that call again.
 * A crossing view stands for the value behind it.
 * @param {*} value - The value.
 * @returns {void}
 * @private
 */
function runtime_noteMoved(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
	const behind = WeakMapMethods.get(CROSSINGS, value)?.original ?? value;
	const origin = WeakMapMethods.get(STAND_IN_ORIGINS, behind);
	if (origin !== undefined && origin !== MOVED && origin !== handOutReceiver) WeakMapMethods.set(STAND_IN_ORIGINS, behind, MOVED);
}

/**
 * The call a stand-in was handed to alone (ID-D6): the call whose own code it was made for, while slothlet has seen it
 * handed nowhere else. Run there by that call's own code it is code the call obtained itself, which no call above
 * handed in (see `outerCallerCeiling`). Null for any other stand-in: wherever it runs inside a call that was handed
 * code, it may be code a call above handed in, however it reached the call (bound, behind a getter or a Proxy, nested
 * in data, kept from an earlier call).
 * @param {object} standIn - The stand-in.
 * @returns {object|null} The call, or null.
 * @private
 */
function runtime_originOf(standIn) {
	const origin = WeakMapMethods.get(STAND_IN_ORIGINS, standIn);
	return origin === undefined || origin === MOVED ? null : origin;
}

/**
 * For each stand-in of a method read through an object's stand-in, that object and its stand-in (D1): each object gets
 * stand-ins of its own methods, so a method knows which object it was read from.
 * @type {WeakMap<Function, {instance: object, holder: object}>}
 * @private
 */
const METHOD_RECEIVERS = new WeakMap();

/**
 * The call a stand-in being run was handed to alone, for {@link runtime_runAsMaker} (see {@link runtime_originOf}). A
 * method read through an object's stand-in answers for that object: run on it, the object's call; run with any other
 * receiver (another object, a method of another object called on this one, the class's own method read through the
 * class), none.
 * @param {Function} standIn - The stand-in being run.
 * @param {*} receiver - Its receiver, as handed to its module.
 * @returns {object|null} The call, or null.
 * @private
 */
function runtime_callOrigin(standIn, receiver) {
	const bound = WeakMapMethods.get(METHOD_RECEIVERS, standIn);
	if (bound === undefined) return runtime_originOf(standIn);
	return receiver === bound.instance ? runtime_originOf(bound.holder) : null;
}

/**
 * The views a module is handed of a caller's plain array or object holding the module's own stand-ins (see
 * {@link runtime_inboundView}), with the caller's value behind each.
 * @type {WeakMap<object, {maker: object, original: object}>}
 * @private
 */
const INBOUND_VIEWS = new WeakMap();

/**
 * The intrinsic prototypes holding a generator's and an async generator's `next`, `return` and `throw`.
 * @type {{generator: object, asyncGenerator: object}}
 * @private
 */
const GENERATOR_PROTOTYPES = {
	generator: Objects.getPrototypeOf(function* () {}).prototype,
	asyncGenerator: Objects.getPrototypeOf(async function* () {}).prototype
};

/**
 * The engine's methods that call a callback with what an object holds in its internal slots (a `Map`'s entries, what
 * a promise settles to, the values an iterator steps through), taken before any module's code runs. Called on a
 * stand-in, their callbacks get those values handed out as the module's (see runtime_membrane).
 * @type {Set<Function>}
 * @private
 */
const SLOT_CALLBACK_METHODS = setFrom(
	filterList(
		concatLists(
			[
				PrototypeFunctions.Map.forEach,
				PrototypeFunctions.Set.forEach,
				PrototypeFunctions.Promise.then,
				PrototypeFunctions.Promise.catch,
				PrototypeFunctions.Promise.finally
			],
			typeof Iterator === "function"
				? mapList(["forEach", "some", "every", "find", "reduce", "map", "filter", "flatMap"], (name) => PrototypeFunctions.Iterator[name])
				: []
		),
		(method) => typeof method === "function"
	)
);

/**
 * The engine's own readers of what a collection and a promise hold in their internal slots, taken before any module's
 * code runs, so a module replacing them on the prototypes changes nothing they read.
 * @type {{mapEntries: Function, setValues: Function, then: Function}}
 * @private
 */
const SLOT_READERS = {
	mapEntries: PrototypeFunctions.Map.entries,
	setValues: PrototypeFunctions.Set.values,
	then: PrototypeFunctions.Promise.then
};

/**
 * How many levels of objects a value is looked into for code before it is taken to hold code (#597): the instance's
 * `permissions.search.depth`, or the default for an instance with no `permissions` config. Read as a plain number.
 * Together with {@link searchBudget} this is the code search.
 * @param {object|null|undefined} slothlet - The instance.
 * @returns {number} The levels.
 * @private
 */
const searchDepth = (slothlet) => slothlet?.config?.permissions?.search?.depth ?? DEFAULT_SEARCH_DEPTH;

/**
 * A fresh budget of the own properties one search reads, all levels together, before the value is taken to hold code
 * (#597): the instance's `permissions.search.properties`, or the default.
 * @param {object|null|undefined} slothlet - The instance.
 * @returns {{remaining: number}} The budget.
 * @private
 */
const searchBudget = (slothlet) => ({ remaining: slothlet?.config?.permissions?.search?.properties ?? DEFAULT_SEARCH_PROPERTIES });

/**
 * What a module's code hands out, as whoever receives it gets it (#597): code the module made — a function, a
 * Proxy, a generator, and any object holding code — comes as a stand-in that runs it as the module (see
 * {@link runtime_runAsMaker}); a value handed to the module from outside, plain data, the language's own objects and
 * slothlet's own values come as they are. The same value from the same module is the same stand-in every time.
 * Nothing of the value runs to decide.
 * @param {object} maker - The module's record (see {@link runtime_makerOf}).
 * @param {object} owner - The wrapper a new stand-in runs as.
 * @param {*} value - The value.
 * @returns {*} What is handed out.
 * @private
 */
function runtime_handOut(maker, owner, value) {
	/**
	 * Whether a value is a promise of the engine's own, with nothing of a module's on it: its prototype is the
	 * intrinsic one and it has no members of its own that reading what it settles to could reach, so that read runs none
	 * of a module's code. Members under symbols of no registry and none of the language's are left out: `then` reads none
	 * of them, its stand-in carries none of them, and Node keeps its own there on every promise made while an
	 * `AsyncLocalStorage` runs on async hooks (Node 22's async ids and stores).
	 * @param {object} value - An object that is not a Proxy.
	 * @returns {boolean} True for such a promise.
	 * @private
	 */
	function runtime_isPlainPromise(value) {
		if (!util.types.isPromise(value) || Reflect.getPrototypeOf(value) !== Promise.prototype) return false;
		for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (typeof key !== "symbol" || Symbols.keyFor(key) !== undefined || SetMethods.has(WELL_KNOWN_SYMBOLS, key)) return false;
		}
		return true;
	}

	/**
	 * Whether plain data a module hands out holds a node's own function, or a module's copy of one (see
	 * {@link runtime_gateLeafCopy}), within the bounds given: plain objects and arrays are looked into, by their
	 * descriptors, so nothing of the data runs. Only while the instance's permission system is on: otherwise no call is
	 * refused, and the data passes as itself.
	 * @param {object} slothlet - The instance.
	 * @param {object} value - The data.
	 * @param {number} depth - Levels still allowed, this one included.
	 * @param {{remaining: number}} budget - Properties still allowed.
	 * @returns {boolean} True when it holds such a function.
	 * @private
	 */
	function runtime_dataHoldsLeafFunction(slothlet, value, depth, budget) {
		if (depth <= 0 || !slothlet?.handlers?.permissionManager?.isEnabled?.()) return false;
		try {
			if (util.types.isProxy(value)) return false;
			const prototype = Reflect.getPrototypeOf(value);
			if (prototype !== null && prototype !== Objects.prototype && prototype !== Arrays.prototype) return false;
			if (Arrays.isArray(value) && value.length > budget.remaining) return false;
			const keys = Reflect.ownKeys(value);
			budget.remaining -= keys.length;
			if (budget.remaining < 0) return false;
			for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
				const descriptor = Reflect.getOwnPropertyDescriptor(value, ofList[ofIndex]);
				if (!descriptor || !("value" in descriptor)) continue;
				const member = descriptor.value;
				if (typeof member === "function") {
					if (util.types.isProxy(member)) continue;
					const leaf = WeakMapMethods.get(trustedRootOwn.implWrappers, member);
					if (
						(leaf && WeakSetMethods.has(trustedRootOwn.genuineWrappers, leaf) && leaf.slothlet === slothlet) ||
						leafOfCopy(slothlet, member) !== null
					)
						return true;
					continue;
				}
				if (member !== null && typeof member === "object" && runtime_dataHoldsLeafFunction(slothlet, member, depth - 1, budget))
					return true;
			}
		} catch {
			// Data that refuses to be described is handed out as it is.
		}
		return false;
	}

	/**
	 * The stand-in of a generator or async generator object a module made (#597): a generator of the same kind with the
	 * same prototype — so its steps are the intrinsic `next`, `return` and `throw` — delegating each step to the
	 * original, run as the module. The original is not changed, so one that cannot be extended is handled alike.
	 * @param {object} maker - The module's record.
	 * @param {object} owner - The wrapper it runs as.
	 * @param {object} original - The generator object.
	 * @returns {object} The stand-in, the same one for the same generator and module every time.
	 * @private
	 */
	function runtime_generatorStandIn(maker, owner, original) {
		const existing = WeakMapMethods.get(maker.made, original);
		if (existing) return existing;
		const isAsync = FunctionMethods.call(PrototypeFunctions.Object.isPrototypeOf, GENERATOR_PROTOTYPES.asyncGenerator, original);
		const steps = isAsync ? GENERATOR_PROTOTYPES.asyncGenerator : GENERATOR_PROTOTYPES.generator;
		// A step's result is no one's value (R3-D17): the step runs as the module and the value in it is handed out as the
		// module's, while the `{ value, done }` around it is a plain result, as the engine makes one (#758). An async step's
		// promise settles to such a result.
		const step = (name) => (value) => {
			const box = { step: false, done: false };
			const take = (result) => {
				box.step = runtime_isStepResult(result);
				if (!box.step) return result;
				box.done = result.done;
				return result.value;
			};
			const handed = runtime_runAsMaker(
				owner,
				(input) => {
					const result = Reflect.apply(steps[name], original, [input]);
					return isAsync ? Reflect.apply(SLOT_READERS.then, result, [take]) : take(result);
				},
				undefined,
				[runtime_handIn(maker, value)]
			);
			const wrap = (given) => (box.step ? { value: given, done: box.done } : given);
			return isAsync ? Reflect.apply(SLOT_READERS.then, handed, [wrap]) : wrap(handed);
		};
		const driver = { next: step("next"), return: step("return"), throw: step("throw") };
		driver[isAsync ? Symbol.asyncIterator : Symbol.iterator] = () => driver;
		const standIn = isAsync
			? (async function* () {
					return yield* driver;
				})()
			: (function* () {
					return yield* driver;
				})();
		Reflect.setPrototypeOf(standIn, Reflect.getPrototypeOf(original));
		if (Objects.isFrozen(original)) Objects.freeze(standIn);
		else if (Objects.isSealed(original)) Objects.seal(standIn);
		else if (!Objects.isExtensible(original)) Objects.preventExtensions(standIn);
		WeakMapMethods.set(maker.made, original, standIn);
		WeakMapMethods.set(STAND_IN_RECORDS, standIn, { maker, owner, original });
		return standIn;
	}

	/**
	 * The stand-in of a promise a module made (#597): a promise settling as it does, with what it settles to — a value or
	 * a rejection — handed out as the module's (see {@link runtime_handOut}). A promise of a module's own class, or with
	 * members of its own, is the module's code and is handed out as any other object is.
	 * @param {object} maker - The module's record.
	 * @param {object} owner - The wrapper it runs as.
	 * @param {Promise} original - The promise.
	 * @returns {Promise} The stand-in, the same one for the same promise and module every time.
	 * @private
	 */
	function runtime_promiseStandIn(maker, owner, original) {
		const existing = WeakMapMethods.get(maker.made, original);
		if (existing) return existing;
		const standIn = new Promise((resolve, reject) => {
			Reflect.apply(SLOT_READERS.then, original, [
				(value) => resolve(runtime_handOut(maker, owner, value)),
				(reason) => reject(runtime_handOut(maker, owner, reason))
			]);
		});
		WeakMapMethods.set(maker.made, original, standIn);
		WeakMapMethods.set(STAND_IN_RECORDS, standIn, { maker, owner, original });
		return standIn;
	}

	/**
	 * Where the stand-ins a leaf makes of functions another leaf of its module handed out first are kept (#726), or null
	 * when the stand-in already made is the one to hand out: the value is not a plain function, the same leaf made it, it
	 * is a leaf's own function (which runs as that leaf whoever hands it out), it was not made as a stand-in, or it is
	 * written in a leaf's file (its frames name its definer when it runs, so one stand-in serves every leaf, and a class
	 * or closure two leaves return stays one value). What is left is code the stack cannot place on a leaf, a helper
	 * file's own function above all: each leaf handing it out gets a stand-in recording that leaf.
	 * @param {object} maker - The module's record.
	 * @param {object} owner - The wrapper handing the value out.
	 * @param {*} value - The value.
	 * @param {object} made - The stand-in the module made of it first.
	 * @returns {WeakMap<object, object>|null} The leaf's own stand-ins by original, or null.
	 * @private
	 */
	function runtime_ownStandIns(maker, owner, value, made) {
		if (typeof value !== "function" || util.types.isProxy(value) || WeakMapMethods.has(trustedRootOwn.implWrappers, value)) return null;
		const record = WeakMapMethods.get(STAND_IN_RECORDS, made);
		if (!record || record.maker !== maker || record.original !== value || record.owner === owner) return null;
		if (isLeafFileFunction(value, [record.owner, owner])) return null;
		maker.madeBy ??= new WeakMap();
		let own = WeakMapMethods.get(maker.madeBy, owner);
		if (!own) WeakMapMethods.set(maker.madeBy, owner, (own = new WeakMap()));
		return own;
	}

	/**
	 * {@link runtime_handOut} for an object or function, without noting where its stand-in goes.
	 * @param {object} maker - The module's record.
	 * @param {object} owner - The wrapper a new stand-in runs as.
	 * @param {object|Function} value - The value.
	 * @returns {*} What is handed out.
	 * @private
	 */
	function runtime_handOutValue(maker, owner, value) {
		const inbound = WeakMapMethods.get(INBOUND_VIEWS, value);
		if (inbound) return inbound.original;
		// A crossing view the module was handed is another module's value: handed on as it is, decided for whoever it
		// reaches.
		if (WeakMapMethods.has(CROSSINGS, value)) return value;
		// A view handed out for a holder not known yet is slothlet's, decided for the holder it reaches (#667).
		const handedRecord = WeakMapMethods.get(SELF_MEMBER_VIEWS, value);
		if (handedRecord?.reader === SEALED_SHELL_READER || handedRecord?.reader === PROTOTYPE_HANDLE_READER) return value;
		// A prototype of a module's class, however the module holds it, is handed out for a holder not known yet: a view
		// deciding each write when it is made, which a holder reading it through `self` gets as reading it would (#667).
		const prototype = typeof value === "object" ? runtime_prototypeHandedTo(value, SEALED_SHELL_READER, owner.slothlet) : value;
		if (prototype !== value) return prototype;
		if (
			runtime_isSlothletValue(value) ||
			WeakSetMethods.has(INTRINSICS, value) ||
			runtime_isSharedValue(value) ||
			WeakSetMethods.has(maker.handedIn, value)
		)
			return value;
		// A prototype of a class the module exports is handed out as it is (#597).
		if (WeakSetMethods.has(maker.exposed, value)) return value;
		// A class instance a method got as its receiver stands for its node (#625): it comes back as it is, so a view
		// hands it to the reader as the node, whose own write rule holds.
		if (WeakMapMethods.has(SELF_INSTANCE_NODES, value)) return value;
		const made = WeakMapMethods.get(maker.made, value);
		// A function a leaf hands out records that leaf (#726): when another leaf of the module hands the same function out,
		// it gets a stand-in of its own, so code the stack cannot place on a leaf (a helper file's own function) runs as
		// the leaf that handed it out, each time.
		const own = made ? runtime_ownStandIns(maker, owner, value, made) : null;
		if (made && !own) return made;
		try {
			if (own) {
				const mine = WeakMapMethods.get(own, value);
				if (mine) return mine;
				if (util.types.isGeneratorFunction(value) || util.types.isAsyncFunction(value))
					return runtime_kindStandIn(maker, owner, value, own);
				return runtime_membrane(maker, owner, value, false, own);
			}
			if (util.types.isProxy(value)) return runtime_isModuleProxy(value) ? runtime_membrane(maker, owner, value) : value;
			if (typeof value === "function") {
				// The live runtime's `then` over the engine's is the engine's, as a built-in is.
				if (isFrameworkInternal(value) || runtime_isBuiltinFunction(value) || engineThenOf(value)) return value;
				// A leaf's own function is its module's and runs as that leaf, whichever module handed it out.
				const leaf = WeakMapMethods.get(trustedRootOwn.implWrappers, value);
				// Handed out as it is, it is that leaf's node: running it is a call of the node, which whoever runs it has
				// to be allowed, and it runs with the leaf's rights, as it does when the node is read from `self` (#726).
				// The node's rules decide its function however it is reached: a module that imports the leaf's file itself
				// holds a copy of the function, whose stand-in below is checked as a call of the node each time it runs (see
				// runtime_gateLeafCopy).
				const node =
					leaf && WeakSetMethods.has(trustedRootOwn.genuineWrappers, leaf) && leaf.slothlet === owner.slothlet
						? leaf.____slothletInternal.proxy
						: null;
				if (node && typeof node === "function") return node;
				const leafMaker = leaf ? runtime_makerOf(leaf) : maker;
				if (leafMaker !== maker && WeakMapMethods.has(leafMaker.made, value)) return WeakMapMethods.get(leafMaker.made, value);
				if (util.types.isGeneratorFunction(value) || util.types.isAsyncFunction(value))
					return runtime_kindStandIn(leafMaker, leaf ?? owner, value);
				return runtime_membrane(leafMaker, leaf ?? owner, value);
			}
			if (util.types.isGeneratorObject(value)) return runtime_generatorStandIn(maker, owner, value);
			if (runtime_isPlainPromise(value)) return runtime_promiseStandIn(maker, owner, value);
			// Only a value that is itself code is a stand-in: data — plain objects and arrays, the language's and Node's own
			// objects — passes as itself however deep it nests, unsearched, and code nested in it is told by its frames when
			// it runs (#726).
			if (owner.slothlet?.config?.permissions?.caller?.provenance !== false) {
				if (!runtime_isCodeObject(value)) {
					// Data holding a node's own function, or a module's copy of it, is handed out as a view, so a call of the
					// function read from it is the node's call (see runtime_gateLeafCopy) and not a call of the bare function.
					if (!runtime_dataHoldsLeafFunction(owner.slothlet, value, searchDepth(owner.slothlet), searchBudget(owner.slothlet)))
						return value;
				}
				return runtime_membrane(maker, owner, value);
			}
			// With `provenance` off no frames are read, so nothing would tell code nested in data from its caller's: the
			// value is searched instead, as far as the code search reaches, and one holding code is handed out as the module's.
			if (!runtime_holdsCode(value, searchDepth(owner.slothlet), searchBudget(owner.slothlet))) return value;
			return runtime_membrane(maker, owner, value);
		} catch {
			// A value that refuses to be described is handed out as it is.
			return value;
		}
	}

	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	runtime_noteMoved(value);
	const handed = runtime_handOutValue(maker, owner, value);
	if (handed !== value) runtime_noteMoved(handed);
	return handed;
}

/**
 * What a module's call hands its caller (#597): see {@link runtime_handOut}. A prototype of a module's class returned
 * to the host is the object itself, as the host reading it gets it (#667): the call's caller receives the value, and
 * here it is known.
 * @param {object} owner - The wrapper whose call returned the value.
 * @param {*} value - What the call returned.
 * @param {boolean} [callerIsHost=false] - Whether the host made the call.
 * @param {object|null} [caller=null] - The wrapper of the module that made the call, when one did.
 * @param {object|null} [receiver=null] - The call whose own code receives the value, when that call was handed code
 *   (see `ownReceiver`): a function stand-in made for it here is recorded as handed to that call alone.
 * @returns {*} What the caller gets.
 * @private
 */
function runtime_attributeResult(owner, value, callerIsHost = false, caller = null, receiver = null) {
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
	 * {@link runtime_attributeResult} once the receiver is set.
	 * @param {object} owner - The wrapper whose call returned the value.
	 * @param {object|Function} value - What the call returned.
	 * @param {boolean} callerIsHost - Whether the host made the call.
	 * @param {object|null} caller - The wrapper of the module that made the call, when one did.
	 * @returns {*} What the caller gets.
	 * @private
	 */
	function runtime_attributeResultTo(owner, value, callerIsHost, caller) {
		if (callerIsHost && typeof value === "object") {
			const behind = runtime_behindMemberView(value);
			if (runtime_knownPrototype(owner.slothlet, behind) !== undefined) return behind;
		}
		const toModule = !callerIsHost && Boolean(caller?.____slothletInternal);
		// A crossing view the module was handed and hands back stands for another module's value: the host gets that value,
		// a module gets it as the guard decides for it.
		if (WeakMapMethods.has(CROSSINGS, value))
			return toModule ? runtime_crossTo(value, caller, owner.slothlet, owner) : runtime_uncross(value);
		let handed = value;
		if (!handsOutAsModule(owner)) {
			if (!runtime_permissionsOn(owner)) return value;
			// `"fast"` wraps nothing it hands out, but a node's own Proxy export handed back is still that node's member, run
			// as a call of the node, as under `"precise"` (#726).
			if (util.types.isProxy(value)) handed = WeakMapMethods.get(runtime_makerOf(owner).made, value) ?? value;
			// An instance whose `constructor` is a function an api node stands for, whose members the rules could refuse the
			// module it reaches, is the module's, as under `"precise"`: its `constructor` is then that node.
			else if (toModule && typeof value === "object" && runtime_instanceReadMayRefuse(owner.slothlet, caller, value))
				handed = runtime_handOut(runtime_makerOf(owner), owner, value);
		} else handed = runtime_handOut(runtime_makerOf(owner), owner, value);
		// What a module's call hands another module, a stand-in of its code included, reaches it through the class prototype
		// guard.
		if (toModule) return runtime_crossTo(handed, caller, owner.slothlet, owner);
		// The host holds it as it is; where it came from is kept for when the host hands it on.
		if (runtime_permissionsOn(owner) && !WeakMapMethods.has(HOST_HANDED, handed) && !runtime_isShared(handed)) {
			WeakMapMethods.set(HOST_HANDED, handed, owner);
			// The value a stand-in stands for is what the module itself holds once the host hands the stand-in back to it.
			if (handed !== value && !WeakMapMethods.has(HOST_HANDED, value) && !runtime_isShared(value))
				WeakMapMethods.set(HOST_HANDED, value, owner);
		}
		return handed;
	}

	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	if (!owner?.slothlet?.instanceID || !owner.slothlet.contextManager?.runInContext) return value;
	const previous = handOutReceiver;
	handOutReceiver = !callerIsHost && caller?.____slothletInternal ? receiver : null;
	try {
		runtime_noteMoved(value);
		return runtime_attributeResultTo(owner, value, callerIsHost, caller);
	} finally {
		handOutReceiver = previous;
	}
}

/**
 * What a module is handed (#597): a stand-in of its own value comes back as the value itself, as in plain
 * JavaScript; a caller's plain array or object holding such stand-ins comes as a view showing them as the module's
 * values (see {@link runtime_inboundView}); anything else as it is, recorded as handed to the module, so the module
 * handing it back hands back the very value.
 * @param {object} maker - The module's record.
 * @param {*} value - The value.
 * @param {object} [owner] - The wrapper of the module's leaf it is handed to.
 * @returns {*} What the module gets.
 * @private
 */
function runtime_handIn(maker, value, owner = maker.owner) {
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

	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	// A crossing view handed in stands for a value: this module's own comes back as itself, another module's stays a
	// view, decided for this module.
	const crossing = WeakMapMethods.get(CROSSINGS, value);
	if (crossing) {
		const behind = crossing.original;
		const own = WeakMapMethods.get(STAND_IN_RECORDS, behind) ?? WeakMapMethods.get(INBOUND_VIEWS, behind);
		if (own?.maker === maker) return own.original;
		if (WeakMapMethods.has(maker.made, behind)) return behind;
		runtime_noteMoved(value);
		return runtime_crossTo(value, owner, crossing.slothlet, crossing.from);
	}
	const record = WeakMapMethods.get(STAND_IN_RECORDS, value) ?? WeakMapMethods.get(INBOUND_VIEWS, value);
	// Back with the module that made it (a method's receiver, say), a stand-in is its value again: it went nowhere new.
	if (record?.maker === maker) return record.original;
	runtime_noteMoved(value);
	if (record) return value;
	if (runtime_isSlothletValue(value) || WeakSetMethods.has(INTRINSICS, value)) return value;
	if (WeakMapMethods.has(maker.made, value)) return value;
	// A node's own function, or a module's copy of it, reaches another module as a call of the node.
	if (typeof value === "function") {
		const asNode = runtime_leafFunctionHandedIn(maker, owner, value);
		if (asNode !== null) return asNode;
	}
	// A prototype of a module's, or plain data holding one, reaches this one as reading it would (#667).
	const carried = runtime_carryTo(value, owner, owner?.slothlet ?? null);
	if (carried !== value) return carried;
	WeakSetMethods.add(maker.handedIn, value);
	return runtime_inboundView(maker, value, owner);
}

/**
 * Hand a list of arguments to a module (see {@link runtime_handIn}).
 * @param {object} maker - The module's record.
 * @param {ArrayLike<*>} args - The arguments.
 * @param {object} [owner] - The wrapper of the module's leaf they are handed to.
 * @returns {Array<*>|ArrayLike<*>} The arguments, the same list when nothing changed.
 * @private
 */
function runtime_handInAll(maker, args, owner = maker.owner) {
	let result = args;
	const count = args?.length ?? 0;
	for (let index = 0; index < count; index++) {
		const value = args[index];
		const handed = runtime_handIn(maker, value, owner);
		if (handed === value) continue;
		if (result === args) result = copyList(args);
		result[index] = handed;
	}
	return result;
}

/**
 * The views made of each module's inbound values, so the same value is the same view.
 * @type {WeakMap<object, WeakMap<object, object>>}
 * @private
 */
const INBOUND_BY_MAKER = new WeakMap();

/**
 * A caller's plain array or object handed to a module, as the module sees it (#597): when it holds a stand-in of the
 * module's own value, a view of it reading each such stand-in as the value itself (`list.includes(own)`), and
 * writing what the module puts in it as the module hands it out. Anything else is the value itself. A member the
 * value holds fixed is read as it is.
 * @param {object} maker - The module's record.
 * @param {object|Function} value - The value.
 * @param {object} [owner] - The wrapper of the module's leaf it is handed to.
 * @returns {object|Function} What the module gets.
 * @private
 */
function runtime_inboundView(maker, value, owner = maker.owner) {
	/**
	 * Whether a caller's plain array or object holds a stand-in of the module's own, within the code search ({@link searchDepth}).
	 * @param {object} maker - The module's record.
	 * @param {object} value - The value.
	 * @param {number} depth - Levels still allowed.
	 * @param {{remaining: number}} budget - Properties still allowed.
	 * @returns {boolean} True when it does.
	 * @private
	 */
	function runtime_holdsOwnStandIn(maker, value, depth, budget) {
		if (depth <= 0 || util.types.isProxy(value)) return false;
		const prototype = Reflect.getPrototypeOf(value);
		if (prototype !== Objects.prototype && prototype !== Arrays.prototype && prototype !== null) return false;
		if (Arrays.isArray(value) && value.length > budget.remaining) return false;
		const keys = Reflect.ownKeys(value);
		budget.remaining -= keys.length;
		if (budget.remaining < 0) return false;
		for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			const member = Reflect.getOwnPropertyDescriptor(value, key)?.value;
			if (member === null || (typeof member !== "object" && typeof member !== "function")) continue;
			if (WeakMapMethods.get(STAND_IN_RECORDS, member)?.maker === maker) return true;
			if (typeof member === "object" && runtime_holdsOwnStandIn(maker, member, depth - 1, budget)) return true;
		}
		return false;
	}

	if (typeof value !== "object") return value;
	let views = WeakMapMethods.get(INBOUND_BY_MAKER, maker);
	const existing = views == null ? undefined : WeakMapMethods.get(views, value);
	if (existing) return existing;
	try {
		if (!runtime_holdsOwnStandIn(maker, value, searchDepth(owner?.slothlet), searchBudget(owner?.slothlet))) return value;
	} catch {
		return value;
	}
	const fixed = (target, prop) => Reflect.getOwnPropertyDescriptor(target, prop)?.configurable === false;
	const inward = (target, prop, member) => (fixed(target, prop) ? member : runtime_handIn(maker, member));
	const view = new NativeProxy(value, {
		get: (target, prop, receiver) => inward(target, prop, Reflect.get(target, prop, receiver === view ? target : receiver)),
		set: (target, prop, next, receiver) =>
			Reflect.set(target, prop, runtime_handOut(maker, runtime_runningLeafOf(maker, owner), next), receiver === view ? target : receiver),
		getOwnPropertyDescriptor: (target, prop) => {
			const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
			if (!descriptor || !("value" in descriptor) || !descriptor.configurable) return descriptor;
			return { __proto__: null, ...descriptor, value: runtime_handIn(maker, descriptor.value) };
		},
		defineProperty: (target, prop, descriptor) =>
			Reflect.defineProperty(
				target,
				prop,
				"value" in descriptor
					? { __proto__: null, ...descriptor, value: runtime_handOut(maker, runtime_runningLeafOf(maker, owner), descriptor.value) }
					: descriptor
			)
	});
	if (!views) WeakMapMethods.set(INBOUND_BY_MAKER, maker, (views = new WeakMap()));
	WeakMapMethods.set(views, value, view);
	WeakMapMethods.set(INBOUND_VIEWS, view, { maker, original: value });
	return view;
}

/**
 * Functions standing in for an original's `toString`, so a stand-in's source reads as its original's.
 * @type {WeakMap<object, Function>}
 * @private
 */
const SOURCES = new WeakMap();

/**
 * The stand-in of a module's function, Proxy or object holding code (#597): the value itself to every reflection,
 * a membrane whose code runs as the module that made it (see {@link runtime_runAsMaker}) whoever runs it. Calling
 * or constructing it runs the original as the module; reading a member runs the module's getter as the module and
 * hands the member out as the module's (see {@link runtime_handOut}), so a function in a returned object, a getter,
 * a `then`, an iterator, a static method, a prototype's method are all the module's; a module's own Proxy has every
 * trap run as the module. What is handed in through it — arguments, a receiver, a value written — is handed to the
 * module (see {@link runtime_handIn}).
 *
 * The Proxy is built over a shadow, kept in step with the original for what the language fixes (a member that
 * cannot be reconfigured, an object that cannot be extended), so a member the original holds fixed is still handed
 * out as the module's.
 * @param {object} maker - The module's record.
 * @param {object} owner - The wrapper it runs as.
 * @param {Function|object} original - The value.
 * @param {boolean} [asNode=false] - Run its code as a call of its node, under no ceiling of its caller (#726).
 * @param {WeakMap<object, object>} [made=maker.made] - Where the stand-in is kept: the module's, or a leaf's own (see
 *   {@link runtime_ownStandIns}).
 * @returns {Function|object} The stand-in, the same one for the same value and module every time.
 * @private
 */
function runtime_membrane(maker, owner, original, asNode = false, made = maker.made) {
	// A node's own value (a Proxy export) is checked as a call of its node, so it runs as one: under no ceiling of its
	// caller's. A value handed out runs under whoever runs it (#726).
	const runAs = (who, fn, thisArg = undefined, args = [], attribute = true) =>
		runtime_runAsMaker(who, fn, thisArg, args, attribute, asNode);
	const existing = WeakMapMethods.get(made, original);
	if (existing) return existing;
	const isProxy = util.types.isProxy(original);
	const isFunction = typeof original === "function";
	// An object with internal slots carrying the module's code (see runtime_slotHoldsCode), or one of the language's own
	// iterators: the engine's own methods it is read for work on its slots, so they run on the object itself, not on its
	// stand-in.
	const isSlot = !isProxy && !isFunction && (runtime_isSlotObject(original) || runtime_isNativeIterator(original));
	// A compiled script of the module's: what its methods run is the module's code.
	const isScript =
		!isProxy &&
		!isFunction &&
		((VM_SCRIPT !== null && runtime_inherits(original, VM_SCRIPT)) ||
			(VM_NATIVE_SCRIPT !== null && runtime_inherits(original, VM_NATIVE_SCRIPT)));
	/**
	 * The engine's methods as read from the stand-in, the same each read.
	 * @type {WeakMap<Function, Function>}
	 */
	const slotMethods = !isProxy && !isFunction ? new WeakMap() : null;
	/**
	 * An argument of an engine method that calls back with what the object holds (see SLOT_CALLBACK_METHODS), handed
	 * to the object: a callback gets each of those values handed out as the module's, and the object as its stand-in.
	 */
	const slotArgument = (arg) => {
		if (typeof arg !== "function") return runtime_handIn(maker, arg);
		return function (...values) {
			return Reflect.apply(
				arg,
				this,
				mapList(values, (item) => (item === original ? standIn : out(item)))
			);
		};
	};
	/**
	 * An engine method read from a slot object's stand-in, or a native binding's method read from any object's stand-in
	 * (#708): one called on the stand-in runs on the object, which native code needs as its receiver, and what it
	 * returns (a `Map`'s value, a `WeakRef`'s target, an iterator) is handed out as the module's.
	 */
	const slotMethod = (value, holder) => {
		if (slotMethods === null || typeof value !== "function" || util.types.isProxy(value)) return value;
		// The live runtime's `then`, installed over the engine's, is the engine's `then` with its reactions pinned.
		const engine = engineThenOf(value) ?? value;
		if (!(isSlot || isScript)) {
			// Any other object: only a binding's method, which reads nothing of the object a module's code could run in.
			if (!runtime_isBindingMethod(engine, holder)) return value;
		}
		// A script's methods are Node's own, written in JavaScript.
		else if (!runtime_isBuiltinFunction(engine) && !(isScript && isSharedExport(engine))) return value;
		let method = WeakMapMethods.get(slotMethods, value);
		if (!method) {
			const name = engine.name;
			method = {
				[name](...args) {
					if (this !== standIn) return Reflect.apply(value, this, args);
					if (isScript) return runAs(owner, value, original, runtime_handInAll(maker, args));
					const callsBack = SetMethods.has(SLOT_CALLBACK_METHODS, engine);
					return out(
						Reflect.apply(
							value,
							original,
							mapList(args, (arg) => (callsBack ? slotArgument(arg) : runtime_handIn(maker, arg)))
						)
					);
				}
			}[name];
			WeakMapMethods.set(slotMethods, value, method);
		}
		return method;
	};
	const shadow = isFunction
		? runtime_isConstructor(original)
			? FunctionMethods.bind(function () {}, null)
			: () => {}
		: Arrays.isArray(original)
			? []
			: {};
	let standIn = null;
	// Operations on a module's Proxy already running as the module: one reached again while entering the module (its
	// node reading the Proxy's `default`) runs as it is, already the module's.
	let running = 0;
	/** Run an operation on a module's Proxy as the module, whose traps are its code. */
	const asMaker = (operation, attribute) => {
		if (running > 0) return attribute ? out(operation()) : operation();
		running++;
		try {
			return runAs(owner, operation, undefined, [], attribute);
		} finally {
			running--;
		}
	};
	/** Run an operation on the original: as the module for its own Proxy. */
	const exec = isProxy ? (operation) => asMaker(operation, false) : (operation) => operation();
	const out = (value) => runtime_handOut(maker, owner, value);
	/**
	 * This object's own stand-ins of the methods read through it (D1), made when first read.
	 * @type {WeakMap<Function, Function>|null}
	 */
	let methods = null;
	/**
	 * A function read through this object's stand-in: when it would be handed out as a stand-in of its own, the object's
	 * own stand-in of it, which records the object (see runtime_callOrigin). Only a method (a function with no
	 * `prototype` of its own, or a generator) is: a class, a constructor function and the `constructor` member keep the
	 * stand-in every holder shares, as do the members of a node's value, a function and a Proxy.
	 */
	const memberOut = (value, prop) => {
		const shared = out(value);
		if (isFunction || isProxy || asNode || prop === "constructor" || typeof value !== "function" || typeof shared !== "function")
			return shared;
		// Read by descriptor from a function that is not a Proxy: nothing of the module's runs.
		if (util.types.isProxy(value) || (Objects.hasOwn(value, "prototype") && !util.types.isGeneratorFunction(value))) return shared;
		const record = WeakMapMethods.get(STAND_IN_RECORDS, shared);
		if (record?.original !== value || WeakMapMethods.has(METHOD_RECEIVERS, shared)) return shared;
		methods ??= new WeakMap();
		const existing = WeakMapMethods.get(methods, value);
		if (existing) return existing;
		const own =
			util.types.isGeneratorFunction(value) || util.types.isAsyncFunction(value)
				? runtime_kindStandIn(record.maker, record.owner, value, methods)
				: runtime_membrane(record.maker, record.owner, value, false, methods);
		WeakMapMethods.set(METHOD_RECEIVERS, own, { instance: original, holder: standIn });
		return own;
	};
	/** The receiver a reflection is made through: the stand-in or another of the module's is the value behind it. */
	const receiverOf = (receiver) => (receiver === standIn ? original : runtime_handIn(maker, receiver));
	/**
	 * The class a prototype is the `prototype` of, read by descriptors alone, or null.
	 * @param {object} prototype - An object that is not a Proxy.
	 * @returns {Function|null} The class.
	 */
	const classOf = (prototype) => {
		const constructor = Reflect.getOwnPropertyDescriptor(prototype, "constructor")?.value;
		return typeof constructor === "function" && Reflect.getOwnPropertyDescriptor(constructor, "prototype")?.value === prototype
			? constructor
			: null;
	};
	/**
	 * A prototype as the stand-in reports it: a class's prototype is its own object unless the module handed the class
	 * itself out — so an instance stays an `instanceof` the class whoever holds the class as it is (one imported from
	 * its file, one an api node exports) — and any other prototype is handed out as the module's.
	 * @param {object|null} prototype - The original's prototype.
	 * @param {object} [reader=SEALED_SHELL_READER] - Who it is reported to: the code asking for it, so it gets what reading
	 *   the class's `prototype` gives it, or a holder not known yet (the closed shell's prototype).
	 */
	const prototypeOut = (prototype, reader = SEALED_SHELL_READER) => {
		if (prototype === null || typeof prototype !== "object" || util.types.isProxy(prototype)) return out(prototype);
		const owned = classOf(prototype);
		// While the permission system is on, it is checked for whoever writes through it (the class prototype guard).
		if (!owned || WeakMapMethods.has(maker.made, owned)) return runtime_atClassSite(owner.slothlet, out(prototype));
		// One handed to the module (a subclass's, constructed for) is not the module's. An instance reports one prototype:
		// the handle at its class's own name (#667), as an instance a node holds does.
		if (WeakSetMethods.has(maker.handedIn, prototype)) return prototype;
		// The prototype of a class a node exports is what reading the class's `prototype` gives the code asking, decided
		// for that file: another file of the module may be refused what the class holds (a deny on its member).
		if (runtime_knownPrototype(owner.slothlet, prototype) !== undefined)
			return runtime_atClassSite(owner.slothlet, runtime_prototypeHandedTo(prototype, reader, owner.slothlet));
		return runtime_atClassSite(owner.slothlet, runtime_crossTo(prototype, reader, owner.slothlet, owner));
	};
	/** A descriptor of the original's, as the stand-in reports it. */
	const reported = (descriptor, holderIsMade = true) => {
		if (!descriptor) return descriptor;
		const result = { ...descriptor };
		if ("value" in descriptor) result.value = holderIsMade ? out(descriptor.value) : descriptor.value;
		else {
			if ("get" in descriptor) result.get = holderIsMade ? out(descriptor.get) : descriptor.get;
			if ("set" in descriptor) result.set = holderIsMade ? out(descriptor.set) : descriptor.set;
		}
		return result;
	};
	/** Keep the shadow's copy of a member in step with the original, where the language fixes what is reported. */
	const sync = (prop, descriptor) => {
		const held = Reflect.getOwnPropertyDescriptor(shadow, prop);
		if (!descriptor) {
			if (held?.configurable) Reflect.deleteProperty(shadow, prop);
			return;
		}
		if (!descriptor.configurable || !Reflect.isExtensible(shadow) || held) Reflect.defineProperty(shadow, prop, descriptor);
	};
	/** Make the shadow match an original that cannot be extended, member for member. */
	const settle = () => {
		const keys = exec(() => Reflect.ownKeys(original));
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			const descriptor = reported(exec(() => Reflect.getOwnPropertyDescriptor(original, key)));
			if (descriptor) Reflect.defineProperty(shadow, key, descriptor);
		}
		for (let ofIndex = 0, ofList = Reflect.ownKeys(shadow); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (!(typeof keys === "string" ? StringMethods.includes(keys, key) : ArrayMethods.includes(keys, key)))
				Reflect.deleteProperty(shadow, key);
		}
		if (!Reflect.isExtensible(shadow)) return;
		Reflect.setPrototypeOf(shadow, prototypeOut(exec(() => Reflect.getPrototypeOf(original))));
		Reflect.preventExtensions(shadow);
	};
	/** A member's value as the shadow holds it, where the language fixes it. */
	const fixedValue = (prop, value) => {
		const held = Reflect.getOwnPropertyDescriptor(shadow, prop);
		if (!held || held.configurable) return value;
		if ("value" in held) return held.writable ? value : held.value;
		return held.get === undefined ? undefined : value;
	};
	/**
	 * A member read from an ordinary original, its holder found by descriptors alone. A native binding's method comes
	 * back as one that runs on the original (see slotMethod), told apart by the holder it was found on, whether or not
	 * that holder was handed to the module (#708).
	 */
	const read = (prop, receiver) => {
		for (let holder = original, depth = 0; holder !== null && holder !== undefined && depth < 64; depth++) {
			if (util.types.isProxy(holder)) {
				if (!runtime_isModuleProxy(holder)) return Reflect.get(holder, prop, receiver);
				return runAs(owner, () => Reflect.get(holder, prop, receiver));
			}
			const descriptor = Reflect.getOwnPropertyDescriptor(holder, prop);
			if (descriptor) {
				// A member of a value handed to the module from outside (a subclass's prototype) is not the module's.
				const holderIsMade = holder === original || !WeakSetMethods.has(maker.handedIn, holder);
				if (!("value" in descriptor)) {
					if (typeof descriptor.get !== "function") return undefined;
					if (!holderIsMade || runtime_isBuiltinFunction(descriptor.get)) {
						const value = Reflect.apply(descriptor.get, receiver, []);
						return holderIsMade ? out(value) : value;
					}
					// A getter read on this object answers for it as its methods do (see runtime_callOrigin).
					return runtime_runAsMaker(
						owner,
						descriptor.get,
						receiver,
						[],
						true,
						asNode,
						receiver === original ? runtime_originOf(standIn) : null
					);
				}
				const value = descriptor.value;
				// A native binding's method needs the object itself as its receiver, whether or not its holder was handed in (#708).
				if (!isSlot && !isScript && typeof value === "function" && runtime_isBindingMethod(value, holder)) return slotMethod(value, holder);
				if (!holderIsMade) return value;
				// A class's `constructor` is the class as it is unless the module handed the class out (see prototypeOut).
				// One an api node stands for is that node, whose members are read under its own rules.
				if (prop === "constructor" && typeof value === "function" && classOf(holder) === value && !WeakMapMethods.has(maker.made, value))
					return runtime_frontingNodeNow(owner.slothlet, value) ?? runtime_crossTo(value, SEALED_SHELL_READER, owner.slothlet, owner);
				if ((value === functionToString || isFunctionSourcePatch(value)) && isFunction) {
					let source = WeakMapMethods.get(SOURCES, original);
					if (!source) {
						source = { toString: () => functionSource(original) }.toString;
						WeakMapMethods.set(SOURCES, original, source);
					}
					return source;
				}
				return memberOut(value, prop);
			}
			holder = Reflect.getPrototypeOf(holder);
		}
		return undefined;
	};
	/** A member written to an ordinary original: a setter it holds or inherits runs as the module. */
	const write = (prop, value, receiver) => {
		for (let holder = original, depth = 0; holder !== null && holder !== undefined && depth < 64; depth++) {
			if (util.types.isProxy(holder)) {
				if (!runtime_isModuleProxy(holder)) return Reflect.set(holder, prop, value, receiver);
				return runAs(owner, () => Reflect.set(holder, prop, value, receiver), undefined, [], false);
			}
			const descriptor = Reflect.getOwnPropertyDescriptor(holder, prop);
			if (descriptor) {
				if ("value" in descriptor) break;
				if (typeof descriptor.set !== "function") return false;
				if (WeakSetMethods.has(maker.handedIn, holder) || runtime_isBuiltinFunction(descriptor.set))
					Reflect.apply(descriptor.set, receiver, [value]);
				else runAs(owner, descriptor.set, receiver, [value], false);
				return true;
			}
			holder = Reflect.getPrototypeOf(holder);
		}
		return Reflect.set(original, prop, value, receiver);
	};
	const handler = {
		apply: (_shadow, thisArg, args) => {
			const receiver = receiverOf(thisArg);
			runtime_gateLeafCopy(owner.slothlet, original, args, receiver);
			const handed = runtime_handInAll(maker, args);
			return runtime_runAsMaker(owner, original, receiver, handed, true, asNode, runtime_callOrigin(standIn, receiver));
		},
		construct: (_shadow, args, newTarget) => {
			runtime_gateLeafCopy(owner.slothlet, original, args, undefined);
			const target = newTarget === standIn ? original : runtime_handIn(maker, newTarget);
			// A subclass's prototype is the subclass's, never the module's.
			if (target !== original && typeof target === "function") {
				const prototype = Reflect.getOwnPropertyDescriptor(target, "prototype")?.value;
				if (prototype !== null && typeof prototype === "object" && !WeakMapMethods.has(STAND_IN_RECORDS, prototype))
					WeakSetMethods.add(maker.handedIn, prototype);
			}
			return runAs(
				owner,
				(...constructArgs) => Reflect.construct(original, constructArgs, target),
				undefined,
				runtime_handInAll(maker, args)
			);
		},
		get: (_shadow, prop, receiver) => {
			const from = receiverOf(receiver);
			if (isProxy)
				return fixedValue(
					prop,
					asMaker(() => Reflect.get(original, prop, from), true)
				);
			const own = Reflect.getOwnPropertyDescriptor(original, prop);
			if (own && !own.configurable) sync(prop, reported(own));
			// A private member the instance inherits from a module's prototype is read as through that prototype.
			runtime_inheritedPrivate(owner.slothlet, original, prop)?.refusePrivate(prop);
			return fixedValue(prop, slotMethod(read(prop, from), null));
		},
		set: (_shadow, prop, value, receiver) => {
			const into = runtime_handIn(maker, value);
			const from = receiverOf(receiver);
			const done = isProxy ? asMaker(() => Reflect.set(original, prop, into, from), false) : write(prop, into, from);
			if (from === original) sync(prop, reported(exec(() => Reflect.getOwnPropertyDescriptor(original, prop))));
			return done;
		},
		has: (_shadow, prop) => {
			if (runtime_inheritedPrivate(owner.slothlet, original, prop)?.privateHidden(prop)) return false;
			return exec(() => Reflect.has(original, prop));
		},
		deleteProperty: (_shadow, prop) => {
			const done = exec(() => Reflect.deleteProperty(original, prop));
			if (done) sync(prop, undefined);
			return done;
		},
		ownKeys: () => {
			if (!exec(() => Reflect.isExtensible(original))) settle();
			const keys = exec(() => Reflect.ownKeys(original));
			if (!Reflect.isExtensible(shadow)) return Reflect.ownKeys(shadow);
			// Every member the shadow holds fixed is still the original's; the language requires it be listed.
			for (let ofIndex = 0, ofList = Reflect.ownKeys(shadow); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				if (
					!(typeof keys === "string" ? StringMethods.includes(keys, key) : ArrayMethods.includes(keys, key)) &&
					!Reflect.getOwnPropertyDescriptor(shadow, key)?.configurable
				)
					listPush(keys, key);
			}
			return keys;
		},
		getOwnPropertyDescriptor: (_shadow, prop) => {
			const descriptor = exec(() => Reflect.getOwnPropertyDescriptor(original, prop));
			if (!Reflect.isExtensible(shadow) || !exec(() => Reflect.isExtensible(original))) {
				settle();
				return Reflect.getOwnPropertyDescriptor(shadow, prop);
			}
			const result = reported(descriptor);
			sync(prop, result);
			return result;
		},
		defineProperty: (_shadow, prop, descriptor) => {
			const into = { ...descriptor };
			if ("value" in descriptor) into.value = runtime_handIn(maker, descriptor.value);
			if ("get" in descriptor) into.get = runtime_handIn(maker, descriptor.get);
			if ("set" in descriptor) into.set = runtime_handIn(maker, descriptor.set);
			const done = exec(() => Reflect.defineProperty(original, prop, into));
			if (done) sync(prop, reported(exec(() => Reflect.getOwnPropertyDescriptor(original, prop))));
			return done;
		},
		getPrototypeOf: () => {
			if (!Reflect.isExtensible(shadow)) return Reflect.getPrototypeOf(shadow);
			// Reported to the code asking, as reading the class's `prototype` hands it to that code.
			return prototypeOut(
				exec(() => Reflect.getPrototypeOf(original)),
				runtime_selfReader(owner.slothlet)
			);
		},
		setPrototypeOf: (_shadow, prototype) => {
			if (!Reflect.isExtensible(shadow)) return Reflect.getPrototypeOf(shadow) === prototype;
			return exec(() => Reflect.setPrototypeOf(original, runtime_handIn(maker, prototype)));
		},
		isExtensible: () => {
			const extensible = exec(() => Reflect.isExtensible(original));
			if (!extensible) settle();
			return Reflect.isExtensible(shadow);
		},
		preventExtensions: () => {
			const done = exec(() => Reflect.preventExtensions(original));
			if (done) settle();
			return done;
		}
	};
	standIn = new NativeProxy(shadow, handler);
	WeakMapMethods.set(made, original, standIn);
	WeakMapMethods.set(STAND_IN_RECORDS, standIn, { maker, owner, original });
	if (!asNode) runtime_recordStandInOrigin(standIn);
	// A leaf's own function stays recognisable as that leaf when it is handed over (see handedLeafFunctions).
	const leaf = WeakMapMethods.get(trustedRootOwn.implWrappers, original);
	if (leaf) WeakMapMethods.set(trustedRootOwn.implWrappers, standIn, leaf);
	return standIn;
}

/**
 * The stand-in of a module's generator function or async function (#597): a function of the same kind — so
 * `util.types` reports it as the original's kind — with the original's `name`, `length` and `prototype`, which runs
 * the original as the module. The original's other own members are read and written through it.
 * @param {object} maker - The module's record.
 * @param {object} owner - The wrapper it runs as.
 * @param {Function} original - The function.
 * @param {WeakMap<object, object>} [made=maker.made] - Where the stand-in is kept: the module's, or a leaf's own (see
 *   {@link runtime_ownStandIns}).
 * @returns {Function} The stand-in, the same one for the same function and module every time.
 * @private
 */
function runtime_kindStandIn(maker, owner, original, made = maker.made) {
	const existing = WeakMapMethods.get(made, original);
	if (existing) return existing;
	const run = (thisArg, args) => {
		const receiver = runtime_handIn(maker, thisArg);
		runtime_gateLeafCopy(owner.slothlet, original, args, receiver);
		const handed = runtime_handInAll(maker, args);
		return runtime_runAsMaker(owner, original, receiver, handed, true, false, runtime_callOrigin(standIn, receiver));
	};
	const isGenerator = util.types.isGeneratorFunction(original);
	const isAsync = util.types.isAsyncFunction(original);
	let standIn;
	if (isGenerator && isAsync) {
		standIn = async function* (...args) {
			return yield* asyncGeneratorSteps(run(this, args));
		};
	} else if (isGenerator) {
		standIn = function* (...args) {
			return yield* generatorSteps(run(this, args));
		};
	} else {
		standIn = async function (...args) {
			return run(this, args);
		};
	}
	for (let ofIndex = 0, ofList = Reflect.ownKeys(original); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		const descriptor = Reflect.getOwnPropertyDescriptor(original, key);
		if (!descriptor) continue;
		if (key === "prototype") {
			Reflect.defineProperty(standIn, key, { __proto__: null, value: descriptor.value, writable: descriptor.writable });
			continue;
		}
		if (key === "name" || key === "length") {
			Reflect.defineProperty(standIn, key, { __proto__: null, ...descriptor, value: descriptor.value });
			continue;
		}
		// Any other member is the original's, read and written through.
		Reflect.defineProperty(standIn, key, {
			__proto__: null,
			get: () => runtime_handOut(maker, owner, Reflect.get(original, key)),
			set: (value) => {
				Reflect.set(original, key, runtime_handIn(maker, value));
			},
			enumerable: descriptor.enumerable,
			configurable: true
		});
	}
	if (!Reflect.getOwnPropertyDescriptor(original, "name")) Reflect.deleteProperty(standIn, "name");
	WeakMapMethods.set(made, original, standIn);
	WeakMapMethods.set(STAND_IN_RECORDS, standIn, { maker, owner, original });
	runtime_recordStandInOrigin(standIn);
	const leaf = WeakMapMethods.get(trustedRootOwn.implWrappers, original);
	if (leaf) WeakMapMethods.set(trustedRootOwn.implWrappers, standIn, leaf);
	return standIn;
}

/**
 * Construct a module's exported class or constructor function through its node (#597): the body runs as the module,
 * as a call of the node runs, and the instance is handed out as the module's. A subclass `new` was applied to (a
 * class extending the node) is the constructing code's, never the module's.
 * @param {object} wrapper - The node's wrapper.
 * @param {Function} constructor - The class or function.
 * @param {Array<*>} args - The arguments.
 * @param {Function} newTarget - What `new` was applied to, or the constructor itself.
 * @returns {object} The instance.
 * @private
 */
function runtime_constructAsNode(wrapper, constructor, args, newTarget) {
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

	if (!wrapper?.slothlet?.instanceID || !wrapper.slothlet.contextManager?.runInContext)
		return Reflect.construct(constructor, args, newTarget);
	if (!handsOutAsModule(wrapper)) {
		const instance = Reflect.construct(constructor, args, newTarget);
		// Under `"fast"` the instance is handed out as it is, unless its `constructor` would hand out a function whose
		// members the rules could refuse the module: then it is the module's, as under `"precise"`. A subclass's
		// `super()` (another `newTarget`) gets its own instance.
		if (newTarget !== constructor || !runtime_instanceHoldsReads(wrapper)) return instance;
		return runtime_handOut(runtime_makerOf(wrapper), wrapper, instance);
	}
	const maker = runtime_makerOf(wrapper);
	// The class's prototype is what `api.x.Class.prototype` reads, so its instances report that very object.
	runtime_exposePrototype(wrapper, Reflect.getOwnPropertyDescriptor(constructor, "prototype")?.value);
	const target = newTarget === constructor ? constructor : runtime_handIn(maker, newTarget);
	if (target !== constructor && typeof target === "function") {
		const prototype = Reflect.getOwnPropertyDescriptor(target, "prototype")?.value;
		if (prototype !== null && typeof prototype === "object" && !WeakMapMethods.has(STAND_IN_RECORDS, prototype))
			WeakSetMethods.add(maker.handedIn, prototype);
	}
	return runtime_runAsMaker(
		wrapper,
		(...constructArgs) => Reflect.construct(constructor, constructArgs, target),
		undefined,
		runtime_handInAll(maker, args),
		true,
		true
	);
}

/**
 * {@link runtime_crossArguments} for values handed to a module by a known caller: a call's arguments, and what slothlet
 * itself hands a module's code for someone else (an event's payload to a listener).
 * @param {object} wrapper - The wrapper of the module handed the values.
 * @param {ArrayLike<*>} args - The values.
 * @param {object|null} caller - The wrapper of the module handing them over, or null for the host.
 * @returns {ArrayLike<*>} The values, the same list when nothing changed.
 * @private
 */
function runtime_crossArgumentsFrom(wrapper, args, caller) {
	const slothlet = wrapper?.slothlet;
	if (!args?.length || !slothlet?.handlers?.permissionManager?.isEnabled?.()) return args;
	if (caller !== null && runtime_asOneModule(slothlet, caller, wrapper)) return args;
	let result = args;
	for (let index = 0; index < args.length; index++) {
		const value = args[index];
		if (value === null || (typeof value !== "object" && typeof value !== "function")) continue;
		let from = caller;
		if (caller === null) {
			// The host's own values are handed in as they are. What a module's call returned to the host, passed on as it
			// is, still comes from that module.
			from =
				WeakMapMethods.get(HOST_HANDED, value) ??
				(typeof value === "object" ? WeakMapMethods.get(HOST_HANDED, runtime_unwrapClassInstance(value)) : null) ??
				null;
			if (from === null && !WeakMapMethods.has(CROSSINGS, value)) continue;
		} else {
			// What the caller holds as itself is its own: handed back to it later, it is the value again.
			runtime_recordOrigin(value, caller);
			if (typeof value === "function" && !runtime_isSlothletValue(value)) {
				const prototype = Reflect.getOwnPropertyDescriptor(value, "prototype")?.value;
				if (prototype !== null && typeof prototype === "object") runtime_recordOrigin(prototype, caller);
			}
		}
		// A function of the language's or Node's own the caller hands over runs for the caller, with its target.
		const crossed =
			from !== null && runtime_guardOn(slothlet) && runtime_runsForHander(value, from) && !WeakMapMethods.has(CROSSINGS, value)
				? runtime_handedView(value, wrapper, slothlet, from)
				: runtime_crossTo(value, wrapper, slothlet, from);
		if (crossed === value) continue;
		if (result === args) result = copyList(args);
		result[index] = crossed;
	}
	return result;
}

/**
 * The module whose call returned each object or function to the host while the permission system was on. The host
 * holds the value itself; handed on by the host to another module as it is, it reaches that module as a value the
 * first module handed it ({@link runtime_crossArguments}), and the module it came from as itself.
 * @type {WeakMap<object, object>}
 * @private
 */
const HOST_HANDED = new WeakMap();

/**
 * The arguments a call into a module is handed (see {@link runtime_handIn}): a stand-in of that module's own values
 * comes back as the value itself, as it would in plain JavaScript (`registry.remove(registry.get(name))`); a
 * stand-in of another module's value stays one.
 * @param {object} wrapper - The wrapper being called.
 * @param {Array<*>} args - The call's arguments.
 * @returns {Array<*>} The arguments, the same array when nothing changed.
 * @private
 */
function runtime_ownArguments(wrapper, args) {
	if (!args?.length || !wrapper?.slothlet?.instanceID || !handsOutAsModule(wrapper)) return args;
	return runtime_handInAll(runtime_makerOf(wrapper), args, wrapper);
}

/**
 * {@link runtime_frontingNode}, bound to the module reading now as a read of that node is (see
 * {@link runtime_functionNodeFor}).
 * @param {object} slothlet - The instance.
 * @param {Function} fn - The function.
 * @returns {Function|undefined} The node.
 * @private
 */
function runtime_frontingNodeNow(slothlet, fn) {
	const node = runtime_frontingNode(slothlet, fn);
	if (node === undefined || node === slothlet.boundApi) return node;
	return runtime_functionNodeFor(resolveWrapper(node), fn) ?? node;
}

/**
 * The prototype a function node reports (#667), as its function's own `[[Prototype]]` is: the engine's
 * (`Function.prototype`, `AsyncFunction.prototype`, …) as it is, and a class of the module's (the base class a derived
 * class extends) as the node fronting it, bound to the reading module as a read of that node is. A class of the module's
 * no node fronts is not reported: handing it out would hand out the module's code with no node's checks around it.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {Function} fn - Its function.
 * @returns {object|Function|null} The prototype to report, or `null`.
 * @private
 */
function runtime_functionNodePrototype(wrapper, fn) {
	const prototype = runtime_ownsPrototype(wrapper) ? runtime_recordedPrototype(wrapper) : Objects.getPrototypeOf(fn);
	if (prototype === null || prototype === Functions.prototype) return prototype;
	// One given to the node is no part of the module's function: the host is handed it as it is, and module code its
	// own view of it (see runtime_givenView).
	if (runtime_prototypeGiven(wrapper)) return runtime_givenPrototypeFor(wrapper, prototype);
	if (typeof prototype !== "function") {
		return runtime_memberHoldsCode(prototype, searchDepth(wrapper.slothlet) + 1, searchBudget(wrapper.slothlet)) ? null : prototype;
	}
	return runtime_functionNodeFor(wrapper, prototype) ?? null;
}

/**
 * The node fronting a function of the module's (see {@link FUNCTION_NODES}), bound to the module reading now as a read
 * of that node is, or `undefined` when no node of the instance fronts it.
 * @param {UnifiedWrapper} wrapper - A node of the instance, read now.
 * @param {Function} fn - The function.
 * @returns {Function|undefined} The node, or `undefined`.
 * @private
 */
function runtime_functionNodeFor(wrapper, fn) {
	const node = nodeRefOf(FUNCTION_NODES, wrapper.slothlet, fn);
	if (node === undefined) return undefined;
	const permissionManager = wrapper.slothlet.handlers?.permissionManager;
	if (!permissionManager?.isEnabled() || permissionManager.isCaptureEnabled?.() === false) return node;
	const identity = wrapper.slothlet.contextManager?.getCallerIdentity?.();
	return identity?.currentWrapper ? runtime_capturedView(node, identity.currentWrapper, true, identity.ceiling ?? null) : node;
}

/**
 * Where a prototype of a module's is known to be read (#667): every path recorded for it, and the `prototype` of the
 * class it is the prototype of at every name a node exports the class as, found by descriptors so none of the module's
 * code runs to find it, whether or not anything read it yet. `undefined` for any other value.
 * @param {object|null} slothlet - The instance the value crossed in, when known.
 * @param {*} value - The value.
 * @returns {{slothlet: object, sites: Array<{parts: string[], key: string, prop: string|null}>}|undefined} The sites.
 * @private
 */
function runtime_knownPrototype(slothlet, value) {
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

	if (value === null || typeof value !== "object") return undefined;
	const record = WeakMapMethods.get(PROTOTYPE_PATHS, value);
	const instance = record?.slothlet ?? slothlet ?? runtime_classInstanceOf(value);
	if (!instance) return undefined;
	const classSites = runtime_classPrototypeSites(instance, value);
	if (record === undefined && classSites.length === 0) return undefined;
	const sites = record === undefined ? [] : mapValuesToArray(record.sites);
	for (let ofIndex = 0, ofList = classSites; ofIndex < ofList.length; ofIndex++) {
		const site = ofList[ofIndex];
		if (!(record == null ? undefined : MapMethods.has(record.sites, site.key))) listPush(sites, site);
	}
	return { slothlet: instance, sites };
}

/**
 * The views made of each carrier, per reader (see {@link runtime_carrierView}).
 * @type {WeakMap<object, WeakMap<object, object>>}
 * @private
 */
const CARRIER_VIEWS = new WeakMap();

/**
 * What a value reaches `reader` as when it crosses from one module to another through slothlet (#667): an argument, an
 * error a call threw or rejected with, a hook's payload, or an event's payload ({@link runtime_eventPayloadFor}). A
 * prototype of a module's reaches it as reading it at its path would
 * ({@link runtime_prototypeHandedTo}), and a carrier holding one at any depth as a view handing each member on the same
 * way ({@link runtime_carrierView}). Anything else, and everything while the permission system is off, passes as it
 * is.
 * @param {*} value - The value.
 * @param {object|null} reader - Who it reaches: a module's wrapper, the host (`null` or {@link HOST_READER}), or
 *   {@link SEALED_SHELL_READER} for a holder not known yet.
 * @param {object|null} slothlet - The instance it crosses in, when known.
 * @returns {*} What the reader gets.
 * @private
 */
function runtime_carryTo(value, reader, slothlet) {
	/**
	 * A carrier as it reaches `reader` (see {@link runtime_carryTo}): a view handing each data member on as the reader would
	 * get it, writing through to the carrier. A frozen carrier holds nothing a write could change, so the reader is handed a
	 * frozen copy of it instead, each member carried, which the engine then checks the view's answers against. The same
	 * view each time, for the same carrier and reader.
	 * @param {object} value - The carrier.
	 * @param {object} reader - Who it reaches.
	 * @param {object|null} slothlet - The instance it crosses in, when known.
	 * @returns {object} The view.
	 * @private
	 */
	function runtime_carrierView(value, reader, slothlet) {
		let byReader = WeakMapMethods.get(CARRIER_VIEWS, value);
		const existing = byReader == null ? undefined : WeakMapMethods.get(byReader, reader);
		if (existing) return existing;
		const carry = (member) => runtime_carryTo(member, reader, slothlet);
		let view;
		if (Objects.isFrozen(value)) {
			view = Arrays.isArray(value) ? [] : Objects.create(Reflect.getPrototypeOf(value));
			for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
				Reflect.defineProperty(
					view,
					key,
					"value" in descriptor ? { __proto__: null, ...descriptor, value: carry(descriptor.value) } : descriptor
				);
			}
			Objects.freeze(view);
		} else {
			// A member held read-only and non-configurable must be reported as it is (proxy invariant).
			const fixed = (descriptor) => descriptor && "value" in descriptor && !descriptor.configurable && !descriptor.writable;
			view = new NativeProxy(value, {
				get: (target, prop, receiver) => {
					const member = Reflect.get(target, prop, receiver === view ? target : receiver);
					return fixed(Reflect.getOwnPropertyDescriptor(target, prop)) ? member : carry(member);
				},
				set: (target, prop, next, receiver) => Reflect.set(target, prop, next, receiver === view ? target : receiver),
				getOwnPropertyDescriptor: (target, prop) => {
					const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
					return !descriptor || !("value" in descriptor) || fixed(descriptor)
						? descriptor
						: { __proto__: null, ...descriptor, value: carry(descriptor.value) };
				}
			});
		}
		if (!byReader) WeakMapMethods.set(CARRIER_VIEWS, value, (byReader = new WeakMap()));
		WeakMapMethods.set(byReader, reader, view);
		return view;
	}

	/**
	 * Whether a carrier ({@link runtime_isCarrier}) holds a prototype of a module's as a data member, at any depth within
	 * the code search ({@link searchDepth}). Nothing of the value runs to decide: an accessor is passed over.
	 * @param {object|null} slothlet - The instance it crossed in, when known.
	 * @param {object} value - The carrier.
	 * @param {number} depth - Levels still allowed.
	 * @param {{remaining: number}} budget - Properties still allowed.
	 * @returns {boolean} True when it does.
	 * @private
	 */
	function runtime_carriesPrototype(slothlet, value, depth, budget) {
		if (depth <= 0) return false;
		if (Arrays.isArray(value) && value.length > budget.remaining) return false;
		const keys = Reflect.ownKeys(value);
		budget.remaining -= keys.length;
		if (budget.remaining < 0) return false;
		for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			const member = Reflect.getOwnPropertyDescriptor(value, key)?.value;
			if (member === null || typeof member !== "object" || util.types.isProxy(member)) continue;
			if (runtime_knownPrototype(slothlet, member) !== undefined) return true;
			if (runtime_isCarrier(member) && runtime_carriesPrototype(slothlet, member, depth - 1, budget)) return true;
		}
		return false;
	}

	if (value === null || typeof value !== "object" || reader === null || reader === HOST_READER) return value;
	if (slothlet && !slothlet.handlers?.permissionManager?.isEnabled()) return value;
	try {
		if (runtime_knownPrototype(slothlet, value) !== undefined) return runtime_prototypeHandedTo(value, reader, slothlet);
		if (!runtime_isCarrier(value)) return value;
		if (!runtime_carriesPrototype(slothlet, value, searchDepth(slothlet), searchBudget(slothlet))) return value;
		return runtime_carrierView(value, reader, slothlet);
	} catch {
		// A value that refuses to be described is handed on as it is.
		return value;
	}
}

/**
 * Each crossing view (see {@link runtime_crossView}), with the value it stands over, who it was handed to, and the
 * module the value came from.
 * @type {WeakMap<object, {original: object, reader: object, from: object|null, slothlet: object}>}
 * @private
 */
const CROSSINGS = new WeakMap();

/**
 * The crossing views made of each value: its first module's held inline, any other module's by module (see
 * {@link runtime_crossKey}). Every leaf of one module gets the same view, so a value one module hands another is the
 * same value in every function of the module it reaches, as it is in plain JavaScript.
 * @type {WeakMap<object, {key: object, view: object, reader: object, others: Map<object, object>|null}>}
 * @private
 */
const CROSSING_VIEWS = new WeakMap();

/**
 * The guard's promise of each plain promise, by module, so the same promise read twice is the same promise and only
 * one reaction is ever added to the original.
 * @type {WeakMap<Promise, Map<object, Promise>>}
 * @private
 */
const CROSSED_PROMISES = new WeakMap();

/**
 * Whether the class prototype guard holds in an instance: while its permission system is on, and after it shut down
 * with the system on. A module handed a view because it may not write another module's code keeps a view, and what it
 * reads through it stays viewed: the instance ending grants it nothing.
 * @param {object|null} slothlet - The instance.
 * @returns {boolean} True when it holds.
 * @private
 */
function runtime_guardOn(slothlet) {
	const permissionManager = slothlet?.handlers?.permissionManager;
	if (!permissionManager) return false;
	return permissionManager.isEnabled?.() === true || permissionManager.wasOnAtShutdown?.() === true;
}

/**
 * The value a crossing view stands over, or the value itself.
 * @param {*} value - The value.
 * @returns {*} What it stands over.
 * @private
 */
function runtime_uncross(value) {
	/**
	 * Whether a value is a crossing view.
	 * @param {*} value - The value.
	 * @returns {boolean} True for one.
	 * @private
	 */
	function runtime_isCrossing(value) {
		return value !== null && (typeof value === "object" || typeof value === "function") && WeakMapMethods.has(CROSSINGS, value);
	}

	return runtime_isCrossing(value) ? WeakMapMethods.get(CROSSINGS, value).original : value;
}

/**
 * The module a value was seen held as itself by, when it crossed to another module through slothlet (an argument, a
 * class a construction was made for): the guard hands it back to that module as itself.
 * @type {WeakMap<object, {slothlet: object, module: string|object, wrapper: object}>}
 * @private
 */
const CROSSING_ORIGINS = new WeakMap();

/**
 * The path each prototype no node exports is held to: that of the node that first handed it on (see
 * {@link runtime_writtenPrototypeFor}). One path per prototype, so a class and its instances report the same checked
 * view whichever of the module's functions handed each of them over.
 * @type {WeakMap<object, {parts: string[], known: boolean}>}
 * @private
 */
const CROSSED_PROTOTYPE_PATHS = new WeakMap();

/**
 * What the views made for a reader are kept under: its module's record (see {@link runtime_makerOf}), one per module of
 * an instance, or the reader itself when it is no module's wrapper, or one of a module removed since (its removal under
 * way included), whose record is gone and is not made again for it.
 * @param {object} reader - Who a view is for.
 * @returns {object} The key.
 * @private
 */
function runtime_crossKey(reader) {
	/**
	 * Whether a module's record (see {@link runtime_makerOf}) is held for a wrapper, without making one.
	 * @param {object} wrapper - A module's wrapper.
	 * @returns {boolean} True when it is.
	 * @private
	 */
	function runtime_hasMaker(wrapper) {
		const makers = WeakMapMethods.get(MAKERS, wrapper.slothlet);
		if (!makers) return false;
		const moduleID = wrapper.____slothletInternal?.moduleID;
		return moduleID ? MapMethods.has(makers.byID, moduleID) : WeakMapMethods.has(makers.byWrapper, wrapper);
	}

	if (!reader?.____slothletInternal || !reader.slothlet) return reader;
	if (!runtime_hasMaker(reader) && reader.slothlet.handlers?.apiManager?.isRemovedCaller?.(reader) === true) return reader;
	return runtime_viewGroup(reader);
}

/**
 * The functions of a module that share the views made of other modules' values: those the write rules answer alike
 * (the same rules name them, see `PermissionManager#writeRulesFor`). A write another module's code makes through such
 * a view, a built-in one of them hands on to run included, is held to the rules of whoever holds the view, so a view
 * is shared only where that answer is the same. Most modules have one group, the module's record itself.
 * @param {object} reader - A module's wrapper.
 * @returns {{owner: object}} The group's record: the module's record (see {@link runtime_makerOf}) for functions the
 *   rules answer as the first of its wrappers, else one record per answer, whose `owner` is the first function of it.
 * @private
 */
function runtime_viewGroup(reader) {
	const maker = runtime_makerOf(reader);
	if (maker.owner === reader) return maker;
	const permissionManager = reader.slothlet.handlers?.permissionManager;
	if (!permissionManager) return maker;
	const rulesOf = (wrapper) => permissionManager.writeRulesFor(String(wrapper.____slothletInternal?.apiPath ?? ""));
	const mine = rulesOf(reader);
	if (mine === rulesOf(maker.owner)) return maker;
	maker.viewGroups ??= new Map();
	let group = MapMethods.get(maker.viewGroups, mine);
	if (!group) MapMethods.set(maker.viewGroups, mine, (group = { owner: reader }));
	return group;
}

/**
 * Record that `wrapper`'s module held a value as itself when it handed it on (see {@link CROSSING_ORIGINS}). A value it
 * held through a crossing view, one of slothlet's own (another module's stand-in, a node), or one already recorded, is
 * left as it is.
 * @param {*} value - The value.
 * @param {object} wrapper - The module's wrapper.
 * @returns {void}
 * @private
 */
function runtime_recordOrigin(value, wrapper) {
	if (value === null || (typeof value !== "object" && typeof value !== "function") || WeakMapMethods.has(CROSSINGS, value)) return;
	if (WeakMapMethods.has(CROSSING_ORIGINS, value) || runtime_isSlothletValue(value)) return;
	const module = runtime_moduleKey(wrapper);
	if (module !== null) WeakMapMethods.set(CROSSING_ORIGINS, value, { slothlet: wrapper.slothlet, module, wrapper });
}

/**
 * The api path of the module a value comes from, as segments: none when no module is known.
 * @param {object|null} from - The wrapper of the module it comes from.
 * @returns {string[]} The segments.
 * @private
 */
function runtime_crossFromParts(from) {
	return from?.____slothletInternal ? filterList(splitText(String(from.____slothletInternal.apiPath ?? ""), "."), Boolean) : [];
}

/**
 * A prototype some module wrote, reached by a reader through a value another module handed it (an instance, the class,
 * the prototype held in data), as the reader gets it while the permission system is on. One whose class a node exports
 * is handed on as reading it at that path would ({@link runtime_prototypeHandedTo}). Any other is the code of the
 * module that first handed it on and is held to that module's path: the object itself to a reader that may make every
 * write there, a checked view refusing a write the reader could not make there to any other. Handed on by no known
 * module, it is held to the root, which only the host owns. Every leaf of a module gets the same view.
 * @param {object} prototype - The prototype.
 * @param {object} reader - Who reads it.
 * @param {object} slothlet - The instance.
 * @param {object|null} from - The wrapper of the module it came from.
 * @returns {object} What the reader gets.
 * @private
 */
function runtime_writtenPrototypeFor(prototype, reader, slothlet, from) {
	if (runtime_isOwnOrigin(prototype, reader)) return prototype;
	// One view per module, or per group of its functions the write rules answer alike ({@link runtime_viewGroup}): the
	// first of the group stands for all of it, and each write is still decided for the module executing it. Whether the reader holds the object itself is the reader's own answer: files loaded from one
	// folder share a module, and the one standing for it may hold what a rule refuses this one. A file a write rule
	// keeps apart from the one standing for its module gets a view of its own, so a write through it that another
	// module's code makes (a bound built-in it hands on) is still held to what the file may write.
	let standing = reader?.____slothletInternal && reader.slothlet ? runtime_viewGroup(reader).owner : reader;
	if (standing !== reader && !runtime_asOneModule(slothlet, standing, reader)) standing = reader;
	if (runtime_knownPrototype(slothlet, prototype) !== undefined) return runtime_prototypeHandedTo(prototype, reader, slothlet);
	let site = WeakMapMethods.get(CROSSED_PROTOTYPE_PATHS, prototype);
	if (site === undefined || (!site.known && from?.____slothletInternal)) {
		site = { parts: runtime_crossFromParts(from), known: Boolean(from?.____slothletInternal) };
		WeakMapMethods.set(CROSSED_PROTOTYPE_PATHS, prototype, site);
	}
	WeakSetMethods.add(MODULE_PROTOTYPES, prototype);
	if (site.known && runtime_mayWritePath(slothlet, reader, site.parts)) return prototype;
	// A view the reader's module already holds of it, handed over as data before anything showed it to be a prototype,
	// is the object the module knows: it refuses the same writes ({@link runtime_crossAssertWrite}).
	const views = WeakMapMethods.get(CROSSING_VIEWS, prototype);
	if (views !== undefined) {
		const key = runtime_crossKey(reader);
		const held = views.key === key ? views.view : views.others == null ? undefined : MapMethods.get(views.others, key);
		if (held) return held;
	}
	return runtime_selfMemberOf(prototype, standing, slothlet, site.parts, null);
}

/**
 * The objects slothlet has seen a module use as a prototype: each link some module wrote in the prototype chain of a
 * value that crossed between modules. Such an object is that module's code wherever it is reached afterwards, handed
 * on as data included: every change to it is held to the module's write rules.
 * @type {WeakSet<object>}
 * @private
 */
const MODULE_PROTOTYPES = new WeakSet();

/**
 * Whether `reader` may make every write at a path and beneath it, as the path's owner may: it owns the path, or write
 * rules grant it the whole subtree, and no write rule could refuse it one there.
 * @param {object} slothlet - The instance.
 * @param {object} reader - A module's wrapper.
 * @param {string[]} parts - The path.
 * @returns {boolean} True when it may.
 * @private
 */
function runtime_mayWritePath(slothlet, reader, parts) {
	if (!reader?.____slothletInternal || parts.length === 0) return false;
	const verdict = slothlet.handlers.permissionManager.writeSubtree(
		String(reader.____slothletInternal.apiPath ?? ""),
		ArrayMethods.join(parts, ".")
	);
	if (verdict === "deny") return false;
	if (verdict === "grant" && !slothlet.handlers.apiManager.isRemovedCaller(reader)) return true;
	return slothlet.handlers.apiManager.ownsPath(parts, reader);
}

/**
 * Whether `reader` may make every write at the path of the module a value comes from and beneath it
 * ({@link runtime_mayWritePath}). Such a reader gets the value itself; a prototype on it of a class exported elsewhere is
 * still decided at that class's path ({@link runtime_writtenPrototypeFor}).
 * @param {object} slothlet - The instance.
 * @param {object} reader - A module's wrapper.
 * @param {object|null} from - The wrapper of the module the value comes from.
 * @returns {boolean} True when it may.
 * @private
 */
function runtime_mayWriteFrom(slothlet, reader, from) {
	if (!from?.____slothletInternal) return false;
	return runtime_mayWritePath(slothlet, reader, runtime_crossFromParts(from));
}

/**
 * {@link runtime_handedAsItself} for a value: a value that stays a view for every module it is handed to
 * ({@link runtime_viewedForHander}) never reaches one as itself, and nor does an instance inheriting members private to
 * a module that privacy keeps from the reader ({@link runtime_inheritsPrivateKept}), however much it may write.
 * @param {*} value - The value.
 * @param {object} slothlet - The instance.
 * @param {object} reader - A module's wrapper.
 * @param {object|null} from - The wrapper of the module the value comes from.
 * @returns {"writer"|"written"|null} Why it is handed as itself, or `null` when it is viewed.
 * @private
 */
function runtime_handedAsItselfFor(value, slothlet, reader, from) {
	/**
	 * Whether a value inherits, from a prototype of a module's class, a member private to that module that privacy keeps
	 * from `reader` ({@link runtime_readerHoldsPrototype}): held as itself, the value would hand it over unchecked. Found by
	 * descriptors alone.
	 * @param {object} slothlet - The instance.
	 * @param {object} reader - A module's wrapper.
	 * @param {*} value - The value, a stand-in or the async runtime's context wrapper standing for the value behind it.
	 * @returns {boolean} True when it does.
	 * @private
	 */
	function runtime_inheritsPrivateKept(slothlet, reader, value) {
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
		const subject = runtime_crossSubject(value);
		if (util.types.isProxy(subject)) return false;
		for (let holder = Reflect.getPrototypeOf(subject), depth = 0; holder !== null && depth < 64; depth++) {
			if (util.types.isProxy(holder) || WeakSetMethods.has(INTRINSICS, holder) || runtime_isSharedValue(holder)) return false;
			if (runtime_knownPrototype(slothlet, holder) !== undefined) {
				const keys = Reflect.ownKeys(holder);
				for (let ofIndex = 0; ofIndex < keys.length; ofIndex++) {
					const key = keys[ofIndex];
					if (typeof key === "string" && StringMethods.charCodeAt(key, 0) === 95)
						return !runtime_readerHoldsPrototype(slothlet, reader, holder);
				}
			}
			holder = Reflect.getPrototypeOf(holder);
		}
		return false;
	}

	/**
	 * Whether a value holds none of a module's code, as far as the code search ({@link searchDepth}) reaches: no function, no Proxy, no class
	 * instance, no prototype a module wrote, at any depth. A stand-in and the async runtime's context wrapper stand for the
	 * value behind them. Nothing of the value runs to decide.
	 * @param {*} value - The value.
	 * @param {object|null} slothlet - The instance, whose `permissions.search` bounds the search.
	 * @returns {boolean} True for plain data.
	 * @private
	 */
	function runtime_holdsNoCode(value, slothlet) {
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return true;
		const subject = runtime_crossSubject(value);
		if (typeof subject === "function" || util.types.isProxy(subject)) return false;
		try {
			return !runtime_isCodeObject(subject) && !runtime_memberHoldsCode(subject, searchDepth(slothlet) + 1, searchBudget(slothlet));
		} catch {
			// A value that refuses to be described is taken to hold code.
			return false;
		}
	}

	/**
	 * Whether a value a module hands on stays a view for every other module, however much the receiver may write: a
	 * function that runs for the module handing it ({@link runtime_runsForHander}), and plain data holding one as a member
	 * of its own at any depth within the code search ({@link searchDepth}) (`{ fn: Reflect.set, target }`), whose member reaches the receiver
	 * as that function's view ({@link runtime_crossHandedMember}). Nothing of the value runs to decide: an accessor is passed
	 * over.
	 * @param {*} value - The value handed on.
	 * @param {object|null} from - The wrapper of the module handing it on.
	 * @returns {boolean} True when it stays a view.
	 * @private
	 */
	function runtime_viewedForHander(value, from) {
		/**
		 * Whether a carrier ({@link runtime_isCarrier}) holds, as a data member at any depth within the code search ({@link searchDepth}), a
		 * function that runs for the module handing it on ({@link runtime_runsForHander}).
		 * @param {object} value - The carrier.
		 * @param {object} from - The wrapper of the module handing it on.
		 * @param {number} depth - Levels still allowed.
		 * @param {{remaining: number}} budget - Properties still allowed.
		 * @returns {boolean} True when it does.
		 * @private
		 */
		function runtime_carriesHanded(value, from, depth, budget) {
			if (depth <= 0) return false;
			if (Arrays.isArray(value) && value.length > budget.remaining) return false;
			const keys = Reflect.ownKeys(value);
			budget.remaining -= keys.length;
			if (budget.remaining < 0) return false;
			for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
				const member = Reflect.getOwnPropertyDescriptor(value, ofList[ofIndex])?.value;
				if (member === null || (typeof member !== "object" && typeof member !== "function")) continue;
				if (runtime_runsForHander(member, from)) return true;
				if (typeof member === "object" && runtime_isCarrier(member) && runtime_carriesHanded(member, from, depth - 1, budget)) return true;
			}
			return false;
		}

		if (runtime_runsForHander(value, from)) return true;
		if (value === null || typeof value !== "object" || !from?.____slothletInternal || !runtime_isCarrier(value)) return false;
		try {
			return runtime_carriesHanded(value, from, searchDepth(from.slothlet), searchBudget(from.slothlet));
		} catch {
			// A value that refuses to be described is viewed.
			return true;
		}
	}

	/**
	 * Whether, and why, a value reaches `reader` as itself by write rights. `"writer"`: the reader may make every write at
	 * the path the value comes from ({@link runtime_mayWriteFrom}), as the owner may. `"written"`: the module the value
	 * comes from may make every write at the reader's path, and the value holds none of that module's code
	 * ({@link runtime_holdsNoCode}): what the reader hands back, or stores where that module reads it as itself, stays the
	 * value, and there is no code of the module's in it for the reader to change. Neither holds across a write rule that
	 * refuses the other side: a module refused a write to the other is handed views of the other's values and has its own
	 * handed on as views, since what the other stores into a value it holds as itself comes back.
	 * @param {object} slothlet - The instance.
	 * @param {object} reader - A module's wrapper.
	 * @param {object|null} from - The wrapper of the module the value comes from.
	 * @param {*} value - The value.
	 * @returns {"writer"|"written"|null} Why it is handed as itself, or `null` when it is viewed.
	 * @private
	 */
	function runtime_handedAsItself(slothlet, reader, from, value) {
		if (!from?.____slothletInternal) return null;
		if (runtime_mayWriteFrom(slothlet, reader, from)) return runtime_writeDeniedWithin(slothlet, from, reader) ? null : "writer";
		if (runtime_mayWriteFrom(slothlet, from, reader) && runtime_holdsNoCode(value, slothlet))
			return runtime_writeDeniedWithin(slothlet, reader, from) ? null : "written";
		return null;
	}

	if (runtime_viewedForHander(value, from)) return null;
	const itself = runtime_handedAsItself(slothlet, reader, from, value);
	return itself !== null && runtime_inheritsPrivateKept(slothlet, reader, value) ? null : itself;
}

/**
 * Whether a write rule refuses `reader` a write somewhere in the subtree of a module of its own module id: modules
 * loaded from one folder share an id and own each other's paths, but a deny rule between them still holds, so what one
 * hands the other is viewed like another module's.
 * @param {object} slothlet - The instance.
 * @param {object} reader - A module's wrapper.
 * @param {object} from - The wrapper of the module the value comes from, of the same module id.
 * @returns {boolean} True when a rule refuses it.
 * @private
 */
function runtime_writeDeniedWithin(slothlet, reader, from) {
	if (reader === from) return false;
	const parts = runtime_crossFromParts(from);
	if (parts.length === 0) return false;
	return (
		slothlet.handlers.permissionManager.writeSubtree(String(reader.____slothletInternal.apiPath ?? ""), ArrayMethods.join(parts, ".")) ===
		"deny"
	);
}

/**
 * Whether two wrappers are of one module with nothing between them: the same module id, and no write rule refusing
 * either one a write in the other's subtree. What such a pair hands each other is handed as it is; a pair with a deny
 * rule between them is handed views in both directions, since what one stores into the other's value comes back.
 * @param {object} slothlet - The instance.
 * @param {object|null} a - A wrapper.
 * @param {object|null} b - Another.
 * @returns {boolean} True when they are.
 * @private
 */
function runtime_asOneModule(slothlet, a, b) {
	if (a === b) return true;
	if (!runtime_sameModule(a, b)) return false;
	return !runtime_writeDeniedWithin(slothlet, a, b) && !runtime_writeDeniedWithin(slothlet, b, a);
}

/**
 * What a value reaches `reader` as when another module hands it on while the permission system is on (the class
 * prototype guard): the reader may change data it is handed, but never the code of a module it may not write, however
 * it gets to it. A prototype a module wrote is checked ({@link runtime_writtenPrototypeFor}); any other object or
 * function, a stand-in of another module's code included, is a crossing view ({@link runtime_crossView}) through which
 * every value read later — an instance, the class, a member the owner stored after handing the object on — reaches the
 * reader the same way. The host, the module the value came from, a module that may make every write at the path it
 * comes from, and every reader while the system is off get the value itself; a crossing view handed on again is decided
 * anew for whoever it reaches. Where the value cannot be
 * described it is viewed, never handed on as it is.
 * @param {*} value - The value.
 * @param {object|null|undefined} reader - Who it reaches: a module's wrapper, the host (`null` or {@link HOST_READER}),
 *   or {@link SEALED_SHELL_READER} for a holder not known yet.
 * @param {object|null} slothlet - The instance it crosses in, when known.
 * @param {object|null} [from] - The wrapper of the module it comes from, when known.
 * @returns {*} What the reader gets.
 * @private
 */
function runtime_crossTo(value, reader, slothlet, from = null) {
	/**
	 * Whether an object whose internal data holds no references ({@link runtime_isOpaqueData}) holds nothing else either,
	 * so it can be handed on as it is: its prototype is the language's or Node's own, and it has no member of its own beyond
	 * what its kind gives it. A typed array's members under string keys are read only where `permissions.gating.buffers`
	 * asks for it: listing them lists every index, which costs milliseconds on a buffer of any size. Otherwise only its
	 * prototype and its symbol keys are checked.
	 * @param {object} value - Such an object.
	 * @param {object|null} slothlet - The instance it crosses in.
	 * @returns {boolean} True when nothing but its own data can be reached through it.
	 * @private
	 */
	function runtime_isPristineData(value, slothlet) {
		const prototype = Reflect.getPrototypeOf(value);
		if (prototype !== null && !WeakSetMethods.has(INTRINSICS, prototype) && !runtime_isSharedValue(prototype)) return false;
		const types = util.types;
		if (types.isArrayBufferView(value) && !types.isDataView(value)) {
			if (Objects.getOwnPropertySymbols(value).length !== 0) return false;
			const listed = slothlet?.config?.permissions?.gating?.buffers;
			if (listed !== true && typeof listed !== "number") return true;
			// Past the cap the array is not listed, as with the option off.
			if (listed !== true && Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, value, []) > listed * 1024) return true;
			// Its own keys are its indices, then any member stored under another name.
			return Reflect.ownKeys(value).length === Reflect.apply(TYPED_ARRAY_LENGTH, value, []);
		}
		const keys = Reflect.ownKeys(value);
		if (keys.length === 0) return true;
		if (types.isRegExp(value)) return keys.length === 1 && keys[0] === "lastIndex";
		if (types.isBoxedPrimitive(value) && typeof ObjectMethods.valueOf(value) === "string") {
			// A boxed string's own keys are its indices and its length.
			return keys.length === ObjectMethods.valueOf(value).length + 1 && keys[keys.length - 1] === "length";
		}
		return false;
	}

	/**
	 * Whether an object's internal data holds no reference to another object: a date, a regular expression, a buffer, a
	 * typed array, a `DataView`, or a boxed primitive.
	 * @param {object} value - An object that is not a Proxy.
	 * @returns {boolean} True for one.
	 * @private
	 */
	function runtime_isOpaqueData(value) {
		const types = util.types;
		return (
			types.isDate(value) ||
			types.isRegExp(value) ||
			types.isAnyArrayBuffer(value) ||
			types.isArrayBufferView(value) ||
			types.isBoxedPrimitive(value)
		);
	}

	/**
	 * Whether an object is the own prototype of a class some module or the host wrote (`C.prototype`), told by
	 * descriptors alone: its `constructor` is a function whose `prototype` is the object. The language's and packages'
	 * own prototypes are not.
	 * @param {object} value - An object that is not a Proxy.
	 * @returns {boolean} True for such a prototype.
	 * @private
	 */
	function runtime_isWrittenClassPrototype(value) {
		if (WeakSetMethods.has(INTRINSICS, value) || runtime_isSharedValue(value) || runtime_isSlothletValue(value)) return false;
		const constructor = Reflect.getOwnPropertyDescriptor(value, "constructor")?.value;
		return typeof constructor === "function" && Reflect.getOwnPropertyDescriptor(constructor, "prototype")?.value === value;
	}

	/**
	 * The guard's promise of a plain promise another module handed on: it settles as the promise does, with what it
	 * settles to crossed for the reader. The same promise for the same module every time.
	 * @param {Promise} promise - The promise.
	 * @param {object} reader - Who it reaches.
	 * @param {object} slothlet - The instance.
	 * @param {object|null} from - The wrapper of the module it comes from.
	 * @returns {Promise} The guard's promise.
	 * @private
	 */
	function runtime_crossPromise(promise, reader, slothlet, from) {
		const key = runtime_crossKey(reader);
		let byKey = WeakMapMethods.get(CROSSED_PROMISES, promise);
		const existing = byKey == null ? undefined : MapMethods.get(byKey, key);
		if (existing) return existing;
		const crossed = Reflect.apply(SLOT_READERS.then, promise, [
			(settled) => runtime_crossTo(settled, reader, slothlet, from),
			(reason) => {
				throw runtime_crossTo(reason, reader, slothlet, from);
			}
		]);
		if (!byKey) WeakMapMethods.set(CROSSED_PROMISES, promise, (byKey = new Map()));
		MapMethods.set(byKey, key, crossed);
		return crossed;
	}

	/**
	 * Whether a value another module hands on is seen by its reader through a crossing view while the permission system is
	 * on: any object or function that holds, or can later be given, a reference to another object. Primitives, the
	 * language's own objects and functions, packages' and slothlet's own values, slothlet's views, and objects whose
	 * internal data holds no references and that hold nothing else (dates, regular expressions, buffers, typed arrays, boxed
	 * primitives, see {@link runtime_isPristineData}) pass as they are. A stand-in of another module's code is viewed like
	 * the code it stands for.
	 * @param {object|Function} value - The value.
	 * @param {object|null} [slothlet] - The instance it crosses in, whose `permissions.gating.buffers` decides whether a
	 *   typed array's own keys are listed.
	 * @returns {boolean} True when it is viewed.
	 * @private
	 */
	function runtime_needsCrossing(value, slothlet = null) {
		if (typeof value === "object" && runtime_unwrapClassInstance(value) !== value) return true;
		if (WeakMapMethods.has(STAND_IN_RECORDS, value)) return true;
		if (WeakSetMethods.has(INTRINSICS, value) || runtime_isSlothletValue(value) || runtime_isSharedValue(value)) return false;
		if (
			WeakMapMethods.has(SELF_MEMBER_VIEWS, value) ||
			WeakMapMethods.has(SELF_VIEW_NODES, value) ||
			WeakSetMethods.has(GUARD_VIEWS, value) ||
			WeakMapMethods.has(INBOUND_VIEWS, value)
		)
			return false;
		if (resolveWrapper(value) !== null || WeakMapMethods.has(capturedViewChildren, value) || isFrameworkInternal(value)) return false;
		if (typeof value === "function") return util.types.isProxy(value) || !runtime_isBuiltinFunction(value);
		if (util.types.isProxy(value)) return true;
		if (runtime_isOpaqueData(value)) return !runtime_isPristineData(value, slothlet);
		return true;
	}

	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	const crossing = WeakMapMethods.get(CROSSINGS, value);
	if (crossing) {
		value = crossing.original;
		from = crossing.from ?? from;
		slothlet ??= crossing.slothlet;
	}
	// A prototype's handle is the same object to every reader, and decides each access itself; code nothing could refuse
	// an access through it, the host among them, gets the object behind it.
	if (runtime_isPrototypeHandle(value)) return runtime_prototypeForHolder(slothlet, reader, value);
	if (reader === null || reader === undefined || reader === HOST_READER) return value;
	slothlet ??= reader?.slothlet ?? from?.slothlet ?? null;
	if (!runtime_guardOn(slothlet)) return value;
	const isModule = Boolean(reader.____slothletInternal);
	// A class instance a node holds, handed back by one of its own methods, stands for its node (#625): the reader gets
	// its view of the node, whose own write rule holds.
	if (isModule && typeof value === "object" && WeakMapMethods.has(SELF_INSTANCE_NODES, runtime_unwrapClassInstance(value)))
		return runtime_selfView(value, reader);
	// A stand-in comes from the module that made it. One of the reader's own module stays the stand-in here, as it is
	// between two functions of one module; handed in as an argument it becomes the value again (see runtime_handIn).
	const record = WeakMapMethods.get(STAND_IN_RECORDS, value);
	if (record) from ??= record.owner;
	// The async runtime's context wrapper of a class instance (#328) stands for the instance: the reader's own module's
	// comes back as the instance it made; another module's comes from that module.
	const creator = typeof value === "object" ? runtime_classInstanceCreator(value) : null;
	if (creator !== null) {
		if (isModule && runtime_asOneModule(slothlet, creator, reader)) return runtime_unwrapClassInstance(value);
		from ??= creator;
	}
	if (isModule && from !== null && runtime_asOneModule(slothlet, from, reader)) return value;
	// A function of the language's own a module handed over, handed on again, still runs for the module that handed it.
	if (crossing?.handed && isModule) return runtime_handedView(value, reader, slothlet, from);
	// A value the reader's own module held as itself when it handed it on comes back to it as itself.
	if (runtime_isOwnOrigin(value, reader)) return value;
	// A view already made of it for the reader's module is what the module holds, except in a function of the module
	// that may write everything at the path the value comes from: the view was made for another of the module's
	// functions, and this one gets the value itself, as it would have had it read the value first.
	const views = WeakMapMethods.get(CROSSING_VIEWS, value);
	if (views !== undefined) {
		const key = runtime_crossKey(reader);
		const held = views.key === key ? views.view : views.others == null ? undefined : MapMethods.get(views.others, key);
		if (held) {
			if (!isModule) return held;
			// The function the view was made for, and each one decided since, was refused the value itself already.
			// That answer holds for the rules it was given under: a rule added or removed since (or the system switched
			// off and on) has every function decided again.
			const state = WeakMapMethods.get(CROSSINGS, held);
			const epoch = slothlet.handlers.permissionManager.ruleEpoch;
			if (state.epoch !== epoch) {
				state.epoch = epoch;
				state.readerDecided = false;
				state.decided = null;
			}
			if (state.reader === reader ? state.readerDecided : state.decided ? WeakSetMethods.has(state.decided, reader) : false) return held;
			const itself = runtime_handedAsItselfFor(value, slothlet, reader, from);
			if (itself !== null) {
				if (itself === "writer") runtime_recordOrigin(value, from);
				return value;
			}
			if (state.reader === reader) state.readerDecided = true;
			else WeakSetMethods.add((state.decided ??= new WeakSet()), reader);
			return held;
		}
	}
	try {
		// A prototype handed out for a holder not known yet is decided for this one.
		const sealed = WeakMapMethods.get(SELF_MEMBER_VIEWS, value);
		if (sealed?.reader === SEALED_SHELL_READER) value = sealed.value;
		// The async runtime's context wrapper of a class instance (#328), and a stand-in, stand for a value: what it is
		// decides.
		const plain = record ? record.original : runtime_unwrapClassInstance(value);
		if (plain !== null && typeof plain === "object" && !util.types.isProxy(plain)) {
			if (
				WeakSetMethods.has(MODULE_PROTOTYPES, plain) ||
				runtime_knownPrototype(slothlet, plain) !== undefined ||
				runtime_isWrittenClassPrototype(plain)
			)
				return runtime_writtenPrototypeFor(plain, reader, slothlet, from);
		}
		if (!runtime_needsCrossing(value, slothlet)) return value;
		// A module that may write everything at the path the value comes from gets the value itself, as the owner does.
		// Handed back to the module it came from, it is that module's own value again. A module the value's module may
		// write gets a view all the same: the value's code is still its module's.
		// A function that runs no module's code is the module's that hands it on, however much the reader may write: it
		// stays a view, so what it writes is that module's to write too ({@link runtime_crossRun}).
		const itself = isModule ? runtime_handedAsItselfFor(value, slothlet, reader, from) : null;
		if (itself !== null) {
			if (itself === "writer") runtime_recordOrigin(value, from);
			return value;
		}
		// A promise the other module holds is viewed like any other object, not followed: no reaction is added to it
		// until the reader adds one through the view (`then`, `catch`, `await`), so whether its rejection counts as
		// handled is what the owner and the reader made it, as in plain JavaScript.
		if (record && typeof value === "object" && util.types.isPromise(value)) return runtime_crossPromise(value, reader, slothlet, from);
		return runtime_crossView(value, reader, slothlet, from);
	} catch (error) {
		// A refusal is the reader's answer. Anything else (a value that refuses to be described, a stack with no room
		// left) leaves the value undecided: it is viewed, never handed on as it is.
		if (runtime_inherits(error, SlothletError)) throw error;
		return runtime_crossView(value, reader, slothlet, from);
	}
}

/**
 * A crossing view (see {@link runtime_crossTo}): the value to every reflection, read and written through, with every
 * value read from it — a member, a prototype, a call's result or error, a member of a `Map` or `Set`, a `WeakRef`'s
 * target — reaching the reader as values another module hands on do, and every value the reader puts into it reaching
 * the module the value came from the same way. The view is lazy: nothing is searched when it is made, so a member the
 * owner stores later is seen as well. It stands over a shadow kept in step with the value for what the language fixes.
 * Data members stay the reader's to change; the value's code does not ({@link runtime_crossAssertWrite}).
 * @param {object|Function} original - The value.
 * @param {object} reader - Who it reaches.
 * @param {object} slothlet - The instance.
 * @param {object|null} from - The wrapper of the module it comes from.
 * @param {boolean} [handed] - A function of the language's or Node's own handed on as an argument
 *   ({@link runtime_handedView}), which keeps its views itself.
 * @returns {object|Function} The view, the same one for the same value and module every time.
 * @private
 */
function runtime_crossView(original, reader, slothlet, from, handed = false) {
	/**
	 * Record the prototypes some module wrote in the chain of a value crossing between modules (see
	 * {@link MODULE_PROTOTYPES}). Only the chain is read, which runs none of the value's code; a Proxy in it, the
	 * language's own prototypes and those of Node's and slothlet's own values end the walk.
	 * @param {object|Function} value - The value crossing, not a Proxy.
	 * @returns {void}
	 * @private
	 */
	function runtime_notePrototypes(value) {
		for (let link = Reflect.getPrototypeOf(value), depth = 0; link !== null && depth < 64; depth++) {
			if (
				WeakSetMethods.has(INTRINSICS, link) ||
				WeakSetMethods.has(MODULE_PROTOTYPES, link) ||
				util.types.isProxy(link) ||
				isSharedExport(link)
			)
				return;
			if (runtime_isSlothletValue(link)) return;
			WeakSetMethods.add(MODULE_PROTOTYPES, link);
			link = Reflect.getPrototypeOf(link);
		}
	}

	// The views of a value: its first module's held inline, any other module's in a map made only then.
	const key = runtime_crossKey(reader);
	const views = handed ? null : WeakMapMethods.get(CROSSING_VIEWS, original);
	if (views != null) {
		if (views.key === key) return views.view;
		const other = views.others == null ? undefined : MapMethods.get(views.others, key);
		if (other) return other;
	}
	const isFunction = typeof original === "function";
	// What the value inherits from that a module wrote is that module's code from here on, however it is reached.
	if (!util.types.isProxy(original)) runtime_notePrototypes(original);
	const shadow = isFunction
		? runtime_isConstructor(original)
			? FunctionMethods.bind(function () {}, null)
			: () => {}
		: Arrays.isArray(original)
			? []
			: Objects.create(CROSSING_SHADOW_PROTOTYPE);
	// `util.inspect` reads a Proxy's target, never its traps: the hook has to be the shadow's own, or inherited by it.
	if (CROSSING_INSPECT !== null && (isFunction || Arrays.isArray(original)))
		Reflect.defineProperty(shadow, INSPECT_CUSTOM, {
			__proto__: null,
			value: CROSSING_INSPECT,
			configurable: true,
			writable: true,
			enumerable: false
		});
	const state = {
		original,
		reader,
		slothlet,
		from,
		view: null,
		onOriginal: null,
		methods: null,
		pinned: false,
		// The function the view is made for was just refused the value itself, under the rules as they are now.
		epoch: slothlet?.handlers?.permissionManager?.ruleEpoch ?? 0,
		readerDecided: true,
		decided: null,
		handed
	};
	const view = new NativeProxy(shadow, CROSSING_HANDLER);
	state.view = view;
	WeakMapMethods.set(CROSSING_STATES, shadow, state);
	WeakMapMethods.set(CROSSINGS, view, state);
	if (handed) return view;
	if (views == null) WeakMapMethods.set(CROSSING_VIEWS, original, { key, view, reader, others: null });
	else MapMethods.set((views.others ??= new Map()), key, view);
	return view;
}

/**
 * The state of each crossing view, by its shadow (see {@link runtime_crossView}). `onOriginal` is whether the
 * language's and Node's own methods run on the value itself ({@link runtime_crossRunsOnOriginal}), told when first
 * asked; `methods` holds those methods as the view hands them out; `pinned` is whether the shadow holds anything;
 * `readerDecided` is whether the function the view was made for was found not to be handed the value itself, and
 * `decided` holds the other functions of its module found so, both under the rules as they were at `epoch` (the
 * permission manager's `ruleEpoch`): a rule change since has each decided again.
 * @type {WeakMap<object, {original: object, reader: object, slothlet: object, from: object|null, view: object, onOriginal: boolean|null, methods: WeakMap<Function, Function>|null, pinned: boolean, epoch: number, readerDecided: boolean, decided: WeakSet<object>|null}>}
 * @private
 */
const CROSSING_STATES = new WeakMap();

/**
 * A value read through a crossing view, as its reader gets it.
 * @param {object} state - The view's state.
 * @param {*} member - The value.
 * @returns {*} What the reader gets.
 * @private
 */
function runtime_crossOut(state, member) {
	if (member === null || (typeof member !== "object" && typeof member !== "function")) return member;
	return runtime_crossTo(member, state.reader, state.slothlet, state.from);
}

/**
 * A value the reader puts into the value behind a crossing view, as the module the value came from gets it (the host,
 * when none is known).
 * @param {object} state - The view's state.
 * @param {*} member - The value.
 * @returns {*} What is stored.
 * @private
 */
function runtime_crossIn(state, member) {
	if (member === null || (typeof member !== "object" && typeof member !== "function")) return member;
	if (member === state.view) return state.original;
	return runtime_crossTo(member, state.from ?? HOST_READER, state.slothlet, state.reader?.____slothletInternal ? state.reader : null);
}

/**
 * A descriptor of the value behind a crossing view, as the view reports it.
 * @param {object} state - The view's state.
 * @param {PropertyDescriptor|undefined} descriptor - The descriptor.
 * @returns {PropertyDescriptor|undefined} The reported descriptor.
 * @private
 */
function runtime_crossDescribe(state, descriptor) {
	if (!descriptor) return descriptor;
	const result = { ...descriptor };
	if ("value" in descriptor) result.value = runtime_crossOut(state, descriptor.value);
	else {
		if ("get" in descriptor) result.get = runtime_crossOut(state, descriptor.get);
		if ("set" in descriptor) result.set = runtime_crossOut(state, descriptor.set);
	}
	return result;
}

/**
 * Keep a crossing view's shadow in step with a member the language fixes: one the value holds fixed, or any member once
 * the shadow is closed, where what it holds is what the view has to report.
 * @param {object} shadow - The shadow.
 * @param {object} state - The view's state.
 * @param {string|symbol} prop - The member.
 * @param {PropertyDescriptor|undefined} descriptor - Its reported descriptor.
 * @returns {void}
 * @private
 */
function runtime_crossSync(shadow, state, prop, descriptor) {
	const open = Reflect.isExtensible(shadow);
	if (!descriptor) {
		if (!open) Reflect.deleteProperty(shadow, prop);
		return;
	}
	if (descriptor.configurable && open) return;
	if (!open && !Reflect.getOwnPropertyDescriptor(shadow, prop)) return;
	if (Reflect.defineProperty(shadow, prop, descriptor)) state.pinned = true;
}

/**
 * The prototype a crossing view reports: a prototype some module wrote is code, never data, whether or not a class
 * owns it, and reaches the reader checked ({@link runtime_writtenPrototypeFor}).
 * @param {object} state - The view's state.
 * @param {object|null} raw - The prototype of the value behind the view.
 * @returns {object|null} What the reader gets.
 * @private
 */
function runtime_crossPrototype(state, raw) {
	if (raw === null || (typeof raw !== "object" && typeof raw !== "function")) return raw;
	// A stand-in's prototype for a holder not known yet, and the context wrapper of one, stand for the prototype.
	const sealed = WeakMapMethods.get(SELF_MEMBER_VIEWS, raw);
	const standIn = WeakMapMethods.get(STAND_IN_RECORDS, raw);
	if (sealed?.reader === PROTOTYPE_HANDLE_READER) return raw;
	const prototype = sealed?.reader === SEALED_SHELL_READER ? sealed.value : standIn ? standIn.original : runtime_unwrapClassInstance(raw);
	if (
		typeof prototype === "object" &&
		!util.types.isProxy(prototype) &&
		!WeakSetMethods.has(INTRINSICS, prototype) &&
		!runtime_isSharedValue(prototype) &&
		!runtime_isSlothletValue(prototype)
	)
		return runtime_atClassSite(state.slothlet, runtime_writtenPrototypeFor(prototype, state.reader, state.slothlet, state.from));
	return runtime_crossOut(state, raw);
}

/**
 * Make a closed value's crossing view report what the language fixes: its shadow holds every member, as the reader gets
 * it, and its prototype, and is closed too. Run again for a shadow already closed, it brings the shadow up to date with
 * what the owner changed since: a member's value, or a member removed.
 * @param {object} shadow - The shadow.
 * @param {object} state - The view's state.
 * @returns {void}
 * @private
 */
function runtime_crossSettle(shadow, state) {
	const keys = Reflect.ownKeys(state.original);
	const open = Reflect.isExtensible(shadow);
	for (let ofIndex = 0, ofList = Reflect.ownKeys(shadow); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (!ArrayMethods.includes(keys, key) && key !== INSPECT_CUSTOM) Reflect.deleteProperty(shadow, key);
	}
	for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (!open && !Reflect.getOwnPropertyDescriptor(shadow, key)) continue;
		const descriptor = runtime_crossDescribe(state, Reflect.getOwnPropertyDescriptor(state.original, key));
		if (descriptor) Reflect.defineProperty(shadow, key, descriptor);
	}
	state.pinned = true;
	if (!open) return;
	Reflect.setPrototypeOf(shadow, runtime_crossPrototype(state, Reflect.getPrototypeOf(state.original)));
	Reflect.preventExtensions(shadow);
}

/**
 * One of the language's or Node's own methods read through a crossing view of a value they run on
 * ({@link runtime_crossRunsOnOriginal}): it runs on the value itself, its results handed on to the reader and what the
 * reader passes it handed to the module the value came from. A callback the engine calls back with what the value holds
 * gets each of those as the reader gets it. Null for any other value read.
 * @param {object} state - The view's state.
 * @param {*} fn - The value read.
 * @returns {Function|null} The method, the same each read.
 * @private
 */
function runtime_crossEngineMethod(state, fn) {
	/**
	 * Whether the language's and Node's own methods read through a crossing view run on the value itself rather than on the
	 * view: an object with internal slots (a `Map`, a `Set`, a `WeakRef`, a date, an iterator, a boxed primitive), whose
	 * methods work only on the object, and an instance of a class no module wrote (a `URL`, an emitter, a stream), whose
	 * methods check the object they are called on. A plain object, an array and a function take them through the view.
	 * @param {object} state - The view's state.
	 * @returns {boolean} True when they run on the value.
	 * @private
	 */
	function runtime_crossRunsOnOriginal(state) {
		if (state.onOriginal !== null) return state.onOriginal;
		const { original } = state;
		let answer = false;
		if (typeof original !== "function" && !util.types.isProxy(original)) {
			const types = util.types;
			answer =
				runtime_hasInternalSlots(original) ||
				runtime_isNativeIterator(original) ||
				types.isMapIterator(original) ||
				types.isSetIterator(original) ||
				types.isGeneratorObject(original) ||
				types.isBoxedPrimitive(original);
			// A prototype of the language's or Node's own other than a plain object's or an array's: a class no module wrote,
			// or a module's subclass of one.
			for (let link = Reflect.getPrototypeOf(original), depth = 0; !answer && link !== null && depth < 64; depth++) {
				if (util.types.isProxy(link) || link === Objects.prototype || link === Arrays.prototype) break;
				if (WeakSetMethods.has(INTRINSICS, link) || runtime_isSharedValue(link)) answer = true;
				link = Reflect.getPrototypeOf(link);
			}
		}
		state.onOriginal = answer;
		return answer;
	}

	if (typeof fn !== "function" || util.types.isProxy(fn)) return null;
	if (!(WeakSetMethods.has(INTRINSICS, fn) || runtime_isBuiltinFunction(fn) || isSharedExport(fn))) return null;
	if (!runtime_crossRunsOnOriginal(state)) return null;
	const { original } = state;
	state.methods ??= new WeakMap();
	let method = WeakMapMethods.get(state.methods, fn);
	if (!method) {
		const name = fn.name;
		const callsBack = SetMethods.has(SLOT_CALLBACK_METHODS, engineThenOf(fn) ?? fn);
		// A step of one of the language's own iterators answers with an object the engine makes for that step.
		const steps =
			(name === "next" || name === "return" || name === "throw") &&
			(WeakSetMethods.has(INTRINSICS, fn) || runtime_isBuiltinFunction(fn)) &&
			(runtime_isNativeIterator(original) ||
				util.types.isMapIterator(original) ||
				util.types.isSetIterator(original) ||
				util.types.isGeneratorObject(original));
		method = {
			[name](...args) {
				const receiver = this === state.view ? original : this;
				const handed = mapList(args, (arg) =>
					callsBack && typeof arg === "function"
						? function (...values) {
								return runtime_crossIn(
									state,
									Reflect.apply(
										arg,
										this === original ? state.view : this,
										mapList(values, (item) => runtime_crossOut(state, item))
									)
								);
							}
						: runtime_crossIn(state, arg)
				);
				let result;
				try {
					result = Reflect.apply(fn, receiver, handed);
				} catch (error) {
					throw runtime_crossOut(state, error);
				}
				// The step's result is no one's value: the reader gets a result of its own, holding what the step gave as
				// the reader gets it. Viewing the result itself would make a view for every element stepped over.
				if (steps && runtime_isStepResult(result)) return { value: runtime_crossOut(state, result.value), done: result.done };
				// An async generator's step settles to such a result: the reader's promise settles to a result of its own (#758).
				if (steps && util.types.isPromise(result)) {
					return Reflect.apply(SLOT_READERS.then, result, [
						(settled) =>
							runtime_isStepResult(settled)
								? { value: runtime_crossOut(state, settled.value), done: settled.done }
								: runtime_crossOut(state, settled),
						(reason) => Promises.reject(runtime_crossOut(state, reason))
					]);
				}
				return runtime_crossOut(state, result);
			}
		}[name];
		WeakMapMethods.set(state.methods, fn, method);
	}
	return method;
}

/**
 * The value a crossing view's members are decided on: a stand-in, and the async runtime's context wrapper, stand for
 * the value behind them.
 * @param {object|Function} original - The value behind the view.
 * @returns {object|Function} The value whose members decide.
 * @private
 */
function runtime_crossSubject(original) {
	return WeakMapMethods.get(STAND_IN_RECORDS, original)?.original ?? runtime_unwrapClassInstance(original);
}

/**
 * Refuse a change through a crossing view that would change code of the module the value came from, unless whoever
 * makes it may write that module's path: the view's reader and the module executing both have to be allowed, so a
 * function another module runs for the reader gets it nothing. Data stays the reader's to change. Code is:
 *
 * - everything about a function (a class's statics, its `prototype`, its own prototype);
 * - everything about an object slothlet has seen a module use as a prototype ({@link MODULE_PROTOTYPES}), handed on
 *   as data: a member replaced, added or removed;
 * - the prototype of any value (`Object.setPrototypeOf`);
 * - a member of the value's own holding a function or accessor the reader's module did not put there (replaced,
 *   redefined or deleted), except an assignment its own setter takes;
 * - a member a prototype some module wrote holds as a function or accessor (shadowed by a member of the value's own),
 *   except an assignment its setter takes.
 * @param {object} state - The view's state.
 * @param {string|symbol|null} prop - The member changed, or null for the value as a whole.
 * @param {"set"|"define"|"delete"|"prototype"} change - The change.
 * @returns {void}
 * @throws {SlothletError} `LOOSE_SET_NOT_OWNED` or `PERMISSION_DENIED` when it is refused, `LOOSE_SET_UNATTRIBUTED` for
 *   code the live runtime cannot attribute.
 * @private
 */
function runtime_crossAssertWrite(state, prop, change) {
	/**
	 * Whether a member of the value behind a crossing view is code of the module the value came from: a function, or an
	 * accessor, that the reader's module did not put there itself.
	 * @param {object} state - The view's state.
	 * @param {PropertyDescriptor} descriptor - The member's descriptor on the value.
	 * @returns {boolean} True for the owner's code.
	 * @private
	 */
	function runtime_crossIsOwnersCode(state, descriptor) {
		if (!("value" in descriptor)) return true;
		const held = descriptor.value;
		if (typeof held !== "function") return false;
		// A function the reader's module stored there is the reader's to replace.
		const crossing = WeakMapMethods.get(CROSSINGS, held);
		if (crossing) return !(crossing.from !== null && state.reader?.____slothletInternal && runtime_sameModule(crossing.from, state.reader));
		return !runtime_isOwnOrigin(held, state.reader);
	}

	const { original, slothlet } = state;
	if (!slothlet?.handlers?.apiManager?.ownershipEnforced?.()) return;
	// A stand-in, and the async runtime's context wrapper, stand for the value whose members decide.
	const subject = runtime_crossSubject(original);
	// A function, and an object some module uses as a prototype, are code whole: every member, new ones included.
	let held = typeof original === "function" || change === "prototype" || WeakSetMethods.has(MODULE_PROTOTYPES, subject);
	if (!held && !util.types.isProxy(subject)) {
		const own = Reflect.getOwnPropertyDescriptor(subject, prop);
		if (own) {
			held = runtime_crossIsOwnersCode(state, own) && !(change === "set" && !("value" in own) && typeof own.set === "function");
		} else if (change !== "delete") {
			for (let link = Reflect.getPrototypeOf(subject), depth = 0; link !== null && depth < 64; depth++) {
				if (util.types.isProxy(link) || WeakSetMethods.has(INTRINSICS, link) || runtime_isSharedValue(link)) break;
				const inherited = Reflect.getOwnPropertyDescriptor(link, prop);
				if (inherited) {
					const isCode = !("value" in inherited) || typeof inherited.value === "function";
					held = isCode && !(change === "set" && !("value" in inherited) && typeof inherited.set === "function");
					break;
				}
				link = Reflect.getPrototypeOf(link);
			}
		}
	}
	if (!held) return;
	const parts = runtime_crossFromParts(state.from);
	if (typeof prop === "string") listPush(parts, prop);
	const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
	if (identity?.unresolved) {
		throw new slothlet.SlothletError("LOOSE_SET_UNATTRIBUTED", { path: segmentsOf(ArrayMethods.join(parts, ".")) });
	}
	const writers = new Set();
	if (state.reader?.____slothletInternal) SetMethods.add(writers, state.reader);
	if (identity?.currentWrapper) {
		SetMethods.add(writers, identity.currentWrapper);
		for (let i = 0, ceilings = identityCeilings(identity); i < ceilings.length; i++) SetMethods.add(writers, ceilings[i]);
	}
	for (const writer of setValues(writers)) slothlet.handlers.apiManager.assertOwnedWrite(parts, writer);
}

/**
 * What `util.inspect` prints for a crossing view: the value behind it, printed by slothlet's own inspector, so a view
 * shows as the value does in a log. `util.inspect` calls it with the view as `this`. Nothing of the value is handed to
 * the reader but the text. Null where there is no inspector (a browser).
 * @type {Function|null}
 * @private
 */
const CROSSING_INSPECT = isNode
	? function slothlet_crossInspect(depth, options) {
			const state = WeakMapMethods.get(CROSSINGS, this);
			if (!state) return this;
			const behind = WeakMapMethods.get(STAND_IN_RECORDS, state.original)?.original ?? runtime_unwrapClassInstance(state.original);
			return util.inspect(behind, { ...options, depth: typeof depth === "number" ? depth : (options?.depth ?? 2) });
		}
	: null;

/**
 * What the shadow of a crossing view of a plain object inherits from: only the inspect hook, so making a view defines
 * nothing on its shadow.
 * @type {object}
 * @private
 */
const CROSSING_SHADOW_PROTOTYPE = Objects.create(
	null,
	CROSSING_INSPECT === null
		? {}
		: { [INSPECT_CUSTOM]: { __proto__: null, value: CROSSING_INSPECT, configurable: true, writable: true, enumerable: false } }
);

/**
 * The traps of every crossing view (see {@link runtime_crossView}), each finding its view's state by the shadow.
 * @type {ProxyHandler<object>}
 * @private
 */
const CROSSING_HANDLER = {
	get(shadow, prop, receiver) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		if (state.pinned) {
			if (!Reflect.isExtensible(shadow)) runtime_crossSettle(shadow, state);
			const held = Reflect.getOwnPropertyDescriptor(shadow, prop);
			if (held && !held.configurable && "value" in held && !held.writable) return held.value;
		}
		const { original } = state;
		const own = receiver === state.view;
		// A private member the value inherits from a module's prototype is read as through that prototype.
		runtime_inheritedPrivate(state.slothlet, runtime_crossSubject(original), prop)?.refusePrivate(prop);
		const value = Reflect.get(original, prop, own ? original : receiver);
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
		const fixed = Reflect.getOwnPropertyDescriptor(original, prop);
		if (fixed && !fixed.configurable) runtime_crossSync(shadow, state, prop, runtime_crossDescribe(state, fixed));
		// The prototype read by its accessor is the prototype, as `Object.getPrototypeOf` reports it.
		if (prop === "__proto__" && !fixed) {
			const prototype = Reflect.getPrototypeOf(original);
			if (prototype === value || WeakMapMethods.has(STAND_IN_RECORDS, original)) return runtime_crossPrototype(state, prototype);
		}
		if (own) {
			const handed = runtime_crossHandedMember(state, prop, value);
			if (handed !== undefined) return handed;
		}
		return runtime_crossEngineMethod(state, value) ?? runtime_crossOut(state, value);
	},
	set(shadow, prop, value, receiver) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		const own = receiver === state.view;
		if (own) {
			if (prop === "__proto__" && !Reflect.getOwnPropertyDescriptor(state.original, prop))
				runtime_crossAssertWrite(state, null, "prototype");
			else runtime_crossAssertWrite(state, prop, "set");
		}
		const into = own ? state.original : runtime_crossIn(state, receiver);
		const done = Reflect.set(state.original, prop, runtime_crossIn(state, value), into);
		const fixed = Reflect.getOwnPropertyDescriptor(state.original, prop);
		if (fixed && (!fixed.configurable || state.pinned)) runtime_crossSync(shadow, state, prop, runtime_crossDescribe(state, fixed));
		return done;
	},
	has(shadow, prop) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		if (state.pinned && !Reflect.isExtensible(shadow)) runtime_crossSettle(shadow, state);
		if (runtime_inheritedPrivate(state.slothlet, runtime_crossSubject(state.original), prop)?.privateHidden(prop)) return false;
		return Reflect.has(state.original, prop);
	},
	deleteProperty(shadow, prop) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		runtime_crossAssertWrite(state, prop, "delete");
		const done = Reflect.deleteProperty(state.original, prop);
		if (done && state.pinned) Reflect.deleteProperty(shadow, prop);
		return done;
	},
	ownKeys(shadow) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		if (!Reflect.isExtensible(state.original) || !Reflect.isExtensible(shadow)) runtime_crossSettle(shadow, state);
		if (!Reflect.isExtensible(shadow)) return Reflect.ownKeys(shadow);
		const keys = Reflect.ownKeys(state.original);
		if (state.pinned)
			for (let ofIndex = 0, ofList = Reflect.ownKeys(shadow); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				if (!ArrayMethods.includes(keys, key) && !Reflect.getOwnPropertyDescriptor(shadow, key)?.configurable) listPush(keys, key);
			}
		return keys;
	},
	getOwnPropertyDescriptor(shadow, prop) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		if (!Reflect.isExtensible(state.original) || !Reflect.isExtensible(shadow)) {
			runtime_crossSettle(shadow, state);
			return Reflect.getOwnPropertyDescriptor(shadow, prop);
		}
		const result = runtime_crossDescribe(state, Reflect.getOwnPropertyDescriptor(state.original, prop));
		runtime_crossSync(shadow, state, prop, result);
		return result;
	},
	defineProperty(shadow, prop, descriptor) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		runtime_crossAssertWrite(state, prop, "define");
		const into = { ...descriptor };
		if ("value" in descriptor) into.value = runtime_crossIn(state, descriptor.value);
		if ("get" in descriptor) into.get = runtime_crossIn(state, descriptor.get);
		if ("set" in descriptor) into.set = runtime_crossIn(state, descriptor.set);
		const done = Reflect.defineProperty(state.original, prop, into);
		if (done) runtime_crossSync(shadow, state, prop, runtime_crossDescribe(state, Reflect.getOwnPropertyDescriptor(state.original, prop)));
		return done;
	},
	getPrototypeOf(shadow) {
		if (!Reflect.isExtensible(shadow)) return Reflect.getPrototypeOf(shadow);
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		return runtime_crossPrototype(state, Reflect.getPrototypeOf(state.original));
	},
	setPrototypeOf(shadow, prototype) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		// The prototype it already reports changes nothing.
		const reported = Reflect.isExtensible(shadow)
			? runtime_crossPrototype(state, Reflect.getPrototypeOf(state.original))
			: Reflect.getPrototypeOf(shadow);
		if (reported === prototype) return true;
		if (!Reflect.isExtensible(shadow)) return false;
		runtime_crossAssertWrite(state, null, "prototype");
		return Reflect.setPrototypeOf(state.original, runtime_crossIn(state, prototype));
	},
	isExtensible(shadow) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		if (!Reflect.isExtensible(state.original)) runtime_crossSettle(shadow, state);
		return Reflect.isExtensible(shadow);
	},
	preventExtensions(shadow) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		if (typeof state.original === "function") runtime_crossAssertWrite(state, null, "prototype");
		const done = Reflect.preventExtensions(state.original);
		if (done) runtime_crossSettle(shadow, state);
		return done;
	},
	apply(shadow, thisArg, args) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		let result;
		try {
			const receiver = runtime_crossIn(state, thisArg);
			// A node's own function, or a module's copy of it, is a call of the node whoever runs it.
			runtime_gateLeafCopy(state.slothlet, state.original, args, receiver, true);
			// A function of the engine's own the runner gives one that runs for the module that handed it (a scheduler, a
			// promise's `then`) runs for that module too, whenever it is called back.
			const forHander = runtime_crossRunsForHander(state);
			const given = mapList(args, (arg) => {
				const behind = forHander ? runtime_uncross(arg) : arg;
				return forHander && runtime_runsForHander(behind, state.from)
					? runtime_handedView(behind, state.reader, state.slothlet, state.from)
					: runtime_crossIn(state, arg);
			});
			result = runtime_crossRun(state, () => Reflect.apply(state.original, receiver, given));
		} catch (error) {
			throw runtime_crossOut(state, error);
		}
		return runtime_crossOut(state, result);
	},
	construct(shadow, args, newTarget) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		runtime_gateLeafCopy(state.slothlet, state.original, args, undefined, true);
		let target = state.original;
		if (newTarget !== state.view) {
			// A class the reader constructs for is its own: what it makes the instance's prototype is the reader's.
			target = runtime_uncross(newTarget);
			if (state.reader?.____slothletInternal && typeof target === "function") {
				runtime_recordOrigin(target, state.reader);
				const prototype = Reflect.getOwnPropertyDescriptor(target, "prototype")?.value;
				if (prototype !== null && typeof prototype === "object") runtime_recordOrigin(prototype, state.reader);
			}
		}
		let result;
		try {
			result = Reflect.construct(
				state.original,
				mapList(args, (arg) => runtime_crossIn(state, arg)),
				target
			);
		} catch (error) {
			throw runtime_crossOut(state, error);
		}
		return runtime_crossOut(state, result);
	}
};

/**
 * A segment no api path holds, standing for every member beneath a path in {@link runtime_readsNothingBeneath}.
 * @type {string}
 * @private
 */
const ANY_MEMBER_SEGMENT = "\u0000member";

/**
 * The api path of a node's member: the member's own name at the api root, whose path is empty.
 * @param {object} wrapper - The node's wrapper, or the api root's gate (see {@link runtime_rootGate}).
 * @param {string|symbol} prop - The member's key.
 * @returns {string} The member's path.
 * @private
 */
function runtime_memberPathOf(wrapper, prop) {
	const base = wrapper.____slothletInternal.apiPath;
	return base ? base + "." + String(prop) : String(prop);
}

/** Whether {@link MembraneLayer} has built its class: it builds one, for the wrapper's chain. @type {boolean} */
let built = false;

/**
 * Build this layer of the wrapper class over `Base`, once (see `unified-wrapper.mjs`).
 * @param {Function} Base - The class below this layer.
 * @returns {Function} The layer's class.
 * @internal
 */
export function MembraneLayer(Base) {
	if (built) throw ownBindingsRefusal("lib/handlers/unified-wrapper/membrane", import.meta.url);
	built = true;
	return Base.layer(
		class Membrane extends Base {
			static {
				Base.define("membrane", {
					INSPECT_CUSTOM,
					SEALED_SHELL_READER,
					runtime_behindGivenView,
					runtime_givenAsIs,
					runtime_givenMember,
					runtime_givenPrototypeFor,
					runtime_givenViewOn,
					STAND_IN_RECORDS,
					INBOUND_VIEWS,
					searchDepth,
					searchBudget,
					runtime_attributeResult,
					runtime_membrane,
					runtime_constructAsNode,
					HOST_HANDED,
					runtime_ownArguments,
					runtime_frontingNodeNow,
					runtime_functionNodePrototype,
					runtime_functionNodeFor,
					runtime_knownPrototype,
					runtime_carryTo,
					CROSSINGS,
					runtime_guardOn,
					runtime_uncross,
					CROSSING_ORIGINS,
					runtime_recordOrigin,
					runtime_asOneModule,
					runtime_crossTo,
					ANY_MEMBER_SEGMENT,
					runtime_memberPathOf,
					runtime_crossArgumentsFrom
				});
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					INTRINSICS = methods.values.INTRINSICS;
					runtime_hasInternalSlots = methods.values.runtime_hasInternalSlots;
					runtime_holdsCode = methods.values.runtime_holdsCode;
					runtime_inheritedPrivate = methods.values.runtime_inheritedPrivate;
					runtime_inherits = methods.values.runtime_inherits;
					runtime_isBindingMethod = methods.values.runtime_isBindingMethod;
					runtime_isBuiltinFunction = methods.values.runtime_isBuiltinFunction;
					runtime_isCarrier = methods.values.runtime_isCarrier;
					runtime_isCodeObject = methods.values.runtime_isCodeObject;
					runtime_isConstructor = methods.values.runtime_isConstructor;
					runtime_isModuleProxy = methods.values.runtime_isModuleProxy;
					runtime_isNativeIterator = methods.values.runtime_isNativeIterator;
					runtime_isOwnOrigin = methods.values.runtime_isOwnOrigin;
					runtime_isPrototypeHandle = methods.values.runtime_isPrototypeHandle;
					runtime_isShared = methods.values.runtime_isShared;
					runtime_isSharedValue = methods.values.runtime_isSharedValue;
					runtime_isSlothletValue = methods.values.runtime_isSlothletValue;
					runtime_isSlotObject = methods.values.runtime_isSlotObject;
					runtime_isStepResult = methods.values.runtime_isStepResult;
					runtime_isTerminalData = methods.values.runtime_isTerminalData;
					runtime_ownsPrototype = methods.values.runtime_ownsPrototype;
					VM_NATIVE_SCRIPT = methods.values.VM_NATIVE_SCRIPT;
					VM_SCRIPT = methods.values.VM_SCRIPT;
					FUNCTION_NODES = methods.nodes.FUNCTION_NODES;
					MAKERS = methods.nodes.MAKERS;
					nodeRefOf = methods.nodes.nodeRefOf;
					runtime_classPrototypeSites = methods.nodes.runtime_classPrototypeSites;
					runtime_exposePrototype = methods.nodes.runtime_exposePrototype;
					runtime_makerOf = methods.nodes.runtime_makerOf;
					runtime_moduleKey = methods.nodes.runtime_moduleKey;
					runtime_prototypeForHolder = methods.nodes.runtime_prototypeForHolder;
					runtime_prototypeGiven = methods.nodes.runtime_prototypeGiven;
					runtime_prototypeHandedTo = methods.nodes.runtime_prototypeHandedTo;
					runtime_assertOwnedWrite = methods.rules.runtime_assertOwnedWrite;
					runtime_gateLeafCopy = methods.rules.runtime_gateLeafCopy;
					runtime_memberHoldsCode = methods.rules.runtime_memberHoldsCode;
					runtime_readGateDecision = methods.rules.runtime_readGateDecision;
					runtime_readGateFor = methods.rules.runtime_readGateFor;
					runtime_recordedPrototype = methods.run.runtime_recordedPrototype;
					runtime_runAsMaker = methods.run.runtime_runAsMaker;
					runtime_runningLeafOf = methods.run.runtime_runningLeafOf;
					runtime_runsForHander = methods.run.runtime_runsForHander;
					runtime_runsNoModuleCode = methods.run.runtime_runsNoModuleCode;
					capturedViewChildren = methods.views.capturedViewChildren;
					GIVEN_VIEWS = methods.views.GIVEN_VIEWS;
					GUARD_VIEWS = methods.views.GUARD_VIEWS;
					HOST_READER = methods.views.HOST_READER;
					PROTOTYPE_HANDLE_READER = methods.views.PROTOTYPE_HANDLE_READER;
					PROTOTYPE_PATHS = methods.views.PROTOTYPE_PATHS;
					runtime_atClassSite = methods.views.runtime_atClassSite;
					runtime_behindMemberView = methods.views.runtime_behindMemberView;
					runtime_capturedView = methods.views.runtime_capturedView;
					runtime_frontingNode = methods.views.runtime_frontingNode;
					runtime_permissionsOn = methods.views.runtime_permissionsOn;
					runtime_sameModule = methods.views.runtime_sameModule;
					runtime_selfMemberOf = methods.views.runtime_selfMemberOf;
					runtime_selfModuleReader = methods.views.runtime_selfModuleReader;
					runtime_selfReader = methods.views.runtime_selfReader;
					runtime_selfView = methods.views.runtime_selfView;
					runtime_unwrapSelfView = methods.views.runtime_unwrapSelfView;
					SELF_INSTANCE_NODES = methods.views.SELF_INSTANCE_NODES;
					SELF_MEMBER_VIEWS = methods.views.SELF_MEMBER_VIEWS;
					SELF_VIEW_NODES = methods.views.SELF_VIEW_NODES;
					ACTING_FOR = methods.uw.ACTING_FOR;
					isLeafFileFunction = methods.uw.isLeafFileFunction;
					resolveWrapper = methods.uw.resolveWrapper;
					runtime_classInstanceCreator = methods.uw.runtime_classInstanceCreator;
					runtime_unwrapClassInstance = methods.uw.runtime_unwrapClassInstance;
					trustedRootOwn = methods.uw.trustedRootOwn;
					leafOfCopy = methods.uw.leafOfCopy;
					runtime_constructorReadMayRefuse = methods.nodes.runtime_constructorReadMayRefuse;
					CLASS_INSTANCES = methods.nodes.CLASS_INSTANCES;
					WELL_KNOWN_SYMBOLS = methods.values.WELL_KNOWN_SYMBOLS;
					TYPED_ARRAY_BYTE_LENGTH = methods.values.TYPED_ARRAY_BYTE_LENGTH;
					TYPED_ARRAY_LENGTH = methods.values.TYPED_ARRAY_LENGTH;
					runtime_readerHoldsPrototype = methods.nodes.runtime_readerHoldsPrototype;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/membrane", import.meta.url);
				super(slothlet);
			}
		}
	);
}
