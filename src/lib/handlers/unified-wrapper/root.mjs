/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/root.mjs
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
 * @fileoverview Root layer of the wrapper: the api root's services (gate, calls, listing, reads and changes of its members).
 * @module @cldmv/slothlet/handlers/unified-wrapper/root
 * @internal
 */

import { util } from "#helpers/platform";
import { isCompositionLayer, layerMethodOriginal, layerUnderlying } from "#helpers/composition";
import { isFrameworkReservedKey } from "#helpers/reserved-keys";
import {
	listPush,
	Map,
	MapMethods,
	Objects,
	PrototypeFunctions,
	Reflect,
	SetMethods,
	setValues,
	String,
	WeakMap,
	WeakMapMethods,
	WeakSetMethods
} from "#helpers/intrinsics";

import { ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 */
let trustedRootOwn,
	registerLeafFile,
	hasOwn,
	FRAMEWORK_WRITES,
	ROOT_PROXIES,
	runtime_isUnchangingDefinition,
	HOST_READER,
	SEALED_SHELL_READER,
	runtime_unwrapSelfView,
	runtime_selfModuleReader,
	FRAMEWORK_VIEW_TARGETS,
	SELF_FRAMEWORK_ROOTS,
	runtime_selfRootView,
	runtime_takeRunWrite,
	runtime_enforceReadGate,
	runtime_isTerminalData,
	runtime_isLanguageNameDescriptor,
	runtime_enforceCodeMember,
	runtime_isCodeMemberWithheld,
	GIVEN_VIEWS,
	PINNED_CODE_MEMBERS,
	runtime_pinnedCodeMember,
	runtime_givenAsIs,
	runtime_givenMember,
	runtime_givenViewOn,
	INTRINSICS,
	runtime_makerInstanceID,
	runtime_memberHoldsCode,
	searchDepth,
	searchBudget,
	runtime_prototypeForReader,
	runtime_isReadRedacted,
	runtime_isHeldPrimitive,
	runtime_holdsValue,
	runtime_isRootFunctionAnswer,
	runtime_isHostRead,
	runtime_assertRootChange,
	enforcePermission,
	runtime_refuseFixedObjectDefinition,
	runtime_inspectLabel,
	runtime_inspectSafe,
	runtime_codeLabel,
	UnifiedWrapper,
	resolveWrapper;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/**
 * The value a stand-in {@link runtime_pinnedCodeMember} made stands for, or the value itself when it is none.
 * @param {*} value - The value.
 * @returns {*} What is behind it.
 * @private
 */
function runtime_behindPinnedCode(value) {
	return WeakMapMethods.get(PINNED_CODE_MEMBERS, value) ?? value;
}

/**
 * Whether a member a function node or function root is about to hold fixed holds the module's code, and so is held as a
 * stand-in (see {@link runtime_pinnedCodeMember}): an object or function no api node stands for, holding code.
 * @param {*} value - The member's value.
 * @param {object|null} slothlet - The instance, whose `permissions.search` bounds the search.
 * @returns {boolean} True when it is.
 * @private
 */
function runtime_pinsAsCode(value, slothlet) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
	if (WeakMapMethods.has(PINNED_CODE_MEMBERS, value) || resolveWrapper(value) !== null || WeakSetMethods.has(INTRINSICS, value))
		return false;
	return runtime_memberHoldsCode(value, searchDepth(slothlet) + 1, searchBudget(slothlet));
}

/**
 * The api root's given prototype, as whoever reads the root now is handed it (see {@link runtime_givenPrototypeFor}),
 * kept on the root's own record.
 * @param {object} slothlet - The instance.
 * @param {object} holder - The root's record of its views.
 * @param {object|Function|null} prototype - The prototype.
 * @param {boolean} [closed=false] - Whether the view is for the closed root's target, which every holder is handed.
 * @returns {object|Function|null} What the reader is handed.
 * @internal
 */
function runtime_rootPrototypeFor(slothlet, holder, prototype, closed = false) {
	if (runtime_givenAsIs(prototype)) return prototype;
	let reader = SEALED_SHELL_READER;
	if (!closed) {
		if (!slothlet.handlers?.permissionManager?.isEnabled()) return prototype;
		reader = runtime_selfModuleReader(slothlet);
		if (reader === null || reader === HOST_READER) return prototype;
	}
	return runtime_givenViewOn(holder, runtime_rootGate(slothlet), null, prototype, reader, () => runtime_assertRootChange(slothlet, null));
}

/**
 * A member the api root inherits from a prototype it was given, as module code reading the root is handed it: under
 * the rules a member of the root by that name is read under (see {@link runtime_givenMember}). The host, and everyone
 * while the permission system is off, reads it as the root reads any member.
 * @param {object} slothlet - The instance.
 * @param {object} holder - The root's record of its views.
 * @param {object|Function} prototype - The prototype the member was read from.
 * @param {string|symbol} prop - The member's key.
 * @param {*} value - What the prototype answered.
 * @returns {*} What the reader is handed.
 * @throws {SlothletError} PERMISSION_DENIED when the reader may not read the member.
 * @internal
 */
