/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/root.mjs
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
 * @fileoverview Root layer of the wrapper: the api root's services (gate, calls, listing, reads and changes of its members).
 *
 * Upward services: none; this layer reads only layers below it and the table's own entries.
 * @module @cldmv/slothlet/handlers/unified-wrapper/root
 * @internal
 */

import { util } from "#helpers/platform";
import { isCompositionLayer, layerMethodOriginal, layerUnderlying } from "#helpers/composition";
import { isFrameworkMemberName, isFrameworkReservedKey } from "#helpers/reserved-keys";
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
	WeakSetMethods,
	FunctionMethods,
	Functions,
	NativeProxy
} from "#helpers/intrinsics";

import { ownBindingsRefusal } from "#helpers/instance-imports";
import { codeLabel, isLanguageNameDescriptor } from "#helpers/builtin-forms";
import { anyRunOpen, beforeChange, domainOf, shallowCopy } from "#helpers/run-snapshot";
import { absorbsFrameworkName } from "#handlers/framework-internals";

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 */
let trustedRootOwn,
	registerLeafFile,
	hasOwn,
	FRAMEWORK_WRITES,
	ROOT_PROXIES,
	isUnchangingDefinition,
	HOST_READER,
	SEALED_SHELL_READER,
	unwrapSelfView,
	selfModuleReader,
	FRAMEWORK_VIEW_TARGETS,
	SELF_FRAMEWORK_ROOTS,
	selfRootView,
	takeRunWrite,
	enforceRead,
	isTerminalData,
	enforceCodeMember,
	isCodeMemberWithheld,
	GIVEN_VIEWS,
	PINNED_CODE_MEMBERS,
	pinnedCodeMember,
	givenAsIs,
	givenMember,
	givenViewOn,
	INTRINSICS,
	makerInstanceID,
	memberHoldsCode,
	searchDepth,
	searchBudget,
	prototypeForReader,
	isReadRedacted,
	isHeldPrimitive,
	isRootFunctionAnswer,
	isHostRead,
	assertRootChange,
	enforcePermission,
	refuseFixedObjectDefinition,
	inspectLabel,
	inspectSafe,
	UnifiedWrapper,
	resolveWrapper,
	behindGivenView,
	registerInspectHook,
	isWrapper;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/**
 * The value a stand-in {@link pinnedCodeMember} made stands for, or the value itself when it is none.
 * @param {*} value - The value.
 * @returns {*} What is behind it.
 * @private
 */
function behindPinnedCode(value) {
	return WeakMapMethods.get(PINNED_CODE_MEMBERS, value) ?? value;
}

/**
 * Whether a member a function node or function root is about to hold fixed holds the module's code, and so is held as a
 * stand-in (see {@link pinnedCodeMember}): an object or function no api node stands for, holding code.
 * @param {*} value - The member's value.
 * @param {object|null} slothlet - The instance, whose `permissions.search` bounds the search.
 * @returns {boolean} True when it is.
 * @private
 */
function pinsAsCode(value, slothlet) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
	if (WeakMapMethods.has(PINNED_CODE_MEMBERS, value) || resolveWrapper(value) !== null || WeakSetMethods.has(INTRINSICS, value))
		return false;
	return memberHoldsCode(value, searchDepth(slothlet) + 1, searchBudget(slothlet));
}

/**
 * The api root's given prototype, as whoever reads the root now is handed it (see {@link givenPrototypeFor}),
 * kept on the root's own record.
 * @param {object} slothlet - The instance.
 * @param {object} holder - The root's record of its views.
 * @param {object|Function|null} prototype - The prototype.
 * @param {boolean} [closed=false] - Whether the view is for the closed root's target, which every holder is handed.
 * @returns {object|Function|null} What the reader is handed.
 * @internal
 */
function rootPrototypeFor(slothlet, holder, prototype, closed = false) {
	if (givenAsIs(prototype)) return prototype;
	let reader = SEALED_SHELL_READER;
	if (!closed) {
		if (!slothlet.handlers?.permissionManager?.isEnabled()) return prototype;
		reader = selfModuleReader(slothlet);
		if (reader === null || reader === HOST_READER) return prototype;
	}
	return givenViewOn(holder, rootGate(slothlet), null, prototype, reader, () => assertRootChange(slothlet, null));
}

/**
 * A member the api root inherits from a prototype it was given, as module code reading the root is handed it: under
 * the rules a member of the root by that name is read under (see {@link givenMember}). The host, and everyone
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
function rootInheritedRead(slothlet, holder, prototype, prop, value) {
	const viewed = rootPrototypeFor(slothlet, holder, prototype);
	const record = WeakMapMethods.get(GIVEN_VIEWS, viewed);
	if (record === undefined || record.value !== prototype || typeof value === "function") return rootMemberRead(slothlet, prop, value);
	return givenMember(record, prop, value);
}

/**
 * The api root as the read gate takes a node, per instance (see {@link rootGate}).
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
function rootGate(slothlet) {
	let gate = WeakMapMethods.get(ROOT_GATES, slothlet);
	if (gate === undefined) {
		gate = {
			____slothlet: slothlet,
			____SlothletError: slothlet.SlothletError,
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
 * Whether the read gate is on for an instance.
 * @param {object} slothlet - The instance.
 * @returns {boolean} True when reads are gated.
 * @private
 */
