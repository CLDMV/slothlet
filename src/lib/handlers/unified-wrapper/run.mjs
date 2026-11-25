/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/run.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:24:02-08:00 (1795641842)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Run layer of the wrapper: run views, checkpoints and run snapshots, and the run write.
 *
 * Upward services (from layers above this one, reached through the method table): FRAMEWORK_MEMBERS (views),
 *  builtinBehind (views), hasOwn (views), heldValue (root), rootGate (root), selfView (views), unwrapSelfView
 *  (views).
 * @module @cldmv/slothlet/handlers/unified-wrapper/run
 * @internal
 */

import { util } from "#helpers/platform";
import { isCompositionLayer, layerUnderlying } from "#helpers/composition";
import { isFrameworkMemberName, isFrameworkReservedKey } from "#helpers/reserved-keys";
import { absorbsFrameworkName, internals as frameworkInternalsInternals, isFrameworkInternal } from "#handlers/framework-internals";
import { failureRecord, rememberFailure, rememberedFailure, unwrapThrown } from "#handlers/hook-manager";
import { isSharedExport } from "#handlers/shared-values";
import {
	ArrayMethods,
	Arrays,
	FunctionMethods,
	functionSource,
	listPush,
	Map,
	MapMethods,
	NativeProxy,
	Objects,
	PromiseMethods,
	Reflect,
	RegExpMethods,
	Set,
	SetMethods,
	Symbol,
	WeakMap,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods,
	Symbols,
	setFrom,
	copyList,
	concatLists,
	Functions,
	ObjectProtoSetter,
	setToArray,
	mapKeys,
	setValues,
	mapValues,
	mapEntriesToArray,
	listUnshift,
	String
} from "#helpers/intrinsics";
import {
	beforeChange,
	builtinKind,
	checkpointDeep,
	checkpointOnce,
	domainOf,
	isDefaultPrototype,
	isLanguagePrototype,
	runsOpen,
	saveDefaultPrototype,
	savedThisWindow,
	isSharedLive,
	versionAt,
	CURRENT,
	shallowCopy,
	builtinCopy,
	isRawRunView,
	handOutRaw,
	handOutSettled,
	rawBehind,
	rawContent,
	declaresPrivate
} from "#helpers/run-snapshot";
import { RUN_COPY, RUN_SELF } from "#helpers/flow-stores";

import { ownBindingsRefusal } from "#helpers/instance-imports";
import { internals as callerPinningInternals } from "#helpers/caller-pinning";
const { markSlothletProxy } = frameworkInternalsInternals("lib/handlers/unified-wrapper/run");
const { isCallerLocked } = callerPinningInternals("lib/handlers/unified-wrapper/run");

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 */
let trustedRootOwn,
	fileNodes,
	outerCallerCeiling,
	hasOwn,
	FRAMEWORK_WRITES,
	holdsDataKind,
	assertOwnedWrite,
	nodeWrapperOf,
	nodeOpen,
	readOnBehalf,
	ownsPrototype,
	moduleObjectOf,
	INTRINSICS,
	isSlothletValue,
	makerOf,
	makerInstanceID,
	resolveWrapper,
	viewAccessor,
	unwrapSelfView,
	selfView,
	builtinBehind,
	isApiNode,
	inheritedAtStart,
	holdsOwnMember,
	hasInternalSlots,
	enforceRead,
	registerRunView,
	isLazyStandIn,
	rootGate,
	sameLookup,
	FRAMEWORK_MEMBERS,
	registerFrameworkMember,
	FRAMEWORK_MEMBER_NAMES,
	takeRefusedChange,
	WAITING_CHAINS,
	isWrapper;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/**
 * Whether a function runs none of a module's code of its own: the engine's (`Function.prototype.toString` reports
 * native code), a bound function among them. A bound function whose target is a module's function runs that function,
 * whose frames attribute what it does whatever {@link ACTING_FOR} holds. Decided from the source text alone, so nothing
 * of the function runs.
 * @param {Function} fn - The function, not a Proxy.
 * @returns {boolean} True when it reports native code.
 * @private
 */
function runsNoModuleCode(fn) {
	if (util.types.isProxy(fn)) return false;
	return RegExpMethods.exec(/\{\s*\[native code\]\s*\}\s*$/, functionSource(fn)) !== null;
}

/**
 * Whether a function a module hands on runs for that module wherever it runs ({@link ACTING_FOR}): it runs none of a
 * module's code of its own, so no frame of the handing module's says whose its writes are. A bound built-in, an
 * anonymous one (a promise's resolver), a function of the language's own and one of Node's (`util._extend`) are; a
 * module's own function, whose frames attribute what it does, and slothlet's own values, are not.
 * @param {*} value - The value handed on.
 * @param {object|null} from - The wrapper of the module handing it on.
 * @returns {boolean} True when it runs for that module.
 * @private
 */
function runsForHander(value, from) {
	if (typeof value !== "function" || !from?.____slothletInternal || util.types.isProxy(value)) return false;
	if (isSlothletValue(value) || isFrameworkInternal(value)) return false;
	return WeakSetMethods.has(INTRINSICS, value) || isSharedExport(value) || runsNoModuleCode(value);
}

/**
 * The change a full-isolation run's `self` is making to a node of the tree the run reads but does not own yet, while it
 * makes it: the node (a wrapper, or the instance's bound api for the root), the member, and where the change goes
 * instead of the node. The node's own trap checks the change as it checks any change, and stores it there in place of
 * the node only once every check has passed (see {@link takeRunWrite}).
 * @type {{node: object, prop: string|symbol, sink: function(object): boolean}|null}
 * @private
 */
const runShared = {
	__proto__: null,
	RUN_WRITE: null
};

/**
 * Make a change through a node of the api for a full-isolation run's `self`: the node's own trap decides it, and a
 * change it lets through is handed to `sink` instead of being made on the node.
 * @param {object} node - The wrapper (or bound api) whose trap the change reaches.
 * @param {string|symbol|null} prop - The member changed; null for a change to the node itself (its prototype, its
 *   extensibility).
 * @param {function(object): boolean} sink - Takes the change (`{op, value}`, `{op, descriptor}`, `{op: "prototype",
 *   prototype}` or `{op: "close"}`); returns its answer.
 * @param {function(): *} change - Makes the change on the node.
 * @returns {*} What `change` returned.
 * @internal
 */
function runWrite(node, prop, sink, change) {
	const previous = runShared.RUN_WRITE;
	runShared.RUN_WRITE = { node, prop, sink };
	try {
		return change();
	} finally {
		runShared.RUN_WRITE = previous;
	}
}

/**
 * The sink a change a trap is about to make goes to instead of the node (see {@link runWrite}): only for the
 * change the run's `self` is making on this very node and member, once. Null for every other change.
 * @param {object} node - The wrapper (or bound api) making the change.
 * @param {string|symbol|null} prop - The member; null for a change to the node itself.
 * @returns {function(object): boolean|null} The sink, or null.
 * @internal
 */
function takeRunWrite(node, prop) {
	const pending = runShared.RUN_WRITE;
	if (pending === null || pending.node !== node || pending.prop !== prop) return null;
	runShared.RUN_WRITE = null;
	return pending.sink;
}

/**
 * Run one half of an accessor {@link viewAccessor} found, as the module the node belongs to, on `receiver`.
 * @param {{wrapper: object}} accessor - The accessor.
 * @param {Function} half - Its getter or setter.
 * @param {*} receiver - The `this` it runs with.
 * @param {Array<*>} args - Its arguments.
 * @returns {*} What it returned.
 * @internal
 */
function runViewAccessor(accessor, half, receiver, args) {
	return accessor.wrapper.___runAccessor(half, receiver, args);
}

/**
 * Marks a member a node's saved version leaves to the node as it is now (an accessor, a member of a module's own Proxy):
 * a read of it in a run reads it live.
 * @type {{live: true}}
 * @private
 */
const SNAPSHOT_LIVE_MEMBER = Objects.freeze({ __proto__: null, live: true });

/**
 * What a node holds now, as a run that started before its next change reads it (see `helpers/run-snapshot`): each
 * member the node holds on itself (a child node, or a value it keeps) and each its value holds, with the attributes it
 * has, as the node's own traps would find it. Accessors and the members of a module's own Proxy are left to be read
 * live. Nothing runs: only the node's own store and its value are read, by their descriptors.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {{members: Map<PropertyKey, (object|symbol)>, extensible: boolean}} The content.
 * @private
 */
function captureNode(wrapper) {
	const members = new Map();
	const keep = (key, described) => {
		if (described === undefined || isFrameworkReservedKey(key) || MapMethods.has(members, key)) return;
		if (!("value" in described)) {
			MapMethods.set(members, key, SNAPSHOT_LIVE_MEMBER);
			return;
		}
		// A child node answering a value in its place (a primitive a file exports) is kept as that value.
		let value = described.value;
		const child = value !== null && (typeof value === "object" || typeof value === "function") ? resolveWrapper(value) : null;
		if (child !== null && child.___holdsValue()) value = child.___heldValue();
		MapMethods.set(members, key, {
			__proto__: null,
			value,
			enumerable: described.enumerable === true,
			writable: described.writable !== false
		});
	};
	// A node fronting a module's own object holds what that object holds (the node follows it on its next read): the
	// object is read, so a change the module made through its own variable and the node has not followed yet is not
	// taken for the node's.
	const object = moduleObjectOf(wrapper);
	// Whether the node takes new members and the prototype it holds, as they are now.
	const open = nodeOpen(wrapper);
	const prototype = snapshotPrototype(wrapper);
	if (object !== null) {
		const keys = Reflect.ownKeys(object);
		for (let index = 0; index < keys.length; index++) keep(keys[index], Reflect.getOwnPropertyDescriptor(object, keys[index]));
		return { members, extensible: open && Reflect.isExtensible(object), prototype };
	}
	const own = Reflect.ownKeys(wrapper);
	for (let index = 0; index < own.length; index++) keep(own[index], Reflect.getOwnPropertyDescriptor(wrapper, own[index]));
	const impl = wrapper.____slothletInternal.impl;
	if (impl !== null && (typeof impl === "object" || typeof impl === "function")) {
		if (util.types.isProxy(impl) && !isCompositionLayer(impl)) {
			// A module's own Proxy answers for itself: its members are read live.
		} else {
			const held = layerUnderlying(impl);
			const keys = Reflect.ownKeys(held);
			for (let index = 0; index < keys.length; index++) {
				const key = keys[index];
				// A function's own `length`, `name`, `arguments` and `caller` are the language's, answered by the node as they
				// are now. Its `prototype` is the object it held then, which the instance may replace.
				if (typeof held === "function" && (key === "length" || key === "name" || key === "arguments" || key === "caller")) {
					if (!MapMethods.has(members, key)) MapMethods.set(members, key, SNAPSHOT_LIVE_MEMBER);
					continue;
				}
				keep(key, Reflect.getOwnPropertyDescriptor(held, key));
			}
		}
	}
	return { members, extensible: open, prototype };
}

/**
 * Marks a prototype the snapshot cannot tell (see {@link snapshotPrototype}).
 * @type {symbol}
 * @private
 */
const SNAPSHOT_UNKNOWN_PROTOTYPE = Symbol("slothlet.snapshot.unknownPrototype");

/**
 * The prototype a node holds now, as slothlet holds it (no reader's view of it): its array's, its built-in's, its
 * module object's, the one its record holds, or its value's. Read by the platform only, nothing of the module runs.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {object|null|symbol} The prototype, or {@link SNAPSHOT_UNKNOWN_PROTOTYPE}.
 * @private
 */
function snapshotPrototype(wrapper) {
	const internal = wrapper.____slothletInternal;
	const impl = internal.impl;
	if (internal.runPrototype !== undefined) return internal.runPrototype.prototype;
	if (Arrays.isArray(impl)) return Reflect.getPrototypeOf(layerUnderlying(impl));
	if (impl !== null && typeof impl === "object" && util.types.isProxy(impl) && !isCompositionLayer(impl)) return SNAPSHOT_UNKNOWN_PROTOTYPE;
	if (holdsDataKind(impl)) return Reflect.getPrototypeOf(impl);
	const moduleObject = moduleObjectOf(wrapper);
	if (moduleObject !== null) return Reflect.getPrototypeOf(moduleObject);
	if (ownsPrototype(wrapper)) return wrapper.___recordedPrototype();
	if (impl !== null && (typeof impl === "object" || typeof impl === "function")) return Reflect.getPrototypeOf(layerUnderlying(impl));
	return SNAPSHOT_UNKNOWN_PROTOTYPE;
}

/**
 * Save the prototypes of a module's own a node inherits from (and its class's prototype, for a class), for the runs
 * open (see {@link checkpointBuiltin}): the module's code changes them as themselves.
 * @param {object|null} domain - The instance's domain.
 * @param {UnifiedWrapper} node - The node's wrapper.
 * @returns {void}
 * @private
 */
function checkpointNodePrototypes(domain, node) {
	const prototype = snapshotPrototype(node);
	if (prototype !== SNAPSHOT_UNKNOWN_PROTOTYPE && !isLanguagePrototype(prototype) && resolveWrapper(prototype) === null)
		checkpointBuiltin(domain, prototype);
	// A function's own prototype is a class's, or holds what the module put on it, and is saved as any object is. A plain
	// function's that still holds only its `constructor` is saved as the function only, its content made when a run that
	// started before the module gave it more reads it (see saveDefaultPrototype).
	const classPrototype = node.___wrapperClassPrototype();
	if (classPrototype === null || isLanguagePrototype(classPrototype)) return;
	const fn = layerUnderlying(node.____slothletInternal.impl);
	if (isDefaultPrototype(classPrototype, fn)) saveDefaultPrototype(domain, classPrototype, fn);
	else checkpointBuiltin(domain, classPrototype);
}

/**
 * A change a run's view makes to a node the instance closed (froze, sealed, or made non-extensible) after the run
 * started: the node took it when the run started, so it is held to the write rules at its path and kept by the run,
 * without going through the node, which no longer takes it.
 * @param {*} node - The node, as the run's view reads through it.
 * @param {string|symbol} prop - The member.
 * @param {"set"|"define"|"delete"|"prototype"|"close"} op - The change (a member's, or the node's own: its prototype, or
 *   closing it, with a null `prop`).
 * @param {*} payload - The value, descriptor or prototype.
 * @param {function(object): boolean} sink - Where the run keeps it.
 * @returns {boolean} Whether it was kept.
 * @internal
 */
function runWriteSinceClosed(node, prop, op, payload, sink) {
	const wrapper = nodeWrapperOf(node);
	if (wrapper === null) return false;
	assertOwnedWrite(wrapper, prop);
	if (op === "set") return sink({ op, value: wrapper.___wrapOnSet(prop, payload) });
	if (op === "define") return sink({ op, descriptor: payload });
	if (op === "prototype") return sink({ op, prototype: payload });
	if (op === "close") return sink({ op });
	return sink({ op: "delete" });
}

/**
 * The `run()` / `scope()` record of the code running now for an instance (see `RUN_COPY` in `helpers/flow-stores`), or
 * null outside any run.
 * @param {object} slothlet - The instance.
 * @returns {object|null} The record.
 * @private
 */