function runtime_rootInheritedRead(slothlet, holder, prototype, prop, value) {
	const viewed = runtime_rootPrototypeFor(slothlet, holder, prototype);
	const record = WeakMapMethods.get(GIVEN_VIEWS, viewed);
	if (record === undefined || record.value !== prototype || typeof value === "function")
		return runtime_rootMemberRead(slothlet, prop, value);
	return runtime_givenMember(record, prop, value);
}

/**
 * The api root as the read gate takes a node, per instance (see {@link runtime_rootGate}).
 * @type {WeakMap<object, object>}
 * @private
 */
const ROOT_GATES = new WeakMap();

/**
 * The api root as the read gate takes a node: its path is empty and what it holds is the instance's api. A member of
 * the root is then decided by the same gate, at its own name, as a member of any node is at the node's path and its name.
 * @param {object} slothlet - The instance.
 * @returns {object} The root's stand-in for the gate.
 * @private
 */
function runtime_rootGate(slothlet) {
	let gate = WeakMapMethods.get(ROOT_GATES, slothlet);
	if (gate === undefined) {
		gate = {
			slothlet,
			SlothletError: slothlet.SlothletError,
			____slothletInternal: {
				apiPath: "",
				filePath: null,
				get impl() {
					return slothlet.api;
				}
			}
		};
		WeakMapMethods.set(ROOT_GATES, slothlet, gate);
	}
	return gate;
}

/**
 * The value a node answers in its place (see {@link runtime_holdsValue}).
 * @param {object} wrapper - The node's wrapper.
 * @returns {*} The value.
 * @private
 */
function runtime_heldValue(wrapper) {
	const internal = wrapper.____slothletInternal;
	return runtime_isHeldPrimitive(internal.impl) ? internal.impl : internal.nullish.value;
}

/**
 * Whether the read gate is on for an instance.
 * @param {object} slothlet - The instance.
 * @returns {boolean} True when reads are gated.
 * @private
 */
function runtime_readsGated(slothlet) {
	const pm = slothlet.handlers?.permissionManager;
	return !!pm && pm.isEnabled() && pm.isReadGatingEnabled();
}

/**
 * A call or construction of the api root's function, checked as a call of a function node is: through the root
 * itself, or through `call`, `apply`, `bind` or `Reflect.apply`, a reader the rules refuse a call of the root is refused.
 * The host's own calls are allowed, as at any node.
 * @param {object} slothlet - The instance.
 * @param {Array<*>} args - The call's arguments.
 * @returns {void}
 * @throws {SlothletError} PERMISSION_DENIED when the caller may not call the root.
 * @internal
 */
function runtime_rootCallCheck(slothlet, args) {
	enforcePermission(runtime_rootGate(slothlet), args);
}

/**
 * The api root file of each instance's base load, when its default export is a function (see
 * {@link runtime_noteRootFile}).
 * @type {WeakMap<object, {filePath: string, moduleID: string|null}>}
 * @private
 */
const ROOT_FILES = new WeakMap();

/**
 * The leaf the api root's function runs as, per instance (see {@link runtime_rootLeaf}).
 * @type {WeakMap<object, UnifiedWrapper>}
 * @private
 */
const ROOT_LEAVES = new WeakMap();

/**
 * The file whose default function is the api root of an instance's base load (see {@link runtime_noteRootFile}), or
 * null when its root is no function: what a generated declaration types the root's call by (#803).
 * @param {object} slothlet - The instance.
 * @returns {string|null} The root file's path.
 * @internal
 */
function runtime_rootFileOf(slothlet) {
	return WeakMapMethods.get(ROOT_FILES, slothlet)?.filePath ?? null;
}

/**
 * Record the file whose default function is the api root of an instance's base load, and the module it was loaded
 * for: the root's leaf is built from them.
 * @param {object} slothlet - The instance.
 * @param {string} filePath - The root file.
 * @param {string|null} moduleID - The base module.
 * @returns {void}
 * @internal
 */
function runtime_noteRootFile(slothlet, filePath, moduleID) {
	WeakMapMethods.set(ROOT_FILES, slothlet, { filePath, moduleID: moduleID ?? null });
	WeakMapMethods.delete(ROOT_LEAVES, slothlet);
}

/**
 * The leaf the api root's function runs as: a node of the base module at the root's path (`""`), built from the root
 * file, so a call of the root enters it as a call of a function node enters the node. The root's own code then runs
 * as the root (rules whose caller pattern matches `""`, `**` among them, and `policy`), whoever called it. It
 * has no Proxy of its own and is reached only as the identity of the root's calls. Null when the api root is no
 * function.
 * @param {object} slothlet - The instance.
 * @returns {UnifiedWrapper|null} The leaf.
 * @private
 */