function readsGated(slothlet) {
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
function rootCallCheck(slothlet, args) {
	enforcePermission(rootGate(slothlet), args);
}

/**
 * The api root file of each instance's base load, when its default export is a function (see
 * {@link noteRootFile}).
 * @type {WeakMap<object, {filePath: string, moduleID: string|null}>}
 * @private
 */
const ROOT_FILES = new WeakMap();

/**
 * The leaf the api root's function runs as, per instance (see {@link rootLeaf}).
 * @type {WeakMap<object, UnifiedWrapper>}
 * @private
 */
const ROOT_LEAVES = new WeakMap();

/**
 * The file whose default function is the api root of an instance's base load (see {@link noteRootFile}), or
 * null when its root is no function: what a generated declaration types the root's call by (#803).
 * @param {object} slothlet - The instance.
 * @returns {string|null} The root file's path.
 * @internal
 */
function rootFileOf(slothlet) {
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
function noteRootFile(slothlet, filePath, moduleID) {
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
function rootLeaf(slothlet) {
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
 * Run the api root's function, its call checked already (see {@link rootCallCheck}), as a call of the root's
 * leaf ({@link rootLeaf}): its own `self` reads are the root's, whoever called it. What it returns is handed out
 * as a function node's result is. A construction runs the same way.
 * @param {object} slothlet - The instance.
 * @param {*} thisArg - The call's receiver.
 * @param {Array<*>} args - The call's arguments.
 * @param {boolean} [construct=false] - Whether the root is constructed.
 * @returns {*} What the root returned.
 * @internal
 */
function rootCall(slothlet, thisArg, args, construct = false) {
	const root = slothlet.api;
	const contextManager = slothlet.contextManager;
	const leaf = contextManager?.runInContext && slothlet.instanceID ? rootLeaf(slothlet) : null;
	if (leaf === null) return construct ? Reflect.construct(root, args) : Reflect.apply(root, thisArg, args);
	const fn = leaf.____slothletInternal.impl;
	if (construct) {
		const instanceID = makerInstanceID(slothlet) ?? slothlet.instanceID;
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
		makerInstanceID(slothlet) ?? slothlet.instanceID,
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
 * call goes through the root's call check (see {@link rootCallCheck}), as `call` on a function node calls the
 * node. What the root's file layer hands out instead runs the module's function itself, past the check. Any other value
 * (a member of the root's own by that name) is answered as it is.
 * @param {object} slothlet - The instance.
 * @param {string|symbol} prop - The key read.
 * @param {*} value - What the root answered for it.
 * @returns {*} The value to hand out.
 * @private
 */
function rootInvoker(slothlet, prop, value) {
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
function rootMemberRead(slothlet, prop, value) {
	if (value !== null && (typeof value === "object" || typeof value === "function")) {
		const node = resolveWrapper(value);
		if (node !== null) {
			// A node is traversal, as at any node; a file's primitive, null or undefined default export is its value,
			// read through the gate.
			if (!node.___holdsValue()) return value;
			const held = node.___heldValue();
			enforceRead(rootGate(slothlet), prop, held);
			return held;
		}
	}
	// The root function's own answers, where the root holds no member by the name: its `prototype` and `toString` hold
	// its code and are checked as a call of the root, and its `name` and `length` are read without a check, as a
	// function node answers each of them (see isBuiltinFunctionMember).
	if (isRootFunctionAnswer(slothlet, prop)) {
		const gate = rootGate(slothlet);
		if (prop !== "name" && prop !== "length") enforceCodeMember(gate, value);
		// The `prototype` is handed out as a function node hands its own: its `constructor` is the root.
		if (prop === "prototype") return prototypeForReader(gate, value, "prototype");
		return value;
	}
	// The root function's `call`, `apply` and `bind` call the root through its check, as a function node's call the node.
	if (typeof value === "function") {
		const invoker = rootInvoker(slothlet, prop, value);
		if (invoker !== value) return invoker;
	}
	// Only data the root lists as a member is gated: a node read off the root is traversal, as at any node.
	if (typeof prop === "string" && isTerminalData(value) && readsGated(slothlet)) {
		const descriptor = Objects.getOwnPropertyDescriptor(slothlet.api, prop);
		if (descriptor !== undefined && descriptor.enumerable) enforceRead(rootGate(slothlet), prop, value);
	}
	return value;
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
function rootMemberDescriptor(slothlet, prop, descriptor) {
	if (readsGated(slothlet)) {
		const gate = rootGate(slothlet);
		const decided = isHostRead(gate) && !slothlet.handlers.permissionManager.isPrivateTarget(String(prop));
		// The root function's own `name` and `length` are described as they are read, without a check (see
		// rootMemberRead); a member the root lists by that name is the module's and is decided as any other.
		const builtin = typeof slothlet.api === "function" && isLanguageNameDescriptor(prop, descriptor);
		if (!decided && !builtin && isReadRedacted(gate, prop)) return undefined;
	}
	// The root function's own `prototype` and `toString`, described only to a reader that may call the root, as a function
	// node describes its own.
	if (isRootFunctionAnswer(slothlet, prop) && prop !== "name" && prop !== "length") {
		const gate = rootGate(slothlet);
		if (isCodeMemberWithheld(gate, descriptor)) return undefined;
		if (prop === "prototype" && "value" in descriptor)
			return { __proto__: null, ...descriptor, value: prototypeForReader(gate, descriptor.value, "prototype") };
		return descriptor;
	}
	const value = descriptor.value;
	if (!("value" in descriptor) || value === null || (typeof value !== "object" && typeof value !== "function")) return descriptor;
	const node = resolveWrapper(value);
	return node !== null && node.___holdsValue() ? { __proto__: null, ...descriptor, value: node.___heldValue() } : descriptor;
}

/**
 * Whether the api root withholds a member from the reader's description: the root holds it, and describes it to the
 * reader as it describes no member (see {@link rootMemberDescriptor}), which it does for a value the reader may
 * not read and for the root function's own code a reader may not call. A closed root must still describe the key, so it
 * is described with its value withheld.
 * @param {object} slothlet - The instance.
 * @param {string|symbol} prop - The member's key.
 * @returns {boolean} True when the value is withheld.
 * @internal
 */
function rootWithheld(slothlet, prop) {
	const held = slothlet.api ? Objects.getOwnPropertyDescriptor(slothlet.api, prop) : undefined;
	return held !== undefined && rootMemberDescriptor(slothlet, prop, held) === undefined;
}

/**
 * Record an instance's api root proxy, so a write the framework makes to it is its own (see {@link frameworkWrite}).
 * @param {object} root - The root proxy.
 * @returns {object} `root`.
 * @internal
 */
function registerRoot(root) {
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
function rootShellDescriptor(descriptor, slothlet = null, prop = null) {
	const value = descriptor.value;
	if (!("value" in descriptor) || value === null || (typeof value !== "object" && typeof value !== "function")) return descriptor;
	// The root function's own `prototype` or `toString`, fixed read-only, is held as a stand-in every holder may be
	// described (see pinnedCodeMember).
	if (slothlet !== null && descriptor.writable === false && isRootFunctionAnswer(slothlet, prop) && pinsAsCode(value, slothlet))
		return { __proto__: null, ...descriptor, value: pinnedCodeMember(rootGate(slothlet), value) };
	const impl = resolveWrapper(value)?.____slothletInternal.impl;
	return isHeldPrimitive(impl) ? { __proto__: null, ...descriptor, value: impl } : descriptor;
}

/**
 * Whether the api root takes a member under a key: any key while it is open, and once closed only one it holds, as a
 * closed object takes. The target is what tells: a function root's api stays open (see {@link rootClose}).
 * @param {object|Function} target - The root proxy's target.
 * @param {string|symbol} prop - The key.
 * @returns {boolean} Whether a member may be set or defined under it.
 * @internal
 */
function rootTakesKey(target, prop) {
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
function rootMemberNode(slothlet, prop, value) {
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
	return node.___createProxy();
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
function rootFixedMember(slothlet, prop, fixed, described) {
	if (!("value" in fixed)) return described ? fixed : Reflect.get(slothlet.api, prop);
	if (!fixed.writable) {
		// A stand-in for the root function's code is described to anyone: each use of it is checked.
		if (described && WeakMapMethods.has(PINNED_CODE_MEMBERS, fixed.value)) return fixed;
		rootMemberRead(slothlet, prop, behindPinnedCode(fixed.value));
		return described ? fixed : fixed.value;
	}
	// A writable member is described with the value the reader may not read withheld, as a node describes one (#825).
	if (described && rootWithheld(slothlet, prop)) return { __proto__: null, ...fixed, value: undefined };
	const value = rootMemberRead(slothlet, prop, slothlet.api[prop]);
	return described ? { __proto__: null, ...fixed, value } : value;
}

/**
 * A member of the api root as its hook shows it to a module: the framework's namespace as its own hook shows it (only
 * what the module may read), a function of the framework's by the form of the function behind the module's view of it,
 * and anything else as {@link inspectSafe} shows it, a form shown unquoted as `util.inspect` shows one.
 * @param {*} value - The member, read through the module's view of the root.
 * @param {Array<*>} args - The hook's arguments.
 * @param {object} slothlet - The instance.
 * @returns {*} What is shown.
 * @private
 */
function rootMemberShown(value, args, slothlet) {
	const behind =
		value !== null && (typeof value === "object" || typeof value === "function")
			? WeakMapMethods.get(FRAMEWORK_VIEW_TARGETS, value)
			: undefined;
	if (behind !== undefined && typeof value === "object") return value;
	const safe = inspectSafe(value, args, true, slothlet);
	if (typeof safe !== "string" || safe === value) return safe;
	return inspectLabel(typeof behind === "function" ? codeLabel(behind) : safe);
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
function rootInspectShown(slothlet, args) {
	// A module is shown the root as its own view of it reads it, and the module's code by its form (as a node shows it),
	// so the hook, which a read of the root hands out, gives the module nothing it could not read.
	const reader = selfModuleReader(slothlet);
	const root = reader ? selfRootView(slothlet, reader) : slothlet.boundApi;
	const shown = {};
	for (let ofIndex = 0, ofList = Objects.keys(root); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		try {
			shown[key] = reader ? rootMemberShown(root[key], args, slothlet) : root[key];
		} catch (error) {
			if (error?.code !== "PERMISSION_DENIED") throw error;
		}
	}
	const api = slothlet.api;
	if (typeof api !== "function") return shown;
	const label = codeLabel(isCompositionLayer(api) ? layerUnderlying(api) : api);
	if (Objects.keys(shown).length === 0) return label;
	const options = args[1],
		inspect = args[2];
	return `${label} ${(typeof inspect === "function" ? inspect : util.inspect)(shown, options)}`;
}

/**
 * Give the api root proxy's target the `util.inspect` hook a node's target has (see {@link defineProxyInspect}):
 * Node inspects a Proxy's target, not what its traps report, so without it the root shows as its empty stand-in.
 * @param {object} slothlet - The instance.
 * @param {object|Function} target - The root proxy's target.
 * @returns {void}
 * @internal
 */
function defineRootInspect(slothlet, target) {
	Objects.defineProperty(target, util.inspect.custom, {
		__proto__: null,
		value: registerInspectHook(function (...args) {
			return rootInspectShown(slothlet, args);
		}),
		writable: false,
		enumerable: false,
		configurable: true
	});
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
 * @throws {SlothletError} When module code may not change the root (see {@link assertRootChange}).
 * @internal
 */
function rootClose(slothlet, target, isCallable, prototype) {
	// Closing a root already closed changes nothing, as on a plain object.
	if (!Reflect.isExtensible(target)) return true;
	assertRootChange(slothlet, null);
	const api = slothlet.api;
	// The root holds slothlet's namespace and root functions, which closing it would pin with it: module code may not
	// change them (the built-in write rules), so it may not close the root. Refused before anything closes.
	for (const name of setValues(SELF_FRAMEWORK_ROOTS)) if (hasOwn(api, name)) assertRootChange(slothlet, name);
	// A function root's api is a layer over its module's function, kept open so the function is not changed: the target
	// alone closes then, and from then on holds the keys the root has (see rootTakesKey).
	if (!Reflect.preventExtensions(api) && !isCompositionLayer(api)) return false;
	// A closed root reports its target's prototype (invariant): a function root's is its function's, or the one the
	// root was given, which an object root's target holds already. One it was given is held as the view every holder of
	// the closed root reads it through (see rootPrototypeFor).
	if (isCallable || prototype !== undefined) Reflect.setPrototypeOf(target, prototype);
	for (let ofIndex = 0, ofList = Reflect.ownKeys(api); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		Reflect.defineProperty(target, key, rootShellDescriptor(Reflect.getOwnPropertyDescriptor(api, key), slothlet, key));
	}
	return Reflect.preventExtensions(target);
}

/**
 * Define a member of the api root, as a definition on the api object: on the api itself, and on the root proxy's target
 * too where the invariants bind it (a member made non-configurable, and every member once the root is closed).
 * @param {object} slothlet - The instance.
 * @param {object|Function} target - The root proxy's target.
 * @param {string|symbol} prop - The member's key.
 * @param {PropertyDescriptor} descriptor - The definition.
 * @returns {boolean} Whether it was defined.
 * @throws {SlothletError} When module code may not change the member (see {@link assertRootChange}).
 * @internal
 */
function rootDefine(slothlet, target, prop, descriptor) {
	const api = slothlet.api;
	// A definition that changes nothing (freezing a root already frozen) is no write, as on a node (#667).
	if (!Reflect.isExtensible(target) && isUnchangingDefinition(target, prop, descriptor)) return true;
	assertRootChange(slothlet, prop);
	// A name with the framework's prefix is absorbed as a node's definition absorbs it (see absorbsFrameworkName).
	const absorbed = absorbsFrameworkName(target, prop, descriptor);
	if (absorbed !== undefined) return absorbed;
	if ("value" in descriptor) descriptor = { __proto__: null, ...descriptor, value: unwrapSelfView(descriptor.value) };
	// A key only the target holds (its inspect hook) is the target's own.
	if (!hasOwn(api, prop) && hasOwn(target, prop)) return Reflect.defineProperty(target, prop, descriptor);
	if (!rootTakesKey(target, prop)) return false;
	// An object or function defined on the root is held as a node, as one assigned to it is, unless the definition fixes
	// it (read-only and non-configurable): the language requires the root to hand that value out as it was defined.
	if ("value" in descriptor) {
		const current = Reflect.getOwnPropertyDescriptor(api, prop);
		const configurable = "configurable" in descriptor ? descriptor.configurable : (current?.configurable ?? false);
		const writable = "writable" in descriptor ? descriptor.writable : current && "value" in current ? current.writable : false;
		if (!configurable && !writable) refuseFixedObjectDefinition(slothlet, "", prop, descriptor.value);
		const node = configurable || writable ? rootMemberNode(slothlet, prop, descriptor.value) : null;
		if (node !== null) descriptor = { __proto__: null, ...descriptor, value: node };
	}
	// A full-isolation run's `self` keeps what it defines on the root in its own record (see runWrite).
	const runSink = takeRunWrite(slothlet.boundApi, prop);
	if (runSink !== null) return runSink({ op: "define", descriptor });
	if (!Reflect.defineProperty(api, prop, descriptor)) return false;
	const held = Reflect.getOwnPropertyDescriptor(api, prop);
	if (held.configurable && Reflect.isExtensible(target)) return true;
	return Reflect.defineProperty(target, prop, rootShellDescriptor(held, slothlet, prop));
}

/**
 * Assign a member of the api root, as an assignment on the api object: an object or function the host assigns is held
 * as a node (see {@link rootMemberNode}).
 * @param {object} slothlet - The instance.
 * @param {object|Function} target - The root proxy's target.
 * @param {string|symbol} prop - The member's key.
 * @param {*} value - The value assigned.
 * @returns {boolean} Whether it was assigned.
 * @throws {SlothletError} When module code may not change the member (see {@link assertRootChange}).
 * @internal
 */
function rootAssign(slothlet, target, prop, value) {
	assertRootChange(slothlet, prop);
	// A name with the framework's prefix is absorbed as a node's assignment absorbs it.
	if (isFrameworkMemberName(prop)) return true;
	if (!rootTakesKey(target, prop)) return false;
	value = unwrapSelfView(value);
	const stored = rootMemberNode(slothlet, prop, value) ?? value;
	// A full-isolation run's `self` keeps what it writes on the root in its own record (see runWrite).
	const runSink = takeRunWrite(slothlet.boundApi, prop);
	if (runSink !== null) return runSink({ op: "set", value: stored });
	return Reflect.set(slothlet.api, prop, stored);
}

/**
 * The keys of the api root a reader is given, as a node's listing gives its own: what the reader may not read is left
 * out (see {@link isReadRedacted}). A key the root's target holds fixed stays, as the invariants require.
 * @param {object} slothlet - The instance.
 * @param {object|Function} target - The root proxy's target.
 * @param {Array<string|symbol>} keys - The keys the api root holds.
 * @returns {Array<string|symbol>} The keys listed.
 * @internal
 */
function rootListing(slothlet, target, keys) {
	if (!readsGated(slothlet)) return keys;
	const gate = rootGate(slothlet);
	// The reader is the same for every key of one listing, so it is resolved once.
	const host = isHostRead(gate);
	const listed = [];
	for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (host && !slothlet.handlers.permissionManager.isPrivateTarget(String(key))) {
			listPush(listed, key);
			continue;
		}
		const fixed = Reflect.getOwnPropertyDescriptor(target, key);
		if ((fixed && !fixed.configurable) || !isReadRedacted(gate, key, null, null, true)) listPush(listed, key);
	}
	return listed;
}

/**
 * Build an instance's api root: the Proxy `api` is, over a target of its own (a bound function for a callable root, a
 * plain object otherwise), whose traps read and change the instance's current api under the rules a node's do. Called
 * once per instance, on its first load: the root keeps its identity across reloads.
 *
 * Also gives the instance what a run's view of the root and the framework's own changes to it use: `____rootPrototypes`
 * (the prototype the root holds and reports) and `____rootBarrier` (save the root's members before a change while a run
 * is open).
 * @param {object} slothlet - The instance.
 * @param {WeakMap<object, {given: boolean, prototype: (object|null)}>} records - The instance's record of a function
 *   root's prototype, per api the root reads.
 * @param {function(): object} instanceApi - The instance's own api (not a run's tree).
 * @param {function(object): void} closeSelf - Close the instance's `self` as the root target closes.
 * @returns {Function|object} The root proxy.
 * @internal
 */
function rootProxy(slothlet, records, instanceApi, closeSelf) {
	// V8 fork-pool coverage gaps with isCallable cond-expr; proxy trap null guards are defensive dead code.
	/* v8 ignore start */
	// Determine proxy target type based on slothlet.api (like UnifiedWrapper does)
	const isCallable = typeof slothlet.api === "function" || (slothlet.api && typeof slothlet.api.default === "function");
	// A bound function for a callable root, as an api node's own target is: callable and constructible, with no
	// `prototype` of its own, so the traps report the root's function as it is (an async function, an arrow, a
	// bound function or a method has none) without breaking an invariant of the target's.
	const proxyTarget = isCallable ? FunctionMethods.bind(function () {}) : {};
	// A function root's prototype, on a record of the root's own as a function node's is on its node's: the root
	// file's function's until the root is given one (`Object.setPrototypeOf(api, …)`), which the record then holds,
	// so the function is never changed through the root. A load that gives the root a value starts it again.
	// One record per api the root reads (the instance's, a run's own tree's), so a run's root keeps its own.
	const rootRecord = () => {
		let record = WeakMapMethods.get(records, slothlet.api);
		if (record === undefined) {
			record = { given: false, prototype: null };
			WeakMapMethods.set(records, slothlet.api, record);
		}
		return record;
	};
	// The root's record, its prototype brought up to date: the root file's function's until the root is given one.
	const rootRecordNow = () => {
		const rootPrototype = rootRecord();
		if (!rootPrototype.given) rootPrototype.prototype = Reflect.getPrototypeOf(slothlet.api);
		return rootPrototype;
	};
	const rootPrototypeNow = () => rootRecordNow().prototype;
	// Whether the root reads a tree a run has of its own: the root's target is shared with the instance.
	const inRunTree = () => slothlet.api !== instanceApi();
	// A run that started before a change to the root reads the root as it was (see helpers/run-snapshot): the root's
	// members are saved before every change to it, once per window, while a run is open.
	const rootBarrier = () => {
		if (!anyRunOpen() || !slothlet.api) return;
		if (!inRunTree()) beforeChange(domainOf(slothlet), slothlet.api, rootCapture);
		// The root of a run's own tree is saved for the runs opened in that run (see Slothlet#_runTreeSnapshot).
		else beforeChange(slothlet._runTreeSnapshot(slothlet._treeEpoch), slothlet.api, rootCapture);
	};
	// The root's members as they are, inheriting from the prototype the root has (a function root's is on its record).
	const rootCapture = (api) => {
		return shallowCopy(api, rootHeld());
	};
	// Whether a member is read from a prototype the function root was given: one the root does not hold itself.
	const rootInherits = (prop) => {
		if (!isCallable) return false;
		return rootRecordNow().given && !Objects.hasOwn(slothlet.api, prop);
	};
	// The prototype the root has now, as the root itself holds it: an object root's is its api's.
	const rootHeld = () => (isCallable ? rootPrototypeNow() : Reflect.getPrototypeOf(slothlet.api));
	// Whether the root has a prototype it was given (an object root starts with `Object.prototype`).
	const rootGiven = () => (isCallable ? rootRecordNow().given : Reflect.getPrototypeOf(slothlet.api) !== Objects.prototype);
	// The views module code is handed of a prototype the root was given, kept for as long as the root has it, and
	// the prototype as whoever reads the root now is handed it: the host the object, a module its own view.
	const rootViews = { prototypeViews: null };
	const rootReported = (target) => {
		if (!slothlet.api || !Reflect.isExtensible(target)) return Reflect.getPrototypeOf(target);
		return rootGiven() ? rootPrototypeFor(slothlet, rootViews, rootHeld()) : rootHeld();
	};
	// A run's view of the root reads the prototype the root had when the run started (see makeRunSelf): the one the root
	// has now, as the root holds it, and a prototype as whoever reads the root is handed it.
	slothlet.____rootPrototypes = {
		held: () => (slothlet.api ? rootHeld() : null),
		reported: (held) =>
			held === null ||
			held === Objects.prototype ||
			held === Functions.prototype ||
			(isCallable && held === Reflect.getPrototypeOf(slothlet.api))
				? held
				: rootPrototypeFor(slothlet, rootViews, held)
	};
	// The framework's own changes to the root object (an add() or remove() placing or dropping a member on it, not
	// through the proxy) save it the same way first (see ApiManager#beforeRootChange).
	slothlet.____rootBarrier = rootBarrier;
	// Node inspects a Proxy's target: the target shows the root as a node's shows the node.
	defineRootInspect(slothlet, proxyTarget);

	return registerRoot(
		new NativeProxy(proxyTarget, {
			// A member is read as a node reads its own: the same gate, at the member's name (see unified-wrapper.mjs).
			// A member the target holds fixed is read as the target holds it (proxy invariant).
			get: (target, prop) => {
				if (!slothlet.api) return undefined;
				const fixed = Reflect.getOwnPropertyDescriptor(target, prop);
				if (fixed && !fixed.configurable) return rootFixedMember(slothlet, prop, fixed, false);
				// A key only the target holds (its inspect hook, which `util.inspect` reads through the proxy when the root
				// is the target of another proxy) is the target's.
				if (fixed && typeof prop === "symbol" && !(prop in slothlet.api)) return fixed.value;
				// The root's `__proto__` is the prototype it reports, as an object's or a function's is.
				if (prop === "__proto__" && !Objects.hasOwn(slothlet.api, prop)) {
					const from = rootHeld();
					return from === null ? undefined : Reflect.get(from, prop, slothlet.boundApi);
				}
				// A member a function root inherits from a prototype it was given is read from there, on the root, and
				// one an object root inherits from one through its api: either under the rules a member of the root is.
				if (rootInherits(prop)) {
					const from = rootRecord().prototype;
					if (from === null) return rootMemberRead(slothlet, prop, undefined);
					return rootInheritedRead(slothlet, rootViews, from, prop, Reflect.get(from, prop, slothlet.boundApi));
				}
				if (!isCallable && rootGiven() && !Objects.hasOwn(slothlet.api, prop)) {
					const from = rootHeld();
					if (from !== null) return rootInheritedRead(slothlet, rootViews, from, prop, slothlet.api[prop]);
				}
				return rootMemberRead(slothlet, prop, slothlet.api[prop]);
			},
			// A change to the root is a change to the api, held to the rules the same change at a node is held to.
			set: (target, prop, value) => {
				if (!slothlet.api) return true;
				rootBarrier();
				return rootAssign(slothlet, target, prop, value);
			},
			has: (target, prop) => {
				if (!slothlet.api) return false;
				if (rootInherits(prop)) {
					const from = rootRecord().prototype;
					if (from !== null && Reflect.has(from, prop)) return true;
				} else if (prop in slothlet.api) return true;
				const fixed = Reflect.getOwnPropertyDescriptor(target, prop);
				return fixed !== undefined && (!fixed.configurable || !Reflect.isExtensible(target));
			},
			// The root lists what a node lists of its own: a member the reader may not read is left out. A closed root
			// lists what it holds, to every reader (proxy invariant).
			ownKeys: (target) => {
				if (!slothlet.api) return [];
				if (!Reflect.isExtensible(target)) return Reflect.ownKeys(target);
				return rootListing(slothlet, target, Reflect.ownKeys(slothlet.api));
			},
			defineProperty: (target, prop, descriptor) => {
				if (!slothlet.api) return false;
				rootBarrier();
				return rootDefine(slothlet, target, prop, descriptor);
			},
			deleteProperty: (target, prop) => {
				if (!slothlet.api) return true;
				rootBarrier();
				assertRootChange(slothlet, prop);
				// A full-isolation run's `self` keeps a removal on the root in its own record (see runWrite).
				const runSink = takeRunWrite(slothlet.boundApi, prop);
				if (runSink !== null) return runSink({ op: "delete" });
				const held = Objects.hasOwn(slothlet.api, prop);
				if (!Reflect.deleteProperty(slothlet.api, prop)) return false;
				if (!held && Reflect.isExtensible(target)) return true;
				return Reflect.deleteProperty(target, prop);
			},
			// A call of the root's function is checked as a call of a function node is.
			apply: (target, thisArg, args) => {
				if (!slothlet.api) return undefined;
				rootCallCheck(slothlet, args);
				return rootCall(slothlet, thisArg, args);
			},
			construct: (target, args) => {
				if (!slothlet.api) return {};
				rootCallCheck(slothlet, args);
				return rootCall(slothlet, undefined, args, true);
			},
			// The root's function's own prototype (an async function's `AsyncFunction.prototype`), as its api node reports it,
			// or the one the root was given.
			getPrototypeOf: (target) => rootReported(target),
			// A prototype set on an object root is set on the api, whose members inherit from it, and on its target, which
			// reports it. A function root takes it on its own record, and its function keeps the one it has.
			setPrototypeOf: (target, proto) => {
				if (!slothlet.api) return Reflect.setPrototypeOf(target, proto);
				assertRootChange(slothlet, null);
				rootBarrier();
				if (!Reflect.isExtensible(target)) return Reflect.getPrototypeOf(target) === proto;
				proto = behindGivenView(unwrapSelfView(proto));
				if (isCallable) {
					rootPrototypeNow();
					const rootPrototype = rootRecord();
					rootPrototype.given = proto !== Reflect.getPrototypeOf(slothlet.api);
					rootPrototype.prototype = proto;
					return true;
				}
				// A run's tree takes it on its own api: the target, which reports it, is the instance's too.
				if (inRunTree()) return Reflect.setPrototypeOf(slothlet.api, proto);
				return Reflect.setPrototypeOf(slothlet.api, proto) && Reflect.setPrototypeOf(target, proto);
			},
			// Closing the root closes the api (see rootClose).
			preventExtensions: (target) => {
				if (!slothlet.api) return Reflect.preventExtensions(target);
				// The root's target is the instance's as well: a run reading a tree of its own cannot close it.
				if (inRunTree()) return false;
				rootBarrier();
				const closed = rootClose(
					slothlet,
					target,
					isCallable,
					rootGiven() ? rootPrototypeFor(slothlet, rootViews, rootHeld(), true) : rootHeld()
				);
				// A module's `self` is closed as the root it stands for is (#827).
				if (closed) closeSelf(target);
				return closed;
			},
			getOwnPropertyDescriptor: (target, prop) => {
				const fixed = Reflect.getOwnPropertyDescriptor(target, prop);
				if (fixed && !fixed.configurable) return rootFixedMember(slothlet, prop, fixed, true);
				if (slothlet.api && prop in slothlet.api) {
					const desc = Objects.getOwnPropertyDescriptor(slothlet.api, prop);
					const described = desc ? rootMemberDescriptor(slothlet, prop, desc) : undefined;
					if (described) return { __proto__: null, ...described, configurable: true };
				}
				// A closed root reports every member it holds (proxy invariant): one the reader may not read is described
				// with its value withheld (#825).
				if (fixed && !Reflect.isExtensible(target)) {
					if (rootWithheld(slothlet, prop)) return { __proto__: null, ...fixed, value: undefined };
					rootMemberRead(slothlet, prop, slothlet.api?.[prop]);
					return fixed;
				}
				return undefined;
			}
		})
	);
	/* v8 ignore stop */
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
					behindPinnedCode,
					pinsAsCode,
					gate: rootGate,
					fileOf: rootFileOf,
					noteRootFile,
					proxy: rootProxy
				});
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					UnifiedWrapper = registered;
					INTRINSICS = methods.values.INTRINSICS;
					inspectLabel = methods.inspect.label;
					inspectSafe = methods.inspect.safe;
					isCodeMemberWithheld = methods.is.codeMemberWithheld;
					isHeldPrimitive = methods.is.heldPrimitive;
					isHostRead = methods.is.hostRead;
					isReadRedacted = methods.is.readRedacted;
					isRootFunctionAnswer = methods.is.rootFunctionAnswer;
					isTerminalData = methods.is.terminalData;
					isUnchangingDefinition = methods.is.unchangingDefinition;
					makerInstanceID = methods.nodes.makerInstanceID;
					prototypeForReader = methods.prototype.forReader;
					enforcePermission = methods.rules.enforcePermission;
					FRAMEWORK_VIEW_TARGETS = methods.rules.FRAMEWORK_VIEW_TARGETS;
					FRAMEWORK_WRITES = methods.rules.FRAMEWORK_WRITES;
					ROOT_PROXIES = methods.rules.ROOT_PROXIES;
					assertRootChange = methods.rules.assertRootChange;
					enforceCodeMember = methods.rules.enforceCodeMember;
					enforceRead = methods.rules.enforceRead;
					memberHoldsCode = methods.rules.memberHoldsCode;
					pinnedCodeMember = methods.rules.pinnedCodeMember;
					refuseFixedObjectDefinition = methods.rules.refuseFixedObjectDefinition;
					takeRunWrite = methods.run.takeRunWrite;
					GIVEN_VIEWS = methods.views.GIVEN_VIEWS;
					hasOwn = methods.has.own;
					HOST_READER = methods.views.HOST_READER;
					PINNED_CODE_MEMBERS = methods.views.PINNED_CODE_MEMBERS;
					selfModuleReader = methods.self.moduleReader;
					selfRootView = methods.self.rootView;
					unwrapSelfView = methods.views.unwrapSelfView;
					SELF_FRAMEWORK_ROOTS = methods.views.SELF_FRAMEWORK_ROOTS;
					givenAsIs = methods.given.asIs;
					givenMember = methods.given.member;
					givenViewOn = methods.given.viewOn;
					SEALED_SHELL_READER = methods.membrane.SEALED_SHELL_READER;
					searchBudget = methods.membrane.searchBudget;
					searchDepth = methods.membrane.searchDepth;
					registerLeafFile = methods.uw.registerLeafFile;
					resolveWrapper = methods.uw.resolveWrapper;
					trustedRootOwn = methods.uw.trustedRootOwn;
					behindGivenView = methods.membrane.behindGivenView;
					registerInspectHook = methods.values.registerInspectHook;
					isWrapper = methods.brand.isWrapper;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/root", import.meta.url);
				super(slothlet);
			}

			/**
			 * The value a node answers in its place (see {@link holdsValue}).
			 * @param {object} wrapper - The node's wrapper.
			 * @returns {*} The value.
			 * @private
			 */
			___heldValue() {
				if (!isWrapper(this)) throw ownBindingsRefusal("lib/handlers/unified-wrapper/root", import.meta.url);
				const wrapper = this;
				const internal = wrapper.____slothletInternal;
				return isHeldPrimitive(internal.impl) ? internal.impl : internal.nullish.value;
			}
		}
	);
}
