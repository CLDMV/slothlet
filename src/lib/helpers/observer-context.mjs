/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/observer-context.mjs
 *	@Date: 2026-09-07 22:36:15 -07:00 (1788845775)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-07 22:36:15 -07:00 (1788845775)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Carries the constructing module's caller identity into observer callback arguments.
 * @module @cldmv/slothlet/helpers/observer-context
 * @internal
 *
 * @description
 * `MutationObserver`, `ResizeObserver`, and `IntersectionObserver` all take their callback as a
 * constructor argument rather than a registered listener or an assigned property — neither the
 * `addEventListener` patch nor the `on*` property patch applies, because there is no method call or
 * property assignment to intercept, only a constructor invocation. Left unpinned, the callback runs
 * with no active identity the first time the observer actually fires, the same
 * `RUNTIME_NO_ACTIVE_CONTEXT_SELF` failure the other boundary patches exist to prevent.
 *
 * The fix wraps each constructor so the callback argument is pinned before it reaches the native
 * constructor. The constructed instance itself is untouched — `observe()`, `disconnect()`, and every
 * other method run exactly as the native implementation provides them; only the callback is
 * substituted. `Reflect.construct` with the caller's own `new.target` keeps subclassing and
 * `instanceof` working the same as the unpatched constructor, and omitting `new` still throws the same
 * way a native class constructor does.
 *
 * This closes the boundary for cooperative code, not a sandbox — a module can still reach an
 * unpatched constructor through another realm. See `docs/PERMISSIONS.md` on what the live runtime does
 * and does not bound.
 */

import { pinToCurrentCaller } from "@cldmv/slothlet/helpers/caller-pinning";

/**
 * Observer constructors patched by name.
 * @type {string[]}
 * @private
 */
const PATCHED_CONSTRUCTORS = ["MutationObserver", "ResizeObserver", "IntersectionObserver"];

/**
 * Patched entry points, holding what {@link disableObserverPatching} needs to restore only the
 * global it actually replaced.
 * @type {Array<{name: string, original: Function, wrapper: Function}>}
 * @private
 */
const patched = [];

/**
 * Whether the observer constructors are currently patched.
 * @type {boolean}
 * @private
 */
let isPatchingEnabled = false;

/**
 * Copy an original constructor's own extras onto its wrapper.
 *
 * Mirrors {@link runtime_carryOwnExtras} in `scheduler-context.mjs` — carries every own symbol and
 * every own enumerable string key across, so a static property a consumer reaches through the
 * constructor they were given survives being wrapped. `length`, `name`, and `prototype` are
 * deliberately left alone; the wrapper's own `prototype` is what makes `instanceof` and subclassing
 * keep working.
 *
 * @param {Function} wrapper - Replacement constructor.
 * @param {Function} original - Constructor being replaced.
 * @returns {void}
 * @private
 */
function runtime_carryOwnExtras(wrapper, original) {
	for (const key of Object.getOwnPropertySymbols(original)) {
		const descriptor = Object.getOwnPropertyDescriptor(original, key);
		/* v8 ignore next -- a symbol from getOwnPropertySymbols always has a descriptor; belt-and-braces so an exotic host can't throw here. */
		if (!descriptor) continue;
		Object.defineProperty(wrapper, key, descriptor);
	}
	for (const key of Object.keys(original)) {
		wrapper[key] = original[key];
	}
}

/**
 * Replace one observer constructor with a wrapper that pins its callback argument.
 *
 * @param {string} name - Global constructor name (e.g. `"MutationObserver"`).
 * @returns {void}
 * @private
 */
function runtime_patchObserverConstructor(name) {
	const original = globalThis[name];
	// Absent in this host: all three are browser-only. Exercised by the vitest node compose.
	if (typeof original !== "function") return;

	const wrapper = function (callback, ...rest) {
		// Native observer constructors throw when called without `new` (they're spec'd as classes);
		// `Reflect.construct` below requires a `new.target` to build against, so surface the same failure
		// the platform would rather than a confusing internal error.
		if (!new.target) throw new TypeError(`Failed to construct '${name}': Please use the 'new' operator.`);

		// A non-function callback is the platform's problem to reject, and it should see the exact error
		// it would unpatched — hand it through untouched rather than pinning nothing.
		const pinned = typeof callback === "function" ? pinToCurrentCaller(callback) : callback;
		return Reflect.construct(original, [pinned, ...rest], new.target);
	};

	// A prototype shared verbatim with `original` would leave `instance.constructor` pointing at the
	// unpatched constructor instead of the wrapper now installed as `globalThis[name]`. Link to
	// `original.prototype` (so `instanceof` still walks the real hierarchy) but give the wrapper its own
	// prototype object with `constructor` pointing back at itself.
	wrapper.prototype = Object.create(original.prototype, {
		constructor: { value: wrapper, writable: true, configurable: true }
	});
	runtime_carryOwnExtras(wrapper, original);
	globalThis[name] = wrapper;
	patched.push({ name, original, wrapper });
}

/**
 * Pin observer callbacks to the module that constructs them.
 *
 * Called once globally when the first instance is created; later calls are ignored, matching how the
 * other boundary patches behave. Costs nothing when no runtime registered a pinning strategy — the
 * wrapper hands the callback straight through.
 *
 * @returns {void}
 * @public
 */
export function enableObserverPatching() {
	if (isPatchingEnabled) return;

	for (const name of PATCHED_CONSTRUCTORS) runtime_patchObserverConstructor(name);

	isPatchingEnabled = true;
}

/**
 * Restore the original observer constructors.
 *
 * Restores a constructor only when the wrapper installed here is still in place, so anything that
 * replaced it afterwards keeps ownership of its own restore.
 *
 * @returns {void}
 * @public
 */
export function disableObserverPatching() {
	if (!isPatchingEnabled) return;

	for (const { name, original, wrapper } of patched) {
		if (globalThis[name] === wrapper) globalThis[name] = original;
	}

	patched.length = 0;
	isPatchingEnabled = false;
}