function runtime_rootLeaf(slothlet) {
	const root = slothlet.api;
	if (typeof root !== "function") return null;
	const fn = layerUnderlying(root);
	const held = WeakMapMethods.get(ROOT_LEAVES, slothlet);
	if (held !== undefined && held.____slothletInternal.impl === fn) return held;
	const source = WeakMapMethods.get(ROOT_FILES, slothlet) ?? null;
	const leaf = new UnifiedWrapper(slothlet, {
		mode: "eager",
		apiPath: "",
		initialImpl: fn,
		isCallable: true,
		deferChildAdopt: true,
		exportPath: ["default"],
		moduleID: source?.moduleID ?? null
	});
	// The file is recorded after construction, so building the leaf announces no node of the tree; its code is indexed
	// as this leaf's, as a node's is.
	leaf.____slothletInternal.filePath = source?.filePath ?? null;
	WeakSetMethods.add(trustedRootOwn.genuineWrappers, leaf);
	if (source?.filePath) registerLeafFile(leaf);
	WeakMapMethods.set(ROOT_LEAVES, slothlet, leaf);
	return leaf;
}

/**
 * Run the api root's function, its call checked already (see {@link runtime_rootCallCheck}), as a call of the root's
 * leaf ({@link runtime_rootLeaf}): its own `self` reads are the root's, whoever called it. What it returns is handed out
 * as a function node's result is. A construction runs the same way.
 * @param {object} slothlet - The instance.
 * @param {*} thisArg - The call's receiver.
 * @param {Array<*>} args - The call's arguments.
 * @param {boolean} [construct=false] - Whether the root is constructed.
 * @returns {*} What the root returned.
 * @internal
 */
function runtime_rootCall(slothlet, thisArg, args, construct = false) {
	const root = slothlet.api;
	const contextManager = slothlet.contextManager;
	const leaf = contextManager?.runInContext && slothlet.instanceID ? runtime_rootLeaf(slothlet) : null;
	if (leaf === null) return construct ? Reflect.construct(root, args) : Reflect.apply(root, thisArg, args);
	const fn = leaf.____slothletInternal.impl;
	if (construct) {
		const instanceID = runtime_makerInstanceID(slothlet) ?? slothlet.instanceID;
		return contextManager.runInContext(
			instanceID,
			(...made) => Reflect.construct(fn, made),
			undefined,
			args,
			leaf,
			true,
			false,
			null,
			null,
			true
		);
	}
	return contextManager.runInContext(
		runtime_makerInstanceID(slothlet) ?? slothlet.instanceID,
		fn,
		thisArg,
		args,
		leaf,
		true,
		false,
		null,
		null,
		true
	);
}

/**
 * `Function.prototype.call`, `apply` and `bind` as they were when slothlet loaded, by name.
 * @type {Readonly<Record<string, Function>>}
 * @private
 */
const FUNCTION_INVOKERS = Objects.freeze({
	__proto__: null,
	call: PrototypeFunctions.Function.call,
	apply: PrototypeFunctions.Function.apply,
	bind: PrototypeFunctions.Function.bind
});

/**
 * The `call`, `apply` and `bind` the api root hands out for its function, per instance, by name.
 * @type {WeakMap<object, Map<string, Function>>}
 * @private
 */
const ROOT_INVOKERS = new WeakMap();

/**
 * The api root's `call`, `apply` or `bind`, where its function inherits the language's: run on the api root, so the
 * call goes through the root's call check (see {@link runtime_rootCallCheck}), as `call` on a function node calls the
 * node. What the root's file layer hands out instead runs the module's function itself, past the check. Any other value
 * (a member of the root's own by that name) is answered as it is.
 * @param {object} slothlet - The instance.
 * @param {string|symbol} prop - The key read.
 * @param {*} value - What the root answered for it.
 * @returns {*} The value to hand out.
 * @private
 */
function runtime_rootInvoker(slothlet, prop, value) {
	if (typeof slothlet.api !== "function" || typeof prop !== "string" || !(prop in FUNCTION_INVOKERS)) return value;
	const invoker = FUNCTION_INVOKERS[prop];
	if ((layerMethodOriginal(value) ?? value) !== invoker) return value;
	let made = WeakMapMethods.get(ROOT_INVOKERS, slothlet);
	if (made === undefined) WeakMapMethods.set(ROOT_INVOKERS, slothlet, (made = new Map()));
	let fn = MapMethods.get(made, prop);
	if (fn === undefined) {
		fn = { [prop]: (...args) => Reflect.apply(invoker, slothlet.boundApi, args) }[prop];
		MapMethods.set(made, prop, fn);
	}
	return fn;
}

/**
 * A read of a member of the api root, answered as a node answers a read of its member: a file's primitive default
 * export is its value, and a value the reader may not read is refused, by the same gate at the member's name.
 * @param {object} slothlet - The instance.
 * @param {string|symbol} prop - The member's key.
 * @param {*} value - What the root holds under it.
 * @returns {*} What the read answers.
 * @throws {SlothletError} PERMISSION_DENIED when the reader may not read the member.
 * @internal
 */
