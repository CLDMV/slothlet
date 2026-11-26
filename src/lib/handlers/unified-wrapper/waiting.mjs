/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/waiting.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:05:40-08:00 (1795651540)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Waiting layer of the wrapper: the waiting proxy of a lazy node and the queue of changes made through its stand-ins.
 *
 * Upward services: none; this layer reads only layers below it and the table's own entries.
 * @module @cldmv/slothlet/handlers/unified-wrapper/waiting
 * @internal
 */

import { segmentsOf } from "#helpers/segments";
import { util, scheduleMacrotask } from "#helpers/platform";
import { layerMethodOriginal } from "#helpers/composition";
import { isFrameworkReservedKey } from "#helpers/reserved-keys";
import { combineCeilings, identityCeilings } from "#handlers/trusted-root";
import {
	ArrayMethods,
	Arrays,
	Boolean,
	concatLists,
	copyList,
	filterList,
	FunctionMethods,
	functionToString,
	listPush,
	listSplice,
	Map,
	mapList,
	MapMethods,
	NativeObject,
	NativeProxy,
	Objects,
	Promise,
	PromiseMethods,
	PrototypeFunctions,
	queueMicrotask,
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
	WeakSetMethods
} from "#helpers/intrinsics";
import { pinToCurrentCaller } from "#helpers/caller-pinning";
import { anyRunOpen, builtinCopy, builtinKind, handOutRaw } from "#helpers/run-snapshot";

import { ownBindingsRefusal } from "#helpers/instance-imports";
import { absorbsFrameworkName } from "#handlers/framework-internals";

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 */
let trustedRootOwn,
	hasOwn,
	unwrapSelfView,
	assertOwnedWriteAt,
	takeRunWrite,
	runningRecord,
	checkpointHandout,
	STAND_INS,
	rulesShared,
	viewsShared,
	takeCapturedAccess,
	enforceRead,
	isTerminalData,
	readOnBehalf,
	enforceCodeMember,
	PINNED_CODE_MEMBERS,
	onImpl,
	makerOf,
	hostRunDefiner,
	nodeInCycle,
	capturedView,
	createNamedProxyTarget,
	isAwaitableThen,
	liveThis,
	WAITING_CHAINS,
	isFixedOnTarget,
	canDefine,
	definitionBindsTarget,
	isFixedReadOnly,
	STAND_IN_UNLOADED,
	STAND_IN_OWN_READS,
	withRestartForwarding,
	inspectSafe,
	resolveWrapper,
	nodeBehind,
	registerProxy,
	isWrapper;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/**
 * The changes queued through stand-ins that their loaded node refused, per instance (#653): each fails the next await
 * or call made through a stand-in at or below the node it was made on, once, while that node is the one the change was
 * made on. `holders` are the nodes the change was queued on, from the first to the one that refused it, each with its
 * change generation when its load started: the refusal stands while every one of them is still that node. A reload, a
 * removal, or a shutdown drops the refusals of the nodes it replaces (see {@link dropRefusedChanges}).
 * @type {WeakMap<object, Array<{path: string, error: Error, holders: Array<{owner: object, generation: number}>}>>}
 * @private
 */
const REFUSED_CHANGES = new WeakMap();

/**
 * The wrappers of each instance holding changes queued through stand-ins (#653), so a reload can make or drop them.
 * @type {WeakMap<object, Set<object>>}
 * @private
 */
const PENDING_CHANGES = new WeakMap();

/**
 * The api path of the node a stand-in stands for: its wrapper's path and the chain read below it.
 * @param {object} wrapper - The wrapper the stand-in waits for.
 * @param {Array<string|symbol>} chain - The members read below it.
 * @returns {string} The dotted path.
 * @private
 */
function standInPath(wrapper, chain) {
	return ArrayMethods.join(filterList(concatLists([wrapper.____slothletInternal.apiPath], mapList(chain, String)), Boolean), ".");
}

/**
 * Who made a change through a stand-in, as {@link captureChange} records it and a stand-in's `in` compares it
 * (#653): the module, for module code (any of its functions); the host; or, for code no call accounts for, a value of
 * its own that matches nothing, so such code and the host never see each other's queued members.
 * @param {object|null} identity - The caller identity.
 * @returns {object|string} The author.
 * @private
 */
function changeAuthor(identity) {
	if (identity?.unresolved) return {};
	return identity?.currentWrapper ? makerOf(identity.currentWrapper) : "host";
}

/**
 * The nodes the change being replayed was queued on, while it is handed to the stand-in of a node further down that has
 * not loaded (#653): the change that stand-in queues keeps them (see {@link REFUSED_CHANGES}). Only for that hand-over,
 * which runs no code of a module: a change a getter or setter makes is its own.
 * @type {Array<{owner: object, generation: number}>|null}
 * @private
 */
let replayHolders = null;

/**
 * Keep only the refusals whose nodes are all still the nodes the change was queued on (#653).
 * @param {Array<{path: string, error: Error, holders: Array<{owner: object, generation: number}>}>} refused - The
 *   instance's refusals, pruned in place.
 * @param {object|null} [dropped] - A node whose refusals go too, as it is given another value.
 * @returns {void}
 * @private
 */
function pruneRefusedChanges(refused, dropped = null) {
	const current = filterList(refused, (entry) =>
		ArrayMethods.every(
			entry.holders,
			({ owner, generation }) =>
				owner !== dropped && !owner.____slothletInternal.invalid && owner.____slothletInternal.changeGeneration === generation
		)
	);
	Reflect.apply(ArrayMethods.splice, undefined, concatLists([refused], concatLists([0, refused.length], current)));
}

/**
 * Drop the refusals of changes made on a node (#653), when it is reloaded or removed, and the ones of nodes already
 * replaced: an await of the node that takes its place has nothing to do with them. A refusal another module's node
 * holds below it stays while that node does, as when modules share a mount and one of them reloads.
 * @param {object} wrapper - The node's wrapper.
 * @returns {void}
 * @private
 */
function dropRefusedChanges(wrapper) {
	const refused = WeakMapMethods.get(REFUSED_CHANGES, wrapper.____slothlet);
	if (!refused?.length) return;
	pruneRefusedChanges(refused, wrapper);
}

/**
 * Take the refusal of a queued change made on a node at or above `path`, still current (#653).
 * @param {object} slothlet - The instance.
 * @param {string} path - The api path an await or call goes through.
 * @returns {Error|null} The `LAZY_WRITE_REFUSED` error, or null.
 * @private
 */
function takeRefusalAt(slothlet, path) {
	const refused = WeakMapMethods.get(REFUSED_CHANGES, slothlet);
	if (!refused?.length) return null;
	// A refusal made on a node since replaced (reloaded or removed) is not this node's.
	pruneRefusedChanges(refused);
	const index = ArrayMethods.findIndex(refused, (entry) => path === entry.path || StringMethods.startsWith(path, `${entry.path}.`));
	return index === -1 ? null : listSplice(refused, index, 1)[0].error;
}

/**
 * Take the refusal of a queued change made on a node a stand-in's chain goes through, if there is one (#653).
 * @param {object} wrapper - The wrapper the stand-in waits for.
 * @param {Array<string|symbol>} chain - The stand-in's chain.
 * @returns {Error|null} The `LAZY_WRITE_REFUSED` error, or null.
 * @private
 */
function takeRefusedChange(wrapper, chain) {
	return takeRefusalAt(wrapper.____slothlet, standInPath(wrapper, chain));
}

/**
 * A stand-in for a value a closed object holds fixed, every use of which (a read, call, listing or change made through
 * it) runs a check first, for whoever makes it: what {@link pinnedCodeMember} holds for a closed node's code, and
 * what a closed prototype's handle holds for a private member (see {@link selfMemberView}). The stand-in can be
 * described to anyone; the value behind it is reached only by code the check lets through.
 * @param {Function} check - Throws when the code making the access may not have the value.
 * @param {object|Function} value - The value.
 * @returns {object|Function} The stand-in.
 * @private
 *
 * @example
 * const standIn = checkedStandIn(() => refusePrivate("_hidden"), proto._hidden);
 */
function checkedStandIn(check, value) {
	const checked =
		(trap) =>
		(...args) => {
			check();
			return Reflect.apply(Reflect[trap], undefined, args);
		};
	const handler = {};
	for (
		let ofIndex = 0,
			ofList = [
				"get",
				"set",
				"has",
				"ownKeys",
				"getOwnPropertyDescriptor",
				"defineProperty",
				"deleteProperty",
				"getPrototypeOf",
				"setPrototypeOf",
				"isExtensible",
				"preventExtensions",
				"apply",
				"construct"
			];
		ofIndex < ofList.length;
		ofIndex++
	) {
		const trap = ofList[ofIndex];
		handler[trap] = checked(trap);
	}
	const standIn = new NativeProxy(value, handler);
	WeakMapMethods.set(PINNED_CODE_MEMBERS, standIn, value);
	return standIn;
}

/**
 * Proxy traps used once a wrapper's tree has been replaced by restart() (#504): each forwards the
 * operation to the node at the same path in the live tree, staying within the proxy invariants of the
 * original target (a function target's non-configurable `prototype`, a non-extensible target).
 * @type {Record<string, Function>}
 * @private
 */
const RESTART_FORWARD_TRAPS = {
	get: (live, target, prop) => live[prop],
	set: (live, target, prop, value) => Reflect.set(NativeObject(live), prop, value),
	has: (live, target, prop) => prop in NativeObject(live) || isFixedOnTarget(target, prop),
	deleteProperty: (live, target, prop) => (isFixedOnTarget(target, prop) ? false : Reflect.deleteProperty(NativeObject(live), prop)),
	defineProperty: (live, target, prop, descriptor) => {
		const bindsTarget = definitionBindsTarget(target, NativeObject(live), prop, descriptor);
		// A sealed stale target holds the old shape: a key it holds that the live node does not would carry
		// that shape onto the live node, so it is refused.
		if (!Reflect.isExtensible(target) && Reflect.getOwnPropertyDescriptor(NativeObject(live), prop) === undefined) return false;
		// Both are checked before either changes, and the live node defines first: its own traps may still
		// refuse or throw (a callable `then`, a sealed callable node's accessor), and the stale target then
		// stays as it was. A target that passed the check takes the definition.
		if ((bindsTarget && !canDefine(target, prop, descriptor)) || !canDefine(NativeObject(live), prop, descriptor)) return false;
		if (!Reflect.defineProperty(NativeObject(live), prop, descriptor)) return false;
		if (bindsTarget) Reflect.defineProperty(target, prop, descriptor);
		return true;
	},
	ownKeys: (live, target) => {
		if (!Reflect.isExtensible(target)) return Reflect.ownKeys(target);
		const keys = setFrom(Reflect.ownKeys(NativeObject(live)));
		for (let ofIndex = 0, ofList = Reflect.ownKeys(target); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (isFixedOnTarget(target, key)) SetMethods.add(keys, key);
		}
		return setToArray(keys);
	},
	getOwnPropertyDescriptor: (live, target, prop) => {
		if (isFixedOnTarget(target, prop) || !Reflect.isExtensible(target)) return Reflect.getOwnPropertyDescriptor(target, prop);
		const descriptor = Reflect.getOwnPropertyDescriptor(NativeObject(live), prop);
		return descriptor ? { __proto__: null, ...descriptor, configurable: true } : undefined;
	},
	apply: (live, target, thisArg, args) => Reflect.apply(live, liveThis(thisArg), args),
	construct: (live, target, args, newTarget) => Reflect.construct(live, args, liveThis(newTarget)),
	getPrototypeOf: (live, target) =>
		Reflect.isExtensible(target) ? Reflect.getPrototypeOf(NativeObject(live)) : Reflect.getPrototypeOf(target),
	// A sealed stale target keeps the prototype it reports (proxy invariant); otherwise the live node takes it.
	setPrototypeOf: (live, target, proto) =>
		Reflect.isExtensible(target) ? Reflect.setPrototypeOf(NativeObject(live), proto) : Reflect.getPrototypeOf(target) === proto,
	// Sealing the stale node seals its own target; reflection then answers from that target.
	preventExtensions: (live, target) => Reflect.preventExtensions(target),
	isExtensible: (live, target) => Reflect.isExtensible(target)
};

