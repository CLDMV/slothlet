/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/function-source-context.mjs
 *	@Date: 2026-11-11T23:40:00-08:00 (1794469200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T23:40:00-08:00 (1794469200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Lets `Function.prototype.toString` answer the source of the function an api node stands for.
 * @module @cldmv/slothlet/helpers/function-source-context
 * @internal
 *
 * @description
 * An api node of a function is a Proxy, and the language answers `Function.prototype.toString.call(proxy)` with
 * `function () { [native code] }` whatever the Proxy fronts. `node.toString()` already answers the function's source,
 * since the node answers that read itself; code that applies the language's own `toString` to a value (a test for
 * native functions, a serializer, a framework reading parameter names) got the native-code text instead (#750).
 *
 * This patch wraps `Function.prototype.toString` the way the other boundary patches wrap theirs (see
 * {@link module:@cldmv/slothlet/helpers/boundary-patch-layers}). The wrapper asks slothlet whether its receiver is one
 * of slothlet's own stand-ins for a function. For one, it answers the source of the function behind it, read with the
 * language's `toString` as it was when slothlet loaded; the function itself is never handed out. For every other
 * receiver it calls what it wraps with exactly what it was given, so nothing changes for any other value, an error
 * for a receiver that is no function included. Asked about itself, it answers as the function it wraps does.
 *
 * Slothlet's own reads of a function's text never go through the wrapper: they use the `toString` taken when slothlet
 * loaded (see {@link module:@cldmv/slothlet/helpers/intrinsics}), so what the handlers decide from a function's text
 * (whether it is one of the engine's own) is decided as before. The handlers recognise this copy's wrapper by identity
 * ({@link isFunctionSourcePatch}), never by its marker, which any code could put on a function of its own.
 *
 * The wrapper carries the function it wraps under a `Symbol.for` key, so a patch is recognisable from any copy of
 * slothlet in the realm, and this copy installs its wrapper once however many instances ask.
 */
import { openLayer, markLayer, closeLayer, holdsValue } from "@cldmv/slothlet/helpers/boundary-patch-layers";
import { Reflect, Functions, functionToString, WeakSet, Symbols } from "@cldmv/slothlet/helpers/intrinsics";

/**
 * The key the wrapper holds the function it wraps under: the watermark of this patch.
 * @type {symbol}
 * @private
 */
const ORIGINAL_TO_STRING = Symbols.for("slothlet.functionSource.original");

const { apply, getOwnPropertyDescriptor, defineProperty } = Reflect;
const FunctionPrototype = Functions.prototype;

/**
 * Tells the function one of slothlet's stand-ins stands for, set by the handlers that make them.
 * @type {function(*): (Function|undefined)}
 * @private
 */
let standsFor = () => undefined;

/**
 * Set how the function behind one of slothlet's stand-ins is told.
 * @param {function(*): (Function|undefined)} behind - Answers the function a value stands for, or `undefined` for a
 *   value that is no stand-in of slothlet's for a function.
 * @returns {void}
 * @internal
 * @example
 * setFunctionSourceReader((value) => (isNode(value) ? functionBehind(value) : undefined));
 */
export function setFunctionSourceReader(behind) {
	standsFor = behind;
}

/**
 * This copy's installed wrapper, or null while the patch is off.
 * @type {{layer: object, wrapper: Function}|null}
 * @private
 */
let installed = null;

/**
 * Every wrapper this copy has installed, so one left in place under another copy's is still known as this copy's.
 * @type {WeakSet<Function>}
 * @private
 */
const OWN_WRAPPERS = new WeakSet();

const runtime_descriptorValue = (descriptor) => descriptor?.value;

/**
 * Wrap `Function.prototype.toString` so it answers the source of the function an api node stands for. Idempotent.
 * @returns {void}
 * @internal
 * @example
 * enableFunctionSourcePatching();
 */
export function enableFunctionSourcePatching() {
	if (installed) return;
	let descriptor;
	try {
		descriptor = getOwnPropertyDescriptor(FunctionPrototype, "toString");
	} catch {
		return;
	}
	// A host that froze or replaced the function with something exotic keeps it as it is.
	if (!descriptor || typeof descriptor.value !== "function" || (!descriptor.configurable && !descriptor.writable)) return;
	const layer = openLayer(descriptor, runtime_descriptorValue);
	const below = layer.below.value;
	const wrapper = {
		toString() {
			if (layer.active) {
				// Asked about itself, the wrapper answers as the function it wraps does.
				if (this === wrapper) return apply(below, below, []);
				let behind;
				try {
					behind = standsFor(this);
				} catch {
					// Whatever telling the receiver threw is not the caller's to see: it is answered as before.
					behind = undefined;
				}
				// The language's own `toString`, as it was when slothlet loaded: the function is handed to nothing else.
				if (typeof behind === "function") return apply(functionToString, behind, []);
			}
			return apply(below, this, arguments);
		}
	}.toString;
	try {
		defineProperty(wrapper, ORIGINAL_TO_STRING, { value: below });
		if (!defineProperty(FunctionPrototype, "toString", { ...descriptor, value: wrapper })) return;
	} catch {
		return;
	}
	markLayer(wrapper, layer);
	OWN_WRAPPERS.add(wrapper);
	installed = { layer, wrapper };
}

/**
 * Remove this copy's wrapper, putting back what it wrapped where it is still the one installed. Idempotent.
 * @returns {void}
 * @internal
 * @example
 * disableFunctionSourcePatching();
 */
export function disableFunctionSourcePatching() {
	if (!installed) return;
	const { layer, wrapper } = installed;
	const restore = closeLayer(layer, runtime_descriptorValue);
	try {
		if (holdsValue(FunctionPrototype, "toString", wrapper)) defineProperty(FunctionPrototype, "toString", restore);
	} catch {
		// A host that no longer lets the member be defined keeps the wrapper, which now passes straight through.
	}
	installed = null;
}

/**
 * Whether a function is a `toString` wrapper this copy of slothlet installed: told by identity, so a function that
 * only carries the patch's marker is not one. It runs none of a module's code, and the handlers treat it as the
 * engine's own `toString`, which it stands in for.
 * @param {*} fn - A function.
 * @returns {boolean} True for this copy's wrapper.
 * @internal
 * @example
 * isFunctionSourcePatch(Function.prototype.toString); // true while an instance is up
 */
export function isFunctionSourcePatch(fn) {
	return typeof fn === "function" && OWN_WRAPPERS.has(fn);
}

/**
 * Whether a function is a `toString` wrapper of any copy of slothlet's, by its marker. For diagnostics and tests only:
 * the marker is a registered symbol any code can put on a function, so nothing is decided from it.
 * @param {*} fn - A function.
 * @returns {boolean} True for one carrying the marker.
 * @internal
 * @example
 * isFunctionSourcePatched(Function.prototype.toString); // true while an instance with the patch is up
 */
export function isFunctionSourcePatched(fn) {
	return typeof fn === "function" && typeof fn[ORIGINAL_TO_STRING] === "function";
}