function runtime_rootMemberRead(slothlet, prop, value) {
	if (value !== null && (typeof value === "object" || typeof value === "function")) {
		const node = resolveWrapper(value);
		if (node !== null) {
			// A node is traversal, as at any node; a file's primitive, null or undefined default export is its value,
			// read through the gate.
			if (!runtime_holdsValue(node)) return value;
			const held = runtime_heldValue(node);
			runtime_enforceReadGate(runtime_rootGate(slothlet), prop, held);
			return held;
		}
	}
	// The root function's own answers, where the root holds no member by the name: its `prototype` and `toString` hold
	// its code and are checked as a call of the root, and its `name` and `length` are read without a check, as a
	// function node answers each of them (see runtime_isBuiltinFunctionMember).
	if (runtime_isRootFunctionAnswer(slothlet, prop)) {
		const gate = runtime_rootGate(slothlet);
		if (prop !== "name" && prop !== "length") runtime_enforceCodeMember(gate, value);
		// The `prototype` is handed out as a function node hands its own: its `constructor` is the root.
		if (prop === "prototype") return runtime_prototypeForReader(gate, value, "prototype");
		return value;
	}
	// The root function's `call`, `apply` and `bind` call the root through its check, as a function node's call the node.
	if (typeof value === "function") {
		const invoker = runtime_rootInvoker(slothlet, prop, value);
		if (invoker !== value) return invoker;
	}
	// Only data the root lists as a member is gated: a node read off the root is traversal, as at any node.
	if (typeof prop === "string" && runtime_isTerminalData(value) && runtime_readsGated(slothlet)) {
		const descriptor = Objects.getOwnPropertyDescriptor(slothlet.api, prop);
		if (descriptor !== undefined && descriptor.enumerable) runtime_enforceReadGate(runtime_rootGate(slothlet), prop, value);
	}
	return value;
}

/**
 * The keys of the api root a reader is given, as a node's listing gives its own: what the reader may not read is left
 * out (see {@link runtime_isReadRedacted}). A key the root's target holds fixed stays, as the invariants require.
 * @param {object} slothlet - The instance.
 * @param {object|Function} target - The root proxy's target.
 * @param {Array<string|symbol>} keys - The keys the api root holds.
 * @returns {Array<string|symbol>} The keys listed.
 * @internal
 */
function runtime_rootListing(slothlet, target, keys) {
	if (!runtime_readsGated(slothlet)) return keys;
	const gate = runtime_rootGate(slothlet);
	// The reader is the same for every key of one listing, so it is resolved once.
	const host = runtime_isHostRead(gate);
	const listed = [];
	for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (host && !slothlet.handlers.permissionManager.isPrivateTarget(String(key))) {
			listPush(listed, key);
			continue;
		}
		const fixed = Reflect.getOwnPropertyDescriptor(target, key);
		if ((fixed && !fixed.configurable) || !runtime_isReadRedacted(gate, key, null, null, true)) listPush(listed, key);
	}
	return listed;
}

/**
 * The api root's description of a member, as a node describes its own: none for a value the reader may not read, and a
 * file's primitive default export described by its value.
 * @param {object} slothlet - The instance.
 * @param {string|symbol} prop - The member's key.
 * @param {PropertyDescriptor} descriptor - The api root's own descriptor of it.
 * @returns {PropertyDescriptor|undefined} The description.
 * @internal
 */
function runtime_rootMemberDescriptor(slothlet, prop, descriptor) {
	if (runtime_readsGated(slothlet)) {
		const gate = runtime_rootGate(slothlet);
		const decided = runtime_isHostRead(gate) && !slothlet.handlers.permissionManager.isPrivateTarget(String(prop));
		// The root function's own `name` and `length` are described as they are read, without a check (see
		// runtime_rootMemberRead); a member the root lists by that name is the module's and is decided as any other.
		const builtin = typeof slothlet.api === "function" && runtime_isLanguageNameDescriptor(prop, descriptor);
		if (!decided && !builtin && runtime_isReadRedacted(gate, prop)) return undefined;
	}
	// The root function's own `prototype` and `toString`, described only to a reader that may call the root, as a function
	// node describes its own.
	if (runtime_isRootFunctionAnswer(slothlet, prop) && prop !== "name" && prop !== "length") {
		const gate = runtime_rootGate(slothlet);
		if (runtime_isCodeMemberWithheld(gate, descriptor)) return undefined;
		if (prop === "prototype" && "value" in descriptor)
			return { __proto__: null, ...descriptor, value: runtime_prototypeForReader(gate, descriptor.value, "prototype") };
		return descriptor;
	}
	const value = descriptor.value;
	if (!("value" in descriptor) || value === null || (typeof value !== "object" && typeof value !== "function")) return descriptor;
	const node = resolveWrapper(value);
	return node !== null && runtime_holdsValue(node) ? { __proto__: null, ...descriptor, value: runtime_heldValue(node) } : descriptor;
}

