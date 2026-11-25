/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/run.mjs
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
 * @fileoverview Run layer of the wrapper: run views, checkpoints and run snapshots, and the run write.
 * @module @cldmv/slothlet/handlers/unified-wrapper/run
 * @internal
 */

import { segmentsOf } from "#helpers/segments";
import { util } from "#helpers/platform";
import { isCompositionLayer, layerUnderlying } from "#helpers/composition";
import { isFrameworkReservedKey } from "#helpers/reserved-keys";
import { isFrameworkInternal } from "#handlers/framework-internals";
import {
	settleThenable,
	isHookProcessed,
	failureRecord,
	failureSource,
	rememberFailure,
	rememberedFailure,
	unwrapThrown
} from "#handlers/hook-manager";
import { isSharedExport } from "#handlers/shared-values";
import { pinnedThen } from "#helpers/promise-context";
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
	Promise,
	PromiseMethods,
	Reflect,
	RegExpMethods,
	Set,
	SetMethods,
	Symbol,
	WeakMap,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods
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
	savedThisWindow
} from "#helpers/run-snapshot";
import { RUN_COPY } from "#helpers/flow-stores";

import { ownBindingsRefusal } from "#helpers/instance-imports";
import { internals as callerPinningInternals } from "#helpers/caller-pinning";
const { isCallerLocked } = callerPinningInternals("lib/handlers/unified-wrapper/run");

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 *
 * Upward (from layers above this one): hasOwn, runtime_carriesHanded, searchDepth, searchBudget, runtime_heldValue.
 */