function runningRecord(slothlet) {
	const contextManager = slothlet?.contextManager;
	let record = contextManager?.tryGetContext?.(slothlet.instanceID)?.[RUN_COPY];
	if (record === undefined || record === null) {
		const active = contextManager?.tryGetContext?.();
		record = active?.slothlet === slothlet ? (active[RUN_COPY] ?? null) : null;
	}
	return record === null || record.torn ? null : record;
}

/**
 * Save a value the instance hands out as itself (a `Map`, a `Date`, an object a leaf returned) and what it reaches,
 * once per window while a run is open: the code it is handed to may change it where slothlet does not see the change
 * (host code calling through `api` inside a run included), and the runs open read it as it was (see `checkpointDeep`
 * in `helpers/run-snapshot`). Shared live objects are left alone.
 * @param {object} slothlet - The instance.
 * @param {*} value - The value handed out.
 * @returns {void}
 * @private
 */
function checkpointHandout(slothlet, value) {
	if (value === null || typeof value !== "object" || RUN_VIEW_ACCESS !== 0) return;
	const domain = domainOf(slothlet);
	if (!runsOpen(domain) || savedThisWindow(domain, value) || util.types.isProxy(value)) return;
	checkpointBuiltin(domain, value);
}

/**
 * How deep in reads and calls a run's `self` makes through a node the code running is (see
 * {@link throughRunView}): what such a read or call hands back reaches the run as its own copy or view, never
 * as itself, so it is not saved for the other runs.
 * @type {number}
 * @private
 */
let RUN_VIEW_ACCESS = 0;

/**
 * Make a read or call a run's `self` makes through a node (see {@link RUN_VIEW_ACCESS}).
 * @template T
 * @param {function(): T} access - The read or call.
 * @returns {T} What it returns.
 * @internal
 */
function throughRunView(access) {
	RUN_VIEW_ACCESS++;
	try {
		return access();
	} finally {
		RUN_VIEW_ACCESS--;
	}
}

/**
 * Save `value` and what it reaches for the runs open, once per window (see `checkpointDeep` in `helpers/run-snapshot`):
 * the value itself even when a node fronts it, and below it only what no node fronts and no Proxy answers for (a node
 * is saved by its own barrier, and reading a Proxy would run its code).
 * @param {object|null} domain - The instance's domain.
 * @param {object} value - The value.
 * @returns {void}
 * @private
 */
function checkpointBuiltin(domain, value) {
	checkpointDeep(domain, value, new Set(), (held) => held !== value && (util.types.isProxy(held) || resolveWrapper(held) !== null));
}

/**
 * The promises {@link checkpointSettled} handed out, by the promise a call returned.
 * @type {WeakMap<Promise<*>, Promise<*>>}
 * @private
 */
const SETTLED_CHECKPOINTS = new WeakMap();

/**
 * Save the built-ins a node holds for the runs open (see {@link checkpointBuiltin}): the one it fronts, the
 * ones it keeps as values of its own (a `Map` a file exports is kept on the file's node as it is), and the ones its
 * value holds. Read by descriptors only.
 * @param {object|null} domain - The instance's domain.
 * @param {UnifiedWrapper} node - The node's wrapper.
 * @returns {void}
 * @private
 */
function checkpointNodeBuiltins(domain, node) {
	const keys = Reflect.ownKeys(node);
	for (let index = 0; index < keys.length; index++) {
		if (isFrameworkReservedKey(keys[index])) continue;
		const described = Reflect.getOwnPropertyDescriptor(node, keys[index]);
		if (described !== undefined && "value" in described && builtinKind(described.value) !== null)
			checkpointBuiltin(domain, described.value);
	}
	const impl = node.____slothletInternal.impl;
	if (impl === null || typeof impl !== "object" || util.types.isProxy(impl)) return;
	// A node over a built-in (a `Map` a file exports) holds its entries in the built-in itself.
	if (builtinKind(impl) !== null) checkpointBuiltin(domain, impl);
	const names = Objects.keys(impl);
	for (let index = 0; index < names.length; index++) {
		const described = Reflect.getOwnPropertyDescriptor(impl, names[index]);
		if (described !== undefined && "value" in described && builtinKind(described.value) !== null)
			checkpointBuiltin(domain, described.value);
	}
}

/**
 * Save a node as it is before the instance changes it, for the runs that started since it last changed (see
 * `beforeChange` in `helpers/run-snapshot`): called by every trap that changes a node. A change a run's `self` is making
 * (kept in the run), a build, the framework's own bookkeeping, a node of a run's own tree, and a lazy node not loaded
 * yet are left alone.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {void}
 * @private
 */
function snapshotBarrier(wrapper) {
	const slothlet = wrapper.slothlet;
	const domain = domainOf(slothlet);
	if (!runsOpen(domain)) return;
	if (runShared.RUN_WRITE !== null && runShared.RUN_WRITE.node === wrapper) return;
	if (slothlet.____buildDepth > 0 || MapMethods.has(FRAMEWORK_WRITES, wrapper) || inRunTree(wrapper)) return;
	const internal = wrapper.____slothletInternal;
	if (internal.mode === "lazy" && !internal.state.materialized) return;
	// Once per window: later changes in the same window find the node saved already.
	if (!beforeChange(domain, wrapper, captureNode)) return;
	// A node over a built-in (a `Map`) holds its entries in the built-in, which a method running on it changes as itself.
	const impl = internal.impl;
	if (impl !== null && typeof impl === "object" && !util.types.isProxy(impl) && builtinKind(impl) !== null) checkpointBuiltin(domain, impl);
}

/**
 * Record the prototype a node has, as soon as what the node is, is known: its function's own for a function node, and
 * `Object.prototype` for any other value, as an object slothlet composed has in plain JavaScript. It is kept on the
 * node's own record and replaced with the node's value, so a reload or an add that gives the node a new value gives it
 * that value's prototype. `Object.setPrototypeOf` on the node changes it (see {@link ownsPrototype}).
 * @param {object} wrapper - The node's wrapper.
 * @returns {void}
 * @private
 */
function fillPrototype(wrapper) {
	const internal = wrapper.____slothletInternal;
	const impl = internal.impl;
	internal.prototypeOf = impl;
	internal.prototypeGiven = false;
	if (typeof impl !== "function") internal.prototype = impl !== null && typeof impl === "object" ? Objects.prototype : null;
	// A module's own Proxy answers for itself, through its traps, whenever it is asked.
	else internal.prototype = util.types.isProxy(impl) && !isCompositionLayer(impl) ? null : Reflect.getPrototypeOf(impl);
}

/**
 * Whether a node belongs to a tree a run built of its own (see `Slothlet#ownTree`), which is built from the very module
 * values the instance's tree uses: a change the node would make to one of those values is the node's own instead.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {boolean} True for a node of a run's tree.
 * @private
 */
function inRunTree(wrapper) {
	return (wrapper.____slothletInternal.epoch ?? 0) < 0;
}

/**
 * The arrays a node of a run's tree holds as its own copy of the module's (see {@link ownRunTreeArray}).
 * @type {WeakSet<Array<*>>}
 * @private
 */
const RUN_TREE_ARRAYS = new WeakSet();

/**
 * Before a node of a run's tree changes the array it fronts, give it a copy of its own: the array is the module's,
 * which the instance's tree fronts too, so what the run changes lands in the copy and is gone with the run.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {void}
 * @private
 */
function ownRunTreeArray(wrapper) {
	const internal = wrapper.____slothletInternal;
	const array = internal.impl;
	if (!Arrays.isArray(array) || isCompositionLayer(array) || util.types.isProxy(array) || WeakSetMethods.has(RUN_TREE_ARRAYS, array))
		return;
	// A closed array takes no change, and the node refuses it as the array would.
	if (!Reflect.isExtensible(array)) return;
	const copy = [];
	for (let index = 0, keys = Reflect.ownKeys(array); index < keys.length; index++) {
		if (keys[index] !== "length") Reflect.defineProperty(copy, keys[index], Reflect.getOwnPropertyDescriptor(array, keys[index]));
	}
	copy.length = array.length;
	if (Reflect.getPrototypeOf(copy) !== Reflect.getPrototypeOf(array)) Reflect.setPrototypeOf(copy, Reflect.getPrototypeOf(array));
	WeakSetMethods.add(RUN_TREE_ARRAYS, copy);
	internal.impl = copy;
}

/**
 * Record that a node of a run's tree holds a member on its wrapper (see {@link runTreeHolds}).
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {string|symbol} prop - The member.
 * @returns {void}
 * @private
 */
function markRunTreeHeld(wrapper, prop) {
	SetMethods.add((wrapper.____slothletInternal.runHeldKeys ??= new Set()), prop);
	const hidden = wrapper.____slothletInternal.runHiddenKeys;
	if (hidden !== undefined) SetMethods.delete(hidden, prop);
}

/**
 * Whether a node of a run's tree removed, in the run, a member the live value it fronts holds: the value keeps it, and
 * the node answers as the value would without it.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {string|symbol} prop - The member.
 * @returns {boolean} True when the member is gone from the node.
 * @private
 */
function runTreeHides(wrapper, prop) {
	const hidden = wrapper.____slothletInternal.runHiddenKeys;
	return hidden !== undefined && SetMethods.has(hidden, prop) && !hasOwn(wrapper, prop);
}

/**
 * Run a module's code as the module that made it (#597): the wrapper is who runs, with no ceiling from whoever runs
 * it, as a call to the module's function through `self` runs. The run is checked for code it did not make: code of
 * another module running inside it is that module's, under this one as its ceiling, and code that cannot be placed
 * is its caller's, under this one (see resolveSupplier).
 * @param {object} owner - The wrapper the code runs as.
 * @param {Function} fn - The code.
 * @param {*} [thisArg] - Its receiver.
 * @param {Array<*>} [args=[]] - Its arguments.
 * @param {boolean} [attribute=true] - Hand what it returns back as the module's too (see {@link attributeResult}).
 * @param {boolean} [asNode=false] - Run its code as a call of its node, under no ceiling of its caller (#726).
 * @param {object|null} [origin=null] - For a stand-in, the call it was handed to alone (see {@link originOf}).
 * @returns {*} What it returned.
 * @private
 */
function runAsMaker(owner, fn, thisArg = undefined, args = [], attribute = true, asNode = false, origin = null) {
	try {
		return runAsMakerRaw(owner, fn, thisArg, args, attribute, asNode, origin);
	} catch (error) {
		// What the module's code threw is the module's: it is read as the module, wherever it is reported (#599).
		rememberMadeFailure(owner, error);
		throw error;
	}
}

/**
 * Keep a record of a failure of a module's code that reads it as that module (see failureRecord), unless one is kept
 * already: the innermost code it was thrown from stands.
 * @param {object} owner - The wrapper the code ran as.
 * @param {*} error - What it threw or rejected with.
 * @returns {object} The failure's record.
 * @private
 */
function rememberMadeFailure(owner, error) {
	return (
		rememberedFailure(error) ??
		rememberFailure(
			error,
			// Each reader's answer comes back boxed: handed back bare, an error would be examined (and wrapped) as a value
			// the module's code returned.
			failureRecord(error, (read, value) => runAsMakerRaw(owner, (target) => ({ value: read(target) }), undefined, [value], false).value)
		)
	);
}

/**
 * {@link runAsMaker} without recording what the code throws: the readers a failure's record runs go through
 * here, so a reader that throws is not itself recorded.
 * @param {object} owner - The wrapper the code runs as.
 * @param {Function} fn - The code.
 * @param {*} [thisArg] - Its receiver.
 * @param {Array<*>} [args=[]] - Its arguments.
 * @param {boolean} [attribute=true] - Hand what it returns back as the module's too.
 * @param {boolean} [asNode=false] - Run its code as a call of its node, under no ceiling of its caller (#726).
 * @param {object|null} [origin=null] - For a stand-in, the call it was handed to alone (see {@link originOf}).
 * @returns {*} What it returned.
 * @private
 */
function runAsMakerRaw(owner, fn, thisArg = undefined, args = [], attribute = true, asNode = false, origin = null) {
	const contextManager = owner.slothlet?.contextManager;
	if (!contextManager?.runInContext || !owner.slothlet.instanceID) return Reflect.apply(fn, thisArg, args);
	// An instance that is gone (shut down) has no context to run its code in: the code runs outside every instance, as
	// plain code no instance's api is reachable from — never as whoever happens to be reading.
	const instanceID = makerInstanceID(owner.slothlet);
	if (instanceID === null) return contextManager.runDetached(fn, thisArg, args);
	// The code's own reads are its own: a reader snapshot being completed for is not passed on into it. A stand-in of a
	// value handed out records its definer and grants nothing: the caller running it, read now, is its ceiling, so every
	// access has to be allowed for both (#726). A node's own code (an accessor or a Proxy export of an api object, `new`
	// on an exported class) is checked as a call of its node, and runs as that call does, under no ceiling of its caller.
	const ceiling = asNode ? null : outerCallerCeiling(contextManager, instanceID, owner.slothlet, origin);
	return readOnBehalf(undefined, () =>
		contextManager.runInContext(instanceID, fn, thisArg, args, owner, true, false, ceiling, null, attribute, true)
	);
}

/**
 * The leaf of a module whose code is running right now, when it is that module's: what that code writes into a value
 * it was handed is handed out as that leaf's (see {@link inboundView}). Otherwise the given wrapper.
 * @param {object} maker - The module's record.
 * @param {object} fallback - The wrapper to use otherwise.
 * @returns {object} The wrapper.
 * @private
 */
function runningLeafOf(maker, fallback) {
	const slothlet = fallback?.slothlet;
	const current = slothlet?.contextManager?.tryGetContext?.(slothlet.instanceID)?.currentWrapper ?? null;
	return current && WeakSetMethods.has(trustedRootOwn.genuineWrappers, current) && makerOf(current) === maker ? current : fallback;
}

/**
 * Guards a promoted return value so unawaited consumption fails loudly (#253).
 *
 * @param {Promise<*>} promise - The promoted pipeline's result.
 * @param {string} path - The api path, named in the thrown error.
 * @param {Function} SlothletErrorCtor - The instance's SlothletError constructor.
 * @returns {Promise<*>} A proxy over the promise: `then`/`catch`/`finally` (and everything else)
 *   behave normally, but the value-coercion channels throw a named error.
 * @internal
 *
 * @description
 * A synchronous target promoted by an attached async hook returns a Promise where a value was
 * contracted. The caller's code was correct when written and broke because ANOTHER module attached
 * a hook — silently yielding NaN under arithmetic surfaces that far from the cause. The coercion
 * channels (`Symbol.toPrimitive`, `valueOf`, `toString`, `toJSON`) therefore throw an error naming
 * the path; `await` and explicit promise chaining are untouched. Promotion is transient — the same
 * path returns a plain value again once the async hook is removed — so the guard exists only on
 * promoted calls, never on genuinely-async targets whose callers already expect a Promise.
 */