/**
 * Whether the api root withholds a member from the reader's description: the root holds it, and describes it to the
 * reader as it describes no member (see {@link runtime_rootMemberDescriptor}), which it does for a value the reader may
 * not read and for the root function's own code a reader may not call. A closed root must still describe the key, so it
 * is described with its value withheld.
 * @param {object} slothlet - The instance.
 * @param {string|symbol} prop - The member's key.
 * @returns {boolean} True when the value is withheld.
 * @internal
 */
function runtime_rootWithheld(slothlet, prop) {
	const held = slothlet.api ? Objects.getOwnPropertyDescriptor(slothlet.api, prop) : undefined;
	return held !== undefined && runtime_rootMemberDescriptor(slothlet, prop, held) === undefined;
}

/**
 * Record an instance's api root proxy, so a write the framework makes to it is its own (see {@link runtime_frameworkWrite}).
 * @param {object} root - The root proxy.
 * @returns {object} `root`.
 * @internal
 */
function runtime_registerRoot(root) {
	WeakSetMethods.add(ROOT_PROXIES, root);
	return root;
}

/**
 * What the api root's target holds for a member once the invariants bind it there: a file's primitive default export
 * as its value, as a read of it answers, and anything else as the root holds it.
 * @param {PropertyDescriptor} descriptor - The api's own descriptor of the member.
 * @returns {PropertyDescriptor} The descriptor the target holds.
 * @private
 */
function runtime_rootShellDescriptor(descriptor, slothlet = null, prop = null) {
	const value = descriptor.value;
	if (!("value" in descriptor) || value === null || (typeof value !== "object" && typeof value !== "function")) return descriptor;
	// The root function's own `prototype` or `toString`, fixed read-only, is held as a stand-in every holder may be
	// described (see runtime_pinnedCodeMember).
	if (
		slothlet !== null &&
		descriptor.writable === false &&
		runtime_isRootFunctionAnswer(slothlet, prop) &&
		runtime_pinsAsCode(value, slothlet)
	)
		return { __proto__: null, ...descriptor, value: runtime_pinnedCodeMember(runtime_rootGate(slothlet), value) };
	const impl = resolveWrapper(value)?.____slothletInternal.impl;
	return runtime_isHeldPrimitive(impl) ? { __proto__: null, ...descriptor, value: impl } : descriptor;
}

/**
 * Whether the api root takes a member under a key: any key while it is open, and once closed only one it holds, as a
 * closed object takes. The target is what tells: a function root's api stays open (see {@link runtime_rootClose}).
 * @param {object|Function} target - The root proxy's target.
 * @param {string|symbol} prop - The key.
 * @returns {boolean} Whether a member may be set or defined under it.
 * @internal
 */
function runtime_rootTakesKey(target, prop) {
	return Reflect.isExtensible(target) || hasOwn(target, prop);
}

/**
 * The node the api root holds in place of an object or function the host assigns or defines on it, as one assigned
 * through `self` (see ApiManager#setOwnedProperty) and one assigned on any node (wrap-on-set) is held: read, listed
 * and serialized at the member's name, written only by who owns it, called only by who may call it. `null` for a value
 * held as it is: a primitive, a built-in data object, a proxy or a node, a framework key, and any assignment the
 * framework makes itself or during a build.
 * @param {object} slothlet - The instance.
 * @param {string|symbol} prop - The member's key.
 * @param {*} value - The value assigned.
 * @returns {object|null} The node's proxy, or `null`.
 * @private
 *
 * @example
 * api.ownNothing = { a: 1 }; // the root holds a node at `ownNothing`; a module reads `self.ownNothing.a` under its rules
 */
function runtime_rootMemberNode(slothlet, prop, value) {
	if (typeof prop !== "string" || SetMethods.has(SELF_FRAMEWORK_ROOTS, prop) || isFrameworkReservedKey(prop)) return null;
	if (slothlet.____buildDepth > 0 || MapMethods.has(FRAMEWORK_WRITES, slothlet.boundApi)) return null;
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return null;
	if (util.types.isProxy(value) || resolveWrapper(value) !== null || UnifiedWrapper._staysValue(value)) return null;
	const node = new UnifiedWrapper(slothlet, {
		mode: slothlet.config?.mode ?? "eager",
		apiPath: prop,
		moduleID: null,
		isCallable: typeof value === "function"
	});
	node.___setImpl(value, null);
	return node.createProxy();
}

