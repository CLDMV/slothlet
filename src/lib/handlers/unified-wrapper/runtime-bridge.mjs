/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/runtime-bridge.mjs
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
 * @fileoverview Runtime bridge layer of the wrapper: the `self` and `context` a runtime exports.
 *
 * Both runtimes (async and live) export a `self` (an object form and a callable one, #803) and a `context`, Proxies
 * whose traps read the running call's store and hand what they read through the wrapper's views. The traps are the
 * same for both; what differs is how a runtime finds the store a trap reads and who it reads as, which the runtime hands
 * in as a {@link RuntimeAccess}. A runtime takes its finished Proxies from {@link runtimeTraps}.
 *
 *
 * Upward services: none; this layer reads only layers below it and the table's own entries.
 * @module @cldmv/slothlet/handlers/unified-wrapper/runtime-bridge
 * @internal
 */
import { SlothletError } from "#errors";
import {
	FunctionMethods,
	MapMethods,
	NativeProxy,
	Reflect,
	setFrom,
	SetMethods,
	String,
	concatLists,
	WeakSetMethods,
	WeakMapMethods,
	ArrayMethods,
	TypeError,
	listPush,
	Arrays
} from "#helpers/intrinsics";
import { ownBindingsRefusal } from "#helpers/instance-imports";
import { segmentsOf } from "#helpers/segments";
import { identityCeilings } from "#handlers/trusted-root";
import { isBoxedPrimitive } from "#helpers/clone-context";

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.linkLayer`), before any wrapper exists.
 */
let trustedRootOwn,
	contextRead,
	RUNTIME_CONTEXTS,
	selfChangeTarget,
	selfFrameworkView,
	selfReadAsDefiner,
	selfView,
	unwrapSelfView,
	RUNTIME_CALLABLE_SELVES,
	RUNTIME_SELVES,
	SELF_FRAMEWORK_ROOTS,
	frameDefiner,
	makerInstanceID,
	readOnBehalf,
	CROSSINGS,
	isSlothletValue,
	CONTEXT_HOST_VALUES,
	CONTEXT_WRITERS,
	isRefusal,
	SNAPSHOT_OMIT;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/**
 * How a runtime finds the store its `self` and `context` read, and who reads through them.
 * @typedef {object} RuntimeAccess
 * @property {function(object=): (object|null)} current - The store of the call `self` reads for, holding a `self`, or
 *   null. Given an object, the runtime may leave on it what it resolved (`store`, `identity`) for {@link access} and
 *   {@link hostFlow}.
 * @property {function(): (object|null)} store - The store `context` reads, or null.
 * @property {function(): (string|null)} loadingInstance - The instance whose file is loading in a store of its own
 *   with no call running, whose code then reads `self` as its definer; null when the runtime has none.
 * @property {function(PropertyKey): void} refuseUnknown - Refuse a read of `self` no call accounts for, before the
 *   read is refused for having no context (the live runtime's permission check); a no-op where there is none.
 * @property {function(object, object): boolean} hostFlow - Whether the store is one the host opened (`run()` /
 *   `scope()`) with no module call running.
 * @property {function(object): (object|null)} access - The access a read of a member hands the view it builds, from
 *   what {@link current} resolved, or null.
 * @property {symbol} bindKey - The key the binder of an instance's own `self` is read under (#803).
 * @property {Function} bind - That binder.
 */

/**
 * The root members of the framework's own: what `self` hands out under these names is a view of the framework member.
 * @type {Set<string>}
 * @private
 */
const FRAMEWORK_SELF_ROOTS = setFrom(["slothlet", "shutdown", "destroy"]);

/**
 * The plain data `JSON.stringify` writes for a value read through `self`, as the reader may read it (#803): each
 * member the reader is refused (its read, its description, or the `toJSON` the serialization looks up on it) is left
 * out, as a listing leaves it out, and never thrown for. An array element refused is written as `null`, where JSON
 * writes a member with no value. Everything else is what JSON does: `toJSON` is called with the member's key, a
 * function, a symbol and `undefined` are left out, a boxed primitive and a primitive are kept for JSON to write, and a
 * cycle throws the `TypeError` JSON throws.
 * @param {*} value - The value.
 * @param {string} key - Its key in its holder.
 * @param {Array<object>} stack - The objects being written, outermost first.
 * @param {boolean} [skipToJSON=false] - Do not look up `toJSON` on the value itself (it is the root being written).
 * @returns {*} The data, or {@link SNAPSHOT_OMIT}.
 * @private
 */
function jsonSnapshot(value, key, stack, skipToJSON = false) {
	if (!skipToJSON && value !== null && (typeof value === "object" || typeof value === "function")) {
		let toJSON;
		try {
			toJSON = value.toJSON;
		} catch (error) {
			if (!isRefusal(error)) throw error;
		}
		if (typeof toJSON === "function") {
			try {
				value = Reflect.apply(toJSON, value, [key]);
			} catch (error) {
				if (!isRefusal(error)) throw error;
				return SNAPSHOT_OMIT;
			}
		}
	}
	if (value === undefined || typeof value === "function" || typeof value === "symbol") return SNAPSHOT_OMIT;
	if (value === null || typeof value !== "object" || isBoxedPrimitive(value)) return value;
	if (ArrayMethods.includes(stack, value)) throw new TypeError("Converting circular structure to JSON");
	listPush(stack, value);
	try {
		if (Arrays.isArray(value)) {
			const out = [];
			const length = value.length;
			for (let i = 0; i < length; i++) {
				let element;
				try {
					element = jsonSnapshot(value[i], String(i), stack);
				} catch (error) {
					if (!isRefusal(error)) throw error;
					element = SNAPSHOT_OMIT;
				}
				listPush(out, element === SNAPSHOT_OMIT ? null : element);
			}
			return out;
		}
		const out = {};
		for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
			const name = ofList[ofIndex];
			if (typeof name !== "string") continue;
			let member;
			try {
				const descriptor = Reflect.getOwnPropertyDescriptor(value, name);
				if (!descriptor?.enumerable) continue;
				member = jsonSnapshot(value[name], name, stack);
			} catch (error) {
				if (!isRefusal(error)) throw error;
				continue;
			}
			if (member !== SNAPSHOT_OMIT) out[name] = member;
		}
		return out;
	} finally {
		ArrayMethods.pop(stack);
	}
}

/**
 * The `toJSON` `self` answers for an api whose root is an object and has no `toJSON` member of its own (#803): it
 * gives the data `JSON.stringify(api)` gives the host, less what the reader is refused (see
 * {@link jsonSnapshot}). A refusal of a member the reader did not name never throws here; a read of that
 * member by name still does.
 * @this {object} The `self` being written.
 * @param {string} [key] - The key JSON passes.
 * @returns {*} The data.
 * @internal
 */
function selfToJSON(key) {
	const data = jsonSnapshot(this, typeof key === "string" ? key : "", [], true);
	return data === SNAPSHOT_OMIT ? undefined : data;
}

/**
 * Record the module storing a value in the runtime `context`, so another module reading it gets it as a value that
 * module handed it ({@link contextRead}). What the host stores, and what a module stores again after reading it
 * from the host, is the host's and is recorded for no one.
 * @param {object} ctx - The active context store.
 * @param {*} value - The value being stored.
 * @returns {void}
 * @internal
 *
 * @example
 * contextWritten(ctx, value);
 * ctx.context[prop] = value;
 */
function contextWritten(ctx, value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
	const writer = ctx?.currentWrapper;
	if (!writer?.____slothletInternal || !WeakSetMethods.has(trustedRootOwn.genuineWrappers, writer)) return;
	// A view keeps where its value came from; slothlet's own values are handed out their own way.
	if (WeakMapMethods.has(CROSSINGS, value) || isSlothletValue(value)) return;
	if (WeakSetMethods.has(CONTEXT_HOST_VALUES, value) || WeakMapMethods.has(CONTEXT_WRITERS, value)) return;
	WeakMapMethods.set(CONTEXT_WRITERS, value, writer);
}

/**
 * A member of the runtime `context` read by code a module handed out while no call runs (the host running a closure, a
 * method of returned data, a generator): read in the context of the instance its definer belongs to, as `self` is
 * ({@link selfReadAsDefiner}), so the code reads the context it was made in instead of nothing. Code whose
 * definer the frames cannot tell, the host's own code, and any code while `provenance` is off, read nothing.
 * @param {object} contextProxy - The runtime's `context`.
 * @param {string|symbol} prop - The member read.
 * @returns {*} The member, or undefined.
 * @internal
 *
 * @example
 * if (!ctx) return contextReadAsDefiner(context, prop);
 */
function contextReadAsDefiner(contextProxy, prop) {
	const definer = frameDefiner();
	if (definer === null || definer.unplaced) return undefined;
	const leaf = definer.wrapper ?? definer.leaves[0];
	const slothlet = leaf?.____slothlet;
	if (slothlet?.handlers?.permissionManager?.isEnabled?.() && slothlet.config?.permissions?.caller?.provenance === false) return undefined;
	const contextManager = slothlet?.contextManager;
	const instanceID = contextManager?.runInContext ? makerInstanceID(slothlet) : null;
	if (instanceID === null) return undefined;
	const read = MapMethods.get(RUNTIME_CONTEXTS, contextManager) ?? contextProxy;
	return readOnBehalf(undefined, () =>
		contextManager.runInContext(instanceID, () => read[prop], undefined, [], leaf, true, false, null, null, false, true)
	);
}

/**
 * Refuse replacing one of the framework's root members (`self.slothlet`, `self.shutdown`, `self.destroy`)
 * through the runtime `self` (#625); a definition or deletion goes through {@link selfChangeTarget}.
 * While the permission system is on, module code meets the write rules first; the names are reserved for
 * everyone, so the assignment is refused either way, in an isolated scope as outside one.
 *
 * @param {object} slothlet - Instance the change is made on.
 * @param {string|symbol} prop - Member of `self` changed.
 * @returns {void}
 * @throws {SlothletError} `PERMISSION_DENIED` when module code changes a framework root member the write
 *   rules protect, `LOOSE_SET_UNATTRIBUTED` when the live runtime cannot tell which call is executing, and
 *   `API_PATH_INVALID` for the reserved name otherwise.
 * @internal
 *
 * @example
 * assertFrameworkRootChange(ctx.slothlet, "slothlet"); // throws inside a module call
 */
function assertFrameworkRootChange(slothlet, prop) {
	if (typeof prop !== "string" || !SetMethods.has(SELF_FRAMEWORK_ROOTS, prop)) return;
	if (slothlet.handlers.apiManager.frameworkProtected()) {
		const identity = slothlet.contextManager?.getCallerIdentity?.(slothlet.instanceID);
		if (identity?.unresolved) {
			throw new slothlet.SlothletError("LOOSE_SET_UNATTRIBUTED", { path: segmentsOf(prop) });
		}
		// Code a caller supplied to another module's call changes it only where every module it acts for may (#597).
		if (identity?.currentWrapper) {
			for (
				let ofIndex = 0, ofList = concatLists([identity.currentWrapper], identityCeilings(identity));
				ofIndex < ofList.length;
				ofIndex++
			) {
				const writer = ofList[ofIndex];
				slothlet.handlers.apiManager.assertOwnedWrite([prop], writer);
			}
		}
	}
	// A reserved name, refused whoever assigns it, including inside an isolated scope, whose `self` takes the
	// assignment without reaching the api.
	slothlet.handlers.apiManager.normalizeApiPath([prop]);
}

/**
 * Build a runtime's `self` (both forms) and `context`, and register them for reads made while no call runs (#726).
 * @param {object} contextManager - The runtime's context manager.
 * @param {RuntimeAccess} runtime - How the runtime reads its stores.
 * @returns {{objectSelf: object, callableSelf: Function, context: object}} The Proxies.
 * @internal
 *
 * @example
 * const { objectSelf, callableSelf, context } = runtimeTraps(asyncRuntime, access);
 */
function runtimeTraps(contextManager, runtime) {
	const { current, store, loadingInstance, refuseUnknown, hostFlow, access, bindKey, bind } = runtime;

	/**
	 * What `self` hands out for a member read off the api root.
	 * @param {PropertyKey} prop - The member.
	 * @param {*} value - Its value.
	 * @param {object|null} [resolved=null] - What {@link current} resolved for the read.
	 * @returns {*} The view.
	 */
	const selfMember = (prop, value, resolved = null) => {
		if (typeof prop !== "string") return value;
		if (SetMethods.has(FRAMEWORK_SELF_ROOTS, prop)) return selfFrameworkView(value);
		return selfView(value, undefined, null, resolved === null ? null : access(resolved));
	};

	const selfTraps = {
		get(_, prop) {
			// The binder an instance's file is given its own `self` through (#803), answered whoever reads it.
			if (prop === bindKey) return bind;
			const resolved = {};
			const ctx = current(resolved);
			if (!ctx) {
				// Code a module handed out, run while no call runs, reads `self` as its definer, told by its frames (#726).
				// Code a file started while it loaded has a store of its own: without a module to run as, it has no `self`.
				// Another instance's code running in that flow (a function an instance built by the loading file handed
				// out) is not the load's: it is read as its definer, as with no store.
				const read = selfReadAsDefiner(objectSelf, prop, loadingInstance());
				if (read) return read.value;
				refuseUnknown(prop);
				throw new SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
			}
			// A flow the host opened (`run()` / `scope()`) names no module. A module's code running in it (a function it
			// handed out, run by the host there) still reads `self` as its definer; the host's own code reads it as the host.
			if (hostFlow(ctx, resolved)) {
				const read = selfReadAsDefiner(objectSelf, prop, null, ctx.parentInstanceID);
				if (read) return read.value;
			}
			const value = ctx.self[prop];
			// An object root with no `toJSON` of its own serializes as `api` does for the host, less what the reader is
			// refused, which is left out rather than thrown for (#803).
			if (prop === "toJSON" && value === undefined && typeof ctx.self !== "function") return selfToJSON;
			return selfMember(prop, value, resolved);
		},
		ownKeys() {
			const ctx = current(null);
			if (!ctx) return [];
			return Reflect.ownKeys(ctx.self);
		},
		has(_, prop) {
			const ctx = current(null);
			if (!ctx) return false;
			return prop in ctx.self;
		},
		getOwnPropertyDescriptor(_, prop) {
			const ctx = current(null);
			if (!ctx) return undefined;
			const desc = Reflect.getOwnPropertyDescriptor(ctx.self, prop);
			// If the property exists on ctx.self, return a descriptor that's always configurable
			// to avoid proxy invariant violations (since the proxy target is an empty object)
			if (desc) {
				return "value" in desc
					? { __proto__: null, ...desc, value: selfMember(prop, desc.value), configurable: true }
					: { __proto__: null, ...desc, configurable: true };
			}
			return undefined;
		},
		// A change to `self` itself follows the rule a top-level `self.X = …` does and lands on the running
		// instance's api, never on the object behind `self`, which every module of every instance shares (#625).
		deleteProperty(_, prop) {
			const ctx = current(null);
			if (!ctx) {
				throw new SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
			}
			return Reflect.deleteProperty(selfChangeTarget(ctx, prop), prop);
		},
		defineProperty(_, prop, descriptor) {
			const ctx = current(null);
			if (!ctx) {
				throw new SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
			}
			const target = selfChangeTarget(ctx, prop);
			// A member `self` reported fixed would have to be fixed on that shared object: such a definition is refused.
			if (descriptor.configurable === false) return false;
			if ("value" in descriptor) descriptor = { __proto__: null, ...descriptor, value: unwrapSelfView(descriptor.value) };
			return Reflect.defineProperty(target, prop, descriptor);
		},
		// `self` keeps its prototype and stays extensible: it is shared, so neither change could be confined to
		// one instance. The change is refused, after the rule for `self` as a whole has been applied.
		setPrototypeOf() {
			const ctx = current(null);
			if (ctx) selfChangeTarget(ctx, null);
			return false;
		},
		preventExtensions() {
			const ctx = current(null);
			if (ctx) selfChangeTarget(ctx, null);
			return false;
		},
		set(_, prop, value) {
			// A view `self` handed out stands for its node: the node is what is stored (#625).
			value = unwrapSelfView(value);
			// Route through `apiManager.setOwnedProperty` so the assignment is
			// validated against the caller's owned apiPath. Falls back to a
			// direct `ctx.self[prop] = value` (Stage 1 behavior) if the slothlet
			// reference isn't available, so the silent-loss bug stays closed
			// even in unusual lifecycle states.
			const ctx = current(null);
			if (!ctx) {
				throw new SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
			}
			// Symbol-keyed writes (`self[sym] = …`) are never apiPaths — apiPaths
			// are dotted strings and ownership is path-based. Routing a symbol
			// through `setOwnedProperty(String(prop), …)` would stringify it to
			// "Symbol(…)" and set THAT string key instead of the symbol-keyed
			// property the assignment targeted. Write straight to `ctx.self` (a
			// full-isolation run's own api, or `boundApi`) so ordinary
			// JS semantics hold. A symbol is no api path of its own: the write is
			// held to the root of the tree, as a change to `self` as a whole is (#625).
			if (typeof prop === "symbol") {
				selfChangeTarget(ctx, prop);
				ctx.self[prop] = value;
				return true;
			}
			// A module never replaces the framework's namespace or root functions, isolated scope or not (#625).
			if (ctx.slothlet) assertFrameworkRootChange(ctx.slothlet, prop);
			// In a full-isolation run (`run()` / `scope()` with `isolation: "full"`, the default) `ctx.self` is the run's
			// own api (see the run layer): the write goes to it, which makes it through `apiManager.setOwnedProperty`
			// with every check the write below meets, and keeps it in the run.
			if (ctx.slothlet?.boundApi && ctx.self !== ctx.slothlet.boundApi) {
				ctx.self[prop] = value;
				return true;
			}
			const apiManager = ctx.slothlet?.handlers?.apiManager;
			if (apiManager && typeof apiManager.setOwnedProperty === "function") {
				// `currentWrapper` is the module currently executing (the one
				// doing `self.X = …`); `callerWrapper` is who *called* it.
				// Ownership is anchored to the currently executing module.
				// Code a caller supplied to another module's call writes as the supplier and every call of its ceiling,
				// and each of them has to own the path (#597).
				apiManager.setOwnedProperty(String(prop), value, trustedRootOwn.writersOf(ctx));
			} else {
				/* v8 ignore next */
				ctx.self[prop] = value;
			}
			return true;
		}
	};

	/**
	 * Use the api root `self` stands for now, as `get` reads a member of it (#803): in the running call's context, or,
	 * for code a module handed out run while no call runs, as its definer.
	 * @param {function(object): *} use - What is done with it.
	 * @returns {*} What `use` returned.
	 * @throws {SlothletError} CONTEXT_NOT_ACTIVE_SELF outside any context, with no definer to run as.
	 */
	const selfUse = (use) => {
		const resolved = {};
		const ctx = current(resolved);
		if (!ctx) {
			const read = selfReadAsDefiner(objectSelf, "", loadingInstance(), null, use);
			if (read) return read.value;
			refuseUnknown("");
			throw new SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
		}
		if (hostFlow(ctx, resolved)) {
			const read = selfReadAsDefiner(objectSelf, "", null, ctx.parentInstanceID, use);
			if (read) return read.value;
		}
		return use(ctx.self);
	};

	// `self` for an api whose root is an object: an object target, as the api root's own is.
	const objectSelf = new NativeProxy(
		{},
		{
			...selfTraps,
			// The prototype the running call's api root reports, as `api` reports it to the host (#914); with no call
			// running, the target's own.
			getPrototypeOf(target) {
				const ctx = current(null);
				return ctx ? Reflect.getPrototypeOf(ctx.self) : Reflect.getPrototypeOf(target);
			}
		}
	);

	// The target of the callable `self`: a bound function, as the api root's own target is when its root is a function,
	// so it is callable and constructible and has no `prototype` of its own to report.
	const callableTarget = FunctionMethods.bind(function () {});

	// `self` for an api whose root is a function (#803): a call or construction of it is one of the api root, held to the
	// root's call rule as `self.call()` is, and it reports the root's prototype.
	const callableSelf = new NativeProxy(callableTarget, {
		...selfTraps,
		apply(_, thisArg, args) {
			return selfUse((root) => Reflect.apply(root, thisArg, args));
		},
		construct(_, args) {
			return selfUse((root) => Reflect.construct(root, args));
		},
		getPrototypeOf() {
			const ctx = current(null);
			return ctx ? Reflect.getPrototypeOf(ctx.self) : Reflect.getPrototypeOf(callableTarget);
		}
	});

	// The user-provided context: what `slothlet.context.run()` / `scope()` set, read in the running call's store.
	const context = new NativeProxy(
		{},
		{
			get(_, prop) {
				const ctx = store();
				if (!ctx || !ctx.context) {
					// Code a module handed out, run while no call runs, reads the context of its definer's instance (#726).
					return contextReadAsDefiner(context, prop);
				}
				// Owner-locked keys (scope({ protect, owners })) read back as a recursive protected view so
				// nested writes stay enforced (#207); every other key returns the raw value unchanged. The
				// resolver lets the view identify the WRITER from the store active at write time — each
				// module call runs in its own derived store, so the wrap-time store's identity is stale.
				// What a module stored there reaches another module as values one module hands another do.
				return contextRead(ctx, trustedRootOwn.readProtectedContextValue(ctx, prop, store));
			},
			set(_, prop, value) {
				const ctx = store();
				if (!ctx || !ctx.context) {
					throw new SlothletError("CONTEXT_NOT_ACTIVE_WRITE", {});
				}
				// Owner-locked context keys (opt-in via scope({ protect, owners })): reject a write the
				// current caller doesn't own before mutating the context.
				trustedRootOwn.enforceContextKeyWrite(ctx, prop);
				contextWritten(ctx, value);
				ctx.context[prop] = value;
				return true;
			},
			ownKeys() {
				const ctx = store();
				if (!ctx || !ctx.context) return [];
				return Reflect.ownKeys(ctx.context);
			},
			has(_, prop) {
				const ctx = store();
				if (!ctx || !ctx.context) return false;
				return prop in ctx.context;
			},
			getOwnPropertyDescriptor(_, prop) {
				const ctx = store();
				if (!ctx || !ctx.context) return undefined;
				const descriptor = Reflect.getOwnPropertyDescriptor(ctx.context, prop);
				if (!descriptor || !("value" in descriptor)) return descriptor;
				return { __proto__: null, ...descriptor, value: contextRead(ctx, descriptor.value) };
			}
		}
	);

	// A read of `self` made while no call runs, through any runtime's `self`, reads through the `self` of the runtime the
	// definer's instance runs (#726); a read of `context` likewise.
	MapMethods.set(RUNTIME_SELVES, contextManager, objectSelf);
	MapMethods.set(RUNTIME_CALLABLE_SELVES, contextManager, callableSelf);
	MapMethods.set(RUNTIME_CONTEXTS, contextManager, context);
	return { objectSelf, callableSelf, context };
}

/** Whether {@link RuntimeBridgeLayer} has built its class: it builds one, for the wrapper's chain. @type {boolean} */
let built = false;

/**
 * Build this layer of the wrapper class over `Base`, once (see `unified-wrapper.mjs`).
 * @param {Function} Base - The class below this layer.
 * @returns {Function} The layer's class.
 * @internal
 */
export function RuntimeBridgeLayer(Base) {
	if (built) throw ownBindingsRefusal("lib/handlers/unified-wrapper/runtime-bridge", import.meta.url);
	built = true;
	return Base.layer(
		class RuntimeBridge extends Base {
			static {
				Base.define("bridge", { runtimeTraps });
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					trustedRootOwn = methods.uw.trustedRootOwn;
					contextRead = methods.rules.contextRead;
					RUNTIME_CONTEXTS = methods.rules.RUNTIME_CONTEXTS;
					selfChangeTarget = methods.self.changeTarget;
					selfFrameworkView = methods.self.frameworkView;
					selfReadAsDefiner = methods.self.readAsDefiner;
					selfView = methods.self.view;
					unwrapSelfView = methods.views.unwrapSelfView;
					RUNTIME_CALLABLE_SELVES = methods.views.RUNTIME_CALLABLE_SELVES;
					RUNTIME_SELVES = methods.views.RUNTIME_SELVES;
					SELF_FRAMEWORK_ROOTS = methods.views.SELF_FRAMEWORK_ROOTS;
					frameDefiner = methods.uw.frameDefiner;
					makerInstanceID = methods.nodes.makerInstanceID;
					readOnBehalf = methods.read.onBehalf;
					CROSSINGS = methods.membrane.CROSSINGS;
					isSlothletValue = methods.is.slothletValue;
					CONTEXT_HOST_VALUES = methods.rules.CONTEXT_HOST_VALUES;
					CONTEXT_WRITERS = methods.rules.CONTEXT_WRITERS;
					isRefusal = methods.is.refusal;
					SNAPSHOT_OMIT = methods.values.SNAPSHOT_OMIT;
				});
			}

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/runtime-bridge", import.meta.url);
				super(slothlet);
			}
		}
	);
}