function guardPromotedResult(promise, path, SlothletErrorCtor) {
	const refuse = () => {
		throw new SlothletErrorCtor("HOOK_PROMOTED_RESULT_NOT_AWAITED", { path });
	};
	const guarded = new NativeProxy(promise, {
		get(target, prop, receiver) {
			if (prop === Symbol.toPrimitive || prop === "valueOf" || prop === "toString" || prop === "toJSON") {
				return refuse;
			}
			const value = Reflect.get(target, prop, receiver);
			// Promise methods must run against the real promise (native brand checks reject
			// proxies) — and ONLY those are rebound. Binding every function-valued property is
			// observable: `constructor` would read back as a bound function instead of Promise.
			if (prop === "then" || prop === "catch" || prop === "finally") return FunctionMethods.bind(value, target);
			return value;
		}
	});
	return guarded;
}

/**
 * Extract the original error from a SlothletError wrapper if present.
 * Hooks should receive the actual error that occurred, not the wrapped SlothletError.
 * @param {Error} error - Error to unwrap
 * @returns {Error} Original error if wrapped, otherwise the error itself
 * @private
 */
function unwrapError(error) {
	// A failure with a record (see readTargetFailure) is unwrapped through it, as the code it belongs to: its
	// accessors are that code's, and this runs in the caller's flow.
	const read = rememberedFailure(error);
	if (read) return read.originalError();
	return unwrapThrown(error);
}

/** The key `util.inspect` reads a custom hook from (the platform shim gives the same one in a browser). */
const INSPECT_KEY = Symbols.for("nodejs.util.inspect.custom");

/**
 * Separates the segments of an api path in the keys a run's `self` keeps its writes under (a segment may hold a dot).
 * @type {string}
 * @private
 */
const RUN_PATH_SEPARATOR = "\u0001";

/**
 * The framework's own members of `self`, which a run's `self` hands out as the run's views of them (see `frameworkViewAt`
 * in {@link makeRunSelf}).
 * @type {Set<string>}
 * @private
 */
const RUN_FRAMEWORK_ROOTS = setFrom(["slothlet", "shutdown", "destroy"]);

/**
 * The fields of a property descriptor, in the order a definition through a run's view of the framework's namespace
 * applies them.
 * @type {string[]}
 * @private
 */
const RUN_DESCRIPTOR_FIELDS = ["value", "writable", "get", "set", "enumerable", "configurable"];

/**
 * The record of the run whose view of a node is passing a change on to the view it reads through (an outer run's view),
 * while it does: the change is kept by the inner run (see {@link makeRunSelf}).
 * @type {function(object): boolean|null}
 * @private
 */
let delegatedRunSink = null;

/**
 * The run whose view is being read by a run opened in it, and the nested run's start on it, while it is (see
 * `readThroughOuter` in {@link makeRunSelf}).
 * @type {{run: object, start: number}|null}
 * @private
 */
let outerReadAt = null;

/**
 * What each view a run's `self` hands out reads through: a function read through a view and called with the view as
 * its receiver runs on that node, as it would on the node itself.
 * @type {WeakMap<object, *>}
 * @private
 */
const RUN_VIEW_REALS = new WeakMap();

/**
 * The prototype every array inherits its methods from, as it was when slothlet loaded.
 * @type {object}
 * @private
 */
const ARRAY_PROTOTYPE = Reflect.getPrototypeOf([]);

/**
 * Whether a key is an array index (`"0"`, `"12"`).
 * @param {string|symbol} prop - The key.
 * @returns {boolean} True for an index.
 * @private
 */
function isArrayIndexKey(prop) {
	if (typeof prop !== "string" || RegExpMethods.exec(/^(?:0|[1-9]\d*)$/, prop) === null) return false;
	// Keys from 2^32 - 1 up are ordinary members.
	return prop.length < 10 || (prop.length === 10 && prop < "4294967295");
}

/**
 * The run behind each view a run's `self` hands out.
 * @type {WeakMap<object, object>}
 * @private
 */
const RUN_OF_VIEW = new WeakMap();

/**
 * Functions read through a run's views, as handed out (see {@link runViewFunction}).
 * @type {WeakMap<Function, Function>}
 * @private
 */
const RUN_VIEW_FUNCTIONS = new WeakMap();

/**
 * How each view a run's `self` hands out of a node makes a change to the node itself (its prototype, its
 * extensibility): an inner run's view reading through it hands it the change, kept by the inner run (see
 * {@link makeRunSelf}).
 * @type {WeakMap<object, function("prototype"|"close", (object|null|undefined), function(object): boolean): boolean>}
 * @private
 */
const RUN_VIEW_NODE_CHANGES = new WeakMap();

/**
 * The receiver a function a run's view handed out runs with when it is called on the run's view of a node fronting an
 * instance of a class that declares `#private` fields: the instance itself, where its private fields are, once the
 * node's file is saved for the runs open (see {@link checkpointFile}), as before a call through the node. Null
 * for any other node.
 * @param {*} node - The node the view reads through.
 * @returns {object|null} The instance.
 * @internal
 */
function privateCallReceiver(node) {
	const wrapper = nodeWrapperOf(node);
	const impl = wrapper?.____slothletInternal?.impl;
	if (impl === null || impl === undefined || typeof impl !== "object") return null;
	const instance = layerUnderlying(impl);
	// A Proxy is asked nothing: reading its prototype would run its traps.
	if (instance === null || typeof instance !== "object" || util.types.isProxy(instance) || !declaresPrivate(instance)) return null;
	wrapper.___checkpointFile();
	return instance;
}

/**
 * The receiver a method read through a run's view runs with: the view itself, so what it reads and writes is the
 * run's, except for an instance of a class that declares `#private` fields, whose methods run on the instance itself
 * (the object the node the view reads through fronts), where the private fields are: whichever version of the method
 * the run reads, the one it held at the start included. Its public members still read as of the run's start through
 * the view; what such a method changes through `this` is the instance's.
 * @param {*} thisArg - The receiver the method was called with.
 * @returns {*} The receiver it runs with.
 * @private
 */
function runViewReceiver(thisArg) {
	if (thisArg === null || (typeof thisArg !== "object" && typeof thisArg !== "function")) return thisArg;
	if (!WeakMapMethods.has(RUN_VIEW_REALS, thisArg)) return thisArg;
	return privateCallReceiver(WeakMapMethods.get(RUN_VIEW_REALS, thisArg)) ?? thisArg;
}

/**
 * The target of a view a full-isolation run's `self` hands out (#803), holding the hook Node's `util.inspect` reads:
 * Node shows a Proxy's target rather than what its traps report, so the hook hands it what the view reads through, which
 * shows what the reading code may read, as `self` shows outside the run. What the run wrote is not shown.
 * @param {object|Function} shell - The empty target.
 * @param {object} parentSelf - What the view reads through.
 * @returns {object|Function} The target.
 * @private
 */
