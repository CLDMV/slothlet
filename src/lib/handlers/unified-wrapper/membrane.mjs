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
	isPrototypeHandle,
	unwrapSelfView,
	selfReader,
	selfModuleReader,
	SELF_MEMBER_VIEWS,
	hasInternalSlots,
	inherits,
	selfMemberOf,
	ACTING_FOR,
	runsNoModuleCode,
	runsForHander,
	inheritedPrivate,
	selfView,
	assertOwnedWrite,
	isTerminalData,
	readGateDecision,
	readGateFor,
	GIVEN_VIEWS,
	recordedPrototype,
	prototypeGiven,
	ownsPrototype,
	MAKERS,
	INTRINSICS,
	isBindingMethod,
	isSharedValue,
	isSlothletValue,
	isModuleProxy,
	isBuiltinFunction,
	makerOf,
	runAsMaker,
	isSlotObject,
	isNativeIterator,
	VM_SCRIPT,
	VM_NATIVE_SCRIPT,
	memberHoldsCode,
	holdsCode,
	gateLeafCopy,
	isCodeObject,
	isShared,
	permissionsOn,
	runningLeafOf,
	exposePrototype,
	FUNCTION_NODES,
	nodeRefOf,
	frontingNode,
	classPrototypeSites,
	prototypeForHolder,
	atClassSite,
	PROTOTYPE_PATHS,
	prototypeHandedTo,
	isCarrier,
	moduleKey,
	sameModule,
	isOwnOrigin,
	isStepResult,
	behindMemberView,
	GUARD_VIEWS,
	capturedViewChildren,
	isConstructor,
	capturedView,
	resolveWrapper,
	leafOfCopy,
	constructorReadMayRefuse,
	CLASS_INSTANCES,
	WELL_KNOWN_SYMBOLS,
	TYPED_ARRAY_BYTE_LENGTH,
	TYPED_ARRAY_LENGTH,
	readerHoldsPrototype;
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
function crossRun(state, run) {
	if (!crossRunsForHander(state)) return run();
	listPush(ACTING_FOR, state.from);
	try {
		return run();
	} finally {
		ArrayMethods.pop(ACTING_FOR);
	}
}

/**
 * Whether a crossing view's function runs for the module that handed it over ({@link crossRun}).
 * @param {object} state - The crossing view's state.
 * @returns {boolean} True when it does.
 * @private
 */
function crossRunsForHander(state) {
	if (!state.from?.____slothletInternal || typeof state.original !== "function") return false;
	return state.handed || runsNoModuleCode(state.original);
}

/**
 * A member of its own a crossing view hands its reader, when it is a function that runs for the module the value came
 * from ({@link runsForHander}): its view, which runs it for that module ({@link handedView}), as when the
 * module hands it over as an argument. `undefined` for any other member.
 * @param {object} state - The crossing view's state.
 * @param {string|symbol} prop - The member.
 * @param {*} value - What it holds.
 * @returns {Function|undefined} The view, or `undefined`.
 * @private
 */
function crossHandedMember(state, prop, value) {
	if (typeof value !== "function" || WeakMapMethods.has(CROSSINGS, value) || !state.reader?.____slothletInternal) return undefined;
	if (!runsForHander(value, state.from) || !guardOn(state.slothlet)) return undefined;
	const own = Reflect.getOwnPropertyDescriptor(state.original, prop);
	if (!own || !("value" in own) || own.value !== value) return undefined;
	return handedView(value, state.reader, state.slothlet, state.from);
}

/**
 * The views of functions of the language's and Node's own that modules handed to others ({@link handedView}):
 * by function, then by the module handing it, then by the reader. One function is handed by many modules, and each view
 * runs for the module that handed it.
 * @type {WeakMap<Function, WeakMap<object, Map<*, Function>>>}
 * @private
 */
const HANDED_VIEWS = new WeakMap();

/**
 * A function of the language's or Node's own (`Reflect.set`, `util._extend`) that one module hands another as an
 * argument, as the other gets it: a view that runs it for the module that handed it ({@link crossRun}), with
 * what the reader calls it with reaching that module, so a target the reader holds as itself is the handing module's
 * view of it again. Such a function shared by everyone passes between modules as itself everywhere else.
 * @param {Function} fn - The function.
 * @param {object} reader - The wrapper of the module it is handed to.
 * @param {object} slothlet - The instance.
 * @param {object} from - The wrapper of the module handing it.
 * @returns {Function} The view, the same one for the same function, module and reader every time.
 * @private
 */
function handedView(fn, reader, slothlet, from) {
	let byFrom = WeakMapMethods.get(HANDED_VIEWS, fn);
	if (!byFrom) WeakMapMethods.set(HANDED_VIEWS, fn, (byFrom = new WeakMap()));
	let byReader = WeakMapMethods.get(byFrom, from);
	if (!byReader) WeakMapMethods.set(byFrom, from, (byReader = new Map()));
	const key = crossKey(reader);
	const held = MapMethods.get(byReader, key);
	if (held) return held;
	const view = crossView(fn, reader, slothlet, from, true);
	MapMethods.set(byReader, key, view);
	return view;
}

/**
 * The object a view of a given prototype stands for ({@link givenView}), or the value itself when it is no
 * such view: a view handed back in (`Object.setPrototypeOf(node, view)`) is the object.
 * @param {*} value - The value.
 * @returns {*} What is behind it.
 * @private
 */
function behindGivenView(value) {
	return WeakMapMethods.get(GIVEN_VIEWS, value)?.value ?? value;
}

/**
 * Whether a value handed out of a given prototype is handed out as it is: nothing a view is made of, one of
 * slothlet's own values, or the language's own.
 * @param {*} value - The value.
 * @returns {boolean} True when it is.
 * @private
 */
