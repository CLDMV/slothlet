/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/async-resource-context.mjs
 *	@Date: 2026-11-11T23:21:05-08:00 (1794468065)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:59:45-08:00 (1794477585)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Carries the creating module's caller identity into what `AsyncLocalStorage.snapshot()`,
 * `AsyncLocalStorage.bind()` and an `AsyncResource` run later, in the live runtime.
 * @module @cldmv/slothlet/helpers/async-resource-context
 * @internal
 *
 * @description
 * These three capture Node's async context when they are made and restore it when they run code. Under the async
 * runtime that context holds slothlet's store, so code they run is the module that made them. The live runtime keeps
 * identity outside Node's async context, so there the code they run was held only to the call that happened to run
 * them: a snapshot or resource a file made while it loaded did not carry the file's module.
 *
 * The patches capture the caller when the snapshot, binding or resource is made and re-enter it when it runs code,
 * the way the scheduler patches do for a timer. They are transparent otherwise: Node's own function still restores
 * the async context, arguments and results pass through, and with no pinning strategy registered (the async
 * runtime) or no module caller to pin (the host) nothing is wrapped.
 *
 * `AsyncResource` is replaced by a subclass of itself on the `node:async_hooks` module, since only its constructor
 * knows when a resource is made; `instanceof` against it answers for every resource, whichever class made it.
 * Installed once per process through the shared layer registry, removed when the last instance that asked for it
 * shuts down. A browser has neither class, and nothing is patched there.
 */

import { pinToCurrentCaller } from "@cldmv/slothlet/helpers/caller-pinning";
import { openLayer, markLayer, closeLayer, holdsValue } from "@cldmv/slothlet/helpers/boundary-patch-layers";
import { Reflect, Functions, WeakMap, Symbol } from "@cldmv/slothlet/helpers/intrinsics";

/**
 * What is patched: the host object, the key, the wrapper installed and its layer.
 * @type {Array<{host: object, name: string, layer: {active: boolean, below: *}, wrapper: Function}>}
 * @private
 */
const patched = [];

/**
 * Whether the patches are installed.
 * @type {boolean}
 * @private
 */
let isPatchingEnabled = false;

/**
 * Each patched resource's entry into the caller that made it; none for one the host made.
 * @type {WeakMap<object, Function>}
 * @private
 */
const RESOURCE_PINS = new WeakMap();

/**
 * Whether a snapshot is being taken: Node builds one from `AsyncLocalStorage.bind()`, and the snapshot's own pin is
 * the one to keep.
 * @type {boolean}
 * @private
 */
let isTakingSnapshot = false;

/**
 * Calls a function with a receiver and arguments. Pinned to a caller, it runs the function as that caller.
 * @param {Function} fn - The function.
 * @param {*} thisArg - Its receiver.
 * @param {Array<*>} args - Its arguments.
 * @returns {*} What it returns.
 * @private
 */
function runtime_runGiven(fn, thisArg, args) {
	return Reflect.apply(fn, thisArg, args);
}

/**
 * An entry into the caller active right now: a function that runs what it is given as that caller. Null when there
 * is no caller to pin (the host, or a runtime that registered no pinning strategy).
 * @returns {Function|null} The entry.
 * @private
 */
function runtime_pinNow() {
	// A fresh function each time: a pin belongs to the callback it was made for.
	const given = (fn, thisArg, args) => runtime_runGiven(fn, thisArg, args);
	const pinned = pinToCurrentCaller(given);
	return pinned === given ? null : pinned;
}

/**
 * A Node builtin, when the platform has it.
 * @param {string} id - The builtin's id.
 * @returns {object|null} Its exports, or null.
 * @private
 */
function runtime_builtin(id) {
	try {
		return globalThis.process?.getBuiltinModule?.(id) ?? null;
	} catch {
		// A platform that refuses the lookup has no such builtin to patch.
		/* v8 ignore next */
		return null;
	}
}

/**
 * Install a wrapper over `host[name]` and remember it for removal.
 * @param {object} host - The object carrying the function.
 * @param {string} name - Its key.
 * @param {function({active: boolean, below: Function}): Function} make - Builds the wrapper for a layer.
 * @returns {boolean} Whether it was installed.
 * @private
 */
function runtime_install(host, name, make) {
	const installed = host?.[name];
	if (typeof installed !== "function") return false;
	const layer = openLayer(installed);
	const wrapper = make(layer);
	markLayer(wrapper, layer);
	try {
		host[name] = wrapper;
	} catch {
		// A host that refuses the write keeps its own function.
		/* v8 ignore next 2 */
		layer.active = false;
		return false;
	}
	// A read-only property ignores the write without throwing outside strict mode's reach of a frozen builtin.
	/* v8 ignore next 4 */
	if (!holdsValue(host, name, wrapper)) {
		layer.active = false;
		return false;
	}
	patched.push({ host, name, layer, wrapper });
	return true;
}

