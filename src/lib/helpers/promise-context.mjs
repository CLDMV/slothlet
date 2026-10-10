/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/promise-context.mjs
 *	@Date: 2026-10-09T18:00:00-07:00 (1791594000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T18:00:00-07:00 (1791594000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Carries the registering module's caller identity across promise reactions.
 * @module @cldmv/slothlet/helpers/promise-context
 * @internal
 *
 * @description
 * `fetch(url).then((r) => self.cache.put(r))` is ordinary module code, and when nothing awaits the
 * chain the reaction runs after the call that registered it has returned. Under the async runtime
 * AsyncLocalStorage carries the store into the reaction. The live runtime keeps identity in a field
 * that unwinds with the call, so a reaction ran with whatever identity happened to be ambient — with
 * one other call suspended, that call's (#595).
 *
 * The patch pins both reaction callbacks of `Promise.prototype.then` to the caller active when the
 * reaction is registered, which is the only moment the information exists. `catch` and `finally`
 * register their reactions through `then` (the spec has them invoke the promise's own `then`), so they
 * are covered by the same patch. `await` is not affected: on a native promise it reacts through the
 * engine's internal operation, not through the `then` property, so an awaiting call keeps its own
 * identity the way it always has.
 *
 * Slothlet's own reactions that maintain identity bookkeeping (restoring the shared fields when a call
 * settles) must not run inside a pinned context, so they go through {@link nativeThen} instead.
 *
 * Like the other boundary patches this keeps cooperative code correctly attributed; it is not a
 * sandbox. See `docs/PERMISSIONS.md` on what the live runtime does and does not bound.
 */

import { pinToCurrentCaller } from "@cldmv/slothlet/helpers/caller-pinning";
import { openLayer, markLayer, closeLayer } from "@cldmv/slothlet/helpers/boundary-patch-layers";

/**
 * Where a patched `then` keeps the function it replaced. Registered globally so a second copy of
 * slothlet in the same realm still finds the engine's own `then` underneath the first copy's patch.
 * @type {symbol}
 * @private
 */
const ORIGINAL_THEN = Symbol.for("slothlet.promise.originalThen");

/**
 * Follow patched `then` functions down to the one they replaced.
 * @param {Function} then - A `then` implementation.
 * @returns {Function} The innermost, unpatched implementation.
 * @private
 */
function runtime_unwrapThen(then) {
	let current = then;
	while (typeof current?.[ORIGINAL_THEN] === "function") current = current[ORIGINAL_THEN];
	return current;
}

/**
 * The engine's `Promise.prototype.then`, captured at load.
 * @type {Function}
 * @private
 */
const NATIVE_THEN = runtime_unwrapThen(Promise.prototype.then);

/**
 * Register reactions on a promise without pinning them to the current caller.
 *
 * For framework reactions that restore or inspect identity state themselves. A pinned reaction runs
 * inside a re-entered context, which would put back the state it was trying to change.
 *
 * @param {Promise<*>} promise - A promise, or a Proxy around one.
 * @param {Function} [onFulfilled] - Fulfillment reaction.
 * @param {Function} [onRejected] - Rejection reaction.
 * @returns {Promise<*>} The derived promise, as `then` returns it.
 * @internal
 */
export function nativeThen(promise, onFulfilled, onRejected) {
	try {
		return NATIVE_THEN.call(promise, onFulfilled, onRejected);
	} catch (error) {
		// A Proxy around a promise (a wrapped return value) passes `instanceof Promise` but has no
		// promise internals, so the engine's `then` refuses it as a receiver. Adopt it into a genuine
		// promise — which reads its `then` through the proxy — and react to that one instead.
		if (!(error instanceof TypeError)) throw error;
		return NATIVE_THEN.call(Promise.resolve(promise), onFulfilled, onRejected);
	}
}

/**
 * The patch currently installed, with what {@link disablePromisePatching} needs to restore.
 * @type {{layer: {active: boolean, below: PropertyDescriptor}, wrapper: Function}|null}
 * @private
 */
let installed = null;

/**
 * Identify a `then` descriptor's layer by its function.
 * @param {PropertyDescriptor|undefined} descriptor - A `then` descriptor.
 * @returns {*} Its value.
 * @private
 */
const runtime_descriptorValue = (descriptor) => descriptor?.value;

/**
 * Pin promise reactions to the module that registers them.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching the other
 * boundary patches. Costs one check per registration when no runtime registered a pinning strategy —
 * the reactions are handed straight through.
 *
 * @returns {void}
 * @public
 */
export function enablePromisePatching() {
	if (installed) return;
	const descriptor = Object.getOwnPropertyDescriptor(Promise.prototype, "then");
	// A host that froze or replaced `then` with something exotic keeps it as it is: this patch is
	// best-effort like the others, not a requirement.
	if (!descriptor || typeof descriptor.value !== "function" || !descriptor.configurable) return;
	// Shared with any other copy of slothlet in the realm: wraps what is live, looking through a copy's
	// wrapper that has been disabled but could not be removed.
	const layer = openLayer(descriptor, runtime_descriptorValue);
	const original = layer.below.value;

	// Method syntax gives the wrapper the name `then` and no `prototype`, like the built-in.
	const wrapper = {
		then(onFulfilled, onRejected) {
			// Disabled while another copy's wrapper sat on top of this one: a plain pass-through.
			if (!layer.active) return original.call(this, onFulfilled, onRejected);
			return original.call(this, pinToCurrentCaller(onFulfilled), pinToCurrentCaller(onRejected));
		}
	}.then;
	Object.defineProperty(wrapper, ORIGINAL_THEN, { value: original });
	markLayer(wrapper, layer);

	Object.defineProperty(Promise.prototype, "then", { ...descriptor, value: wrapper });
	installed = { layer, wrapper };
}

/**
 * Restore the original `Promise.prototype.then`.
 *
 * Restores it only when the wrapper installed here is still in place, so anything that replaced it
 * afterwards keeps ownership of its own restore. Otherwise the wrapper is left where it is, passing
 * through. A restore puts back what is underneath every such wrapper, so copies of slothlet that
 * unpatch out of order still end with the engine's `then` installed.
 *
 * @returns {void}
 * @public
 */
export function disablePromisePatching() {
	if (!installed) return;
	const restore = closeLayer(installed.layer, runtime_descriptorValue);
	if (Promise.prototype.then === installed.wrapper) Object.defineProperty(Promise.prototype, "then", restore);
	installed = null;
}