/**
 * Assign a member of the api root, as an assignment on the api object: an object or function the host assigns is held
 * as a node (see {@link runtime_rootMemberNode}).
 * @param {object} slothlet - The instance.
 * @param {object|Function} target - The root proxy's target.
 * @param {string|symbol} prop - The member's key.
 * @param {*} value - The value assigned.
 * @returns {boolean} Whether it was assigned.
 * @throws {SlothletError} When module code may not change the member (see {@link runtime_assertRootChange}).
 * @internal
 */
function runtime_rootAssign(slothlet, target, prop, value) {
	runtime_assertRootChange(slothlet, prop);
	if (!runtime_rootTakesKey(target, prop)) return false;
	value = runtime_unwrapSelfView(value);
	const stored = runtime_rootMemberNode(slothlet, prop, value) ?? value;
	// A full-isolation run's `self` keeps what it writes on the root in its own record (see runtime_runWrite).
	const runSink = runtime_takeRunWrite(slothlet.boundApi, prop);
	if (runSink !== null) return runSink({ op: "set", value: stored });
	return Reflect.set(slothlet.api, prop, stored);
}

/**
 * Define a member of the api root, as a definition on the api object: on the api itself, and on the root proxy's target
 * too where the invariants bind it (a member made non-configurable, and every member once the root is closed).
 * @param {object} slothlet - The instance.
 * @param {object|Function} target - The root proxy's target.
 * @param {string|symbol} prop - The member's key.
 * @param {PropertyDescriptor} descriptor - The definition.
 * @returns {boolean} Whether it was defined.
 * @throws {SlothletError} When module code may not change the member (see {@link runtime_assertRootChange}).
 * @internal
 */
function runtime_rootDefine(slothlet, target, prop, descriptor) {
	const api = slothlet.api;
	// A definition that changes nothing (freezing a root already frozen) is no write, as on a node (#667).
	if (!Reflect.isExtensible(target) && runtime_isUnchangingDefinition(target, prop, descriptor)) return true;
	runtime_assertRootChange(slothlet, prop);
	if ("value" in descriptor) descriptor = { __proto__: null, ...descriptor, value: runtime_unwrapSelfView(descriptor.value) };
	// A key only the target holds (its inspect hook) is the target's own.
	if (!hasOwn(api, prop) && hasOwn(target, prop)) return Reflect.defineProperty(target, prop, descriptor);
	if (!runtime_rootTakesKey(target, prop)) return false;
	// An object or function defined on the root is held as a node, as one assigned to it is, unless the definition fixes
	// it (read-only and non-configurable): the language requires the root to hand that value out as it was defined.
	if ("value" in descriptor) {
		const current = Reflect.getOwnPropertyDescriptor(api, prop);
		const configurable = "configurable" in descriptor ? descriptor.configurable : (current?.configurable ?? false);
		const writable = "writable" in descriptor ? descriptor.writable : current && "value" in current ? current.writable : false;
		if (!configurable && !writable) runtime_refuseFixedObjectDefinition(slothlet, "", prop, descriptor.value);
		const node = configurable || writable ? runtime_rootMemberNode(slothlet, prop, descriptor.value) : null;
		if (node !== null) descriptor = { __proto__: null, ...descriptor, value: node };
	}
	// A full-isolation run's `self` keeps what it defines on the root in its own record (see runtime_runWrite).
	const runSink = runtime_takeRunWrite(slothlet.boundApi, prop);
	if (runSink !== null) return runSink({ op: "define", descriptor });
	if (!Reflect.defineProperty(api, prop, descriptor)) return false;
	const held = Reflect.getOwnPropertyDescriptor(api, prop);
	if (held.configurable && Reflect.isExtensible(target)) return true;
	return Reflect.defineProperty(target, prop, runtime_rootShellDescriptor(held, slothlet, prop));
}

/**
 * Close the api root (`Object.preventExtensions`, and so `Object.seal` / `Object.freeze`), as closing the api object:
 * the api itself is closed, and each member it holds is copied onto the root proxy's target, which is closed too, so the
 * root lists, describes and reads them as the invariants then require. Only the root closes: its members, slothlet's
 * namespace and every prototype stay as they are. Module code may not close it: closing it pins slothlet's own members.
 * @param {object} slothlet - The instance.
 * @param {object|Function} target - The root proxy's target.
 * @param {boolean} isCallable - Whether the root is a function, whose prototype the root reports as its own.
 * @param {object|Function|null} [prototype] - A function root's prototype, which its target takes.
 * @returns {boolean} Whether the root is closed.
 * @throws {SlothletError} When module code may not change the root (see {@link runtime_assertRootChange}).
 * @internal
 */
