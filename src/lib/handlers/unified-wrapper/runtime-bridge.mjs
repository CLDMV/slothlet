/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/runtime-bridge.mjs
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
 * @fileoverview Runtime bridge layer of the wrapper: the `self` and `context` a runtime exports.
 *
 * Both runtimes (async and live) export a `self` (an object form and a callable one, #803) and a `context`, Proxies
 * whose traps read the running call's store and hand what they read through the wrapper's views. The traps are the
 * same for both; what differs is how a runtime finds the store a trap reads and who it reads as, which the runtime hands
 * in as a {@link RuntimeAccess}. A runtime takes its finished Proxies from {@link runtime_runtimeTraps}.
 *
 * Upward services this layer uses: none (it sits above the views, rules and membrane it reads through).
 * @module @cldmv/slothlet/handlers/unified-wrapper/runtime-bridge
 * @internal
 */
import { SlothletError } from "#errors";
import { FunctionMethods, MapMethods, NativeProxy, Reflect, setFrom, SetMethods, String } from "#helpers/intrinsics";
import { ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.linkLayer`), before any wrapper exists.
 */
let trustedRootOwn,
	runtime_assertFrameworkRootChange,
	runtime_contextRead,
	runtime_contextReadAsDefiner,
	runtime_contextWritten,
	RUNTIME_CONTEXTS,
	runtime_selfChangeTarget,
	runtime_selfFrameworkView,
	runtime_selfReadAsDefiner,
	runtime_selfToJSON,
	runtime_selfView,
	runtime_unwrapSelfView,
	RUNTIME_CALLABLE_SELVES,
	RUNTIME_SELVES;
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
 * Build a runtime's `self` (both forms) and `context`, and register them for reads made while no call runs (#726).
 * @param {object} contextManager - The runtime's context manager.
 * @param {RuntimeAccess} runtime - How the runtime reads its stores.
 * @returns {{objectSelf: object, callableSelf: Function, context: object}} The Proxies.
 * @internal
 *
 * @example
 * const { objectSelf, callableSelf, context } = runtime_runtimeTraps(asyncRuntime, access);
 */
function runtime_runtimeTraps(contextManager, runtime) {
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
		if (SetMethods.has(FRAMEWORK_SELF_ROOTS, prop)) return runtime_selfFrameworkView(value);
		return runtime_selfView(value, undefined, null, resolved === null ? null : access(resolved));
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
				const read = runtime_selfReadAsDefiner(objectSelf, prop, loadingInstance());
				if (read) return read.value;
				refuseUnknown(prop);
				throw new SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
			}
			// A flow the host opened (`run()` / `scope()`) names no module. A module's code running in it (a function it
			// handed out, run by the host there) still reads `self` as its definer; the host's own code reads it as the host.
			if (hostFlow(ctx, resolved)) {
				const read = runtime_selfReadAsDefiner(objectSelf, prop, null, ctx.parentInstanceID);
				if (read) return read.value;
			}
			const value = ctx.self[prop];
			// An object root with no `toJSON` of its own serializes as `api` does for the host, less what the reader is
			// refused, which is left out rather than thrown for (#803).
			if (prop === "toJSON" && value === undefined && typeof ctx.self !== "function") return runtime_selfToJSON;
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
			return Reflect.deleteProperty(runtime_selfChangeTarget(ctx, prop), prop);
		},
		defineProperty(_, prop, descriptor) {
			const ctx = current(null);
			if (!ctx) {
				throw new SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
			}
			const target = runtime_selfChangeTarget(ctx, prop);
			// A member `self` reported fixed would have to be fixed on that shared object: such a definition is refused.
			if (descriptor.configurable === false) return false;
			if ("value" in descriptor) descriptor = { __proto__: null, ...descriptor, value: runtime_unwrapSelfView(descriptor.value) };
			return Reflect.defineProperty(target, prop, descriptor);
		},
		// `self` keeps its prototype and stays extensible: it is shared, so neither change could be confined to
		// one instance. The change is refused, after the rule for `self` as a whole has been applied.
		setPrototypeOf() {
			const ctx = current(null);
			if (ctx) runtime_selfChangeTarget(ctx, null);
			return false;
		},
		preventExtensions() {
			const ctx = current(null);
			if (ctx) runtime_selfChangeTarget(ctx, null);
			return false;
		},
		set(_, prop, value) {
			// A view `self` handed out stands for its node: the node is what is stored (#625).
			value = runtime_unwrapSelfView(value);
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
				runtime_selfChangeTarget(ctx, prop);
				ctx.self[prop] = value;
				return true;
			}
			// A module never replaces the framework's namespace or root functions, isolated scope or not (#625).
			if (ctx.slothlet) runtime_assertFrameworkRootChange(ctx.slothlet, prop);
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
			const read = runtime_selfReadAsDefiner(objectSelf, "", loadingInstance(), null, use);
			if (read) return read.value;
			refuseUnknown("");
			throw new SlothletError("CONTEXT_NOT_ACTIVE_SELF", {});
		}
		if (hostFlow(ctx, resolved)) {
			const read = runtime_selfReadAsDefiner(objectSelf, "", null, ctx.parentInstanceID, use);
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
					return runtime_contextReadAsDefiner(context, prop);
				}
				// Owner-locked keys (scope({ protect, owners })) read back as a recursive protected view so
				// nested writes stay enforced (#207); every other key returns the raw value unchanged. The
				// resolver lets the view identify the WRITER from the store active at write time — each
				// module call runs in its own derived store, so the wrap-time store's identity is stale.
				// What a module stored there reaches another module as values one module hands another do.
				return runtime_contextRead(ctx, trustedRootOwn.readProtectedContextValue(ctx, prop, store));
			},
			set(_, prop, value) {
				const ctx = store();
				if (!ctx || !ctx.context) {
					throw new SlothletError("CONTEXT_NOT_ACTIVE_WRITE", {});
				}
				// Owner-locked context keys (opt-in via scope({ protect, owners })): reject a write the
				// current caller doesn't own before mutating the context.
				trustedRootOwn.enforceContextKeyWrite(ctx, prop);
				runtime_contextWritten(ctx, value);
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
				return { __proto__: null, ...descriptor, value: runtime_contextRead(ctx, descriptor.value) };
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
				Base.define("bridge", { runtime_runtimeTraps });
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					trustedRootOwn = methods.uw.trustedRootOwn;
					runtime_assertFrameworkRootChange = methods.rules.runtime_assertFrameworkRootChange;
					runtime_contextRead = methods.rules.runtime_contextRead;
					runtime_contextReadAsDefiner = methods.rules.runtime_contextReadAsDefiner;
					runtime_contextWritten = methods.rules.runtime_contextWritten;
					RUNTIME_CONTEXTS = methods.rules.RUNTIME_CONTEXTS;
					runtime_selfChangeTarget = methods.views.runtime_selfChangeTarget;
					runtime_selfFrameworkView = methods.views.runtime_selfFrameworkView;
					runtime_selfReadAsDefiner = methods.views.runtime_selfReadAsDefiner;
					runtime_selfToJSON = methods.views.runtime_selfToJSON;
					runtime_selfView = methods.views.runtime_selfView;
					runtime_unwrapSelfView = methods.views.runtime_unwrapSelfView;
					RUNTIME_CALLABLE_SELVES = methods.views.RUNTIME_CALLABLE_SELVES;
					RUNTIME_SELVES = methods.views.RUNTIME_SELVES;
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
