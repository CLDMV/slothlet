/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper.mjs
 *	@Date: 2026-01-30T16:47:31-08:00 (1769820451)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T12:25:58-08:00 (1795551958)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Unified wrapper - combines ____impl pattern, lazy/eager modes, materialization, and context binding
 * @module @cldmv/slothlet/handlers/unified-wrapper
 * @internal
 */

// `util.types.isProxy` (proxy detection) and `util.inspect.custom` are the only members used
// here; both resolve through the platform shim in a browser (#123). A browser has no
// Proxy-detection API, so isProxy returns false — slothlet's OWN wrappers are detected via
// resolveWrapper(), so only arbitrary USER proxies (rare in browser) lose detection.

import { isNode, util, EventEmitter, scheduleMacrotask } from "#helpers/platform";
import { isCompositionLayer, layerUnderlying, internals as compositionInternals } from "#helpers/composition";
import { SlothletError } from "#errors";
import { isFrameworkReservedKey, internals as reservedKeysInternals } from "#helpers/reserved-keys";
import { internals as classInstanceWrapperInternals } from "#helpers/class-instance-wrapper";
import { internals as trustedRootInternals } from "#handlers/trusted-root";
import { internals as framePlacementInternals } from "#handlers/frame-placement";
import { internals as frameworkInternalsInternals } from "#handlers/framework-internals";
import { internals as sharedValuesInternals } from "#handlers/shared-values";
import { internals as cloneContextInternals } from "#helpers/clone-context";
import { internals as functionSourceContextInternals } from "#helpers/function-source-context";
import {
	ArrayMethods,
	Arrays,
	Boolean,
	copyList,
	Errors,
	filterList,
	FunctionMethods,
	Map,
	mapList,
	MapMethods,
	Math,
	NativeProcess,
	NumberMethods,
	Objects,
	Processes,
	promiseAll,
	PromiseMethods,
	ObjectProtoSetter,
	Reflect,
	RegExpMethods,
	regExpReplace,
	Set,
	setFrom,
	SetMethods,
	setToArray,
	setValues,
	splitText,
	String,
	StringMethods,
	Symbol,
	Symbols,
	TypeError,
	WeakMap,
	WeakMapMethods,
	WeakSetMethods
} from "#helpers/intrinsics";
import { isRawRunView, setKindCheck, setProxyCheck } from "#helpers/run-snapshot";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";

import { WrapperBase } from "#handlers/unified-wrapper/base";
import { ValuesLayer } from "#handlers/unified-wrapper/values";
import { NodesLayer } from "#handlers/unified-wrapper/nodes";
import { RulesLayer } from "#handlers/unified-wrapper/rules";
import { RunLayer } from "#handlers/unified-wrapper/run";
import { ViewsLayer } from "#handlers/unified-wrapper/views";
import { MembraneLayer } from "#handlers/unified-wrapper/membrane";
import { RootLayer } from "#handlers/unified-wrapper/root";
import { WaitingLayer } from "#handlers/unified-wrapper/waiting";
import { MaterializeLayer } from "#handlers/unified-wrapper/materialize";
import { TrapsLayer } from "#handlers/unified-wrapper/traps";

const { setApiNodeCheck } = compositionInternals("lib/handlers/unified-wrapper");

const reservedKeysOwn = reservedKeysInternals("lib/handlers/unified-wrapper");

const { runtime_unwrapClassInstance, runtime_classInstanceCreator, setModuleInstanceCheck } =
	classInstanceWrapperInternals("lib/handlers/unified-wrapper");

const trustedRootOwn = trustedRootInternals("lib/handlers/unified-wrapper");

const {
	fileNodes,
	handedLeafFunctions,
	registerLeafFile,
	setModuleNodeResolver,
	setHostPrototypeCheck,
	frameDefiner,
	runtime_codeWritersOnStack,
	runtime_loadingFileRunning,
	runtime_loadingHelper,
	isLeafFileFunction,
	leafOfCopy,
	outerCallerCeiling,
	setApiValueCheck,
	setHandedOutCheck,
	setInboundOriginal,
	setResultAttributor
} = framePlacementInternals("lib/handlers/unified-wrapper");

const { markFrameworkInternal, versionDispatcherRecord } = frameworkInternalsInternals("lib/handlers/unified-wrapper");

const { recordSharedExports } = sharedValuesInternals("lib/handlers/unified-wrapper");

const { setCloneViewReader, setCloneNodeReader } = cloneContextInternals("lib/handlers/unified-wrapper");

const { setFunctionSourceReader } = functionSourceContextInternals("lib/handlers/unified-wrapper");

// Symbol to mark properties added during collision merge (so materialization knows to allow folder children alongside them)
const ____COLLISION_MERGED_PROPERTY = Symbol("collisionMergedProperty");

/**
 * The modules a function handed over between modules is running for, innermost last (see `ACTING_FOR` in
 * `handlers/trusted-root`): while one runs through its crossing view, a write it makes through a prototype's handle or to
 * an api node has to be that module's to make as well as the executing module's, as a write through a view the module
 * held would be ({@link runtime_assertReaderWrite}).
 * @type {object[]}
 * @private
 */
const ACTING_FOR = trustedRootOwn.ACTING_FOR;

/**
 * The kinds of built-in a run copies, by the name {@link runtime_dataKind} gives them, as `helpers/run-snapshot` names them.
 * @type {Record<string, string>}
 * @private
 */
const SNAPSHOT_KINDS = Objects.freeze({
	__proto__: null,
	map: "map",
	set: "set",
	date: "date",
	regexp: "regexp",
	typedarray: "typed",
	arraybuffer: "buffer",
	dataview: "dataview",
	weakmap: "weak",
	weakset: "weak",
	weakref: "weak",
	promise: "promise"
});

/**
 * Whether a value is a stand-in a lazy node handed out for a member it has not loaded (#653): a change made through
 * one is made on the node it stands for once that node loads.
 * @param {*} value - The value.
 * @returns {boolean} True for a stand-in.
 * @internal
 *
 * @example
 * if (isLazyStandIn(parent)) parent = walkAgain();
 */
export function isLazyStandIn(value) {
	return WeakSetMethods.has(STAND_INS, value);
}

/**
 * Make the changes queued through stand-ins of an instance by loading the nodes that hold them (#653), as a module
 * reload is about to rebuild those nodes: in eager mode the changes were already made, and the reload keeps them as it
 * keeps any change made on a node. A node that fails to load drops its changes, as its load does.
 * @param {object} slothlet - The instance.
 * @param {string|null} [scope=null] - The api path reloaded; only changes made at or below it are made. Null, or `"."`,
 *   for the whole instance.
 * @returns {Promise<void>}
 * @internal
 * @example
 * await settleStandInChanges(slothlet);
 */
async function settleStandInChanges(slothlet, scope = null) {
	const pending = WeakMapMethods.get(PENDING_CHANGES, slothlet);
	if (!pending) return;
	const whole = !scope || scope === ".";
	const within = (path) => path === scope || StringMethods.startsWith(path, `${scope}.`);
	// A holder qualifies when one of its changes is made at or below the reloaded path; loading it makes them all.
	const qualifies = (holder) =>
		whole ||
		ArrayMethods.some(holder.____slothletInternal.pendingChanges ?? [], (change) => within(runtime_standInPath(holder, change.chain)));
	const tried = new Set();
	// Each pass loads the nodes holding changes; a change a pass makes on a node further down that has not loaded is
	// queued there and made by the next. Each holder is loaded once.
	for (;;) {
		const holders = filterList(setToArray(pending), (holder) => !SetMethods.has(tried, holder) && qualifies(holder));
		if (holders.length === 0) return;
		for (let ofIndex = 0, ofList = holders; ofIndex < ofList.length; ofIndex++) {
			const holder = ofList[ofIndex];
			SetMethods.add(tried, holder);
		}
		await promiseAll(mapList(holders, (holder) => PromiseMethods.catch(holder.___materialize(), () => {})));
	}
}

/**
 * Drop the changes queued through stand-ins of an instance, and the refusals of those already made, when the whole
 * instance reloads or shuts down (#653): the nodes they were made on are gone, as eager mode's changes are.
 * @param {object} slothlet - The instance.
 * @returns {void}
 * @internal
 * @example
 * releaseStandInChanges(slothlet);
 */
function releaseStandInChanges(slothlet) {
	for (const holder of setValues(WeakMapMethods.get(PENDING_CHANGES, slothlet))) holder.____slothletInternal.pendingChanges = null;
	WeakMapMethods.delete(PENDING_CHANGES, slothlet);
	WeakMapMethods.delete(REFUSED_CHANGES, slothlet);
}

/**
 * How many refusals of queued changes an instance holds (see {@link runtime_takeRefusedChange}).
 * @param {object} slothlet - The instance.
 * @returns {number} The count.
 * @internal
 * @example
 * refusedChangeCount(slothlet); // 0
 */
function refusedChangeCount(slothlet) {
	return WeakMapMethods.get(REFUSED_CHANGES, slothlet)?.length ?? 0;
}

/**
 * Names the get trap answers from the wrapper itself unless the module exports that name (#475), plus
 * `prototype`, which a callable wrapper's function target answers. None of them is an api member unless
 * the module or folder provides one (#571). `then` is deliberately absent: the get trap answers it on its
 * own, as the loader of a lazy node that has not loaded, and otherwise as a member holding data or nothing.
 * @type {ReadonlySet<string>}
 * @private
 */
const WRAPPER_ANSWERED_PROPS = setFrom(["constructor", "length", "name", "prototype", "toString", "valueOf", "toJSON"]);

/**
 * The framework-reserved keys the get trap answers itself (each has an explicit handler there); every other reserved
 * key reads as `undefined` through a node. Built once: the trap only tests membership.
 * @type {ReadonlySet<string>}
 * @private
 */
const GET_TRAP_ALLOWED_INTERNALS = setFrom(["___materialize", "____materializeOnCreate", "____displayName"]);

/**
 * The language's own `__proto__` setter, taken when this file loads.
 * @type {function(this: object, (object|null)): void}
 * @private
 */
const OBJECT_PROTO_SETTER = ObjectProtoSetter;

/**
 * Node's built-in modules slothlet itself loads, whose exports are recorded as made by no module (see
 * recordSharedExports) when this file loads, before any module's code runs: a module handing one out (the
 * `EventEmitter` class, `fs.promises`) hands it out as it is, the same value for every module and instance. Only these:
 * loading every built-in up front would cost each process its startup, and a built-in first loaded later could carry
 * what a module put on it. A value of any other built-in is handed out as the module's.
 * @type {string[]}
 * @private
 */
const SHARED_BUILTINS = [
	"async_hooks",
	"buffer",
	"crypto",
	"events",
	"fs",
	"fs/promises",
	"module",
	"net",
	"os",
	"path",
	"stream",
	"url",
	"util",
	"vm",
	"zlib"
];

if (isNode)
	for (let ofIndex = 0, ofList = SHARED_BUILTINS; ofIndex < ofList.length; ofIndex++) {
		const id = ofList[ofIndex];
		recordSharedExports(Processes.getBuiltinModule(`node:${id}`));
	}

/**
 * Drop the record of what a module made (#597): a module removed whole, or — with no module given — every module of
 * an instance that shut down. Stand-ins already handed out keep working; the module's next value is a new stand-in.
 * @param {object} slothlet - The instance.
 * @param {string} [moduleID] - The module, or every module of the instance when omitted.
 * @returns {void}
 * @internal
 * @example
 * releaseModuleMakers(slothlet, "plugins-core");
 */