function runtime_rootClose(slothlet, target, isCallable, prototype) {
	// Closing a root already closed changes nothing, as on a plain object.
	if (!Reflect.isExtensible(target)) return true;
	runtime_assertRootChange(slothlet, null);
	const api = slothlet.api;
	// The root holds slothlet's namespace and root functions, which closing it would pin with it: module code may not
	// change them (the built-in write rules), so it may not close the root. Refused before anything closes.
	for (const name of setValues(SELF_FRAMEWORK_ROOTS)) if (hasOwn(api, name)) runtime_assertRootChange(slothlet, name);
	// A function root's api is a layer over its module's function, kept open so the function is not changed: the target
	// alone closes then, and from then on holds the keys the root has (see runtime_rootTakesKey).
	if (!Reflect.preventExtensions(api) && !isCompositionLayer(api)) return false;
	// A closed root reports its target's prototype (invariant): a function root's is its function's, or the one the
	// root was given, which an object root's target holds already. One it was given is held as the view every holder of
	// the closed root reads it through (see runtime_rootPrototypeFor).
	if (isCallable || prototype !== undefined) Reflect.setPrototypeOf(target, prototype);
	for (let ofIndex = 0, ofList = Reflect.ownKeys(api); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		Reflect.defineProperty(target, key, runtime_rootShellDescriptor(Reflect.getOwnPropertyDescriptor(api, key), slothlet, key));
	}
	return Reflect.preventExtensions(target);
}

/**
 * A member the api root's target holds fixed (non-configurable), as the invariants require it be reported, once the
 * reader may read it: a read-only value is checked as a read of the member and handed as the target holds it, a
 * writable one is the api's current value as a read answers it.
 * @param {object} slothlet - The instance.
 * @param {string|symbol} prop - The member's key.
 * @param {PropertyDescriptor} fixed - The target's own descriptor.
 * @param {boolean} described - Whether the descriptor is asked for (rather than the value read).
 * @returns {*} The value read, or the descriptor.
 * @throws {SlothletError} PERMISSION_DENIED when the reader may not read the member.
 * @internal
 */
function runtime_rootFixedMember(slothlet, prop, fixed, described) {
	if (!("value" in fixed)) return described ? fixed : Reflect.get(slothlet.api, prop);
	if (!fixed.writable) {
		// A stand-in for the root function's code is described to anyone: each use of it is checked.
		if (described && WeakMapMethods.has(PINNED_CODE_MEMBERS, fixed.value)) return fixed;
		runtime_rootMemberRead(slothlet, prop, runtime_behindPinnedCode(fixed.value));
		return described ? fixed : fixed.value;
	}
	// A writable member is described with the value the reader may not read withheld, as a node describes one (#825).
	if (described && runtime_rootWithheld(slothlet, prop)) return { __proto__: null, ...fixed, value: undefined };
	const value = runtime_rootMemberRead(slothlet, prop, slothlet.api[prop]);
	return described ? { __proto__: null, ...fixed, value } : value;
}

/**
 * What the api root shows to `util.inspect`, as a node shows its own: its members, read through the root as the reader
 * may read them (a member it may not read left out; to a module, its code by its form), and for a function root its
 * function's form beside them, a label that runs nothing.
 * @param {object} slothlet - The instance.
 * @param {Array<*>} args - The hook's arguments (`depth`, `options`, `inspect`).
 * @returns {*} What is shown.
 * @private
 */
function runtime_rootInspectShown(slothlet, args) {
	// A module is shown the root as its own view of it reads it, and the module's code by its form (as a node shows it),
	// so the hook, which a read of the root hands out, gives the module nothing it could not read.
	const reader = runtime_selfModuleReader(slothlet);
	const root = reader ? runtime_selfRootView(slothlet, reader) : slothlet.boundApi;
	const shown = {};
	for (let ofIndex = 0, ofList = Objects.keys(root); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		try {
			shown[key] = reader ? runtime_rootMemberShown(root[key], args, slothlet) : root[key];
		} catch (error) {
			if (error?.code !== "PERMISSION_DENIED") throw error;
		}
	}
	const api = slothlet.api;
	if (typeof api !== "function") return shown;
	const label = runtime_codeLabel(isCompositionLayer(api) ? layerUnderlying(api) : api);
	if (Objects.keys(shown).length === 0) return label;
	const options = args[1],
		inspect = args[2];
	return `${label} ${(typeof inspect === "function" ? inspect : util.inspect)(shown, options)}`;
}

/**
 * A member of the api root as its hook shows it to a module: the framework's namespace as its own hook shows it (only
 * what the module may read), a function of the framework's by the form of the function behind the module's view of it,
 * and anything else as {@link runtime_inspectSafe} shows it, a form shown unquoted as `util.inspect` shows one.
 * @param {*} value - The member, read through the module's view of the root.
 * @param {Array<*>} args - The hook's arguments.
 * @param {object} slothlet - The instance.
 * @returns {*} What is shown.
 * @private
 */
function runtime_rootMemberShown(value, args, slothlet) {
	const behind =
		value !== null && (typeof value === "object" || typeof value === "function")
			? WeakMapMethods.get(FRAMEWORK_VIEW_TARGETS, value)
			: undefined;
	if (behind !== undefined && typeof value === "object") return value;
	const safe = runtime_inspectSafe(value, args, true, slothlet);
	if (typeof safe !== "string" || safe === value) return safe;
	return runtime_inspectLabel(typeof behind === "function" ? runtime_codeLabel(behind) : safe);
}

