/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/async-resource-context.mjs
 *	@Date: 2026-11-11T23:21:05-08:00 (1794468065)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T21:48:00-08:00 (1794635280)
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
import { openLayer, closeLayer, holdsValue, markLayer } from "@cldmv/slothlet/helpers/boundary-patch-layers";
import { Reflect, Functions, WeakMap, Symbol, Processes } from "@cldmv/slothlet/helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "@cldmv/slothlet/helpers/instance-imports";

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
		return Processes.getBuiltinModule?.(id) ?? null;
	} catch {
		// A platform that refuses the lookup has no such builtin to patch.
		/* v8 ignore next */
		return null;
	}
}

/**
 * `node:async_hooks`, as slothlet loaded: the module whose `AsyncResource` and `AsyncLocalStorage` the patch layers
 * onto. Those two are read when the patch is turned on, as they are then (the patch covers what is in place), and the
 * module object itself is taken now. Null where the platform has no such builtin.
 * @type {object|null}
 * @private
 */
const ASYNC_HOOKS = runtime_builtin("node:async_hooks");

/**
 * `module.syncBuiltinESMExports`, taken as slothlet loads, so code that replaces it later does not run inside the patch.
 * Undefined where the platform has no such builtin.
 * @type {Function|undefined}
 * @private
 */
const SYNC_BUILTIN_ESM_EXPORTS = runtime_builtin("node:module")?.syncBuiltinESMExports;

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
function enableAsyncResourcePatching() {
	if (isPatchingEnabled) return;
	isPatchingEnabled = true;
	const hooks = ASYNC_HOOKS;
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
	if (hooks.AsyncResource !== Original) SYNC_BUILTIN_ESM_EXPORTS?.();
}

/**
 * Put back what {@link enableAsyncResourcePatching} replaced, where its wrapper is still the one in place. A wrapper
 * something else has since covered passes through from then on.
 * @returns {void}
 * @public
 * @example
 * disableAsyncResourcePatching();
 */
function disableAsyncResourcePatching() {
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
	if (restored) SYNC_BUILTIN_ESM_EXPORTS?.();
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (!mayTakeInternals(consumer, ["slothlet"])) throw ownBindingsRefusal("lib/helpers/async-resource-context", import.meta.url);
	return { disableAsyncResourcePatching, enableAsyncResourcePatching };
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
/** @type {typeof enableAsyncResourcePatching} */
const guarded_enableAsyncResourcePatching = guardInternal(enableAsyncResourcePatching, "enableAsyncResourcePatching", import.meta.url);
/** @type {typeof disableAsyncResourcePatching} */
const guarded_disableAsyncResourcePatching = guardInternal(disableAsyncResourcePatching, "disableAsyncResourcePatching", import.meta.url);
export {
	guarded_enableAsyncResourcePatching as enableAsyncResourcePatching,
	guarded_disableAsyncResourcePatching as disableAsyncResourcePatching
};