function releaseModuleMakers(slothlet, moduleID) {
	if (!slothlet) return;
	if (moduleID === undefined) {
		WeakMapMethods.delete(MAKERS, slothlet);
		// The changes queued through its stand-ins, and the refusals of those made, go with the instance too (#653).
		releaseStandInChanges(slothlet);
		return;
	}
	WeakMapMethods.get(MAKERS, slothlet) == null ? undefined : MapMethods.delete(WeakMapMethods.get(MAKERS, slothlet).byID, moduleID);
}

/**
 * How many module records an instance holds (see {@link runtime_makerOf}).
 * @param {object} slothlet - The instance.
 * @returns {number} The count.
 * @internal
 * @example
 * moduleMakerCount(slothlet); // 3
 */
function moduleMakerCount(slothlet) {
	return WeakMapMethods.get(MAKERS, slothlet)?.byID.size ?? 0;
}

/**
 * Record a runtime's `self` for the context manager it reads its context from: a read of `self` made while no call
 * runs is read through the `self` of the runtime the definer's instance runs, whichever runtime's `self` it was made
 * through (#726). With no call running, the runtime-agnostic `self` hands every read to the async runtime's.
 * @param {object} contextManager - The runtime's context manager.
 * @param {object} selfProxy - The runtime's `self`.
 * @param {Function|null} [callableSelf=null] - The runtime's callable `self` (#803).
 * @returns {void}
 * @internal
 */
function registerRuntimeSelf(contextManager, selfProxy, callableSelf = null) {
	MapMethods.set(RUNTIME_SELVES, contextManager, selfProxy);
	if (callableSelf !== null) MapMethods.set(RUNTIME_CALLABLE_SELVES, contextManager, callableSelf);
}

// Only an instance of a class some module wrote gets the async runtime's context wrapper (#328): a `URL`, a `Response`
// or an `Intl.NumberFormat` a module returns is the object itself.
setModuleInstanceCheck((value) => runtime_isCodeObject(value));

setHostPrototypeCheck(
	(owner, value) =>
		value !== null &&
		typeof value === "object" &&
		Boolean(owner?.slothlet) &&
		runtime_knownPrototype(owner.slothlet, runtime_behindMemberView(value)) !== undefined
);

setHandedOutCheck(
	(value) =>
		value !== null &&
		(typeof value === "object" || typeof value === "function") &&
		(WeakMapMethods.has(STAND_IN_RECORDS, value) || WeakMapMethods.has(CROSSINGS, value) || runtime_isPrototypeHandle(value))
);

// A crossing view of the class prototype guard stands for the value too: what the caller handed is what is looked into.
setInboundOriginal((value) => {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	const behind = runtime_uncross(value);
	return typeof behind === "object" && behind !== null ? (WeakMapMethods.get(INBOUND_VIEWS, behind)?.original ?? behind) : behind;
});

/**
 * Register a runtime's `context`.
 * @param {object} contextManager - The runtime's context manager.
 * @param {object} contextProxy - Its `context`.
 * @returns {void}
 * @internal
 *
 * @example
 * registerRuntimeContext(asyncRuntime, context);
 */
function registerRuntimeContext(contextManager, contextProxy) {
	MapMethods.set(RUNTIME_CONTEXTS, contextManager, contextProxy);
}

/**
 * The node fronting each function of a module's, per instance (#667): a class's base class is reported as the node
 * that fronts it, so `Object.getPrototypeOf(self.v.Sub)` answers `self.v.Base` as it answers `Base` on the classes.
 * Held weakly, so a node never outlives its instance through the module's function.
 * @type {WeakMap<object, WeakMap<Function, WeakRef<Function>>>}
 * @private
 */
/**
 * A new set of a folder's entry names, handed as an array or a set (the names slothlet's own builders collect).
 * @param {Array<string>|Set<string>} names - The names.
 * @returns {Set<string>} The set.
 * @private
 */
function setFromNames(names) {
	return setFrom(Arrays.isArray(names) ? names : setToArray(names));
}

// The run snapshot tells the built-ins it copies apart by the same checks the handlers use (see helpers/run-snapshot).
setKindCheck((value) => SNAPSHOT_KINDS[runtime_dataKind(value) ?? ""] ?? null);

// The run snapshot hands out and saves a Proxy as it is, never reading through its traps (see helpers/run-snapshot).
setProxyCheck((value) => value !== null && (typeof value === "object" || typeof value === "function") && util.types.isProxy(value));

// The platform's cloning functions copy the data behind a crossing view (see helpers/clone-context): the value a
// stand-in or the async runtime's context wrapper stands for, where the view is of one.
setCloneViewReader((value) => {
	const crossing = WeakMapMethods.get(CROSSINGS, value);
	if (crossing === undefined) return undefined;
	const behind = crossing.original;
	if (typeof behind !== "object") return behind;
	return WeakMapMethods.get(STAND_IN_RECORDS, behind)?.original ?? runtime_unwrapClassInstance(behind);
});

// `Function.prototype.toString` answers the source of the function behind an api node, a view of one, a view of another
// module's function, or a stand-in for a returned function (#750): what each already answers to its own `toString()`.
// Only the function is told here; the patch reads its text and hands nothing out.
setFunctionSourceReader((value) => {
	if (typeof value !== "function") return undefined;
	const wrapper = runtime_viewedNodeWrapper(value);
	if (wrapper !== null) {
		const internal = wrapper.____slothletInternal;
		if (internal.invalid || (internal.mode === "lazy" && !internal.state.materialized)) return undefined;
		const fn = runtime_functionOf(internal.impl);
		// A function default with named exports beside it is held under a layer: the module's function is the one under it.
		return fn ? layerUnderlying(fn) : undefined;
	}
	const behind = WeakMapMethods.get(CROSSINGS, value)?.original ?? value;
	const original = WeakMapMethods.get(STAND_IN_RECORDS, behind)?.original ?? (behind !== value ? behind : undefined);
	return typeof original === "function" ? original : undefined;
});

// The platform's cloning functions copy an api node's data too (#751): member by member through the node (or the view
// of it the caller holds), so each read is the node's own, with its checks, and the module's object is never handed over.
setCloneNodeReader((value) => {
	// A run's view (of a node, or of an object it reached as itself) is copied member by member through the view: what
	// the run reads, as of its start, with what it wrote. A callable one is a function, which the platform refuses.
	if (WeakMapMethods.has(RUN_VIEWS, value) || isRawRunView(value))
		return typeof value === "function" ? { value } : { list: Arrays.isArray(value) };
	// A view `self` handed a module over a built-in data object or an error a module holds: while the permission system is
	// on it is copied from reads of it (see `runtime_slotCopy` in clone-context), off it is the platform's to clone.
	const record = WeakMapMethods.get(SELF_MEMBER_VIEWS, value);
	if (record !== undefined) {
		const data = record.value;
		if (data === null || typeof data !== "object" || !runtime_holdsSlottedData(data)) return undefined;
		return record.slothlet?.handlers?.permissionManager?.isEnabled?.() ? { slots: data, members: value } : { value: data };
	}
	const wrapper = runtime_viewedNodeWrapper(value);
	if (wrapper === null) return undefined;
	const internal = wrapper.____slothletInternal;
	// A node with no value yet (lazy, not loaded) or no longer one has nothing to copy: the platform's refusal stands.
	if (internal.invalid || (internal.mode === "lazy" && !internal.state.materialized)) return undefined;
	const impl = internal.impl;
	if (impl === null || impl === undefined) return undefined;
	// A function is refused by the platform, as the module's function is; a primitive is copied as itself.
	const fn = runtime_functionOf(impl);
	if (fn) return { value: fn };
	if (typeof impl !== "object") return { value: impl };
	if (Arrays.isArray(impl)) return { list: true };
	// A module's own Proxy is refused by the platform, as it is in plain JavaScript.
	if (util.types.isProxy(impl) && !isCompositionLayer(impl)) return { value: impl };
	// A built-in data object (a `Date`, a `Map`, an error, a boxed primitive) holds its data in internal slots only the
	// engine reads. While the permission system is on, the copy is made from reads of it, its members read through the
	// node or view the caller holds; off, the platform clones it as it is.
	const data = layerUnderlying(impl);
	if (runtime_holdsSlottedData(data)) {
		return wrapper.slothlet.handlers?.permissionManager?.isEnabled?.() ? { slots: data, members: value } : { value: data };
	}
	return { list: false };
});

/**
 * The `Symbol.hasInstance` an unloaded lazy node answers: it has made no instances yet, so `instanceof`
 * against it is false until it loads.
 * @type {Function}
 * @private
 */
const UNLOADED_HAS_INSTANCE = () => false;

const wrapperDebugEnabled =
	isNode &&
	(NativeProcess.env.SLOTHLET_DEBUG_WRAPPER === "1" ||
		NativeProcess.env.SLOTHLET_DEBUG_WRAPPER === "true" ||
		NativeProcess.env.SLOTHLET_DEBUG_SCRIPT_VERBOSE === "1" ||
		NativeProcess.env.SLOTHLET_DEBUG_SCRIPT_VERBOSE === "true");

/**
 * Framework metadata that rides on a module implementation but is not an api member.
 *
 * Matched by EXACT name rather than an `__` prefix: a user module may legitimately export an
 * underscore-prefixed member, and dropping those would make the composed surface lie. Shared so
 * enumeration and the collision-merge paths filter exactly the same set. Defined in
 * `#helpers/reserved-keys` (which imports only helpers/intrinsics) and re-exported here.
 * @type {Set<string>}
 * @public
 */
export { IMPL_METADATA_KEYS } from "#helpers/reserved-keys";

/**
 * See {@link module:@cldmv/slothlet/helpers/reserved-keys.isFrameworkReservedKey}: the one check for
 * whether a property name is the framework's rather than a module's.
 * @public
 */
export { isFrameworkReservedKey };

/**
 * Symbols for the load states `slothlet.node(target).type` reports
 * @public
 */
export const TYPE_STATES = {
	UNMATERIALIZED: Symbol("unmaterialized"),
	IN_FLIGHT: Symbol("inFlight")
};

/**
 * Build a safe function name for debugging and inspection output.
 * @param {string} apiPath - API path to derive a name from.
 * @param {string} fallback - Fallback name when a safe name cannot be derived.
 * @returns {string} Safe function name.
 */
function getSafeFunctionName(apiPath, fallback) {
	const parts = filterList(splitText(String(apiPath || ""), "."), (part) => part && part !== "null");
	const baseName = parts.length > 0 ? parts[parts.length - 1] : "";
	let safeName = regExpReplace(/[^A-Za-z0-9_$]/g, String(baseName || ""), "_");
	if (!safeName || !(RegExpMethods.exec(/^[A-Za-z_$]/, safeName[0]) !== null)) {
		safeName = safeName ? `_${safeName}` : "";
	}
	return safeName || fallback;
}

/**
 * Create a named proxy target function for clearer debug output.
 *
 * @description
 * The target is a bound function: it can be called and constructed, and its only own properties are
 * `name` and `length`, both configurable. A plain function would also own a non-configurable
 * `prototype`, which the proxy invariants would make it report from the target, so a folder's own
 * `prototype` member could never be listed or described as one (#571).
 * @param {string} nameHint - Name hint derived from apiPath.
 * @param {string} fallback - Fallback function name if nameHint is unusable.
 * @returns {Function} Named proxy target function.
 */
function createNamedProxyTarget(nameHint, fallback) {
	const safeName = getSafeFunctionName(nameHint, fallback);
	return Objects.defineProperty(
		FunctionMethods.bind(function () {}),
		"name",
		{ __proto__: null, value: safeName, configurable: true }
	);
}

// A composition layer hands an api node back as it is instead of binding it as a method.
setApiNodeCheck((value) => WeakMapMethods.has(_proxyRegistry, value));