/**
 * What a stand-in for a chain below a lazy node stands for, once the node has loaded: the chain read off the node now,
 * through each node's own traps, so the read is the one a read of the same path makes (the same reader, the same gates).
 * @param {UnifiedWrapper} wrapper - The lazy node the chain starts at.
 * @param {Array<string>} propChain - The chain below it.
 * @returns {*} What the chain reads as, or {@link STAND_IN_UNLOADED} while the node has not loaded.
 * @throws {SlothletError} PERMISSION_DENIED when the reader may not read what the chain reaches.
 * @private
 */
function standInNode(wrapper, propChain) {
	const internal = wrapper.____slothletInternal;
	if (internal.invalid || !internal.state.materialized) return STAND_IN_UNLOADED;
	let node = wrapper.___createProxy();
	for (let ofIndex = 0, ofList = propChain; ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (node === null || node === undefined) return undefined;
		node = node[key];
	}
	return node;
}

/**
 * A member of what a loaded stand-in stands for, as a read of the member there gives it. A primitive's method is handed
 * out run on the primitive, since the stand-in it is called on cannot be one.
 * @param {*} node - What the stand-in stands for (see {@link standInNode}).
 * @param {string|symbol} prop - The member's key.
 * @returns {*} The member.
 * @private
 */
function standInMember(node, prop) {
	const value = node[prop];
	if (typeof value !== "function" || node === null || typeof node === "object" || typeof node === "function") return value;
	return function standIn_primitiveMethod(...args) {
		return Reflect.apply(value, node, args);
	};
}

/** Whether {@link WaitingLayer} has built its class: it builds one, for the wrapper's chain. @type {boolean} */
let built = false;

/**
 * Close a node the way a stand-in for it was closed (#653): frozen when the stand-in's target reads as frozen, sealed
 * when it reads as sealed, and closed to extension otherwise. The target's own members are fixed so that only a
 * freeze reads as one (see ___createWaitingProxy). The node closes through its own traps, as a node closed directly.
 * @param {object} node - The node.
 * @param {Function} target - The stand-in's target, closed.
 * @returns {void}
 * @throws {TypeError} When the node refuses to close.
 * @private
 */
function lockAsStandIn(node, target) {
	if (Objects.isFrozen(target)) Objects.freeze(node);
	else if (Objects.isSealed(target)) Objects.seal(node);
	else Objects.preventExtensions(node);
}

/**
 * Make a change through a stand-in on the node it stands for (see {@link applyStandInChange}).
 * @param {object} wrapper - The wrapper the stand-in waits for, loaded.
 * @param {{chain: Array<string|symbol>, op: string, prop: string|symbol|null, payload: *}} change - The change.
 * @param {boolean} replayed - Whether the change is replayed after the node loaded.
 * @param {Array<{owner: object, generation: number}>|null} holders - The nodes a replayed change was queued on.
 * @returns {boolean} Whether the node took the change.
 * @throws {TypeError} When the chain does not reach an object (as in eager mode), or a replayed change is refused.
 * @private
 */
function makeStandInChange(wrapper, change, replayed, holders) {
	let node = wrapper.___createProxy();
	for (let ofIndex = 0, ofList = change.chain; ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		node = node[key];
	}
	// The node itself, as a module's change through `self` reaches it, rather than the view the walk hands the module
	// reading: the node's own traps judge the change as the module making it (#625).
	node = nodeBehind(node);
	const { op, prop, payload } = change;
	// A node further down that has not loaded either takes the change once it has: made on it now, the module's own
	// members it adopts as it loads would replace what was written (#653).
	const standIn = WeakSetMethods.has(STAND_INS, node);
	const nodeWrapper = standIn ? null : resolveWrapper(node);
	if (nodeWrapper && nodeWrapper.____slothletInternal.mode === "lazy" && !nodeWrapper.____slothletInternal.state.materialized) {
		replayHolders = holders;
		try {
			nodeWrapper.___queueStandInChange({ chain: [], op, prop, payload });
		} finally {
			replayHolders = null;
		}
		if (!nodeWrapper.____slothletInternal.state.inFlight) PromiseMethods.catch(nodeWrapper.___materialize(), () => {});
		return true;
	}
	// Handed to a stand-in, the change is queued, or made at once through applyStandInChange if its node loaded
	// since: either keeps the holders. Made on the node, it runs the node's code, which hands nothing on.
	if (standIn) replayHolders = holders;
	if (op === "lock") {
		lockAsStandIn(node, payload);
		return true;
	}
	if (replayed) {
		if (op === "set") node[prop] = payload;
		else if (op === "defineProperty") Objects.defineProperty(node, prop, payload);
		else if (op === "deleteProperty") delete node[prop];
		else Objects.setPrototypeOf(node, payload);
		return true;
	}
	if (op === "set") return Reflect.set(node, prop, payload);
	if (op === "defineProperty") return Reflect.defineProperty(node, prop, payload);
	if (op === "deleteProperty") return Reflect.deleteProperty(node, prop);
	return Reflect.setPrototypeOf(node, payload);
}

/**
 * Build this layer of the wrapper class over `Base`, once (see `unified-wrapper.mjs`).
 * @param {Function} Base - The class below this layer.
 * @returns {Function} The layer's class.
 * @internal
 */