function runViewShell(shell, parentSelf) {
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
 * Load the node a stand-in stands for (see {@link isLazyStandIn}), without reading the member it stands for: a run's view
 * over a stand-in reads that member through its own views once the node has loaded, so a getter on the path runs once
 * (see `makeRunSelf` in `handlers/unified-wrapper/run`). A change queued through a stand-in that the node refused fails it, as
 * awaiting the stand-in does.
 * @param {object} standIn - The stand-in.
 * @returns {Promise<void>} Settles once the node has loaded.
 * @internal
 */
async function loadStandIn(standIn) {
	const wrapper = resolveWrapper(standIn);
	if (wrapper === null) return;
	if (!wrapper.____slothletInternal.state.materialized) await wrapper.___materialize();
	const refused = takeRefusedChange(wrapper, WeakMapMethods.get(WAITING_CHAINS, standIn) ?? []);
	if (refused) throw refused;
}

/**
 * Record a stand-in for one of the framework's root members (a view of the
 * `slothlet` namespace) as that member, so module code reading it through the scope's `self` is handed the same
 * view of it as outside the scope ({@link selfFrameworkView}). Anything else is left unrecorded.
 *
 * @param {object} copy - The stand-in.
 * @param {*} member - The value it stands in for.
 * @returns {object} `copy`.
 * @internal
 *
 * @example
 * registerFrameworkMemberCopy(viewOf(api.slothlet), api.slothlet);
 */
function registerFrameworkMemberCopy(copy, member) {
	const slothlet = WeakMapMethods.get(FRAMEWORK_MEMBERS, member);
	if (slothlet) registerFrameworkMember(copy, slothlet, WeakMapMethods.get(FRAMEWORK_MEMBER_NAMES, member));
	return copy;
}

/**
 * Whether a value read through a node now is the member a node's saved version holds: the same child node (or a view of
 * it), the node fronting the same object, or the same value.
 * @param {*} live - What the node hands out now.
 * @param {*} held - What the version holds.
 * @returns {boolean} True when they are one.
 * @internal
 */
function sameSnapshotMember(live, held) {
	if (live === held) return true;
	if (live === null || (typeof live !== "object" && typeof live !== "function")) return false;
	if (held === null || (typeof held !== "object" && typeof held !== "function")) return false;
	const liveWrapper = nodeWrapperOf(live);
	if (liveWrapper === null) return false;
	const heldWrapper = nodeWrapperOf(held);
	if (heldWrapper !== null) return heldWrapper === liveWrapper;
	const internal = liveWrapper.____slothletInternal;
	return internal.impl === held || internal.sourceValue === held || internal.moduleObject === held;
}

/**
 * The content a node had when a run started, when the instance has changed it since (see {@link captureNode}),
 * or null when the node is as it was.
 * @param {*} node - The node, as the run's view reads through it.
 * @param {object|null|undefined} snap - The run's snapshot (see `helpers/run-snapshot`).
 * @returns {{members: Map<PropertyKey, (object|symbol)>}|null} The content.
 * @internal
 */
function nodeVersion(node, snap) {
	if (snap === null || snap === undefined || snap.closed) return null;
	const wrapper = nodeWrapperOf(node);
	if (wrapper === null) return null;
	const held = versionAt(snap.instance, wrapper, snap.base);
	return held === CURRENT ? null : held;
}

/**
 * The prototype of a class a function node fronts (its function's own `prototype`), as the module holds it, or null.
 * @param {*} node - The node.
 * @returns {object|null} The prototype.
 * @internal
 */
function classPrototypeOf(node) {
	const wrapper = nodeWrapperOf(node);
	return wrapper === null ? null : wrapper.___wrapperClassPrototype();
}

/**
 * Whether a saved version of an object holds other than the object does now: other members, other attributes, or
 * another prototype. Read by descriptors only.
 * @param {object} content - The version (or the object itself).
 * @param {object} raw - The object.
 * @returns {boolean} True when it does.
 * @private
 */
function contentChanged(content, raw) {
	if (content === raw) return false;
	if (Reflect.getPrototypeOf(content) !== Reflect.getPrototypeOf(raw)) return true;
	const keys = Reflect.ownKeys(raw);
	if (Reflect.ownKeys(content).length !== keys.length) return true;
	for (let index = 0; index < keys.length; index++) {
		const now = Reflect.getOwnPropertyDescriptor(raw, keys[index]);
		const then = Reflect.getOwnPropertyDescriptor(content, keys[index]);
		if (then === undefined || !sameLookup({ from: content, described: then }, { from: raw, described: now })) return true;
	}
	return false;
}

/**
 * The prototype a run reads a node as inheriting from, when that differs from what the node reports now: the one it
 * held when the run started, when the instance set another on it since, or the run's view of it, when the instance
 * changed that prototype of a module's own since (see {@link inheritedAtStart}). Undefined when the run reads
 * the node's prototype as the node reports it.
 * @param {*} node - The node, as the run's view reads through it.
 * @param {{prototype?: (object|null|symbol)}|null} version - The node's saved version, if any.
 * @param {object} snap - The run's snapshot.
 * @returns {{prototype: (object|null)}|undefined} The prototype.
 * @internal
 */
function prototypeAtStart(node, version, snap) {
	const wrapper = nodeWrapperOf(node);
	if (wrapper === null || snap === null || snap === undefined || snap.closed) return undefined;
	const held = wrapper.___startPrototypes(version);
	if (held === undefined) return undefined;
	const { start, now } = held;
	if (start === null || isLanguagePrototype(start) || resolveWrapper(start) !== null)
		return start === now ? undefined : { prototype: start };
	if (start === now && !contentChanged(rawContent(snap, start), start)) return undefined;
	return { prototype: handOutRaw(snap, start) };
}

/**
 * Whether `node.__proto__ = x` on a node runs the language's own `__proto__` setter, as the set trap does for a node
 * fronting a module's own object that holds no `__proto__` member (#757); any other node takes it as a member write.
 * @param {*} node - The node, as a run's view reads through it.
 * @returns {boolean} True when the assignment sets the prototype.
 * @internal
 */
function protoAssignSetsPrototype(node) {
	const wrapper = nodeWrapperOf(node);
	return wrapper !== null && !hasOwn(wrapper, "__proto__") && moduleObjectOf(wrapper) !== null;
}

/**
 * Whether a node fronts a live object a run shares with the instance (an `EventEmitter`, an `EventTarget`): a run is
 * handed the node itself, so its listeners and what it emits or sets work both ways (see `isSharedLive` in
 * `helpers/run-snapshot`).
 * @param {*} value - The node, as read.
 * @returns {boolean} True for one.
 * @private
 */
function frontsSharedLive(value) {
	if (typeof value !== "object" || value === null) return false;
	const impl = nodeWrapperOf(value)?.____slothletInternal?.impl;
	return impl !== null && typeof impl === "object" && !util.types.isProxy(impl) && isSharedLive(impl);
}

/**
 * A function read through a run's view, as handed out: called with one of the run's views as its receiver, it runs on
 * the node the view reads through, as it would when read off that node.
 * @param {Function} fn - The function.
 * @returns {Function} The function as handed out.
 * @private
 */
function runViewFunction(fn) {
	let handed = WeakMapMethods.get(RUN_VIEW_FUNCTIONS, fn);
	if (handed === undefined) {
		// Called with one of the run's views as its receiver, it runs on that view: what it reads is what the run reads,
		// and what it writes stays in the run, as a method called on a copy of an object works on the copy.
		handed = new NativeProxy(fn, {
			__proto__: null,
			apply: (target, thisArg, args) => Reflect.apply(target, runViewReceiver(thisArg), args)
		});
		WeakMapMethods.set(RUN_VIEW_FUNCTIONS, fn, handed);
	}
	return handed;
}

/**
 * Build a full-isolation run's `self` (`run()` / `scope()` with `isolation: "full"`): the run's own api, as the run sees
 * it, before and after the run has a tree of its own.
 *
 * @description
 * Phase 4 gives a run a tree of its own on its first change to the tree (`api.slothlet.api.add()` and the like). Until
 * then the run reads the tree it started on, which it shares, and a write through `self` must not reach that tree. This
 * `self` reads and writes through the ordinary path, with one difference:
 *
 * - **Reads** go to the node the reader is handed, every time, through the reader's own view of it and its read gate.
 *   Nothing is kept from one read to the next, so no reader is answered from another reader's read. What the run wrote
 *   at a member is read in place of the member, after the read rules for the member it stands in for have passed.
 *   Every node read is handed out as a view of this `self`, a lazy node's function included, so a write made below it is
 *   the run's too. Data, built-in objects (a `Map`, a `Buffer`, a `Date`) and other values are handed out as read.
 * - **Writes**, definitions and deletions are made through the node they reach, whose own checks (key validation,
 *   ownership, permission write rules, the writer as the runtime attributes it) decide them as they do any write. A
 *   change the node lets through is kept in the run's record (see `runWrite` in `handlers/unified-wrapper`)
 *   instead of being made on the node.
 * - Once the run has a tree of its own, what it kept is written into that tree (see {@link Slothlet#ownTree} and
 *   `ApiManager#carryRunWrites`), and from then on this `self` reads and writes the run's tree as the instance's `self`
 *   does: `api` and `self` agree in the run.
 *
 * A change to a node itself — its prototype (`Object.setPrototypeOf`), its extensibility (`Object.preventExtensions`,
 * `seal`, `freeze`) — is a write at the node's path, checked by the node as an assignment is, and kept by the run: a
 * prototype it sets is the one the view reports and inherits through, and closing a view closes the run's view of the
 * node: its members as the run reads them then are fixed on it. The node itself keeps its prototype and stays open, and
 * a run that later gets a tree of its own does not change that tree's node either.
 *
 * A class's `prototype` read through a node is handed out as the run's view of it, as the framework's namespace is: a
 * change made to it, or below it, is checked as a write at its path and kept by the run. An instance the run constructs
 * through the class inherits through that view, so it sees what the run wrote, and `instanceof` holds for it.
 *
 * @param {object} slothlet - The instance.
 * @param {object} parentSelf - The `self` the run starts from: the instance's bound api, or an outer run's `self`.
 * @param {object|null} record - The run's copy record (see `copyForRun` in `helpers/flow-stores`), or null.
 * @returns {object|Function} The run's `self`.
 * @private
 */
function makeRunSelf(slothlet, parentSelf, record) {
	// The run's snapshot (see helpers/run-snapshot): what it reads of the instance is the instance as of its start.
	const snap = record?.snap ?? null;
	const run = {
		// parent path key → (member → the change the run made there)
		entries: new Map(),
		// the changes, in the order made
		log: [],
		// path key → names below it that the run's changes reach (namespaces only the run wrote)
		below: new Map(),
		// path key → (what a view reads through → the view)
		views: new Map(),
		// path key → the view of a namespace only the run wrote
		synthetic: new Map(),
		// nodes the run wrote: a change below one is the run's own
		local: new WeakSet(),
		// the run's changes to the framework's namespace, in the order made (see frameworkViewAt)
		nsLog: [],
		// namespace path key → (member → the change the run made there)
		nsEntries: new Map(),
		// namespace path key → (what a view reads through → the view)
		nsViews: new Map(),
		// path key → the prototype the run gave the node there
		protos: new Map(),
		// path key → the run's own copy of the array the node there holds, once the run changed it
		arrays: new Map(),
		// array copy → the tick of the run's clock it was made at (see `outerHeld`)
		arraysMade: new WeakMap(),
		forked: false,
		parent: WeakMapMethods.get(RUN_OF_VIEW, parentSelf) ?? null
	};
	/**
	 * Read through an outer run's view as of this run's start on it: what the outer run writes after this one opened
	 * does not reach this one.
	 * @template T
	 * @param {function(): T} read - The read.
	 * @returns {T} What it read.
	 */
	const readThroughOuter = (read) => {
		if (run.parent === null || snap === null || snap.parent === null) return read();
		const previous = outerReadAt;
		outerReadAt = { run: run.parent, start: snap.start };
		try {
			return read();
		} finally {
			outerReadAt = previous;
		}
	};
	/**
	 * What this run holds of its own (a member map, an array copy, the prototypes it gave), as the read being made reads
	 * it: a run opened in this one reads it as of its own start (see readThroughOuter).
	 * @template T
	 * @param {T|undefined} held - What the run holds now.
	 * @param {boolean} [copy=false] - Whether it is a copy the run made, which a run opened before it was made does not read.
	 * @returns {T|undefined} What the read reads.
	 */
	const outerHeld = (held, copy = false) => {
		if (held === undefined || outerReadAt === null || outerReadAt.run !== run || snap === null) return held;
		if (copy && (WeakMapMethods.get(run.arraysMade, held) ?? 0) >= outerReadAt.start) return undefined;
		const version = versionAt(snap, held, outerReadAt.start);
		return version === CURRENT ? held : version;
	};
	const keyOf = (parts) => ArrayMethods.join(parts, RUN_PATH_SEPARATOR);
	/**
	 * Keep a change the run made.
	 * @param {string[]} parts - The path of the node changed.
	 * @param {string|symbol} prop - The member.
	 * @param {object} change - The change as the node's trap handed it.
	 * @returns {boolean} True.
	 */
	const keep = (parts, prop, change) => {
		if (change.parts) {
			parts = copyList(change.parts, 0, change.parts.length - 1);
			prop = change.parts[change.parts.length - 1];
		}
		const key = keyOf(parts);
		let members = MapMethods.get(run.entries, key);
		if (members === undefined) {
			members = new Map();
			MapMethods.set(run.entries, key, members);
		}
		const entry = { __proto__: null, ...change, parts, prop };
		// A run opened in this one reads what this one had written when it opened: what it held here is kept first.
		if (snap !== null) beforeChange(snap, members, shallowCopy);
		MapMethods.set(members, prop, entry);
		listPush(run.log, entry);
		for (let index = 0; index < parts.length; index++) {
			const above = keyOf(copyList(parts, 0, index));
			let names = MapMethods.get(run.below, above);
			if (names === undefined) {
				names = new Set();
				MapMethods.set(run.below, above, names);
			}
			SetMethods.add(names, parts[index]);
		}
		const value = change.op === "define" ? change.descriptor.value : change.value;
		if (value !== null && (typeof value === "object" || typeof value === "function")) WeakSetMethods.add(run.local, value);
		return true;
	};
	/**
	 * The store of the code running now, for the writers a write through the root is made as.
	 * @returns {object|null} The store.
	 */
	const runningStore = () =>
		slothlet.contextManager?.tryGetContext?.(slothlet.instanceID) ?? slothlet.contextManager?.tryGetContext?.() ?? null;

	/**
	 * The view of the node at `parts` that reads through `real`.
	 * @param {string[]} parts - The node's path.
	 * @param {*} real - What the view reads through: the reader's node, an outer run's view, or undefined for a
	 *   namespace only the run wrote.
	 * @param {boolean} local - Whether the node is one the run wrote (or lies below one).
	 * @returns {object|Function} The view.
	 */
	const viewAt = (parts, real, local) => {
		const key = keyOf(parts);
		if (real === undefined) {
			const made = MapMethods.get(run.synthetic, key);
			if (made !== undefined) return made;
		} else {
			const byReal = MapMethods.get(run.views, key);
			const made = byReal === undefined ? undefined : WeakMapMethods.get(byReal, real);
			if (made !== undefined) return made;
		}
		const view = makeView(parts, real, local);
		if (real === undefined) MapMethods.set(run.synthetic, key, view);
		else {
			let byReal = MapMethods.get(run.views, key);
			if (byReal === undefined) {
				byReal = new WeakMap();
				MapMethods.set(run.views, key, byReal);
			}
			WeakMapMethods.set(byReal, real, view);
		}
		return view;
	};

	/**
	 * Make a view (see {@link viewAt}).
	 * @param {string[]} parts - The node's path.
	 * @param {*} real - What it reads through.
	 * @param {boolean} local - Whether the node is the run's own.
	 * @returns {object|Function} The view.
	 */
	const makeView = (parts, real, local) => {
		const key = keyOf(parts);
		const atRoot = parts.length === 0 && real === parentSelf;
		const atInstanceRoot = atRoot && !WeakMapMethods.has(RUN_OF_VIEW, parentSelf);
		const callable = typeof real === "function";
		// A view of an array is an array, as the node it reads through is: its target is one.
		const arrayView = !callable && Arrays.isArray(real);
		const shell = runViewShell(callable ? FunctionMethods.bind(function () {}) : arrayView ? [] : {}, real ?? {});
		const own = (prop) => {
			// A run opened in this one reads what this one had written when it opened (see readThroughOuter).
			const members = outerHeld(MapMethods.get(run.entries, key));
			return members === undefined ? undefined : MapMethods.get(members, prop);
		};
		const below = (prop) => {
			const names = typeof prop === "string" ? MapMethods.get(run.below, key) : undefined;
			return names !== undefined && SetMethods.has(names, prop);
		};
		const closed = () => !Reflect.isExtensible(shell);
		// The run's own copy of the array, once the run changed it: every view of the node at this path reads it.
		const arrayCopy = () => (arrayView ? outerHeld(MapMethods.get(run.arrays, key), true) : undefined);
		// Whether the run's copy of the array answers for `prop`: its elements and `length`, and any member it holds.
		const copyAnswers = (copy, prop) => copy !== undefined && (Objects.hasOwn(copy, prop) || isArrayIndexKey(prop));
		/**
		 * The run's copy of the array, made from what the view reads now on the run's first change to it.
		 * @returns {Array<*>} The copy.
		 */
		const takeArrayCopy = () => {
			let copy = MapMethods.get(run.arrays, key);
			if (copy === undefined) {
				copy = [];
				// Copied from what the run reads: the array as of the run's start, when the instance changed it since.
				const version = snapshotOf();
				const heldAt = (name) => {
					const held = version === null ? undefined : MapMethods.get(version.members, name);
					return held === undefined || held.live ? undefined : held;
				};
				const length = heldAt("length")?.value ?? Reflect.get(real, "length");
				for (let index = 0; index < length; index++) {
					const name = String(index);
					const held = heldAt(name);
					if (held !== undefined) copy[index] = snapshotValue(held.value);
					else if (version === null && Reflect.getOwnPropertyDescriptor(real, name) !== undefined) copy[index] = Reflect.get(real, name);
				}
				copy.length = length;
				MapMethods.set(run.arrays, key, copy);
				if (snap !== null) WeakMapMethods.set(run.arraysMade, copy, snap.clock);
			}
			return copy;
		};
		// What the view reads through once the run has a tree of its own: a node read before still answers for the
		// run's tree (phase 4 forwards it there); a namespace only the run wrote is found in that tree by its path.
		const current = () => {
			if (real !== undefined) return real;
			let node = slothlet.boundApi;
			for (let index = 0; index < parts.length && node !== null && node !== undefined; index++) node = node[parts[index]];
			return node;
		};
		const forked = () => run.forked && delegatedRunSink === null;
		/**
		 * What awaiting the view over a stand-in settles with (see readMember): the stand-in's node loads, and the view's
		 * path is read again from the run's root.
		 * @param {function(*): *} [onFulfilled] - Called with the value.
		 * @param {function(*): *} [onRejected] - Called with the error.
		 * @returns {Promise<*>} The promise `then` makes.
		 */
		const standInThen = (onFulfilled, onRejected) => {
			// Only the node loads here: the member is read once, through the run's views, below.
			const loaded = loadStandIn(unwrapSelfView(real));
			const read = PromiseMethods.then(loaded, () => {
				let value = root;
				for (let index = 0; index < parts.length && value !== null && value !== undefined; index++) value = value[parts[index]];
				return value;
			});
			return PromiseMethods.then(read, onFulfilled, onRejected);
		};
		// The node's content as of the run's start, when the instance changed it since (see helpers/run-snapshot); null
		// while it is as it was, and for what the view does not read of the instance (a node the run wrote, the root, an
		// outer run's view, the run's own tree).
		const snapshotOf = () =>
			snap === null || local || real === undefined || real === null || atInstanceRoot || run.forked || WeakMapMethods.has(RUN_OF_VIEW, real)
				? null
				: nodeVersion(real, snap);
		// What a saved member is handed out as: a node as `self` hands it to the reader.
		const snapshotValue = (value) => (isApiNode(value) ? selfView(value) : value);
		// The instance's root as of the run's start, when the instance changed it since (a member replaced, added or
		// deleted): the members its api held then. Null while it is as it was, and for every view but the root's.
		const rootVersion = () => {
			if (snap === null || !atInstanceRoot || run.forked) return null;
			const api = slothlet.api;
			if (api === null || api === undefined || (typeof api !== "object" && typeof api !== "function")) return null;
			const held = versionAt(snap.instance, api, snap.base);
			return held === CURRENT ? null : held;
		};
		/**
		 * The prototype the root had when the run started, from its saved version, when the instance gave it another since.
		 * @param {object} atStart - The root's saved version (see rootVersion).
		 * @returns {object|null|undefined} The prototype, or undefined while the root has the same one.
		 */
		const rootStartPrototype = (atStart) => {
			const roots = slothlet.____rootPrototypes;
			if (roots === undefined) return undefined;
			const from = Reflect.getPrototypeOf(atStart);
			return from === roots.held() ? undefined : from;
		};
		// Whether a member of the root is one the snapshot answers for: a member of the api, not one of the framework's.
		const rootMember = (prop) => typeof prop === "string" && !SetMethods.has(RUN_FRAMEWORK_ROOTS, prop);
		/**
		 * A value read at `prop`, as the view hands it out.
		 * @param {string|symbol} prop - The member.
		 * @param {*} value - What was read.
		 * @param {boolean} childLocal - Whether it is the run's own.
		 * @returns {*} The value handed out.
		 */
		const handOut = (prop, value, childLocal) => {
			const member = value !== null && (typeof value === "object" || typeof value === "function");
			// The framework's own root members (the namespace, `shutdown`, `destroy`) are handed out as the run's views of
			// them, so a change made to one, or below one, stays in the run.
			if (atRoot && member && typeof prop === "string" && SetMethods.has(RUN_FRAMEWORK_ROOTS, prop)) {
				return registerFrameworkMemberCopy(frameworkViewAt([prop], value), value);
			}
			// `instanceof` against the class holds for an instance inheriting through the run's view of its prototype.
			if (prop === Symbol.hasInstance && callable && typeof value === "function") return hasInstanceOf(value);
			if (typeof prop === "symbol" || (atRoot && SetMethods.has(RUN_FRAMEWORK_ROOTS, prop))) return value;
			// An emitter or `EventTarget` is a live object the run shares with the instance: its node, as read.
			if (!childLocal && isApiNode(value) && frontsSharedLive(value)) return value;
			// A built-in data object (a `Map`, a `Set`, a `Date`, a typed array), or a node fronting one, is the run's own copy
			// of it, made on the run's first read from what it held when the run started: a real object of its kind, whose
			// changes stay in the run.
			if (snap !== null && !childLocal && member) {
				const builtin = builtinBehind(value);
				if (builtin !== null) return builtinCopy(snap, builtin);
			}
			// A stand-in for a node not loaded yet is the run's view of it too, so what it settles with is read through the
			// run's views once the node has loaded (see standInThen).
			if (
				WeakMapMethods.has(RUN_OF_VIEW, value) ||
				isApiNode(value) ||
				(snap !== null && !childLocal && isLazyStandIn(unwrapSelfView(value)))
			) {
				return viewAt(concatLists(parts, [prop]), value, childLocal || WeakSetMethods.has(run.local, value));
			}

			// A class's prototype is no node: it is handed out as the run's view of it, so a change made to it stays in the run.
			if (prop === "prototype" && callable && !childLocal && value !== null && typeof value === "object") {
				return frameworkViewAt(concatLists(parts, [prop]), value, false, true);
			}
			// A function the language gives every object or function (`constructor`, `toString`, `hasOwnProperty`) works on the
			// view as on the node and is handed out as it is; any other runs on the node when the view is its receiver.
			if (typeof value !== "function" || typeof prop !== "string") return value;
			if (value === Reflect.get(Objects.prototype, prop) || value === Reflect.get(Functions.prototype, prop)) return value;
			// Any other function the root holds as its own (a routine's root cascade) is no node, so no node trap keeps a
			// change made to it in the run: it is handed out as the run's view of it, as the framework's members are. Called
			// through the root, it runs on what the root's view reads through, as before.
			if (atRoot && !WeakSetMethods.has(run.local, value) && Reflect.getOwnPropertyDescriptor(real, prop) !== undefined) {
				return frameworkViewAt([prop], value, true);
			}
			return runViewFunction(value);
		};
		/**
		 * What a call through the view hands back, as the run is handed it: an object the function returned as itself (one
		 * its module keeps, say) is the run's view of it, read as of the run's start, and a built-in the run's own copy.
		 * Nodes, views and shared live objects are handed back as they are.
		 * @param {*} result - What the call returned.
		 * @returns {*} What the run is handed.
		 */
		const runResult = (result) => {
			if (snap === null || result === null || typeof result !== "object") return result;
			// An outer run's view of an object it returned is read as this run reads that object.
			if (isRawRunView(result)) return handOutRaw(snap, result);
			if (isApiNode(result) || WeakMapMethods.has(RUN_OF_VIEW, result) || util.types.isProxy(result)) return result;
			// What an async call settles with is handed to the run as what it returns is.
			if (util.types.isPromise(result)) return handOutSettled(snap, result, runResult);
			return handOutRaw(snap, result);
		};
		let hasInstance = null;
		/**
		 * The `Symbol.hasInstance` the class view answers: the class's own answer, or whether `instance` inherits through
		 * the run's view of the class's prototype.
		 * @param {Function} own - The class's own `Symbol.hasInstance`.
		 * @returns {Function} The function handed out.
		 */
		const hasInstanceOf = (own) => {
			if (hasInstance !== null && hasInstance.own === own) return hasInstance.fn;
			const fn = (instance) => {
				if (Reflect.apply(own, real, [instance])) return true;
				if (instance === null || (typeof instance !== "object" && typeof instance !== "function")) return false;
				const prototype = Reflect.get(view, "prototype");
				// The run's view of the class's own prototype (read as of the run's start) stands for it too.
				const classPrototype = classPrototypeOf(real);
				for (let proto = Reflect.getPrototypeOf(instance); proto !== null; proto = Reflect.getPrototypeOf(proto)) {
					if (proto === prototype) return true;
					if (classPrototype !== null && isRawRunView(proto) && rawBehind(proto) === classPrototype) return true;
				}
				return false;
			};
			hasInstance = { own, fn };
			return fn;
		};
		// The prototype the run gave the node, if it gave one.
		const given = () => {
			const protos = outerHeld(run.protos);
			return MapMethods.has(protos, key) ? { prototype: MapMethods.get(protos, key) } : null;
		};
		/**
		 * Hold a read of what the run wrote at `prop` to the read rules of the member it stands in for: the member read
		 * as the reader reads it, and the value at the member's path.
		 * @param {string|symbol} prop - The member.
		 * @param {*} value - What the run wrote there.
		 * @returns {void}
		 */
		const gateShadow = (prop, value) => {
			if (real === undefined || real === null || typeof prop !== "string") return;
			Reflect.get(real, prop);
			const gate = atInstanceRoot ? rootGate(slothlet) : nodeWrapperOf(real);
			if (gate) enforceRead(gate, prop, unwrapSelfView(value));
		};
		// Whether the view reads the node's prototypes as of the run's start (see inheritedAtStart): what it reads
		// of the instance, as snapshotOf() does.
		const startable = () =>
			snap !== null &&
			!local &&
			real !== undefined &&
			real !== null &&
			!atInstanceRoot &&
			!run.forked &&
			!WeakMapMethods.has(RUN_OF_VIEW, real);
		/**
		 * Read a member the node inherits, from where the run reads it as of its start (see inheritedAtStart):
		 * checked by the node's read gate for the reader, with the view as the receiver, so a getter runs once, on it.
		 * @param {string|symbol} prop - The member.
		 * @param {object|null} from - Where it is read.
		 * @param {*} receiver - The receiver of the read.
		 * @returns {*} The value.
		 */
		const inheritedRead = (prop, from, receiver) => {
			const value = from === null ? undefined : Reflect.get(from, prop, receiver);
			const gate = typeof prop === "string" ? nodeWrapperOf(real) : null;
			if (gate) enforceRead(gate, prop, value);
			if (value !== null && typeof value === "object" && !isApiNode(value)) return handOutRaw(snap, value);
			return handOut(prop, value, local);
		};
		/**
		 * Read a member before the run has a tree of its own.
		 * @param {string|symbol} prop - The member.
		 * @param {*} receiver - The receiver of the read.
		 * @returns {*} The value.
		 */
		const readMember = (prop, receiver) => {
			// A read through a stand-in for a node not loaded yet waits for the node to load, then is made again through the
			// run's views, so it reads the node as of the run's start, as a read made after the load does.
			if (prop === "then" && snap !== null && !local && real !== null && real !== undefined && isLazyStandIn(unwrapSelfView(real)))
				return standInThen;
			if (arrayView) {
				const copy = arrayCopy();
				if (copyAnswers(copy, prop)) {
					if (!Objects.hasOwn(copy, prop)) return undefined;
					const value = copy[prop];
					gateShadow(prop, value);
					return handOut(prop, value, local);
				}
				// An array method works on the view itself, as it works on any array: what it reads and writes is the run's.
				if (
					typeof prop === "string" &&
					prop !== "length" &&
					!isArrayIndexKey(prop) &&
					Reflect.has(ARRAY_PROTOTYPE, prop) &&
					Reflect.getOwnPropertyDescriptor(real, prop) === undefined &&
					given() === null
				) {
					return Reflect.get(ARRAY_PROTOTYPE, prop);
				}
			}
			const entry = own(prop);
			if (entry !== undefined) {
				if (entry.op === "delete") return undefined;
				if (entry.op === "define" && !("value" in entry.descriptor)) {
					gateShadow(prop, undefined);
					return typeof entry.descriptor.get === "function" ? Reflect.apply(entry.descriptor.get, receiver, []) : undefined;
				}
				const value = entry.op === "define" ? entry.descriptor.value : entry.value;
				gateShadow(prop, value);
				return handOut(prop, value, true);
			}
			if (real === undefined || real === null) return below(prop) ? viewAt(concatLists(parts, [prop]), undefined, true) : undefined;
			// A member the node does not hold itself is inherited from the prototype the run gave it, if it gave one.
			const gave = given();
			if (gave !== null && Reflect.getOwnPropertyDescriptor(real, prop) === undefined) {
				return gave.prototype === null ? undefined : Reflect.get(gave.prototype, prop, receiver);
			}
			// A member of the root the instance replaced, added or deleted since the run started reads as it was then, through
			// the root's read gate for the reader.
			const atStart = rootMember(prop) ? rootVersion() : null;
			if (atStart !== null) {
				const held = Reflect.getOwnPropertyDescriptor(atStart, prop);
				if (held === undefined) {
					if (Objects.hasOwn(slothlet.api, prop)) {
						gateShadow(prop, undefined);
						return undefined;
					}
					// A member the root held neither then nor now is inherited from the prototype the root had then.
					const from = rootStartPrototype(atStart);
					if (from !== undefined) {
						const value = from === null ? undefined : Reflect.get(from, prop, receiver);
						enforceRead(rootGate(slothlet), prop, unwrapSelfView(value));
						return handOut(prop, value, local);
					}
				} else if ("value" in held && held.value !== Reflect.getOwnPropertyDescriptor(slothlet.api, prop)?.value) {
					enforceRead(rootGate(slothlet), prop, unwrapSelfView(held.value));
					return handOut(prop, selfView(held.value), local);
				}
			}
			// A getter the module's object holds runs with the view as `this`, so it reads what the run wrote.
			const accessor = atInstanceRoot ? null : viewAccessor(real, prop);
			if (accessor !== null) {
				const gate = nodeWrapperOf(real);
				if (gate) enforceRead(gate, prop, undefined);
				return typeof accessor.get === "function" ? handOut(prop, runViewAccessor(accessor, accessor.get, receiver, []), local) : undefined;
			}
			// What the instance changed since the run started reads as it was then. The read is made through the node all the
			// same, so the node's own read gate decides it for the reader, against the rules the run holds.
			const version = snapshotOf();
			if (version !== null) {
				const held = MapMethods.get(version.members, prop);
				if (held === undefined) {
					// What the node did not hold itself it inherited from the prototypes it inherited from then: read there when
					// that answers otherwise now, and through the node when it answers the same.
					const inherited = inheritedAtStart(real, version, snap, prop, true);
					if (inherited !== undefined && !inherited.same) return inheritedRead(prop, inherited.from, receiver);
					if ((inherited === undefined || !inherited.found) && holdsOwnMember(real, prop)) {
						gateShadow(prop, undefined);
						return undefined;
					}
				} else if (!held.live) {
					const live = throughRunView(() => Reflect.get(real, prop));
					if (sameSnapshotMember(live, held.value)) return handOut(prop, live, local);
					const gate = nodeWrapperOf(real);
					if (gate) enforceRead(gate, prop, unwrapSelfView(held.value));
					return handOut(prop, snapshotValue(held.value), local);
				}
			} else if (startable()) {
				// A member the node inherits from a prototype of a module's own the instance changed since the run started
				// reads as it was then.
				const inherited = inheritedAtStart(real, null, snap, prop, false);
				if (inherited !== undefined && !inherited.same) return inheritedRead(prop, inherited.from, receiver);
			}
			let value = WeakMapMethods.has(RUN_OF_VIEW, real)
				? readThroughOuter(() => Reflect.get(real, prop))
				: throughRunView(() => Reflect.get(real, prop));
			// A member of the instance's root is handed to a reader as `self` hands it: a view keeping who read it.
			if (atInstanceRoot && typeof prop === "string" && !SetMethods.has(RUN_FRAMEWORK_ROOTS, prop)) value = selfView(value);
			if (value === undefined && below(prop)) return viewAt(concatLists(parts, [prop]), undefined, true);
			return handOut(prop, value, local);
		};
		/**
		 * Make a change through the view: on the node, checked by it and kept by the run.
		 * @param {"set"|"define"|"delete"} op - The change.
		 * @param {string|symbol} prop - The member.
		 * @param {*} payload - The value or descriptor.
		 * @returns {boolean} Whether it was made.
		 */
		const change = (op, prop, payload) => {
			const apply = (target) =>
				op === "set"
					? Reflect.set(target, prop, payload)
					: op === "define"
						? Reflect.defineProperty(target, prop, payload)
						: Reflect.deleteProperty(target, prop);
			if (closed()) return apply(shell);
			if (forked()) return apply(current());
			// A node the run wrote is the run's own: the change is made on it, by its own checks.
			if (local && real !== undefined) return apply(real);
			// A setter the module's object holds runs with the view as `this`, so what it writes stays in the run.
			if (op === "set" && !atInstanceRoot && delegatedRunSink === null) {
				const accessor = viewAccessor(real, prop);
				if (accessor !== null) {
					if (typeof accessor.set !== "function") return false;
					runViewAccessor(accessor, accessor.set, view, [payload]);
					return true;
				}
			}
			let sink = delegatedRunSink ?? ((made) => keep(parts, prop, made));
			// A change to an array is made on the run's own copy of it, once the node has let it through.
			if (arrayView && delegatedRunSink === null) {
				const copy = takeArrayCopy();
				const kept = sink;
				sink = (made) => {
					// A run opened in this one reads the copy as it was when it opened.
					if (snap !== null) beforeChange(snap, copy, shallowCopy);
					const done =
						made.op === "set"
							? Reflect.set(copy, prop, made.value)
							: made.op === "define"
								? Reflect.defineProperty(copy, prop, made.descriptor)
								: Reflect.deleteProperty(copy, prop);
					if (done) kept(made);
					return done;
				};
			}
			// An outer run's view: the change goes through it, kept by this run.
			if (WeakMapMethods.has(RUN_OF_VIEW, real)) {
				const previous = delegatedRunSink;
				delegatedRunSink = sink;
				try {
					return apply(real);
				} finally {
					delegatedRunSink = previous;
				}
			}
			const apiManager = slothlet.handlers.apiManager;
			const writers = () => trustedRootOwn.writersOf(runningStore() ?? {});
			if (real === undefined) {
				// A namespace only the run wrote: a write below it is checked as a write at its full path.
				const path = ArrayMethods.join(concatLists(parts, [String(prop)]), ".");
				if (op === "set" && typeof prop === "string") {
					runWrite(slothlet.boundApi, path, sink, () => apiManager.setOwnedProperty(path, payload, writers()));
					return true;
				}
				const writing = writers();
				for (let index = 0; index < writing.length; index++)
					if (writing[index]) apiManager.assertOwnedWrite(concatLists(parts, [String(prop)]), writing[index]);
				return sink(op === "delete" ? { op } : { op, descriptor: payload });
			}
			if (atInstanceRoot && op === "set" && typeof prop === "string") {
				// A write at the root is the one a top-level `self.X = …` makes: through `setOwnedProperty`.
				runWrite(slothlet.boundApi, String(prop), sink, () =>
					apiManager.setOwnedProperty(String(prop), unwrapSelfView(payload), writers())
				);
				return true;
			}
			// A node the instance closed after the run started took the change when the run started: the run keeps it as
			// the node took it then.
			const version = atInstanceRoot ? null : snapshotOf();
			if (version !== null && version.extensible === true && !nodeOpen(real)) {
				const held = MapMethods.get(version.members, prop);
				if (held !== undefined && !held.live && op === "set" && !held.writable) return false;
				return runWriteSinceClosed(real, prop, op, payload, sink);
			}
			const node = atInstanceRoot ? slothlet.boundApi : nodeWrapperOf(real);
			return runWrite(node, prop, sink, () => apply(real));
		};

		/**
		 * Make a change to the node itself through the view: checked by the node as a write at its path, and kept by the
		 * run (a prototype the view then reports, or the view closed).
		 * @param {"prototype"|"close"} op - The change.
		 * @param {object|null} [prototype] - The prototype, for `"prototype"`.
		 * @param {function(object): boolean} [sink] - Where an inner run's view keeps the change, when it hands it on.
		 * @returns {boolean} Whether it was made.
		 */
		const nodeChange = (op, prototype, sink) => {
			const keepHere = sink === undefined;
			sink ??= (made) => {
				if (made.op === "prototype") {
					// A run opened in this one reads the prototypes this one gave as they were when it opened.
					if (snap !== null) beforeChange(snap, run.protos, shallowCopy);
					MapMethods.set(run.protos, key, made.prototype);
				}
				return true;
			};
			// A node the run wrote is the run's own: the change is made on it.
			if (local && real !== undefined) {
				if (!keepHere) return sink({ op, prototype });
				return op === "prototype" ? Reflect.setPrototypeOf(real, prototype) : Reflect.preventExtensions(real);
			}
			// An outer run's view: the change is checked through it, kept by this run.
			const outer = WeakMapMethods.get(RUN_VIEW_NODE_CHANGES, real);
			if (outer !== undefined) return outer(op, prototype, sink);
			if (real === undefined) {
				// A namespace only the run wrote: checked as a write at its path.
				const apiManager = slothlet.handlers.apiManager;
				const writing = trustedRootOwn.writersOf(runningStore() ?? {});
				for (let index = 0; index < writing.length; index++) if (writing[index]) apiManager.assertOwnedWrite(parts, writing[index]);
				return sink({ op, prototype });
			}
			// The root is the instance's api, which keeps its prototype and stays open for a run: closing the root's view
			// closes the run's view, and a prototype is taken only as the one it has.
			if (atInstanceRoot) return op === "close" ? sink({ op }) : Reflect.getPrototypeOf(view) === prototype;
			const node = nodeWrapperOf(real);
			if (node === null) return false;
			// A node the instance closed after the run started took either change when the run started: the run keeps it as
			// the node took it then, checked as a write at the node's path.
			const version = snapshotOf();
			if (version !== null && version.extensible === true && !nodeOpen(real)) return runWriteSinceClosed(real, null, op, prototype, sink);
			// Both changes are checked as the node checks a prototype set on it (closing is the same write): the views
			// between the reader and the node each decide it as they decide one, and the node hands it to the sink.
			// Closing goes that way too, as no view between may answer a close it did not make itself.
			return runWrite(
				node,
				null,
				(made) => sink(op === "close" ? { op } : made),
				() => Reflect.setPrototypeOf(real, op === "prototype" ? prototype : Reflect.getPrototypeOf(real))
			);
		};

		const callTraps = callable
			? {
					// Called with one of the run's views as its receiver, the function runs on that view (see runViewFunction).
					apply: (_t, thisArg, args) =>
						runResult(throughRunView(() => Reflect.apply(forked() ? current() : real, runViewReceiver(thisArg), args))),
					// The view is the new target, so an instance inherits through the run's view of the class's prototype, as an
					// instance of a copy of the class inherits from the copy's prototype; a subclass's own is its own.
					construct: (_t, args, newTarget) => Reflect.construct(forked() ? current() : real, args, newTarget)
				}
			: {};
		const view = markSlothletProxy(
			new NativeProxy(shell, {
				__proto__: null,
				...callTraps,
				get(_t, prop, receiver) {
					if (closed()) return Reflect.get(shell, prop, receiver);
					if (forked()) {
						const node = current();
						if (node === null || node === undefined) return undefined;
						const value = Reflect.get(node, prop);
						// A member of the root is handed to a reader as `self` hands it, as before the run had a tree of its own: a
						// view keeping who read it, also for a run opened in this one, which reads it through this view.
						return parts.length === 0 && typeof prop === "string" && !SetMethods.has(RUN_FRAMEWORK_ROOTS, prop) ? selfView(value) : value;
					}
					return readMember(prop, receiver);
				},
				set(_t, prop, value) {
					// `view.__proto__ = x` on a view of a node fronting a module's own object runs the language's own `__proto__`
					// setter on the view, as the node runs it on itself: the prototype is set through the view, and kept by the
					// run. Anywhere else it is a member write, which the node checks as it checks one.
					if (
						prop === "__proto__" &&
						!closed() &&
						!forked() &&
						!local &&
						protoAssignSetsPrototype(real) &&
						Reflect.getOwnPropertyDescriptor(view, prop) === undefined
					) {
						Reflect.apply(ObjectProtoSetter, view, [value]);
						return true;
					}
					return change("set", prop, value);
				},
				defineProperty(_t, prop, descriptor) {
					return change("define", prop, descriptor);
				},
				deleteProperty(_t, prop) {
					return change("delete", prop, undefined);
				},
				has(_t, prop) {
					if (closed()) return Reflect.has(shell, prop);
					if (forked()) {
						const node = current();
						return node !== null && node !== undefined && prop in node;
					}
					const copy = arrayCopy();
					if (copyAnswers(copy, prop)) return Objects.hasOwn(copy, prop);
					const entry = own(prop);
					if (entry !== undefined) return entry.op !== "delete";
					if (below(prop)) return true;
					if (real === undefined || real === null) return false;
					const version = snapshotOf();
					if (version !== null) {
						if (MapMethods.has(version.members, prop)) return true;
						const inherited = inheritedAtStart(real, version, snap, prop, true);
						if (inherited !== undefined && (inherited.found || !inherited.same)) return inherited.from !== null && prop in inherited.from;
						if (holdsOwnMember(real, prop)) return false;
					} else if (startable()) {
						const inherited = inheritedAtStart(real, null, snap, prop, false);
						if (inherited !== undefined && !inherited.same) return inherited.from !== null && prop in inherited.from;
					}
					const atStart = rootMember(prop) ? rootVersion() : null;
					if (atStart !== null) {
						if (Objects.hasOwn(atStart, prop)) return true;
						if (Objects.hasOwn(slothlet.api, prop)) return false;
						const from = rootStartPrototype(atStart);
						if (from !== undefined) return from !== null && prop in from;
					}
					const gave = given();
					if (gave !== null && Reflect.getOwnPropertyDescriptor(real, prop) === undefined)
						return gave.prototype !== null && prop in gave.prototype;
					return WeakMapMethods.has(RUN_OF_VIEW, real) ? readThroughOuter(() => prop in real) : prop in real;
				},
				ownKeys() {
					if (closed()) return Reflect.ownKeys(shell);
					const node = forked() ? current() : real;
					const copy = forked() ? undefined : arrayCopy();
					if (copy !== undefined) {
						// The run's copy of the array lists its elements and `length`; the node's other members follow.
						const listed = setFrom(Reflect.ownKeys(copy));
						for (let index = 0, held = Reflect.ownKeys(node); index < held.length; index++) {
							if (!isArrayIndexKey(held[index]) && held[index] !== "length") SetMethods.add(listed, held[index]);
						}
						return setToArray(listed);
					}
					let keys = setFrom(
						node === undefined || node === null
							? []
							: WeakMapMethods.has(RUN_OF_VIEW, node)
								? readThroughOuter(() => Reflect.ownKeys(node))
								: Reflect.ownKeys(node)
					);
					const version = forked() ? null : snapshotOf();
					if (version !== null) {
						// The members the node held when the run started, in their order, then what else it lists that it does not
						// hold itself.
						const listed = new Set();
						for (const name of mapKeys(version.members))
							if (SetMethods.has(keys, name) || !holdsOwnMember(real, name)) SetMethods.add(listed, name);
						for (const name of setValues(keys))
							if (!SetMethods.has(listed, name) && !holdsOwnMember(real, name)) SetMethods.add(listed, name);
						keys = listed;
					}
					const atStart = forked() ? null : rootVersion();
					if (atStart !== null) {
						// The root lists the members its api held when the run started, and the framework's own.
						for (const name of setValues(setFrom(keys)))
							if (rootMember(name) && Objects.hasOwn(slothlet.api, name) && !Objects.hasOwn(atStart, name)) SetMethods.delete(keys, name);
						for (let index = 0, names = Reflect.ownKeys(atStart); index < names.length; index++)
							if (rootMember(names[index])) SetMethods.add(keys, names[index]);
					}
					if (!forked()) {
						const members = outerHeld(MapMethods.get(run.entries, key));
						if (members !== undefined) {
							for (const entry of mapValues(members)) {
								if (entry.op === "delete") SetMethods.delete(keys, entry.prop);
								else SetMethods.add(keys, entry.prop);
							}
						}
						const names = MapMethods.get(run.below, key);
						if (names !== undefined) for (const name of setValues(names)) SetMethods.add(keys, name);
					}
					// The shell's own fixed keys stay listed (proxy invariant).
					for (let index = 0, held = Reflect.ownKeys(shell); index < held.length; index++) {
						const fixed = Reflect.getOwnPropertyDescriptor(shell, held[index]);
						if (fixed && !fixed.configurable) SetMethods.add(keys, held[index]);
					}
					return setToArray(keys);
				},
				getOwnPropertyDescriptor(_t, prop) {
					if (closed()) return Reflect.getOwnPropertyDescriptor(shell, prop);
					const fixed = Reflect.getOwnPropertyDescriptor(shell, prop);
					// An array's `length` is fixed on the shell (an array's own is never configurable) and holds the length read.
					if (arrayView && prop === "length" && fixed) return { __proto__: null, ...fixed, value: Reflect.get(view, "length") };
					if (fixed && !fixed.configurable) return fixed;
					if (!forked()) {
						const copy = arrayCopy();
						if (copyAnswers(copy, prop)) {
							const held = Reflect.getOwnPropertyDescriptor(copy, prop);
							if (held === undefined) return undefined;
							return { __proto__: null, ...held, value: readMember(prop, view), configurable: true };
						}
						const entry = own(prop);
						if (entry !== undefined) {
							if (entry.op === "delete") return undefined;
							if (entry.op === "define") {
								const described = { __proto__: null, ...entry.descriptor, configurable: true };
								if ("value" in described) described.value = readMember(prop, view);
								return described;
							}
							return { __proto__: null, value: readMember(prop, view), writable: true, enumerable: true, configurable: true };
						}
						if ((real === undefined || real === null) && below(prop))
							return { __proto__: null, value: readMember(prop, view), writable: true, enumerable: true, configurable: true };
						const atStart = rootMember(prop) ? rootVersion() : null;
						if (atStart !== null) {
							const held = Reflect.getOwnPropertyDescriptor(atStart, prop);
							if (held === undefined) {
								if (Objects.hasOwn(slothlet.api, prop)) return undefined;
							} else if ("value" in held) {
								return {
									__proto__: null,
									value: readMember(prop, view),
									writable: held.writable !== false,
									enumerable: held.enumerable === true,
									configurable: true
								};
							}
						}
						const version = snapshotOf();
						if (version !== null) {
							const held = MapMethods.get(version.members, prop);
							if (held === undefined) {
								if (holdsOwnMember(real, prop)) return undefined;
							} else if (!held.live) {
								return {
									__proto__: null,
									value: readMember(prop, view),
									writable: held.writable,
									enumerable: held.enumerable,
									configurable: true
								};
							}
						}
					}
					const node = forked() ? current() : real;
					if (node === undefined || node === null) return undefined;
					const desc = WeakMapMethods.has(RUN_OF_VIEW, node)
						? readThroughOuter(() => Reflect.getOwnPropertyDescriptor(node, prop))
						: Reflect.getOwnPropertyDescriptor(node, prop);
					if (!desc) return undefined;
					if (!("value" in desc)) return { __proto__: null, ...desc, configurable: true };
					return { __proto__: null, ...desc, value: forked() ? desc.value : readMember(prop, view), configurable: true };
				},
				getPrototypeOf() {
					if (closed()) return Reflect.getPrototypeOf(shell);
					const gave = given();
					if (gave !== null) return gave.prototype;
					// The root reports the prototype it had when the run started, when the instance gave it another since.
					const atStart = atInstanceRoot && !forked() ? rootVersion() : null;
					const from = atStart === null ? undefined : rootStartPrototype(atStart);
					if (from !== undefined) return slothlet.____rootPrototypes.reported(from);
					const node = forked() ? current() : real;
					if (node === undefined || node === null) return Objects.prototype;
					const inherited = startable() ? prototypeAtStart(real, snapshotOf(), snap) : undefined;
					if (inherited !== undefined) return inherited.prototype;
					return WeakMapMethods.has(RUN_OF_VIEW, node)
						? readThroughOuter(() => Reflect.getPrototypeOf(node))
						: Reflect.getPrototypeOf(node);
				},
				setPrototypeOf(_t, prototype) {
					if (closed()) return Reflect.setPrototypeOf(shell, prototype);
					if (forked() && given() === null) return Reflect.setPrototypeOf(current(), prototype);
					return nodeChange("prototype", prototype);
				},
				isExtensible() {
					return Reflect.isExtensible(shell);
				},
				// Closing the view fixes the members the run reads now on the view itself, as closing an object fixes
				// what it holds, so the view then answers as a closed object does. The node stays as it is.
				preventExtensions() {
					if (closed()) return true;
					// Closing the node is a write at its path, checked before the view closes.
					if (!forked() && !nodeChange("close")) return false;
					if (arrayView) shell.length = Reflect.get(view, "length");
					const keys = Reflect.ownKeys(view);
					for (let index = 0; index < keys.length; index++) {
						let described;
						try {
							described = Reflect.getOwnPropertyDescriptor(view, keys[index]);
						} catch {
							continue;
						}
						if (described) Reflect.defineProperty(shell, keys[index], { __proto__: null, ...described, configurable: true });
					}
					Reflect.setPrototypeOf(shell, Reflect.getPrototypeOf(view));
					return Reflect.preventExtensions(shell);
				}
			})
		);
		WeakMapMethods.set(RUN_VIEW_REALS, view, real);
		WeakMapMethods.set(RUN_OF_VIEW, view, run);
		WeakMapMethods.set(RUN_VIEW_NODE_CHANGES, view, (op, prototype, sink) => (forked() ? false : nodeChange(op, prototype, sink)));
		registerRunView(view, real);
		return view;
	};

	/**
	 * The run's view of a member of the framework's namespace (`self.slothlet` and the objects below it).
	 *
	 * @description
	 * The namespace is the framework's own object, not an api node, so no node trap keeps a change made to it in the run.
	 * This view does: a read goes to the namespace every time (an object member as the run's view of it), and an
	 * assignment, definition or deletion is decided by the member's own attributes (a read-only member or a closed object
	 * refuses it, an accessor's setter runs with the view as `this`) and then kept by the run instead of being made on the
	 * namespace. Who may make a change is decided before it reaches the view: module code reads the namespace through the
	 * framework's view of it, which holds the change to the write rules first. Once the run has a tree of its own, the view
	 * reads and writes that tree's namespace, and what the run kept is written there (see `carryFrameworkWrites`).
	 *
	 * The same view keeps a run's changes to the framework's other root members (`self.shutdown`, `self.destroy`), to a
	 * function held by the namespace (`self.slothlet.shutdown`), and to any other root member that is no node of the
	 * api (a routine's root cascade).
	 *
	 * @param {string[]} parts - The member's api path (`["slothlet"]`, `["slothlet", "metadata"]`, `["shutdown"]`).
	 * @param {object|Function} real - What the view reads through: the member, or an outer run's view of it.
	 * @param {boolean} [receivers=false] - Whether a call through the view with another of the run's views as its
	 *   receiver runs on what that view reads through (as a function read through a node's view does).
	 * @param {boolean} [held=false] - Whether the value is one a node holds (a class's prototype, and what is below it)
	 *   rather than the framework's: a change to it is checked as a write at its path first, and stays with the view
	 *   once the run has a tree of its own, which shares the value with the instance.
	 * @returns {object|Function} The view.
	 */
	const frameworkViewAt = (parts, real, receivers = false, held = false) => {
		const key = (held ? "\u0002" : "") + keyOf(parts);
		let byReal = MapMethods.get(run.nsViews, key);
		if (byReal === undefined) {
			byReal = new WeakMap();
			MapMethods.set(run.nsViews, key, byReal);
		}
		let made = WeakMapMethods.get(byReal, real);
		if (made === undefined) {
			made = makeFrameworkView(parts, real, receivers, held);
			WeakMapMethods.set(byReal, real, made);
		}
		return made;
	};

	/**
	 * Make a view of a member of the framework's namespace (see {@link frameworkViewAt}).
	 * @param {string[]} parts - The member's api path.
	 * @param {object|Function} real - What it reads through.
	 * @param {boolean} receivers - See {@link frameworkViewAt}.
	 * @param {boolean} detached - The `held` of {@link frameworkViewAt}.
	 * @returns {object|Function} The view.
	 */
	const makeFrameworkView = (parts, real, receivers, detached) => {
		const key = (detached ? "\u0002" : "") + keyOf(parts);
		const shell = runViewShell(typeof real === "function" ? FunctionMethods.bind(function () {}) : {}, real);
		const closed = () => !Reflect.isExtensible(shell);
		// A value a node holds is the instance's in the run's tree too: the view keeps reading it and keeping what the run changes.
		const forked = () => !detached && run.forked && delegatedRunSink === null;
		// What the view reads of the value: a value a node holds (a class's prototype) as of the run's start, when the
		// instance changed it since (see helpers/run-snapshot); the framework's own members, and an outer run's view, as they are.
		const content = () =>
			detached && snap !== null && !snap.closed && !WeakMapMethods.has(RUN_VIEW_REALS, real) ? rawContent(snap, real) : real;
		/**
		 * Check a change to a value a node holds as a write at its path (`prop` below it, or the value itself), as the
		 * same change is checked outside the run.
		 * @param {string|symbol|null} prop - The member changed, or null for the value itself.
		 * @returns {void}
		 * @throws {SlothletError} When the writer may not make it.
		 */
		const guard = (prop) => {
			if (!detached) return;
			const apiManager = slothlet.handlers.apiManager;
			const at = typeof prop === "string" ? concatLists(parts, [prop]) : parts;
			if (!apiManager.writeChecked(at)) return;
			const writing = trustedRootOwn.writersOf(runningStore() ?? {});
			for (let index = 0; index < writing.length; index++) if (writing[index]) apiManager.assertOwnedWrite(at, writing[index]);
		};
		// The prototype the run gave the value, if it gave one.
		let given = null;
		// The member in the run's own tree, once it has one.
		const current = () => {
			let node = slothlet.boundApi;
			for (let index = 0; index < parts.length && node !== null && node !== undefined; index++) node = node[parts[index]];
			return node;
		};
		const own = (prop) => {
			const members = MapMethods.get(run.nsEntries, key);
			return members === undefined ? undefined : MapMethods.get(members, prop);
		};
		const keepChange = (prop, entry) => {
			let members = MapMethods.get(run.nsEntries, key);
			if (members === undefined) {
				members = new Map();
				MapMethods.set(run.nsEntries, key, members);
			}
			MapMethods.set(members, prop, entry);
			if (!detached) listPush(run.nsLog, { __proto__: null, parts, prop, ...entry });
			return true;
		};
		/**
		 * The member's attributes as the run sees them: what the run defined there, else the namespace's own.
		 * @param {string|symbol} prop - The member.
		 * @returns {object|undefined} The descriptor, its value as the namespace holds it.
		 */
		const attributes = (prop) => {
			const entry = own(prop);
			if (entry !== undefined) return entry.op === "delete" ? undefined : entry.descriptor;
			return Reflect.getOwnPropertyDescriptor(content(), prop);
		};
		/**
		 * A value read at `prop`, as the view hands it out: an object or function member of the namespace as the run's view
		 * of it.
		 * @param {string|symbol} prop - The member.
		 * @param {*} value - What was read.
		 * @returns {*} The value handed out.
		 */
		const handOutMember = (prop, value) => {
			if (typeof prop !== "string" || value === null || (typeof value !== "object" && typeof value !== "function")) return value;
			if (detached) {
				// An object with internal state (a `Map`, a `Date`) answers its own methods only as itself.
				if (hasInternalSlots(value) || isApiNode(value)) return value;
				// A function's own `prototype` is fixed on it, but no member of the view's target: it is the run's view of it too.
				if (prop === "prototype" && typeof real === "function") return frameworkViewAt(concatLists(parts, [prop]), value, false, true);
			}
			const described = Reflect.getOwnPropertyDescriptor(content(), prop);
			// A member fixed on the namespace is handed out as it is: a proxy must report a fixed member as the object
			// holds it.
			if (!described || !("value" in described) || (!described.configurable && !described.writable)) return value;
			return frameworkViewAt(concatLists(parts, [prop]), value, false, detached);
		};
		// What the member's prototype holds at `prop`: what a member the run deleted reads as, as on an ordinary object.
		const inherited = (prop, receiver) => {
			const proto = given !== null ? given.prototype : Reflect.getPrototypeOf(content());
			return proto === null ? undefined : Reflect.get(proto, prop, receiver);
		};
		const read = (prop, receiver) => {
			const entry = own(prop);
			if (entry !== undefined) {
				if (entry.op === "delete") return inherited(prop, receiver);
				if (!("value" in entry.descriptor)) {
					return typeof entry.descriptor.get === "function" ? Reflect.apply(entry.descriptor.get, receiver, []) : undefined;
				}
				return entry.descriptor.value;
			}
			const held = content();
			const described = Reflect.getOwnPropertyDescriptor(held, prop);
			if (described === undefined && given !== null) return inherited(prop, receiver);
			if (described && !("value" in described)) {
				return typeof described.get === "function" ? Reflect.apply(described.get, receiver, []) : undefined;
			}
			return handOutMember(prop, Reflect.get(held, prop));
		};
		/**
		 * Define `prop` in the run as the language defines it on an ordinary object: refused on a closed object or a fixed
		 * member it would change, else kept by the run.
		 * @param {string|symbol} prop - The member.
		 * @param {object} descriptor - The descriptor.
		 * @returns {boolean} Whether it was made.
		 */
		const define = (prop, descriptor) => {
			const held = attributes(prop);
			if (held === undefined) {
				if (!Reflect.isExtensible(content())) return false;
				const accessor = "get" in descriptor || "set" in descriptor;
				const made = accessor
					? { __proto__: null, get: descriptor.get, set: descriptor.set }
					: { __proto__: null, value: descriptor.value, writable: descriptor.writable === true };
				made.enumerable = descriptor.enumerable === true;
				made.configurable = descriptor.configurable === true;
				return keepChange(prop, { op: "define", descriptor: made });
			}
			const accessor = "get" in descriptor || "set" in descriptor;
			const heldAccessor = !("value" in held);
			if (!held.configurable) {
				if (descriptor.configurable === true) return false;
				if ("enumerable" in descriptor && descriptor.enumerable !== held.enumerable) return false;
				if (accessor || heldAccessor) {
					if (!accessor || !heldAccessor) return !accessor && !("value" in descriptor) && !("writable" in descriptor);
					if (("get" in descriptor && descriptor.get !== held.get) || ("set" in descriptor && descriptor.set !== held.set)) return false;
				} else if (!held.writable) {
					if (descriptor.writable === true) return false;
					if ("value" in descriptor && !Objects.is(descriptor.value, held.value)) return false;
				}
			}
			let made;
			if (accessor && !heldAccessor)
				made = { __proto__: null, get: descriptor.get, set: descriptor.set, enumerable: held.enumerable, configurable: held.configurable };
			else if (!accessor && heldAccessor && ("value" in descriptor || "writable" in descriptor))
				made = {
					__proto__: null,
					value: descriptor.value,
					writable: descriptor.writable === true,
					enumerable: held.enumerable,
					configurable: held.configurable
				};
			else made = { __proto__: null, ...held };
			for (let index = 0; index < RUN_DESCRIPTOR_FIELDS.length; index++) {
				const field = RUN_DESCRIPTOR_FIELDS[index];
				if (field in descriptor) made[field] = descriptor[field];
			}
			if ("value" in made && !("value" in descriptor) && !heldAccessor && own(prop) === undefined)
				made.value = handOutMember(prop, held.value);
			return keepChange(prop, { op: "define", descriptor: made });
		};

		/**
		 * An assignment to an object inheriting from the value (an instance's own member, which reaches the value only
		 * because the instance holds no such member): a setter or a read-only member the value holds decides it, else it
		 * is made on the receiver, as on an ordinary object.
		 * @param {string|symbol} prop - The member.
		 * @param {*} value - The value assigned.
		 * @param {object} receiver - The object assigned to.
		 * @returns {boolean} Whether it was made.
		 */
		const inheritedSet = (prop, value, receiver) => {
			let held = attributes(prop);
			for (
				let proto = given !== null ? given.prototype : Reflect.getPrototypeOf(content());
				proto !== null && held === undefined;
				proto = Reflect.getPrototypeOf(proto)
			)
				held = Reflect.getOwnPropertyDescriptor(proto, prop);
			if (held !== undefined && !("value" in held)) {
				if (typeof held.set !== "function") return false;
				Reflect.apply(held.set, receiver, [value]);
				return true;
			}
			if (held !== undefined && !held.writable) return false;
			const existing = Reflect.getOwnPropertyDescriptor(receiver, prop);
			if (existing !== undefined) {
				if (!("value" in existing) || !existing.writable) return false;
				return Reflect.defineProperty(receiver, prop, { __proto__: null, value });
			}
			return Reflect.defineProperty(receiver, prop, { __proto__: null, value, writable: true, enumerable: true, configurable: true });
		};

		const view = new NativeProxy(shell, {
			__proto__: null,
			...(typeof real === "function"
				? {
						apply: (_t, thisArg, args) =>
							Reflect.apply(
								forked() ? current() : real,
								thisArg === view
									? real
									: receivers && WeakMapMethods.has(RUN_VIEW_REALS, thisArg)
										? WeakMapMethods.get(RUN_VIEW_REALS, thisArg)
										: thisArg,
								args
							),
						construct: (_t, args) => Reflect.construct(forked() ? current() : real, args)
					}
				: {}),
			get(_t, prop, receiver) {
				if (closed()) return Reflect.get(shell, prop, receiver);
				if (forked()) return Reflect.get(current(), prop);
				return read(prop, receiver);
			},
			set(_t, prop, value, receiver) {
				if (closed()) return Reflect.set(shell, prop, value);
				if (forked()) return Reflect.set(current(), prop, value);
				// What an object inheriting from the value assigns (an instance's own member): made on it, as on an ordinary object.
				if (receiver !== view && detached) return inheritedSet(prop, value, receiver);
				// An outer view of the namespace: the change is this view's, as the language sends it to the receiver.
				if (receiver !== view) return Reflect.set(real, prop, value, receiver);
				guard(prop);
				// A name with the framework's prefix is absorbed as the node's own assignment absorbs it.
				if (isFrameworkMemberName(prop)) return true;
				let held = attributes(prop);
				if (held === undefined) {
					// Inherited: a setter or a read-only member on the prototype decides it, as on an ordinary object.
					for (
						let proto = given !== null ? given.prototype : Reflect.getPrototypeOf(content());
						proto !== null && held === undefined;
						proto = Reflect.getPrototypeOf(proto)
					) {
						held = Reflect.getOwnPropertyDescriptor(proto, prop);
					}
					if (held !== undefined) {
						if (!("value" in held)) {
							if (typeof held.set !== "function") return false;
							Reflect.apply(held.set, view, [value]);
							return true;
						}
						if (!held.writable) return false;
					}
					return define(prop, { __proto__: null, value, writable: true, enumerable: true, configurable: true });
				}
				if (!("value" in held)) {
					if (typeof held.set !== "function") return false;
					Reflect.apply(held.set, view, [value]);
					return true;
				}
				if (!held.writable) return false;
				return define(prop, { __proto__: null, value });
			},
			defineProperty(_t, prop, descriptor) {
				if (closed()) return Reflect.defineProperty(shell, prop, descriptor);
				if (forked()) return Reflect.defineProperty(current(), prop, descriptor);
				guard(prop);
				// A name with the framework's prefix is absorbed as the node's own definition absorbs it (see absorbsFrameworkName).
				const absorbed = absorbsFrameworkName(_t, prop, descriptor);
				if (absorbed !== undefined) return absorbed;
				return define(prop, descriptor);
			},
			deleteProperty(_t, prop) {
				if (closed()) return Reflect.deleteProperty(shell, prop);
				if (forked()) return Reflect.deleteProperty(current(), prop);
				guard(prop);
				const held = attributes(prop);
				if (held === undefined) return true;
				if (!held.configurable) return false;
				return keepChange(prop, { op: "delete" });
			},
			has(_t, prop) {
				if (closed()) return Reflect.has(shell, prop);
				if (forked()) return prop in current();
				const entry = own(prop);
				const held = content();
				if (entry !== undefined) {
					if (entry.op !== "delete") return true;
					const proto = given !== null ? given.prototype : Reflect.getPrototypeOf(held);
					return proto !== null && prop in proto;
				}
				if (given !== null && Reflect.getOwnPropertyDescriptor(held, prop) === undefined)
					return given.prototype !== null && prop in given.prototype;
				return prop in held;
			},
			ownKeys() {
				if (closed()) return Reflect.ownKeys(shell);
				if (forked()) return setToArray(setFrom(concatLists(Reflect.ownKeys(current()), Reflect.ownKeys(shell))));
				const keys = setFrom(Reflect.ownKeys(content()));
				const members = MapMethods.get(run.nsEntries, key);
				if (members !== undefined) {
					const changed = mapEntriesToArray(members);
					for (let index = 0; index < changed.length; index++) {
						if (changed[index][1].op === "delete") SetMethods.delete(keys, changed[index][0]);
						else SetMethods.add(keys, changed[index][0]);
					}
				}
				for (let index = 0, held = Reflect.ownKeys(shell); index < held.length; index++) SetMethods.add(keys, held[index]);
				return setToArray(keys);
			},
			getOwnPropertyDescriptor(_t, prop) {
				if (closed()) return Reflect.getOwnPropertyDescriptor(shell, prop);
				const fixed = Reflect.getOwnPropertyDescriptor(shell, prop);
				if (fixed && !fixed.configurable) return fixed;
				const held = forked() ? Reflect.getOwnPropertyDescriptor(current(), prop) : attributes(prop);
				if (held === undefined) return undefined;
				// Reported configurable: the shell holds none of the members, so a fixed one could not be reported (proxy
				// invariant); a change to it is still refused by the view.
				if (!("value" in held)) return { __proto__: null, ...held, configurable: true };
				return { __proto__: null, ...held, value: forked() ? held.value : read(prop, view), configurable: true };
			},
			getPrototypeOf() {
				if (closed()) return Reflect.getPrototypeOf(shell);
				if (given !== null) return given.prototype;
				return Reflect.getPrototypeOf(forked() ? current() : content());
			},
			setPrototypeOf(_t, prototype) {
				if (closed()) return Reflect.setPrototypeOf(shell, prototype);
				if (forked()) return Reflect.setPrototypeOf(current(), prototype);
				if (!detached) return Reflect.getPrototypeOf(real) === prototype;
				// A value a node holds takes the prototype in the run, checked as a write at its path.
				guard(null);
				if (!Reflect.isExtensible(real)) return Reflect.getPrototypeOf(real) === prototype;
				given = { prototype };
				return true;
			},
			isExtensible() {
				return Reflect.isExtensible(shell);
			},
			// Closing the view fixes the members the run reads now on the view itself; the namespace stays as it is.
			preventExtensions() {
				if (closed()) return true;
				guard(null);
				if (forked()) Reflect.preventExtensions(current());
				const keys = Reflect.ownKeys(view);
				for (let index = 0; index < keys.length; index++) {
					const described = Reflect.getOwnPropertyDescriptor(view, keys[index]);
					if (described) Reflect.defineProperty(shell, keys[index], { __proto__: null, ...described, configurable: true });
				}
				Reflect.setPrototypeOf(shell, Reflect.getPrototypeOf(view));
				return Reflect.preventExtensions(shell);
			}
		});
		WeakMapMethods.set(RUN_VIEW_REALS, view, real);
		// A value a node holds, written into the api, is stored as the value (see unwrapSelfView).
		if (detached) registerRunView(view, real);
		return view;
	};

	/**
	 * Write what the run kept of its changes to the framework's namespace into the namespace of the run's own tree.
	 * @param {object[]} log - The changes, in the order made.
	 * @returns {void}
	 */
	const carryFrameworkWrites = (log) => {
		for (let index = 0; index < log.length; index++) {
			const entry = log[index];
			let node = slothlet.boundApi;
			for (let step = 0; step < entry.parts.length && node !== null && node !== undefined; step++) node = node[entry.parts[step]];
			if (node === null || (typeof node !== "object" && typeof node !== "function")) continue;
			try {
				if (entry.op === "delete") Reflect.deleteProperty(node, entry.prop);
				else {
					const descriptor = { __proto__: null, ...entry.descriptor };
					if ("value" in descriptor) {
						let value = descriptor.value;
						while (WeakMapMethods.has(RUN_VIEW_REALS, value)) value = WeakMapMethods.get(RUN_VIEW_REALS, value);
						descriptor.value = unwrapSelfView(value);
					}
					Reflect.defineProperty(node, entry.prop, descriptor);
				}
			} catch {
				// A member the run's tree holds differently (fixed there) keeps what the tree holds.
			}
		}
	};

	const root = viewAt([], parentSelf, false);
	/**
	 * The run's tree has been built: what the run kept before is written into it (a copy of the tree it read), and from
	 * now on its `self` reads and writes that tree. A rebuild from disk or the original config (a reload or restart in
	 * the run) carries no runtime write, and none of these either.
	 * @param {"copy"|"reload"|"restart"} kind - What built the tree.
	 * @param {function(function(): void): void} asBuild - Runs code as the build of the run's tree.
	 * @returns {void}
	 */
	run.adopted = (kind, asBuild) => {
		if (run.forked) return;
		if (kind === "copy") {
			const logs = [];
			for (let outer = run; outer !== null; outer = outer.parent) if (!outer.forked) listUnshift(logs, outer.log);
			const nsLogs = [];
			for (let outer = run; outer !== null; outer = outer.parent) if (!outer.forked) listUnshift(nsLogs, outer.nsLog);
			asBuild(() => {
				for (let index = 0; index < logs.length; index++) slothlet.handlers.apiManager.carryRunWrites(logs[index]);
				for (let index = 0; index < nsLogs.length; index++) carryFrameworkWrites(nsLogs[index]);
			});
		}
		run.forked = true;
	};
	if (record !== null && record !== undefined) record[RUN_SELF] = run;
	return root;
}

/** Whether {@link RunLayer} has built its class: it builds one, for the wrapper's chain. @type {boolean} */
let built = false;

/**
 * Build this layer of the wrapper class over `Base`, once (see `unified-wrapper.mjs`).
 * @param {Function} Base - The class below this layer.
 * @returns {Function} The layer's class.
 * @internal
 */
export function RunLayer(Base) {
	if (built) throw ownBindingsRefusal("lib/handlers/unified-wrapper/run", import.meta.url);
	built = true;
	return Base.layer(
		class Run extends Base {
			static {
				Base.define("run", {
					runsNoModuleCode,
					runsForHander,
					shared: runShared,
					takeRunWrite,
					snapshotPrototype,
					runningRecord,
					snapshotBarrier,
					fillPrototype,
					inRunTree,
					ownRunTreeArray,
					markRunTreeHeld,
					treeHides: runTreeHides,
					asMaker: runAsMaker,
					runningLeafOf,
					guardPromotedResult,
					unwrapError,
					makeRunSelf,
					RUN_VIEW_ACCESS,
					SETTLED_CHECKPOINTS,
					captureNode
				});
				Base.define("checkpoint", {
					handout: checkpointHandout,
					nodeBuiltins: checkpointNodeBuiltins,
					nodePrototypes: checkpointNodePrototypes
				});
				Base.define("is", { callerLocked: isCallerLocked });
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					INTRINSICS = methods.values.INTRINSICS;
					holdsDataKind = methods.holds.dataKind;
					isSlothletValue = methods.is.slothletValue;
					ownsPrototype = methods.values.ownsPrototype;
					makerInstanceID = methods.nodes.makerInstanceID;
					makerOf = methods.nodes.makerOf;
					moduleObjectOf = methods.module.objectOf;
					nodeOpen = methods.node.open;
					nodeWrapperOf = methods.node.wrapperOf;
					FRAMEWORK_WRITES = methods.rules.FRAMEWORK_WRITES;
					assertOwnedWrite = methods.rules.assertOwnedWrite;
					readOnBehalf = methods.read.onBehalf;
					hasOwn = methods.has.own;
					fileNodes = methods.uw.fileNodes;
					outerCallerCeiling = methods.uw.outerCallerCeiling;
					resolveWrapper = methods.uw.resolveWrapper;
					trustedRootOwn = methods.uw.trustedRootOwn;
					viewAccessor = methods.nodes.viewAccessor;
					unwrapSelfView = methods.views.unwrapSelfView;
					selfView = methods.self.view;
					builtinBehind = methods.views.builtinBehind;
					isApiNode = methods.is.apiNode;
					inheritedAtStart = methods.inherited.atStart;
					holdsOwnMember = methods.holds.ownMember;
					hasInternalSlots = methods.has.internalSlots;
					enforceRead = methods.rules.enforceRead;
					registerRunView = methods.rules.registerRunView;
					isLazyStandIn = methods.is.lazyStandIn;
					rootGate = methods.root.gate;
					sameLookup = methods.nodes.sameLookup;
					FRAMEWORK_MEMBERS = methods.views.FRAMEWORK_MEMBERS;
					registerFrameworkMember = methods.rules.registerFrameworkMember;
					FRAMEWORK_MEMBER_NAMES = methods.rules.FRAMEWORK_MEMBER_NAMES;
					takeRefusedChange = methods.waiting.takeRefusedChange;
					WAITING_CHAINS = methods.nodes.WAITING_CHAINS;
					isWrapper = methods.brand.isWrapper;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/run", import.meta.url);
				super(slothlet);
			}

			/**
			 * What a node stores for a value assigned to it outside a build (wrap-on-set, #329): an object or function becomes a
			 * node of its own, wrapped as `api.slothlet.api.add()` wraps one and marked as user-assigned; a primitive, a proxy, a
			 * node, and a value the node cannot wrap are stored as they are.
			 * @param {object} wrapper - The node written.
			 * @param {string|symbol} prop - The member.
			 * @param {*} value - The value assigned.
			 * @returns {*} What the node stores.
			 * @private
			 */
			___wrapOnSet(prop, value) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/run", import.meta.url);
				const wrapper = this;
				let stored = value;
				if (
					value !== null &&
					(typeof value === "object" || typeof value === "function") &&
					!util.types.isProxy(value) &&
					resolveWrapper(value) === null
				) {
					// deferChildAdopt: a user-assigned object is wrapped lazily so an arbitrarily deep
					// grafted chain is not adopted recursively at assignment (#329 / #247 unbounded depth).
					const wrapped = wrapper.___createChildWrapper(prop, value, null, true);
					if (wrapped !== null && wrapped !== undefined) {
						const wrappedInternal = resolveWrapper(wrapped);
						// `wrapped` is guarded non-null/undefined above, and `___createChildWrapper` only ever
						// returns a resolvable UnifiedWrapper here (a nested wrapper proxy, or the value itself
						// when it was already a wrapper) — its null/undefined/opaque/cycle returns are excluded
						// by that guard. So `wrappedInternal` is always truthy; the else can't be reached.
						/* v8 ignore else - wrappedInternal is always a resolved wrapper here (see above); the else is unreachable */
						if (wrappedInternal) wrappedInternal.____slothletInternal.userAssigned = true;
						stored = wrapped;
					}
				}
				return stored;
			}

			/**
			 * The prototype a node holds as a run reads it, as of the run's start: the one its saved version holds (when the
			 * instance changed the node since), else the one it holds now. Undefined when the snapshot cannot tell it.
			 * @param {UnifiedWrapper} wrapper - The node's wrapper.
			 * @param {{prototype?: (object|null|symbol)}|null} version - The node's saved version, if any.
			 * @returns {{start: (object|null), now: (object|null)}|undefined} The prototype at the start and the one now.
			 * @private
			 */
			___startPrototypes(version) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/run", import.meta.url);
				const wrapper = this;
				const now = snapshotPrototype(wrapper);
				const start = version !== null && version !== undefined && version.prototype !== undefined ? version.prototype : now;
				if (start === SNAPSHOT_UNKNOWN_PROTOTYPE || now === SNAPSHOT_UNKNOWN_PROTOTYPE) return undefined;
				return { start, now };
			}

			/**
			 * Save a prototype of a module's own a node hands out as itself (its class's, or the one it inherits from), for the
			 * runs open (see {@link checkpointHandout}). The language's own prototypes, nodes and Proxies are left alone.
			 * @param {UnifiedWrapper} wrapper - The node's wrapper.
			 * @param {*} prototype - The prototype.
			 * @returns {void}
			 * @private
			 */
			___checkpointPrototypeHandout(prototype) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/run", import.meta.url);
				const wrapper = this;
				if (prototype === null || typeof prototype !== "object" || prototype === SNAPSHOT_UNKNOWN_PROTOTYPE) return;
				if (isLanguagePrototype(prototype) || resolveWrapper(prototype) !== null) return;
				checkpointHandout(wrapper.slothlet, prototype);
			}

			/**
			 * Before a file's code runs while a run is open: save every node of the file once per window (see
			 * `checkpointOnce` in `helpers/run-snapshot`), so a change the code makes to what the file exports through its own
			 * variables does not reach the runs open.
			 * @param {UnifiedWrapper} wrapper - The leaf about to run.
			 * @returns {void}
			 * @private
			 */
			___checkpointFile() {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/run", import.meta.url);
				const wrapper = this;
				const slothlet = wrapper.slothlet;
				const domain = domainOf(slothlet);
				if (!runsOpen(domain)) return;
				const filePath = wrapper.____slothletInternal.filePath;
				if (!filePath) return;
				// Once per file per window, whichever flow calls first: a call from a run saves what the instance holds then too,
				// which is what the runs open read, and it spares every later call the work of telling whether it runs in one.
				checkpointOnce(domain, filePath, () => {
					const nodes = fileNodes(slothlet, filePath);
					for (let index = 0; index < nodes.length; index++) {
						const node = nodes[index];
						if (node.slothlet !== slothlet) continue;
						const internal = node.____slothletInternal;
						if (internal.invalid || (internal.mode === "lazy" && !internal.state.materialized)) continue;
						beforeChange(domain, node, captureNode);
						// What the file exports as built-ins (a `Map`) and the prototypes of its own its code changes as themselves.
						checkpointNodeBuiltins(domain, node);
						checkpointNodePrototypes(domain, node);
					}
				});
			}

			/**
			 * The prototype on a node's record (see {@link fillPrototype}), recorded now when the node was handed its value
			 * without it (a value put back as it was, or moved from another node). Until the node is given one, the record follows
			 * its value: a module that changes its own function's prototype changes what its node has.
			 * @param {object} wrapper - The node's wrapper.
			 * @returns {object|Function|null} The prototype.
			 * @private
			 */
			___recordedPrototype() {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/run", import.meta.url);
				const wrapper = this;
				const internal = wrapper.____slothletInternal;
				if (internal.prototypeOf !== internal.impl || (!internal.prototypeGiven && typeof internal.impl === "function")) {
					fillPrototype(wrapper);
				}
				return internal.prototype;
			}

			/**
			 * The prototype a node of a run's tree reads a member it removed from (see {@link runTreeHides}) through.
			 * @param {UnifiedWrapper} wrapper - The node's wrapper.
			 * @returns {object|null} The prototype.
			 * @private
			 */
			___runTreeHiddenFrom() {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/run", import.meta.url);
				const wrapper = this;
				return Reflect.getPrototypeOf(wrapper.____slothletInternal.proxy ?? wrapper);
			}

			/**
			 * Run a call whose permission gate was deferred for a principal resolve (#459), returning its result
			 * through the same contract the #253 hook promotion uses.
			 *
			 * @param {object} wrapper - Target UnifiedWrapper.
			 * @param {Promise<void>} gate - The deferred gate from {@link deferForPrincipals}.
			 * @param {function(): *} run - Performs the call once the gate passes (enforcement already done).
			 * @returns {Promise<*>} The call's result. A genuinely-async leaf's callers already hold a Promise
			 *   contract, so it is returned plainly; a sync leaf's is guarded so value-coercion of the
			 *   unawaited Promise throws a named error instead of silently misbehaving.
			 * @private
			 */
			___runAfterPrincipalGate(gate, run) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/run", import.meta.url);
				const wrapper = this;
				const promoted = PromiseMethods.then(gate, run);
				const impl = wrapper.____slothletInternal.impl;
				const leafIsAsync = util.types.isAsyncFunction(impl) || util.types.isAsyncFunction(impl?.default);
				return leafIsAsync ? promoted : guardPromotedResult(promoted, wrapper.____slothletInternal.apiPath, wrapper.SlothletError);
			}

			/**
			 * The record of a target's failure (#599): the one kept for it (the innermost code it was thrown from), or a new one that
			 * reads it as the target.
			 *
			 * Unwrapping the error, formatting its stack and naming its class each read accessors the code that threw it may have
			 * put there (or a Proxy's traps). Read in the caller's flow, after the target returned, they would run with the
			 * caller's identity; the record reads them as the code they belong to, each at most once and only when something asks
			 * (see failureRecord), so reporting the failure reads nothing off it in the caller's flow.
			 *
			 * @param {object} wrapper - The target's wrapper.
			 * @param {*} error - What the target threw or rejected with.
			 * @returns {object} The failure's record.
			 * @private
			 */
			___readTargetFailure(error) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/run", import.meta.url);
				const wrapper = this;
				return rememberMadeFailure(wrapper, error);
			}
		}
	);
}