/**
 * The `then` an `await` of `value` would read: the first property named `then` along its prototype
 * chain, as a descriptor, so that a getter is never run to find it. A Proxy may report a prototype chain
 * that loops back (its own `getPrototypeOf` returning itself); the walk stops at the first object it has
 * already seen.
 * @param {object|Function} value - A value.
 * @returns {PropertyDescriptor|undefined} The `then` descriptor, or undefined when there is none.
 * @internal
 *
 * @example
 * findThen(Object.create({ then: 1 })); // { value: 1, writable: true, … }
 */
export function findThen(value) {
	const seen = new Set();
	for (
		let current = value;
		current !== null && current !== undefined && !SetMethods.has(seen, current);
		current = Reflect.getPrototypeOf(current)
	) {
		SetMethods.add(seen, current);
		const descriptor = Reflect.getOwnPropertyDescriptor(current, "then");
		if (descriptor) return descriptor;
	}
	return undefined;
}

/**
 * Whether a `then` property makes its value awaitable (#571): a function, or a getter, which may return
 * one and is never run to find out. A `then` holding data does not, nor does a setter-only accessor, which
 * an `await` reads as `undefined`: an `await` passes such a value through. The one rule every `then` check
 * in slothlet applies.
 * @param {PropertyDescriptor|undefined} descriptor - The `then` descriptor (see {@link findThen}).
 * @returns {boolean} True for a callable `then` or a `then` getter.
 * @internal
 *
 * @example
 * isAwaitableThen({ value: { required: ["b"] } }); // false
 */
export function isAwaitableThen(descriptor) {
	return descriptor !== undefined && (typeof descriptor.value === "function" || typeof descriptor.get === "function");
}

/**
 * Whether a value holds or inherits a `then` that makes it awaitable (#571), found by descriptor (see
 * {@link findThen}) so that a getter is never run to find out.
 * @param {object|Function} value - A module's value (not a Proxy: a Proxy's traps are its own answer).
 * @returns {boolean} True when the `then` an `await` would read is a function or a getter.
 * @public
 *
 * @example
 * hasThenMember({ get then() { throw new Error(); } }); // true, and the getter does not run
 */
export function hasThenMember(value) {
	return isAwaitableThen(findThen(value));
}

/**
 * The error refusing a value whose `then` would make it awaitable where slothlet awaits it (#571), naming
 * where it was found.
 * @param {Function} SlothletError - The instance's error class.
 * @param {string} location - The api path, or file and export, of the value.
 * @returns {Error} A MODULE_THENABLE_EXPORT validation error.
 * @internal
 *
 * @example
 * throw thenableExportError(this.SlothletError, "session");
 */
export function thenableExportError(SlothletError, location) {
	return new SlothletError("MODULE_THENABLE_EXPORT", { location });
}

/**
 * Whether a module's value is a thenable, which an `await` or an async return would call: it holds or
 * inherits a `then` member (found by descriptor first, so a `then` getter is refused without running),
 * or reading `then` gives a function. The read only runs code when no descriptor names `then`
 * anywhere on the chain, which leaves a Proxy's `get` trap, the same read an `await` makes. No Proxy
 * brand check is needed, so the answer is the same in the browser, where there is none (#580 review).
 * @param {object|Function} value - A module's value.
 * @returns {boolean} True when `value` is thenable or names a `then` member.
 * @public
 *
 * @example
 * isThenableModuleValue(new Proxy({}, { get: (t, k) => (k === "then" ? () => {} : undefined) })); // true
 */
export function isThenableModuleValue(value) {
	return hasThenMember(value) || typeof value.then === "function";
}

/**
 * A slothlet refusal the language itself would raise as a `TypeError` (a definition an object cannot take): an
 * instance of `TypeError` carrying a {@link SlothletError}'s `code`, `details`, `hint` and translated message, shown and
 * serialized as one. Made from the SlothletError with {@link SlothletTypeError.from}, so its code is declared and
 * translated as any other. Internal to this file: it is not part of the errors module's exports.
 * @private
 *
 * @example
 * throw SlothletTypeError.from(new SlothletError("PERMISSION_MEMBER_FIXED_OBJECT", { apiPath: "box.late" }));
 */
class SlothletTypeError extends TypeError {
	/**
	 * The same refusal as a `TypeError`.
	 * @param {SlothletError} error - The refusal.
	 * @returns {SlothletTypeError} The error to throw.
	 */
	static from(error) {
		const hasCause = error.cause !== null && error.cause !== undefined;
		const typed = new SlothletTypeError(error.message, hasCause ? { __proto__: null, cause: error.cause } : undefined);
		typed.name = "SlothletTypeError";
		const keys = ["code", "details", "hint"];
		for (let index = 0; index < keys.length; index++) {
			Objects.defineProperty(typed, keys[index], { __proto__: null, value: error[keys[index]], enumerable: false, writable: false });
		}
		Errors.captureStackTrace(typed, SlothletTypeError.from);
		return typed;
	}
}

{
	const shared = ["toString", "toJSON", Symbols.for("nodejs.util.inspect.custom")];
	for (let index = 0; index < shared.length; index++) {
		Objects.defineProperty(SlothletTypeError.prototype, shared[index], {
			__proto__: null,
			value: SlothletError.prototype[shared[index]],
			enumerable: false,
			writable: true,
			configurable: true
		});
	}
}

/**
 * The reads a stand-in answers itself, loaded or not: what it reports of its own state, and its own description.
 * @type {Set<string|symbol>}
 * @private
 */
const STAND_IN_OWN_READS = setFrom(["then", util.inspect.custom]);

/**
 * The token `UnifiedWrapper` registers its chain with (see `WrapperBase.register`): it exists only in this file, is
 * never exported and never stored on an object, so only this file's code can ask for the wrapper's method table.
 * @type {symbol}
 * @private
 */
const WRAPPER_TOKEN = Symbol("slothlet.wrapperToken");

/**
 * The wrapper's method table, taken when the chain is registered. A `var` so the forwarders below, which files that
 * take this file's bindings early may hold, are callable once the chain exists.
 * @type {object|undefined}
 * @private
 */
var M;

/** Bindings of the layers this file's own code uses, taken from the method table when the chain is registered. */
let runtime_isPrototypeHandle,
	RUN_VIEWS,
	SELF_MEMBER_VIEWS,
	runtime_inherits,
	runtime_dataKind,
	STAND_INS,
	REFUSED_CHANGES,
	PENDING_CHANGES,
	runtime_standInPath,
	runtime_fillPrototype,
	runtime_moduleObjectFor,
	MAKERS,
	STAND_IN_RECORDS,
	INBOUND_VIEWS,
	RUNTIME_SELVES,
	RUNTIME_CALLABLE_SELVES,
	runtime_isCodeObject,
	runtime_attributeResult,
	runtime_nodeAtPath,
	runtime_adoptedImpl,
	RUNTIME_CONTEXTS,
	runtime_knownPrototype,
	CROSSINGS,
	runtime_uncross,
	runtime_viewedNodeWrapper,
	runtime_holdsSlottedData,
	runtime_behindMemberView,
	runtime_functionOf,
	runtime_hasOwnMember,
	runtime_registerLeafFunction,
	capturedViewTargets,
	capturedViewSet,
	_proxyRegistry,
	runtime_nodeHarborsCode,
	runtime_followPosition;