export function WaitingLayer(Base) {
	if (built) throw ownBindingsRefusal("lib/handlers/unified-wrapper/waiting", import.meta.url);
	built = true;
	return Base.layer(
		class Waiting extends Base {
			static {
				Base.define("waiting", {
					REFUSED_CHANGES,
					PENDING_CHANGES,
					dropRefusedChanges,
					checkedStandIn,
					RESTART_FORWARD_TRAPS,
					takeRefusedChange
				});
				Base.define("stand", { inPath: standInPath, inNode: standInNode, inMember: standInMember });
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					definitionBindsTarget = methods.values.definitionBindsTarget;
					inspectSafe = methods.inspect.safe;
					isFixedOnTarget = methods.is.fixedOnTarget;
					isFixedReadOnly = methods.is.fixedReadOnly;
					isTerminalData = methods.is.terminalData;
					nodeInCycle = methods.node.inCycle;
					liveThis = methods.nodes.liveThis;
					makerOf = methods.nodes.makerOf;
					nodeBehind = methods.node.behind;
					STAND_IN_UNLOADED = methods.nodes.STAND_IN_UNLOADED;
					WAITING_CHAINS = methods.nodes.WAITING_CHAINS;
					rulesShared = methods.rules.rulesShared;
					assertOwnedWriteAt = methods.rules.assertOwnedWriteAt;
					canDefine = methods.rules.canDefine;
					enforceCodeMember = methods.rules.enforceCodeMember;
					enforceRead = methods.rules.enforceRead;
					hostRunDefiner = methods.rules.hostRunDefiner;
					onImpl = methods.rules.onImpl;
					readOnBehalf = methods.read.onBehalf;
					takeCapturedAccess = methods.rules.takeCapturedAccess;
					withRestartForwarding = methods.rules.withRestartForwarding;
					checkpointHandout = methods.checkpoint.handout;
					runningRecord = methods.run.runningRecord;
					takeRunWrite = methods.run.takeRunWrite;
					hasOwn = methods.has.own;
					PINNED_CODE_MEMBERS = methods.views.PINNED_CODE_MEMBERS;
					capturedView = methods.captured.view;
					unwrapSelfView = methods.views.unwrapSelfView;
					STAND_INS = methods.views.STAND_INS;
					viewsShared = methods.views.viewsShared;
					createNamedProxyTarget = methods.uw.createNamedProxyTarget;
					isAwaitableThen = methods.is.awaitableThen;
					resolveWrapper = methods.uw.resolveWrapper;
					STAND_IN_OWN_READS = methods.uw.STAND_IN_OWN_READS;
					trustedRootOwn = methods.uw.trustedRootOwn;
					registerProxy = methods.values.registerProxy;
					isWrapper = methods.brand.isWrapper;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/waiting", import.meta.url);
				super(slothlet);
			}

			/**
			 * Create recursive waiting proxy for deep lazy loading
			 * Builds property chain (e.g., ["advanced", "calc", "power"]) and waits for all parent
			 * wrappers to materialize before accessing the final property.
			 *
			 * Waiting proxies are ONLY created when not materialized or in-flight.
			 * Once materialized, we return actual cached values, not waiting proxies.
			 * Therefore, waiting proxies always represent in-flight/unmaterialized state.
			 *
			 * CRITICAL: Caches waiting proxies by propChain key to ensure subsequent accesses
			 * return the SAME proxy object, which can then delegate once materialization completes.
			 * This matches v2's propertyProxyCache behavior.
			 *
			 * @private
			 * @param {Array<string|symbol>} [propChain=[]] - Property chain to resolve.
			 * @returns {Proxy} Proxy that waits for materialization before applying calls.
			 */
			___createWaitingProxy(propChain = []) {
				const wrapper = this;

				// Capture the caller context at creation time for read-level permission gating.
				// Chain traversal (e.g. `self.db.secrets.token`) is synchronous inside the calling
				// module's body, so the live store reflects the actual reader here. After the
				// chain returns a waiting proxy, the caller `await`s it from arbitrary code where
				// the caller context may no longer be set, so the live store is unreliable at
				// resolution time. The caller identity and request context are snapshotted into
				// a fresh object: in live runtime the context store is mutated as the stack
				// unwinds, so the store reference itself cannot be held. Null when created
				// outside a module.
				const __readGateStore = wrapper.____slothlet.contextManager?.tryGetContext?.();
				const __liveReadIdentity = __readGateStore ? wrapper.____slothlet.contextManager?.getCallerIdentity?.() : null;
				// A held view reading through this node reads for its reader as well as for whoever is reading (see
				// heldStandInRead): the reader is who the read is made as, and a module reading through it a call the reader's
				// standing has to fit within. A read no one could be found making stays no one's.
				const __heldRead =
					viewsShared.heldStandInRead?.wrapper === wrapper && !__liveReadIdentity?.unresolved && !__liveReadIdentity?.unaccounted
						? viewsShared.heldStandInRead
						: null;
				// Snapshot the reader's caller identity AND its trusted-root status. The store reference itself
				// can't be held (it unwinds after the async boundary), so carry the marker forward on the
				// snapshot — otherwise a host read (whose store is the trusted base store) would be seen by the
				// read gate as an anonymous, untrusted caller and fail closed.
				// Ask the context manager who is reading rather than taking the store's `currentWrapper`. Under the
				// live runtime that field is one slot shared by every in-flight call, so with two calls open at
				// once it can name the other one — and this snapshot is what attributes the read (and, for a
				// reference captured here and invoked later, the call). The manager disambiguates; the raw field
				// does not.
				// A reader that is code supplied to another call keeps that call as its ceiling (#597).
				const __liveReader = __liveReadIdentity?.currentWrapper ?? null;
				const __readGateIdentity = __heldRead
					? {
							currentWrapper: __heldRead.reader,
							ceiling: combineCeilings(
								__heldRead.ceiling,
								__liveReader === __heldRead.reader ? null : __liveReader,
								__liveReader ? (__liveReadIdentity.ceiling ?? null) : null
							)
						}
					: __liveReadIdentity;
				const __readGateCaller =
					__readGateStore || __heldRead
						? {
								currentWrapper: __readGateIdentity?.currentWrapper ?? null,
								ceiling: __readGateIdentity?.ceiling ?? null,
								context: __readGateStore?.context ?? null,
								[trustedRootOwn.TRUSTED_ROOT]: !__heldRead && __readGateStore?.[trustedRootOwn.TRUSTED_ROOT] === true
							}
						: null;

				// Cache key includes the caller's API path so two different modules touching the
				// same unmaterialized path before materialization completes don't share one cached
				// proxy — sharing would pin enforcement (and audit attribution) to whoever read
				// first. External readers (no caller) share a single "::" prefix since the read
				// gate exempts them anyway.
				// A ceiling (#597) is part of who is reading, so a proxy read under one is never shared with one read without.
				const __ceilingKey = ArrayMethods.join(
					mapList(identityCeilings(__readGateCaller), (call) => call.____slothletInternal?.apiPath),
					"^"
				);
				const __callerKey =
					(__readGateCaller?.currentWrapper?.____slothletInternal?.apiPath ?? "") + (__ceilingKey ? `^${__ceilingKey}` : "");
				const cacheKey = `${__callerKey}::${ArrayMethods.join(propChain, ".")}`;

				// Request-context bucketing on top of the cache key: conditional rules
				// (e.g. `condition: { scope: "restricted" }`) evaluate against the snapshotted
				// `context` object. If the same caller touches the same path under two
				// different `context.run({...}, …)` scopes, each scope must get its own
				// proxy — otherwise the second `await` would re-use the first context's
				// snapshot and conditional rules would fire against the wrong context
				// (potential bypass). Buckets keyed by context object via WeakMap so
				// per-request entries are GC'd when the request ends; no-context reads
				// fall through to a plain Map.
				const __readGateContextRef = __readGateStore?.context ?? null;
				const useContextBucket = __readGateContextRef && typeof __readGateContextRef === "object";
				let cache;
				if (useContextBucket) {
					cache = WeakMapMethods.get(wrapper.____slothletInternal.waitingProxyCacheByContext, __readGateContextRef);
					if (!cache) {
						cache = new Map();
						WeakMapMethods.set(wrapper.____slothletInternal.waitingProxyCacheByContext, __readGateContextRef, cache);
					}
				} else {
					cache = wrapper.____slothletInternal.waitingProxyCache;
				}

				// Return cached waiting proxy if it exists in the selected bucket
				if (MapMethods.has(cache, cacheKey)) {
					return MapMethods.get(cache, cacheKey);
				}

				// Waiting proxies always use function target since they represent unknown/in-flight values
				// Native typeof will always return "function" - use slothlet.node(target).type for actual state
				const waitingTarget = createNamedProxyTarget(`${wrapper.____slothletInternal.apiPath}_waitingProxy`, "waitingProxyTarget");
				// Its `name` is writable, as a bound function's `length` and `name` are not, so that only a freeze makes the target
				// read as frozen: a seal or a preventExtensions leaves it as it was (#653, see lockAsStandIn).
				Reflect.defineProperty(waitingTarget, "name", { __proto__: null, writable: true });
				// Note: wrapper lookup is via the proxy registry (registerProxy below) - do NOT attach ____slothletInternal
				// as an own property on waitingTarget; that was the attack vector we closed in step 2.

				// A change through the stand-in is a change at the path it stands for (#625, #653): judged at once, by the rule a
				// loaded node applies, then made on the node through its own traps — at once when it has loaded, and as it loads,
				// as whoever made it, when it has not (see replayStandInChanges).
				const nodePath = () => standInPath(wrapper, propChain);
				const assertChange = (prop) => {
					const parts = filterList(splitText(nodePath(), "."), Boolean);
					if (typeof prop === "string") listPush(parts, prop);
					assertOwnedWriteAt(wrapper, parts);
				};
				// What the code reading now (its module, or the host) last did to `prop` through a stand-in for this node while it
				// has not loaded: the member it assigned or defined, as a descriptor, or null when it deleted it or did neither. Only
				// its own changes: another module's queued value is that module's, read through the node's gates once it loads.
				const queuedMember = (prop) => {
					const pending = wrapper.____slothletInternal.pendingChanges;
					if (!pending) return null;
					const reader = changeAuthor(wrapper.____slothlet.contextManager.getCallerIdentity(wrapper.____slothlet.instanceID));
					let member = null;
					for (let i = 0; i < pending.length; i++) {
						const change = pending[i];
						if (change.prop !== prop || change.by !== reader) continue;
						if (change.chain.length !== propChain.length || ArrayMethods.some(change.chain, (key, index) => key !== propChain[index]))
							continue;
						if (change.op === "set")
							member = { __proto__: null, value: change.payload, writable: true, enumerable: true, configurable: true };
						else if (change.op === "defineProperty") {
							const { get, set, value, writable, enumerable } = change.payload;
							member =
								"get" in change.payload || "set" in change.payload
									? { __proto__: null, get, set, enumerable: enumerable === true, configurable: true }
									: { __proto__: null, value, writable: writable === true, enumerable: enumerable === true, configurable: true };
						} else if (change.op === "deleteProperty") member = null;
					}
					return member;
				};
				const changeThroughStandIn = (op, prop, payload) => {
					assertChange(prop);
					// A full-isolation run's `self` changing a node that has not loaded yet (see runWrite): checked as above,
					// and kept in the run's own record instead of being made on the node as it loads.
					const runSink = takeRunWrite(wrapper, op === "setPrototypeOf" ? null : prop);
					if (runSink !== null) {
						if (op === "set") return runSink({ op: "set", value: unwrapSelfView(payload) });
						if (op === "defineProperty") return runSink({ op: "define", descriptor: payload });
						if (op === "deleteProperty") return runSink({ op: "delete" });
						return runSink({ op: "prototype", prototype: payload });
					}
					// An object written through the stand-in is data, as one written to the loaded node is (#826).
					if (op === "set") wrapper.___markAssignedData(unwrapSelfView(payload));
					else if (op === "defineProperty" && "value" in payload) wrapper.___markAssignedData(unwrapSelfView(payload.value));
					const change = { chain: copyList(propChain), op, prop, payload };
					if (wrapper.____slothletInternal.state.materialized) return wrapper.___applyStandInChange(change, false, replayHolders);
					wrapper.___queueStandInChange(change);
					return true;
				};
				const waitingHandler = {
					set(target, prop, value) {
						// A stand-in frozen (below) takes no write, as a frozen object takes none: the node will be frozen too.
						if (Objects.isFrozen(target)) return false;
						// A callable `then` would make the node awaitable (#571): refused at once, as a loaded node refuses it.
						if (prop === "then" && isAwaitableThen({ value })) {
							throw new wrapper.____SlothletError("API_MEMBER_THEN_RESERVED", { path: segmentsOf(nodePath()) });
						}
						// A member defined fixed through the stand-in (below) takes no write, on the stand-in or the node.
						if (isFixedReadOnly(target, prop)) {
							assertChange(prop);
							return false;
						}
						return changeThroughStandIn("set", prop, value);
					},
					defineProperty(target, prop, descriptor) {
						// A name with the framework's prefix is absorbed as the node's own definition absorbs it (see absorbsFrameworkName).
						const absorbed = absorbsFrameworkName(target, prop, descriptor);
						if (absorbed !== undefined) return absorbed;
						// A callable `then` would make the node awaitable (#571): refused at once and first, as a loaded node refuses it.
						if (prop === "then" && isAwaitableThen(descriptor)) {
							throw new wrapper.____SlothletError("API_MEMBER_THEN_RESERVED", { path: segmentsOf(nodePath()) });
						}
						if (!Reflect.isExtensible(target)) {
							// Freezing or sealing the stand-in fixes the members its target holds (its own `name` and `length`) once it
							// is closed. Those are the stand-in's, not the node's, which is closed the same way when it loads.
							if (hasOwn(target, prop)) return Reflect.defineProperty(target, prop, descriptor);
							// A stand-in closed to extension may not report a member it does not hold.
							return false;
						}
						// A member defined fixed is fixed on the stand-in too, which may not report one its target does not hold; one
						// already fixed there refuses a definition it cannot take, before anything is queued.
						if (descriptor.configurable === false || Reflect.getOwnPropertyDescriptor(target, prop)?.configurable === false) {
							assertChange(prop);
							if (!Reflect.defineProperty(target, prop, descriptor)) return false;
						}
						return changeThroughStandIn("defineProperty", prop, { ...descriptor });
					},
					deleteProperty(target, prop) {
						// What the stand-in holds fixed it keeps, as the proxy invariants require; the node keeps it too.
						if (Reflect.getOwnPropertyDescriptor(target, prop)?.configurable === false) {
							assertChange(prop);
							return false;
						}
						return changeThroughStandIn("deleteProperty", prop);
					},
					setPrototypeOf(target, proto) {
						// A stand-in closed to extension keeps the prototype it reports, as a closed object does.
						if (!Reflect.isExtensible(target)) return Reflect.setPrototypeOf(target, proto);
						return changeThroughStandIn("setPrototypeOf", null, proto);
					},
					preventExtensions(target) {
						assertChange(null);
						// Freeze, seal, and preventExtensions all reach a proxy as this one operation, then define its members. The
						// stand-in is closed as the engine closes it, and the node is closed the same way after the changes made
						// before it: what the stand-in's target reads as once the operation is done (see lockAsStandIn).
						if (Reflect.isExtensible(target)) {
							const change = { chain: copyList(propChain), op: "lock", prop: null, payload: target };
							if (wrapper.____slothletInternal.state.materialized) {
								const queued = wrapper.___captureChange(change);
								const generation = wrapper.____slothletInternal.changeGeneration;
								// Pinned as the scheduler patch pins it: this runs on the host's queueMicrotask as it was when slothlet loaded.
								queueMicrotask(pinToCurrentCaller(() => wrapper.___makeQueuedChange(queued, generation)));
							} else wrapper.___queueStandInChange(change);
						}
						// The stand-in reports no prototype; closed, its target must hold the one it reports (proxy invariant).
						Reflect.setPrototypeOf(target, null);
						return Reflect.preventExtensions(target);
					},
					// A member the stand-in's reader assigned or defined through it, and has not deleted since, is there to that
					// reader as it would be on the node (#653). What the module will export is not known until it loads.
					// Once the node has loaded, what the stand-in stands for answers, within what the stand-in's own target fixes.
					has(target, prop) {
						const node = Reflect.isExtensible(target) ? standInNode(wrapper, propChain) : STAND_IN_UNLOADED;
						if (node !== STAND_IN_UNLOADED && node !== null && node !== undefined) return RESTART_FORWARD_TRAPS.has(node, target, prop);
						return queuedMember(prop) ? true : Reflect.has(target, prop);
					},
					getOwnPropertyDescriptor(target, prop) {
						const node = Reflect.isExtensible(target) ? standInNode(wrapper, propChain) : STAND_IN_UNLOADED;
						if (node !== STAND_IN_UNLOADED && node !== null && node !== undefined) {
							return RESTART_FORWARD_TRAPS.getOwnPropertyDescriptor(node, target, prop);
						}
						const queued = Reflect.isExtensible(target) && !hasOwn(target, prop) ? queuedMember(prop) : null;
						return queued ?? Reflect.getOwnPropertyDescriptor(target, prop);
					},
					ownKeys(target) {
						const node = Reflect.isExtensible(target) ? standInNode(wrapper, propChain) : STAND_IN_UNLOADED;
						if (node !== STAND_IN_UNLOADED && node !== null && node !== undefined) return RESTART_FORWARD_TRAPS.ownKeys(node, target);
						return Reflect.ownKeys(target);
					},
					get(___target, prop) {
						// A stand-in is no node of its own: a kept node's access offered to it is dropped, before any code its
						// read runs (a getter of the node it stands for) could take it (#661). A kept node reading through it says
						// who it reads for to the one check of running a getter of the node it stands for (see runAccessor).
						takeCapturedAccess(wrapper);
						const kept = viewsShared.standInKeptRead?.standIn === wrapper ? viewsShared.standInKeptRead : null;
						viewsShared.standInKeptRead = null;
						// A member defined fixed through the stand-in reads as defined (proxy invariant), as it does on the node.
						const fixed = Reflect.getOwnPropertyDescriptor(waitingTarget, prop);
						if (fixed && !fixed.configurable && "value" in fixed && !fixed.writable) return fixed.value;
						if (prop === "then") {
							// Make waiting proxies thenable so `await lg[0]` resolves after materialization
							// This enables seamless consumer access to custom proxy properties (e.g., array indices)
							// without requiring manual ___materialize() calls or setTimeout hacks
							return (onFulfilled, onRejected) => {
								// Read for a run: what the read settles with is handed to it as the run is handed a value it reads
								// (see helpers/run-snapshot), not as the instance holds it now.
								const runSnap = anyRunOpen() ? (runningRecord(wrapper.____slothlet)?.snap ?? null) : null;
								const waitingProxy_thenResolve = async () => {
									// Ensure materialization completes
									if (!wrapper.____slothletInternal.state.materialized) {
										await wrapper.___materialize();
									}

									// Walk propChain through wrapper/impl to resolve the value
									let current = wrapper;
									// Tracks the last parent/prop traversed into a child wrapper, so the
									// post-loop return of that wrapper's impl can be read-gated correctly.
									let __gateParent = null;
									let __gateProp = null;
									// Resolve the remaining chain below a value that has no wrapper to route through — an
									// adopted non-wrapper child, or an impl member that was never adopted. Plain property
									// access hop by hop; segments beyond a nullish hop resolve to undefined, exactly as raw
									// member access would. A function node's members that are not adopted — its own
									// `prototype`, a static method, a member defined non-enumerable on it — are such hops
									// (`await fn.prototype.method`, #632).
									const __descendRest = (startValue, nextIndex) => {
										let descended = startValue;
										for (let __di = nextIndex; __di < propChain.length; __di++) {
											if (descended === null || descended === undefined) return undefined;
											descended = descended[propChain[__di]];
										}
										return descended;
									};
									for (let __chainIndex = 0; __chainIndex < propChain.length; __chainIndex++) {
										const chainProp = propChain[__chainIndex];
										// `current` is always the raw wrapper initially and only reassigned to `_childW` when truthy; it can never become falsy during the loop.
										/* v8 ignore next */
										if (!current) return undefined;

										// If current wrapper's ____impl is a custom proxy, delegate remaining chain
										if (
											current.____slothletInternal.impl &&
											typeof current.____slothletInternal.impl === "object" &&
											util.types.isProxy(current.____slothletInternal.impl)
										) {
											// Delegate this chainProp and all remaining to custom proxy. The first read runs the module's
											// trap, read for the reader the chain was read by as a call of the node, as getTrap reads it (#632).
											let result = readOnBehalf(__readGateCaller ?? null, () => {
												const read = current.___readImplMember(chainProp);
												enforceCodeMember(current, layerMethodOriginal(read) ?? read);
												return read;
											});
											for (let i = __chainIndex + 1; i < propChain.length; i++) {
												if (result === null || result === undefined) return undefined;
												result = result[propChain[i]];
											}
											return result;
										}

										// Check wrapper children first
										const isInternal = isFrameworkReservedKey(chainProp);
										if (!isInternal && hasOwn(current, chainProp)) {
											// A getter the node holds runs for the reader the chain was read by (#597).
											const child = readOnBehalf(__readGateCaller ?? null, () => current[chainProp]);
											const _childW = resolveWrapper(child);
											if (_childW) {
												__gateParent = current;
												__gateProp = chainProp;
												current = _childW;
												// Ensure child is materialized too
												if (current.____slothletInternal.mode === "lazy" && !current.____slothletInternal.state.materialized) {
													await current.___materialize();
												}
												continue;
											}
											// A chain continuing below a non-wrapper child must descend, not return the member. Every
											// enumerable member is adopted as a wrapper, so the suite builds no non-wrapper child to drive this arm.
											/* v8 ignore start */
											if (__chainIndex < propChain.length - 1) {
												const descendedChild = __descendRest(child, __chainIndex + 1);
												if (descendedChild !== undefined) {
													enforceRead(current, ArrayMethods.join(copyList(propChain, __chainIndex), "."), descendedChild, __readGateCaller);
												}
												return descendedChild;
											}
											/* v8 ignore stop */
											// Lazy read-level permission gating — parity with getTrap.
											enforceRead(current, chainProp, child, __readGateCaller);
											return child;
										}

										// Check ____impl properties
										const implValue = current.____slothletInternal.impl
											? readOnBehalf(__readGateCaller ?? null, () => current.____slothletInternal.impl[chainProp])
											: undefined;
										// A function member that is this node's own function or an ancestor's is that node, as the get
										// trap reads it: the chain goes on from there.
										const __cycleNode = nodeInCycle(current, implValue);
										if (__cycleNode !== null) {
											__gateParent = current;
											__gateProp = chainProp;
											current = __cycleNode;
											continue;
										}
										if (implValue !== undefined) {
											// An impl member holding the module's code — a static method, a function's `prototype` — is
											// read for the reader the chain was read by as a call of the node, as getTrap reads it (#632).
											// Checked before descending, so nothing reached through it escapes the check.
											readOnBehalf(__readGateCaller ?? null, () => enforceCodeMember(current, implValue));
											// Same chain-consumption rule as the child arm above: an impl member mid-chain is a
											// waypoint, not the destination. A function's own `prototype`, or a member the module
											// defined on its function, is one (`await fn.prototype.method`).
											if (__chainIndex < propChain.length - 1) {
												const descendedImpl = __descendRest(implValue, __chainIndex + 1);
												if (descendedImpl !== undefined) {
													enforceRead(current, ArrayMethods.join(copyList(propChain, __chainIndex), "."), descendedImpl, __readGateCaller);
												}
												return descendedImpl;
											}
											// Lazy read-level permission gating — this path reads impl directly,
											// bypassing getTrap, so the gate must be applied explicitly here.
											enforceRead(current, chainProp, implValue, __readGateCaller);
											return implValue;
										}

										return undefined;
									}

									// If we get here with no propChain consumed, return the impl itself — to the host. A module gets the
									// node, as it does once the node has loaded: the Proxy's traps are its module's code, which a read
									// through the node checks as a call of the node, and a read of the Proxy itself would not (#632).
									if (
										current.____slothletInternal.impl &&
										typeof current.____slothletInternal.impl === "object" &&
										util.types.isProxy(current.____slothletInternal.impl) &&
										!(__readGateCaller?.currentWrapper && wrapper.____slothlet.handlers?.permissionManager?.isEnabled())
									) {
										return current.____slothletInternal.impl;
									}
									// The propChain resolved entirely through child wrappers — the final
									// wrapper's impl is the terminal value. Gate it against the last
									// parent/prop traversed (a primitive-backed child wrapper lands here).
									// __gateParent is always set here: reaching this point means the loop
									// traversed at least one child wrapper. The guard covers only the
									// structurally-unreachable empty-propChain case.
									/* v8 ignore next */
									if (__gateParent) {
										enforceRead(__gateParent, __gateProp, current.____slothletInternal.impl, __readGateCaller);
									}
									const finalImpl = current.____slothletInternal.impl;
									// A chain ending on a namespace or plain-object node must NOT resolve to the impl:
									// materialization adopts its members onto the wrapper and deletes them from `____impl`, so the
									// impl here is the depleted leftover and every first await of such a chain read as a
									// permanently-empty object (#255). Resolve to the wrapper's live proxy instead — the same
									// object eager hands back and later lazy accesses return — so members, read gating, and
									// identity stay attached. Terminal data (primitives and the built-ins the read gate
									// classifies), arrays (transparent data leaves, never depleted), and callables keep
									// resolving to the value itself.
									// The same argument applies to a CALLABLE node that carries members its impl does not.
									// A file+directory collision merges the losing folder's members onto the surviving
									// WRAPPER (api-assignment.mjs mergeOffSlotCollisionFolder), and adoption moves children
									// there too, so resolving such a chain to the bare callable drops every one of them:
									// `await api.pair.dlog` came back with `Object.keys()` empty and `dlog.only` undefined,
									// while the same node reached stepwise — or under eager — carried both. A plain callable
									// leaf has no such members and still resolves to the function itself, so identity is
									// unchanged for everything except the shape that was losing data.
									const callableCarriesWrapperMembers =
										typeof finalImpl === "function" &&
										ArrayMethods.some(Objects.keys(current), (key) => !isFrameworkReservedKey(key) && !Objects.hasOwn(finalImpl, key));
									// A module awaiting a callable node gets the node, as it does once the node has loaded, and never the
									// function behind it: that function carries no gate, so calling it would skip the node's call check
									// (#632). The host, which no rule gates, still gets the function itself.
									const __permissionManager = wrapper.____slothlet.handlers?.permissionManager;
									const callableReadByModule =
										typeof finalImpl === "function" &&
										Boolean(__readGateCaller?.currentWrapper) &&
										__permissionManager?.isEnabled() === true;
									if (
										callableCarriesWrapperMembers ||
										callableReadByModule ||
										(finalImpl !== null && typeof finalImpl === "object" && !Arrays.isArray(finalImpl) && !isTerminalData(finalImpl))
									) {
										const resolvedProxy = current.____slothletInternal.proxy;
										// A module's captured floor has to survive the resolution: the snapshot taken when the
										// chain was read is the only record of who is holding this reference, and without the
										// per-reader view a later read through it would arrive caller-less and be treated as
										// host-initiated — the borrowed-authority hole capture binding exists to close. Same
										// gates as bindCapturedIdentity: nothing to enforce without a permission
										// manager, and the capture escape hatch is honoured.
										const __capturedReader = __readGateCaller?.currentWrapper ?? null;
										const __pm = wrapper.____slothlet.handlers?.permissionManager;
										if (__capturedReader && __pm && __pm.isEnabled() && __pm.isCaptureEnabled?.() !== false) {
											return capturedView(resolvedProxy, __capturedReader, true, __readGateCaller.ceiling ?? null);
										}
										return resolvedProxy;
									}
									return finalImpl;
								};

								// A change queued through a stand-in that the node it reached refused fails this await (#653).
								// The chain is handed back, so a `then` called with one callback leaves the rejection to the promise it
								// returns, as a promise's own `then` does, instead of losing it.
								return PromiseMethods.then(
									PromiseMethods.then(waitingProxy_thenResolve(), (value) => {
										const refused = takeRefusedChange(wrapper, propChain);
										if (refused) throw refused;
										return runSnap === null || resolveWrapper(value) !== null ? value : handOutRaw(runSnap, value);
									}),
									onFulfilled,
									onRejected
								);
							};
						}
						if (prop === "____slothletInternal") return undefined; // blocked: do not expose internal state through waiting proxy
						if (prop === "___materialize") return FunctionMethods.bind(wrapper.___materialize, wrapper);
						// Note: ____impl is NOT exposed through the waiting proxy - use resolveWrapper(proxy).____impl internally.

						// Once the node has loaded, a stand-in kept from before answers as what it stands for answers a read of its
						// path now: a default-export Map's methods, an object's members, a string's characters.
						if (!SetMethods.has(STAND_IN_OWN_READS, prop)) {
							const node = standInNode(wrapper, propChain);
							if (node !== STAND_IN_UNLOADED && node !== null && node !== undefined) {
								const end = kept ? resolveWrapper(node) : null;
								if (!end) return standInMember(node, prop);
								// A kept stand-in reads for the module that kept it: the read of the node says so to the node's own
								// check, as a kept node's read does, so code the read runs (a getter) cannot make it anyone else's (#661).
								return end.___accessAsKept(kept.reader, () => standInMember(node, prop));
							}
						}

						// Trigger materialization if needed (fire-and-forget)
						// This ensures lazy wrappers start loading when accessed
						if (
							wrapper.____slothletInternal.mode === "lazy" &&
							!wrapper.____slothletInternal.state.materialized &&
							!wrapper.____slothletInternal.state.inFlight
						) {
							// Silently catch errors — callers that explicitly await ___materialize() will
							// observe the rejection; this fire-and-forget path must never produce an
							// unhandled rejection (e.g. collision mode "error" during background trigger).
							// Rejection handler is intentionally empty — errors are surfaced via the explicit-await path.
							/* v8 ignore next */
							PromiseMethods.catch(wrapper.___materialize(), () => {});
						}

						if (prop === util.inspect.custom) {
							// Custom inspect for console.log
							// If in flight, return waiting proxy target
							if (wrapper.____slothletInternal.state.inFlight) {
								return waitingTarget;
							}
							// If unmaterialized, return waiting proxy target
							// util.inspect.custom is invoked post-materialization in tests; the unmaterialized guard never fires.
							/* v8 ignore start */
							if (!wrapper.____slothletInternal.state.materialized) {
								return waitingTarget;
							}
							/* v8 ignore stop */
							// Check if property exists after materialization
							// impl is always non-null when state.materialized is true; missing-impl is a structurally impossible state.
							/* v8 ignore next */
							if (wrapper.____slothletInternal.impl) {
								// The chain is read through the node, as each of its reads is gated, and what it resolves to is shown as
								// the node's hook shows a value: never as the module's runnable code to a module (#632).
								let current = wrapper.____slothletInternal.proxy;
								for (let ofIndex = 0, ofList = propChain; ofIndex < ofList.length; ofIndex++) {
									const chainProp = ofList[ofIndex];
									if (current === null || current === undefined) return undefined;
									current = current[chainProp];
								}
								return inspectSafe(current, [], wrapper.___inspectReaderIsModule(), wrapper.____slothlet);
							}
							// `impl` is always non-null when `state.materialized` is true; `materialized=true && !impl` is a structurally impossible state.
							/* v8 ignore next */
							return waitingTarget;
						}
						if (typeof prop === "symbol") return undefined;
						if (prop === "length") {
							// For waiting proxies in lazy mode, we can't know the length until materialized
							// Return 0 as a placeholder - the actual length will be available after materialization
							return 0;
						}
						// waitingTarget.name is always the non-empty api-path based string; the || fallback is unreachable.
						/* v8 ignore next */
						if (prop === "name") return waitingTarget.name || "waitingProxyTarget";
						if (prop === "toString") {
							// For waiting proxies, we can't access impl yet, so use target
							return FunctionMethods.bind(functionToString, waitingTarget);
						}
						if (prop === "valueOf") {
							// For waiting proxies, we can't access impl yet, so use target
							return FunctionMethods.bind(PrototypeFunctions.Object.valueOf, waitingTarget);
						}
						// prop === "toJSON" is never accessed on a lazy unmaterialized property-chain proxy in tests.
						/* v8 ignore start */
						if (prop === "toJSON") {
							// Called by JSON.stringify / util.inspect / pretty-format to serialize objects.
							// Waiting proxies don't have an impl yet, so return undefined (treated as non-serializable).
							return () => undefined;
						}
						/* v8 ignore stop */
						// CRITICAL: Check if wrapper.____slothletInternal.impl is already set
						// This allows property access once ____impl is populated (matches v2 behavior)
						// Lifecycle events, metadata, and ownership may still be in progress
						// This handles custom proxy behavior like array access on devices proxy
						// Custom proxies return plain objects/values that should NOT be wrapped
						if (
							wrapper.____slothletInternal.impl !== null &&
							wrapper.____slothletInternal.impl !== undefined &&
							typeof wrapper.____slothletInternal.impl === "object" &&
							util.types.isProxy(wrapper.____slothletInternal.impl)
						) {
							// Direct delegation to custom proxy
							// Traverse propChain through the custom proxy first
							let result = wrapper.____slothletInternal.impl;
							for (let ofIndex = 0, ofList = propChain; ofIndex < ofList.length; ofIndex++) {
								const chainProp = ofList[ofIndex];
								result = result[chainProp];
							}
							// Then access the requested prop on the result
							return result[prop];
						}

						// CRITICAL: After materialization OR if ____impl is set, resolve through property chain
						// Check ____impl FIRST (not just _state.materialized) to match v2 behavior where
						// once state.materialized variable was set, values were returned synchronously
						// This allows waiting proxies to resolve immediately once ____impl is available,
						// even if _state.inFlight is still true (materialization finishing up)
						if (wrapper.____slothletInternal.impl !== null && wrapper.____slothletInternal.impl !== undefined) {
							// Start from the parent wrapper and traverse using wrapper properties
							let current = wrapper;
							let remainingChain = copyList(propChain);

							// Traverse propChain through wrapper properties until we hit a custom proxy
							for (let i = 0; i < propChain.length; i++) {
								const chainProp = propChain[i];

								// If current wrapper has a custom proxy, delegate remaining chain to it
								if (
									current.____slothletInternal.impl &&
									typeof current.____slothletInternal.impl === "object" &&
									util.types.isProxy(current.____slothletInternal.impl)
								) {
									// Traverse remaining propChain through the custom proxy, as the module it belongs to (#597)
									return onImpl(current, (impl) => {
										let proxyResult = impl;
										for (let ofIndex = 0, ofList = remainingChain; ofIndex < ofList.length; ofIndex++) {
											const remainingProp = ofList[ofIndex];
											proxyResult = proxyResult[remainingProp];
										}

										// Now access the final prop on the result
										return proxyResult[prop];
									});
								}

								const isInternal = isFrameworkReservedKey(chainProp);
								// Own members only, like every other chain-walk site: `current` is a raw wrapper, so
								// `in` would keep walking into the framework's prototype. A prototype hit here was
								// only ever saved by resolveWrapper() returning null below — rely on the same
								// own-only rule instead of that mitigation.
								if (!isInternal && current && hasOwn(current, chainProp)) {
									const cached = current[chainProp];

									// Get the wrapper from cached proxy
									const _cachedW2 = resolveWrapper(cached);
									// Cached chain items are always wrappers; the non-wrapper else path is unreachable.
									/* v8 ignore start */
									if (_cachedW2) {
										current = _cachedW2;
										ArrayMethods.shift(remainingChain); // Remove this prop from remaining chain
									} else {
										// Cached value is not a wrapper (primitive or unwrapped object)
										return undefined;
									}
									/* v8 ignore stop */
								} else {
									// Property doesn't exist in property chain
									return undefined;
								}
							}

							// CRITICAL: If current wrapper's ____impl is a custom proxy, delegate property access to it
							// Custom proxies handle their own property access (array indices, computed properties, etc.)
							if (
								current &&
								current.____slothletInternal.impl &&
								typeof current.____slothletInternal.impl === "object" &&
								util.types.isProxy(current.____slothletInternal.impl)
							) {
								// A module's own Proxy answers as that module (#597).
								return current.___readImplMember(prop);
							}

							// Now check if the final prop exists in the resolved wrapper.
							// Exact reserved names, not an underscore prefix — a module's own `_x` export resolves
							// here like any member. Own members only: `current` is structurally a raw wrapper (it
							// starts as `wrapper` and the walk only ever reassigns it to a truthy resolveWrapper()
							// result — the non-wrapper arm returns undefined above), and a wrapper's prototype is
							// the framework's, which `in` would wrongly reach into.
							const isFinalInternal = isFrameworkReservedKey(prop);
							if (!isFinalInternal && hasOwn(current, prop)) {
								if (!kept) return current[prop];
								const previous = rulesShared.keptAccessorRead;
								rulesShared.keptAccessorRead = { wrapper: current, reader: kept.reader };
								try {
									return current[prop];
								} finally {
									rulesShared.keptAccessorRead = previous;
								}
							}

							// Property doesn't exist
							return undefined;
						}

						// CRITICAL FIX: Before materialization, check if prop exists in wrapper
						// This handles collision-merged file properties that are added to wrapper BEFORE materialization
						// For lazy folders in merge mode, file properties are attached to wrapper during collision handling
						// These properties should be accessible immediately without waiting for full materialization
						const isInternal = isFrameworkReservedKey(prop);
						if (!isInternal && hasOwn(wrapper, prop)) {
							wrapper.____slothlet.debug("wrapper", {
								key: "DEBUG_MODE_WAITING_GET_PREMATURE",
								apiPath: wrapper.____slothletInternal.apiPath,
								prop
							});
							return wrapper[prop];
						}

						// CRITICAL FIX #2: For collision-merged lazy folders, trigger materialization immediately
						// This ensures folder children are available on wrapper before returning
						// Without this, folder properties remain as waiting proxies instead of being accessible
						// needsImmediateChildAdoption is only ever set inside an already-annotated v8-ignored code
						// path in api-assignment.mjs, so this branch can never fire in tests.
						/* v8 ignore start */
						if (
							wrapper.____slothletInternal.needsImmediateChildAdoption &&
							wrapper.____slothletInternal.materializeFunc &&
							!wrapper.____slothletInternal.state.materialized &&
							!wrapper.____slothletInternal.state.inFlight
						) {
							wrapper.____slothlet.debug("wrapper", {
								key: "DEBUG_MODE_WAITING_GET_IMMEDIATE_MAT",
								apiPath: wrapper.____slothletInternal.apiPath,
								prop
							});
							// Trigger materialization NOW (async but we'll check after)
							PromiseMethods.catch(wrapper.___materialize(), (err) => {
								wrapper.____slothlet.debug("wrapper", {
									key: "DEBUG_MODE_WAITING_GET_IMMEDIATE_MAT_ERROR",
									apiPath: wrapper.apiPath,
									error: err.message
								});
							});
							// Now check if prop is in wrapper after materialization started
							// ___adoptImplChildren runs synchronously within ___materialize before any awaits
							const isInternal = isFrameworkReservedKey(prop);
							if (!isInternal && hasOwn(wrapper, prop)) {
								wrapper.____slothlet.debug("wrapper", {
									key: "DEBUG_MODE_WAITING_GET_IMMEDIATE_MAT_SUCCESS",
									apiPath: wrapper.____slothletInternal.apiPath,
									prop
								});
								return wrapper[prop];
							}
						}
						/* v8 ignore stop */

						// If materialization is in flight but not complete, return waiting proxy
						if (wrapper.____slothletInternal.state.inFlight) {
							// Materialization started but not complete yet
							// Return waiting proxy to allow chaining, but slothlet.node(target).type reports IN_FLIGHT
							return wrapper.___createWaitingProxy(concatLists(propChain, [prop]));
						}

						// Not yet materialized and not in flight - create waiting proxy that will trigger materialization
						return wrapper.___createWaitingProxy(concatLists(propChain, [prop]));
					},

					// `invoke` runs the chain's end once it has loaded: a call, or `new` from the construct trap below (#685).
					async apply(___target, ___thisArg, args, invoke = (fn, self) => Reflect.apply(fn, self, args)) {
						// As get: a kept node's access offered to a stand-in is dropped first (#661).
						takeCapturedAccess(wrapper);
						// Called from a run: a built-in the chain ends on is the run's own copy of it (see helpers/run-snapshot).
						const ___runSnap = anyRunOpen() ? (runningRecord(wrapper.____slothlet)?.snap ?? null) : null;
						// Capture caller context synchronously before any await.
						// In LAZY_LIVE mode, the outer runInContext's finally block restores
						// context before this Promise settles, losing caller identity.
						// Capturing here (synchronous part of async fn) preserves it for
						// permission enforcement in the target's applyTrap.
						// Falls back to the reader snapshotted when this proxy was created. The capture above runs at
						// invocation, which is enough when a module calls the chain itself, but a reference read into
						// a variable can be invoked later from a boundary that carries no caller at all — a scheduler
						// slothlet did not patch, or one in another realm. The creation-time reader is the identity of
						// whoever took the reference, and it is the only thing left to attribute the call to. The
						// proxy cache is keyed by that reader, so a snapshot is never shared across modules.
						// Scoped to this instance, as every other identity read is (#592): with another instance in flight
						// an unscoped read could answer for that one.
						const ___liveIdentity = wrapper.____slothlet.contextManager?.getCallerIdentity?.(wrapper.____instanceID);
						const ___liveCallerWrapper = ___liveIdentity?.currentWrapper ?? null;
						// The call the invoking code ran inside, when that code was supplied to it (#597); travels with the
						// identity reinstated below so it is enforced there too.
						const ___liveCeiling = ___liveCallerWrapper ? (___liveIdentity?.ceiling ?? null) : null;
						// The store the call was made in — a `run()` / `scope()` store of this instance when the call
						// came from inside one — so a deferred host invocation keeps that flow's context.
						const ___invocationStoreID =
							wrapper.____slothlet.contextManager?.tryGetContext?.(wrapper.____instanceID)?.instanceID ?? wrapper.____instanceID;
						const ___capture = wrapper.____slothlet.handlers?.permissionManager?.isCaptureEnabled() !== false;
						const ___creationCallerWrapper = ___capture ? (__readGateCaller?.currentWrapper ?? null) : null;
						const ___creationCeiling = ___creationCallerWrapper ? (__readGateCaller?.ceiling ?? null) : null;
						// Code a module handed out, run while no call runs or no call accounts for it, makes the call as its definer,
						// told by its frames, as its `self` read was (#726). With `references.capture` off only the live caller counts.
						const ___definerRead = {};
						const ___capturedCallerWrapper =
							___liveCallerWrapper ??
							___creationCallerWrapper ??
							(___capture ? hostRunDefiner(wrapper.____slothlet, true, ___definerRead) : null);
						// A node read by such code and called later by it: the code making the call is read now, while its frames are
						// on the stack, as the gate reads them when the call is made at once (eager mode, or a loaded node). The
						// modules further out on the stack, and every other module importing a helper whose code it is, are held to
						// as well; deciding after the load, with those frames gone, would drop them (#691).
						const ___callingCode =
							!___liveCallerWrapper && ___creationCallerWrapper && ___capture
								? hostRunDefiner(wrapper.____slothlet, true, ___definerRead)
								: null;
						const ___capturedCeiling = ___liveCallerWrapper
							? ___liveCeiling
							: ___creationCallerWrapper
								? combineCeilings(
										___creationCeiling,
										___definerRead.ceiling ?? null,
										___callingCode && ___callingCode !== ___creationCallerWrapper ? ___callingCode : null
									)
								: (___definerRead.ceiling ?? null);
						// A caller the live runtime cannot determine is refused now, as the node's own gate refuses it (#726): calls
						// in flight it cannot tell apart, or code it cannot place. Only code no call accounts for, settled by the
						// node's reader or the code's definer, goes on. Run after the load instead, the call would be gated on
						// whoever the runtime finds then, the host once the other calls have settled.
						if (
							___liveIdentity?.unresolved &&
							(!___liveIdentity.unaccounted || !___capturedCallerWrapper) &&
							wrapper.____slothlet.handlers?.permissionManager?.isEnabled?.()
						) {
							const ___deniedPath = ArrayMethods.join(
								filterList(concatLists([wrapper.____slothletInternal.apiPath], mapList(propChain, String)), Boolean),
								"."
							);
							throw new wrapper.____slothlet.SlothletError("PERMISSION_DENIED", { caller: null, target: segmentsOf(___deniedPath) });
						}

						wrapper.____slothlet.debug("wrapper", {
							key: "DEBUG_MODE_WAITING_APPLY_ENTRY",
							apiPath: wrapper.____slothletInternal.apiPath,
							propChain: ArrayMethods.join(propChain, ","),
							// The count only: joining would convert each argument, running the caller's own
							// toString / Symbol.toPrimitive before the leaf sees it, and throws for a Symbol.
							argCount: args.length
						});
						const chain = mapList(propChain, (prop) => String(prop));
						const chainPath = wrapper.____slothletInternal.apiPath ? splitText(wrapper.____slothletInternal.apiPath, ".") : [];

						if (
							wrapper.____slothletInternal.mode === "lazy" &&
							!wrapper.____slothletInternal.state.materialized &&
							!wrapper.____slothletInternal.state.inFlight
						) {
							wrapper.____slothlet.debug("wrapper", {
								key: "DEBUG_MODE_WAITING_APPLY_MATERIALIZE",
								apiPath: wrapper.____slothletInternal.apiPath
							});
							await wrapper.___materialize();
							wrapper.____slothlet.debug("wrapper", {
								key: "DEBUG_MODE_WAITING_APPLY_MATERIALIZED",
								apiPath: wrapper.____slothletInternal.apiPath
							});
						} else if (
							wrapper.____slothletInternal.mode === "lazy" &&
							!wrapper.____slothletInternal.state.materialized &&
							wrapper.____slothletInternal.state.inFlight
						) {
							// Materialization already in-flight (triggered by the get trap).
							// We MUST await the existing materialization promise before walking the chain.
							// materializationPromise is always set when inFlight=true; the else branch is an unreachable defensive fallback.
							/* v8 ignore next */
							if (wrapper.____slothletInternal.materializationPromise) {
								await wrapper.____slothletInternal.materializationPromise;
								// materializationPromise is always present when inFlight=true; the else path is an unreachable defensive fallback.
								/* v8 ignore start */
							} else {
								// No promise but inFlight - spin until materialized or error
								await wrapper.___materialize();
							}
							/* v8 ignore stop */
						}

						wrapper.____slothlet.debug("wrapper", {
							key: "DEBUG_MODE_WAITING_APPLY_START_WALK",
							apiPath: wrapper.____slothletInternal.apiPath,
							propChain: ArrayMethods.join(propChain, ",")
						});
						let current = wrapper.___createProxy();
						let lastWrapper = wrapper;
						let lastObject = null; // Track the parent object for `this` binding

						for (let ofIndex = 0, ofList = propChain; ofIndex < ofList.length; ofIndex++) {
							const prop = ofList[ofIndex];
							wrapper.____slothlet.debug("wrapper", {
								key: "DEBUG_MODE_WAITING_APPLY_WALK",
								prop: String(prop),
								typeOf: typeof current,
								constructorName: current?.constructor?.name
							});
							if (!current) {
								// PRIORITY 1: If the chain involves ANY symbol access (like util.inspect.custom), silently return undefined
								// Check the entire propChain, not just what we've iterated so far
								// This prevents errors during Node.js inspection operations, regardless of wrapper state
								// ___createWaitingProxy joins propChain with "," so Symbol props can never be passed in; this if is unreachable via the API.
								/* v8 ignore start */
								if (ArrayMethods.some(propChain, (p) => typeof p === "symbol")) {
									return undefined;
								}
								/* v8 ignore stop */
								// PRIORITY 2: Check if root wrapper or last tracked wrapper was invalidated/deleted during async materialization
								// This happens when api.remove() is called while lazy wrappers are still materializing
								// Requires a concurrent api.remove() to fire during propChain walk (race condition); not reproducible in tests.
								/* v8 ignore start */
								if (
									wrapper.____slothletInternal.invalid ||
									wrapper.____slothletInternal.impl === null ||
									(lastWrapper && (lastWrapper.____invalid || lastWrapper.____impl === null))
								) {
									return undefined;
								}
								/* v8 ignore stop */
								// PRIORITY 3: If we're trying to access hasAttribute, toJSON, or other inspect/serialization
								// properties on undefined, return undefined instead of throwing - this happens when
								// Node.js util.inspect, JSON.stringify, or Vitest's pretty-format probes every object property.
								const finalProp = propChain[propChain.length - 1];
								if (
									finalProp === "hasAttribute" ||
									finalProp === "toJSON" ||
									finalProp === Symbol.toStringTag ||
									finalProp === "constructor" ||
									typeof finalProp === "symbol" ||
									typeof prop === "symbol"
								) {
									return undefined;
								}
								throw new wrapper.____slothlet.SlothletError("CHAIN_ACCESS_UNDEFINED", {
									path: chainPath,
									chain,
									prop: String(prop)
								});
							}

							const currentWrapper = resolveWrapper(current);
							// currentWrapper is always truthy when current resolved from a valid wrapper; the falsy-wrapper else path is unreachable.
							/* v8 ignore next */
							if (currentWrapper) {
								const state = currentWrapper.____slothletInternal.state;
								if (!state.materialized) {
									// ___materialize() is always callable and inFlight is always false here; the else path is dead.
									/* v8 ignore next 3 */
									if (!state.inFlight && typeof current.___materialize === "function") {
										await current.___materialize();
									}
									// While body only runs if ___materialize() doesn't synchronously set materialized;
									// in all tests it completes before the while condition re-evaluates.
									/* v8 ignore start */
									while (!currentWrapper.____slothletInternal.state.materialized) {
										const nextState = currentWrapper.____slothletInternal.state;
										if (!nextState.inFlight && !nextState.materialized) {
											throw new wrapper.____slothlet.SlothletError("CHAIN_MATERIALIZE_FAILED", {
												path: chainPath,
												chain,
												prop: String(prop)
											});
										}
										await new Promise((resolve) => scheduleMacrotask(resolve, undefined, wrapper.____clock));
									}
									/* v8 ignore stop */
								}
							}

							// current and currentWrapper are always truthy at this point; the false branch is dead.
							/* v8 ignore next */
							if (currentWrapper) {
								lastWrapper = currentWrapper; // Track the wrapper we're accessing
								const isInternal = isFrameworkReservedKey(prop);
								// Own members only — see the type-walk note: `in` would reach the wrapper prototype's
								// private methods, which the exact reserved set deliberately does not name.
								if (!isInternal && hasOwn(currentWrapper, prop)) {
									lastObject = current; // Track parent before moving to next property
									current = currentWrapper[prop];
									continue;
								}
								// Check if ____impl is an object before using 'in' operator
								if (
									currentWrapper.____slothletInternal.impl &&
									typeof currentWrapper.____slothletInternal.impl === "object" &&
									currentWrapper.____slothletInternal.impl !== null &&
									onImpl(currentWrapper, (impl) => prop in impl)
								) {
									lastObject = currentWrapper.____slothletInternal.impl; // Track parent object
									// A built-in whose method the chain is about to call on it as itself is saved first for the runs open, as
									// one handed out as itself is (see helpers/run-snapshot).
									if (anyRunOpen() && typeof lastObject === "object" && builtinKind(lastObject) !== null)
										checkpointHandout(wrapper.____slothlet, lastObject);
									// An accessor or a Proxy of the module's runs as that module (#597).
									current = currentWrapper.___readImplMember(prop);
									// A built-in handed out as itself is saved first for the runs open (see helpers/run-snapshot).
									if (anyRunOpen() && current !== null && typeof current === "object" && builtinKind(current) !== null)
										checkpointHandout(wrapper.____slothlet, current);
									continue;
								}
							}

							lastObject = current; // Track parent before moving to next property
							current = current[prop];
						}

						// A change queued through a stand-in that the node it reached refused fails this call (#653).
						const refusedChange = takeRefusedChange(wrapper, propChain);
						if (refusedChange) throw refusedChange;

						wrapper.____slothlet.debug("wrapper", {
							key: "DEBUG_MODE_WAITING_APPLY",
							apiPath: wrapper.____slothletInternal.apiPath,
							propChain: ArrayMethods.join(propChain, ","),
							typeOf: typeof current,
							currentName: current?.name,
							isFunction: typeof current === "function"
						});

						// A method of a built-in called from a run runs on the run's own copy of the built-in, as it would through the run's
						// view of the node.
						if (
							___runSnap !== null &&
							!___runSnap.closed &&
							lastObject !== null &&
							typeof lastObject === "object" &&
							builtinKind(lastObject) !== null
						)
							lastObject = builtinCopy(___runSnap, lastObject);
						if (typeof current === "function") {
							// A function the walk reached as a member of a node rather than as a node of its own — a static method, a
							// method of a function's `prototype` — carries no gate of its own: running it is a call of the last node
							// the walk passed through, checked as the call runs, under the caller the call is made for (#632).
							const ___memberOf = resolveWrapper(current) === null ? lastWrapper : null;
							const ___invokeChainEnd = ___memberOf
								? (fn, self) => {
										enforceCodeMember(___memberOf, fn);
										return invoke(fn, self);
									}
								: invoke;
							// Both the module that captured this chain and the one invoking it have to pass. The live
							// caller is enforced by the resolved leaf's own applyTrap below; the capturer is enforced
							// here, because by then it is no longer anywhere in the flow. Without this a module could
							// have work it is denied carried out for it by a permitted module it hands the reference
							// to — and eager composition, where the captured view enforces both, would disagree.
							// A reader that took the chain as code supplied to another call keeps that call as a ceiling (#597),
							// which is enforced here too even when the same module invokes it later on its own account.
							if (
								___creationCallerWrapper &&
								(___creationCallerWrapper !== ___capturedCallerWrapper || (___creationCeiling && ___creationCeiling !== ___capturedCeiling))
							) {
								const ___resolvedInner = resolveWrapper(current);
								// The join fallback covers a resolved chain end that is not itself a wrapper, so it carries no
								// apiPath of its own. A lazy chain resolves to a wrapper in every shape the suite builds.
								/* v8 ignore next 3 */
								const ___targetPath =
									___resolvedInner?.____slothletInternal?.apiPath ??
									ArrayMethods.join(filterList(concatLists([wrapper.____slothletInternal.apiPath], propChain), Boolean), ".");
								// Lazy captured chain: thread the resolved leaf's call args for resource-scoped conditions (#455).
								// This apply is already async, so a stale principal (#459) is simply awaited here.
								const ___principalGate = wrapper.___enforceCapturedPair(
									___creationCallerWrapper,
									___creationCeiling,
									___targetPath,
									args,
									true
								);
								if (___principalGate) await ___principalGate;
							}

							// Call with proper `this` binding - use lastObject as `this` if available
							// This preserves `this` binding for methods called on objects
							// Use Reflect.apply to avoid accessing .apply property on proxy (which triggers another trap)

							// LAZY_LIVE context restoration: after the async boundary the live
							// context stack has already unwound (runInContext.finally restored state).
							// Use the captured caller + runInContext (with the explicit instanceID)
							// to re-establish context properly. This is multi-instance safe because
							// runInContext looks up the store by instanceID, not currentInstanceID.
							if (___capturedCallerWrapper && wrapper.____slothlet.contextManager) {
								const ___instanceStore =
									wrapper.____slothlet.contextManager.instances instanceof Map
										? MapMethods.get(wrapper.____slothlet.contextManager.instances, wrapper.____instanceID)
										: undefined;
								// False path (store missing or currentWrapper already set) only occurs in
								// re-entrant scenarios that are not exercised by the test suite.
								/* v8 ignore next */
								if (___instanceStore && !___instanceStore.currentWrapper) {
									// rawErrors: a leaf's own throw is application data — it must reach the caller
									// unchanged (an async leaf's rejection already does; #252).
									return wrapper.____slothlet.contextManager.runInContext(
										wrapper.____instanceID,
										() => ___invokeChainEnd(current, lastObject),
										null,
										[],
										___capturedCallerWrapper,
										true,
										false,
										___capturedCeiling
									);
								}
							}
							// Context could not be re-established (the slot is occupied by another in-flight
							// call), but the caller captured above was resolved while its own frame was still
							// on the stack — which it will not be by the time the target's applyTrap runs.
							// Publish it as authoritative for the duration of that synchronous invocation so
							// enforcement uses the reliable answer instead of re-deriving a degraded one.
							// The host made the call (nothing was captured at invocation). Under the live runtime the
							// deferred invocation runs as the host, rather than leaving the target's apply trap to
							// guess — with one call suspended meanwhile, it would be attributed to that call (#595).
							// An identity that was unresolved at invocation is not the host's, and is not handed its standing.
							if (
								!___capturedCallerWrapper &&
								!___liveIdentity?.unresolved &&
								typeof wrapper.____slothlet.contextManager?.runRegisteredAsHost === "function"
							) {
								return wrapper.____slothlet.contextManager.runRegisteredAsHost(
									___invocationStoreID,
									() => ___invokeChainEnd(current, lastObject),
									null,
									[]
								);
							}
							const ___identityStore = ___capturedCallerWrapper
								? wrapper.____slothlet.contextManager?.instances instanceof Map
									? MapMethods.get(wrapper.____slothlet.contextManager.instances, wrapper.____instanceID)
									: undefined
								: null;
							if (!___identityStore) return ___invokeChainEnd(current, lastObject);
							const ___previousAuthoritative = ___identityStore.__authoritativeWrapper;
							const ___previousAuthoritativeCeiling = ___identityStore.__authoritativeCeiling;
							___identityStore.__authoritativeWrapper = ___capturedCallerWrapper;
							___identityStore.__authoritativeCeiling = ___capturedCeiling;
							try {
								return ___invokeChainEnd(current, lastObject);
							} finally {
								___identityStore.__authoritativeWrapper = ___previousAuthoritative;
								___identityStore.__authoritativeCeiling = ___previousAuthoritativeCeiling;
							}
						}

						// Handle serialization/inspection sentinel properties on non-function chain ends.
						// util.inspect, JSON.stringify, and Vitest's pretty-format call these on every object;
						// returning undefined rather than throwing avoids unhandled rejections when wrappers
						// don't implement these methods (e.g., lazy interop subdirectory after reload).
						const _finalChainProp = propChain[propChain.length - 1];
						// hasAttribute/toJSON are never the final chain prop in any test scenario; this guard is never triggered.
						/* v8 ignore start */
						if (_finalChainProp === "hasAttribute" || _finalChainProp === "toJSON") {
							return undefined;
						}
						/* v8 ignore stop */

						// If current is undefined/null after traversing the chain, throw an error
						// The property doesn't exist after materialization
						if (current === undefined || current === null) {
							throw new wrapper.____slothlet.SlothletError("CHAIN_NOT_CALLABLE", {
								path: chainPath,
								chain
							});
						}

						throw new wrapper.____slothlet.SlothletError("CHAIN_NOT_CALLABLE", {
							path: chainPath,
							chain
						});
					},
					// `new` before the chain loads: an instance of what it stands for, once loaded, as a lazy node's own construction
					// in flight answers (#685). The engine's default would read `prototype` through the stand-in.
					construct(target, args, newTarget) {
						// A subclass's `super()` has to finish now, which nothing not yet loaded can.
						if (newTarget !== waitingProxy) {
							const apiPath = ArrayMethods.join(
								filterList(concatLists([wrapper.____slothletInternal.apiPath], mapList(propChain, String)), Boolean),
								"."
							);
							throw new wrapper.____SlothletError("LAZY_SUBCLASS_BEFORE_LOAD", { path: segmentsOf(apiPath) });
						}
						return waitingHandler.apply(target, undefined, args, (fn) => Reflect.construct(fn, args, fn));
					},
					getPrototypeOf(target) {
						const node = Reflect.isExtensible(target) ? standInNode(wrapper, propChain) : STAND_IN_UNLOADED;
						if (node !== STAND_IN_UNLOADED && node !== null && node !== undefined)
							return RESTART_FORWARD_TRAPS.getPrototypeOf(node, target);
						return null;
					}
				};
				// Once a restart() replaces this wrapper's tree, the waiting proxy forwards to the live tree too (#504).
				const waitingProxy = new NativeProxy(waitingTarget, withRestartForwarding(waitingHandler, wrapper, propChain));

				// Register waiting proxy in the global registry so resolveWrapper() can find the
				// root wrapper from it - mirrors the old .____slothletInternal.wrapper path that
				// worked on waiting proxies before step 2 blocked the property on regular proxies.
				registerProxy(waitingProxy, wrapper);
				WeakMapMethods.set(WAITING_CHAINS, waitingProxy, propChain);
				WeakSetMethods.add(STAND_INS, waitingProxy);

				// Cache the waiting proxy so subsequent accesses return the same proxy object
				MapMethods.set(cache, cacheKey, waitingProxy);

				return waitingProxy;
			}

			/**
			 * Make a change through a stand-in on the node it stands for, through the node's own traps, as the same change made on
			 * the node itself would be (#653). The chain is read from the wrapper the stand-in waits for, so a node further down
			 * that has not loaded either hands out its own stand-in, which queues the change in turn.
			 *
			 * Made as it is asked for, the change answers as a trap does (`false` when the node refuses it). Replayed once the node
			 * has loaded, nothing is left to answer to, so a refusal throws, as the same change does in strict-mode code.
			 * @param {object} wrapper - The wrapper the stand-in waits for, loaded.
			 * @param {{chain: Array<string|symbol>, op: string, prop: string|symbol|null, payload: *}} change - The change.
			 * @param {boolean} replayed - Whether the change is replayed after the node loaded.
			 * @returns {boolean} Whether the node took the change.
			 * @throws {TypeError} When the chain does not reach an object (as in eager mode), or a replayed change is refused.
			 * @private
			 */
			___applyStandInChange(change, replayed, holders = null) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/waiting", import.meta.url);
				const wrapper = this;

				// No code the walk or the change runs (a getter, a setter, a trap of the module's) hands a change on as this one.
				const outer = replayHolders;
				replayHolders = null;
				try {
					return makeStandInChange(wrapper, change, replayed, holders);
				} finally {
					replayHolders = outer;
				}
			}

			/**
			 * A change made through a stand-in, with who made it: it is made as them later, whoever's access leads to it (#653).
			 * Code no call accounts for is made as the host, which hands it no module's standing: what it writes counts as handed
			 * to the node's module (#597).
			 * @param {object} wrapper - The wrapper the stand-in waits for.
			 * @param {{chain: Array<string|symbol>, op: string, prop: string|symbol|null, payload: *}} change - The change.
			 * @returns {object} The change, with its writer and the writer's ceiling.
			 * @private
			 */
			___captureChange(change) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/waiting", import.meta.url);
				const wrapper = this;
				const { contextManager, instanceID } = wrapper.____slothlet;
				const identity = contextManager.getCallerIdentity(instanceID);
				const writer = identity?.unresolved ? null : (identity?.currentWrapper ?? null);
				// The flow it was made in goes with it, so a setter it runs reads that flow's context, not the loader's.
				const flow = contextManager.snapshotFlow(instanceID);
				return { ...change, writer, ceiling: writer ? (identity.ceiling ?? null) : null, flow, by: changeAuthor(identity) };
			}

			/**
			 * Make a change captured through a stand-in, on its node, as the code that made it (#653). One the node refuses is
			 * reported twice, so that it is never lost: a warning names it at once (unless the instance is silent), and the next
			 * await or call through that node rejects with `LAZY_WRITE_REFUSED` (see {@link takeRefusedChange}).
			 * @param {object} wrapper - The wrapper the stand-in waits for, loaded.
			 * @param {object} change - The change, as {@link captureChange} returned it.
			 * @param {number} generation - The node's change generation when the load making the change started.
			 * @returns {void}
			 * @private
			 */
			___makeQueuedChange(change, generation) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/waiting", import.meta.url);
				const wrapper = this;
				const { contextManager, instanceID } = wrapper.____slothlet;
				// A change moved down from a node above keeps the nodes it was queued on before: one replaced while it loaded
				// makes the refusal no longer anyone's.
				const holders = concatLists(change.holders ?? [], [{ owner: wrapper, generation }]);
				const make = () =>
					contextManager.runInContext(
						instanceID,
						() => wrapper.___applyStandInChange(change, true, holders),
						null,
						[],
						change.writer,
						true,
						change.writer === null,
						change.ceiling
					);
				try {
					if (change.flow) contextManager.runInSnapshotFlowSync(instanceID, change.flow, make);
					else make();
				} catch (error) {
					const apiPath = standInPath(wrapper, change.chain);
					const operation = change.op === "lock" ? "preventExtensions" : change.op;
					new wrapper.____SlothletWarning("WARNING_LAZY_WRITE_REFUSED", { path: segmentsOf(apiPath), operation }, { cause: error });
					const refused = new wrapper.____SlothletError("LAZY_WRITE_REFUSED", { path: segmentsOf(apiPath), operation }, { cause: error });
					if (!WeakMapMethods.has(REFUSED_CHANGES, wrapper.____slothlet)) WeakMapMethods.set(REFUSED_CHANGES, wrapper.____slothlet, []);
					// Recorded for the nodes the loads were for: one replaced while it loaded (reloaded, or rebuilt away) does not
					// hand the refusal to the node that took its place.
					listPush(WeakMapMethods.get(REFUSED_CHANGES, wrapper.____slothlet), { path: apiPath, error: refused, holders });
				}
			}

			/**
			 * Queue a change made through a stand-in whose node has not loaded, with who made it: it is made as them once the node
			 * loads (see {@link replayStandInChanges}), whoever loads it (#653). Code no call accounts for is made as the
			 * host, which hands it no module's standing: what it writes counts as handed to the node's module (#597).
			 * @param {object} wrapper - The wrapper the stand-in waits for.
			 * @param {{chain: Array<string|symbol>, op: string, prop: string|symbol|null, payload: *}} change - The change.
			 * @returns {void}
			 * @private
			 */
			___queueStandInChange(change) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/waiting", import.meta.url);
				const wrapper = this;
				if (!wrapper.____slothletInternal.pendingChanges) wrapper.____slothletInternal.pendingChanges = [];
				const captured = wrapper.___captureChange(change);
				// A replayed change that moves down to a node further down keeps the nodes it was queued on before.
				if (replayHolders) captured.holders = replayHolders;
				listPush(wrapper.____slothletInternal.pendingChanges, captured);
				if (!WeakMapMethods.has(PENDING_CHANGES, wrapper.____slothlet))
					WeakMapMethods.set(PENDING_CHANGES, wrapper.____slothlet, new Set());
				SetMethods.add(WeakMapMethods.get(PENDING_CHANGES, wrapper.____slothlet), wrapper);
			}

			/**
			 * Retire the refusals of a node a reload rebuilt away, and of the loaded nodes below it (#653): the node built in
			 * its place is another, so a refusal a load of the old one records later is not its own.
			 * @param {object} wrapper - The replaced node's wrapper.
			 * @param {Set<object>} [seen] - Wrappers already retired.
			 * @returns {void}
			 * @private
			 */
			___retireChanges(seen = new Set()) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/waiting", import.meta.url);
				const wrapper = this;
				if (SetMethods.has(seen, wrapper)) return;
				SetMethods.add(seen, wrapper);
				wrapper.____slothletInternal.changeGeneration++;
				dropRefusedChanges(wrapper);
				for (let ofIndex = 0, ofList = Objects.keys(wrapper); ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					const child = resolveWrapper(wrapper[key]);
					if (child) child.___retireChanges(seen);
				}
			}
		}
	);
}