function givenAsIs(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return true;
	return WeakSetMethods.has(INTRINSICS, value) || isSlothletValue(value) || WeakMapMethods.has(GIVEN_VIEWS, value);
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
function givenReadDecision(record, prop, target = memberPathOf(record.gate, prop)) {
	const { gate, reader } = record;
	const pm = gate.slothlet.handlers?.permissionManager;
	if (!pm || !pm.isEnabled() || !pm.isReadGatingEnabled()) return { allowed: true, caller: null, target };
	const live = readGateDecision(gate, target, undefined);
	if (!live.allowed || live.caller !== null || !reader?.____slothletInternal) return { ...live, target };
	if (gate.slothlet.handlers.apiManager.isRemovedCaller(reader)) {
		return { allowed: false, caller: String(reader.____slothletInternal.apiPath ?? ""), target };
	}
	return { ...readGateFor(gate, target, reader, { context: null }), target };
}

/**
 * Whether a member a given prototype holds is left out of what its view lists and describes: data the reader may not
 * read, and a getter whose path it may not read, as a node leaves them out of its own listing (see
 * {@link isReadRedacted}), and, from a listing, an object member the reader may read nothing beneath, as a node
 * leaves out the same member of its own (see {@link givenReadsNothingBeneath}). Read by descriptor: nothing of
 * the prototype runs.
 * @param {{value: object, gate: object, reader: object}} record - The view's record.
 * @param {string|symbol} prop - The member's key.
 * @param {boolean} [listing=false] - Whether the key is being listed (`ownKeys`): an object member is described still.
 * @returns {boolean} True when it is left out.
 * @private
 */
function givenWithheld(record, prop, listing = false) {
	/**
	 * Whether the rules leave the reader nothing to read at an object member of a given prototype: a read of the member's
	 * path is refused, and so is a read of any member beneath it, with no more specific allow beneath it, as
	 * {@link readsNothingBeneath} decides for the same member of a node's own.
	 * @param {{gate: object, reader: object}} record - The view's record.
	 * @param {string} prop - The member's key.
	 * @returns {boolean} Whether the reader may read nothing there.
	 * @private
	 *
	 * @example
	 * // rule: allow reader.** → owner.config.partly.a; the prototype holds { nothing: {...}, partly: {...} }
	 * Object.keys(Object.getPrototypeOf(self.owner.config)); // ["partly"]
	 */
	function givenReadsNothingBeneath(record, prop) {
		const targetPath = memberPathOf(record.gate, prop);
		if (givenReadDecision(record, prop, targetPath).allowed) return false;
		const probePath = `${targetPath}.${ANY_MEMBER_SEGMENT}`;
		const beneath = givenReadDecision(record, prop, probePath);
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
		if (member !== null && typeof member === "object" && !isTerminalData(member) && !givenAsIs(member))
			return givenReadsNothingBeneath(record, prop);
	}
	if (isData ? !isTerminalData(descriptor.value) : typeof descriptor.get !== "function") return false;
	return !givenReadDecision(record, prop).allowed;
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
function givenMember(record, prop, value) {
	if (value === undefined) return undefined;
	if (isTerminalData(value)) {
		const decision = givenReadDecision(record, prop);
		if (!decision.allowed)
			throw new record.gate.SlothletError("PERMISSION_DENIED", { caller: decision.caller, target: segmentsOf(decision.target) });
		return value;
	}
	if (givenAsIs(value)) return value;
	if (typeof value === "function") {
		// The engine's own functions are no one's code; any other is read as a member of the node is.
		if (isBuiltinFunction(value) || record.node === null || typeof record.node.___createChildWrapper !== "function") return value;
		return record.node.___createChildWrapper(prop, value) ?? value;
	}
	const held = MapMethods.get(record.members, prop);
	if (held !== undefined && held.value === value) return held.view;
	const gate = record.gate;
	const beneath = {
		slothlet: gate.slothlet,
		SlothletError: gate.SlothletError,
		____slothletInternal: { apiPath: memberPathOf(gate, prop), filePath: gate.____slothletInternal.filePath ?? null, impl: value }
	};
	const view = givenView(beneath, null, value, record.reader, record.assertWrite);
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
 *   (see {@link rootGate}).
 * @param {object|null} node - The node's wrapper, which hands out the functions the prototype holds; null beneath it
 *   and at the root.
 * @param {object|Function} value - The prototype.
 * @param {object} reader - The module the view is handed to, or the reader standing for every holder of a closed node.
 * @param {function(): void} assertWrite - Refuses a change the code running now may not make at the node's path.
 * @returns {object} The view.
 * @private
 */
function givenView(gate, node, value, reader, assertWrite) {
	const record = { value, gate, node, reader, assertWrite, members: new Map(), link: null };
	const shadow = {};
	const view = new NativeProxy(shadow, {
		get: (_, prop, receiver) => givenMember(record, prop, Reflect.get(value, prop, receiver === view ? view : receiver)),
		has: (_, prop) => Reflect.has(value, prop),
		ownKeys: () => filterList(Reflect.ownKeys(value), (key) => !givenWithheld(record, key, true)),
		getOwnPropertyDescriptor: (_, prop) => {
			const descriptor = Reflect.getOwnPropertyDescriptor(value, prop);
			if (!descriptor || givenWithheld(record, prop)) return undefined;
			// The view holds nothing fixed, so each member is described as one that can still change.
			if ("value" in descriptor)
				return { __proto__: null, ...descriptor, value: givenMember(record, prop, descriptor.value), configurable: true };
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
			if (givenAsIs(link)) return link;
			if (record.link === null || record.link.value !== link) {
				record.link = { value: link, view: givenView(gate, node, link, reader, assertWrite) };
			}
			return record.link.view;
		},
		set: (_, prop, written, receiver) => {
			// A write reaching the view from an object that inherits from it lands on that object, as plain JS has it.
			if (receiver !== view) return Reflect.set(value, prop, written, receiver);
			assertWrite();
			return Reflect.set(value, prop, behindGivenView(unwrapSelfView(written)));
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
			return Reflect.setPrototypeOf(value, behindGivenView(unwrapSelfView(prototype)));
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
 * The prototype a node was given, as whoever reads the node now is handed it (see {@link givenView}): the
 * object itself to the host and while the permission system is off, and to module code its own view, the same one on
 * every read, kept on the node's record for as long as the node has that prototype.
 * @param {object} wrapper - The node's wrapper.
 * @param {object|Function|null} prototype - The prototype the node was given.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making.
 * @returns {object|Function|null} What the reader is handed.
 * @private
 */
function givenPrototypeFor(wrapper, prototype, kept = null) {
	if (givenAsIs(prototype)) return prototype;
	const slothlet = wrapper.slothlet;
	if (!slothlet?.handlers?.permissionManager?.isEnabled()) return prototype;
	const reader = selfModuleReader(slothlet) ?? kept?.reader ?? null;
	if (reader === null || reader === HOST_READER) return prototype;
	return givenViewOn(wrapper.____slothletInternal, wrapper, wrapper, prototype, reader, () => assertOwnedWrite(wrapper, null));
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
function givenViewOn(holder, gate, node, prototype, reader, assertWrite) {
	let views = holder.prototypeViews;
	if (views === undefined || views === null || views.of !== prototype) {
		views = { of: prototype, byReader: new WeakMap() };
		holder.prototypeViews = views;
	}
	let view = WeakMapMethods.get(views.byReader, reader);
	if (view === undefined) {
		view = givenView(gate, node, prototype, reader, assertWrite);
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
 * returned by a call. Read by {@link originOf}.
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
 * The call whose own code receives what is being handed out right now (see {@link attributeResult}), or null.
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
function recordStandInOrigin(standIn) {
	if (handOutReceiver !== null) WeakMapMethods.set(STAND_IN_ORIGINS, standIn, handOutReceiver);
}

/**
 * Note that slothlet sees a value handed on: a stand-in recorded as handed to one call (see
 * {@link recordStandInOrigin}) is no longer that call's alone, unless it is being handed out to that call again.
 * A crossing view stands for the value behind it.
 * @param {*} value - The value.
 * @returns {void}
 * @private
 */
function noteMoved(value) {
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
function originOf(standIn) {
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
 * The call a stand-in being run was handed to alone, for {@link runAsMaker} (see {@link originOf}). A
 * method read through an object's stand-in answers for that object: run on it, the object's call; run with any other
 * receiver (another object, a method of another object called on this one, the class's own method read through the
 * class), none.
 * @param {Function} standIn - The stand-in being run.
 * @param {*} receiver - Its receiver, as handed to its module.
 * @returns {object|null} The call, or null.
 * @private
 */
function callOrigin(standIn, receiver) {
	const bound = WeakMapMethods.get(METHOD_RECEIVERS, standIn);
	if (bound === undefined) return originOf(standIn);
	return receiver === bound.instance ? originOf(bound.holder) : null;
}

/**
 * The views a module is handed of a caller's plain array or object holding the module's own stand-ins (see
 * {@link inboundView}), with the caller's value behind each.
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
 * stand-in, their callbacks get those values handed out as the module's (see membrane).
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
 * {@link runAsMaker}); a value handed to the module from outside, plain data, the language's own objects and
 * slothlet's own values come as they are. The same value from the same module is the same stand-in every time.
 * Nothing of the value runs to decide.
 * @param {object} maker - The module's record (see {@link makerOf}).
 * @param {object} owner - The wrapper a new stand-in runs as.
 * @param {*} value - The value.
 * @returns {*} What is handed out.
 * @private
 */
function handOut(maker, owner, value) {
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
	function isPlainPromise(value) {
		if (!util.types.isPromise(value) || Reflect.getPrototypeOf(value) !== Promise.prototype) return false;
		for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (typeof key !== "symbol" || Symbols.keyFor(key) !== undefined || SetMethods.has(WELL_KNOWN_SYMBOLS, key)) return false;
		}
		return true;
	}

	/**
	 * Whether plain data a module hands out holds a node's own function, or a module's copy of one (see
	 * {@link gateLeafCopy}), within the bounds given: plain objects and arrays are looked into, by their
	 * descriptors, so nothing of the data runs. Only while the instance's permission system is on: otherwise no call is
	 * refused, and the data passes as itself.
	 * @param {object} slothlet - The instance.
	 * @param {object} value - The data.
	 * @param {number} depth - Levels still allowed, this one included.
	 * @param {{remaining: number}} budget - Properties still allowed.
	 * @returns {boolean} True when it holds such a function.
	 * @private
	 */
	function dataHoldsLeafFunction(slothlet, value, depth, budget) {
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
				if (member !== null && typeof member === "object" && dataHoldsLeafFunction(slothlet, member, depth - 1, budget)) return true;
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
	function generatorStandIn(maker, owner, original) {
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
				box.step = isStepResult(result);
				if (!box.step) return result;
				box.done = result.done;
				return result.value;
			};
			const handed = runAsMaker(
				owner,
				(input) => {
					const result = Reflect.apply(steps[name], original, [input]);
					return isAsync ? Reflect.apply(SLOT_READERS.then, result, [take]) : take(result);
				},
				undefined,
				[handIn(maker, value)]
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
	 * a rejection — handed out as the module's (see {@link handOut}). A promise of a module's own class, or with
	 * members of its own, is the module's code and is handed out as any other object is.
	 * @param {object} maker - The module's record.
	 * @param {object} owner - The wrapper it runs as.
	 * @param {Promise} original - The promise.
	 * @returns {Promise} The stand-in, the same one for the same promise and module every time.
	 * @private
	 */
	function promiseStandIn(maker, owner, original) {
		const existing = WeakMapMethods.get(maker.made, original);
		if (existing) return existing;
		const standIn = new Promise((resolve, reject) => {
			Reflect.apply(SLOT_READERS.then, original, [
				(value) => resolve(handOut(maker, owner, value)),
				(reason) => reject(handOut(maker, owner, reason))
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
	function ownStandIns(maker, owner, value, made) {
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
	 * {@link handOut} for an object or function, without noting where its stand-in goes.
	 * @param {object} maker - The module's record.
	 * @param {object} owner - The wrapper a new stand-in runs as.
	 * @param {object|Function} value - The value.
	 * @returns {*} What is handed out.
	 * @private
	 */
	function handOutValue(maker, owner, value) {
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
		const prototype = typeof value === "object" ? prototypeHandedTo(value, SEALED_SHELL_READER, owner.slothlet) : value;
		if (prototype !== value) return prototype;
		if (
			isSlothletValue(value) ||
			WeakSetMethods.has(INTRINSICS, value) ||
			isSharedValue(value) ||
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
		const own = made ? ownStandIns(maker, owner, value, made) : null;
		if (made && !own) return made;
		try {
			if (own) {
				const mine = WeakMapMethods.get(own, value);
				if (mine) return mine;
				if (util.types.isGeneratorFunction(value) || util.types.isAsyncFunction(value)) return kindStandIn(maker, owner, value, own);
				return membrane(maker, owner, value, false, own);
			}
			if (util.types.isProxy(value)) return isModuleProxy(value) ? membrane(maker, owner, value) : value;
			if (typeof value === "function") {
				// The live runtime's `then` over the engine's is the engine's, as a built-in is.
				if (isFrameworkInternal(value) || isBuiltinFunction(value) || engineThenOf(value)) return value;
				// A leaf's own function is its module's and runs as that leaf, whichever module handed it out.
				const leaf = WeakMapMethods.get(trustedRootOwn.implWrappers, value);
				// Handed out as it is, it is that leaf's node: running it is a call of the node, which whoever runs it has
				// to be allowed, and it runs with the leaf's rights, as it does when the node is read from `self` (#726).
				// The node's rules decide its function however it is reached: a module that imports the leaf's file itself
				// holds a copy of the function, whose stand-in below is checked as a call of the node each time it runs (see
				// gateLeafCopy).
				const node =
					leaf && WeakSetMethods.has(trustedRootOwn.genuineWrappers, leaf) && leaf.slothlet === owner.slothlet
						? leaf.____slothletInternal.proxy
						: null;
				if (node && typeof node === "function") return node;
				const leafMaker = leaf ? makerOf(leaf) : maker;
				if (leafMaker !== maker && WeakMapMethods.has(leafMaker.made, value)) return WeakMapMethods.get(leafMaker.made, value);
				if (util.types.isGeneratorFunction(value) || util.types.isAsyncFunction(value)) return kindStandIn(leafMaker, leaf ?? owner, value);
				return membrane(leafMaker, leaf ?? owner, value);
			}
			if (util.types.isGeneratorObject(value)) return generatorStandIn(maker, owner, value);
			if (isPlainPromise(value)) return promiseStandIn(maker, owner, value);
			// Only a value that is itself code is a stand-in: data — plain objects and arrays, the language's and Node's own
			// objects — passes as itself however deep it nests, unsearched, and code nested in it is told by its frames when
			// it runs (#726).
			if (owner.slothlet?.config?.permissions?.caller?.provenance !== false) {
				if (!isCodeObject(value)) {
					// Data holding a node's own function, or a module's copy of it, is handed out as a view, so a call of the
					// function read from it is the node's call (see gateLeafCopy) and not a call of the bare function.
					if (!dataHoldsLeafFunction(owner.slothlet, value, searchDepth(owner.slothlet), searchBudget(owner.slothlet))) return value;
				}
				return membrane(maker, owner, value);
			}
			// With `provenance` off no frames are read, so nothing would tell code nested in data from its caller's: the
			// value is searched instead, as far as the code search reaches, and one holding code is handed out as the module's.
			if (!holdsCode(value, searchDepth(owner.slothlet), searchBudget(owner.slothlet))) return value;
			return membrane(maker, owner, value);
		} catch {
			// A value that refuses to be described is handed out as it is.
			return value;
		}
	}

	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	noteMoved(value);
	const handed = handOutValue(maker, owner, value);
	if (handed !== value) noteMoved(handed);
	return handed;
}

/**
 * What a module's call hands its caller (#597): see {@link handOut}. A prototype of a module's class returned
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
function attributeResult(owner, value, callerIsHost = false, caller = null, receiver = null) {
	/**
	 * Whether an instance a module constructs through a node is handed out as the node's module's, under `"fast"` as under
	 * `"precise"`: its `constructor` is the node's function, whose members the rules could refuse the module a read of
	 * (see {@link constructorReadMayRefuse}), so the instance has to hand back the node, not the function. The host
	 * constructing, and a module no read beneath the node could be refused to, get the instance itself.
	 * @param {object} wrapper - The node's wrapper.
	 * @returns {boolean} True when the instance is handed out as the module's.
	 * @private
	 */
	/**
	 * Whether an object's prototype chain holds a `constructor` that is a function an api node stands for whose members
	 * the rules could refuse `reader` a read of (see {@link constructorReadMayRefuse}). Found by descriptors alone.
	 * @param {object} slothlet - The instance.
	 * @param {object|null} reader - The module the object reaches.
	 * @param {object} value - The object.
	 * @returns {boolean} True when a read could be refused.
	 * @private
	 */
	function instanceReadMayRefuse(slothlet, reader, value) {
		if (!reader?.____slothletInternal) return false;
		const readerPath = String(reader.____slothletInternal.apiPath ?? "");
		for (let link = Reflect.getPrototypeOf(value), depth = 0; link !== null && depth < 64; depth++) {
			// A Proxy on the chain runs code of its own to answer: what lies beyond it cannot be told without running it.
			if (util.types.isProxy(link)) return false;
			if (constructorReadMayRefuse(slothlet, readerPath, link)) return true;
			link = Reflect.getPrototypeOf(link);
		}
		return false;
	}

	/**
	 * {@link attributeResult} once the receiver is set.
	 * @param {object} owner - The wrapper whose call returned the value.
	 * @param {object|Function} value - What the call returned.
	 * @param {boolean} callerIsHost - Whether the host made the call.
	 * @param {object|null} caller - The wrapper of the module that made the call, when one did.
	 * @returns {*} What the caller gets.
	 * @private
	 */
	function attributeResultTo(owner, value, callerIsHost, caller) {
		if (callerIsHost && typeof value === "object") {
			const behind = behindMemberView(value);
			if (knownPrototype(owner.slothlet, behind) !== undefined) return behind;
		}
		const toModule = !callerIsHost && Boolean(caller?.____slothletInternal);
		// A crossing view the module was handed and hands back stands for another module's value: the host gets that value,
		// a module gets it as the guard decides for it.
		if (WeakMapMethods.has(CROSSINGS, value)) return toModule ? crossTo(value, caller, owner.slothlet, owner) : uncross(value);
		let handed = value;
		if (!handsOutAsModule(owner)) {
			if (!permissionsOn(owner)) return value;
			// `"fast"` wraps nothing it hands out, but a node's own Proxy export handed back is still that node's member, run
			// as a call of the node, as under `"precise"` (#726).
			if (util.types.isProxy(value)) handed = WeakMapMethods.get(makerOf(owner).made, value) ?? value;
			// An instance whose `constructor` is a function an api node stands for, whose members the rules could refuse the
			// module it reaches, is the module's, as under `"precise"`: its `constructor` is then that node.
			else if (toModule && typeof value === "object" && instanceReadMayRefuse(owner.slothlet, caller, value))
				handed = handOut(makerOf(owner), owner, value);
		} else handed = handOut(makerOf(owner), owner, value);
		// What a module's call hands another module, a stand-in of its code included, reaches it through the class prototype
		// guard.
		if (toModule) return crossTo(handed, caller, owner.slothlet, owner);
		// The host holds it as it is; where it came from is kept for when the host hands it on.
		if (permissionsOn(owner) && !WeakMapMethods.has(HOST_HANDED, handed) && !isShared(handed)) {
			WeakMapMethods.set(HOST_HANDED, handed, owner);
			// The value a stand-in stands for is what the module itself holds once the host hands the stand-in back to it.
			if (handed !== value && !WeakMapMethods.has(HOST_HANDED, value) && !isShared(value)) WeakMapMethods.set(HOST_HANDED, value, owner);
		}
		return handed;
	}

	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	if (!owner?.slothlet?.instanceID || !owner.slothlet.contextManager?.runInContext) return value;
	const previous = handOutReceiver;
	handOutReceiver = !callerIsHost && caller?.____slothletInternal ? receiver : null;
	try {
		noteMoved(value);
		return attributeResultTo(owner, value, callerIsHost, caller);
	} finally {
		handOutReceiver = previous;
	}
}

/**
 * What a module is handed (#597): a stand-in of its own value comes back as the value itself, as in plain
 * JavaScript; a caller's plain array or object holding such stand-ins comes as a view showing them as the module's
 * values (see {@link inboundView}); anything else as it is, recorded as handed to the module, so the module
 * handing it back hands back the very value.
 * @param {object} maker - The module's record.
 * @param {*} value - The value.
 * @param {object} [owner] - The wrapper of the module's leaf it is handed to.
 * @returns {*} What the module gets.
 * @private
 */
function handIn(maker, value, owner = maker.owner) {
	/**
	 * What a module is handed for a node's own function, or a module's copy of one (see {@link gateLeafCopy}),
	 * another module passes it: the node, for the node's own function (as handing it out gives, #726), and for a copy a
	 * stand-in checked as a call of the node each time it runs. Null when the function is neither, belongs to the
	 * receiving module itself, or the permission system is off or disabled: the function is then handed in as it is.
	 * @param {object} maker - The receiving module's record.
	 * @param {object} owner - The wrapper of the module's leaf it is handed to.
	 * @param {Function} value - The function.
	 * @returns {Function|null} What the module gets, or null.
	 * @private
	 */
	function leafFunctionHandedIn(maker, owner, value) {
		const slothlet = owner?.slothlet ?? maker?.owner?.slothlet;
		if (!slothlet?.handlers?.permissionManager?.isEnabled?.() || util.types.isProxy(value)) return null;
		const leaf = WeakMapMethods.get(trustedRootOwn.implWrappers, value);
		if (leaf !== undefined) {
			if (!WeakSetMethods.has(trustedRootOwn.genuineWrappers, leaf) || leaf.slothlet !== slothlet || makerOf(leaf) === maker) return null;
			const node = leaf.____slothletInternal.proxy;
			return typeof node === "function" ? node : null;
		}
		const node = leafOfCopy(slothlet, value);
		if (node === null) return null;
		const nodeMaker = makerOf(node);
		if (nodeMaker === maker) return null;
		if (util.types.isGeneratorFunction(value) || util.types.isAsyncFunction(value)) return kindStandIn(nodeMaker, node, value);
		return membrane(nodeMaker, node, value);
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
		noteMoved(value);
		return crossTo(value, owner, crossing.slothlet, crossing.from);
	}
	const record = WeakMapMethods.get(STAND_IN_RECORDS, value) ?? WeakMapMethods.get(INBOUND_VIEWS, value);
	// Back with the module that made it (a method's receiver, say), a stand-in is its value again: it went nowhere new.
	if (record?.maker === maker) return record.original;
	noteMoved(value);
	if (record) return value;
	if (isSlothletValue(value) || WeakSetMethods.has(INTRINSICS, value)) return value;
	if (WeakMapMethods.has(maker.made, value)) return value;
	// A node's own function, or a module's copy of it, reaches another module as a call of the node.
	if (typeof value === "function") {
		const asNode = leafFunctionHandedIn(maker, owner, value);
		if (asNode !== null) return asNode;
	}
	// A prototype of a module's, or plain data holding one, reaches this one as reading it would (#667).
	const carried = carryTo(value, owner, owner?.slothlet ?? null);
	if (carried !== value) return carried;
	WeakSetMethods.add(maker.handedIn, value);
	return inboundView(maker, value, owner);
}

/**
 * Hand a list of arguments to a module (see {@link handIn}).
 * @param {object} maker - The module's record.
 * @param {ArrayLike<*>} args - The arguments.
 * @param {object} [owner] - The wrapper of the module's leaf they are handed to.
 * @returns {Array<*>|ArrayLike<*>} The arguments, the same list when nothing changed.
 * @private
 */
function handInAll(maker, args, owner = maker.owner) {
	let result = args;
	const count = args?.length ?? 0;
	for (let index = 0; index < count; index++) {
		const value = args[index];
		const handed = handIn(maker, value, owner);
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
function inboundView(maker, value, owner = maker.owner) {
	/**
	 * Whether a caller's plain array or object holds a stand-in of the module's own, within the code search ({@link searchDepth}).
	 * @param {object} maker - The module's record.
	 * @param {object} value - The value.
	 * @param {number} depth - Levels still allowed.
	 * @param {{remaining: number}} budget - Properties still allowed.
	 * @returns {boolean} True when it does.
	 * @private
	 */
	function holdsOwnStandIn(maker, value, depth, budget) {
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
			if (typeof member === "object" && holdsOwnStandIn(maker, member, depth - 1, budget)) return true;
		}
		return false;
	}

	if (typeof value !== "object") return value;
	let views = WeakMapMethods.get(INBOUND_BY_MAKER, maker);
	const existing = views == null ? undefined : WeakMapMethods.get(views, value);
	if (existing) return existing;
	try {
		if (!holdsOwnStandIn(maker, value, searchDepth(owner?.slothlet), searchBudget(owner?.slothlet))) return value;
	} catch {
		return value;
	}
	const fixed = (target, prop) => Reflect.getOwnPropertyDescriptor(target, prop)?.configurable === false;
	const inward = (target, prop, member) => (fixed(target, prop) ? member : handIn(maker, member));
	const view = new NativeProxy(value, {
		get: (target, prop, receiver) => inward(target, prop, Reflect.get(target, prop, receiver === view ? target : receiver)),
		set: (target, prop, next, receiver) =>
			Reflect.set(target, prop, handOut(maker, runningLeafOf(maker, owner), next), receiver === view ? target : receiver),
		getOwnPropertyDescriptor: (target, prop) => {
			const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
			if (!descriptor || !("value" in descriptor) || !descriptor.configurable) return descriptor;
			return { __proto__: null, ...descriptor, value: handIn(maker, descriptor.value) };
		},
		defineProperty: (target, prop, descriptor) =>
			Reflect.defineProperty(
				target,
				prop,
				"value" in descriptor
					? { __proto__: null, ...descriptor, value: handOut(maker, runningLeafOf(maker, owner), descriptor.value) }
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
 * a membrane whose code runs as the module that made it (see {@link runAsMaker}) whoever runs it. Calling
 * or constructing it runs the original as the module; reading a member runs the module's getter as the module and
 * hands the member out as the module's (see {@link handOut}), so a function in a returned object, a getter,
 * a `then`, an iterator, a static method, a prototype's method are all the module's; a module's own Proxy has every
 * trap run as the module. What is handed in through it — arguments, a receiver, a value written — is handed to the
 * module (see {@link handIn}).
 *
 * The Proxy is built over a shadow, kept in step with the original for what the language fixes (a member that
 * cannot be reconfigured, an object that cannot be extended), so a member the original holds fixed is still handed
 * out as the module's.
 * @param {object} maker - The module's record.
 * @param {object} owner - The wrapper it runs as.
 * @param {Function|object} original - The value.
 * @param {boolean} [asNode=false] - Run its code as a call of its node, under no ceiling of its caller (#726).
 * @param {WeakMap<object, object>} [made=maker.made] - Where the stand-in is kept: the module's, or a leaf's own (see
 *   {@link ownStandIns}).
 * @returns {Function|object} The stand-in, the same one for the same value and module every time.
 * @private
 */
function membrane(maker, owner, original, asNode = false, made = maker.made) {
	// A node's own value (a Proxy export) is checked as a call of its node, so it runs as one: under no ceiling of its
	// caller's. A value handed out runs under whoever runs it (#726).
	const runAs = (who, fn, thisArg = undefined, args = [], attribute = true) => runAsMaker(who, fn, thisArg, args, attribute, asNode);
	const existing = WeakMapMethods.get(made, original);
	if (existing) return existing;
	const isProxy = util.types.isProxy(original);
	const isFunction = typeof original === "function";
	// An object with internal slots carrying the module's code (see slotHoldsCode), or one of the language's own
	// iterators: the engine's own methods it is read for work on its slots, so they run on the object itself, not on its
	// stand-in.
	const isSlot = !isProxy && !isFunction && (isSlotObject(original) || isNativeIterator(original));
	// A compiled script of the module's: what its methods run is the module's code.
	const isScript =
		!isProxy &&
		!isFunction &&
		((VM_SCRIPT !== null && inherits(original, VM_SCRIPT)) || (VM_NATIVE_SCRIPT !== null && inherits(original, VM_NATIVE_SCRIPT)));
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
		if (typeof arg !== "function") return handIn(maker, arg);
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
			if (!isBindingMethod(engine, holder)) return value;
		}
		// A script's methods are Node's own, written in JavaScript.
		else if (!isBuiltinFunction(engine) && !(isScript && isSharedExport(engine))) return value;
		let method = WeakMapMethods.get(slotMethods, value);
		if (!method) {
			const name = engine.name;
			method = {
				[name](...args) {
					if (this !== standIn) return Reflect.apply(value, this, args);
					if (isScript) return runAs(owner, value, original, handInAll(maker, args));
					const callsBack = SetMethods.has(SLOT_CALLBACK_METHODS, engine);
					return out(
						Reflect.apply(
							value,
							original,
							mapList(args, (arg) => (callsBack ? slotArgument(arg) : handIn(maker, arg)))
						)
					);
				}
			}[name];
			WeakMapMethods.set(slotMethods, value, method);
		}
		return method;
	};
	const shadow = isFunction
		? isConstructor(original)
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
	const out = (value) => handOut(maker, owner, value);
	/**
	 * This object's own stand-ins of the methods read through it (D1), made when first read.
	 * @type {WeakMap<Function, Function>|null}
	 */
	let methods = null;
	/**
	 * A function read through this object's stand-in: when it would be handed out as a stand-in of its own, the object's
	 * own stand-in of it, which records the object (see callOrigin). Only a method (a function with no
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
				? kindStandIn(record.maker, record.owner, value, methods)
				: membrane(record.maker, record.owner, value, false, methods);
		WeakMapMethods.set(METHOD_RECEIVERS, own, { instance: original, holder: standIn });
		return own;
	};
	/** The receiver a reflection is made through: the stand-in or another of the module's is the value behind it. */
	const receiverOf = (receiver) => (receiver === standIn ? original : handIn(maker, receiver));
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
		if (!owned || WeakMapMethods.has(maker.made, owned)) return atClassSite(owner.slothlet, out(prototype));
		// One handed to the module (a subclass's, constructed for) is not the module's. An instance reports one prototype:
		// the handle at its class's own name (#667), as an instance a node holds does.
		if (WeakSetMethods.has(maker.handedIn, prototype)) return prototype;
		// The prototype of a class a node exports is what reading the class's `prototype` gives the code asking, decided
		// for that file: another file of the module may be refused what the class holds (a deny on its member).
		if (knownPrototype(owner.slothlet, prototype) !== undefined)
			return atClassSite(owner.slothlet, prototypeHandedTo(prototype, reader, owner.slothlet));
		return atClassSite(owner.slothlet, crossTo(prototype, reader, owner.slothlet, owner));
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
				if (!isModuleProxy(holder)) return Reflect.get(holder, prop, receiver);
				return runAs(owner, () => Reflect.get(holder, prop, receiver));
			}
			const descriptor = Reflect.getOwnPropertyDescriptor(holder, prop);
			if (descriptor) {
				// A member of a value handed to the module from outside (a subclass's prototype) is not the module's.
				const holderIsMade = holder === original || !WeakSetMethods.has(maker.handedIn, holder);
				if (!("value" in descriptor)) {
					if (typeof descriptor.get !== "function") return undefined;
					if (!holderIsMade || isBuiltinFunction(descriptor.get)) {
						const value = Reflect.apply(descriptor.get, receiver, []);
						return holderIsMade ? out(value) : value;
					}
					// A getter read on this object answers for it as its methods do (see callOrigin).
					return runAsMaker(owner, descriptor.get, receiver, [], true, asNode, receiver === original ? originOf(standIn) : null);
				}
				const value = descriptor.value;
				// A native binding's method needs the object itself as its receiver, whether or not its holder was handed in (#708).
				if (!isSlot && !isScript && typeof value === "function" && isBindingMethod(value, holder)) return slotMethod(value, holder);
				if (!holderIsMade) return value;
				// A class's `constructor` is the class as it is unless the module handed the class out (see prototypeOut).
				// One an api node stands for is that node, whose members are read under its own rules.
				if (prop === "constructor" && typeof value === "function" && classOf(holder) === value && !WeakMapMethods.has(maker.made, value))
					return frontingNodeNow(owner.slothlet, value) ?? crossTo(value, SEALED_SHELL_READER, owner.slothlet, owner);
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
				if (!isModuleProxy(holder)) return Reflect.set(holder, prop, value, receiver);
				return runAs(owner, () => Reflect.set(holder, prop, value, receiver), undefined, [], false);
			}
			const descriptor = Reflect.getOwnPropertyDescriptor(holder, prop);
			if (descriptor) {
				if ("value" in descriptor) break;
				if (typeof descriptor.set !== "function") return false;
				if (WeakSetMethods.has(maker.handedIn, holder) || isBuiltinFunction(descriptor.set))
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
			gateLeafCopy(owner.slothlet, original, args, receiver);
			const handed = handInAll(maker, args);
			return runAsMaker(owner, original, receiver, handed, true, asNode, callOrigin(standIn, receiver));
		},
		construct: (_shadow, args, newTarget) => {
			gateLeafCopy(owner.slothlet, original, args, undefined);
			const target = newTarget === standIn ? original : handIn(maker, newTarget);
			// A subclass's prototype is the subclass's, never the module's.
			if (target !== original && typeof target === "function") {
				const prototype = Reflect.getOwnPropertyDescriptor(target, "prototype")?.value;
				if (prototype !== null && typeof prototype === "object" && !WeakMapMethods.has(STAND_IN_RECORDS, prototype))
					WeakSetMethods.add(maker.handedIn, prototype);
			}
			return runAs(owner, (...constructArgs) => Reflect.construct(original, constructArgs, target), undefined, handInAll(maker, args));
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
			inheritedPrivate(owner.slothlet, original, prop)?.refusePrivate(prop);
			return fixedValue(prop, slotMethod(read(prop, from), null));
		},
		set: (_shadow, prop, value, receiver) => {
			const into = handIn(maker, value);
			const from = receiverOf(receiver);
			const done = isProxy ? asMaker(() => Reflect.set(original, prop, into, from), false) : write(prop, into, from);
			if (from === original) sync(prop, reported(exec(() => Reflect.getOwnPropertyDescriptor(original, prop))));
			return done;
		},
		has: (_shadow, prop) => {
			if (inheritedPrivate(owner.slothlet, original, prop)?.privateHidden(prop)) return false;
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
			if ("value" in descriptor) into.value = handIn(maker, descriptor.value);
			if ("get" in descriptor) into.get = handIn(maker, descriptor.get);
			if ("set" in descriptor) into.set = handIn(maker, descriptor.set);
			const done = exec(() => Reflect.defineProperty(original, prop, into));
			if (done) sync(prop, reported(exec(() => Reflect.getOwnPropertyDescriptor(original, prop))));
			return done;
		},
		getPrototypeOf: () => {
			if (!Reflect.isExtensible(shadow)) return Reflect.getPrototypeOf(shadow);
			// Reported to the code asking, as reading the class's `prototype` hands it to that code.
			return prototypeOut(
				exec(() => Reflect.getPrototypeOf(original)),
				selfReader(owner.slothlet)
			);
		},
		setPrototypeOf: (_shadow, prototype) => {
			if (!Reflect.isExtensible(shadow)) return Reflect.getPrototypeOf(shadow) === prototype;
			return exec(() => Reflect.setPrototypeOf(original, handIn(maker, prototype)));
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
	if (!asNode) recordStandInOrigin(standIn);
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
 *   {@link ownStandIns}).
 * @returns {Function} The stand-in, the same one for the same function and module every time.
 * @private
 */
function kindStandIn(maker, owner, original, made = maker.made) {
	const existing = WeakMapMethods.get(made, original);
	if (existing) return existing;
	const run = (thisArg, args) => {
		const receiver = handIn(maker, thisArg);
		gateLeafCopy(owner.slothlet, original, args, receiver);
		const handed = handInAll(maker, args);
		return runAsMaker(owner, original, receiver, handed, true, false, callOrigin(standIn, receiver));
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
			get: () => handOut(maker, owner, Reflect.get(original, key)),
			set: (value) => {
				Reflect.set(original, key, handIn(maker, value));
			},
			enumerable: descriptor.enumerable,
			configurable: true
		});
	}
	if (!Reflect.getOwnPropertyDescriptor(original, "name")) Reflect.deleteProperty(standIn, "name");
	WeakMapMethods.set(made, original, standIn);
	WeakMapMethods.set(STAND_IN_RECORDS, standIn, { maker, owner, original });
	recordStandInOrigin(standIn);
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
function constructAsNode(wrapper, constructor, args, newTarget) {
	/**
	 * Whether an instance a module constructs through a node is handed out as the node's module's under `"fast"`, as
	 * under `"precise"` (see {@link instanceHoldsReads}).
	 * @param {object} wrapper - The node's wrapper.
	 * @returns {boolean} True when the instance is handed out as the module's.
	 * @private
	 */
	function instanceHoldsReads(wrapper) {
		const slothlet = wrapper.slothlet;
		const permissionManager = slothlet.handlers?.permissionManager;
		if (!permissionManager?.isEnabled?.()) return false;
		const reader = selfModuleReader(slothlet);
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
		if (newTarget !== constructor || !instanceHoldsReads(wrapper)) return instance;
		return handOut(makerOf(wrapper), wrapper, instance);
	}
	const maker = makerOf(wrapper);
	// The class's prototype is what `api.x.Class.prototype` reads, so its instances report that very object.
	exposePrototype(wrapper, Reflect.getOwnPropertyDescriptor(constructor, "prototype")?.value);
	const target = newTarget === constructor ? constructor : handIn(maker, newTarget);
	if (target !== constructor && typeof target === "function") {
		const prototype = Reflect.getOwnPropertyDescriptor(target, "prototype")?.value;
		if (prototype !== null && typeof prototype === "object" && !WeakMapMethods.has(STAND_IN_RECORDS, prototype))
			WeakSetMethods.add(maker.handedIn, prototype);
	}
	return runAsMaker(
		wrapper,
		(...constructArgs) => Reflect.construct(constructor, constructArgs, target),
		undefined,
		handInAll(maker, args),
		true,
		true
	);
}

/**
 * {@link crossArguments} for values handed to a module by a known caller: a call's arguments, and what slothlet
 * itself hands a module's code for someone else (an event's payload to a listener).
 * @param {object} wrapper - The wrapper of the module handed the values.
 * @param {ArrayLike<*>} args - The values.
 * @param {object|null} caller - The wrapper of the module handing them over, or null for the host.
 * @returns {ArrayLike<*>} The values, the same list when nothing changed.
 * @private
 */
function crossArgumentsFrom(wrapper, args, caller) {
	const slothlet = wrapper?.slothlet;
	if (!args?.length || !slothlet?.handlers?.permissionManager?.isEnabled?.()) return args;
	if (caller !== null && asOneModule(slothlet, caller, wrapper)) return args;
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
			recordOrigin(value, caller);
			if (typeof value === "function" && !isSlothletValue(value)) {
				const prototype = Reflect.getOwnPropertyDescriptor(value, "prototype")?.value;
				if (prototype !== null && typeof prototype === "object") recordOrigin(prototype, caller);
			}
		}
		// A function of the language's or Node's own the caller hands over runs for the caller, with its target.
		const crossed =
			from !== null && guardOn(slothlet) && runsForHander(value, from) && !WeakMapMethods.has(CROSSINGS, value)
				? handedView(value, wrapper, slothlet, from)
				: crossTo(value, wrapper, slothlet, from);
		if (crossed === value) continue;
		if (result === args) result = copyList(args);
		result[index] = crossed;
	}
	return result;
}

/**
 * The module whose call returned each object or function to the host while the permission system was on. The host
 * holds the value itself; handed on by the host to another module as it is, it reaches that module as a value the
 * first module handed it ({@link crossArguments}), and the module it came from as itself.
 * @type {WeakMap<object, object>}
 * @private
 */
const HOST_HANDED = new WeakMap();

/**
 * The arguments a call into a module is handed (see {@link handIn}): a stand-in of that module's own values
 * comes back as the value itself, as it would in plain JavaScript (`registry.remove(registry.get(name))`); a
 * stand-in of another module's value stays one.
 * @param {object} wrapper - The wrapper being called.
 * @param {Array<*>} args - The call's arguments.
 * @returns {Array<*>} The arguments, the same array when nothing changed.
 * @private
 */
function ownArguments(wrapper, args) {
	if (!args?.length || !wrapper?.slothlet?.instanceID || !handsOutAsModule(wrapper)) return args;
	return handInAll(makerOf(wrapper), args, wrapper);
}

/**
 * {@link frontingNode}, bound to the module reading now as a read of that node is (see
 * {@link functionNodeFor}).
 * @param {object} slothlet - The instance.
 * @param {Function} fn - The function.
 * @returns {Function|undefined} The node.
 * @private
 */
function frontingNodeNow(slothlet, fn) {
	const node = frontingNode(slothlet, fn);
	if (node === undefined || node === slothlet.boundApi) return node;
	return functionNodeFor(resolveWrapper(node), fn) ?? node;
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
function functionNodePrototype(wrapper, fn) {
	const prototype = ownsPrototype(wrapper) ? recordedPrototype(wrapper) : Objects.getPrototypeOf(fn);
	if (prototype === null || prototype === Functions.prototype) return prototype;
	// One given to the node is no part of the module's function: the host is handed it as it is, and module code its
	// own view of it (see givenView).
	if (prototypeGiven(wrapper)) return givenPrototypeFor(wrapper, prototype);
	if (typeof prototype !== "function") {
		return memberHoldsCode(prototype, searchDepth(wrapper.slothlet) + 1, searchBudget(wrapper.slothlet)) ? null : prototype;
	}
	return functionNodeFor(wrapper, prototype) ?? null;
}

/**
 * The node fronting a function of the module's (see {@link FUNCTION_NODES}), bound to the module reading now as a read
 * of that node is, or `undefined` when no node of the instance fronts it.
 * @param {UnifiedWrapper} wrapper - A node of the instance, read now.
 * @param {Function} fn - The function.
 * @returns {Function|undefined} The node, or `undefined`.
 * @private
 */
function functionNodeFor(wrapper, fn) {
	const node = nodeRefOf(FUNCTION_NODES, wrapper.slothlet, fn);
	if (node === undefined) return undefined;
	const permissionManager = wrapper.slothlet.handlers?.permissionManager;
	if (!permissionManager?.isEnabled() || permissionManager.isCaptureEnabled?.() === false) return node;
	const identity = wrapper.slothlet.contextManager?.getCallerIdentity?.();
	return identity?.currentWrapper ? capturedView(node, identity.currentWrapper, true, identity.ceiling ?? null) : node;
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
function knownPrototype(slothlet, value) {
	/**
	 * The instance whose node fronts the class a prototype is the `prototype` of, found by descriptors (see
	 * {@link CLASS_INSTANCES}), or null.
	 * @param {object} prototype - The prototype.
	 * @returns {object|null} The instance.
	 * @private
	 */
	function classInstanceOf(prototype) {
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
	const instance = record?.slothlet ?? slothlet ?? classInstanceOf(value);
	if (!instance) return undefined;
	const classSites = classPrototypeSites(instance, value);
	if (record === undefined && classSites.length === 0) return undefined;
	const sites = record === undefined ? [] : mapValuesToArray(record.sites);
	for (let ofIndex = 0, ofList = classSites; ofIndex < ofList.length; ofIndex++) {
		const site = ofList[ofIndex];
		if (!(record == null ? undefined : MapMethods.has(record.sites, site.key))) listPush(sites, site);
	}
	return { slothlet: instance, sites };
}

/**
 * The views made of each carrier, per reader (see {@link carrierView}).
 * @type {WeakMap<object, WeakMap<object, object>>}
 * @private
 */
const CARRIER_VIEWS = new WeakMap();

/**
 * What a value reaches `reader` as when it crosses from one module to another through slothlet (#667): an argument, an
 * error a call threw or rejected with, a hook's payload, or an event's payload ({@link eventPayloadFor}). A
 * prototype of a module's reaches it as reading it at its path would
 * ({@link prototypeHandedTo}), and a carrier holding one at any depth as a view handing each member on the same
 * way ({@link carrierView}). Anything else, and everything while the permission system is off, passes as it
 * is.
 * @param {*} value - The value.
 * @param {object|null} reader - Who it reaches: a module's wrapper, the host (`null` or {@link HOST_READER}), or
 *   {@link SEALED_SHELL_READER} for a holder not known yet.
 * @param {object|null} slothlet - The instance it crosses in, when known.
 * @returns {*} What the reader gets.
 * @private
 */
function carryTo(value, reader, slothlet) {
	/**
	 * A carrier as it reaches `reader` (see {@link carryTo}): a view handing each data member on as the reader would
	 * get it, writing through to the carrier. A frozen carrier holds nothing a write could change, so the reader is handed a
	 * frozen copy of it instead, each member carried, which the engine then checks the view's answers against. The same
	 * view each time, for the same carrier and reader.
	 * @param {object} value - The carrier.
	 * @param {object} reader - Who it reaches.
	 * @param {object|null} slothlet - The instance it crosses in, when known.
	 * @returns {object} The view.
	 * @private
	 */
	function carrierView(value, reader, slothlet) {
		let byReader = WeakMapMethods.get(CARRIER_VIEWS, value);
		const existing = byReader == null ? undefined : WeakMapMethods.get(byReader, reader);
		if (existing) return existing;
		const carry = (member) => carryTo(member, reader, slothlet);
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
	 * Whether a carrier ({@link isCarrier}) holds a prototype of a module's as a data member, at any depth within
	 * the code search ({@link searchDepth}). Nothing of the value runs to decide: an accessor is passed over.
	 * @param {object|null} slothlet - The instance it crossed in, when known.
	 * @param {object} value - The carrier.
	 * @param {number} depth - Levels still allowed.
	 * @param {{remaining: number}} budget - Properties still allowed.
	 * @returns {boolean} True when it does.
	 * @private
	 */
	function carriesPrototype(slothlet, value, depth, budget) {
		if (depth <= 0) return false;
		if (Arrays.isArray(value) && value.length > budget.remaining) return false;
		const keys = Reflect.ownKeys(value);
		budget.remaining -= keys.length;
		if (budget.remaining < 0) return false;
		for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			const member = Reflect.getOwnPropertyDescriptor(value, key)?.value;
			if (member === null || typeof member !== "object" || util.types.isProxy(member)) continue;
			if (knownPrototype(slothlet, member) !== undefined) return true;
			if (isCarrier(member) && carriesPrototype(slothlet, member, depth - 1, budget)) return true;
		}
		return false;
	}

	if (value === null || typeof value !== "object" || reader === null || reader === HOST_READER) return value;
	if (slothlet && !slothlet.handlers?.permissionManager?.isEnabled()) return value;
	try {
		if (knownPrototype(slothlet, value) !== undefined) return prototypeHandedTo(value, reader, slothlet);
		if (!isCarrier(value)) return value;
		if (!carriesPrototype(slothlet, value, searchDepth(slothlet), searchBudget(slothlet))) return value;
		return carrierView(value, reader, slothlet);
	} catch {
		// A value that refuses to be described is handed on as it is.
		return value;
	}
}

/**
 * Each crossing view (see {@link crossView}), with the value it stands over, who it was handed to, and the
 * module the value came from.
 * @type {WeakMap<object, {original: object, reader: object, from: object|null, slothlet: object}>}
 * @private
 */
const CROSSINGS = new WeakMap();

/**
 * The crossing views made of each value: its first module's held inline, any other module's by module (see
 * {@link crossKey}). Every leaf of one module gets the same view, so a value one module hands another is the
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
function guardOn(slothlet) {
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
function uncross(value) {
	/**
	 * Whether a value is a crossing view.
	 * @param {*} value - The value.
	 * @returns {boolean} True for one.
	 * @private
	 */
	function isCrossing(value) {
		return value !== null && (typeof value === "object" || typeof value === "function") && WeakMapMethods.has(CROSSINGS, value);
	}

	return isCrossing(value) ? WeakMapMethods.get(CROSSINGS, value).original : value;
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
 * {@link writtenPrototypeFor}). One path per prototype, so a class and its instances report the same checked
 * view whichever of the module's functions handed each of them over.
 * @type {WeakMap<object, {parts: string[], known: boolean}>}
 * @private
 */
const CROSSED_PROTOTYPE_PATHS = new WeakMap();

/**
 * What the views made for a reader are kept under: its module's record (see {@link makerOf}), one per module of
 * an instance, or the reader itself when it is no module's wrapper, or one of a module removed since (its removal under
 * way included), whose record is gone and is not made again for it.
 * @param {object} reader - Who a view is for.
 * @returns {object} The key.
 * @private
 */
function crossKey(reader) {
	/**
	 * Whether a module's record (see {@link makerOf}) is held for a wrapper, without making one.
	 * @param {object} wrapper - A module's wrapper.
	 * @returns {boolean} True when it is.
	 * @private
	 */
	function hasMaker(wrapper) {
		const makers = WeakMapMethods.get(MAKERS, wrapper.slothlet);
		if (!makers) return false;
		const moduleID = wrapper.____slothletInternal?.moduleID;
		return moduleID ? MapMethods.has(makers.byID, moduleID) : WeakMapMethods.has(makers.byWrapper, wrapper);
	}

	if (!reader?.____slothletInternal || !reader.slothlet) return reader;
	if (!hasMaker(reader) && reader.slothlet.handlers?.apiManager?.isRemovedCaller?.(reader) === true) return reader;
	return viewGroup(reader);
}

/**
 * The functions of a module that share the views made of other modules' values: those the write rules answer alike
 * (the same rules name them, see `PermissionManager#writeRulesFor`). A write another module's code makes through such
 * a view, a built-in one of them hands on to run included, is held to the rules of whoever holds the view, so a view
 * is shared only where that answer is the same. Most modules have one group, the module's record itself.
 * @param {object} reader - A module's wrapper.
 * @returns {{owner: object}} The group's record: the module's record (see {@link makerOf}) for functions the
 *   rules answer as the first of its wrappers, else one record per answer, whose `owner` is the first function of it.
 * @private
 */
function viewGroup(reader) {
	const maker = makerOf(reader);
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
function recordOrigin(value, wrapper) {
	if (value === null || (typeof value !== "object" && typeof value !== "function") || WeakMapMethods.has(CROSSINGS, value)) return;
	if (WeakMapMethods.has(CROSSING_ORIGINS, value) || isSlothletValue(value)) return;
	const module = moduleKey(wrapper);
	if (module !== null) WeakMapMethods.set(CROSSING_ORIGINS, value, { slothlet: wrapper.slothlet, module, wrapper });
}

/**
 * The api path of the module a value comes from, as segments: none when no module is known.
 * @param {object|null} from - The wrapper of the module it comes from.
 * @returns {string[]} The segments.
 * @private
 */
function crossFromParts(from) {
	return from?.____slothletInternal ? filterList(splitText(String(from.____slothletInternal.apiPath ?? ""), "."), Boolean) : [];
}

/**
 * A prototype some module wrote, reached by a reader through a value another module handed it (an instance, the class,
 * the prototype held in data), as the reader gets it while the permission system is on. One whose class a node exports
 * is handed on as reading it at that path would ({@link prototypeHandedTo}). Any other is the code of the
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
function writtenPrototypeFor(prototype, reader, slothlet, from) {
	if (isOwnOrigin(prototype, reader)) return prototype;
	// One view per module, or per group of its functions the write rules answer alike ({@link viewGroup}): the
	// first of the group stands for all of it, and each write is still decided for the module executing it. Whether the reader holds the object itself is the reader's own answer: files loaded from one
	// folder share a module, and the one standing for it may hold what a rule refuses this one. A file a write rule
	// keeps apart from the one standing for its module gets a view of its own, so a write through it that another
	// module's code makes (a bound built-in it hands on) is still held to what the file may write.
	let standing = reader?.____slothletInternal && reader.slothlet ? viewGroup(reader).owner : reader;
	if (standing !== reader && !asOneModule(slothlet, standing, reader)) standing = reader;
	if (knownPrototype(slothlet, prototype) !== undefined) return prototypeHandedTo(prototype, reader, slothlet);
	let site = WeakMapMethods.get(CROSSED_PROTOTYPE_PATHS, prototype);
	if (site === undefined || (!site.known && from?.____slothletInternal)) {
		site = { parts: crossFromParts(from), known: Boolean(from?.____slothletInternal) };
		WeakMapMethods.set(CROSSED_PROTOTYPE_PATHS, prototype, site);
	}
	WeakSetMethods.add(MODULE_PROTOTYPES, prototype);
	if (site.known && mayWritePath(slothlet, reader, site.parts)) return prototype;
	// A view the reader's module already holds of it, handed over as data before anything showed it to be a prototype,
	// is the object the module knows: it refuses the same writes ({@link crossAssertWrite}).
	const views = WeakMapMethods.get(CROSSING_VIEWS, prototype);
	if (views !== undefined) {
		const key = crossKey(reader);
		const held = views.key === key ? views.view : views.others == null ? undefined : MapMethods.get(views.others, key);
		if (held) return held;
	}
	return selfMemberOf(prototype, standing, slothlet, site.parts, null);
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
function mayWritePath(slothlet, reader, parts) {
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
 * ({@link mayWritePath}). Such a reader gets the value itself; a prototype on it of a class exported elsewhere is
 * still decided at that class's path ({@link writtenPrototypeFor}).
 * @param {object} slothlet - The instance.
 * @param {object} reader - A module's wrapper.
 * @param {object|null} from - The wrapper of the module the value comes from.
 * @returns {boolean} True when it may.
 * @private
 */
function mayWriteFrom(slothlet, reader, from) {
	if (!from?.____slothletInternal) return false;
	return mayWritePath(slothlet, reader, crossFromParts(from));
}

/**
 * {@link handedAsItself} for a value: a value that stays a view for every module it is handed to
 * ({@link viewedForHander}) never reaches one as itself, and nor does an instance inheriting members private to
 * a module that privacy keeps from the reader ({@link inheritsPrivateKept}), however much it may write.
 * @param {*} value - The value.
 * @param {object} slothlet - The instance.
 * @param {object} reader - A module's wrapper.
 * @param {object|null} from - The wrapper of the module the value comes from.
 * @returns {"writer"|"written"|null} Why it is handed as itself, or `null` when it is viewed.
 * @private
 */
function handedAsItselfFor(value, slothlet, reader, from) {
	/**
	 * Whether a value inherits, from a prototype of a module's class, a member private to that module that privacy keeps
	 * from `reader` ({@link readerHoldsPrototype}): held as itself, the value would hand it over unchecked. Found by
	 * descriptors alone.
	 * @param {object} slothlet - The instance.
	 * @param {object} reader - A module's wrapper.
	 * @param {*} value - The value, a stand-in or the async runtime's context wrapper standing for the value behind it.
	 * @returns {boolean} True when it does.
	 * @private
	 */
	function inheritsPrivateKept(slothlet, reader, value) {
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
		const subject = crossSubject(value);
		if (util.types.isProxy(subject)) return false;
		for (let holder = Reflect.getPrototypeOf(subject), depth = 0; holder !== null && depth < 64; depth++) {
			if (util.types.isProxy(holder) || WeakSetMethods.has(INTRINSICS, holder) || isSharedValue(holder)) return false;
			if (knownPrototype(slothlet, holder) !== undefined) {
				const keys = Reflect.ownKeys(holder);
				for (let ofIndex = 0; ofIndex < keys.length; ofIndex++) {
					const key = keys[ofIndex];
					if (typeof key === "string" && StringMethods.charCodeAt(key, 0) === 95) return !readerHoldsPrototype(slothlet, reader, holder);
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
	function holdsNoCode(value, slothlet) {
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return true;
		const subject = crossSubject(value);
		if (typeof subject === "function" || util.types.isProxy(subject)) return false;
		try {
			return !isCodeObject(subject) && !memberHoldsCode(subject, searchDepth(slothlet) + 1, searchBudget(slothlet));
		} catch {
			// A value that refuses to be described is taken to hold code.
			return false;
		}
	}

	/**
	 * Whether a value a module hands on stays a view for every other module, however much the receiver may write: a
	 * function that runs for the module handing it ({@link runsForHander}), and plain data holding one as a member
	 * of its own at any depth within the code search ({@link searchDepth}) (`{ fn: Reflect.set, target }`), whose member reaches the receiver
	 * as that function's view ({@link crossHandedMember}). Nothing of the value runs to decide: an accessor is passed
	 * over.
	 * @param {*} value - The value handed on.
	 * @param {object|null} from - The wrapper of the module handing it on.
	 * @returns {boolean} True when it stays a view.
	 * @private
	 */
	function viewedForHander(value, from) {
		/**
		 * Whether a carrier ({@link isCarrier}) holds, as a data member at any depth within the code search ({@link searchDepth}), a
		 * function that runs for the module handing it on ({@link runsForHander}).
		 * @param {object} value - The carrier.
		 * @param {object} from - The wrapper of the module handing it on.
		 * @param {number} depth - Levels still allowed.
		 * @param {{remaining: number}} budget - Properties still allowed.
		 * @returns {boolean} True when it does.
		 * @private
		 */
		function carriesHanded(value, from, depth, budget) {
			if (depth <= 0) return false;
			if (Arrays.isArray(value) && value.length > budget.remaining) return false;
			const keys = Reflect.ownKeys(value);
			budget.remaining -= keys.length;
			if (budget.remaining < 0) return false;
			for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
				const member = Reflect.getOwnPropertyDescriptor(value, ofList[ofIndex])?.value;
				if (member === null || (typeof member !== "object" && typeof member !== "function")) continue;
				if (runsForHander(member, from)) return true;
				if (typeof member === "object" && isCarrier(member) && carriesHanded(member, from, depth - 1, budget)) return true;
			}
			return false;
		}

		if (runsForHander(value, from)) return true;
		if (value === null || typeof value !== "object" || !from?.____slothletInternal || !isCarrier(value)) return false;
		try {
			return carriesHanded(value, from, searchDepth(from.slothlet), searchBudget(from.slothlet));
		} catch {
			// A value that refuses to be described is viewed.
			return true;
		}
	}

	/**
	 * Whether, and why, a value reaches `reader` as itself by write rights. `"writer"`: the reader may make every write at
	 * the path the value comes from ({@link mayWriteFrom}), as the owner may. `"written"`: the module the value
	 * comes from may make every write at the reader's path, and the value holds none of that module's code
	 * ({@link holdsNoCode}): what the reader hands back, or stores where that module reads it as itself, stays the
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
	function handedAsItself(slothlet, reader, from, value) {
		if (!from?.____slothletInternal) return null;
		if (mayWriteFrom(slothlet, reader, from)) return writeDeniedWithin(slothlet, from, reader) ? null : "writer";
		if (mayWriteFrom(slothlet, from, reader) && holdsNoCode(value, slothlet))
			return writeDeniedWithin(slothlet, reader, from) ? null : "written";
		return null;
	}

	if (viewedForHander(value, from)) return null;
	const itself = handedAsItself(slothlet, reader, from, value);
	return itself !== null && inheritsPrivateKept(slothlet, reader, value) ? null : itself;
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
function writeDeniedWithin(slothlet, reader, from) {
	if (reader === from) return false;
	const parts = crossFromParts(from);
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
function asOneModule(slothlet, a, b) {
	if (a === b) return true;
	if (!sameModule(a, b)) return false;
	return !writeDeniedWithin(slothlet, a, b) && !writeDeniedWithin(slothlet, b, a);
}

/**
 * What a value reaches `reader` as when another module hands it on while the permission system is on (the class
 * prototype guard): the reader may change data it is handed, but never the code of a module it may not write, however
 * it gets to it. A prototype a module wrote is checked ({@link writtenPrototypeFor}); any other object or
 * function, a stand-in of another module's code included, is a crossing view ({@link crossView}) through which
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
function crossTo(value, reader, slothlet, from = null) {
	/**
	 * Whether an object whose internal data holds no references ({@link isOpaqueData}) holds nothing else either,
	 * so it can be handed on as it is: its prototype is the language's or Node's own, and it has no member of its own beyond
	 * what its kind gives it. A typed array's members under string keys are read only where `permissions.gating.buffers`
	 * asks for it: listing them lists every index, which costs milliseconds on a buffer of any size. Otherwise only its
	 * prototype and its symbol keys are checked.
	 * @param {object} value - Such an object.
	 * @param {object|null} slothlet - The instance it crosses in.
	 * @returns {boolean} True when nothing but its own data can be reached through it.
	 * @private
	 */
	function isPristineData(value, slothlet) {
		const prototype = Reflect.getPrototypeOf(value);
		if (prototype !== null && !WeakSetMethods.has(INTRINSICS, prototype) && !isSharedValue(prototype)) return false;
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
	function isOpaqueData(value) {
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
	function isWrittenClassPrototype(value) {
		if (WeakSetMethods.has(INTRINSICS, value) || isSharedValue(value) || isSlothletValue(value)) return false;
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
	function crossPromise(promise, reader, slothlet, from) {
		const key = crossKey(reader);
		let byKey = WeakMapMethods.get(CROSSED_PROMISES, promise);
		const existing = byKey == null ? undefined : MapMethods.get(byKey, key);
		if (existing) return existing;
		const crossed = Reflect.apply(SLOT_READERS.then, promise, [
			(settled) => crossTo(settled, reader, slothlet, from),
			(reason) => {
				throw crossTo(reason, reader, slothlet, from);
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
	 * primitives, see {@link isPristineData}) pass as they are. A stand-in of another module's code is viewed like
	 * the code it stands for.
	 * @param {object|Function} value - The value.
	 * @param {object|null} [slothlet] - The instance it crosses in, whose `permissions.gating.buffers` decides whether a
	 *   typed array's own keys are listed.
	 * @returns {boolean} True when it is viewed.
	 * @private
	 */
	function needsCrossing(value, slothlet = null) {
		if (typeof value === "object" && runtime_unwrapClassInstance(value) !== value) return true;
		if (WeakMapMethods.has(STAND_IN_RECORDS, value)) return true;
		if (WeakSetMethods.has(INTRINSICS, value) || isSlothletValue(value) || isSharedValue(value)) return false;
		if (
			WeakMapMethods.has(SELF_MEMBER_VIEWS, value) ||
			WeakMapMethods.has(SELF_VIEW_NODES, value) ||
			WeakSetMethods.has(GUARD_VIEWS, value) ||
			WeakMapMethods.has(INBOUND_VIEWS, value)
		)
			return false;
		if (resolveWrapper(value) !== null || WeakMapMethods.has(capturedViewChildren, value) || isFrameworkInternal(value)) return false;
		if (typeof value === "function") return util.types.isProxy(value) || !isBuiltinFunction(value);
		if (util.types.isProxy(value)) return true;
		if (isOpaqueData(value)) return !isPristineData(value, slothlet);
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
	if (isPrototypeHandle(value)) return prototypeForHolder(slothlet, reader, value);
	if (reader === null || reader === undefined || reader === HOST_READER) return value;
	slothlet ??= reader?.slothlet ?? from?.slothlet ?? null;
	if (!guardOn(slothlet)) return value;
	const isModule = Boolean(reader.____slothletInternal);
	// A class instance a node holds, handed back by one of its own methods, stands for its node (#625): the reader gets
	// its view of the node, whose own write rule holds.
	if (isModule && typeof value === "object" && WeakMapMethods.has(SELF_INSTANCE_NODES, runtime_unwrapClassInstance(value)))
		return selfView(value, reader);
	// A stand-in comes from the module that made it. One of the reader's own module stays the stand-in here, as it is
	// between two functions of one module; handed in as an argument it becomes the value again (see handIn).
	const record = WeakMapMethods.get(STAND_IN_RECORDS, value);
	if (record) from ??= record.owner;
	// The async runtime's context wrapper of a class instance (#328) stands for the instance: the reader's own module's
	// comes back as the instance it made; another module's comes from that module.
	const creator = typeof value === "object" ? runtime_classInstanceCreator(value) : null;
	if (creator !== null) {
		if (isModule && asOneModule(slothlet, creator, reader)) return runtime_unwrapClassInstance(value);
		from ??= creator;
	}
	if (isModule && from !== null && asOneModule(slothlet, from, reader)) return value;
	// A function of the language's own a module handed over, handed on again, still runs for the module that handed it.
	if (crossing?.handed && isModule) return handedView(value, reader, slothlet, from);
	// A value the reader's own module held as itself when it handed it on comes back to it as itself.
	if (isOwnOrigin(value, reader)) return value;
	// A view already made of it for the reader's module is what the module holds, except in a function of the module
	// that may write everything at the path the value comes from: the view was made for another of the module's
	// functions, and this one gets the value itself, as it would have had it read the value first.
	const views = WeakMapMethods.get(CROSSING_VIEWS, value);
	if (views !== undefined) {
		const key = crossKey(reader);
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
			const itself = handedAsItselfFor(value, slothlet, reader, from);
			if (itself !== null) {
				if (itself === "writer") recordOrigin(value, from);
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
			if (WeakSetMethods.has(MODULE_PROTOTYPES, plain) || knownPrototype(slothlet, plain) !== undefined || isWrittenClassPrototype(plain))
				return writtenPrototypeFor(plain, reader, slothlet, from);
		}
		if (!needsCrossing(value, slothlet)) return value;
		// A module that may write everything at the path the value comes from gets the value itself, as the owner does.
		// Handed back to the module it came from, it is that module's own value again. A module the value's module may
		// write gets a view all the same: the value's code is still its module's.
		// A function that runs no module's code is the module's that hands it on, however much the reader may write: it
		// stays a view, so what it writes is that module's to write too ({@link crossRun}).
		const itself = isModule ? handedAsItselfFor(value, slothlet, reader, from) : null;
		if (itself !== null) {
			if (itself === "writer") recordOrigin(value, from);
			return value;
		}
		// A promise the other module holds is viewed like any other object, not followed: no reaction is added to it
		// until the reader adds one through the view (`then`, `catch`, `await`), so whether its rejection counts as
		// handled is what the owner and the reader made it, as in plain JavaScript.
		if (record && typeof value === "object" && util.types.isPromise(value)) return crossPromise(value, reader, slothlet, from);
		return crossView(value, reader, slothlet, from);
	} catch (error) {
		// A refusal is the reader's answer. Anything else (a value that refuses to be described, a stack with no room
		// left) leaves the value undecided: it is viewed, never handed on as it is.
		if (inherits(error, SlothletError)) throw error;
		return crossView(value, reader, slothlet, from);
	}
}

/**
 * A crossing view (see {@link crossTo}): the value to every reflection, read and written through, with every
 * value read from it — a member, a prototype, a call's result or error, a member of a `Map` or `Set`, a `WeakRef`'s
 * target — reaching the reader as values another module hands on do, and every value the reader puts into it reaching
 * the module the value came from the same way. The view is lazy: nothing is searched when it is made, so a member the
 * owner stores later is seen as well. It stands over a shadow kept in step with the value for what the language fixes.
 * Data members stay the reader's to change; the value's code does not ({@link crossAssertWrite}).
 * @param {object|Function} original - The value.
 * @param {object} reader - Who it reaches.
 * @param {object} slothlet - The instance.
 * @param {object|null} from - The wrapper of the module it comes from.
 * @param {boolean} [handed] - A function of the language's or Node's own handed on as an argument
 *   ({@link handedView}), which keeps its views itself.
 * @returns {object|Function} The view, the same one for the same value and module every time.
 * @private
 */
function crossView(original, reader, slothlet, from, handed = false) {
	/**
	 * Record the prototypes some module wrote in the chain of a value crossing between modules (see
	 * {@link MODULE_PROTOTYPES}). Only the chain is read, which runs none of the value's code; a Proxy in it, the
	 * language's own prototypes and those of Node's and slothlet's own values end the walk.
	 * @param {object|Function} value - The value crossing, not a Proxy.
	 * @returns {void}
	 * @private
	 */
	function notePrototypes(value) {
		for (let link = Reflect.getPrototypeOf(value), depth = 0; link !== null && depth < 64; depth++) {
			if (
				WeakSetMethods.has(INTRINSICS, link) ||
				WeakSetMethods.has(MODULE_PROTOTYPES, link) ||
				util.types.isProxy(link) ||
				isSharedExport(link)
			)
				return;
			if (isSlothletValue(link)) return;
			WeakSetMethods.add(MODULE_PROTOTYPES, link);
			link = Reflect.getPrototypeOf(link);
		}
	}

	// The views of a value: its first module's held inline, any other module's in a map made only then.
	const key = crossKey(reader);
	const views = handed ? null : WeakMapMethods.get(CROSSING_VIEWS, original);
	if (views != null) {
		if (views.key === key) return views.view;
		const other = views.others == null ? undefined : MapMethods.get(views.others, key);
		if (other) return other;
	}
	const isFunction = typeof original === "function";
	// What the value inherits from that a module wrote is that module's code from here on, however it is reached.
	if (!util.types.isProxy(original)) notePrototypes(original);
	const shadow = isFunction
		? isConstructor(original)
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
 * The state of each crossing view, by its shadow (see {@link crossView}). `onOriginal` is whether the
 * language's and Node's own methods run on the value itself ({@link crossRunsOnOriginal}), told when first
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
function crossOut(state, member) {
	if (member === null || (typeof member !== "object" && typeof member !== "function")) return member;
	return crossTo(member, state.reader, state.slothlet, state.from);
}

/**
 * A value the reader puts into the value behind a crossing view, as the module the value came from gets it (the host,
 * when none is known).
 * @param {object} state - The view's state.
 * @param {*} member - The value.
 * @returns {*} What is stored.
 * @private
 */
function crossIn(state, member) {
	if (member === null || (typeof member !== "object" && typeof member !== "function")) return member;
	if (member === state.view) return state.original;
	return crossTo(member, state.from ?? HOST_READER, state.slothlet, state.reader?.____slothletInternal ? state.reader : null);
}

/**
 * A descriptor of the value behind a crossing view, as the view reports it.
 * @param {object} state - The view's state.
 * @param {PropertyDescriptor|undefined} descriptor - The descriptor.
 * @returns {PropertyDescriptor|undefined} The reported descriptor.
 * @private
 */
function crossDescribe(state, descriptor) {
	if (!descriptor) return descriptor;
	const result = { ...descriptor };
	if ("value" in descriptor) result.value = crossOut(state, descriptor.value);
	else {
		if ("get" in descriptor) result.get = crossOut(state, descriptor.get);
		if ("set" in descriptor) result.set = crossOut(state, descriptor.set);
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
function crossSync(shadow, state, prop, descriptor) {
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
 * owns it, and reaches the reader checked ({@link writtenPrototypeFor}).
 * @param {object} state - The view's state.
 * @param {object|null} raw - The prototype of the value behind the view.
 * @returns {object|null} What the reader gets.
 * @private
 */
function crossPrototype(state, raw) {
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
		!isSharedValue(prototype) &&
		!isSlothletValue(prototype)
	)
		return atClassSite(state.slothlet, writtenPrototypeFor(prototype, state.reader, state.slothlet, state.from));
	return crossOut(state, raw);
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
function crossSettle(shadow, state) {
	const keys = Reflect.ownKeys(state.original);
	const open = Reflect.isExtensible(shadow);
	for (let ofIndex = 0, ofList = Reflect.ownKeys(shadow); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (!ArrayMethods.includes(keys, key) && key !== INSPECT_CUSTOM) Reflect.deleteProperty(shadow, key);
	}
	for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (!open && !Reflect.getOwnPropertyDescriptor(shadow, key)) continue;
		const descriptor = crossDescribe(state, Reflect.getOwnPropertyDescriptor(state.original, key));
		if (descriptor) Reflect.defineProperty(shadow, key, descriptor);
	}
	state.pinned = true;
	if (!open) return;
	Reflect.setPrototypeOf(shadow, crossPrototype(state, Reflect.getPrototypeOf(state.original)));
	Reflect.preventExtensions(shadow);
}

/**
 * One of the language's or Node's own methods read through a crossing view of a value they run on
 * ({@link crossRunsOnOriginal}): it runs on the value itself, its results handed on to the reader and what the
 * reader passes it handed to the module the value came from. A callback the engine calls back with what the value holds
 * gets each of those as the reader gets it. Null for any other value read.
 * @param {object} state - The view's state.
 * @param {*} fn - The value read.
 * @returns {Function|null} The method, the same each read.
 * @private
 */
function crossEngineMethod(state, fn) {
	/**
	 * Whether the language's and Node's own methods read through a crossing view run on the value itself rather than on the
	 * view: an object with internal slots (a `Map`, a `Set`, a `WeakRef`, a date, an iterator, a boxed primitive), whose
	 * methods work only on the object, and an instance of a class no module wrote (a `URL`, an emitter, a stream), whose
	 * methods check the object they are called on. A plain object, an array and a function take them through the view.
	 * @param {object} state - The view's state.
	 * @returns {boolean} True when they run on the value.
	 * @private
	 */
	function crossRunsOnOriginal(state) {
		if (state.onOriginal !== null) return state.onOriginal;
		const { original } = state;
		let answer = false;
		if (typeof original !== "function" && !util.types.isProxy(original)) {
			const types = util.types;
			answer =
				hasInternalSlots(original) ||
				isNativeIterator(original) ||
				types.isMapIterator(original) ||
				types.isSetIterator(original) ||
				types.isGeneratorObject(original) ||
				types.isBoxedPrimitive(original);
			// A prototype of the language's or Node's own other than a plain object's or an array's: a class no module wrote,
			// or a module's subclass of one.
			for (let link = Reflect.getPrototypeOf(original), depth = 0; !answer && link !== null && depth < 64; depth++) {
				if (util.types.isProxy(link) || link === Objects.prototype || link === Arrays.prototype) break;
				if (WeakSetMethods.has(INTRINSICS, link) || isSharedValue(link)) answer = true;
				link = Reflect.getPrototypeOf(link);
			}
		}
		state.onOriginal = answer;
		return answer;
	}

	if (typeof fn !== "function" || util.types.isProxy(fn)) return null;
	if (!(WeakSetMethods.has(INTRINSICS, fn) || isBuiltinFunction(fn) || isSharedExport(fn))) return null;
	if (!crossRunsOnOriginal(state)) return null;
	const { original } = state;
	state.methods ??= new WeakMap();
	let method = WeakMapMethods.get(state.methods, fn);
	if (!method) {
		const name = fn.name;
		const callsBack = SetMethods.has(SLOT_CALLBACK_METHODS, engineThenOf(fn) ?? fn);
		// A step of one of the language's own iterators answers with an object the engine makes for that step.
		const steps =
			(name === "next" || name === "return" || name === "throw") &&
			(WeakSetMethods.has(INTRINSICS, fn) || isBuiltinFunction(fn)) &&
			(isNativeIterator(original) ||
				util.types.isMapIterator(original) ||
				util.types.isSetIterator(original) ||
				util.types.isGeneratorObject(original));
		method = {
			[name](...args) {
				const receiver = this === state.view ? original : this;
				const handed = mapList(args, (arg) =>
					callsBack && typeof arg === "function"
						? function (...values) {
								return crossIn(
									state,
									Reflect.apply(
										arg,
										this === original ? state.view : this,
										mapList(values, (item) => crossOut(state, item))
									)
								);
							}
						: crossIn(state, arg)
				);
				let result;
				try {
					result = Reflect.apply(fn, receiver, handed);
				} catch (error) {
					throw crossOut(state, error);
				}
				// The step's result is no one's value: the reader gets a result of its own, holding what the step gave as
				// the reader gets it. Viewing the result itself would make a view for every element stepped over.
				if (steps && isStepResult(result)) return { value: crossOut(state, result.value), done: result.done };
				// An async generator's step settles to such a result: the reader's promise settles to a result of its own (#758).
				if (steps && util.types.isPromise(result)) {
					return Reflect.apply(SLOT_READERS.then, result, [
						(settled) => (isStepResult(settled) ? { value: crossOut(state, settled.value), done: settled.done } : crossOut(state, settled)),
						(reason) => Promises.reject(crossOut(state, reason))
					]);
				}
				return crossOut(state, result);
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
function crossSubject(original) {
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
function crossAssertWrite(state, prop, change) {
	/**
	 * Whether a member of the value behind a crossing view is code of the module the value came from: a function, or an
	 * accessor, that the reader's module did not put there itself.
	 * @param {object} state - The view's state.
	 * @param {PropertyDescriptor} descriptor - The member's descriptor on the value.
	 * @returns {boolean} True for the owner's code.
	 * @private
	 */
	function crossIsOwnersCode(state, descriptor) {
		if (!("value" in descriptor)) return true;
		const held = descriptor.value;
		if (typeof held !== "function") return false;
		// A function the reader's module stored there is the reader's to replace.
		const crossing = WeakMapMethods.get(CROSSINGS, held);
		if (crossing) return !(crossing.from !== null && state.reader?.____slothletInternal && sameModule(crossing.from, state.reader));
		return !isOwnOrigin(held, state.reader);
	}

	const { original, slothlet } = state;
	if (!slothlet?.handlers?.apiManager?.ownershipEnforced?.()) return;
	// A stand-in, and the async runtime's context wrapper, stand for the value whose members decide.
	const subject = crossSubject(original);
	// A function, and an object some module uses as a prototype, are code whole: every member, new ones included.
	let held = typeof original === "function" || change === "prototype" || WeakSetMethods.has(MODULE_PROTOTYPES, subject);
	if (!held && !util.types.isProxy(subject)) {
		const own = Reflect.getOwnPropertyDescriptor(subject, prop);
		if (own) {
			held = crossIsOwnersCode(state, own) && !(change === "set" && !("value" in own) && typeof own.set === "function");
		} else if (change !== "delete") {
			for (let link = Reflect.getPrototypeOf(subject), depth = 0; link !== null && depth < 64; depth++) {
				if (util.types.isProxy(link) || WeakSetMethods.has(INTRINSICS, link) || isSharedValue(link)) break;
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
	const parts = crossFromParts(state.from);
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
 * The traps of every crossing view (see {@link crossView}), each finding its view's state by the shadow.
 * @type {ProxyHandler<object>}
 * @private
 */
const CROSSING_HANDLER = {
	get(shadow, prop, receiver) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		if (state.pinned) {
			if (!Reflect.isExtensible(shadow)) crossSettle(shadow, state);
			const held = Reflect.getOwnPropertyDescriptor(shadow, prop);
			if (held && !held.configurable && "value" in held && !held.writable) return held.value;
		}
		const { original } = state;
		const own = receiver === state.view;
		// A private member the value inherits from a module's prototype is read as through that prototype.
		inheritedPrivate(state.slothlet, crossSubject(original), prop)?.refusePrivate(prop);
		const value = Reflect.get(original, prop, own ? original : receiver);
		if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
		const fixed = Reflect.getOwnPropertyDescriptor(original, prop);
		if (fixed && !fixed.configurable) crossSync(shadow, state, prop, crossDescribe(state, fixed));
		// The prototype read by its accessor is the prototype, as `Object.getPrototypeOf` reports it.
		if (prop === "__proto__" && !fixed) {
			const prototype = Reflect.getPrototypeOf(original);
			if (prototype === value || WeakMapMethods.has(STAND_IN_RECORDS, original)) return crossPrototype(state, prototype);
		}
		if (own) {
			const handed = crossHandedMember(state, prop, value);
			if (handed !== undefined) return handed;
		}
		return crossEngineMethod(state, value) ?? crossOut(state, value);
	},
	set(shadow, prop, value, receiver) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		const own = receiver === state.view;
		if (own) {
			if (prop === "__proto__" && !Reflect.getOwnPropertyDescriptor(state.original, prop)) crossAssertWrite(state, null, "prototype");
			else crossAssertWrite(state, prop, "set");
		}
		const into = own ? state.original : crossIn(state, receiver);
		const done = Reflect.set(state.original, prop, crossIn(state, value), into);
		const fixed = Reflect.getOwnPropertyDescriptor(state.original, prop);
		if (fixed && (!fixed.configurable || state.pinned)) crossSync(shadow, state, prop, crossDescribe(state, fixed));
		return done;
	},
	has(shadow, prop) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		if (state.pinned && !Reflect.isExtensible(shadow)) crossSettle(shadow, state);
		if (inheritedPrivate(state.slothlet, crossSubject(state.original), prop)?.privateHidden(prop)) return false;
		return Reflect.has(state.original, prop);
	},
	deleteProperty(shadow, prop) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		crossAssertWrite(state, prop, "delete");
		const done = Reflect.deleteProperty(state.original, prop);
		if (done && state.pinned) Reflect.deleteProperty(shadow, prop);
		return done;
	},
	ownKeys(shadow) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		if (!Reflect.isExtensible(state.original) || !Reflect.isExtensible(shadow)) crossSettle(shadow, state);
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
			crossSettle(shadow, state);
			return Reflect.getOwnPropertyDescriptor(shadow, prop);
		}
		const result = crossDescribe(state, Reflect.getOwnPropertyDescriptor(state.original, prop));
		crossSync(shadow, state, prop, result);
		return result;
	},
	defineProperty(shadow, prop, descriptor) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		crossAssertWrite(state, prop, "define");
		const into = { ...descriptor };
		if ("value" in descriptor) into.value = crossIn(state, descriptor.value);
		if ("get" in descriptor) into.get = crossIn(state, descriptor.get);
		if ("set" in descriptor) into.set = crossIn(state, descriptor.set);
		const done = Reflect.defineProperty(state.original, prop, into);
		if (done) crossSync(shadow, state, prop, crossDescribe(state, Reflect.getOwnPropertyDescriptor(state.original, prop)));
		return done;
	},
	getPrototypeOf(shadow) {
		if (!Reflect.isExtensible(shadow)) return Reflect.getPrototypeOf(shadow);
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		return crossPrototype(state, Reflect.getPrototypeOf(state.original));
	},
	setPrototypeOf(shadow, prototype) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		// The prototype it already reports changes nothing.
		const reported = Reflect.isExtensible(shadow)
			? crossPrototype(state, Reflect.getPrototypeOf(state.original))
			: Reflect.getPrototypeOf(shadow);
		if (reported === prototype) return true;
		if (!Reflect.isExtensible(shadow)) return false;
		crossAssertWrite(state, null, "prototype");
		return Reflect.setPrototypeOf(state.original, crossIn(state, prototype));
	},
	isExtensible(shadow) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		if (!Reflect.isExtensible(state.original)) crossSettle(shadow, state);
		return Reflect.isExtensible(shadow);
	},
	preventExtensions(shadow) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		if (typeof state.original === "function") crossAssertWrite(state, null, "prototype");
		const done = Reflect.preventExtensions(state.original);
		if (done) crossSettle(shadow, state);
		return done;
	},
	apply(shadow, thisArg, args) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		let result;
		try {
			const receiver = crossIn(state, thisArg);
			// A node's own function, or a module's copy of it, is a call of the node whoever runs it.
			gateLeafCopy(state.slothlet, state.original, args, receiver, true);
			// A function of the engine's own the runner gives one that runs for the module that handed it (a scheduler, a
			// promise's `then`) runs for that module too, whenever it is called back.
			const forHander = crossRunsForHander(state);
			const given = mapList(args, (arg) => {
				const behind = forHander ? uncross(arg) : arg;
				return forHander && runsForHander(behind, state.from)
					? handedView(behind, state.reader, state.slothlet, state.from)
					: crossIn(state, arg);
			});
			result = crossRun(state, () => Reflect.apply(state.original, receiver, given));
		} catch (error) {
			throw crossOut(state, error);
		}
		return crossOut(state, result);
	},
	construct(shadow, args, newTarget) {
		const state = WeakMapMethods.get(CROSSING_STATES, shadow);
		gateLeafCopy(state.slothlet, state.original, args, undefined, true);
		let target = state.original;
		if (newTarget !== state.view) {
			// A class the reader constructs for is its own: what it makes the instance's prototype is the reader's.
			target = uncross(newTarget);
			if (state.reader?.____slothletInternal && typeof target === "function") {
				recordOrigin(target, state.reader);
				const prototype = Reflect.getOwnPropertyDescriptor(target, "prototype")?.value;
				if (prototype !== null && typeof prototype === "object") recordOrigin(prototype, state.reader);
			}
		}
		let result;
		try {
			result = Reflect.construct(
				state.original,
				mapList(args, (arg) => crossIn(state, arg)),
				target
			);
		} catch (error) {
			throw crossOut(state, error);
		}
		return crossOut(state, result);
	}
};

/**
 * A segment no api path holds, standing for every member beneath a path in {@link readsNothingBeneath}.
 * @type {string}
 * @private
 */
const ANY_MEMBER_SEGMENT = "\u0000member";

/**
 * The api path of a node's member: the member's own name at the api root, whose path is empty.
 * @param {object} wrapper - The node's wrapper, or the api root's gate (see {@link rootGate}).
 * @param {string|symbol} prop - The member's key.
 * @returns {string} The member's path.
 * @private
 */
function memberPathOf(wrapper, prop) {
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
					behindGivenView,
					STAND_IN_RECORDS,
					INBOUND_VIEWS,
					searchDepth,
					searchBudget,
					attributeResult,
					membrane,
					constructAsNode,
					HOST_HANDED,
					ownArguments,
					frontingNodeNow,
					knownPrototype,
					carryTo,
					CROSSINGS,
					guardOn,
					uncross,
					CROSSING_ORIGINS,
					recordOrigin,
					asOneModule,
					crossTo,
					ANY_MEMBER_SEGMENT,
					memberPathOf,
					crossArgumentsFrom
				});
				Base.define("given", { asIs: givenAsIs, member: givenMember, prototypeFor: givenPrototypeFor, viewOn: givenViewOn });
				Base.define("function", { nodePrototype: functionNodePrototype, nodeFor: functionNodeFor });
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					INTRINSICS = methods.values.INTRINSICS;
					hasInternalSlots = methods.has.internalSlots;
					holdsCode = methods.holds.code;
					inheritedPrivate = methods.inherited.private;
					inherits = methods.values.inherits;
					isBindingMethod = methods.is.bindingMethod;
					isBuiltinFunction = methods.is.builtinFunction;
					isCarrier = methods.is.carrier;
					isCodeObject = methods.is.codeObject;
					isConstructor = methods.is.constructor;
					isModuleProxy = methods.is.moduleProxy;
					isNativeIterator = methods.is.nativeIterator;
					isOwnOrigin = methods.is.ownOrigin;
					isPrototypeHandle = methods.is.prototypeHandle;
					isShared = methods.is.shared;
					isSharedValue = methods.is.sharedValue;
					isSlothletValue = methods.is.slothletValue;
					isSlotObject = methods.is.slotObject;
					isStepResult = methods.is.stepResult;
					isTerminalData = methods.is.terminalData;
					ownsPrototype = methods.values.ownsPrototype;
					VM_NATIVE_SCRIPT = methods.values.VM_NATIVE_SCRIPT;
					VM_SCRIPT = methods.values.VM_SCRIPT;
					FUNCTION_NODES = methods.nodes.FUNCTION_NODES;
					MAKERS = methods.nodes.MAKERS;
					nodeRefOf = methods.node.refOf;
					classPrototypeSites = methods.nodes.classPrototypeSites;
					exposePrototype = methods.nodes.exposePrototype;
					makerOf = methods.nodes.makerOf;
					moduleKey = methods.module.key;
					prototypeForHolder = methods.prototype.forHolder;
					prototypeGiven = methods.prototype.given;
					prototypeHandedTo = methods.prototype.handedTo;
					assertOwnedWrite = methods.rules.assertOwnedWrite;
					gateLeafCopy = methods.rules.gateLeafCopy;
					memberHoldsCode = methods.rules.memberHoldsCode;
					readGateDecision = methods.read.gateDecision;
					readGateFor = methods.read.gateFor;
					recordedPrototype = methods.run.recordedPrototype;
					runAsMaker = methods.run.asMaker;
					runningLeafOf = methods.run.runningLeafOf;
					runsForHander = methods.run.runsForHander;
					runsNoModuleCode = methods.run.runsNoModuleCode;
					capturedViewChildren = methods.captured.viewChildren;
					GIVEN_VIEWS = methods.views.GIVEN_VIEWS;
					GUARD_VIEWS = methods.views.GUARD_VIEWS;
					HOST_READER = methods.views.HOST_READER;
					PROTOTYPE_HANDLE_READER = methods.views.PROTOTYPE_HANDLE_READER;
					PROTOTYPE_PATHS = methods.views.PROTOTYPE_PATHS;
					atClassSite = methods.views.atClassSite;
					behindMemberView = methods.views.behindMemberView;
					capturedView = methods.captured.view;
					frontingNode = methods.views.frontingNode;
					permissionsOn = methods.views.permissionsOn;
					sameModule = methods.views.sameModule;
					selfMemberOf = methods.self.memberOf;
					selfModuleReader = methods.self.moduleReader;
					selfReader = methods.self.reader;
					selfView = methods.self.view;
					unwrapSelfView = methods.views.unwrapSelfView;
					SELF_INSTANCE_NODES = methods.views.SELF_INSTANCE_NODES;
					SELF_MEMBER_VIEWS = methods.views.SELF_MEMBER_VIEWS;
					SELF_VIEW_NODES = methods.views.SELF_VIEW_NODES;
					ACTING_FOR = methods.uw.ACTING_FOR;
					isLeafFileFunction = methods.is.leafFileFunction;
					resolveWrapper = methods.uw.resolveWrapper;
					runtime_classInstanceCreator = methods.uw.runtime_classInstanceCreator;
					runtime_unwrapClassInstance = methods.uw.runtime_unwrapClassInstance;
					trustedRootOwn = methods.uw.trustedRootOwn;
					leafOfCopy = methods.uw.leafOfCopy;
					constructorReadMayRefuse = methods.nodes.constructorReadMayRefuse;
					CLASS_INSTANCES = methods.nodes.CLASS_INSTANCES;
					WELL_KNOWN_SYMBOLS = methods.values.WELL_KNOWN_SYMBOLS;
					TYPED_ARRAY_BYTE_LENGTH = methods.values.TYPED_ARRAY_BYTE_LENGTH;
					TYPED_ARRAY_LENGTH = methods.values.TYPED_ARRAY_LENGTH;
					readerHoldsPrototype = methods.nodes.readerHoldsPrototype;
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