/**
 * Forwards to the Rules layer's `runtime_assertCapability`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_assertCapability(slothlet, name, route, moduleFile, filename, runnerCompile) {
	return M.rules.runtime_assertCapability(slothlet, name, route, moduleFile, filename, runnerCompile);
}

/**
 * Forwards to the Values layer's `runtime_hasInternalSlots`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_hasInternalSlots(value) {
	return M.values.runtime_hasInternalSlots(value);
}

/**
 * Forwards to the Nodes layer's `runtime_nodeReport`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_nodeReport(slothlet, target) {
	return M.nodes.runtime_nodeReport(slothlet, target);
}

/**
 * Forwards to the Nodes layer's `runtime_metadataNodeOf`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_metadataNodeOf(value) {
	return M.nodes.runtime_metadataNodeOf(value);
}

/**
 * Forwards to the Rules layer's `runtime_assertFrameworkRootChange`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_assertFrameworkRootChange(slothlet, prop) {
	return M.rules.runtime_assertFrameworkRootChange(slothlet, prop);
}

/**
 * Forwards to the Values layer's `runtime_codeLabel`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_codeLabel(fn) {
	return M.values.runtime_codeLabel(fn);
}

/**
 * Forwards to the Rules layer's `runtime_contextRead`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_contextRead(ctx, value) {
	return M.rules.runtime_contextRead(ctx, value);
}

/**
 * Forwards to the Rules layer's `runtime_contextReadAsDefiner`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_contextReadAsDefiner(contextProxy, prop) {
	return M.rules.runtime_contextReadAsDefiner(contextProxy, prop);
}

/**
 * Forwards to the Rules layer's `runtime_contextWritten`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_contextWritten(ctx, value) {
	return M.rules.runtime_contextWritten(ctx, value);
}

/**
 * Forwards to the Values layer's `runtime_dataReadOptions`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_dataReadOptions(slothlet) {
	return M.values.runtime_dataReadOptions(slothlet);
}

/**
 * Forwards to the Values layer's `runtime_defineRootInspect`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_defineRootInspect(slothlet, target) {
	return M.values.runtime_defineRootInspect(slothlet, target);
}

/**
 * Forwards to the Rules layer's `runtime_eventPayloadFor`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_eventPayloadFor(payload, listener, emitter, slothlet) {
	return M.rules.runtime_eventPayloadFor(payload, listener, emitter, slothlet);
}

/**
 * Forwards to the Rules layer's `runtime_frameworkViewCaller`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_frameworkViewCaller(slothlet) {
	return M.rules.runtime_frameworkViewCaller(slothlet);
}

/**
 * Forwards to the Rules layer's `runtime_frameworkWrite`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_frameworkWrite(node, write) {
	return M.rules.runtime_frameworkWrite(node, write);
}

/**
 * Forwards to the Values layer's `runtime_inheritsBuiltin`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_inheritsBuiltin(target, prop) {
	return M.values.runtime_inheritsBuiltin(target, prop);
}

/**
 * Forwards to the Values layer's `runtime_isCallerLocked`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_isCallerLocked(fn) {
	return M.values.runtime_isCallerLocked(fn);
}

/**
 * Forwards to the Values layer's `runtime_isLanguageNameDescriptor`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_isLanguageNameDescriptor(prop, descriptor) {
	return M.values.runtime_isLanguageNameDescriptor(prop, descriptor);
}

/**
 * Forwards to the Views layer's `runtime_markCallerLocked`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_markCallerLocked(fn) {
	return M.views.runtime_markCallerLocked(fn);
}

/**
 * Forwards to the Nodes layer's `runtime_instanceEnded`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_instanceEnded(slothlet) {
	return M.nodes.runtime_instanceEnded(slothlet);
}

/**
 * Forwards to the Nodes layer's `runtime_markInstanceEnded`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_markInstanceEnded(slothlet, ended) {
	return M.nodes.runtime_markInstanceEnded(slothlet, ended);
}

/**
 * Forwards to the Nodes layer's `runtime_nodeBehind`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_nodeBehind(value) {
	return M.nodes.runtime_nodeBehind(value);
}

/**
 * Forwards to the Rules layer's `runtime_registerFrameworkMember`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_registerFrameworkMember(member, slothlet, name) {
	return M.rules.runtime_registerFrameworkMember(member, slothlet, name);
}

/**
 * Forwards to the Rules layer's `runtime_registerFrameworkMemberCopy`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_registerFrameworkMemberCopy(copy, member) {
	return M.rules.runtime_registerFrameworkMemberCopy(copy, member);
}

/**
 * Forwards to the Rules layer's `runtime_resolvedAccess`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_resolvedAccess(contextManager, store, identity) {
	return M.rules.runtime_resolvedAccess(contextManager, store, identity);
}

/**
 * Forwards to the Run layer's `runtime_runWrite`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_runWrite(node, prop, sink, change) {
	return M.run.runtime_runWrite(node, prop, sink, change);
}

/**
 * Forwards to the Run layer's `runtime_takeRunWrite`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_takeRunWrite(node, prop) {
	return M.run.runtime_takeRunWrite(node, prop);
}

/**
 * Forwards to the Nodes layer's `runtime_viewAccessor`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_viewAccessor(node, prop) {
	return M.nodes.runtime_viewAccessor(node, prop);
}

/**
 * Forwards to the Run layer's `runtime_runViewAccessor`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_runViewAccessor(accessor, half, receiver, args) {
	return M.run.runtime_runViewAccessor(accessor, half, receiver, args);
}

/**
 * Forwards to the Nodes layer's `runtime_protoAssignSetsPrototype`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_protoAssignSetsPrototype(node) {
	return M.nodes.runtime_protoAssignSetsPrototype(node);
}

/**
 * Forwards to the Values layer's `runtime_isApiNode`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_isApiNode(value) {
	return M.values.runtime_isApiNode(value);
}

/**
 * Forwards to the Nodes layer's `runtime_nodeWrapperOf`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_nodeWrapperOf(value) {
	return M.nodes.runtime_nodeWrapperOf(value);
}

/**
 * Forwards to the Nodes layer's `runtime_nodeVersion`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_nodeVersion(node, snap) {
	return M.nodes.runtime_nodeVersion(node, snap);
}

/**
 * Forwards to the Nodes layer's `runtime_prototypeAtStart`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_prototypeAtStart(node, version, snap) {
	return M.nodes.runtime_prototypeAtStart(node, version, snap);
}

/**
 * Forwards to the Values layer's `runtime_inheritedAtStart`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_inheritedAtStart(node, version, snap, prop, inherited) {
	return M.values.runtime_inheritedAtStart(node, version, snap, prop, inherited);
}

/**
 * Forwards to the Nodes layer's `runtime_classPrototypeOf`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_classPrototypeOf(node) {
	return M.nodes.runtime_classPrototypeOf(node);
}

/**
 * Forwards to the Nodes layer's `runtime_privateCallReceiver`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_privateCallReceiver(node) {
	return M.nodes.runtime_privateCallReceiver(node);
}

/**
 * Forwards to the Waiting layer's `runtime_loadStandIn`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_loadStandIn(standIn) {
	return M.waiting.runtime_loadStandIn(standIn);
}

/**
 * Forwards to the Run layer's `runtime_runWriteSinceClosed`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_runWriteSinceClosed(node, prop, op, payload, sink) {
	return M.run.runtime_runWriteSinceClosed(node, prop, op, payload, sink);
}

/**
 * Forwards to the Nodes layer's `runtime_nodeOpen`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_nodeOpen(node) {
	return M.nodes.runtime_nodeOpen(node);
}

/**
 * Forwards to the Run layer's `runtime_throughRunView`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_throughRunView(access) {
	return M.run.runtime_throughRunView(access);
}

/**
 * Forwards to the Views layer's `runtime_builtinBehind`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_builtinBehind(value) {
	return M.views.runtime_builtinBehind(value);
}

/**
 * Forwards to the Nodes layer's `runtime_sameSnapshotMember`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_sameSnapshotMember(live, held) {
	return M.nodes.runtime_sameSnapshotMember(live, held);
}

/**
 * Forwards to the Values layer's `runtime_holdsOwnMember`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_holdsOwnMember(node, prop) {
	return M.values.runtime_holdsOwnMember(node, prop);
}

/**
 * Forwards to the Root layer's `runtime_rootGate`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootGate(slothlet) {
	return M.root.runtime_rootGate(slothlet);
}

/**
 * Forwards to the Rules layer's `runtime_registerRunView`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_registerRunView(view, real) {
	return M.rules.runtime_registerRunView(view, real);
}

/**
 * Forwards to the Rules layer's `runtime_enforceReadGate`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_enforceReadGate(wrapper, prop, resolvedValue, callerOverride, kept, access) {
	return M.rules.runtime_enforceReadGate(wrapper, prop, resolvedValue, callerOverride, kept, access);
}

/**
 * Forwards to the Rules layer's `runtime_assertRootChange`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_assertRootChange(slothlet, prop) {
	return M.rules.runtime_assertRootChange(slothlet, prop);
}

/**
 * Forwards to the Root layer's `runtime_registerRoot`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_registerRoot(root) {
	return M.root.runtime_registerRoot(root);
}

/**
 * Forwards to the Root layer's `runtime_noteRootFile`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_noteRootFile(slothlet, filePath, moduleID) {
	return M.root.runtime_noteRootFile(slothlet, filePath, moduleID);
}

/**
 * Forwards to the Root layer's `runtime_rootFileOf`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootFileOf(slothlet) {
	return M.root.runtime_rootFileOf(slothlet);
}

/**
 * Forwards to the Root layer's `runtime_rootCall`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootCall(slothlet, thisArg, args, construct) {
	return M.root.runtime_rootCall(slothlet, thisArg, args, construct);
}

/**
 * Forwards to the Root layer's `runtime_rootCallCheck`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootCallCheck(slothlet, args) {
	return M.root.runtime_rootCallCheck(slothlet, args);
}

/**
 * Forwards to the Root layer's `runtime_rootClose`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootClose(slothlet, target, isCallable, prototype) {
	return M.root.runtime_rootClose(slothlet, target, isCallable, prototype);
}

/**
 * Forwards to the Root layer's `runtime_rootDefine`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootDefine(slothlet, target, prop, descriptor) {
	return M.root.runtime_rootDefine(slothlet, target, prop, descriptor);
}

/**
 * Forwards to the Root layer's `runtime_rootAssign`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootAssign(slothlet, target, prop, value) {
	return M.root.runtime_rootAssign(slothlet, target, prop, value);
}

/**
 * Forwards to the Root layer's `runtime_rootFixedMember`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootFixedMember(slothlet, prop, fixed, described) {
	return M.root.runtime_rootFixedMember(slothlet, prop, fixed, described);
}

/**
 * Forwards to the Root layer's `runtime_rootListing`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootListing(slothlet, target, keys) {
	return M.root.runtime_rootListing(slothlet, target, keys);
}

/**
 * Forwards to the Root layer's `runtime_rootMemberDescriptor`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootMemberDescriptor(slothlet, prop, descriptor) {
	return M.root.runtime_rootMemberDescriptor(slothlet, prop, descriptor);
}

/**
 * Forwards to the Root layer's `runtime_rootMemberRead`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootMemberRead(slothlet, prop, value) {
	return M.root.runtime_rootMemberRead(slothlet, prop, value);
}

/**
 * Forwards to the Root layer's `runtime_rootWithheld`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootWithheld(slothlet, prop) {
	return M.root.runtime_rootWithheld(slothlet, prop);
}

/**
 * Forwards to the Root layer's `runtime_rootPrototypeFor`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootPrototypeFor(slothlet, holder, prototype, closed) {
	return M.root.runtime_rootPrototypeFor(slothlet, holder, prototype, closed);
}

/**
 * Forwards to the Root layer's `runtime_rootInheritedRead`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootInheritedRead(slothlet, holder, prototype, prop, value) {
	return M.root.runtime_rootInheritedRead(slothlet, holder, prototype, prop, value);
}

/**
 * Forwards to the Membrane layer's `runtime_behindGivenView`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_behindGivenView(value) {
	return M.membrane.runtime_behindGivenView(value);
}

/**
 * Forwards to the Root layer's `runtime_rootTakesKey`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_rootTakesKey(target, prop) {
	return M.root.runtime_rootTakesKey(target, prop);
}

/**
 * Forwards to the Views layer's `runtime_sameValue`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_sameValue(a, b) {
	return M.views.runtime_sameValue(a, b);
}

/**
 * Forwards to the Views layer's `runtime_selfChangeTarget`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_selfChangeTarget(ctx, prop) {
	return M.views.runtime_selfChangeTarget(ctx, prop);
}

/**
 * Forwards to the Views layer's `runtime_selfFrameworkView`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_selfFrameworkView(member, reader, slothlet) {
	return M.views.runtime_selfFrameworkView(member, reader, slothlet);
}

/**
 * Forwards to the Views layer's `runtime_selfHookHandler`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_selfHookHandler(handler, slothlet, reader) {
	return M.views.runtime_selfHookHandler(handler, slothlet, reader);
}

/**
 * Forwards to the Views layer's `runtime_selfModuleCeilings`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_selfModuleCeilings(slothlet, writer) {
	return M.views.runtime_selfModuleCeilings(slothlet, writer);
}

/**
 * Forwards to the Views layer's `runtime_selfModuleReader`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_selfModuleReader(slothlet) {
	return M.views.runtime_selfModuleReader(slothlet);
}

/**
 * Forwards to the Views layer's `runtime_selfReadAsDefiner`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_selfReadAsDefiner(selfProxy, prop, loadingInstanceID, hostFlowInstanceID, use) {
	return M.views.runtime_selfReadAsDefiner(selfProxy, prop, loadingInstanceID, hostFlowInstanceID, use);
}

/**
 * Forwards to the Views layer's `runtime_selfToJSON`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_selfToJSON(key) {
	return M.views.runtime_selfToJSON(key);
}

/**
 * Forwards to the Views layer's `runtime_selfRootView`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_selfRootView(slothlet, reader) {
	return M.views.runtime_selfRootView(slothlet, reader);
}

/**
 * Forwards to the Views layer's `runtime_selfView`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_selfView(node, reader, from, access) {
	return M.views.runtime_selfView(node, reader, from, access);
}

/**
 * Forwards to the Views layer's `runtime_unwrapSelfView`: this file hands it out (see {@link internals}) before the chain may exist.
 * @returns {*} What it returns.
 * @internal
 */
function runtime_unwrapSelfView(value) {
	return M.views.runtime_unwrapSelfView(value);
}

/**
 * Unified wrapper class that handles all proxy concerns in one place:
 * - ____impl pattern for reload support
 * - Lazy/eager mode materialization
 * - Recursive waiting proxy for deep lazy loading
 * - Context binding through contextManager
 *
 * @class
 * @extends ComponentBase
 * @public
 */
