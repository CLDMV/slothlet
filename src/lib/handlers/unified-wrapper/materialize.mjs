/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/materialize.mjs
 *	@Date: 2026-11-25T00:00:00-08:00 (1795593600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:05:39-08:00 (1795651539)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Materialize layer of the wrapper: implementation cloning and extraction, lazy materialization, adoption of a module's members and child wrappers.
 *
 * Upward services: none; this layer reads only layers below it and the table's own entries.
 * @module @cldmv/slothlet/handlers/unified-wrapper/materialize
 * @internal
 */

import { util, EventEmitter } from "#helpers/platform";
import {
	copyForComposition,
	isCompositionLayer,
	layerHeldKeys,
	layerMethodOriginal,
	layerUnderlying,
	layerOnto,
	holdMember
} from "#helpers/composition";
import { isFrameworkName, isFrameworkReservedKey } from "#helpers/reserved-keys";
import {
	ArrayMethods,
	Arrays,
	Boolean,
	concatLists,
	copyList,
	filterList,
	Map,
	MapMethods,
	NativeProxy,
	Objects,
	Reflect,
	Set,
	setFrom,
	SetMethods,
	splitText,
	String,
	WeakMap,
	WeakMapMethods,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
import { anyRunOpen, domainOf, runsOpen, beforeChange } from "#helpers/run-snapshot";

import { ownBindingsRefusal } from "#helpers/instance-imports";
import { isFrameworkInternal, isFrameworkMarkerKey } from "#handlers/framework-internals";

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 */
let trustedRootOwn,
	registerLeafFile,
	hasOwn,
	frameworkWrite,
	inherits,
	isErrorValue,
	dataKind,
	snapshotBarrier,
	PENDING_CHANGES,
	dropRefusedChanges,
	ASSIGNED_DATA,
	holdsAssignedData,
	ADOPTED_ACCESSORS,
	fillPrototype,
	RECONSTRUCTED_FROM,
	moduleObjectFor,
	originalAccessor,
	isModuleProxy,
	makerOf,
	permissionsOn,
	membrane,
	setFromNames,
	registerLeafFunction,
	nodeInCycle,
	wrapperDebugEnabled,
	createNamedProxyTarget,
	isAwaitableThen,
	hasThenMember,
	thenableExportError,
	isThenableModuleValue,
	isPosition,
	withRestartForwarding,
	forwardHandlerTo,
	defineProxyInspect,
	UnifiedWrapper,
	isClassInstance,
	resolveWrapper,
	registerProxy,
	captureNode,
	checkpointNodeBuiltins,
	checkpointNodePrototypes,
	isWrapper;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/**
 * Put a module's accessor on a wrapper as one that runs its getter and setter with the api node as
 * `this`, so a read runs the getter and a write runs the setter, as on the object itself.
 * @param {object} wrapper - The wrapper to hold the member.
 * @param {PropertyKey} key - The member's key.
 * @param {{get?: Function, set?: Function}} accessor - The module's own getter and setter.
 * @returns {void}
 * @private
 *
 * @example
 * defineAdoptedAccessor(wrapper, "total", descriptor);
 */
function defineAdoptedAccessor(wrapper, key, accessor) {
	Objects.defineProperty(wrapper, key, {
		__proto__: null,
		...adoptAccessor(wrapper, accessor),
		enumerable: true,
		configurable: true
	});
}

/**
 * The getter and setter an adoption puts on a wrapper for a module's own: each runs the module's half with the api
 * node as `this`, as the module the node belongs to (see {@link runAccessor}). A half that is already an
 * adoption's is kept, and a half that is not a function is left out.
 * @param {object} wrapper - The wrapper to hold the member.
 * @param {{get?: Function, set?: Function}} accessor - The module's own getter and setter.
 * @returns {{get: Function|undefined, set: Function|undefined}} The adopted halves.
 * @private
 *
 * @example
 * Object.defineProperty(wrapper, "total", { ...adoptAccessor(wrapper, descriptor), enumerable: true });
 */
function adoptAccessor(wrapper, { get, set }) {
	const node = () => wrapper.____slothletInternal.proxy ?? wrapper;
	let cache = WeakMapMethods.get(ADOPTIONS, wrapper);
	if (!cache) WeakMapMethods.set(ADOPTIONS, wrapper, (cache = { get: new WeakMap(), set: new WeakMap() }));
	// The same half of the same accessor is adopted once per node, so describing it twice gives the same function.
	const adopt = (half, kind, make) => {
		if (typeof half !== "function") return undefined;
		if (WeakMapMethods.has(ADOPTED_ACCESSORS, half)) return half;
		let adopted = WeakMapMethods.get(cache[kind], half);
		if (!adopted) {
			adopted = make(half);
			WeakMapMethods.set(cache[kind], half, adopted);
			WeakMapMethods.set(ADOPTED_ACCESSORS, adopted, half);
		}
		return adopted;
	};
	return {
		get: adopt(get, "get", (original) => () => wrapper.___runAccessor(original, node(), [])),
		set: adopt(set, "set", (original) => (value) => wrapper.___runAccessor(original, node(), [value]))
	};
}

/**
 * Each wrapper's adoptions, by the module's own getter or setter.
 * @type {WeakMap<object, {get: WeakMap<Function, Function>, set: WeakMap<Function, Function>}>}
 * @private
 */
const ADOPTIONS = new WeakMap();

/**
 * A module's Proxy export as its node holds it (#597): its stand-in — under the layer the build laid over it, when it
 * has one — so every touch of it, slothlet's own checks included, runs its traps as a call of the node, under either
 * `permissions.caller.attribution` while the permission system is on (#726). Any other value is held as it is.
 * @param {object} wrapper - The node's wrapper.
 * @param {*} impl - The value.
 * @returns {*} What the node holds.
 * @private
 */
function implToAdopt(wrapper, impl) {
	if (!isModuleProxy(impl)) return impl;
	// A node's own Proxy export is a member of the node, not a value handed out: under either attribution its traps run
	// as a call of the node, while the permission system is on (#726).
	if (!wrapper?.____slothlet?.instanceID || !wrapper.____slothlet.contextManager?.runInContext || !permissionsOn(wrapper)) return impl;
	// A layer the build laid over the module's Proxy is laid over its stand-in instead, holding what it held.
	if (isCompositionLayer(impl)) return layerOnto(impl, implToAdopt(wrapper, layerUnderlying(impl)));
	return membrane(makerOf(wrapper), wrapper, impl, true);
}

/**
 * Give a new array member's shell the integrity its array already has, so the member reports a frozen,
 * sealed or non-extensible array, or one with a read-only `length`, as that array does (#603 review).
 *
 * @description
 * The shell starts extensible with a writable `length`. The member's own traps apply each step to the shell
 * and to the module's array, which already holds it, so nothing the array refuses is changed.
 *
 * @param {UnifiedWrapper} wrapper - The array member's wrapper, whose proxy exists.
 * @returns {void}
 * @private
 *
 * @example
 * adoptArrayIntegrity(wrapper); // wrapper fronts Object.freeze([1, 2]): Object.isFrozen(proxy) is now true
 */
function adoptArrayIntegrity(wrapper) {
	const internal = wrapper.____slothletInternal;
	const { impl, proxy } = internal;
	if (!Arrays.isArray(impl)) return;
	// A composed node's array sits under its layer, which refuses integrity operations itself.
	const array = layerUnderlying(impl);
	// Freezing the node reads its own descriptors, which must not start another sync meanwhile.
	const syncing = internal.integritySyncing;
	internal.integritySyncing = true;
	try {
		// The node is made to match its module's own array, whoever's read noticed the change: the
		// framework's write, never that reader's (#625). Exempted by its wrapper: while the node is built,
		// its proxy is not yet registered to it.
		frameworkWrite(wrapper, () => {
			// The shell takes its length from the array when it is sealed, so a read-only length is fixed last.
			if (!Reflect.isExtensible(array)) {
				Reflect.preventExtensions(proxy);
				if (Objects.isFrozen(array)) Objects.freeze(proxy);
				else if (Objects.isSealed(array)) Objects.seal(proxy);
			}
			if (Reflect.getOwnPropertyDescriptor(array, "length").writable === false)
				Reflect.defineProperty(proxy, "length", { __proto__: null, writable: false });
		});
	} finally {
		internal.integritySyncing = syncing;
	}
}

/**
 * Bring an array member's shell in step with its array when the module changed the array's integrity itself
 * (froze or sealed its own export after the node was read): the node then reports what the array is.
 *
 * @param {UnifiedWrapper} wrapper - The array member's wrapper.
 * @param {Array<*>} target - Its shell.
 * @returns {void}
 * @private
 */
function syncArrayIntegrity(wrapper, target) {
	const internal = wrapper.____slothletInternal;
	const impl = internal.impl;
	// Sealing or freezing the node reads its members' descriptors, which would start another sync meanwhile.
	if (internal.integritySyncing || !Arrays.isArray(impl) || !Arrays.isArray(target)) return;
	const array = layerUnderlying(impl);
	const extensible = Reflect.isExtensible(array);
	const lengthFixed = Reflect.getOwnPropertyDescriptor(array, "length").writable === false;
	const shellLengthFixed = Reflect.getOwnPropertyDescriptor(target, "length").writable === false;
	if (extensible && lengthFixed === shellLengthFixed) return;
	if (
		!extensible &&
		!Reflect.isExtensible(target) &&
		Objects.isFrozen(array) === Objects.isFrozen(target) &&
		lengthFixed === shellLengthFixed
	)
		return;
	adoptArrayIntegrity(wrapper);
}

/** Whether {@link MaterializeLayer} has built its class: it builds one, for the wrapper's chain. @type {boolean} */
let built = false;

/**
 * Make the changes queued through stand-ins for a wrapper that has just loaded, in the order they were made, each as
 * the code that made it (#653). One the node refuses is kept for the next await or call through that node (see
 * {@link takeRefusedChange}); the rest still land.
 * @param {object} wrapper - The wrapper, loaded.
 * @param {number} generation - Its change generation when the load started.
 * @returns {void}
 * @private
 */
function replayStandInChanges(wrapper, generation) {
	const pending = wrapper.____slothletInternal.pendingChanges;
	if (!pending) return;
	wrapper.____slothletInternal.pendingChanges = null;
	WeakMapMethods.get(PENDING_CHANGES, wrapper.____slothlet) == null
		? undefined
		: SetMethods.delete(WeakMapMethods.get(PENDING_CHANGES, wrapper.____slothlet), wrapper);
	for (let i = 0; i < pending.length; i++) wrapper.___makeQueuedChange(pending[i], generation);
}

/**
 * Save a lazy node that has just loaded, and every node and built-in below it, for the runs open (see
 * `helpers/run-snapshot`): a change made through a stand-in for it while it loaded, which is made once it has, then
 * does not reach a run that started before the change.
 * @param {UnifiedWrapper} wrapper - The node that loaded.
 * @returns {void}
 * @private
 */
function checkpointLoaded(wrapper) {
	const slothlet = wrapper.____slothlet;
	const domain = domainOf(slothlet);
	if (!runsOpen(domain)) return;
	const seen = new Set();
	const walk = (node) => {
		if (SetMethods.has(seen, node) || node.____slothlet !== slothlet) return;
		SetMethods.add(seen, node);
		const internal = node.____slothletInternal;
		if (internal.invalid || (internal.mode === "lazy" && !internal.state.materialized)) return;
		beforeChange(domain, node, captureNode);
		checkpointNodeBuiltins(domain, node);
		checkpointNodePrototypes(domain, node);
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
 * Run a lazy node's load apart from every instance's flow (#726): what the load runs is the module's own code, as an
 * eager tree's build runs it before any call, so it never runs inside the call that asked for the load.
 * @param {object} slothlet - The instance.
 * @param {function(): Promise<*>} load - The load.
 * @returns {Promise<*>} What it resolves to.
 * @private
 */
function loadApart(slothlet, load, wrapper) {
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
 * Build this layer of the wrapper class over `Base`, once (see `unified-wrapper.mjs`).
 * @param {Function} Base - The class below this layer.
 * @returns {Function} The layer's class.
 * @internal
 */
export function MaterializeLayer(Base) {
	if (built) throw ownBindingsRefusal("lib/handlers/unified-wrapper/materialize", import.meta.url);
	built = true;
	return Base.layer(
		class Materialize extends Base {
			static {
				Base.define("materialize", { defineAdoptedAccessor, adoptAccessor, adoptArrayIntegrity, syncArrayIntegrity });
				Base.define("impl", { toAdopt: implToAdopt });
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					UnifiedWrapper = registered;
					ASSIGNED_DATA = methods.values.ASSIGNED_DATA;
					dataKind = methods.values.dataKind;
					defineProxyInspect = methods.values.defineProxyInspect;
					holdsAssignedData = methods.holds.assignedData;
					inherits = methods.values.inherits;
					isErrorValue = methods.is.errorValue;
					isModuleProxy = methods.is.moduleProxy;
					isPosition = methods.is.position;
					ADOPTED_ACCESSORS = methods.nodes.ADOPTED_ACCESSORS;
					RECONSTRUCTED_FROM = methods.nodes.RECONSTRUCTED_FROM;
					nodeInCycle = methods.node.inCycle;
					makerOf = methods.nodes.makerOf;
					moduleObjectFor = methods.module.objectFor;
					originalAccessor = methods.nodes.originalAccessor;
					forwardHandlerTo = methods.rules.forwardHandlerTo;
					frameworkWrite = methods.framework.write;
					registerLeafFunction = methods.rules.registerLeafFunction;
					withRestartForwarding = methods.rules.withRestartForwarding;
					fillPrototype = methods.run.fillPrototype;
					snapshotBarrier = methods.run.snapshotBarrier;
					hasOwn = methods.has.own;
					permissionsOn = methods.views.permissionsOn;
					membrane = methods.membrane.membrane;
					PENDING_CHANGES = methods.waiting.PENDING_CHANGES;
					dropRefusedChanges = methods.waiting.dropRefusedChanges;
					createNamedProxyTarget = methods.uw.createNamedProxyTarget;
					hasThenMember = methods.has.thenMember;
					isAwaitableThen = methods.is.awaitableThen;
					isClassInstance = methods.is.classInstance;
					isThenableModuleValue = methods.is.thenableModuleValue;
					registerLeafFile = methods.uw.registerLeafFile;
					resolveWrapper = methods.uw.resolveWrapper;
					setFromNames = methods.uw.setFromNames;
					thenableExportError = methods.uw.thenableExportError;
					trustedRootOwn = methods.uw.trustedRootOwn;
					wrapperDebugEnabled = methods.wrapper.debugEnabled;
					registerProxy = methods.values.registerProxy;
					captureNode = methods.run.captureNode;
					checkpointNodeBuiltins = methods.checkpoint.nodeBuiltins;
					checkpointNodePrototypes = methods.checkpoint.nodePrototypes;
					isWrapper = methods.brand.isWrapper;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/materialize", import.meta.url);
				super(slothlet);
			}

			/**
			 * The version of an object implementation adoption may change. `___adoptImplChildren` deletes the
			 * members it moves onto the wrapper (`delete this.____slothletInternal.impl[key]`); done on the module's
			 * own export, it would empty it for every other holder, such as a second wrapper loading the same
			 * cached module during a reload. A slothlet wrapper proxy is snapshotted; everything else follows
			 * {@link module:@cldmv/slothlet/helpers/composition.copyForComposition}.
			 *
			 * @param {*} value - The implementation value.
			 * @returns {*} A copy or layer of `value`, or `value` itself when nothing can change it.
			 * @static
			 * @private
			 */
			static _cloneImpl(value) {
				// A slothlet wrapper proxy (from api.add()) is snapshotted into a plain object, so adoption's deletes
				// never reach the source tree through its deleteProperty trap.
				// Verified driverless by a presence-checked full-suite caller probe (2026-08-02): wrapper
				// proxies are function-target proxies, so they skip this object-only path, and the
				// collision materializer now unwraps composed wrappers before impl application (#257).
				// Kept because the protection is real: adopting through a live wrapper proxy would delete
				// children out of the ORIGINAL tree via its deleteProperty trap, and a future composition
				// change handing an object-target registered proxy back through here must not regress that.
				/* v8 ignore start */
				if (value && typeof value === "object" && resolveWrapper(value)) {
					const clone = {};
					for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						try {
							clone[key] = value[key];
						} catch {
							// Skip keys that throw on access (e.g., proxy invariant violations)
						}
					}
					return clone;
				}
				/* v8 ignore stop */
				// A thenable is not copied, so adoption refuses it as the lazy materializer does. Without a Proxy
				// brand check (the browser), a user Proxy reaches this copy, which would drop a `then` its `get`
				// answers (#580 review).
				if (value && typeof value === "object" && isThenableModuleValue(value)) return value;
				// An array is the module's own array, as an import of it is: adoption takes nothing off it, and
				// writes through the api reach it (#602).
				if (Arrays.isArray(value)) return value;
				// Everything else follows the one composition rule: a plain object is copied, a user Proxy gets
				// a layer, an array is copied, and a class instance (never adopted) is used as-is.
				return copyForComposition(value);
			}

			/**
			 * Copy one member of a wrapper onto another wrapper, as two colliding nodes merge.
			 *
			 * @description
			 * A data member is copied as its value. An accessor adoption put on the source runs the module's own
			 * getter and setter on the target node instead, so it reads and writes through the node that holds
			 * the slot; any other accessor is copied as it is. Reading the member would run the getter once and
			 * keep what it returned (#585 review).
			 *
			 * @param {object} source - The wrapper the member comes from.
			 * @param {object} target - The wrapper it is copied onto.
			 * @param {PropertyKey} key - The member's key.
			 * @returns {void}
			 * @package
			 *
			 * @example
			 * UnifiedWrapper._copyMember(fileWrapper, folderWrapper, "total");
			 */
			static _copyMember(source, target, key) {
				const descriptor = Objects.getOwnPropertyDescriptor(source, key);
				if (
					descriptor &&
					(WeakMapMethods.has(ADOPTED_ACCESSORS, descriptor.get) || WeakMapMethods.has(ADOPTED_ACCESSORS, descriptor.set))
				) {
					defineAdoptedAccessor(target, key, originalAccessor(descriptor));
					return;
				}
				if (descriptor && (descriptor.get || descriptor.set)) {
					Objects.defineProperty(target, key, {
						__proto__: null,
						get: descriptor.get,
						set: descriptor.set,
						enumerable: true,
						configurable: true
					});
					return;
				}
				Objects.defineProperty(target, key, { __proto__: null, value: source[key], writable: false, enumerable: true, configurable: true });
			}

			/**
			 * Describe one member of a wrapper for a plain object that will become another node's impl.
			 *
			 * @description
			 * An accessor adoption put on the wrapper is described as the module's own getter and setter, so
			 * adopting the object runs them on its new node; any other accessor is described as it is, and a data
			 * member as its value (#585 review).
			 *
			 * @param {object} source - The wrapper the member comes from.
			 * @param {PropertyKey} key - The member's key.
			 * @returns {PropertyDescriptor} A configurable, enumerable descriptor.
			 * @package
			 *
			 * @example
			 * Object.defineProperty(impl, "total", UnifiedWrapper._memberDescriptor(fileWrapper, "total"));
			 */
			static _memberDescriptor(source, key) {
				const descriptor = Objects.getOwnPropertyDescriptor(source, key);
				if (descriptor && (descriptor.get || descriptor.set)) {
					return { __proto__: null, ...originalAccessor(descriptor), enumerable: true, configurable: true };
				}
				return { __proto__: null, value: source[key], writable: true, enumerable: true, configurable: true };
			}

			/**
			 * Index a lazy folder's node at the file its function was written in: the folder's only file, self-named or of a
			 * generic name, whose default export is a function. The node keeps the folder as its own path; code written in the
			 * file is then placed at the file, as eager mode places it.
			 * @param {object} wrapper - The folder's wrapper.
			 * @param {string} filePath - The file.
			 * @returns {void}
			 * @static
			 * @package
			 */
			static _recordSourceFile(wrapper, filePath) {
				if (wrapper && typeof filePath === "string" && WeakSetMethods.has(trustedRootOwn.genuineWrappers, wrapper))
					registerLeafFile(wrapper, filePath);
			}

			/**
			 * Whether a member stays a value rather than becoming a node of its own, as a wrapper's member does: `null`,
			 * a primitive, a built-in that carries data (a `Map`, a `Date`, a typed array, …), or an error.
			 * @param {unknown} value - The member's value.
			 * @returns {boolean} True when the member is held as it is.
			 * @static
			 * @package
			 */
			static _staysValue(value) {
				if (value === null || (typeof value !== "object" && typeof value !== "function")) return true;
				return dataKind(value) !== null || isErrorValue(value);
			}

			/**
			 * The node for one member of a file's export that no wrapper holds (the members of the function the api root is),
			 * built as a wrapper builds the node of one of its own members: an object is held through a copy, so the
			 * module's own object is never written to, and the node records the file and the export it came from.
			 * @param {object} slothlet - The instance.
			 * @param {object} options - Where the member is placed and where it came from.
			 * @param {string} options.key - The member's key in the export.
			 * @param {unknown} options.value - The member's value.
			 * @param {string} options.apiPath - The path it is placed at.
			 * @param {string} options.filePath - The file it was written in.
			 * @param {string} options.moduleID - The module it belongs to.
			 * @param {string|null} options.sourceFolder - The folder the file was scanned from.
			 * @returns {object|Function|null} The node's proxy, or null when the member stays a value.
			 * @static
			 * @package
			 */
			static _memberNode(slothlet, { key, value, apiPath, filePath, moduleID, sourceFolder }) {
				if (UnifiedWrapper._staysValue(value) || resolveWrapper(value) !== null) return null;
				let impl = value;
				if (typeof value === "object" && !Arrays.isArray(value) && !(EventEmitter && inherits(value, EventEmitter))) {
					impl = copyForComposition(value);
					if (impl !== value) slothlet.handlers?.ownership?.noteClone(impl, value);
				}
				const origins = slothlet.handlers?.ownership;
				const exportPath = origins?.resolveExportPath(filePath, value) ?? origins?.resolveExportPathByKey(filePath, key, value) ?? null;
				const node = new UnifiedWrapper(slothlet, {
					mode: "eager",
					apiPath,
					initialImpl: impl,
					isCallable: typeof impl === "function",
					filePath,
					exportPath,
					moduleID,
					sourceFolder
				});
				node.____slothletInternal.sourceValue = value;
				node.____slothletInternal.moduleObject = impl !== value ? moduleObjectFor(node, value, true) : null;
				return node.___createProxy();
			}

			/**
			 * Reconstruct a full implementation object from a wrapper whose ____impl may have
			 * been depleted by ___adoptImplChildren.
			 *
			 * @description
			 * After ___adoptImplChildren runs, children are moved from ____impl onto the wrapper as
			 * own properties and deleted from ____impl. This helper reconstructs the original
			 * impl by merging the remaining ____impl keys with the adopted children extracted
			 * from the wrapper.
			 *
			 * Recursively walks the wrapper tree so nested objects whose ____impl was also
			 * depleted are properly reconstructed. For callable (function) impls, returns
			 * the function directly since keepImplProperties prevents depletion.
			 *
			 * @param {Object} wrapper - The UnifiedWrapper instance to extract from
			 * @param {?function(Object, PropertyKey): {value: *, withheld: boolean}} [readMember=null] - Given when the
			 *   result is serialized: reads an accessor member of a wrapper as its node answers it, or reports it withheld.
			 *   The object is then built in the order its node lists its members (#747).
			 * @returns {*} The reconstructed implementation mirroring original module exports
			 * @static
			 * @private
			 */
			static _extractFullImpl(wrapper, readMember = null) {
				if (!wrapper) return null;

				const impl = wrapper.____slothletInternal.impl;

				// Primitives and null/undefined: return directly (no depletion possible)
				if (impl === null || impl === undefined) return impl;
				if (typeof impl !== "object" && typeof impl !== "function") return impl;

				// For functions, keepImplProperties=true means ____impl is intact - return as-is
				if (typeof impl === "function") return impl;

				// A class instance is not adopted (#589), so it is intact too. Rebuilding it as a plain object
				// would drop its prototype, and with it the methods and getters the instance answers.
				if (isClassInstance(impl)) return impl;

				// Arrays are never depleted (their indices aren't adopted as children), so the impl is the
				// faithful array. It is copied with its own members and their descriptors, as an array export is
				// everywhere else (#585 review); members the wrapper holds beside it (sibling files) need a layer.
				// A composition layer (over an array, a Proxy or another value a layer keeps whole) is copied as a
				// layer, keeping the members it holds beside what the value answers.
				// Members adoption moved from the layer onto the wrapper are held on the copy again.
				// An array with nothing beside it is returned itself, the module's own array the wrapper fronts: a
				// reload that hands it to a reused wrapper keeps writes through a held reference reaching it (#602).
				const extractFullImpl_hasMembers = ArrayMethods.some(
					Objects.keys(wrapper),
					(key) => !SetMethods.has(UnifiedWrapper.INTERNAL_KEYS, key)
				);
				if (Arrays.isArray(impl) && !isCompositionLayer(impl) && !extractFullImpl_hasMembers) return impl;
				if (isCompositionLayer(impl) || Arrays.isArray(impl)) {
					const extractFullImpl_layer = copyForComposition(impl, {
						addsMembers: Arrays.isArray(impl) && extractFullImpl_hasMembers
					});
					for (let ofIndex = 0, ofList = Objects.keys(wrapper); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						if (SetMethods.has(UnifiedWrapper.INTERNAL_KEYS, key) || Reflect.getOwnPropertyDescriptor(extractFullImpl_layer, key)) continue;
						const extractFullImpl_layerChildW = resolveWrapper(wrapper[key]);
						holdMember(
							extractFullImpl_layer,
							key,
							extractFullImpl_layerChildW ? UnifiedWrapper._extractFullImpl(extractFullImpl_layerChildW) : wrapper[key]
						);
					}
					return extractFullImpl_layer;
				}

				// Serialized, the object is rebuilt as a read of it lists it (#747): the node's members in the order the node
				// holds them, which is the order of the module's object, then what only the impl still holds. An accessor is
				// read through the node, so the module's getter runs as the node runs it (on the node, as the module, behind
				// the node's checks), where reading it off the emptied impl ran it on an object missing every adopted member.
				if (readMember) {
					const serialized = {};
					const take = (key, holder) => {
						const held = Objects.getOwnPropertyDescriptor(holder, key);
						if ("value" in held && holder === wrapper) {
							const child = resolveWrapper(held.value);
							serialized[key] = child ? UnifiedWrapper._extractFullImpl(child, readMember) : held.value;
							return;
						}
						if ("value" in held) {
							serialized[key] = held.value;
							return;
						}
						const read = readMember(wrapper, key);
						if (read.withheld) return;
						const answered = resolveWrapper(read.value);
						serialized[key] = answered ? UnifiedWrapper._extractFullImpl(answered, readMember) : read.value;
					};
					for (let ofIndex = 0, ofList = Objects.keys(wrapper); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						if (!SetMethods.has(UnifiedWrapper.INTERNAL_KEYS, key)) take(key, wrapper);
					}
					for (let ofIndex = 0, ofList = Objects.keys(impl); ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						if (!isFrameworkReservedKey(key) && !hasOwn(serialized, key) && !hasOwn(wrapper, key)) take(key, impl);
					}
					return serialized;
				}

				// For objects, reconstruct by merging remaining ____impl keys with adopted children
				const extractFullImpl_result = {};
				// A node rebuilt from the reconstruction fronts the module's object this one does (#746).
				if (wrapper.____slothletInternal.moduleObject)
					WeakMapMethods.set(RECONSTRUCTED_FROM, extractFullImpl_result, wrapper.____slothletInternal.moduleObject);

				// Copy remaining ____impl keys (not adopted or metadata-protected)
				for (let ofIndex = 0, ofList = Objects.keys(impl); ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					// The same exact reserved set every other trap gates on — not an `__` prefix (a module's own
					// `__x` export must survive extraction, or a chained lazy read of it resolves to undefined),
					// and not just the metadata names (a module export NAMED `___materialize`/`____impl` sits on the
					// impl because adoption skips it; copying it here would hand it to `toJSON` while `ownKeys`
					// and `get` both withhold it).
					if (isFrameworkReservedKey(key)) continue;
					// An accessor the impl still holds (adoption leaves a module's getter and setter on it) is carried over as
					// the accessor it is: reading it here would run the getter on the emptied impl and keep what that returned.
					const extractFullImpl_held = Objects.getOwnPropertyDescriptor(impl, key);
					if (extractFullImpl_held && !("value" in extractFullImpl_held)) {
						Objects.defineProperty(extractFullImpl_result, key, extractFullImpl_held);
						continue;
					}
					extractFullImpl_result[key] = impl[key];
				}

				// Preserve metadata keys needed by ___createChildWrapper for file path resolution
				// Unreachable in practice: ____childFilePaths is set only when ___createChildWrapper
				// is called with a parent that was built from a multi-file folder scan. No test
				// fixture exercises that code path, so this key is never present on tested impls.
				/* v8 ignore next */
				if (impl.____childFilePaths) {
					extractFullImpl_result.____childFilePaths = impl.____childFilePaths;
				}
				// Unreachable in practice: ____childFilePathsPreMaterialize is set only during the
				// pre-materialization phase of folder wrappers with deferred children. The same
				// test-coverage gap as ____childFilePaths above.
				/* v8 ignore next */
				if (impl.____childFilePathsPreMaterialize) {
					extractFullImpl_result.____childFilePathsPreMaterialize = impl.____childFilePathsPreMaterialize;
				}

				// Add adopted children from wrapper's own enumerable keys.
				// Skip all framework-reserved keys — user module properties with any prefix are fine.
				for (let ofIndex = 0, ofList = Objects.keys(wrapper); ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					// Wrapper own keys are user-facing API names; INTERNAL_KEYS never appear as own enumerable keys.
					/* v8 ignore next */
					if (SetMethods.has(UnifiedWrapper.INTERNAL_KEYS, key)) continue;
					if (key in extractFullImpl_result) continue; // Already from ____impl (not depleted for this key)

					const extractFullImpl_child = wrapper[key];
					const _extractChildW = resolveWrapper(extractFullImpl_child);
					if (_extractChildW) {
						// Recursively extract from child wrapper (handles nested depletion)
						extractFullImpl_result[key] = UnifiedWrapper._extractFullImpl(_extractChildW);
					} else {
						extractFullImpl_result[key] = extractFullImpl_child;
					}
				}

				return extractFullImpl_result;
			}

			/**
			 * Core implementation-application logic shared by ___setImpl and lazy materialization.
			 * Clones the implementation (protecting the API cache from ___adoptImplChildren's
			 * delete operations), clears the invalid flag, upgrades callability when a
			 * callable impl arrives on a configurable wrapper, updates ____filePath for lazy
			 * folder wrappers, and adopts children.
			 *
			 * @param {*} newImpl - The new implementation value.
			 * @param {boolean} [forceReuseChildren=false] - When true, always reuse existing child
			 *   wrappers regardless of mode (used by ___setImpl to preserve live references).
			 * @private
			 */
			___applyNewImpl(newImpl, forceReuseChildren = false) {
				// Refresh the impl's module origin (#484) from the value as exported, before it is cloned. A new
				// impl that is not a known export of this wrapper's file keeps the origin already recorded.
				const originIndex = this.____slothlet.handlers?.ownership;
				const newExportPath = originIndex?.resolveExportPath(this.____slothletInternal.filePath, newImpl) ?? null;
				if (newExportPath) {
					this.____slothletInternal.exportPath = newExportPath;
					this.____slothletInternal.memberExportPaths =
						originIndex.resolveMemberExportPaths(this.____slothletInternal.filePath, newImpl) ?? null;
				}
				// Clone to protect API cache from ___adoptImplChildren's delete operations.
				// See static _cloneImpl() for full rationale.
				this.____slothletInternal.impl = UnifiedWrapper._cloneImpl(implToAdopt(this, newImpl));
				// A value arriving replaces a file's null or undefined (#792); null itself also passes through here for a node
				// being cleared, which keeps what it was built from.
				if (newImpl !== null && newImpl !== undefined) this.____slothletInternal.nullish = null;
				// The module's own object behind the new value, when its file exports it (#746); a member's is set by the
				// node that hands it its value (see ___adoptImplChildren).
				this.____slothletInternal.moduleObject = moduleObjectFor(this, newImpl, false);
				// The node's members come from the new value from here on: none of them was defined read-only through the node.
				this.____slothletInternal.readOnlyKeys = null;
				fillPrototype(this);
				registerLeafFunction(this, this.____slothletInternal.impl);
				this.____slothletInternal.invalid = false;

				// Update isCallable if it's currently unlocked (false) and the new impl is callable.
				// In lazy mode, isCallable starts as false/unlocked because initialImpl is null.
				// When the real impl arrives and is a function, upgrade to true and lock it.
				if (
					!this.____slothletInternal.isCallableLocked &&
					!this.____slothletInternal.isCallable &&
					(typeof newImpl === "function" || (newImpl && typeof newImpl.default === "function"))
				) {
					this.____slothletInternal.isCallable = true;
					this.____slothletInternal.isCallableLocked = true;
				}

				// A function arriving at a wrapper whose proxy was built non-callable (a plain namespace that a
				// reload, a remove's revert or a lazy materialization now gives a function) needs a callable
				// proxy: a Proxy's callability is fixed when it is created (#533).
				if (this.____slothletInternal.proxyTraps !== null && UnifiedWrapper._isCallableImpl(newImpl)) {
					this.___upgradeToCallableProxy();
				}
				// A lazy node is built on a function target before its value is known. Once the value is an array, a
				// non-null primitive or a namespace object, the node is rebuilt on the target eager gives it (an array or an
				// object shell), so a loaded lazy node is what eager builds (#585 review, #811).
				if (this.____slothletInternal.lazyProxyTraps) {
					const settledImpl = this.____slothletInternal.impl;
					if (UnifiedWrapper._isCallableImpl(newImpl)) {
						this.____slothletInternal.lazyProxyHandler = null;
						this.____slothletInternal.lazyProxyTraps = null;
					} else if (settledImpl != null && typeof settledImpl !== "function") {
						// An array, a primitive or a namespace object (#811): eager builds each on a target that is no function.
						// null is not settled on: a node being cleared (remove, reload) passes through it.
						this.___settleLazyProxy();
					}
				}

				// Update wrapper's filePath if not yet set.
				// This handles lazy folder wrappers that import a file - the file path is
				// stored on the impl by modes-processor and needs to be promoted to the wrapper.
				// impl.____filePath is never set by any internal code path; this branch is structurally unreachable.
				/* v8 ignore next */
				if (!this.____slothletInternal.filePath && this.____slothletInternal.impl && this.____slothletInternal.impl.____filePath) {
					this.____slothletInternal.filePath = this.____slothletInternal.impl.____filePath;
					this.____slothlet.debug("wrapper", {
						key: "DEBUG_MODE_APPLY_IMPL_UPDATE_PATH",
						apiPath: this.____slothletInternal.apiPath,
						filePath: this.____slothletInternal.filePath
					});
				}

				this.___adoptImplChildren(forceReuseChildren);
			}

			/**
			 * Whether an impl makes its wrapper callable: a function, or an object with a default-exported
			 * function.
			 * @param {*} impl - The impl.
			 * @returns {boolean} True for a callable impl.
			 * @private
			 *
			 * @example
			 * UnifiedWrapper._isCallableImpl({ default() {} }); // true
			 */
			static _isCallableImpl(impl) {
				return typeof impl === "function" || (!!impl && typeof impl === "object" && typeof impl.default === "function");
			}

			/**
			 * Give a namespace the function a later contribution supplies, keeping its children (#533).
			 *
			 * @description
			 * A merge (`merge` / `merge-replace`) keeps the existing node and only adds the incoming children,
			 * so the incoming module's own function was dropped and a namespace created by an earlier module
			 * could never become callable. The function is resolved like any other merged member: a namespace
			 * with no function yet always takes it; one that already has a function keeps it under `merge`
			 * (first writer wins) and takes the incoming one under `merge-replace` (incoming wins). The children
			 * are untouched: the incoming impl's own members were already adopted into child wrappers, which the
			 * caller merges separately.
			 *
			 * @param {*} impl - The incoming contribution's impl at this node.
			 * @param {boolean} [replaceExisting=false] - True under `merge-replace`: the incoming function
			 *   replaces an existing one.
			 * @returns {boolean} True when the namespace took the function.
			 * @private
			 *
			 * @example
			 * existingWrapper.___adoptCallableImpl(nextWrapper.____slothletInternal.impl, collisionMode === "merge-replace");
			 */
			___adoptCallableImpl(impl, replaceExisting = false) {
				const internal = this.____slothletInternal;
				if (!UnifiedWrapper._isCallableImpl(impl) || impl === internal.impl) return false;
				if (!replaceExisting && UnifiedWrapper._isCallableImpl(internal.impl)) return false;
				// The module(s) that built this namespace record the wrapper itself as their value; pin that to the
				// impl they actually supplied (their function, or their plain namespace), so removing the incoming
				// module reverts to it.
				this.____slothlet.handlers.ownership.pinLiveEntries(internal.apiPath, this, internal.impl, resolveWrapper);
				internal.impl = implToAdopt(this, impl);
				fillPrototype(this);
				registerLeafFunction(this, internal.impl);
				internal.isCallable = true;
				internal.isCallableLocked = true;
				if (internal.proxyTraps !== null) this.___upgradeToCallableProxy();
				return true;
			}

			/**
			 * Replace this wrapper's non-callable proxy with a callable one (#533).
			 *
			 * @description
			 * A Proxy's callability is fixed when it is created, and a namespace that started non-callable
			 * uses the wrapper itself as its target (so `typeof` reads "object"). When a function arrives, a new
			 * proxy is built from the same handler on a function target, registered for this wrapper, and
			 * installed in the parent in place of the old one, so `api.<path>` is callable from then on. The
			 * old proxy's traps are re-pointed at the new proxy (the same forwarding restart() gives a held
			 * reference, #504), so a reference held from before keeps reading, enumerating and writing through
			 * to the live namespace — but stays non-callable itself and keeps `typeof` "object".
			 *
			 * The upgrade is one-way: when the function later goes away (a remove or a reload), the callable
			 * proxy stays and a call throws `API_PATH_NOT_CALLABLE`, the same as for a namespace that
			 * was callable from the start.
			 *
			 * @returns {void}
			 * @private
			 *
			 * @example
			 * if (internal.proxyTraps !== null) wrapper.___upgradeToCallableProxy();
			 */
			___upgradeToCallableProxy() {
				const wrapper = this;
				const internal = wrapper.____slothletInternal;
				const oldProxy = internal.proxy;
				const oldTraps = internal.proxyTraps;
				internal.isCallable = true;
				internal.isCallableLocked = true;

				const target = createNamedProxyTarget(internal.apiPath, "callableProxy");
				defineProxyInspect(wrapper, target);
				const newProxy = new NativeProxy(target, withRestartForwarding(internal.proxyHandler, wrapper));
				internal.proxy = newProxy;
				internal.proxyHandler = null;
				internal.proxyTraps = null;
				// A callable node keeps its callable proxy through a reset; the lazy proxy a settle kept is not taken back (#811).
				internal.settledFrom = null;
				registerProxy(newProxy, wrapper);

				// The old proxy stays registered for this wrapper (resolveWrapper keeps working on a held
				// reference) and forwards everything to whichever proxy is current.
				forwardHandlerTo(oldTraps, () => internal.proxy);
				wrapper.___replaceInParent(oldProxy, newProxy);
			}

			/**
			 * Rebuild a loaded lazy node on the target eager gives its value (#585 review).
			 *
			 * @description
			 * A lazy node's proxy is built on a function target, since what the node holds is unknown until it
			 * loads, and a Proxy's target is fixed when it is created. Eager builds an array on an array shell (so
			 * `Array.isArray` sees it) and any other non-callable value, a namespace object included (#811), on an
			 * object shell. Once a lazy node loads such a value, a proxy is built from the same handler on that
			 * target and put in the parent in place of the lazy one, which forwards every operation to it from then
			 * on, as a namespace upgraded to callable does (#533). A reference taken before the load keeps the lazy
			 * proxy's form (`typeof` reads `"function"`) and reads through to the node.
			 *
			 * @returns {void}
			 * @private
			 *
			 * @example
			 * if (Array.isArray(internal.impl)) wrapper.___settleLazyProxy();
			 */
			___settleLazyProxy() {
				const wrapper = this;
				const internal = wrapper.____slothletInternal;
				const oldProxy = internal.proxy;
				const oldTraps = internal.lazyProxyTraps;
				const handler = internal.lazyProxyHandler;
				// Kept so a reload that resets the node to unloaded can give it its lazy proxy back (see ___unsettleLazyProxy).
				const lazy = { proxy: oldProxy, handler, traps: oldTraps, ownTraps: { ...oldTraps }, isCallableLocked: internal.isCallableLocked };
				internal.lazyProxyHandler = null;
				internal.lazyProxyTraps = null;
				internal.isCallableLocked = true;

				// The value gets a shell of its own, as ___createProxy() builds it: an array shell for an array (#603,
				// #609), an empty object otherwise.
				const target = Arrays.isArray(internal.impl) ? [] : Objects.create(null);
				defineProxyInspect(wrapper, target);
				const traps = withRestartForwarding(handler, wrapper);
				const newProxy = new NativeProxy(target, traps);
				internal.proxy = newProxy;
				if (Arrays.isArray(target)) adoptArrayIntegrity(wrapper);
				registerProxy(newProxy, wrapper);
				// Like a non-callable proxy ___createProxy() builds, an object-shell node can still become callable.
				if (!Arrays.isArray(target)) {
					internal.proxyHandler = handler;
					internal.proxyTraps = traps;
				}
				internal.settledFrom = { ...lazy, settledProxy: newProxy, settledTraps: traps };
				forwardHandlerTo(oldTraps, () => internal.proxy);
				wrapper.___replaceInParent(oldProxy, newProxy);
			}

			/**
			 * Give a settled lazy node its lazy proxy back once a reload resets it to unloaded (#811).
			 *
			 * @description
			 * {@link UnifiedWrapper#___settleLazyProxy} rebuilt the loaded node on eager's target. A node reset to unloaded
			 * holds nothing again, so it takes the form an unloaded lazy node has: its lazy proxy, on a function target, since
			 * what it loads next may be callable. That proxy runs its own traps again and is put back in the parent, so a
			 * reference taken before the first load is the node again, as before the load; the settled proxy forwards to the
			 * node's proxy from then on. A node upgraded to callable since it settled keeps its callable proxy (see
			 * {@link UnifiedWrapper#___upgradeToCallableProxy}).
			 *
			 * @returns {void}
			 * @private
			 *
			 * @example
			 * wrapper.___unsettleLazyProxy(); // in ___resetLazy
			 */
			___unsettleLazyProxy() {
				const wrapper = this;
				const internal = wrapper.____slothletInternal;
				const settled = internal.settledFrom;
				internal.settledFrom = null;
				if (settled === null) return;
				Objects.assign(settled.traps, settled.ownTraps);
				forwardHandlerTo(settled.settledTraps, () => internal.proxy);
				internal.proxy = settled.proxy;
				internal.proxyHandler = null;
				internal.proxyTraps = null;
				internal.lazyProxyHandler = settled.handler;
				internal.lazyProxyTraps = settled.traps;
				internal.isCallableLocked = settled.isCallableLocked;
				wrapper.___replaceInParent(settled.settledProxy, settled.proxy);
			}

			/**
			 * Put this wrapper's current proxy in `container[key]` where that slot still holds one of its earlier proxies.
			 *
			 * @description
			 * A node that loads while the build that made it still runs (a file+folder collision slot the build loads to settle
			 * its surface) is rebuilt on another proxy (see {@link UnifiedWrapper#___settleLazyProxy},
			 * {@link UnifiedWrapper#___upgradeToCallableProxy}) before its tree is the instance's api, so
			 * {@link UnifiedWrapper#___replaceInParent}, which walks from the api root, finds nothing to swap. The build calls
			 * this on the object it assigned the node to, so the node it hands on is the one eager builds. A slot that holds
			 * anything else, or an accessor, is left alone.
			 *
			 * @param {object} container - The object the node was assigned to: a raw object or a wrapper's proxy.
			 * @param {string} key - The node's key there.
			 * @returns {void}
			 * @private
			 *
			 * @example
			 * wrapper.___settleInHolder(targetApi, "math");
			 */
			___settleInHolder(container, key) {
				const current = this.____slothletInternal.proxy;
				const holder = resolveWrapper(container) ?? container;
				const descriptor = Reflect.getOwnPropertyDescriptor(holder, key);
				// The callers read this wrapper from the same slot before the load, so it holds one of its proxies as data; the
				// slot can still change while the node loads (code the load runs writes it), which the suite does not drive.
				/* v8 ignore next */
				if (!descriptor || !("value" in descriptor) || resolveWrapper(descriptor.value) !== this) return;
				if (descriptor.value === current) return;
				Objects.defineProperty(holder, key, { __proto__: null, ...descriptor, value: current });
			}

			/**
			 * Swap the proxy the parent node holds for this wrapper at its apiPath (#533).
			 *
			 * @description
			 * Walks the live api tree from the root along `apiPath` through raw wrappers' own properties (no
			 * proxy traps, so nothing materializes) and replaces the child only where it is exactly `oldProxy`,
			 * keeping its property descriptor (children are defined configurable). `boundApi`/`self` forward to
			 * the same root, so one swap covers them. When the path no longer leads to `oldProxy` (the node was
			 * detached or replaced), nothing changes; the old proxy forwards to the new one regardless.
			 *
			 * @param {object} oldProxy - The proxy being replaced.
			 * @param {object} newProxy - Its replacement.
			 * @returns {void}
			 * @private
			 *
			 * @example
			 * wrapper.___replaceInParent(oldProxy, newProxy);
			 */
			___replaceInParent(oldProxy, newProxy) {
				const segments = splitText(String(this.____slothletInternal.apiPath), ".");
				const key = segments[segments.length - 1];
				let holder = null;
				let node = this.____slothlet.api;
				for (let ofIndex = 0, ofList = segments; ofIndex < ofList.length; ofIndex++) {
					const segment = ofList[ofIndex];
					// Raw wrappers hold their children as own data properties, so this read runs no trap.
					holder = resolveWrapper(node) ?? node;
					node = holder?.[segment];
				}
				if (node !== oldProxy) return;
				Objects.defineProperty(holder, key, { __proto__: null, ...Reflect.getOwnPropertyDescriptor(holder, key), value: newProxy });
			}

			/**
			 * Set new implementation and adopt children.
			 * Delegates core impl work to ___applyNewImpl, then emits lifecycle events
			 * and updates materialization state.
			 *
			 * @param {*} newImpl - New implementation
			 * @param {string} [moduleID] - Optional moduleID for lifecycle event (for replacements)
			 * @param {boolean} [forceReuseChildren=false] - When true, always reuse existing child
			 *   wrappers and bypass collision-merged key guards. Use this for direct/explicit
			 *   ___setImpl calls where reference preservation is the intent. Do NOT set for
			 *   hot-reload paths (syncWrapper) where lazy refs should intentionally break.
			 * @param {boolean} [attributeChildren=false] - When true, the children this call adopts (new ones and
			 *   reused ones, all the way down) belong to `moduleID` rather than to this wrapper's own module. A
			 *   reload passes it when it rebuilds one module's contribution to a namespace that another module
			 *   created, so the rebuilt leaves stay attributed to the module that exports them (#525).
			 * @private
			 */
			___setImpl(newImpl, moduleID = null, forceReuseChildren = false, attributeChildren = false) {
				// A run that started before this change reads the node as it was (see helpers/run-snapshot).
				snapshotBarrier(this);
				// Debug block only fires when wrapperDebugEnabled AND apiPath === "string"; neither condition is met in tests.
				/* v8 ignore start */
				if ((wrapperDebugEnabled || this.____config?.debug?.wrapper) && this.____slothletInternal.apiPath === "string") {
					this.____slothlet.debug("wrapper", {
						key: "DEBUG_MODE_SETIMPL_CALLED",
						apiPath: this.____slothletInternal.apiPath,
						// newImpl is always a valid object when ___setImpl is called; {} fallback is unreachable.
						/* v8 ignore next */
						newImplKeys: Objects.keys(newImpl || {})
					});
				}
				/* v8 ignore stop */
				// A loaded node given a new value is another node: the refusals of changes made on the old one are not its own (#653).
				if (this.____slothletInternal.state.materialized && this.____slothletInternal.impl !== newImpl) {
					this.____slothletInternal.changeGeneration++;
					dropRefusedChanges(this);
				}

				const priorAdoptOwner = this.____slothletInternal.adoptOwner;
				if (attributeChildren && moduleID) this.____slothletInternal.adoptOwner = moduleID;
				try {
					this.___applyNewImpl(newImpl, forceReuseChildren);
				} finally {
					this.____slothletInternal.adoptOwner = priorAdoptOwner;
				}

				// Emit impl:changed event for lifecycle management
				if (newImpl && this.____slothlet.handlers?.lifecycle) {
					const wrapperMetadata = this.____slothlet.handlers.metadata.getSystemMetadata(this);
					// Use provided moduleID (for replacements) or extract from metadata. Every ___setImpl
					// caller now passes a string moduleID (or null) — the stale-signature caller that passed
					// the slothlet instance was fixed in #274 (a7a711f), so the former object-coercion guard
					// here is dead and was removed with it.
					const extractedModuleId = moduleID || wrapperMetadata?.baseModuleID || null;

					// INTERNAL impl:changed contribution event (#398) — see the impl:created emit above and
					// slothlet.mjs's ownership subscriber, which re-emits the public post-placement impl:changed
					// (wrapped callable, no raw impl) once the reassignment is placed. No raw `impl` here.
					this.____slothlet.handlers.lifecycle.emitInternal("impl:changed", {
						apiPath: this.____slothletInternal.apiPath,
						wrapper: Objects.freeze({ ____impl: this.____slothletInternal.impl }),
						____wrapperRef: this,
						source: "hot-reload",
						moduleID: extractedModuleId,
						filePath: wrapperMetadata?.filePath,
						exportPath: this.____slothletInternal.exportPath ?? null,
						memberExportPaths: this.____slothletInternal.memberExportPaths ?? null,
						sourceFolder: wrapperMetadata?.sourceFolder
					});
				}

				this.____slothletInternal.state.materialized = true;
				this.____slothletInternal.state.inFlight = false;

				// Settle this wrapper's materialization count. Only a wrapper still counted as unloaded is
				// uncounted, so setting the impl of an eager-mode child or an already-loaded wrapper no longer
				// drives the count below zero (#588).
				this.___trackLazyLoad("loaded");
			}

			/**
			 * Reset wrapper to un-materialized lazy state with a fresh materialization function.
			 * Used during reload to restore lazy wrappers to their shell state instead of
			 * eagerly loading all implementations. Preserves proxy identity so existing
			 * references continue to work - next property access triggers materialization
			 * from the fresh materializeFunc (which reads updated source files from disk).
			 * @param {Function} newMaterializeFunc - Fresh materialization function from rebuild
			 * @param {Iterable<string>|null} [memberNames=null] - The rebuilt folder's entry names, replacing the
			 *   ones this wrapper was built with (#571): until the next load they decide which names are members.
			 * @returns {void}
			 * @private
			 */
			___resetLazy(newMaterializeFunc, memberNames = null) {
				// The node is about to be another; the refusals of changes made on the old one are not its own (#653).
				this.____slothletInternal.changeGeneration++;
				dropRefusedChanges(this);
				this.____slothlet.debug("wrapper", {
					key: "DEBUG_MODE_RESETLAZY_CALLED",
					apiPath: this.____slothletInternal.apiPath,
					hadImpl: this.____slothletInternal.impl !== null,
					hadChildren: filterList(Objects.keys(this), (k) => !isFrameworkReservedKey(k)).length
				});

				// Invalidate and clear all child wrappers
				for (let ofIndex = 0, ofList = Reflect.ownKeys(this); ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					// All own properties are user-facing API names; internal state lives in #internal (private field), never in own keys.
					/* v8 ignore next */
					if (isFrameworkReservedKey(key)) {
						continue;
					}
					const child = this[key];
					const childRaw = resolveWrapper(child);
					if (childRaw) {
						childRaw.___invalidate();
					}
					const descriptor = Objects.getOwnPropertyDescriptor(this, key);
					// Child properties are always set configurable:true; non-configurable branch is unreachable.
					/* v8 ignore next */
					if (descriptor?.configurable) {
						delete this[key];
					}
				}

				// Clear implementation and reset state
				this.____slothletInternal.impl = null;
				this.____slothletInternal.nullish = null;
				this.____slothletInternal.invalid = false;
				this.____slothletInternal.state.materialized = false;
				this.____slothletInternal.state.inFlight = false;
				// Unloaded again, so it takes an unloaded lazy node's form again (#811).
				this.___unsettleLazyProxy();
				// Unloaded again, so it counts as unloaded again until it next loads (#588).
				this.___trackLazyLoad("rearm");

				// Clear materialization promise so next access starts fresh
				this.____slothletInternal.materializationPromise = null;

				// Swap in the fresh materialization function
				this.____slothletInternal.materializeFunc = newMaterializeFunc;
				this.____slothletInternal.memberNames = memberNames ? setFromNames(memberNames) : null;

				// Clear waiting proxy caches - stale references from previous materialization.
				// waitingProxyCache is always initialized to a Map in the constructor; null check is unreachable.
				/* v8 ignore next */
				if (this.____slothletInternal.waitingProxyCache) {
					MapMethods.clear(this.____slothletInternal.waitingProxyCache);
				}
				// WeakMap has no clear(); replace with a fresh instance so any inner Maps held
				// by GC-reachable context objects are dropped along with their cached proxies.
				this.____slothletInternal.waitingProxyCacheByContext = new WeakMap();

				this.____slothlet.debug("wrapper", {
					key: "DEBUG_MODE_RESETLAZY_COMPLETE",
					apiPath: this.____slothletInternal.apiPath
				});
			}

			/**
			 * Trigger materialization (lazy mode only)
			 * @returns {Promise<void>}
			 * @private
			 */
			async ___materialize() {
				// If already materialized, return immediately
				if (this.____slothletInternal.state.materialized) {
					return;
				}

				// If wrapper has been invalidated (e.g., parent module removed via api.remove()),
				// skip materialization to avoid registering stale ownership entries.
				if (this.____slothletInternal.invalid) {
					return;
				}

				// If materialization is already in progress, return the existing promise
				// This allows multiple callers to await the same materialization without polling
				if (this.____slothletInternal.materializationPromise) {
					this.____slothlet.debug("wrapper", {
						key: "DEBUG_MODE_MATERIALIZE_AWAIT",
						apiPath: this.____slothletInternal.apiPath
					});
					return this.____slothletInternal.materializationPromise;
				}

				// Debug block only fires when apiPath === "string" (literal), which never occurs in practice.
				/* v8 ignore next */
				if ((wrapperDebugEnabled || this.____config?.debug?.wrapper) && this.apiPath === "string") {
					this.____slothlet.debug("wrapper", {
						key: "DEBUG_MODE_MATERIALIZE_START",
						apiPath: this.apiPath
					});
				}

				// Create and store the materialization promise
				// The load runs apart from the flow of whichever call asked for it, as an eager tree's build runs before any call:
				// the module's top level, and its exports' getters and Proxy traps as slothlet reads them, are the module's own code,
				// never run inside that call (#726). Under the async runtime the caller's flow would otherwise carry into the load.
				this.____slothletInternal.materializationPromise = loadApart(
					this.____slothlet,
					async () => {
						this.____slothletInternal.state.inFlight = true;
						// The node this load is for: a reload that replaces it while it loads moves the generation on (#653).
						const changeGeneration = this.____slothletInternal.changeGeneration;

						try {
							if (this.____slothletInternal.materializeFunc) {
								if ((wrapperDebugEnabled || this.____config?.debug?.wrapper) && this.____slothletInternal.apiPath === "string") {
									this.____slothlet.debug("wrapper", {
										key: "DEBUG_MODE_MATERIALIZE_CALLING_FUNC",
										apiPath: this.____slothletInternal.apiPath
									});
								}
								// POC pattern: materializeFunc can set implementation synchronously via setter
								// This matches v2 behavior where 'materialized' variable is set immediately
								const lazy_setImpl = (value) => {
									// A caller can ___invalidate() this wrapper AFTER materialization already
									// started (e.g. loader.materialize: true kicked it off before a collision
									// decision rejected the candidate) — the guard at this method's own top only
									// catches invalidation BEFORE materialization starts, not while it's in flight.
									// Re-checking here stops a rejected candidate's materializeFunc from applying
									// its result at all, even when it calls this setter synchronously (#372 review).
									if (this.____slothletInternal.invalid) {
										UnifiedWrapper._uncountUnappliedImpl(value);
										return false;
									}
									this.___applyNewImpl(value);
									return true;
								};
								// The wrapper itself goes along: a reload hands this materializer to an existing wrapper, so the
								// one that runs it is not always the one it was built for.
								const result = await this.____slothletInternal.materializeFunc(lazy_setImpl, this);

								// Same in-flight invalidation as lazy_setImpl above — re-check after the await in
								// case invalidation happened while materializeFunc was running (#372 review).
								if (this.____slothletInternal.invalid) {
									UnifiedWrapper._uncountUnappliedImpl(result);
									return;
								}

								// If materializeFunc didn't call setter, set ____impl from return value
								if (!this.____slothletInternal.impl) {
									this.___applyNewImpl(result);
								}

								this.____slothletInternal.state.materialized = true;
								// The value a lazy node loads is its module's contribution at this path, as the value an eager node is
								// built with is (#754): a callable folder's own function joins the routines that name it. Eager reports
								// it through the construction's impl:created; a lazy construction had no value yet.
								this.___reportLoadedContribution();
								// A module whose value is null loads as null; ___applyNewImpl() leaves null alone because a node
								// being cleared passes through it too.
								// So does one whose value is undefined, and its read answers that null or undefined, as the plain
								// module's `default` does (#792).
								if ((result === null || result === undefined) && (this.____slothletInternal.impl ?? null) === null) {
									if (this.____slothletInternal.lazyProxyTraps) this.___settleLazyProxy();
									this.____slothletInternal.nullish = { value: result };
								}

								// Notify Slothlet that this lazy wrapper has materialized (counted once, #588).
								this.___trackLazyLoad("loaded");
								// A run open now reads the node as it loaded: saved before the changes made through stand-ins for it are made.
								if (anyRunOpen()) checkpointLoaded(this);
								// Changes made through stand-ins for it while it loaded, now that it has (#653).
								replayStandInChanges(this, changeGeneration);

								if ((wrapperDebugEnabled || this.____config?.debug?.wrapper) && this.____slothletInternal.apiPath === "string") {
									this.____slothlet.debug("wrapper", {
										key: "DEBUG_MODE_MATERIALIZE_COMPLETE",
										apiPath: this.____slothletInternal.apiPath,
										resultType: typeof result,
										// result is always a resolved module object here; {} fallback is unreachable.
										/* v8 ignore next */
										resultKeys: Objects.keys(result || {})
									});
								}
							}
						} catch (error) {
							// Debug block only fires when apiPath === "string" (literal), which never occurs in test environments.
							/* v8 ignore next */
							if ((wrapperDebugEnabled || this.____config?.debug?.wrapper) && this.____slothletInternal.apiPath === "string") {
								this.____slothlet.debug("wrapper", {
									key: "DEBUG_MODE_MATERIALIZE_ERROR",
									apiPath: this.____slothletInternal.apiPath,
									error: error.message
								});
							}
							throw error;
						} finally {
							// Changes queued for a node that did not load are dropped with it: what failed the load fails the awaits (#653).
							if (!this.____slothletInternal.state.materialized) {
								this.____slothletInternal.pendingChanges = null;
								WeakMapMethods.get(PENDING_CHANGES, this.____slothlet) == null
									? undefined
									: SetMethods.delete(WeakMapMethods.get(PENDING_CHANGES, this.____slothlet), this);
							}
							// CRITICAL: Always clear inFlight flag and promise reference
							this.____slothletInternal.state.inFlight = false;
							this.____slothletInternal.materializationPromise = null;
						}
					},
					this
				);

				// Return the promise so the caller can await it
				return this.____slothletInternal.materializationPromise;
			}

			/**
			 * Hand the value a lazy node just loaded to the routine manager as its module's contribution at this
			 * path (#754). An eager node's value reaches it through the construction's internal `impl:created`;
			 * a lazy node is built with no value, so its own function (a callable folder's `default`) would never
			 * join a routine that names its path. Only the routine manager is told: ownership and metadata already
			 * hold this node from its construction, and the public `impl:created` for it has already fired.
			 * @returns {void}
			 * @private
			 *
			 * @example
			 * this.___reportLoadedContribution();
			 */
			___reportLoadedContribution() {
				const internal = this.____slothletInternal;
				const routineManager = this.____slothlet.handlers?.routineManager;
				if (!internal.filePath || !routineManager) return;
				routineManager.onImplCreated({
					apiPath: internal.apiPath,
					wrapper: Objects.freeze({ ____impl: internal.impl }),
					____wrapperRef: this,
					source: "lazy-materialization",
					moduleID: internal.moduleID,
					filePath: internal.filePath,
					exportPath: internal.exportPath ?? null,
					memberExportPaths: internal.memberExportPaths ?? null,
					sourceFolder: internal.sourceFolder
				});
			}

			/**
			 * Retire the lazy wrappers inside a materialization result that is dropped because its wrapper
			 * was invalidated while loading (#588). The result's unloaded lazy children were counted when they
			 * were built and are now unreachable, so they would otherwise keep `remaining` above 0 forever.
			 * Each is invalidated, not only uncounted: one already loading in the background would otherwise
			 * finish and count lazy descendants of its own that nothing can reach. One that already loaded holds
			 * its own lazy children, which are unreachable too, so the wrappers it holds are retired with it
			 * (#585 review).
			 * @param {unknown} impl - The dropped materialization result.
			 * @returns {void}
			 * @private
			 *
			 * @example
			 * UnifiedWrapper._uncountUnappliedImpl(result);
			 */
			static _uncountUnappliedImpl(impl) {
				if (!impl || (typeof impl !== "object" && typeof impl !== "function")) return;
				const seen = new Set();
				const direct = resolveWrapper(impl);
				if (direct) {
					UnifiedWrapper._invalidateTree(direct, seen);
					return;
				}
				for (let ofIndex = 0, ofList = Objects.keys(impl); ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					const descriptor = Objects.getOwnPropertyDescriptor(impl, key);
					const child = descriptor && "value" in descriptor ? resolveWrapper(descriptor.value) : null;
					if (child) UnifiedWrapper._invalidateTree(child, seen);
				}
			}

			/**
			 * Invalidate a wrapper and every wrapper it holds as a member, children first, since invalidating a
			 * wrapper removes its members (#585 review).
			 * @param {UnifiedWrapper} wrapper - The wrapper to retire.
			 * @param {Set<UnifiedWrapper>} seen - Wrappers already visited, so a cycle is walked once.
			 * @returns {void}
			 * @private
			 *
			 * @example
			 * UnifiedWrapper._invalidateTree(wrapper, new Set());
			 */
			static _invalidateTree(wrapper, seen) {
				if (SetMethods.has(seen, wrapper)) return;
				SetMethods.add(seen, wrapper);
				for (let ofIndex = 0, ofList = Objects.keys(wrapper); ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					const descriptor = Objects.getOwnPropertyDescriptor(wrapper, key);
					const child = descriptor && "value" in descriptor ? resolveWrapper(descriptor.value) : null;
					if (child) UnifiedWrapper._invalidateTree(child, seen);
				}
				wrapper.___invalidate();
			}

			/**
			 * Keep the instance's lazy materialization count in step with this wrapper (#588). The wrapper
			 * records whether it is counted as unloaded (`pending`), counted and loaded (`settled`), or never
			 * counted, so each wrapper moves the count exactly once per transition no matter which path loads,
			 * re-arms or discards it. A wrapper from a tree a restart or a full reload replaced leaves the new tree's count alone.
			 * A member a forced replace hides from the api is `parked`: nothing can reach it to load it, so it is
			 * not counted until it is put back (`unpark`), and loading or re-arming it meanwhile leaves it parked.
			 * One hidden after it loaded is `parked-loaded`: out of the total while hidden, and back in it, loaded,
			 * once put back.
			 * @param {"register"|"loaded"|"rearm"|"discard"|"park"|"unpark"} event - What happened to the wrapper.
			 * @returns {void}
			 * @private
			 *
			 * @example
			 * wrapper.___trackLazyLoad("loaded");
			 */
			___trackLazyLoad(event) {
				const internal = this.____slothletInternal;
				const slothlet = this.____slothlet;
				if (internal.epoch !== (slothlet._buildEpoch ?? 0) || internal.lazyTally !== slothlet._lazyTally) return;
				const tracked = internal.lazyCount;
				if (event === "register") {
					// Called once, from the constructor of a lazy wrapper.
					internal.lazyCount = "pending";
					slothlet._registerLazyWrapper();
				} else if (event === "park") {
					// One that already loaded leaves the total too while hidden, and comes back loaded (#585 review).
					if (tracked === "settled") {
						internal.lazyCount = "parked-loaded";
						slothlet._onLoadedLazyWrapperParked();
						return;
					}
					if (tracked !== "pending") return;
					internal.lazyCount = "parked";
					slothlet._onLazyWrapperDiscarded();
				} else if (event === "unpark") {
					if (tracked === "parked-loaded") {
						internal.lazyCount = "settled";
						slothlet._registerLoadedLazyWrapper();
						return;
					}
					if (tracked !== "parked") return;
					// One loaded while hidden (through a reference held from before) counts again as already loaded:
					// it is back in the total without being waited on (#585 review).
					if (internal.state.materialized) {
						internal.lazyCount = "settled";
						slothlet._registerLoadedLazyWrapper();
					} else {
						internal.lazyCount = "pending";
						slothlet._registerLazyWrapper();
					}
				} else if (event === "loaded") {
					// A hidden wrapper loaded through a reference held from before stays parked, and so does every
					// wrapper it made in loading: they are off the api surface too (#585 review).
					if (tracked === "parked") this.___parkChildren();
					if (tracked !== "pending") return;
					internal.lazyCount = "settled";
					slothlet._onWrapperMaterialized();
				} else if (event === "rearm") {
					// Hidden and re-armed, it is hidden and unloaded: parked, still out of the count.
					if (tracked === "parked-loaded") {
						internal.lazyCount = "parked";
						return;
					}
					if (tracked === "pending" || tracked === "parked") return;
					internal.lazyCount = "pending";
					if (tracked === "settled") slothlet._onLazyWrapperRearmed();
					else slothlet._registerLazyWrapper();
				} else if (event === "discard") {
					// A hidden wrapper is already out of the count.
					if (tracked === "parked-loaded") {
						internal.lazyCount = undefined;
						return;
					}
					if (tracked !== "pending") return;
					internal.lazyCount = undefined;
					slothlet._onLazyWrapperDiscarded();
				}
			}

			/**
			 * Park the wrappers this parked wrapper holds as members, and theirs, so a hidden subtree's
			 * wrappers made after it was hidden are left out of the materialization count too (#585 review).
			 * Putting the member back unparks the whole subtree.
			 * @param {Set<object>} [seen] - Wrappers already visited.
			 * @returns {void}
			 * @private
			 *
			 * @example
			 * if (internal.lazyCount === "parked") wrapper.___parkChildren();
			 */
			___parkChildren(seen = setFrom([this])) {
				for (let ofIndex = 0, ofList = Objects.keys(this); ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					const descriptor = Objects.getOwnPropertyDescriptor(this, key);
					const child = descriptor && "value" in descriptor ? resolveWrapper(descriptor.value) : null;
					if (!child || SetMethods.has(seen, child)) continue;
					SetMethods.add(seen, child);
					child.___trackLazyLoad("park");
					child.___parkChildren(seen);
				}
			}

			/**
			 * @private
			 * @returns {void}
			 *
			 * @description
			 * Invalidates this wrapper when its parent removes the API path.
			 *
			 * @example
			 * wrapper.___invalidate();
			 */
			___invalidate() {
				// A discarded wrapper never loads, so it stops counting toward the materialization total (#588).
				this.___trackLazyLoad("discard");
				// Nor takes the changes queued for it, and the refusals of those made on it go with it (#653).
				this.____slothletInternal.pendingChanges = null;
				WeakMapMethods.get(PENDING_CHANGES, this.____slothlet) == null
					? undefined
					: SetMethods.delete(WeakMapMethods.get(PENDING_CHANGES, this.____slothlet), this);
				this.____slothletInternal.changeGeneration++;
				dropRefusedChanges(this);
				this.____slothletInternal.invalid = true;
				this.____slothletInternal.impl = null;
				this.____slothletInternal.nullish = null;
				// Clear all child properties from wrapper (filter internals)
				for (let ofIndex = 0, ofList = Reflect.ownKeys(this); ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					// All own properties on a wrapper are user-facing API names; internal state lives in #internal (private field), never in own keys.
					/* v8 ignore next */
					if (isFrameworkReservedKey(key)) {
						continue;
					}
					const descriptor = Objects.getOwnPropertyDescriptor(this, key);
					// ___adoptImplChildren always sets child properties with configurable:true; non-configurable branch is unreachable.
					/* v8 ignore next */
					if (descriptor?.configurable) {
						delete this[key];
					}
				}
			}

			/**
			 * Whether the value at `key` on this wrapper was assigned by the user rather than adopted from a
			 * module's impl (#543).
			 * @param {string} key - Own child key.
			 * @returns {boolean} True for a key assigned through the proxy outside a build (any value kind), or
			 *   holding a wrap-on-set `userAssigned` wrapper.
			 * @private
			 */
			___isUserAssignedKey(key) {
				if (
					this.____slothletInternal.userAssignedKeys == null ? undefined : SetMethods.has(this.____slothletInternal.userAssignedKeys, key)
				)
					return true;
				return resolveWrapper(this[key])?.____slothletInternal?.userAssigned === true;
			}

			/**
			 * @private
			 * @returns {void}
			 *
			 * @description
			 * Moves child properties off the impl and attaches them to wrapper as properties
			 * so this wrapper only represents the current API path.
			 *
			 * @example
			 * wrapper.___adoptImplChildren();
			 */
			___adoptImplChildren(forceReuseChildren = false) {
				const preExistingKeys = filterList(Objects.keys(this), (k) => !isFrameworkReservedKey(k));
				this.____slothlet.debug("wrapper", {
					key: "DEBUG_MODE_ADOPT_START",
					apiPath: this.____slothletInternal.apiPath,
					// Every wrapper is assigned a unique id at construction; "no-id" fallback is unreachable.
					/* v8 ignore next */
					wrapperId: this.____slothletInternal.id || "no-id",
					preExistingKeys: ArrayMethods.join(preExistingKeys, ","),
					collisionMode: this.____slothletInternal.state.collisionMode
				});

				// Cycle-guard set for this traversal: reuse the one threaded from the parent adopt (so a
				// cycle spanning parent→child is detected), else start fresh at the traversal root. Read the
				// threaded value and clear the field FIRST — before any early return — so a stale set never
				// persists onto a later ___setImpl-triggered re-adopt (which must start clean, or every
				// previously-seen value would look like a cycle). The fresh WeakSet is allocated lazily below,
				// only once an adoptable object/function impl is confirmed: the constructor calls this for
				// EVERY eager wrapper, so a primitive/opaque leaf must not pay a WeakSet allocation (#330). (#330 review)
				const threadedVisited = this.____slothletInternal.adoptVisited;
				this.____slothletInternal.adoptVisited = null;

				if (
					!this.____slothletInternal.impl ||
					(typeof this.____slothletInternal.impl !== "object" && typeof this.____slothletInternal.impl !== "function")
				) {
					return;
				}

				// A value with a callable `then`, its own or one it inherits (a class's method, a static `then`),
				// is refused: slothlet awaits api nodes (`await api.x` resolves the node, and lazy mode loads by
				// awaiting), so the node could not also be the value's own thenable (#571, #580 review). A `then`
				// holding data is adopted below as an ordinary member. Found by descriptor, never by reading it,
				// so a Proxy whose `get` answers every name (an RPC client) is left to its traps here; the lazy
				// materializer refuses one only where it would await it. A slothlet wrapper is not a module's
				// value: an unloaded one answers `then` through its waiting proxy.
				if (resolveWrapper(this.____slothletInternal.impl) === null && hasThenMember(this.____slothletInternal.impl)) {
					throw thenableExportError(this.____SlothletError, this.____slothletInternal.apiPath);
				}

				// If impl is a native Proxy (e.g., a version dispatcher), skip adoption entirely.
				// The getTrap already delegates all property access directly to the Proxy, so there
				// is nothing to "adopt" as children. Iterating ownKeys on a dispatcher proxy would
				// call its GET trap and potentially trigger user-supplied discriminator functions as a
				// side-effect during module setup — which must not happen.
				// A composition layer is slothlet's own Proxy over a module's value (see helpers/composition): the
				// named exports it holds are adopted like any member, and what it answers from the value under it
				// is left to its traps, as for any other Proxy.
				const uw_isLayer = isCompositionLayer(this.____slothletInternal.impl);
				/* v8 ignore next */
				if (!uw_isLayer && util.types.isProxy(this.____slothletInternal.impl)) return;

				// Arrays are transparent data leaves, not namespaces to compose. Adopting their indices as
				// child wrappers would rebuild them as array-likes ({0,1,length:0}, Array.isArray false) and
				// drop primitive members. Leave the array impl intact; ___createProxy gives it an array target
				// and getTrap delegates reads to it, so the wrapper stays opaque/faithful to the outside.
				if (Arrays.isArray(this.____slothletInternal.impl)) return;

				// An EventEmitter-derived impl (a real net.Socket, or any user class extending it) is
				// likewise never a namespace to eagerly decompose (#340) — regardless of deferChildAdopt,
				// i.e. regardless of whether it arrived via wrap-on-set or api.add(). Its own internal graph
				// (_events, _readableState, _handle, …) is deep and genuinely circular; walking it here is
				// exactly the #330 hang (a missing cycle guard originally, now a cycle guard that still has
				// to traverse a large native object graph before it can even detect anything). Skipping
				// adoption costs nothing: a named method (a custom subclass's own method, or an inherited
				// one like `.on`) still resolves correctly on actual access via getTrap's own per-property
				// lazy `___createChildWrapper` call — the exact same path arrays rely on for `.push` etc. —
				// so self/permission treatment is unaffected; only the eager, upfront, whole-object walk is
				// skipped. This also guarantees such an impl is never "depleted" by adoption's own
				// delete-on-adopt step, which is what makes the applyTrap `thisArg` substitution below safe
				// to extend to this same condition.
				if (EventEmitter && inherits(this.____slothletInternal.impl, EventEmitter)) return;
				// A class instance is a live object too (#589, #590): its methods and getters live on its prototype
				// and read and write the instance's own fields through `this`. Adopting would copy those fields
				// onto the wrapper and empty the impl, so methods would read nothing and the api would serve
				// stale copies. Members resolve per access through the get trap instead, against the instance.
				if (isClassInstance(this.____slothletInternal.impl)) return;

				// impl is confirmed adoptable (object/function, not proxy/array): allocate the cycle-guard set
				// now if one wasn't threaded in from a parent adopt — lazy so primitive leaves pay nothing (#330 review).
				const adoptVisited = threadedVisited || new WeakSet();

				const ownKeys = uw_isLayer ? layerHeldKeys(this.____slothletInternal.impl) : Reflect.ownKeys(this.____slothletInternal.impl);

				const internalKeys = setFrom([
					"____impl",
					"___setImpl",
					"___resetLazy",
					"___materialize",
					"____state",
					"____invalid",
					"____slothlet",
					"____slothletInternal"
				]);
				const keepImplProperties =
					typeof this.____slothletInternal.impl === "function" ||
					(this.____slothletInternal.impl &&
						typeof this.____slothletInternal.impl === "object" &&
						typeof this.____slothletInternal.impl.default === "function");
				if (
					keepImplProperties &&
					this.____slothletInternal.impl &&
					typeof this.____slothletInternal.impl === "object" &&
					typeof this.____slothletInternal.impl.default === "function"
				) {
					SetMethods.add(internalKeys, "default");
				}
				const observedKeys = new Set();

				// CRITICAL: Check stored collision mode to determine how to handle existing properties
				// - For "replace" mode: Clear existing properties before adopting new ones
				// - For "merge" or "merge-replace": Keep existing properties and merge
				const existingKeys = filterList(Objects.keys(this), (k) => !isFrameworkReservedKey(k));
				const storedCollisionMode = this.____slothletInternal.state.collisionMode; // Set during collision in api-assignment.mjs
				const isMergeScenario = storedCollisionMode !== "replace" && existingKeys.length > 0;

				this.____slothlet.debug("wrapper", {
					key: "DEBUG_MODE_ADOPT",
					apiPath: this.____slothletInternal.apiPath,
					mode: this.____slothletInternal.mode,
					storedCollisionMode,
					existingKeys: ArrayMethods.join(existingKeys, ","),
					isMergeScenario
				});

				// If collision mode is "replace", clear existing properties from collision
				// CRITICAL: Save existing child wrapper references BEFORE deleting so they can be
				// reused during adoption to preserve proxy identity (reference stability across reload).
				const savedChildren = new Map();
				if (storedCollisionMode === "replace" && existingKeys.length > 0) {
					this.____slothlet.debug("wrapper", {
						key: "DEBUG_MODE_ADOPT_REPLACE_CLEARING",
						count: existingKeys.length
					});

					for (let ofIndex = 0, ofList = existingKeys; ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						// A value the user assigned onto this wrapper is not a stale child of the replaced content —
						// it belongs to neither module (a lazy wrapper can be assigned to while its materialization is
						// still in flight, and only then does this adoption run). Keep it, and mark it observed so the
						// sweep below leaves it alone too (#543). A key the new impl also provides is still resolved
						// by the per-key loop, which keeps a userAssigned wrapper over the module's value.
						if (this.___isUserAssignedKey(key)) {
							SetMethods.add(observedKeys, key);
							continue;
						}
						const child = this[key];
						if (resolveWrapper(child) !== null) {
							MapMethods.set(savedChildren, key, child);
						}
						const descriptor = Objects.getOwnPropertyDescriptor(this, key);
						if (descriptor?.configurable) {
							delete this[key];
						}
					}
					// Don't add to observedKeys - let them be replaced
				} else {
					// For merge modes, add existing wrapper keys to observedKeys so they don't get deleted
					for (let ofIndex = 0, ofList = existingKeys; ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						SetMethods.add(observedKeys, key);
					}
				}

				// Define metadata/helper keys that should never be adopted as children
				const metadataKeys = setFrom(["____childFilePaths", "____filePath", "____childFilePathsPreMaterialize"]);
				const skipKeys = typeof this.____slothletInternal.impl === "function" ? setFrom(["length", "name", "prototype"]) : null;

				for (let ofIndex = 0, ofList = ownKeys; ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					if (SetMethods.has(internalKeys, key)) {
						continue;
					}
					// A name with the framework's prefix (`___` / `____`) is never a member: the wrapper's own members carry it,
					// and a child under such a name would stand in for one of them. An object's own member leaves it as an
					// adopted one does, so no read or listing of the node reaches it through the impl either.
					if (isFrameworkName(key) && !(isFrameworkMarkerKey(key) && isFrameworkInternal(this))) {
						if (typeof this.____slothletInternal.impl === "object" && !uw_isLayer) {
							const reservedDescriptor = Objects.getOwnPropertyDescriptor(this.____slothletInternal.impl, key);
							if (reservedDescriptor?.configurable) delete this.____slothletInternal.impl[key];
						}
						continue;
					}
					// Skip metadata/helper keys
					if (typeof key === "string" && SetMethods.has(metadataKeys, key)) {
						continue;
					}
					if (skipKeys && typeof key === "string" && SetMethods.has(skipKeys, key)) {
						continue;
					}
					// DEFENSIVE: ____impl might have changed during iteration (shouldn't happen, but safety first)
					// `impl` does not change during iteration; this guard is structurally unreachable.
					/* v8 ignore start */
					if (
						!this.____slothletInternal.impl ||
						(typeof this.____slothletInternal.impl !== "object" && typeof this.____slothletInternal.impl !== "function")
					) {
						break;
					}
					/* v8 ignore stop */
					const descriptor = Objects.getOwnPropertyDescriptor(this.____slothletInternal.impl, key);
					// `Object.keys(impl)` only returns own enumerable properties that always have a descriptor; `!descriptor` is unreachable.
					/* v8 ignore start */
					if (!descriptor) {
						continue;
					}
					/* v8 ignore stop */
					// A callable `then` would make the node awaitable (#571); the guard above already refused one the
					// impl holds or inherits, so this only meets a nested shape's. A `then` holding data (a JSON
					// Schema `if`/`then`/`else`) is an ordinary member. It runs before the non-enumerable skip
					// below, which would otherwise pass a class's static `then`.
					if (key === "then" && isAwaitableThen(descriptor)) {
						throw thenableExportError(this.____SlothletError, `${this.____slothletInternal.apiPath}.then`);
					}
					// A function's non-enumerable own properties are its own surface, not child endpoints — the
					// same rule the get trap applies (#304). Beyond `length`/`name`/`prototype` (skipped above),
					// this covers a module's own `Object.defineProperty(fn, k, { enumerable: false })` and the own
					// `arguments`/`caller` every sloppy-mode (CommonJS) function carries on Node 22; adopting them
					// made them enumerable api children that `Object.keys()` and typegen reported.
					if (typeof this.____slothletInternal.impl === "function" && !descriptor.enumerable) {
						continue;
					}
					// An accessor becomes an accessor on the wrapper that runs the impl's own getter on every read and
					// its setter on every write, as in plain JavaScript; adopting its value would store what it returned
					// at load (#590), and drop the setter. It stays on the
					// impl, and keeps its place among the members. It runs with the api node as `this`, as a method
					// does: adoption moves the object's other members onto the wrapper and deletes them from the impl,
					// so a getter reading `this.items` would find them gone on the impl.
					if (typeof descriptor.get === "function" || typeof descriptor.set === "function") {
						SetMethods.add(observedKeys, key);
						// A member the other side of a collision won (`collisionMergedKeys`) keeps its place, as a data
						// member does below; the getter is left unadopted (#585 review).
						if (
							hasOwn(this, key) &&
							(this.____slothletInternal.collisionMergedKeys
								? SetMethods.has(this.____slothletInternal.collisionMergedKeys, key)
								: false) &&
							!forceReuseChildren
						) {
							delete this.____slothletInternal.impl[key];
							continue;
						}
						defineAdoptedAccessor(this, key, descriptor);
						continue;
					}
					const value = this.____slothletInternal.impl[key];
					// A value that IS the impl itself (circular reference) never appears in module exports; this guard is unreachable.
					/* v8 ignore start */
					if (value === this.____slothletInternal.impl) {
						continue;
					}
					/* v8 ignore stop */
					// Skip logging if key is a symbol (can't convert to string)
					// Symbol keys are not used as API module names in practice.
					/* v8 ignore next */
					if (typeof key !== "symbol") {
						this.____slothlet.debug("wrapper", {
							key: "DEBUG_MODE_ADOPT_PROCESS",
							apiPath: this.____slothletInternal.apiPath,
							propKey: key,
							typeOf: typeof value,
							valueName: value?.name
						});
					}
					SetMethods.add(observedKeys, key);

					// CRITICAL: Check if wrapper already has this key (from collision merge)
					// Use hasOwn to avoid matching ComponentBase prototype getters (config, debug)
					if (hasOwn(this, key) && !isFrameworkReservedKey(key)) {
						// Check if this is a collision-merged property (from file)
						// Skip logging if key is a symbol
						// Symbol keys are not used as API module names in practice.
						/* v8 ignore next */
						if (typeof key !== "symbol") {
							this.____slothlet.debug("wrapper", {
								key: "DEBUG_MODE_ADOPT_CHECK",
								apiPath: this.____slothletInternal.apiPath,
								propKey: key,
								has__collisionMergedKeys: !!this.____slothletInternal.collisionMergedKeys,
								inSet: this.____slothletInternal.collisionMergedKeys
									? SetMethods.has(this.____slothletInternal.collisionMergedKeys, key)
									: false
							});
						}
						const isCollisionMerged =
							this.____slothletInternal.collisionMergedKeys && SetMethods.has(this.____slothletInternal.collisionMergedKeys, key);

						if (isCollisionMerged && !forceReuseChildren) {
							// Collision-merged means this key came from file exports that won during merge.
							// The file's version takes precedence - do NOT update with the folder's version.
							// Exception: when forceReuseChildren=true (explicit ___setImpl call), the caller
							// is deliberately overriding - propagate to all child wrappers regardless.
							// Symbol keys are not used as API module names in practice.
							/* v8 ignore next */
							if (typeof key !== "symbol") {
								this.____slothlet.debug("wrapper", {
									key: "DEBUG_MODE_ADOPT_SKIP_COLLISION_MERGED",
									apiPath: this.____slothletInternal.apiPath,
									propKey: key
								});
							}
							// `descriptor.configurable` is always true for module-exported properties; non-configurable props are unreachable here.
							/* v8 ignore next */
							if (descriptor.configurable) {
								delete this.____slothletInternal.impl[key];
							}
							continue;
						}
						// Property exists but is NOT collision-merged
						// This could be from a previous materialization or folder children that should coexist
						// DON'T skip - fall through to add folder child alongside file properties
						// Symbol keys are not used as API module names in practice.
						/* v8 ignore next */
						if (typeof key !== "symbol") {
							this.____slothlet.debug("wrapper", {
								key: "DEBUG_MODE_ADOPT_ALLOW_NOT_COLLISION_MERGED",
								apiPath: this.____slothletInternal.apiPath,
								propKey: key
							});
						}
					}

					// A function further up the tree is the node there, as in plain JS: never a new node below (its own function
					// is skipped above, and served by the get trap).
					const cycleNode = nodeInCycle(this, value, false);
					if (cycleNode !== null) {
						Objects.defineProperty(this, key, {
							__proto__: null,
							value: cycleNode.___createProxy(),
							writable: false,
							enumerable: true,
							configurable: true
						});
						continue;
					}

					// CRITICAL: Check if child wrapper already exists to maintain live binding
					// If it exists, update its implementation instead of creating new wrapper
					// Also check savedChildren map for wrappers saved before replace-mode deletion.
					// IMPORTANT: Check savedChildren FIRST because after replace-mode deletion of
					// own properties, prototype getters (e.g. ComponentBase's '____config', 'debug')
					// shadow the lookup - this[key] returns the prototype getter result (truthy
					// but not a wrapper), preventing the || fallback from reaching savedChildren.
					const existingChild = MapMethods.get(savedChildren, key) || this[key];
					let wrapped;

					// LAZY REFERENCE CONTRACT: In lazy+replace mode (reload), do NOT reuse
					// existing child wrappers - create fresh ones so references break.
					// In merge mode (multi-cache subsequent modules), reuse children from
					// the current reload cycle so keys from prior modules aren't lost.
					const skipChildReuse =
						(!forceReuseChildren && this.____slothletInternal.mode === "lazy" && storedCollisionMode === "replace") ||
						// A sealed or frozen child cannot take the reloaded value under its fixed shell; the api gets a new node,
						// and a reference still held to the old one keeps the object it was, as it would in plain JS.
						(existingChild !== undefined && resolveWrapper(existingChild) !== null && !Reflect.isExtensible(existingChild));

					const existingChildUA = existingChild ? resolveWrapper(existingChild) : null;
					if (existingChildUA?.____slothletInternal?.userAssigned) {
						// A user-assigned wrap-on-set override at this key shadows the module path — preserve it
						// verbatim across reload; do NOT merge the reloaded module's value into it (#329).
						wrapped = existingChild;
					} else if (!skipChildReuse && existingChild && resolveWrapper(existingChild) !== null) {
						// Reuse existing wrapper - update its implementation to maintain live binding
						// CRITICAL: If value is one of our wrapper proxies, extract its raw ____impl instead
						// of passing the proxy to ___setImpl - doing so causes infinite recursion in getTrap.
						if (resolveWrapper(value) !== null) {
							// Extract the raw impl from the new wrapper proxy or raw wrapper instance.
							const newWrapper = resolveWrapper(value);
							// `newWrapper` is always truthy here because the outer guard `resolveWrapper(value) !== null` already passes.
							/* v8 ignore next */
							let rawImpl = newWrapper ? newWrapper.____slothletInternal.impl : null;

							// CRITICAL: ____impl may be depleted - ___adoptImplChildren moves children from
							// ____impl onto the wrapper as own properties and deletes them from ____impl.
							// When ____impl is an empty object but the wrapper has own enumerable keys,
							// use _extractFullImpl to reconstruct the complete impl from the wrapper tree.
							if (
								rawImpl &&
								typeof rawImpl === "object" &&
								!Arrays.isArray(rawImpl) &&
								typeof rawImpl !== "function" &&
								filterList(Objects.keys(rawImpl), (k) => !isFrameworkReservedKey(k)).length === 0
							) {
								const wrapperOwnKeys = filterList(Objects.keys(newWrapper), (k) => !isFrameworkReservedKey(k));
								// A depleted impl always means the wrapper has its own keys (those being the "depletees"); `length===0` is unreachable.
								/* v8 ignore next */
								if (wrapperOwnKeys.length > 0) {
									rawImpl = UnifiedWrapper._extractFullImpl(newWrapper);
								}
							}

							// When `rawImpl` is null, the new wrapper is always lazy (has `materializeFunc`); the else branch is a structurally impossible state.
							/* v8 ignore start */
							if (rawImpl !== null && rawImpl !== undefined) {
								// Same stale-signature fix as the sibling call below: pass the child's real owner
								// (the parent's moduleID) and force child reuse, not `this.____slothlet` (which the
								// guard coerced to "[object Object]", registering a garbage ownership entry on the
								// namespace children of every reloaded module).
								resolveWrapper(existingChild).___setImpl(
									rawImpl,
									this.____slothletInternal.adoptOwner ?? this.____slothletInternal.moduleID,
									true,
									this.____slothletInternal.adoptOwner != null
								);
								// The reused node fronts the module's object the new node did (#746).
								resolveWrapper(existingChild).____slothletInternal.moduleObject = newWrapper.____slothletInternal.moduleObject ?? null;
							} else if (newWrapper && newWrapper.____slothletInternal.materializeFunc) {
								// Lazy wrapper not yet materialized - fully reset existing child to lazy
								// state using ___resetLazy for proper cleanup (clears stale ____impl,
								// children, caches, and inFlight flag before swapping materializeFunc).
								const existingChildWrapper = resolveWrapper(existingChild);
								// `existingChild` is always a valid wrapper proxy here, so `resolveWrapper` is always non-null.
								/* v8 ignore next */
								if (existingChildWrapper) {
									existingChildWrapper.___resetLazy(
										newWrapper.____slothletInternal.materializeFunc,
										newWrapper.____slothletInternal.memberNames
									);
								}
							}
							/* v8 ignore stop */
							// The existing child is kept and the new wrapper is dropped: an unloaded new wrapper must stop
							// counting toward the materialization total, or remaining never reaches 0 (#588).
							newWrapper.___trackLazyLoad("discard");
							wrapped = existingChild;
						} else {
							// ___setImpl's signature is (newImpl, moduleID, forceReuseChildren) — this call was
							// written against an older shape and passed `this.____slothlet` (the instance) as the
							// moduleID, whose String() coercion in the guard below became "[object Object]" and
							// registered a garbage ownership entry on every reload. Pass the child's real owner
							// (the parent's moduleID) and force child reuse — reference preservation is the intent
							// here (adopting existing children during a reload), matching the doc's guidance.
							resolveWrapper(existingChild).___setImpl(
								value,
								this.____slothletInternal.adoptOwner ?? this.____slothletInternal.moduleID,
								true,
								this.____slothletInternal.adoptOwner != null
							);
							// The reused node fronts the module's object its new value is, or was copied from (#746).
							resolveWrapper(existingChild).____slothletInternal.moduleObject = moduleObjectFor(resolveWrapper(existingChild), value, true);
							wrapped = existingChild;
						}
						// Symbol keys are not used as API module names in practice.
						/* v8 ignore next */
						if (typeof key !== "symbol") {
							this.____slothlet.debug("wrapper", {
								key: "DEBUG_MODE_ADOPT_REUSE_CHILD_WRAPPER",
								apiPath: this.____slothletInternal.apiPath,
								propKey: key
							});
						}
					} else {
						// No existing wrapper - create new one. Thread THIS wrapper's own deferChildAdopt
						// through (mirrors every other ___createChildWrapper call site): without it, a
						// primitive child adopted during an eager walk running against an already-deferred
						// wrapper (e.g. ___applyNewImpl reused-child reuse below) would always build a full
						// nested wrapper regardless of deferChildAdopt, and the `wrapped === null` branch
						// just below — which defines the live-forwarding accessor for exactly this case —
						// would never fire (#340).
						// A child wrapper this one replaces (a lazy reload builds fresh nodes) is another node from now on (#653).
						const displaced = existingChild ? resolveWrapper(existingChild) : null;
						if (displaced) displaced.___retireChanges();
						wrapped = this.___createChildWrapper(key, value, adoptVisited, this.____slothletInternal.deferChildAdopt);
						// Symbol keys are not used as API module names in practice.
						/* v8 ignore next */
						if (typeof key !== "symbol") {
							this.____slothlet.debug("wrapper", {
								key: "DEBUG_MODE_ADOPT_WRAP",
								apiPath: this.____slothletInternal.apiPath,
								propKey: key,
								wrapped: wrapped ? "YES" : wrapped === null ? "NULL" : "NO"
							});
						}
					}

					if (wrapped) {
						// Store wrapper as property on wrapper itself (where proxy handlers can see it)
						// Only define if property doesn't exist or is different wrapper
						const existing = this[key];
						const existingDescriptor = Objects.getOwnPropertyDescriptor(this, key);

						// Skip if property exists with same wrapper, or if it's non-configurable (like 'slothlet' from ComponentBase)
						// existingDescriptor is always null/undefined when existing !== wrapped; the && branch never evaluates.
						/* v8 ignore next */
						if (existing === wrapped || (existingDescriptor && !existingDescriptor.configurable)) {
							// Symbol keys are not used as API module names in practice.
							/* v8 ignore next */
							if (typeof key !== "symbol") {
								this.____slothlet.debug("wrapper", {
									key:
										existingDescriptor && !existingDescriptor.configurable
											? "DEBUG_MODE_ADOPT_SKIP_NON_CONFIGURABLE"
											: "DEBUG_MODE_ADOPT_SKIP_SAME_WRAPPER",
									apiPath: this.____slothletInternal.apiPath,
									propKey: key
								});
							}
						} else {
							// Symbol keys are not used as API module names in practice.
							/* v8 ignore next */
							if (typeof key !== "symbol") {
								this.____slothlet.debug("wrapper", {
									key: "DEBUG_MODE_ADOPT_DEFINE",
									apiPath: this.____slothletInternal.apiPath,
									propKey: key
								});
							}
							Objects.defineProperty(this, key, { __proto__: null, value: wrapped, writable: false, enumerable: true, configurable: true });
							// Symbol keys are not used as API module names in practice.
							/* v8 ignore next */
							if (typeof key !== "symbol") {
								this.____slothlet.debug("wrapper", {
									key: "DEBUG_MODE_ADOPT_DEFINED",
									apiPath: this.____slothletInternal.apiPath,
									propKey: key
								});
							}
						}
						// `keepImplProperties` is always false when called from ___setImpl; this guard is unreachable.
						/* v8 ignore next */
						if (descriptor.configurable && !keepImplProperties && this.____slothletInternal.impl) {
							delete this.____slothletInternal.impl[key];
						}
					} else if (
						wrapped === null &&
						this.____slothletInternal.deferChildAdopt &&
						(value === null || (typeof value !== "object" && typeof value !== "function"))
					) {
						// A primitive (or `null` — `typeof null === "object"`, so it must be checked
						// separately or it falls through to the opaque-builtin snapshot branch below) has no
						// distinct identity to alias by reference (unlike an opaque-builtin object below,
						// where storing the same reference is inherently live) — a static snapshot here would
						// desync the moment either side writes independently. Define a live forwarding
						// accessor against the CURRENT impl instead (#340): reads/writes always resolve through
						// `this.____slothletInternal.impl`, not a captured local, so this stays correct across an
						// impl swap from reload/___applyNewImpl. Nothing to `delete` from impl — the accessor reads
						// the live value from there, so impl must keep it.
						//
						// Scoped to a wrap-on-set-grafted subtree (`deferChildAdopt`) only: ORDINARY eager/lazy
						// module and folder loading never has this branch actually run for a top-level primitive
						// (the deferred wrap-on-set getTrap read path already gives THAT case live two-way
						// binding independently, without ever calling ___adoptImplChildren — see the getTrap
						// "Null fallback" comment below). Applying the accessor unconditionally here instead
						// broke `api.leaves()`'s "data" leaf classification for every ordinary primitive export
						// (`shop.limit`, `mod.plain`, `billing.internals.currency`, …), which reads
						// `Object.getOwnPropertyDescriptor(...).value` to classify a leaf — undefined for an
						// accessor. Keeping the original static-value shape for the non-deferred case avoids
						// that regression while still covering whatever deferred/`___applyNewImpl`-reload
						// interaction this branch exists for.
						Objects.defineProperty(this, key, {
							__proto__: null,
							get: () => {
								const currentImpl = this.____slothletInternal.impl;
								return currentImpl ? currentImpl[key] : undefined;
							},
							set: (newValue) => {
								const currentImpl = this.____slothletInternal.impl;
								if (currentImpl) currentImpl[key] = newValue;
							},
							enumerable: true,
							configurable: true
						});
					} else if (wrapped === null) {
						// ___createChildWrapper returned null for an opaque-builtin object (Map/Set/Date/…) or an
						// explicit `null` value — both are stored unwrapped. Object identity itself keeps a
						// builtin live (mutating the same Map is visible from every reference to it); nothing
						// further is needed the way the primitive branch above needs a live accessor.
						Objects.defineProperty(this, key, { __proto__: null, value: value, writable: false, enumerable: true, configurable: true });
						// `keepImplProperties` is always false when called from ___setImpl; this guard is unreachable.
						/* v8 ignore next */
						if (descriptor.configurable && !keepImplProperties && this.____slothletInternal.impl) {
							delete this.____slothletInternal.impl[key];
						}
					} else {
						// wrapped is falsy but not null - shouldn't happen, but define value anyway
						Objects.defineProperty(this, key, { __proto__: null, value: value, writable: false, enumerable: true, configurable: true });
						// wrapped=false (shouldn't happen) — `keepImplProperties` is always false when called from ___setImpl; guard is unreachable.
						/* v8 ignore next */
						if (descriptor.configurable && !keepImplProperties && this.____slothletInternal.impl) {
							delete this.____slothletInternal.impl[key];
						}
					}
				}

				// Only clean up unobserved keys if this is NOT a merge scenario
				// In merge mode (isMergeScenario=true), we want to keep ALL existing entries
				if (!isMergeScenario) {
					const currentKeys = filterList(Objects.keys(this), (k) => !isFrameworkReservedKey(k));
					for (let ofIndex = 0, ofList = currentKeys; ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						if (!SetMethods.has(observedKeys, key)) {
							const existing = this[key];
							const existingRaw = resolveWrapper(existing);
							// In the cleanup path, `existing` is always a wrapper proxy (it was defined from a prior ___setImpl); `existingRaw` is never null here.
							/* v8 ignore next */
							if (existingRaw) {
								existingRaw.___invalidate();
							}
							const descriptor = Objects.getOwnPropertyDescriptor(this, key);
							// Unreachable in practice: properties that reach this point are
							// synthesised through the Proxy get-trap from the wrapper's impl,
							// so they have no own property descriptor on the target object (or
							// are non-configurable). descriptor?.configurable is therefore always
							// falsy here, and delete is never executed in any test scenario.
							/* v8 ignore next */
							if (descriptor?.configurable) {
								delete this[key];
							}
						}
					}
				}

				// Handle merge-after-materialize for lazy wrappers in merge-replace mode
				if (this._mergeAfterMaterialize) {
					const { existingWrapper, isMergeReplace: ____isMergeReplace } = this._mergeAfterMaterialize;

					// Now that this wrapper has materialized with its own keys,
					// add non-conflicting keys from the existing wrapper
					const existingKeys = filterList(Objects.keys(existingWrapper), (k) => !isFrameworkReservedKey(k));
					for (let ofIndex = 0, ofList = existingKeys; ofIndex < ofList.length; ofIndex++) {
						const key = ofList[ofIndex];
						if (!(key in this)) {
							const child = existingWrapper[key];
							Objects.defineProperty(this, key, { __proto__: null, value: child, writable: false, enumerable: true, configurable: true });
						}
					}

					// Clear the merge info
					delete this._mergeAfterMaterialize;
				}
			}

			/**
			 * Adopt one member of another value (a collision's losing callable) onto this node the way the node's own
			 * members are adopted: an accessor stays an accessor, run on every read with the node as `this`; an object or
			 * function becomes a child node at this node's path and the member's key; anything else is held as it is.
			 *
			 * @private
			 * @param {string} key - The member's key.
			 * @param {object|Function} source - The value holding the member.
			 * @returns {void}
			 *
			 * @description
			 * A callable folder module that puts members on its own function (`fn.live` as a getter, `fn.me = fn`) keeps
			 * them on its impl, where the get trap serves them live and wraps a function or object as a child. When that
			 * folder loses its slot in a collision, its members move to the node that kept the slot; copying their values
			 * would freeze a getter at the value it had and hand out a self-reference as the bare function (#874).
			 *
			 * @example
			 * keptWrapper.___adoptForeignMember("live", losingFn);
			 */
			___adoptForeignMember(key, source) {
				const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
				// The caller passes one of the source's own enumerable keys. A module's Proxy function whose traps disagree can
				// still describe none for it; that case is guarded, and the suite composes no such module.
				/* v8 ignore next */
				if (descriptor === undefined) return;
				if (!("value" in descriptor)) {
					defineAdoptedAccessor(this, key, descriptor);
					return;
				}
				const value = descriptor.value;
				let stored = value;
				// The losing function's reference to itself, or to a function further up, is the node that holds it now. A layer
				// over the function hands it out bound to the function under it.
				const cycle = (layerMethodOriginal(value) ?? value) === layerUnderlying(source) ? this : nodeInCycle(this, value);
				if (cycle !== null) stored = cycle.___createProxy();
				else if (
					value !== null &&
					(typeof value === "object" || typeof value === "function") &&
					!util.types.isProxy(value) &&
					resolveWrapper(value) === null
				) {
					const wrapped = this.___createChildWrapper(key, value, null, this.____slothletInternal.deferChildAdopt);
					// A built-in data object or an error is held as it is, as the get trap holds one.
					if (wrapped !== null && wrapped !== undefined) stored = wrapped;
				}
				Objects.defineProperty(this, key, { __proto__: null, value: stored, writable: false, enumerable: true, configurable: true });
			}

			/**
			 * @private
			 * @param {string|symbol} key - Child property name
			 * @param {unknown} value - Child value
			 * @param {WeakSet<object>|null} [visited=null] - Cycle-guard set threaded through an eager adopt
			 *   traversal so a self-referential value cannot recurse forever (#330); null outside a traversal.
			 * @param {boolean} [deferChildAdopt=false] - Defer the child's own eager adoption to first getTrap
			 *   access, so a deep wrap-on-set graft is wrapped one level per access instead of recursively (#329).
			 * @returns {Object|Function|null|undefined} Wrapped child proxy, or null/undefined when the value is
			 *   stored unwrapped (opaque built-ins, null, cycle bail-out) or is undefined.
			 *
			 * @description
			 * Creates a child wrapper for impl values, including primitives.
			 *
			 * @example
			 * const child = wrapper.___createChildWrapper("add", fn);
			 */
			___createChildWrapper(key, value, visited = null, deferChildAdopt = false) {
				if (value === undefined) {
					return undefined;
				}

				// A bare null has no properties to wrap — store it unwrapped (return null is
				// the caller's "store as-is" signal), the same handling as undefined above.
				// Without this, null falls through to the object-wrapping path (its typeof is
				// "object") and an exported `null` would surface to readers as an empty `{}`.
				if (value === null) {
					return null;
				}

				if (value && resolveWrapper(value) !== null) {
					return value;
				}

				// Return null for built-in objects that require proper 'this' binding
				// Returning null signals to the caller to store the value unwrapped
				// These include: Map, Set, WeakMap, WeakSet, Date, RegExp, Promise, Error, TypedArrays.
				// EventEmitter is deliberately NOT in this list (#340, applies to BOTH wrap-on-set AND
				// api.add() — see the issue title): the #330 hang it used to guard against was actually
				// caused by the eager walk's missing cycle guard (now present below), not by
				// EventEmitter-ness, and excluding the whole prototype chain unconditionally blocked
				// `self`/permission treatment for any EventEmitter-derived value, including a live
				// `net.Socket` mounted via `api.add()` — which is meant to get full slothlet treatment
				// (self access, permission gating, hooks) same as any other mounted object, not stay
				// raw/opaque. The cycle guard is what makes this safe now, not type-based exclusion.
				if (dataKind(value) !== null || isErrorValue(value)) {
					return null;
				}

				// Deferred wrap-on-set subtree (#340): a primitive bails to null here, the same signal the
				// opaque-builtin case above gives. This path is only reachable via ___adoptImplChildren's
				// EAGER wrapped-child walk running against an already-deferred wrapper (e.g. a collision's
				// existing-child-reuse calling ___setImpl -> ___applyNewImpl on it) — the deferred getTrap
				// read path never reaches this function for a primitive at all, since its own earlier
				// terminal-value fast path already returns one directly. Without this bail, that eager walk
				// would build a full nested wrapper for the primitive instead of returning null, so
				// ___adoptImplChildren's dedicated deferred-primitive live-accessor branch (which requires
				// `wrapped === null` to fire) would never trigger, silently reintroducing a static, dead
				// snapshot for exactly the case #340 exists to keep live.
				if (deferChildAdopt && typeof value !== "object" && typeof value !== "function") {
					return null;
				}

				// NOTE (#340): an ORDINARY (non-deferred) primitive value reaching this function still
				// builds a full nested UnifiedWrapper below — an attempted early-return here for ALL
				// primitives (treating them like the opaque-builtin case above, not scoped to
				// deferChildAdopt) was tried and reverted. It provided no benefit toward live wrap-on-set
				// delegation (see the deferChildAdopt-scoped bail above, which covers that case) and broke
				// api.leaves()'s "data" leaf classification for every ordinary primitive export, which
				// depends on ___adoptImplChildren adopting a real child wrapper for the ownership registry
				// to key off.

				// Cycle guard: if this exact value is already an ANCESTOR on the current descent path we are
				// about to recurse into a self-reference (a circular plain object, or a shared internal
				// graph) — store it unwrapped rather than descend forever. Tracked for both objects AND
				// functions: a callable namespace (a function carrying enumerable props) has its children
				// adopted just like a plain object, so an indirect cycle running through functions
				// (funcA.b → funcB, funcB.a → funcA) recurses unguarded unless functions are tracked too
				// (value is already non-null here — the null/undefined and opaque built-in bail-outs above
				// returned; WeakSet accepts both objects and functions as keys). Ancestor-scoped — added
				// before the descent and removed after — so a value merely shared across sibling keys is not
				// bailed, only a genuine cycle is. The guard set is allocated lazily and only when a value is
				// actually descended into, so the getTrap caller (which omits `visited`) pays nothing for
				// primitives / opaque values (#330).
				const trackCycle = typeof value === "object" || typeof value === "function";
				if (trackCycle) {
					visited ??= new WeakSet();
					if (WeakSetMethods.has(visited, value)) {
						return null;
					}
				}

				// No clone WITHIN a wrap-on-set-grafted subtree (`deferChildAdopt`, #340) — mirrors the
				// constructor's own no-clone change: `childImpl` becomes the nested wrapper's live impl
				// reference verbatim, so a child value several levels deep stays two-way live with its
				// original reference. OUTSIDE a deferred subtree (ordinary eager module/folder adoption,
				// api.add()), still clone — nested wrappers are always constructed `mode: "eager"`
				// regardless of the instance's own lazy/eager setting, so this was the actual clone site
				// protecting a caller-owned nested object (e.g. `api.add("shop", { exports: { ns: {...} }
				// })`'s `ns`) from ___adoptImplChildren's destructive delete-on-adopt step.
				//
				// ALSO skip the clone for an EventEmitter-derived child regardless of deferChildAdopt
				// (#340) — same rationale as the constructor's own EventEmitter clause above: a live
				// `net.Socket`/EventEmitter mounted as a child via api.add() needs its real, uncloned
				// identity for native methods and `instanceof` to keep working, and it was never the
				// "namespace container" the delete-on-adopt protection exists for.
				//
				// An array is never cloned: adoption never takes anything from an array (its elements stay on
				// it), so there is nothing to protect, and the wrapper must front the module's own array so a
				// write through the api reaches it, as a write to the array itself would (#602).
				let childImpl = value;
				const isChildLiveIdentity = deferChildAdopt || (EventEmitter && inherits(childImpl, EventEmitter));
				if (!isChildLiveIdentity && childImpl && typeof childImpl === "object" && !Arrays.isArray(childImpl)) {
					childImpl = copyForComposition(childImpl);
					// Let an origin lookup against the clone resolve to the exported original (#484).
					if (childImpl !== value) this.____slothlet.handlers?.ownership?.noteClone(childImpl, value);
				}

				// Get parent wrapper's metadata to inherit filePath and moduleID
				const parentMetadata = this.____slothlet.handlers?.metadata?.getSystemMetadata(this);

				// Try to get child's actual filePath from its own metadata first (if already tagged during materialization)
				const childExistingMetadata = this.____slothlet.handlers?.metadata?.getSystemMetadata(value);
				let childFilePath = childExistingMetadata?.filePath || null;
				let childModuleId = null;

				if (!childFilePath) {
					// No existing metadata on child - try ____childFilePaths map from lazy materialization
					// Symbol keys are not used as API module names; this guard is unreachable in practice.
					/* v8 ignore next */
					const keyStr = typeof key === "symbol" ? String(key) : key;
					this.____slothlet.debug("wrapper", {
						key: "DEBUG_MODE_WRAP_CHILD_PATH_CHECK",
						apiPath: this.apiPath,
						propKey: keyStr,
						has_impl: !!this.____slothletInternal.impl,
						has__childFilePaths: !!(this.____slothletInternal.impl && this.____slothletInternal.impl.____childFilePaths),
						has__childFilePathsPreMaterialize: !!this.____slothletInternal.childFilePathsPreMaterialize,
						parentFilePath: parentMetadata?.filePath
					});
					if (this.____slothletInternal.impl && this.____slothletInternal.impl.____childFilePaths) {
						this.____slothlet.debug("wrapper", {
							key: "DEBUG_MODE_WRAP_CHILD_PATH_AVAILABLE",
							keys: ArrayMethods.join(Objects.keys(this.____slothletInternal.impl.____childFilePaths), ","),
							propKey: keyStr,
							found: !!this.____slothletInternal.impl.____childFilePaths[key]
						});
					}
					// ____childFilePaths[key] is only populated when impl has child path data; the false arm is unreachable in tests.
					/* v8 ignore next */
					if (
						this.____slothletInternal.impl &&
						this.____slothletInternal.impl.____childFilePaths &&
						this.____slothletInternal.impl.____childFilePaths[key]
					) {
						childFilePath = this.____slothletInternal.impl.____childFilePaths[key];
						this.____slothlet.debug("wrapper", {
							key: "DEBUG_MODE_WRAP_CHILD_PATH_USING",
							childFilePath
						});
						// `childFilePathsPreMaterialize[key]` is only populated during the pre-materialization phase for deferred-child wrappers; this branch is structurally unreachable in tests.
						/* v8 ignore start */
					} else if (
						this.____slothletInternal.childFilePathsPreMaterialize &&
						this.____slothletInternal.childFilePathsPreMaterialize[key]
					) {
						// Check pre-materialize mapping from collision merge
						childFilePath = this.____slothletInternal.childFilePathsPreMaterialize[key];
						this.____slothlet.debug("wrapper", {
							key: "DEBUG_MODE_WRAP_CHILD_PATH_PRE_MAT",
							childFilePath
						});
						/* v8 ignore stop */
					} else {
						// Fall back to parent's filePath (will be directory path for lazy wrappers)
						childFilePath = parentMetadata?.filePath || null;
						this.____slothlet.debug("wrapper", {
							key: "DEBUG_MODE_WRAP_CHILD_PATH_FALLBACK",
							childFilePath
						});
					}
				}

				// moduleID: always prefer the PARENT/build owner (its raw base id, read from baseModuleID).
				// One buildAPI() builds exactly one module's subtree, so a child
				// VALUE shared from another mount (e.g. eager+browser re-mounting a base leaf — same function
				// object, still carrying base's metadata) must be owned by THIS mount's module. The previous
				// code used the child VALUE's own moduleID whenever it carried its own metadata, which
				// attributed re-mounted base leaves to base_slothlet and made api.remove() roll them back
				// instead of deleting them (impl:removed never fired).
				if (this.____slothletInternal.adoptOwner) {
					// An in-flight ___setImpl named the module these children belong to (#525).
					childModuleId = this.____slothletInternal.adoptOwner;
				} else if (parentMetadata?.baseModuleID) {
					// The raw base id, stored verbatim — read directly rather than recovered from the composite
					// metadata tag. The composite joins the id and apiPath with the reserved MODULE_ID_SEPARATOR
					// specifically so an id may contain any character (a user `vine:abc` convention, an internal
					// `versionDispatcher:<path>` id) without being truncated on recovery (#303).
					childModuleId = parentMetadata.baseModuleID;
				}

				const childSourceFolder = childExistingMetadata?.sourceFolder || parentMetadata?.sourceFolder || null;

				// The child's module origin (#484). A child read from the parent's own file is located the same
				// way the parent was: the parent's composed-key map first (a flattened namespace records where
				// each key came from), then the child value's identity in that file's export index, then — for a
				// member of an exported object — the parent's own exportPath extended by the key. A child from a
				// different file (a folder namespace's per-file children) is located by identity in its own file.
				// Last, for a child of a namespace that is not itself an export: the export of the child's file
				// with that name, confirmed by value — the only route for a primitive such a namespace gathered
				// from one of several files, which has no identity and no recorded per-key map.
				const parentInternal = this.____slothletInternal;
				const originIndex = this.____slothlet.handlers?.ownership;
				const sameFileAsParent = Boolean(childFilePath) && childFilePath === parentInternal.filePath;
				const keyName = typeof key === "symbol" ? null : key;
				let childExportPath = null;
				if (childFilePath && keyName !== null) {
					// The map is a plain object: only a key it holds as its own is a recorded member, never one it inherits
					// (`hasOwnProperty`, `toString`, …), which is no export path (#630).
					const memberExportPaths = sameFileAsParent ? parentInternal.memberExportPaths : null;
					const recordedMember = memberExportPaths && hasOwn(memberExportPaths, keyName) ? memberExportPaths[keyName] : undefined;
					if (recordedMember) {
						childExportPath = copyList(recordedMember);
					} else if (sameFileAsParent && parentInternal.exportPath) {
						childExportPath = originIndex?.resolveExportPath(childFilePath, value) ?? concatLists(parentInternal.exportPath, [keyName]);
					} else {
						childExportPath =
							originIndex?.resolveExportPath(childFilePath, value) ??
							originIndex?.resolveExportPathByKey(childFilePath, keyName, value) ??
							null;
					}
				}

				// Mark this value as on the descent path while its subtree is built, then unmark — so the
				// same reference reached again THROUGH this subtree (a cycle) bails, but a sibling reuse does
				// not. `finally` guarantees the unmark even if construction throws (#330).
				if (trackCycle) {
					WeakSetMethods.add(visited, value);
				}
				// An array element's path is where the element sits now, and so is the path of everything below it
				// (#603 review): a rule for `arr.0` applies to whatever is at `arr[0]`, a held reference included.
				// Only a canonical index below 2^32 - 1 is a position; "4294967295" and above are ordinary properties of the array.
				const parentIsArray = Arrays.isArray(this.____slothletInternal.impl) && isPosition(key);
				const position =
					parentIsArray || this.____slothletInternal.followsPosition
						? { parent: this, key, byIndex: parentIsArray, sourceValue: value }
						: null;
				let nestedWrapper;
				try {
					nestedWrapper = new UnifiedWrapper(this.____slothlet, {
						mode: "eager",
						// `apiPath` is always non-empty for nested wrappers; symbol keys are not used for API paths.
						/* v8 ignore start */
						apiPath: this.____slothletInternal.apiPath
							? `${this.____slothletInternal.apiPath}.${typeof key === "symbol" ? String(key) : key}`
							: String(key),
						/* v8 ignore stop */
						initialImpl: childImpl,
						isCallable: typeof childImpl === "function",
						filePath: childFilePath,
						exportPath: childExportPath,
						moduleID: childModuleId,
						sourceFolder: childSourceFolder,
						// Thread the cycle-guard set so a cycle spanning this parent → descendant is detected (#330).
						__adoptVisited: visited,
						// Propagate lazy adoption down a wrap-on-set subtree so deep grafts never recurse (#329).
						deferChildAdopt,
						__position: position
					});
				} finally {
					if (trackCycle) {
						WeakSetMethods.delete(visited, value);
					}
				}
				// The value the child was built from (before any clone), so a parent array can tell whether the
				// element its cached child fronts is still the one at that index (#602).
				nestedWrapper.____slothletInternal.sourceValue = value;
				// What an object assigned to the api after it was built holds is data, as the object is (#826).
				if (WeakSetMethods.has(ASSIGNED_DATA, value) || holdsAssignedData(this)) nestedWrapper.____slothletInternal.assignedData = true;
				// The module's own object, when the child is built from a copy of it: writes through the node reach it (#746).
				nestedWrapper.____slothletInternal.moduleObject = childImpl !== value ? moduleObjectFor(nestedWrapper, value, true) : null;
				// Return proxy to maintain consistency with external assignments
				// Children are stored as proxies on wrapper, getTrap returns them as-is
				return nestedWrapper.___createProxy();
			}

			/**
			 * Whether a definition on a node leaves the member fixed: read-only and non-configurable once applied, taking what the
			 * definition leaves out from the member as the node holds it.
			 * @param {object} wrapper - The node's wrapper.
			 * @param {object} target - The node's proxy target.
			 * @param {string|symbol} prop - The member.
			 * @param {PropertyDescriptor} descriptor - The definition.
			 * @returns {boolean} True when the member ends up fixed.
			 * @private
			 */
			___definitionFixes(target, prop, descriptor) {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/materialize", import.meta.url);
				const wrapper = this;
				const current = Reflect.getOwnPropertyDescriptor(wrapper, prop);
				const shell = target === wrapper ? undefined : Reflect.getOwnPropertyDescriptor(target, prop);
				const known = shell ?? current;
				const configurable = "configurable" in descriptor ? descriptor.configurable : known ? known.configurable : false;
				const writable =
					"writable" in descriptor
						? descriptor.writable
						: known && "value" in known
							? !(wrapper.____slothletInternal.readOnlyKeys ? SetMethods.has(wrapper.____slothletInternal.readOnlyKeys, prop) : false) &&
								(shell ? shell.writable : true)
							: false;
				return !configurable && !writable;
			}
		}
	);
}