/** Whether {@link RootLayer} has built its class: it builds one, for the wrapper's chain. @type {boolean} */
let built = false;

/**
 * Build this layer of the wrapper class over `Base`, once (see `unified-wrapper.mjs`).
 * @param {Function} Base - The class below this layer.
 * @returns {Function} The layer's class.
 * @internal
 */
export function RootLayer(Base) {
	if (built) throw ownBindingsRefusal("lib/handlers/unified-wrapper/root", import.meta.url);
	built = true;
	return Base.layer(
		class Root extends Base {
			static {
				Base.define("root", {
					runtime_behindPinnedCode,
					runtime_pinsAsCode,
					runtime_rootPrototypeFor,
					runtime_rootInheritedRead,
					runtime_rootGate,
					runtime_heldValue,
					runtime_rootCallCheck,
					runtime_rootFileOf,
					runtime_noteRootFile,
					runtime_rootCall,
					runtime_rootMemberRead,
					runtime_rootListing,
					runtime_rootMemberDescriptor,
					runtime_rootWithheld,
					runtime_registerRoot,
					runtime_rootTakesKey,
					runtime_rootAssign,
					runtime_rootDefine,
					runtime_rootClose,
					runtime_rootFixedMember,
					runtime_rootInspectShown
				});
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					UnifiedWrapper = registered;
					INTRINSICS = methods.values.INTRINSICS;
					runtime_codeLabel = methods.values.runtime_codeLabel;
					runtime_holdsValue = methods.values.runtime_holdsValue;
					runtime_inspectLabel = methods.values.runtime_inspectLabel;
					runtime_inspectSafe = methods.values.runtime_inspectSafe;
					runtime_isCodeMemberWithheld = methods.values.runtime_isCodeMemberWithheld;
					runtime_isHeldPrimitive = methods.values.runtime_isHeldPrimitive;
					runtime_isHostRead = methods.values.runtime_isHostRead;
					runtime_isLanguageNameDescriptor = methods.values.runtime_isLanguageNameDescriptor;
					runtime_isReadRedacted = methods.values.runtime_isReadRedacted;
					runtime_isRootFunctionAnswer = methods.values.runtime_isRootFunctionAnswer;
					runtime_isTerminalData = methods.values.runtime_isTerminalData;
					runtime_isUnchangingDefinition = methods.values.runtime_isUnchangingDefinition;
					runtime_makerInstanceID = methods.nodes.runtime_makerInstanceID;
					runtime_prototypeForReader = methods.nodes.runtime_prototypeForReader;
					enforcePermission = methods.rules.enforcePermission;
					FRAMEWORK_VIEW_TARGETS = methods.rules.FRAMEWORK_VIEW_TARGETS;
					FRAMEWORK_WRITES = methods.rules.FRAMEWORK_WRITES;
					ROOT_PROXIES = methods.rules.ROOT_PROXIES;
					runtime_assertRootChange = methods.rules.runtime_assertRootChange;
					runtime_enforceCodeMember = methods.rules.runtime_enforceCodeMember;
					runtime_enforceReadGate = methods.rules.runtime_enforceReadGate;
					runtime_memberHoldsCode = methods.rules.runtime_memberHoldsCode;
					runtime_pinnedCodeMember = methods.rules.runtime_pinnedCodeMember;
					runtime_refuseFixedObjectDefinition = methods.rules.runtime_refuseFixedObjectDefinition;
					runtime_takeRunWrite = methods.run.runtime_takeRunWrite;
					GIVEN_VIEWS = methods.views.GIVEN_VIEWS;
					hasOwn = methods.views.hasOwn;
					HOST_READER = methods.views.HOST_READER;
					PINNED_CODE_MEMBERS = methods.views.PINNED_CODE_MEMBERS;
					runtime_selfModuleReader = methods.views.runtime_selfModuleReader;
					runtime_selfRootView = methods.views.runtime_selfRootView;
					runtime_unwrapSelfView = methods.views.runtime_unwrapSelfView;
					SELF_FRAMEWORK_ROOTS = methods.views.SELF_FRAMEWORK_ROOTS;
					runtime_givenAsIs = methods.membrane.runtime_givenAsIs;
					runtime_givenMember = methods.membrane.runtime_givenMember;
					runtime_givenViewOn = methods.membrane.runtime_givenViewOn;
					SEALED_SHELL_READER = methods.membrane.SEALED_SHELL_READER;
					searchBudget = methods.membrane.searchBudget;
					searchDepth = methods.membrane.searchDepth;
					registerLeafFile = methods.uw.registerLeafFile;
					resolveWrapper = methods.uw.resolveWrapper;
					trustedRootOwn = methods.uw.trustedRootOwn;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/root", import.meta.url);
				super(slothlet);
			}
		}
	);
}