class UnifiedWrapper extends TrapsLayer(
	MaterializeLayer(WaitingLayer(RootLayer(MembraneLayer(ViewsLayer(RunLayer(RulesLayer(NodesLayer(ValuesLayer(WrapperBase)))))))))
) {
	static {
		WrapperBase.define("uw", {
			reservedKeysOwn,
			runtime_unwrapClassInstance,
			runtime_classInstanceCreator,
			trustedRootOwn,
			fileNodes,
			handedLeafFunctions,
			registerLeafFile,
			frameDefiner,
			runtime_codeWritersOnStack,
			runtime_loadingFileRunning,
			runtime_loadingHelper,
			isLeafFileFunction,
			leafOfCopy,
			outerCallerCeiling,
			markFrameworkInternal,
			versionDispatcherRecord,
			recordSharedExports,
			ACTING_FOR,
			WRAPPER_ANSWERED_PROPS,
			GET_TRAP_ALLOWED_INTERNALS,
			OBJECT_PROTO_SETTER,
			setFromNames,
			UNLOADED_HAS_INSTANCE,
			wrapperDebugEnabled,
			TYPE_STATES,
			createNamedProxyTarget,
			findThen,
			isAwaitableThen,
			hasThenMember,
			thenableExportError,
			isThenableModuleValue,
			SlothletTypeError,
			STAND_IN_OWN_READS,
			UnifiedWrapper,
			isClassInstance,
			resolveWrapper
		});
		WrapperBase.linkLayer(this, (methods) => {
			M = methods;
			capturedViewSet = methods.values.capturedViewSet;
			runtime_dataKind = methods.values.runtime_dataKind;
			runtime_holdsSlottedData = methods.values.runtime_holdsSlottedData;
			runtime_inherits = methods.values.runtime_inherits;
			runtime_isCodeObject = methods.values.runtime_isCodeObject;
			runtime_isPrototypeHandle = methods.values.runtime_isPrototypeHandle;
			_proxyRegistry = methods.nodes._proxyRegistry;
			MAKERS = methods.nodes.MAKERS;
			runtime_followPosition = methods.nodes.runtime_followPosition;
			runtime_moduleObjectFor = methods.nodes.runtime_moduleObjectFor;
			runtime_nodeAtPath = methods.nodes.runtime_nodeAtPath;
			runtime_nodeHarborsCode = methods.nodes.runtime_nodeHarborsCode;
			runtime_viewedNodeWrapper = methods.nodes.runtime_viewedNodeWrapper;
			RUNTIME_CONTEXTS = methods.rules.RUNTIME_CONTEXTS;
			runtime_hasOwnMember = methods.rules.runtime_hasOwnMember;
			runtime_registerLeafFunction = methods.rules.runtime_registerLeafFunction;
			runtime_fillPrototype = methods.run.runtime_fillPrototype;
			capturedViewTargets = methods.views.capturedViewTargets;
			RUN_VIEWS = methods.views.RUN_VIEWS;
			runtime_behindMemberView = methods.views.runtime_behindMemberView;
			RUNTIME_CALLABLE_SELVES = methods.views.RUNTIME_CALLABLE_SELVES;
			runtime_functionOf = methods.views.runtime_functionOf;
			RUNTIME_SELVES = methods.views.RUNTIME_SELVES;
			SELF_MEMBER_VIEWS = methods.views.SELF_MEMBER_VIEWS;
			STAND_INS = methods.views.STAND_INS;
			CROSSINGS = methods.membrane.CROSSINGS;
			INBOUND_VIEWS = methods.membrane.INBOUND_VIEWS;
			runtime_attributeResult = methods.membrane.runtime_attributeResult;
			runtime_knownPrototype = methods.membrane.runtime_knownPrototype;
			runtime_uncross = methods.membrane.runtime_uncross;
			STAND_IN_RECORDS = methods.membrane.STAND_IN_RECORDS;
			PENDING_CHANGES = methods.waiting.PENDING_CHANGES;
			REFUSED_CHANGES = methods.waiting.REFUSED_CHANGES;
			runtime_standInPath = methods.waiting.runtime_standInPath;
			runtime_adoptedImpl = methods.materialize.runtime_adoptedImpl;
		});
		WrapperBase.register(this, WRAPPER_TOKEN);
	}

	/**
	 * @private
	 * @description
	 * Private field holding all internal wrapper state. Backed by a prototype getter so
	 * internal framework code can access `wrapper.____slothletInternal` while the proxy
	 * traps legally return `undefined` (not an own property → no proxy invariant enforcement).
	 */
	#internal = null;

	/**
	 * Whether `value` is a UnifiedWrapper instance itself, by the class's own brand: no Proxy passes it and none of a
	 * Proxy's traps run to tell (#632), where `instanceof` would walk a node's prototype chain.
	 * @param {*} value - The value.
	 * @returns {boolean} True for a wrapper instance.
	 * @private
	 * @internal
	 */
	static ____isWrapperInstance(value) {
		return value !== null && typeof value === "object" && #internal in value;
	}

	/**
	 * Internal state accessor used by framework-internal code only.
	 * Backed by the private `#internal` field - prototype property, not an own property,
	 * so proxy invariants never apply and getTrap can legally return undefined for it.
	 *
	 * Uses a private-field brand check (`#internal in this`) so the getter is safe to
	 * invoke with any receiver - including `UnifiedWrapper.prototype` itself during a
	 * prototype chain walk via `Object.getPrototypeOf` - without throwing a TypeError.
	 * Without the brand check, `Object.getPrototypeOf(proxy).____slothletInternal` would
	 * throw because the prototype object was never constructed and has no `#internal` field.
	 * @returns {Record<string, any>|undefined} Internal state container, or undefined for non-instances
	 */
	get ____slothletInternal() {
		if (!(#internal in this)) return undefined;
		return this.#internal;
	}

	/**
	 * @param {Object} slothlet - Slothlet instance (provides contextManager, instanceID, ownership)
	 * @param {Object} options - Configuration options
	 * @param {string} options.mode - "lazy" or "eager"
	 * @param {string} options.apiPath - API path for this wrapper (e.g., "math.advanced.calc")
	 * @param {Function|Object|null} [options.initialImpl=null] - Initial implementation (null for lazy mode)
	 * @param {Function} [options.materializeFunc=null] - Async function to materialize lazy modules
	 * @param {boolean} [options.isCallable=false] - Whether the wrapper should be callable
	 * @param {string} [options.filePath=null] - File path of the module source
	 * @param {string[]|null} [options.exportPath] - Access path within `filePath`'s module namespace
	 *   that produced `initialImpl` (#484). When omitted it is looked up from the ownership export index
	 *   by `initialImpl`'s identity; `null` records "no module origin".
	 * @param {string} [options.moduleID=null] - Module identifier
	 * @param {string} [options.sourceFolder=null] - Source folder for metadata
	 * @param {Iterable<string>|null} [options.memberNames=null] - Names of the entries in this wrapper's
	 *   folder (sanitized), when the build already listed them. A member by one of these names wins over
	 *   anything the wrapper or its proxy target would answer for it (`session/name/` →
	 *   `api.session.name`, `session/prototype/` → `api.session.prototype`), including before an
	 *   unloaded lazy wrapper has loaded (#571).
	 * @param {WeakSet<object>|null} [options.__adoptVisited=null] - Internal: one-shot cycle-guard set
	 *   threaded through the eager child-adoption recursion so a self-referential value cannot recurse
	 *   forever (#330). Set only on nested wrappers built during a single adopt traversal; null for a
	 *   normal (root / reload) construction.
	 * @param {boolean} [options.deferChildAdopt=false] - Internal: defer eager child adoption to first
	 *   getTrap access (and propagate the deferral to descendants). Used for wrap-on-set of a
	 *   user-assigned object so an arbitrarily deep runtime-grafted chain is wrapped one level per
	 *   access instead of recursing synchronously through every level at assignment and overflowing
	 *   the stack (#329 / #247 unbounded depth).
	 * @param {{parent: object, key: PropertyKey, byIndex: boolean, sourceValue: *}|null} [options.__position=null] - Internal:
	 *   set by ___createChildWrapper for a child whose path follows an array position; applied before the constructor
	 *   adopts members, so the child's own members are built under the position-following path too.
	 *
	 * @description
	 * Creates a unified wrapper instance for a specific API path. Extends ComponentBase
	 * to access slothlet.contextManager, slothlet.instanceID, and slothlet.handlers.ownership.
	 *
	 * @example
	 * const wrapper = new UnifiedWrapper(this.slothlet, {
	 * 	mode: "lazy",
	 * 	apiPath: "math",
	 * 	initialImpl: null,
	 * 	materializeFunc: async () => import("./math.mjs")
	 * });
	 */
	constructor(
		slothlet,
		{
			mode,
			apiPath,
			initialImpl = null,
			materializeFunc = null,
			isCallable,
			filePath = null,
			exportPath = undefined,
			moduleID = null,
			sourceFolder = null,
			memberNames = null,
			// One-shot cycle-guard set threaded through the eager child-adoption recursion so a
			// self-referential value cannot recurse forever (#330). Set only on nested wrappers
			// built during a single adopt traversal; null for a normal (root / reload) construction.
			__adoptVisited = null,
			// Defer eager child adoption to first getTrap access (and propagate the deferral to
			// descendants). Used for wrap-on-set of a user-assigned object so an arbitrarily deep
			// runtime-grafted chain is wrapped one level per access instead of recursing synchronously
			// through every level at assignment and overflowing the stack (#329 / #247 unbounded depth).
			deferChildAdopt = false,
			// Set by ___createChildWrapper for a child whose path follows an array position (#603 review):
			// `{ parent, key, byIndex, sourceValue }`, applied before the constructor adopts members, so the
			// child's own members are built under the position-following path too.
			__position = null,
			// `{ value }` for a node built from a file whose module value is `null` or `undefined` (#792): a read of
			// the node answers that value (see runtime_holdsNullish). initialImpl alone cannot say which it was.
			nullishDefault = null
		}
	) {
		super(slothlet);

		// Centralized internal state container - all wrapper metadata lives here.
		// Non-enumerable so it never appears in Object.keys() or user-facing enumerations.
		// Using a null-prototype object avoids any inherited property collisions.
		const isCallableExplicit = typeof isCallable === "boolean";
		const isCallableValue = isCallableExplicit
			? isCallable
			: typeof initialImpl === "function" || (initialImpl && typeof initialImpl.default === "function");
		// isCallableLocked: When true, callable status cannot be upgraded by ___setImpl.
		// Locked when explicitly passed or when already callable. Unlocked in lazy mode
		// where the real impl hasn't arrived yet and may turn out to be callable.
		const isCallableLocked = isCallableValue || isCallableExplicit;

		const internal = Objects.create(null);
		internal.id = StringMethods.substr(NumberMethods.toString(Math.random(), 36), 2, 9); // Unique ID for debugging
		internal.mode = mode;
		internal.apiPath = apiPath;
		if (__position) {
			internal.sourceValue = __position.sourceValue;
			runtime_followPosition(internal, __position.parent, __position.key, __position.byIndex);
		}
		// `loader.materialize` is the one switch for background loading: every lazy wrapper built while it is on
		// (true, or a callback) loads itself in the background once it is constructed (see the end of this constructor).
		internal.materializeOnCreate = mode === "lazy" && !!slothlet.config?.loader?.materialize;
		internal.isCallable = isCallableValue;
		internal.isCallableLocked = isCallableLocked;
		internal.moduleID = moduleID;
		// The mount of its module this wrapper was built for (#625): see ApiManager#incarnationOf.
		internal.incarnation = slothlet.handlers?.apiManager?.incarnationOf?.(moduleID);
		// The module the children adopted by an in-flight ___setImpl belong to, when that call names one
		// explicitly (a reload rebuilding one module's contribution to a namespace another module created).
		// Null otherwise: children then belong to this wrapper's own module (#525).
		internal.adoptOwner = null;
		internal.filePath = filePath;
		internal.nullish = nullishDefault;
		// Where initialImpl sits in filePath's module namespace (#484) — resolved before the clone below,
		// against the value the module actually exported. Read by typegen through the ownership record.
		// A primitive has no identity to look up; a module leaf built straight from one export (a folder
		// namespace's per-export wrappers) is found by the export's name — its apiPath's last segment —
		// confirmed by value.
		const originIndex = slothlet.handlers?.ownership;
		const isPrimitiveImpl =
			initialImpl !== null && initialImpl !== undefined && typeof initialImpl !== "object" && typeof initialImpl !== "function";
		const ownKey = typeof apiPath === "string" ? StringMethods.slice(apiPath, StringMethods.lastIndexOf(apiPath, ".") + 1) : null;
		internal.exportPath =
			exportPath !== undefined
				? exportPath
				: (originIndex?.resolveExportPath(filePath, initialImpl) ??
					(isPrimitiveImpl && ownKey ? originIndex?.resolveExportPathByKey(filePath, ownKey, initialImpl) : null) ??
					null);
		internal.memberExportPaths = originIndex?.resolveMemberExportPaths(filePath, initialImpl) ?? null;
		internal.sourceFolder = sourceFolder;
		// The folder's entry names (#571), so a member wins over the wrapper's own answers; null when unknown.
		internal.memberNames = memberNames ? setFromNames(memberNames) : null;
		// Cycle-guard set for this adopt traversal (see the constructor's __adoptVisited note, #330).
		internal.adoptVisited = __adoptVisited;
		// Propagated to getTrap-created descendants so a whole wrap-on-set subtree adopts lazily (#329).
		internal.deferChildAdopt = deferChildAdopt;
		internal.invalid = false;
		// Restart epoch (#504): the tree this wrapper belongs to. Once a restart() swaps in a newer tree,
		// the proxy traps forward to the node at this wrapper's path in the live tree instead.
		internal.epoch = slothlet._buildEpoch ?? 0;
		// The lazy-load count of the tree this wrapper belongs to (see Slothlet#_lazyTally): a full reload starts a new
		// one without a new epoch.
		internal.lazyTally = slothlet._lazyTally;
		// The instance ID the node was built under: the tag its file's code carries in a stack frame. A full reload gives
		// the instance a new ID, and code of the copy it replaced still carries this one. A node a kept copy loads later
		// (a lazy node a run reaches after the instance reloaded or restarted) loads its file under the ID the copy was
		// loaded under (see Slothlet#loadID), so it is built under that ID too.
		internal.builtUnder = slothlet.loadID ?? slothlet.instanceID ?? null;
		internal.state = {
			materialized: initialImpl !== null,
			inFlight: false,
			collisionMode: "merge"
		};
		internal.displayName = apiPath ? `${regExpReplace(/\./g, String(apiPath), "__")}__UnifiedWrapper` : "UnifiedWrapper";
		// These are set dynamically by api-assignment.mjs during collision handling:
		// internal.collisionMergedKeys - Set of keys merged from another wrapper
		// internal.childFilePathsPreMaterialize - Map of child key → file path
		// internal.needsImmediateChildAdoption - boolean flag for eager adoption

		// Store internal state in private field - not an own property, invisible to proxy invariants.
		this.#internal = internal;

		// Add wrapper self-reference as getter AFTER ____slothletInternal is set (avoid circular reference in traversal)
		const wrapper = this;
		Objects.defineProperty(internal, "wrapper", {
			__proto__: null,
			// internal.wrapper is an old back-reference path no longer accessed by any internal code.
			/* v8 ignore start */
			get() {
				return wrapper;
			},
			/* v8 ignore stop */
			enumerable: false,
			configurable: false
		});

		// For callable endpoints, store function in callableImpl (handled in proxy apply trap)
		// Children attach directly to wrapper as properties
		internal.callableImpl = null;

		internal.waitingProxyCache = new Map(); // Cache waiting proxies for the no-context (external) reader bucket
		internal.waitingProxyCacheByContext = new WeakMap(); // context object → inner Map of cache key → waiting proxy
		internal.pendingChanges = null; // Changes made through stand-ins while it has not loaded, made once it has (#653)
		internal.changeGeneration = 0; // Bumped when the node is reloaded or removed, so its old refusals are not its own (#653)
		internal.proxy = null;
		// The module's own object this node was built from a copy of, which a write through the node reaches (#746).
		internal.moduleObject = null;
		// The members defined read-only through the node (#749); null until one is.
		internal.readOnlyKeys = null;
		// A non-callable proxy's handler and installed traps, for the callable upgrade (#533). Null once
		// the proxy is callable (or before it exists).
		internal.proxyHandler = null;
		internal.proxyTraps = null;
		// A lazy proxy's handler and installed traps while its value is unknown, for ___settleLazyProxy().
		internal.lazyProxyHandler = null;
		internal.lazyProxyTraps = null;
		// A settled lazy node's lazy proxy, kept by ___settleLazyProxy() for ___unsettleLazyProxy(); null otherwise.
		internal.settledFrom = null;

		// No clone WITHIN a wrap-on-set-grafted subtree (`deferChildAdopt`, #340): initialImpl
		// becomes the wrapper's live impl reference verbatim, so a `self.X = obj` assignment (and
		// everything grafted beneath it) stays a true two-way live delegation instead of a frozen
		// snapshot. OUTSIDE a deferred subtree — ordinary eager/lazy module and folder loading, and
		// api.add()'s own eager adoption walk — the clone is still required: it protects the
		// CALLER'S OWN OBJECT REFERENCE (and a concurrently-materializing sibling wrapper sharing a
		// cached module) from ___adoptImplChildren's destructive `delete impl[key]` step once a
		// child is adopted. Without it, mounting a caller-owned plain object via api.add() would
		// permanently strip its own keys the first time it's adopted. `_applyNewImpl` (used by
		// `add()`'s ___setImpl path and reload/materialize re-application) still unconditionally
		// clones via `_cloneImpl` — that call site is untouched by this change.
		//
		// ALSO skip the clone for an EventEmitter-derived value regardless of deferChildAdopt
		// (#340) — this is the constructor half of that: it covers a NESTED EventEmitter child
		// (e.g. a `net.Socket` inside `{ socket, ping }` mounted via api.add()), whose own nested
		// wrapper is built by ___createChildWrapper calling back into THIS constructor with the
		// child as initialImpl. It does NOT cover an EventEmitter mounted directly as api.add()'s
		// own top-level leaf — that value is applied via ___setImpl → _applyNewImpl, which still
		// unconditionally clones (see its own comment above). Cloning a real EventEmitter's own
		// descriptors produces a structurally different top-level object; even though nested state
		// (e.g. `_events`) survives via the shallow copy, native methods that check the exact
		// object's identity or internal slots do not. An EventEmitter's own internal graph is never
		// a "namespace container" the way a plain mounted config object is, so it never needs the
		// delete-on-adopt protection the clone exists for in the first place.
		// A module's Proxy is held as its stand-in, so every touch of it runs its traps as the module (#597).
		const adoptedImpl = runtime_adoptedImpl(this, initialImpl);
		const isRootLiveIdentity = deferChildAdopt || (EventEmitter && runtime_inherits(adoptedImpl, EventEmitter));
		internal.impl = isRootLiveIdentity ? adoptedImpl : UnifiedWrapper._cloneImpl(adoptedImpl);
		// The module's own object, when this node is built from a copy of one its file exports (#746).
		internal.moduleObject = isRootLiveIdentity ? null : runtime_moduleObjectFor(this, initialImpl, false);
		runtime_fillPrototype(this);
		runtime_registerLeafFunction(this, internal.impl);

		internal.materializeFunc = materializeFunc;

		// Emit the INTERNAL impl:created contribution event (#398). This is the framework's own
		// construction/contribution stream — delivered via emitInternal() to metadata/routine/ownership
		// only, never to public consumers. It fires per contribution BEFORE collision resolution
		// decides placement, so the routine manager and ownership see every contribution (merge-losers
		// included). The public, post-placement impl:created (with the wrapped callable, no raw impl) is
		// emitted separately once ownership knows the winner — see slothlet.mjs's ownership subscriber.
		// A single emit now carries everything the internal systems need: `wrapper.____impl` (the leaf's
		// impl) plus `____wrapperRef` (the real UnifiedWrapper, for the routine manager's invalidation
		// capture — safe here because this event never leaves the internal tier). The former second,
		// raw-`impl` emit is gone: it existed only to hand out the unwrapped callable, which is exactly
		// the leak #398 removes.
		if (filePath && slothlet.handlers?.lifecycle) {
			slothlet.handlers.lifecycle.emitInternal("impl:created", {
				apiPath,
				// wrapper is a frozen minimal object to avoid leaking the raw UnifiedWrapper
				// (and therefore .slothlet) into any payload a subscriber might retain.
				wrapper: Objects.freeze({ ____impl: this.____slothletInternal.impl }),
				// The real wrapper instance, INTERNAL-only, for RoutineManager#onImplCreated's
				// invalidation-capture (resolveWrapper(____wrapperRef)). Never present on a public event.
				____wrapperRef: this,
				source: "initial",
				moduleID,
				filePath,
				exportPath: internal.exportPath,
				memberExportPaths: internal.memberExportPaths,
				// sourceFolder is always provided by the caller; the config.base fallback is never reached.
				/* v8 ignore next */
				sourceFolder: sourceFolder || slothlet.config?.base
			});
		}

		// A wrap-on-set value takes no eager adoption, so the callable-`then` refusal in
		// ___adoptImplChildren is applied here, as the value becomes a node: at the assignment for the
		// value itself, and on first read for a value nested inside it.
		if (
			deferChildAdopt &&
			initialImpl !== null &&
			(typeof initialImpl === "object" || typeof initialImpl === "function") &&
			resolveWrapper(initialImpl) === null &&
			hasThenMember(initialImpl)
		) {
			throw thenableExportError(this.SlothletError, apiPath);
		}

		if (initialImpl !== null && !deferChildAdopt) {
			const implKeys = Objects.keys(initialImpl || {});
			if (
				(wrapperDebugEnabled || this.____config?.debug?.wrapper) &&
				apiPath &&
				(apiPath === "config" || StringMethods.startsWith(apiPath, "config."))
			) {
				this.slothlet.debug("wrapper", {
					key: "DEBUG_MODE_WRAPPER_CONSTRUCTOR_IMPL_KEYS",
					apiPath,
					keyCount: implKeys.length,
					keySample: copyList(implKeys, 0, 5)
				});
			}
			this.___adoptImplChildren();
			if (
				(wrapperDebugEnabled || this.____config?.debug?.wrapper) &&
				apiPath &&
				(apiPath === "config" || StringMethods.startsWith(apiPath, "config."))
			) {
				const childKeys = filterList(Objects.keys(this), (k) => !isFrameworkReservedKey(k));
				this.slothlet.debug("wrapper", {
					key: "DEBUG_MODE_WRAPPER_CONSTRUCTOR_AFTER_ADOPT",
					apiPath,
					childCount: childKeys.length,
					childKeySample: copyList(childKeys, 0, 5)
				});
			}
		}

		// Register lazy wrapper for materialization tracking
		if (mode === "lazy") {
			this.___trackLazyLoad("register");

			// loader.materialize: load in the background (fire-and-forget). This is the only place background loading
			// starts. It is deferred a macrotask, through the host clock when one is given (`clock.set`), so the wrapper
			// and its proxy are fully built before the load begins.
			if (this.____slothletInternal.materializeOnCreate) {
				scheduleMacrotask(
					() => {
						PromiseMethods.catch(this.___materialize(), (err) => {
							// Silently catch errors - background materialization is best-effort
							// The FALSE branch (debug off, error silently dropped) requires inducing a background
							// materialization failure without debug.materialize enabled — not testable deterministically.
							/* v8 ignore next */
							if (slothlet.config?.debug?.materialize) {
								slothlet.debug("materialize", {
									key: "DEBUG_MODE_BACKGROUND_MATERIALIZE_ERROR",
									apiPath: this.____slothletInternal?.apiPath,
									error: err.message
								});
							}
						});
					},
					undefined,
					this.clock
				);
			}
		}
	}

	/**
	 * Custom inspect output for Node.js `util.inspect`.
	 *
	 * Defined as an ordinary named method and wired to the `util.inspect.custom`
	 * symbol via a prototype assignment after the class. A computed
	 * `[util.inspect.custom]` member in the class body makes tsc emit a spurious
	 * numeric index signature (`[x: number]`) into the generated `.d.mts`; an
	 * ordinary named method emits cleanly instead.
	 * @returns {*} The actual implementation for inspection.
	 * @internal
	 */
	____inspectCustom(____depth, ____options, ____inspect) {
		// When proxyTarget === wrapper (non-callable), the prototype chain check in createProxy()
		// finds this method and skips installing the closure own-property. Node then calls this
		// prototype method with `this` = proxy, where ____slothletInternal is blocked by getTrap.
		// Resolve the real wrapper instance via the proxy registry to handle that case.
		const w = WeakMapMethods.get(_proxyRegistry, this) ?? this;
		// Show children from wrapper (filter internal properties starting with _ or __)
		const childKeys = filterList(Objects.keys(w), (k) => !isFrameworkReservedKey(k));
		if (childKeys.length > 0 && !w.____slothletInternal?.isCallable) {
			const inspectObj = {};
			for (let ofIndex = 0, ofList = childKeys; ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				// Return the proxy/wrapper directly - Node will recursively inspect it
				inspectObj[key] = w[key];
			}
			return inspectObj;
		}

		// For callables or leaf nodes - return actual ____impl value if materialized
		// For unmaterialized lazy wrappers, return the proxy to show it's a function
		if (
			w.____slothletInternal?.mode === "lazy" &&
			w.____slothletInternal?.state &&
			!w.____slothletInternal?.state.materialized &&
			w.____slothletInternal?.proxy
		) {
			return w.____slothletInternal.proxy;
		}
		return w.____slothletInternal?.impl;
	}

	/**
	 * Get current implementation
	 * @returns {Function|Object|null} Current ____impl value
	 * @public
	 */
	get ____impl() {
		return this.____slothletInternal.impl;
	}
}

setResultAttributor(runtime_attributeResult);

setModuleNodeResolver(runtime_nodeAtPath);

// An api node or a per-reader view handed to a leaf carries no code of its caller's (#597).
setApiValueCheck(
	(value) => WeakMapMethods.has(_proxyRegistry, value) || WeakSetMethods.has(capturedViewSet, value),
	runtime_nodeHarborsCode
);

// Wire Node's `util.inspect.custom` hook to the (internal) `____inspectCustom`
// method. Keeping the symbol off the class body prevents tsc from emitting a
// spurious numeric index signature in the `.d.mts`. `Object.defineProperty`
// (not a plain assignment) is used so the property is non-enumerable, writable
// and configurable — the exact descriptor a computed `[util.inspect.custom]()`
// method declared in the class body would have produced. A plain assignment
// would instead create an enumerable property, diverging from class-method
// semantics.
Objects.defineProperty(UnifiedWrapper.prototype, util.inspect.custom, {
	__proto__: null,
	value: UnifiedWrapper.prototype.____inspectCustom,
	writable: true,
	enumerable: false,
	configurable: true
});

/**
 * Whether a value is an instance of a class: an object whose prototype is neither `Object.prototype`
 * nor `null` (plain objects) nor `Array.prototype`.
 * @param {unknown} value - Value to test.
 * @returns {boolean} True for a class instance.
 * @public
 *
 * @example
 * isClassInstance(new Map()); // true
 * isClassInstance({ a: 1 }); // false
 */
export function isClassInstance(value) {
	if (!value || typeof value !== "object" || Arrays.isArray(value)) return false;
	const proto = Objects.getPrototypeOf(value);
	return proto !== null && proto !== Objects.prototype;
}

/**
 * Resolves a value to its backing UnifiedWrapper instance.
 * Accepts a proxy registered via createProxy() or a raw UnifiedWrapper instance.
 * Returns null for any other value.
 *
 * @param {unknown} value - Value to resolve
 * @returns {UnifiedWrapper|null} The backing wrapper, or null
 *
 * @example
 * const wrapper = resolveWrapper(someProxy);
 * if (wrapper) wrapper.____slothletInternal.impl = newImpl;
 */
function resolveWrapper(value) {
	if (!value) return null;
	// Check registry first - handles all proxies created by createProxy().
	// A Proxy wrapping a UnifiedWrapper target passes instanceof UnifiedWrapper (via prototype
	// chain delegation), but the getTrap blocks ____slothletInternal, so registry must come first.
	const registered = WeakMapMethods.get(_proxyRegistry, value);
	if (registered) return registered;
	// Raw UnifiedWrapper instances (not proxies): the class's own brand, so a Proxy's traps never run to tell (#632),
	// and the prototype getter works, so ____slothletInternal is non-null. Proxies of wrappers return undefined for it
	// (blocked in getTrap) and are handled via the registry above.
	if (UnifiedWrapper.____isWrapperInstance(value) && value.____slothletInternal != null) return value;
	return null;
}

/**
 * Whether `key` is one of the names a wrapper answers itself when it has no member of that name
 * (`name`, `length`, `prototype`, …; see {@link WRAPPER_ANSWERED_PROPS}).
 * @param {string} key - Member name.
 * @returns {boolean} True for a wrapper-answered name.
 * @internal
 *
 * @example
 * isWrapperAnsweredName("name"); // true
 */
export function isWrapperAnsweredName(key) {
	return SetMethods.has(WRAPPER_ANSWERED_PROPS, key);
}

/**
 * Read `key` off `container` as an api member: what `container[key]` holds, or `undefined` when there
 * is no member of that name.
 *
 * The two differ only for the names a wrapper answers itself (`name`, `length`, …; see
 * {@link WRAPPER_ANSWERED_PROPS}). `api.session.name` reads `"session"` when `session` has no `name`
 * member. That is the right answer for a caller asking what the node's name is, and the wrong one for
 * a caller deciding whether `session.name` is already taken: treating the string as an existing value
 * made `api.add("session.name", …)` refuse to mount, and a deeper mount path reject `session.name` as
 * not traversable (#571). Composition code that asks "is there a member here?" reads through this.
 *
 * An unloaded lazy wrapper's exports are unknown until it loads, so its own read is returned as-is. A
 * plain object's member is an own property: one it only inherits is not a member.
 * @param {object|Function} container - Api node (a wrapper proxy) or plain object to read from.
 * @param {string} key - Member name.
 * @returns {unknown} The member, or `undefined` when the wrapper would only answer `key` itself.
 * @internal
 *
 * @example
 * readApiMember(api.profile, "name"); // undefined — `profile` has no `name` member
 * api.profile.name; // "profile"
 */
export function readApiMember(container, key) {
	const wrapper = resolveWrapper(container);
	if (wrapper && SetMethods.has(WRAPPER_ANSWERED_PROPS, key) && !runtime_hasOwnMember(wrapper, key)) {
		const { mode, state } = wrapper.____slothletInternal;
		if (mode !== "lazy" || state.materialized) return undefined;
	}
	// A plain object (the api root while it is built) holds its members as own properties; what it
	// inherits (`toString`, `hasOwnProperty`, …) is `Object.prototype`'s, and treating it as an existing
	// node would write the mount into the global builtin.
	if (!wrapper) return Objects.hasOwn(container, key) ? container[key] : undefined;
	// The framework reads its own tree, often while a module's call is executing (that module's own
	// `api.add`), and works on the node itself: a read under a module's identity hands back that module's
	// captured view, which is not the node, so the mount would merge the node into itself and write to it
	// as that module (#625).
	const member = container[key];
	return (
		(member !== null && (typeof member === "object" || typeof member === "function") && WeakMapMethods.get(capturedViewTargets, member)) ||
		member
	);
}

/**
 * {@link readApiMember}, loading an unloaded lazy wrapper first when `key` is a name the wrapper
 * answers itself — the one case where an unloaded node cannot tell its own answer from a member of
 * that name (#571). Any other key is read without loading.
 *
 * The member comes back in an envelope: a lazy member is itself thenable (awaiting it loads it), so
 * resolving the promise with the member would load every node the read reaches.
 * @param {object|Function} container - Api node (a wrapper proxy) or plain object to read from.
 * @param {string} key - Member name.
 * @returns {Promise<{value: unknown}>} The member as `value`, or `undefined` when there is none.
 * @internal
 *
 * @example
 * const { value } = await loadApiMember(api.profile, "name"); // loads a lazy `profile`, then reads its `name` member
 */
export async function loadApiMember(container, key) {
	if (SetMethods.has(WRAPPER_ANSWERED_PROPS, key) && resolveWrapper(container)) {
		// A waiting proxy stands for a member of a node that has not loaded, and maps back to that
		// ancestor's wrapper; awaiting it loads the chain and yields the member itself, the node `key`
		// must be read on. A loaded node is not thenable and is unchanged.
		container = await container;
		// The chain named no member: there is nothing to read `key` on.
		if (container === null || (typeof container !== "object" && typeof container !== "function")) return { value: undefined };
		const wrapper = resolveWrapper(container);
		const { mode, state } = wrapper?.____slothletInternal ?? {};
		if (mode === "lazy" && !state.materialized) await wrapper.___materialize();
	}
	return { value: readApiMember(container, key) };
}

/**
 * Whether `value` can be called: a plain function can; an api node can only when it is a callable
 * leaf, not a namespace. An unloaded lazy node is loaded first, since its callability is unknown until
 * then. `typeof` alone cannot tell — a lazy namespace is a function-typed proxy — so a root `shutdown/`
 * or `destroy/` folder was taken for a user lifecycle hook in lazy mode and calling it threw, where
 * eager (an object namespace) ignored it (#583).
 * @param {unknown} value - Candidate.
 * @returns {Promise<boolean>} True when `value` is callable.
 * @internal
 *
 * @example
 * if (await isCallableValue(slothlet.userHooks.shutdown)) await slothlet.userHooks.shutdown();
 */
export async function isCallableValue(value) {
	if (typeof value !== "function") return false;
	const wrapper = resolveWrapper(value);
	if (!wrapper) return true;
	const internal = wrapper.____slothletInternal;
	if (internal.mode === "lazy" && !internal.state.materialized) await wrapper.___materialize();
	return internal.isCallable === true;
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (
		!mayTakeInternals(consumer, [
			"lib/builders/api-assignment",
			"lib/builders/api_builder",
			"lib/builders/modes-processor",
			"lib/handlers/api-manager",
			"lib/handlers/event-manager",
			"lib/handlers/hook-manager",
			"lib/handlers/lifecycle",
			"lib/handlers/metadata",
			"lib/handlers/module-manager",
			"lib/handlers/ownership",
			"lib/handlers/permission-manager",
			"lib/handlers/routine-manager",
			"lib/processors/type-generator",
			"lib/runtime/runtime-asynclocalstorage",
			"lib/runtime/runtime-livebindings",
			"slothlet"
		])
	)
		throw ownBindingsRefusal("lib/handlers/unified-wrapper", import.meta.url);
	return {
		get UnifiedWrapper() {
			return UnifiedWrapper;
		},
		registerRuntimeContext,
		registerRuntimeSelf,
		releaseModuleMakers,
		releaseStandInChanges,
		resolveWrapper,
		runtime_assertCapability,
		runtime_hasInternalSlots,
		runtime_nodeReport,
		runtime_metadataNodeOf,
		runtime_assertFrameworkRootChange,
		runtime_codeLabel,
		runtime_contextRead,
		runtime_contextReadAsDefiner,
		runtime_contextWritten,
		runtime_dataReadOptions,
		runtime_defineRootInspect,
		runtime_eventPayloadFor,
		runtime_frameworkViewCaller,
		runtime_frameworkWrite,
		runtime_inheritsBuiltin,
		runtime_isCallerLocked,
		runtime_isLanguageNameDescriptor,
		runtime_markCallerLocked,
		runtime_instanceEnded,
		runtime_markInstanceEnded,
		runtime_nodeBehind,
		runtime_registerFrameworkMember,
		runtime_registerFrameworkMemberCopy,
		runtime_resolvedAccess,
		runtime_runWrite,
		runtime_takeRunWrite,
		runtime_viewAccessor,
		runtime_runViewAccessor,
		runtime_protoAssignSetsPrototype,
		runtime_isApiNode,
		runtime_nodeWrapperOf,
		runtime_nodeVersion,
		runtime_prototypeAtStart,
		runtime_inheritedAtStart,
		runtime_classPrototypeOf,
		runtime_privateCallReceiver,
		runtime_loadStandIn,
		runtime_runWriteSinceClosed,
		runtime_nodeOpen,
		runtime_throughRunView,
		runtime_builtinBehind,
		runtime_sameSnapshotMember,
		runtime_holdsOwnMember,
		runtime_rootGate,
		runtime_registerRunView,
		runtime_enforceReadGate,
		runtime_assertRootChange,
		runtime_registerRoot,
		runtime_noteRootFile,
		runtime_rootFileOf,
		runtime_rootCall,
		runtime_rootCallCheck,
		runtime_rootClose,
		runtime_rootDefine,
		runtime_rootAssign,
		runtime_rootFixedMember,
		runtime_rootListing,
		runtime_rootMemberDescriptor,
		runtime_rootMemberRead,
		runtime_rootWithheld,
		runtime_rootPrototypeFor,
		runtime_rootInheritedRead,
		runtime_behindGivenView,
		runtime_rootTakesKey,
		runtime_sameValue,
		runtime_selfChangeTarget,
		runtime_selfFrameworkView,
		runtime_selfHookHandler,
		runtime_selfModuleCeilings,
		runtime_selfModuleReader,
		runtime_selfReadAsDefiner,
		runtime_selfToJSON,
		runtime_selfRootView,
		runtime_selfView,
		runtime_unwrapSelfView,
		settleStandInChanges
	};
}

/**
 * The files of slothlet's own that took this file's bindings (see {@link internals}). A `var` with no initializer, so a
 * file can take them before this file's top level has run (a cycle of slothlet's own files), and that run does not reset
 * what was taken.
 * @type {object|undefined}
 * @private
 */
var internalsTaken;

/**
 * Whether a file may take this file's bindings: it is one of those listed, and has not taken them yet. Reads no import
 * and no built-in a module can replace, so it answers the same before this file's imports are ready and after.
 * @param {string} consumer - The file asking.
 * @param {string[]} consumers - The files that take them.
 * @returns {boolean} True, once, for each file listed.
 * @private
 */
function mayTakeInternals(consumer, consumers) {
	if (internalsTaken === undefined) internalsTaken = { __proto__: null };
	let listed = false;
	for (let i = 0; i < consumers.length; i++) if (consumers[i] === consumer) listed = true;
	if (!listed || typeof consumer !== "string") return false;
	// Taken already: only a second evaluation of that very file, at its own top level, takes them again.
	if (internalsTaken[consumer] === true) return isOwnTopLevelOf(consumer);
	internalsTaken[consumer] = true;
	return true;
}

// The exports below answer slothlet's own files and the host only (see `guardInternal` in `helpers/instance-imports`).
/** @type {typeof runtime_frameworkWrite} */
const guarded_runtime_frameworkWrite = guardInternal(runtime_frameworkWrite, "runtime_frameworkWrite", import.meta.url);

/** @type {typeof runtime_unwrapSelfView} */
const guarded_runtime_unwrapSelfView = guardInternal(runtime_unwrapSelfView, "runtime_unwrapSelfView", import.meta.url);

/** @type {typeof runtime_selfModuleReader} */
const guarded_runtime_selfModuleReader = guardInternal(runtime_selfModuleReader, "runtime_selfModuleReader", import.meta.url);

/** @type {typeof runtime_selfModuleCeilings} */
const guarded_runtime_selfModuleCeilings = guardInternal(runtime_selfModuleCeilings, "runtime_selfModuleCeilings", import.meta.url);

/** @type {typeof runtime_selfView} */
const guarded_runtime_selfView = guardInternal(runtime_selfView, "runtime_selfView", import.meta.url);

/** @type {typeof runtime_registerFrameworkMemberCopy} */
const guarded_runtime_registerFrameworkMemberCopy = guardInternal(
	runtime_registerFrameworkMemberCopy,
	"runtime_registerFrameworkMemberCopy",
	import.meta.url
);

/** @type {typeof runtime_registerFrameworkMember} */
const guarded_runtime_registerFrameworkMember = guardInternal(
	runtime_registerFrameworkMember,
	"runtime_registerFrameworkMember",
	import.meta.url
);

/** @type {typeof runtime_selfFrameworkView} */
const guarded_runtime_selfFrameworkView = guardInternal(runtime_selfFrameworkView, "runtime_selfFrameworkView", import.meta.url);

/** @type {typeof runtime_assertFrameworkRootChange} */
const guarded_runtime_assertFrameworkRootChange = guardInternal(
	runtime_assertFrameworkRootChange,
	"runtime_assertFrameworkRootChange",
	import.meta.url
);

/** @type {typeof runtime_selfChangeTarget} */
const guarded_runtime_selfChangeTarget = guardInternal(runtime_selfChangeTarget, "runtime_selfChangeTarget", import.meta.url);

/** @type {typeof runtime_frameworkViewCaller} */
const guarded_runtime_frameworkViewCaller = guardInternal(runtime_frameworkViewCaller, "runtime_frameworkViewCaller", import.meta.url);

/** @type {typeof runtime_selfRootView} */
const guarded_runtime_selfRootView = guardInternal(runtime_selfRootView, "runtime_selfRootView", import.meta.url);

/** @type {typeof runtime_markCallerLocked} */
const guarded_runtime_markCallerLocked = guardInternal(runtime_markCallerLocked, "runtime_markCallerLocked", import.meta.url);

/** @type {typeof runtime_isCallerLocked} */
const guarded_runtime_isCallerLocked = guardInternal(runtime_isCallerLocked, "runtime_isCallerLocked", import.meta.url);

/** @type {typeof runtime_selfHookHandler} */
const guarded_runtime_selfHookHandler = guardInternal(runtime_selfHookHandler, "runtime_selfHookHandler", import.meta.url);

/** @type {typeof settleStandInChanges} */
const guarded_settleStandInChanges = guardInternal(settleStandInChanges, "settleStandInChanges", import.meta.url);

/** @type {typeof releaseStandInChanges} */
const guarded_releaseStandInChanges = guardInternal(releaseStandInChanges, "releaseStandInChanges", import.meta.url);

/** @type {typeof refusedChangeCount} */
const guarded_refusedChangeCount = guardInternal(refusedChangeCount, "refusedChangeCount", import.meta.url);

/** @type {typeof runtime_resolvedAccess} */
const guarded_runtime_resolvedAccess = guardInternal(runtime_resolvedAccess, "runtime_resolvedAccess", import.meta.url);

/** @type {typeof releaseModuleMakers} */
const guarded_releaseModuleMakers = guardInternal(releaseModuleMakers, "releaseModuleMakers", import.meta.url);

/** @type {typeof moduleMakerCount} */
const guarded_moduleMakerCount = guardInternal(moduleMakerCount, "moduleMakerCount", import.meta.url);

/** @type {typeof registerRuntimeSelf} */
const guarded_registerRuntimeSelf = guardInternal(registerRuntimeSelf, "registerRuntimeSelf", import.meta.url);

/** @type {typeof runtime_selfReadAsDefiner} */
const guarded_runtime_selfReadAsDefiner = guardInternal(runtime_selfReadAsDefiner, "runtime_selfReadAsDefiner", import.meta.url);

/** @type {typeof runtime_contextReadAsDefiner} */
const guarded_runtime_contextReadAsDefiner = guardInternal(runtime_contextReadAsDefiner, "runtime_contextReadAsDefiner", import.meta.url);

/** @type {typeof registerRuntimeContext} */
const guarded_registerRuntimeContext = guardInternal(registerRuntimeContext, "registerRuntimeContext", import.meta.url);

/** @type {typeof runtime_contextWritten} */
const guarded_runtime_contextWritten = guardInternal(runtime_contextWritten, "runtime_contextWritten", import.meta.url);

/** @type {typeof runtime_contextRead} */
const guarded_runtime_contextRead = guardInternal(runtime_contextRead, "runtime_contextRead", import.meta.url);

/** @type {typeof runtime_eventPayloadFor} */
const guarded_runtime_eventPayloadFor = guardInternal(runtime_eventPayloadFor, "runtime_eventPayloadFor", import.meta.url);

/** @type {typeof UnifiedWrapper} */
const guarded_UnifiedWrapper = guardInternal(UnifiedWrapper, "UnifiedWrapper", import.meta.url);

/** @type {typeof resolveWrapper} */
const guarded_resolveWrapper = guardInternal(resolveWrapper, "resolveWrapper", import.meta.url);

/** @type {typeof runtime_nodeBehind} */
const guarded_runtime_nodeBehind = guardInternal(runtime_nodeBehind, "runtime_nodeBehind", import.meta.url);

export {
	guarded_runtime_frameworkWrite as runtime_frameworkWrite,
	guarded_runtime_unwrapSelfView as runtime_unwrapSelfView,
	guarded_runtime_selfModuleReader as runtime_selfModuleReader,
	guarded_runtime_selfModuleCeilings as runtime_selfModuleCeilings,
	guarded_runtime_selfView as runtime_selfView,
	guarded_runtime_registerFrameworkMemberCopy as runtime_registerFrameworkMemberCopy,
	guarded_runtime_registerFrameworkMember as runtime_registerFrameworkMember,
	guarded_runtime_selfFrameworkView as runtime_selfFrameworkView,
	guarded_runtime_assertFrameworkRootChange as runtime_assertFrameworkRootChange,
	guarded_runtime_selfChangeTarget as runtime_selfChangeTarget,
	guarded_runtime_frameworkViewCaller as runtime_frameworkViewCaller,
	guarded_runtime_selfRootView as runtime_selfRootView,
	guarded_runtime_markCallerLocked as runtime_markCallerLocked,
	guarded_runtime_isCallerLocked as runtime_isCallerLocked,
	guarded_runtime_selfHookHandler as runtime_selfHookHandler,
	guarded_settleStandInChanges as settleStandInChanges,
	guarded_releaseStandInChanges as releaseStandInChanges,
	guarded_refusedChangeCount as refusedChangeCount,
	guarded_runtime_resolvedAccess as runtime_resolvedAccess,
	guarded_releaseModuleMakers as releaseModuleMakers,
	guarded_moduleMakerCount as moduleMakerCount,
	guarded_registerRuntimeSelf as registerRuntimeSelf,
	guarded_runtime_selfReadAsDefiner as runtime_selfReadAsDefiner,
	guarded_runtime_contextReadAsDefiner as runtime_contextReadAsDefiner,
	guarded_registerRuntimeContext as registerRuntimeContext,
	guarded_runtime_contextWritten as runtime_contextWritten,
	guarded_runtime_contextRead as runtime_contextRead,
	guarded_runtime_eventPayloadFor as runtime_eventPayloadFor,
	guarded_UnifiedWrapper as UnifiedWrapper,
	guarded_resolveWrapper as resolveWrapper,
	guarded_runtime_nodeBehind as runtime_nodeBehind
};