let trustedRootOwn,
	fileNodes,
	outerCallerCeiling,
	hasOwn,
	FRAMEWORK_WRITES,
	runtime_inherits,
	runtime_isEnginePromise,
	runtime_carriesHanded,
	runtime_holdsDataKind,
	runtime_assertOwnedWrite,
	runtime_nodeWrapperOf,
	runtime_nodeOpen,
	runtime_wrapperClassPrototype,
	runtime_readOnBehalf,
	runtime_runAccessor,
	runtime_ownsPrototype,
	runtime_moduleObjectOf,
	INTRINSICS,
	runtime_isSlothletValue,
	runtime_makerOf,
	runtime_makerInstanceID,
	searchDepth,
	searchBudget,
	runtime_isCarrier,
	runtime_holdsValue,
	runtime_heldValue,
	resolveWrapper;
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
function runtime_runsNoModuleCode(fn) {
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
function runtime_runsForHander(value, from) {
	if (typeof value !== "function" || !from?.____slothletInternal || util.types.isProxy(value)) return false;
	if (runtime_isSlothletValue(value) || isFrameworkInternal(value)) return false;
	return WeakSetMethods.has(INTRINSICS, value) || isSharedExport(value) || runtime_runsNoModuleCode(value);
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
 * The change a full-isolation run's `self` is making to a node of the tree the run reads but does not own yet, while it
 * makes it: the node (a wrapper, or the instance's bound api for the root), the member, and where the change goes
 * instead of the node. The node's own trap checks the change as it checks any change, and stores it there in place of
 * the node only once every check has passed (see {@link runtime_takeRunWrite}).
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
function runtime_runWrite(node, prop, sink, change) {
	const previous = runShared.RUN_WRITE;
	runShared.RUN_WRITE = { node, prop, sink };
	try {
		return change();
	} finally {
		runShared.RUN_WRITE = previous;
	}
}

/**
 * The sink a change a trap is about to make goes to instead of the node (see {@link runtime_runWrite}): only for the
 * change the run's `self` is making on this very node and member, once. Null for every other change.
 * @param {object} node - The wrapper (or bound api) making the change.
 * @param {string|symbol|null} prop - The member; null for a change to the node itself.
 * @returns {function(object): boolean|null} The sink, or null.
 * @internal
 */
function runtime_takeRunWrite(node, prop) {
	const pending = runShared.RUN_WRITE;
	if (pending === null || pending.node !== node || pending.prop !== prop) return null;
	runShared.RUN_WRITE = null;
	return pending.sink;
}

/**
 * Run one half of an accessor {@link runtime_viewAccessor} found, as the module the node belongs to, on `receiver`.
 * @param {{wrapper: object}} accessor - The accessor.
 * @param {Function} half - Its getter or setter.
 * @param {*} receiver - The `this` it runs with.
 * @param {Array<*>} args - Its arguments.
 * @returns {*} What it returned.
 * @internal
 */
function runtime_runViewAccessor(accessor, half, receiver, args) {
	return runtime_runAccessor(accessor.wrapper, half, receiver, args);
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
function runtime_wrapOnSet(wrapper, prop, value) {
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
function runtime_captureNode(wrapper) {
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
		if (child !== null && runtime_holdsValue(child)) value = runtime_heldValue(child);
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
	const object = runtime_moduleObjectOf(wrapper);
	// Whether the node takes new members and the prototype it holds, as they are now.
	const open = runtime_nodeOpen(wrapper);
	const prototype = runtime_snapshotPrototype(wrapper);
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
 * Marks a prototype the snapshot cannot tell (see {@link runtime_snapshotPrototype}).
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
function runtime_snapshotPrototype(wrapper) {
	const internal = wrapper.____slothletInternal;
	const impl = internal.impl;
	if (internal.runPrototype !== undefined) return internal.runPrototype.prototype;
	if (Arrays.isArray(impl)) return Reflect.getPrototypeOf(layerUnderlying(impl));
	if (impl !== null && typeof impl === "object" && util.types.isProxy(impl) && !isCompositionLayer(impl)) return SNAPSHOT_UNKNOWN_PROTOTYPE;
	if (runtime_holdsDataKind(impl)) return Reflect.getPrototypeOf(impl);
	const moduleObject = runtime_moduleObjectOf(wrapper);
	if (moduleObject !== null) return Reflect.getPrototypeOf(moduleObject);
	if (runtime_ownsPrototype(wrapper)) return runtime_recordedPrototype(wrapper);
	if (impl !== null && (typeof impl === "object" || typeof impl === "function")) return Reflect.getPrototypeOf(layerUnderlying(impl));
	return SNAPSHOT_UNKNOWN_PROTOTYPE;
}

/**
 * The prototype a node holds as a run reads it, as of the run's start: the one its saved version holds (when the
 * instance changed the node since), else the one it holds now. Undefined when the snapshot cannot tell it.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {{prototype?: (object|null|symbol)}|null} version - The node's saved version, if any.
 * @returns {{start: (object|null), now: (object|null)}|undefined} The prototype at the start and the one now.
 * @private
 */
function runtime_startPrototypes(wrapper, version) {
	const now = runtime_snapshotPrototype(wrapper);
	const start = version !== null && version !== undefined && version.prototype !== undefined ? version.prototype : now;
	if (start === SNAPSHOT_UNKNOWN_PROTOTYPE || now === SNAPSHOT_UNKNOWN_PROTOTYPE) return undefined;
	return { start, now };
}

/**
 * Save a prototype of a module's own a node hands out as itself (its class's, or the one it inherits from), for the
 * runs open (see {@link runtime_checkpointHandout}). The language's own prototypes, nodes and Proxies are left alone.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {*} prototype - The prototype.
 * @returns {void}
 * @private
 */
function runtime_checkpointPrototypeHandout(wrapper, prototype) {
	if (prototype === null || typeof prototype !== "object" || prototype === SNAPSHOT_UNKNOWN_PROTOTYPE) return;
	if (isLanguagePrototype(prototype) || resolveWrapper(prototype) !== null) return;
	runtime_checkpointHandout(wrapper.slothlet, prototype);
}

/**
 * Save the prototypes of a module's own a node inherits from (and its class's prototype, for a class), for the runs
 * open (see {@link runtime_checkpointBuiltin}): the module's code changes them as themselves.
 * @param {object|null} domain - The instance's domain.
 * @param {UnifiedWrapper} node - The node's wrapper.
 * @returns {void}
 * @private
 */
function runtime_checkpointNodePrototypes(domain, node) {
	const prototype = runtime_snapshotPrototype(node);
	if (prototype !== SNAPSHOT_UNKNOWN_PROTOTYPE && !isLanguagePrototype(prototype) && resolveWrapper(prototype) === null)
		runtime_checkpointBuiltin(domain, prototype);
	// A function's own prototype is a class's, or holds what the module put on it, and is saved as any object is. A plain
	// function's that still holds only its `constructor` is saved as the function only, its content made when a run that
	// started before the module gave it more reads it (see saveDefaultPrototype).
	const classPrototype = runtime_wrapperClassPrototype(node);
	if (classPrototype === null || isLanguagePrototype(classPrototype)) return;
	const fn = layerUnderlying(node.____slothletInternal.impl);
	if (isDefaultPrototype(classPrototype, fn)) saveDefaultPrototype(domain, classPrototype, fn);
	else runtime_checkpointBuiltin(domain, classPrototype);
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
function runtime_runWriteSinceClosed(node, prop, op, payload, sink) {
	const wrapper = runtime_nodeWrapperOf(node);
	if (wrapper === null) return false;
	runtime_assertOwnedWrite(wrapper, prop);
	if (op === "set") return sink({ op, value: runtime_wrapOnSet(wrapper, prop, payload) });
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
function runtime_runningRecord(slothlet) {
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
function runtime_checkpointHandout(slothlet, value) {
	if (value === null || typeof value !== "object" || RUN_VIEW_ACCESS !== 0) return;
	const domain = domainOf(slothlet);
	if (!runsOpen(domain) || savedThisWindow(domain, value) || util.types.isProxy(value)) return;
	runtime_checkpointBuiltin(domain, value);
}

/**
 * How deep in reads and calls a run's `self` makes through a node the code running is (see
 * {@link runtime_throughRunView}): what such a read or call hands back reaches the run as its own copy or view, never
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
function runtime_throughRunView(access) {
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
function runtime_checkpointBuiltin(domain, value) {
	checkpointDeep(domain, value, new Set(), (held) => held !== value && (util.types.isProxy(held) || resolveWrapper(held) !== null));
}

/**
 * The promises {@link runtime_checkpointSettled} handed out, by the promise a call returned.
 * @type {WeakMap<Promise<*>, Promise<*>>}
 * @private
 */
const SETTLED_CHECKPOINTS = new WeakMap();

/**
 * What a caller is handed for a promise a call returned while a run is open: a promise of the same value, which is
 * saved for the runs open before the caller has it (see {@link runtime_checkpointHandout}), the same one each time for
 * the same promise. A rejection is handed on as it is.
 * @param {object} slothlet - The instance.
 * @param {Promise<*>} promise - The promise.
 * @returns {Promise<*>} The promise the caller is handed.
 * @private
 */
function runtime_checkpointSettled(slothlet, promise) {
	if (!runsOpen(domainOf(slothlet)) || RUN_VIEW_ACCESS !== 0) return promise;
	let handed = WeakMapMethods.get(SETTLED_CHECKPOINTS, promise);
	if (handed === undefined) {
		handed = PromiseMethods.then(promise, (value) => {
			runtime_checkpointHandout(slothlet, value);
			return value;
		});
		WeakMapMethods.set(SETTLED_CHECKPOINTS, promise, handed);
	}
	return handed;
}

/**
 * Before a file's code runs while a run is open: save every node of the file once per window (see
 * `checkpointOnce` in `helpers/run-snapshot`), so a change the code makes to what the file exports through its own
 * variables does not reach the runs open.
 * @param {UnifiedWrapper} wrapper - The leaf about to run.
 * @returns {void}
 * @private
 */
function runtime_checkpointFile(wrapper) {
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
			beforeChange(domain, node, runtime_captureNode);
			// What the file exports as built-ins (a `Map`) and the prototypes of its own its code changes as themselves.
			runtime_checkpointNodeBuiltins(domain, node);
			runtime_checkpointNodePrototypes(domain, node);
		}
	});
}

/**
 * Save a lazy node that has just loaded, and every node and built-in below it, for the runs open (see
 * `helpers/run-snapshot`): a change made through a stand-in for it while it loaded, which is made once it has, then
 * does not reach a run that started before the change.
 * @param {UnifiedWrapper} wrapper - The node that loaded.
 * @returns {void}
 * @private
 */
function runtime_checkpointLoaded(wrapper) {
	const slothlet = wrapper.slothlet;
	const domain = domainOf(slothlet);
	if (!runsOpen(domain)) return;
	const seen = new Set();
	const walk = (node) => {
		if (SetMethods.has(seen, node) || node.slothlet !== slothlet) return;
		SetMethods.add(seen, node);
		const internal = node.____slothletInternal;
		if (internal.invalid || (internal.mode === "lazy" && !internal.state.materialized)) return;
		beforeChange(domain, node, runtime_captureNode);
		runtime_checkpointNodeBuiltins(domain, node);
		runtime_checkpointNodePrototypes(domain, node);
		const keys = Reflect.ownKeys(node);
		for (let index = 0; index < keys.length; index++) {
			if (isFrameworkReservedKey(keys[index])) continue;
			const described = Reflect.getOwnPropertyDescriptor(node, keys[index]);
			const value = described !== undefined && "value" in described ? described.value : undefined;
			if (value === null || (typeof value !== "object" && typeof value !== "function")) continue;
			const child = resolveWrapper(value);
			if (child !== null) walk(child);
		}
	};
	walk(wrapper);
}

/**
 * Save the built-ins a node holds for the runs open (see {@link runtime_checkpointBuiltin}): the one it fronts, the
 * ones it keeps as values of its own (a `Map` a file exports is kept on the file's node as it is), and the ones its
 * value holds. Read by descriptors only.
 * @param {object|null} domain - The instance's domain.
 * @param {UnifiedWrapper} node - The node's wrapper.
 * @returns {void}
 * @private
 */
function runtime_checkpointNodeBuiltins(domain, node) {
	const keys = Reflect.ownKeys(node);
	for (let index = 0; index < keys.length; index++) {
		if (isFrameworkReservedKey(keys[index])) continue;
		const described = Reflect.getOwnPropertyDescriptor(node, keys[index]);
		if (described !== undefined && "value" in described && builtinKind(described.value) !== null)
			runtime_checkpointBuiltin(domain, described.value);
	}
	const impl = node.____slothletInternal.impl;
	if (impl === null || typeof impl !== "object" || util.types.isProxy(impl)) return;
	// A node over a built-in (a `Map` a file exports) holds its entries in the built-in itself.
	if (builtinKind(impl) !== null) runtime_checkpointBuiltin(domain, impl);
	const names = Objects.keys(impl);
	for (let index = 0; index < names.length; index++) {
		const described = Reflect.getOwnPropertyDescriptor(impl, names[index]);
		if (described !== undefined && "value" in described && builtinKind(described.value) !== null)
			runtime_checkpointBuiltin(domain, described.value);
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
function runtime_snapshotBarrier(wrapper) {
	const slothlet = wrapper.slothlet;
	const domain = domainOf(slothlet);
	if (!runsOpen(domain)) return;
	if (runShared.RUN_WRITE !== null && runShared.RUN_WRITE.node === wrapper) return;
	if (slothlet.____buildDepth > 0 || MapMethods.has(FRAMEWORK_WRITES, wrapper) || runtime_inRunTree(wrapper)) return;
	const internal = wrapper.____slothletInternal;
	if (internal.mode === "lazy" && !internal.state.materialized) return;
	// Once per window: later changes in the same window find the node saved already.
	if (!beforeChange(domain, wrapper, runtime_captureNode)) return;
	// A node over a built-in (a `Map`) holds its entries in the built-in, which a method running on it changes as itself.
	const impl = internal.impl;
	if (impl !== null && typeof impl === "object" && !util.types.isProxy(impl) && builtinKind(impl) !== null)
		runtime_checkpointBuiltin(domain, impl);
}

/**
 * Record the prototype a node has, as soon as what the node is, is known: its function's own for a function node, and
 * `Object.prototype` for any other value, as an object slothlet composed has in plain JavaScript. It is kept on the
 * node's own record and replaced with the node's value, so a reload or an add that gives the node a new value gives it
 * that value's prototype. `Object.setPrototypeOf` on the node changes it (see {@link runtime_ownsPrototype}).
 * @param {object} wrapper - The node's wrapper.
 * @returns {void}
 * @private
 */
function runtime_fillPrototype(wrapper) {
	const internal = wrapper.____slothletInternal;
	const impl = internal.impl;
	internal.prototypeOf = impl;
	internal.prototypeGiven = false;
	if (typeof impl !== "function") internal.prototype = impl !== null && typeof impl === "object" ? Objects.prototype : null;
	// A module's own Proxy answers for itself, through its traps, whenever it is asked.
	else internal.prototype = util.types.isProxy(impl) && !isCompositionLayer(impl) ? null : Reflect.getPrototypeOf(impl);
}

/**
 * The prototype on a node's record (see {@link runtime_fillPrototype}), recorded now when the node was handed its value
 * without it (a value put back as it was, or moved from another node). Until the node is given one, the record follows
 * its value: a module that changes its own function's prototype changes what its node has.
 * @param {object} wrapper - The node's wrapper.
 * @returns {object|Function|null} The prototype.
 * @private
 */
function runtime_recordedPrototype(wrapper) {
	const internal = wrapper.____slothletInternal;
	if (internal.prototypeOf !== internal.impl || (!internal.prototypeGiven && typeof internal.impl === "function")) {
		runtime_fillPrototype(wrapper);
	}
	return internal.prototype;
}

/**
 * Whether a node belongs to a tree a run built of its own (see `Slothlet#ownTree`), which is built from the very module
 * values the instance's tree uses: a change the node would make to one of those values is the node's own instead.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {boolean} True for a node of a run's tree.
 * @private
 */
function runtime_inRunTree(wrapper) {
	return (wrapper.____slothletInternal.epoch ?? 0) < 0;
}

/**
 * The arrays a node of a run's tree holds as its own copy of the module's (see {@link runtime_ownRunTreeArray}).
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
function runtime_ownRunTreeArray(wrapper) {
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
 * Whether a node of a run's tree holds a member it was given in the run on its wrapper, over the live value it fronts
 * (a class instance, an emitter): the value is the module's, which the instance's tree fronts too.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {string|symbol} prop - The member.
 * @returns {boolean} True when the node's own member answers.
 * @private
 */
function runtime_runTreeHolds(wrapper, prop) {
	const held = wrapper.____slothletInternal.runHeldKeys;
	return held !== undefined && SetMethods.has(held, prop);
}

/**
 * Record that a node of a run's tree holds a member on its wrapper (see {@link runtime_runTreeHolds}).
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {string|symbol} prop - The member.
 * @returns {void}
 * @private
 */
function runtime_markRunTreeHeld(wrapper, prop) {
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
function runtime_runTreeHides(wrapper, prop) {
	const hidden = wrapper.____slothletInternal.runHiddenKeys;
	return hidden !== undefined && SetMethods.has(hidden, prop) && !hasOwn(wrapper, prop);
}

/**
 * The prototype a node of a run's tree reads a member it removed from (see {@link runtime_runTreeHides}) through.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @returns {object|null} The prototype.
 * @private
 */
function runtime_runTreeHiddenFrom(wrapper) {
	return Reflect.getPrototypeOf(wrapper.____slothletInternal.proxy ?? wrapper);
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
 * @param {boolean} [attribute=true] - Hand what it returns back as the module's too (see {@link runtime_attributeResult}).
 * @param {boolean} [asNode=false] - Run its code as a call of its node, under no ceiling of its caller (#726).
 * @param {object|null} [origin=null] - For a stand-in, the call it was handed to alone (see {@link runtime_originOf}).
 * @returns {*} What it returned.
 * @private
 */
function runtime_runAsMaker(owner, fn, thisArg = undefined, args = [], attribute = true, asNode = false, origin = null) {
	try {
		return runtime_runAsMakerRaw(owner, fn, thisArg, args, attribute, asNode, origin);
	} catch (error) {
		// What the module's code threw is the module's: it is read as the module, wherever it is reported (#599).
		runtime_rememberMadeFailure(owner, error);
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
function runtime_rememberMadeFailure(owner, error) {
	return (
		rememberedFailure(error) ??
		rememberFailure(
			error,
			// Each reader's answer comes back boxed: handed back bare, an error would be examined (and wrapped) as a value
			// the module's code returned.
			failureRecord(
				error,
				(read, value) => runtime_runAsMakerRaw(owner, (target) => ({ value: read(target) }), undefined, [value], false).value
			)
		)
	);
}

/**
 * {@link runtime_runAsMaker} without recording what the code throws: the readers a failure's record runs go through
 * here, so a reader that throws is not itself recorded.
 * @param {object} owner - The wrapper the code runs as.
 * @param {Function} fn - The code.
 * @param {*} [thisArg] - Its receiver.
 * @param {Array<*>} [args=[]] - Its arguments.
 * @param {boolean} [attribute=true] - Hand what it returns back as the module's too.
 * @param {boolean} [asNode=false] - Run its code as a call of its node, under no ceiling of its caller (#726).
 * @param {object|null} [origin=null] - For a stand-in, the call it was handed to alone (see {@link runtime_originOf}).
 * @returns {*} What it returned.
 * @private
 */
function runtime_runAsMakerRaw(owner, fn, thisArg = undefined, args = [], attribute = true, asNode = false, origin = null) {
	const contextManager = owner.slothlet?.contextManager;
	if (!contextManager?.runInContext || !owner.slothlet.instanceID) return Reflect.apply(fn, thisArg, args);
	// An instance that is gone (shut down) has no context to run its code in: the code runs outside every instance, as
	// plain code no instance's api is reachable from — never as whoever happens to be reading.
	const instanceID = runtime_makerInstanceID(owner.slothlet);
	if (instanceID === null) return contextManager.runDetached(fn, thisArg, args);
	// The code's own reads are its own: a reader snapshot being completed for is not passed on into it. A stand-in of a
	// value handed out records its definer and grants nothing: the caller running it, read now, is its ceiling, so every
	// access has to be allowed for both (#726). A node's own code (an accessor or a Proxy export of an api object, `new`
	// on an exported class) is checked as a call of its node, and runs as that call does, under no ceiling of its caller.
	const ceiling = asNode ? null : outerCallerCeiling(contextManager, instanceID, owner.slothlet, origin);
	return runtime_readOnBehalf(undefined, () =>
		contextManager.runInContext(instanceID, fn, thisArg, args, owner, true, false, ceiling, null, attribute, true)
	);
}

/**
 * The leaf of a module whose code is running right now, when it is that module's: what that code writes into a value
 * it was handed is handed out as that leaf's (see {@link runtime_inboundView}). Otherwise the given wrapper.
 * @param {object} maker - The module's record.
 * @param {object} fallback - The wrapper to use otherwise.
 * @returns {object} The wrapper.
 * @private
 */
function runtime_runningLeafOf(maker, fallback) {
	const slothlet = fallback?.slothlet;
	const current = slothlet?.contextManager?.tryGetContext?.(slothlet.instanceID)?.currentWrapper ?? null;
	return current && WeakSetMethods.has(trustedRootOwn.genuineWrappers, current) && runtime_makerOf(current) === maker ? current : fallback;
}

/**
 * Run a call whose permission gate was deferred for a principal resolve (#459), returning its result
 * through the same contract the #253 hook promotion uses.
 *
 * @param {object} wrapper - Target UnifiedWrapper.
 * @param {Promise<void>} gate - The deferred gate from {@link runtime_deferForPrincipals}.
 * @param {function(): *} run - Performs the call once the gate passes (enforcement already done).
 * @returns {Promise<*>} The call's result. A genuinely-async leaf's callers already hold a Promise
 *   contract, so it is returned plainly; a sync leaf's is guarded so value-coercion of the
 *   unawaited Promise throws a named error instead of silently misbehaving.
 * @private
 */
function runtime_runAfterPrincipalGate(wrapper, gate, run) {
	const promoted = PromiseMethods.then(gate, run);
	const impl = wrapper.____slothletInternal.impl;
	const leafIsAsync = util.types.isAsyncFunction(impl) || util.types.isAsyncFunction(impl?.default);
	return leafIsAsync ? promoted : runtime_guardPromotedResult(promoted, wrapper.____slothletInternal.apiPath, wrapper.SlothletError);
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
function runtime_guardPromotedResult(promise, path, SlothletErrorCtor) {
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
 * Run a hooked call whose path has around hooks.
 *
 * @param {object} wrapper - The UnifiedWrapper being invoked.
 * @param {object} hookManager - The instance's HookManager.
 * @param {Array<object>} arounds - Around hooks that fire for this call (already permission-filtered).
 * @param {{asyncBefore: boolean, asyncAfter: boolean, asyncAround: boolean}} strategy - The path's dispatch strategy.
 * @param {*} thisArg - Receiver for the target.
 * @param {Array} callArgs - Arguments the caller passed.
 * @param {object} api - Bound API handed to hooks.
 * @param {object} ctx - User context handed to hooks.
 * @param {{store: object|null, identity: object}|null} [entryIdentity=null] - The caller identity the permission
 *   gate resolved, which the target is entered with (see enforcePermission).
 * @returns {*} The call's result — a plain value on the synchronous pipeline, a Promise on the
 *   asynchronous one (guarded when a synchronous target was promoted).
 * @private
 *
 * @description
 * Pipeline order, outermost first: `always`/`error` observers → around hooks (highest priority
 * outermost) → before hooks → the function → after hooks. The observers sit outside the around
 * chain, so they see exactly what the caller receives: an error an around hook rethrows reaches the
 * error hooks (with the source of wherever it was first thrown), one it swallows does not, and
 * `always` fires once after the chain settles. `suppressErrors` likewise applies to what escapes the
 * chain — inside it, failures propagate through `next()` so an around hook can handle them.
 *
 * The synchronous pipeline is kept when every matching before/after/around handler is synchronous
 * and the target is not declared `async` (and, in lazy mode, is already materialized); otherwise the
 * whole call runs asynchronously, with the same promotion guard as a call promoted by an async
 * before/after hook.
 */
function runtime_runAroundPipeline(wrapper, hookManager, arounds, strategy, thisArg, callArgs, api, ctx, entryIdentity = null) {
	const internal = wrapper.____slothletInternal;
	const path = internal.apiPath;
	const contextManager = wrapper.slothlet.contextManager;
	const instanceID = wrapper.slothlet.instanceID;

	// Who is calling: the same resolution that makes `metadata.caller()` inside the target null —
	// the target's execution store takes its caller from the wrapper active in THIS instance's flow
	// at the moment of the call.
	const callerWrapper = contextManager.getCallerIdentity(instanceID)?.currentWrapper ?? null;
	const entry = !callerWrapper;
	// The same `caller` object a version dispatcher and a permission record get: { path, module, metadata, version }.
	const caller = callerWrapper ? (wrapper.slothlet.handlers.versionManager?.buildCallerArg(callerWrapper) ?? null) : null;

	// Only a pinned (module-registered) around hook runs under a different identity than the call, so
	// only then is the call's own flow captured for its next() to restore.
	const flow = ArrayMethods.some(arounds, (hook) => isCallerLocked(hook.handler)) ? contextManager.captureFlow(instanceID) : null;
	const runInCallerFlow = flow ? (fn) => contextManager.runInFlow(flow, fn) : null;

	// First record wins: an error rethrown by an around hook keeps the source it was first thrown
	// from; an error an around hook throws itself is recorded as an `around` failure. Matched with
	// Object.is, so a rejection value not equal to itself (NaN) still finds its record.
	const sources = [];
	const errorSink = (error, source) => {
		if (!ArrayMethods.some(sources, (entryRecord) => Objects.is(entryRecord.error, error))) listPush(sources, { error, source });
	};
	// The stage to report a rejection nothing recorded as; see AroundChainOptions.onUnobserved.
	let unobserved = null;
	const onUnobserved = (source) => {
		unobserved = source;
	};
	const functionSource = (error) => failureSource({ type: "function", at: wrapper.clock.now() }, runtime_readTargetFailure(wrapper, error));

	const invokeTarget = (targetArgs) => {
		const impl = internal.impl;
		// rawErrors: a leaf's throw is application data — never re-typed (#252).
		if (typeof impl === "function") {
			return contextManager.runInContext(wrapper.instanceID, impl, thisArg, targetArgs, wrapper, true, false, null, entryIdentity, true);
		}
		if (impl && typeof impl === "object" && typeof impl.default === "function") {
			return contextManager.runInContext(
				wrapper.instanceID,
				impl.default,
				impl,
				targetArgs,
				wrapper,
				true,
				false,
				null,
				entryIdentity,
				true
			);
		}
		throw new wrapper.SlothletError("API_PATH_NOT_CALLABLE", { path: segmentsOf(path), received: typeof impl });
	};

	// Observers, run once per call on the way out.
	const settleValue = (value) => {
		hookManager.executeAlwaysHooks(path, callArgs, value, false, [], api, ctx);
		return value;
	};
	const settleError = (error) => {
		// Every rejection is recorded on its way out except one of a thenable no view could be put on (a frozen
		// `then`); that one is the target's, so it is classified as the target before anything reads it (#599).
		const recordedSource = ArrayMethods.find(sources, (record) => Objects.is(record.error, error))?.source;
		const unrecorded = recordedSource === undefined && unobserved ? runtime_readTargetFailure(wrapper, error) : null;
		const originalError = unrecorded ? unrecorded.originalError() : unwrapError(error);
		// A failure an inner hooked call already reported is not reported again (same rule as the
		// pipeline without around hooks); `always` still observes this call.
		if (!isHookProcessed(error)) {
			const recorded = recordedSource ?? failureSource({ ...unobserved }, unrecorded ?? hookManager.failureOf(error));
			hookManager.executeErrorHooks(path, originalError, recorded, callArgs, api, ctx);
		}
		hookManager.executeAlwaysHooks(path, callArgs, undefined, true, [originalError], api, ctx);
		if (wrapper.slothlet.config?.hook?.errors === "suppress") return undefined;
		throw error;
	};

	const leafIsAsync = util.types.isAsyncFunction(internal.impl) || util.types.isAsyncFunction(internal.impl?.default);
	const lazyPending = internal.mode === "lazy" && !internal.state.materialized;
	const promoted = strategy.asyncBefore || strategy.asyncAfter || strategy.asyncAround;
	const options = { caller, entry, errorSink, runInCallerFlow, onUnobserved };

	if (promoted || leafIsAsync || lazyPending) {
		const core = async (coreArgs) => {
			const beforeResult = await hookManager.executeBeforeHooksAsync(path, coreArgs, api, ctx, errorSink);
			if (beforeResult.shortCircuit) return beforeResult.value;
			coreArgs = beforeResult.args;
			let settled;
			try {
				if (internal.mode === "lazy" && !internal.state.materialized) {
					await wrapper.___materialize();
				}
				const raw = invokeTarget(coreArgs);
				settled = raw && typeof raw === "object" && typeof raw.then === "function" ? await raw : raw;
			} catch (error) {
				errorSink(error, functionSource(error));
				throw error;
			}
			const afterResult = await hookManager.executeAfterHooksAsync(path, settled, coreArgs, api, ctx, errorSink);
			return afterResult.modified ? afterResult.result : settled;
		};
		const run = pinnedThen(
			hookManager.executeAroundChain(arounds, path, callArgs, api, ctx, { ...options, core, isAsync: true }),
			settleValue,
			settleError
		);
		// Same contract as a call promoted by an async before/after hook: a target declared `async`
		// already hands its callers a Promise; a promoted synchronous one hands back a guarded one.
		return promoted && !leafIsAsync ? runtime_guardPromotedResult(run, path, wrapper.SlothletError) : run;
	}

	const core = (coreArgs) => {
		const beforeResult = hookManager.executeBeforeHooks(path, coreArgs, api, ctx, errorSink);
		if (beforeResult.shortCircuit) return beforeResult.value;
		coreArgs = beforeResult.args;
		let result;
		try {
			result = invokeTarget(coreArgs);
		} catch (error) {
			errorSink(error, functionSource(error));
			throw error;
		}
		// A plain (not `async`-declared) target returning a Promise: after hooks attach to it, exactly
		// as on the pipeline without around hooks.
		if (result && typeof result === "object" && typeof result.then === "function") {
			const afterReaction = (resolved) => {
				const afterResult = hookManager.executeAfterHooks(path, resolved, coreArgs, api, ctx, errorSink);
				return afterResult.modified ? afterResult.result : resolved;
			};
			const recordAsTarget = (error) => errorSink(error, functionSource(error));
			// A promise of the engine's own is reacted to with the language's `then`, as `await` reacts to it; one of a
			// module's class through its own `then`, as `await` calls it.
			const react = runtime_isEnginePromise(result)
				? FunctionMethods.bind(pinnedThen, null, result)
				: runtime_inherits(result, Promise)
					? FunctionMethods.bind(result.then, result)
					: null;
			if (react !== null) {
				return react(afterReaction, (error) => {
					recordAsTarget(error);
					throw error;
				});
			}
			// A hand-written thenable is reacted to as `await` would, its rejections recorded as the target's however
			// its `then` delivers them (see HookManager#observeThenable).
			return hookManager.observeThenable(result, afterReaction, recordAsTarget, () =>
				onUnobserved({ type: "function", timestamp: wrapper.clock.now() })
			);
		}
		const afterResult = hookManager.executeAfterHooks(path, result, coreArgs, api, ctx, errorSink);
		return afterResult.modified ? afterResult.result : result;
	};

	let value;
	try {
		value = hookManager.executeAroundChain(arounds, path, callArgs, api, ctx, { ...options, core, isAsync: false });
	} catch (error) {
		return settleError(error);
	}
	// The only thenable an around hook may return on this pipeline is one `next()` returned, passed
	// through or derived from (`next().then(check)`); observe it when it settles.
	if (value && typeof value === "object" && typeof value.then === "function") {
		if (runtime_isEnginePromise(value)) return pinnedThen(value, settleValue, settleError);
		return runtime_inherits(value, Promise) ? value.then(settleValue, settleError) : settleThenable(value, settleValue, settleError);
	}
	return settleValue(value);
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
function runtime_readTargetFailure(wrapper, error) {
	return runtime_rememberMadeFailure(wrapper, error);
}

/**
 * Extract the original error from a SlothletError wrapper if present.
 * Hooks should receive the actual error that occurred, not the wrapped SlothletError.
 * @param {Error} error - Error to unwrap
 * @returns {Error} Original error if wrapped, otherwise the error itself
 * @private
 */
function unwrapError(error) {
	// A failure with a record (see runtime_readTargetFailure) is unwrapped through it, as the code it belongs to: its
	// accessors are that code's, and this runs in the caller's flow.
	const read = rememberedFailure(error);
	if (read) return read.originalError();
	return unwrapThrown(error);
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
					runtime_runsNoModuleCode,
					runtime_runsForHander,
					runtime_viewedForHander,
					runShared,
					runtime_runWrite,
					runtime_takeRunWrite,
					runtime_runViewAccessor,
					runtime_wrapOnSet,
					runtime_snapshotPrototype,
					runtime_startPrototypes,
					runtime_checkpointPrototypeHandout,
					runtime_runWriteSinceClosed,
					runtime_runningRecord,
					runtime_checkpointHandout,
					runtime_throughRunView,
					runtime_checkpointSettled,
					runtime_checkpointFile,
					runtime_checkpointLoaded,
					runtime_snapshotBarrier,
					runtime_fillPrototype,
					runtime_recordedPrototype,
					runtime_inRunTree,
					runtime_ownRunTreeArray,
					runtime_runTreeHolds,
					runtime_markRunTreeHeld,
					runtime_runTreeHides,
					runtime_runTreeHiddenFrom,
					runtime_runAsMaker,
					runtime_runningLeafOf,
					runtime_runAfterPrincipalGate,
					runtime_guardPromotedResult,
					runtime_runAroundPipeline,
					runtime_readTargetFailure,
					unwrapError
				});
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					INTRINSICS = methods.values.INTRINSICS;
					runtime_holdsDataKind = methods.values.runtime_holdsDataKind;
					runtime_holdsValue = methods.values.runtime_holdsValue;
					runtime_inherits = methods.values.runtime_inherits;
					runtime_isCarrier = methods.values.runtime_isCarrier;
					runtime_isEnginePromise = methods.values.runtime_isEnginePromise;
					runtime_isSlothletValue = methods.values.runtime_isSlothletValue;
					runtime_ownsPrototype = methods.values.runtime_ownsPrototype;
					runtime_makerInstanceID = methods.nodes.runtime_makerInstanceID;
					runtime_makerOf = methods.nodes.runtime_makerOf;
					runtime_moduleObjectOf = methods.nodes.runtime_moduleObjectOf;
					runtime_nodeOpen = methods.nodes.runtime_nodeOpen;
					runtime_nodeWrapperOf = methods.nodes.runtime_nodeWrapperOf;
					runtime_wrapperClassPrototype = methods.nodes.runtime_wrapperClassPrototype;
					FRAMEWORK_WRITES = methods.rules.FRAMEWORK_WRITES;
					runtime_assertOwnedWrite = methods.rules.runtime_assertOwnedWrite;
					runtime_readOnBehalf = methods.rules.runtime_readOnBehalf;
					runtime_runAccessor = methods.rules.runtime_runAccessor;
					hasOwn = methods.views.hasOwn;
					runtime_carriesHanded = methods.membrane.runtime_carriesHanded;
					searchBudget = methods.membrane.searchBudget;
					searchDepth = methods.membrane.searchDepth;
					runtime_heldValue = methods.root.runtime_heldValue;
					fileNodes = methods.uw.fileNodes;
					outerCallerCeiling = methods.uw.outerCallerCeiling;
					resolveWrapper = methods.uw.resolveWrapper;
					trustedRootOwn = methods.uw.trustedRootOwn;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/run", import.meta.url);
				super(slothlet);
			}
		}
	);
}