/**
 * Carry the creating module's identity into what async snapshots, bindings and resources run later.
 *
 * Called when an instance on the live runtime is created; later calls are ignored. Does nothing where
 * `node:async_hooks` is absent (a browser).
 *
 * @returns {void}
 * @public
 * @example
 * enableAsyncResourcePatching();
 */
export function enableAsyncResourcePatching() {
	if (isPatchingEnabled) return;
	isPatchingEnabled = true;
	const hooks = runtime_builtin("node:async_hooks");
	if (!hooks) return;

	const Storage = hooks.AsyncLocalStorage;
	// `AsyncLocalStorage.snapshot()`: the returned function runs what it is given in the captured async context, and
	// as the caller that took the snapshot.
	runtime_install(Storage, "snapshot", (layer) => {
		const original = layer.below;
		return function snapshot() {
			let run;
			isTakingSnapshot = true;
			try {
				run = Reflect.apply(original, this, []);
			} finally {
				isTakingSnapshot = false;
			}
			const pinned = layer.active ? runtime_pinNow() : null;
			if (!pinned) return run;
			return function runInAsyncScope(fn, ...args) {
				return typeof fn === "function" ? run(pinned, fn, this, args) : run(fn, ...args);
			};
		};
	});
	// `AsyncLocalStorage.bind(fn)`: the bound function runs in the captured async context, and as the caller that
	// bound it.
	runtime_install(Storage, "bind", (layer) => {
		const original = layer.below;
		return function bind(fn, ...rest) {
			return Reflect.apply(original, this, [layer.active && !isTakingSnapshot ? pinToCurrentCaller(fn) : fn, ...rest]);
		};
	});

	const Original = hooks.AsyncResource;
	runtime_install(hooks, "AsyncResource", (layer) => {
		const Below = layer.below;
		/**
		 * `AsyncResource`, remembering the caller that made each resource.
		 */
		class AsyncResource extends Below {
			/**
			 * @param {...*} args - As for Node's `AsyncResource`.
			 */
			constructor(...args) {
				super(...args);
				const pinned = layer.active ? runtime_pinNow() : null;
				if (pinned) RESOURCE_PINS.set(this, pinned);
			}

			/**
			 * Run a function in the resource's async context, as the caller that made the resource.
			 * @param {Function} fn - The function.
			 * @param {*} [thisArg] - Its receiver.
			 * @param {...*} args - Its arguments.
			 * @returns {*} What it returns.
			 */
			runInAsyncScope(fn, thisArg, ...args) {
				const pinned = layer.active ? RESOURCE_PINS.get(this) : undefined;
				if (!pinned || typeof fn !== "function") return super.runInAsyncScope(fn, thisArg, ...args);
				return super.runInAsyncScope(pinned, undefined, fn, thisArg, args);
			}

			/**
			 * Bind a function to a resource made now: it runs in the current async context, as the current caller.
			 * @param {Function} fn - The function.
			 * @param {string} [type] - The resource's type.
			 * @param {*} [thisArg] - The receiver to bind.
			 * @returns {Function} The bound function.
			 */
			static bind(fn, type, thisArg) {
				// Node's own static makes the resource from its internal class, which would skip the constructor above.
				return new this(type || fn?.name || "bound-anonymous-fn").bind(fn, thisArg);
			}

			/**
			 * A resource is one whichever of the two classes made it.
			 * @param {*} value - The value tested.
			 * @returns {boolean} Whether it is an `AsyncResource`.
			 */
			static [Symbol.hasInstance](value) {
				return Functions.prototype[Symbol.hasInstance].call(Below, value);
			}
		}
		return AsyncResource;
	});
	// ES modules read a builtin's exports through bindings Node refreshes on request.
	if (hooks.AsyncResource !== Original) runtime_builtin("node:module")?.syncBuiltinESMExports?.();
}

/**
 * Put back what {@link enableAsyncResourcePatching} replaced, where its wrapper is still the one in place. A wrapper
 * something else has since covered passes through from then on.
 * @returns {void}
 * @public
 * @example
 * disableAsyncResourcePatching();
 */
export function disableAsyncResourcePatching() {
	if (!isPatchingEnabled) return;
	let restored = false;
	for (const { host, name, layer, wrapper } of patched) {
		const below = closeLayer(layer);
		if (holdsValue(host, name, wrapper)) {
			host[name] = below;
			restored = true;
		}
	}
	patched.length = 0;
	isPatchingEnabled = false;
	if (restored) runtime_builtin("node:module")?.syncBuiltinESMExports?.();
}
