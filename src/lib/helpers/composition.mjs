/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/composition.mjs
 *	@Date: 2026-10-09T21:13:01-07:00 (1791605581)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T23:17:37-07:00 (1791613057)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The one place the build takes its own version of a module's value before changing it.
 * @module @cldmv/slothlet/helpers/composition
 * @internal
 * @package
 *
 * @description
 * Composing a module changes values: wrapper adoption deletes an object's members as it moves them onto
 * the wrapper, and a default gains the module's named exports. Neither may reach the module's own
 * export, which other code (and the module itself) still holds. {@link copyForComposition} decides, for
 * every such site, what the build changes instead:
 *
 * - a plain object is copied (its members, with their descriptors; all replaceable when named exports
 *   are added);
 * - a user Proxy gets a layer, since a copy would lose its traps and a write or delete would reach its
 *   target or be refused by it;
 * - an array is copied (a shallow `slice()`), and gets a layer when named exports are added
 *   (`addsMembers`), which an array copy could not carry;
 * - a class instance or built-in (a `Map`, a `Date`) keeps private fields and internal slots no copy
 *   reproduces; nothing adopts from it, so it is used as-is unless named exports are added, and then
 *   gets a layer;
 * - a plain function or a primitive is used as-is.
 *
 * A layer holds the members added to it and sends every other operation to the value, which stays the
 * receiver, so the value itself is never written to.
 */
import { util } from "@cldmv/slothlet/helpers/platform";

/**
 * The value each layer composes over, and its added members, so a layer can be laid again over the
 * same value with its members in another order.
 * @type {WeakMap<object, {underlying: object|Function, added: Map<PropertyKey, PropertyDescriptor>}>}
 * @private
 */
const LAYERS = new WeakMap();

/**
 * Recognizes an api node: a slothlet wrapper proxy, which a layer hands back as it is rather than
 * binding it as a method (a lazy one has a function target, and wrapping it would hide it as a node).
 * The wrapper module registers it through {@link setApiNodeCheck}; this module does not import it.
 * @type {function(unknown): boolean}
 * @private
 */
let isApiNode = () => false;

/**
 * Whether a value is a layer {@link copyForComposition} or {@link relayer} returned.
 * @param {unknown} value - The value.
 * @returns {boolean} True for a composition layer.
 * @package
 *
 * @example
 * isCompositionLayer(copyForComposition(new Map(), { addsMembers: true })); // true
 */
export function isCompositionLayer(value) {
	return LAYERS.has(value);
}

/**
 * Register how to recognize an api node (see {@link isApiNode}).
 * @param {function(unknown): boolean} check - Returns true for a slothlet wrapper proxy.
 * @returns {void}
 * @package
 *
 * @example
 * setApiNodeCheck((value) => proxyRegistry.has(value));
 */
export function setApiNodeCheck(check) {
	isApiNode = check;
}

/**
 * Whether a value is an object with a prototype of its own (a class instance or a built-in such as a
 * `Map`), which may carry private fields or internal slots that no property copy reproduces.
 * @param {unknown} value - The value.
 * @returns {boolean} True for a class instance or built-in object (not an array or a Proxy).
 * @private
 */
function hasOwnClass(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value) || util.types.isProxy(value)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto !== null && proto !== Object.prototype;
}

/**
 * The member a layer holds once `descriptor` is defined over `current` (what it held before, if
 * anything), in the form `Object.defineProperty` gives an object's property: an accessor descriptor
 * gives an accessor and a data descriptor a data member, each keeping what `descriptor` leaves out from
 * `current` when it is of the same kind. A new data member is writable and every member enumerable
 * unless `descriptor` says otherwise; members stay configurable, as the shell that does not hold them
 * requires.
 * @param {PropertyDescriptor|undefined} current - The member held before.
 * @param {PropertyDescriptor} descriptor - The descriptor being defined.
 * @returns {PropertyDescriptor} The member to hold.
 * @private
 *
 * @example
 * layerMember(undefined, { get: () => 1 }); // { get, set: undefined, enumerable: true, configurable: true }
 */
function layerMember(current, descriptor) {
	const enumerable = "enumerable" in descriptor ? descriptor.enumerable : (current?.enumerable ?? true);
	const currentIsAccessor = current !== undefined && !("value" in current);
	if ("get" in descriptor || "set" in descriptor) {
		const base = currentIsAccessor ? current : {};
		return {
			get: "get" in descriptor ? descriptor.get : base.get,
			set: "set" in descriptor ? descriptor.set : base.set,
			enumerable,
			configurable: true
		};
	}
	if (currentIsAccessor && !("value" in descriptor) && !("writable" in descriptor)) return { ...current, enumerable };
	const base = current && !currentIsAccessor ? current : { value: undefined, writable: true };
	return {
		value: "value" in descriptor ? descriptor.value : base.value,
		writable: "writable" in descriptor ? descriptor.writable : base.writable,
		enumerable,
		configurable: true
	};
}

/**
 * A layer over a value the build must not change (see {@link copyForComposition}). Members added to it
 * are held by the layer; every other operation goes to the value, which stays the receiver: a getter
 * runs on it, and a method it inherits (a class's, a built-in's) or owns (one its constructor assigned)
 * is called on it, so private fields and internal slots keep working. Nothing is ever written to the value. A callable value gets a callable
 * layer that calls and constructs through it.
 * @param {object|Function} underlying - The module's default.
 * @param {Array<[PropertyKey, PropertyDescriptor]>} [members=[]] - Members to start with, in order.
 * @returns {object|Function} The layer.
 * @private
 *
 * @example
 * const layer = layerOver(mod.default);
 * layer.extra = mod.extra; // held by the layer; mod.default is unchanged
 */
function layerOver(underlying, members = []) {
	const added = new Map(members.map(([key, descriptor]) => [key, layerMember(undefined, descriptor)]));
	const removed = new Set();
	const bound = new Map();
	const isArray = Array.isArray(underlying);
	const isCallable = typeof underlying === "function";
	const forwards = (key) => !added.has(key) && !removed.has(key);
	// A method runs on the value itself, which is the receiver its private fields and internal slots
	// belong to, whether the value inherits it (a class's, a built-in's) or owns it (one its constructor
	// assigned). Only the call's receiver changes: the method answers as itself otherwise, its own
	// members included. The bound form is cached so every read returns the same function.
	const read = (key) => {
		const value = Reflect.get(underlying, key);
		if (typeof value !== "function" || isApiNode(value)) return value;
		const cached = bound.get(key);
		if (cached?.original === value) return cached.fn;
		const fn = new Proxy(value, { apply: (method, _receiver, args) => Reflect.apply(method, underlying, args) });
		bound.set(key, { original: value, fn });
		return fn;
	};
	// The layer's own target is a fresh shell, not the value: the invariants a Proxy must keep are checked
	// against its target, and a frozen or non-extensible value would forbid every added key. The shell is
	// always extensible, so the layer may report the added keys beside the value's own. A callable shell is
	// a bound function: it can be called and constructed, and unlike a plain function it has no fixed
	// `prototype`, which an arrow function or method value does not have either.
	const shell = isCallable ? function () {}.bind() : isArray ? [] : {};
	const shellFixedKeys = Reflect.ownKeys(shell).filter((key) => !Reflect.getOwnPropertyDescriptor(shell, key).configurable);
	const layer = new Proxy(shell, {
		get(_shell, key, receiver) {
			if (!added.has(key)) return forwards(key) ? read(key) : undefined;
			const member = added.get(key);
			// An accessor member runs on the layer, as a getter on an object runs on that object.
			if (!("value" in member)) return member.get ? Reflect.apply(member.get, receiver, []) : undefined;
			return member.value;
		},
		has: (_shell, key) => added.has(key) || (forwards(key) && Reflect.has(underlying, key)),
		set(_shell, key, value, receiver) {
			const member = added.get(key);
			if (member && !("value" in member)) {
				if (!member.set) return false;
				Reflect.apply(member.set, receiver, [value]);
				return true;
			}
			if (member && !member.writable) return false;
			removed.delete(key);
			added.set(key, member ? { ...member, value } : { value, writable: true, enumerable: true, configurable: true });
			return true;
		},
		defineProperty(_shell, key, descriptor) {
			// The shell's fixed key (an array's `length`) takes only what the array's own would: a data
			// value, staying non-configurable and non-enumerable.
			if (
				shellFixedKeys.includes(key) &&
				(descriptor.configurable || descriptor.enumerable || "get" in descriptor || "set" in descriptor)
			) {
				return false;
			}
			removed.delete(key);
			added.set(key, layerMember(added.get(key), descriptor));
			return true;
		},
		deleteProperty(_shell, key) {
			// Hidden from the layer only; the value keeps the member.
			added.delete(key);
			if (Reflect.getOwnPropertyDescriptor(underlying, key)) removed.add(key);
			return true;
		},
		getOwnPropertyDescriptor(shell, key) {
			// A member held over the shell's fixed key is reported in that key's own form.
			if (added.has(key) && shellFixedKeys.includes(key)) {
				return { value: added.get(key).value, writable: true, enumerable: false, configurable: false };
			}
			if (added.has(key)) return { ...added.get(key) };
			if (!forwards(key)) return undefined;
			const descriptor = Reflect.getOwnPropertyDescriptor(underlying, key);
			if (!descriptor) return undefined;
			// The shell's one fixed key (an array's `length`) is non-configurable and writable; the layer
			// reports the value's member in that same form. Every other member is
			// reported configurable, as the shell, which does not hold it, requires.
			if (shellFixedKeys.includes(key)) return { ...descriptor, configurable: false, writable: true };
			return { ...descriptor, configurable: true };
		},
		ownKeys: () => [
			...new Set([...Reflect.ownKeys(underlying).filter((key) => !removed.has(key) && !added.has(key)), ...added.keys(), ...shellFixedKeys])
		],
		getPrototypeOf: () => Reflect.getPrototypeOf(underlying),
		...(isCallable && {
			apply: (_shell, thisArg, args) => Reflect.apply(underlying, thisArg, args),
			construct: (_shell, args, newTarget) => Reflect.construct(underlying, args, newTarget === layer ? underlying : newTarget)
		})
	});
	LAYERS.set(layer, { underlying, added });
	return layer;
}

/**
 * The version of a module's value the build may change, without the change reaching the module's
 * export (see the module description for the rule).
 * @param {unknown} value - The module's value.
 * @param {object} [options={}] - Options.
 * @param {boolean} [options.addsMembers=false] - True when named exports will be added to the result,
 *   so an array or a class instance needs a layer as well.
 * @returns {unknown} A copy, a layer, or `value` itself.
 * @package
 *
 * @example
 * const moduleContent = copyForComposition(mod.default, { addsMembers: true });
 * moduleContent.extra = mod.extra; // mod.default is unchanged
 */
export function copyForComposition(value, { addsMembers = false } = {}) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	if (util.types.isProxy(value)) return layerOver(value);
	if (typeof value === "function") return value;
	if (Array.isArray(value)) return addsMembers ? layerOver(value) : value.slice();
	if (hasOwnClass(value)) return addsMembers ? layerOver(value) : value;
	const descriptors = Object.getOwnPropertyDescriptors(value);
	// When named exports are added, each member of the copy can be replaced: one that wins a conflict
	// replaces even a member the value holds read-only and non-configurable. Otherwise the copy keeps
	// the value's descriptors, so a member the value would refuse to delete or redefine is refused too.
	if (addsMembers) for (const descriptor of Object.values(descriptors)) descriptor.configurable = true;
	return Object.create(Object.getPrototypeOf(value), descriptors);
}

/**
 * Lay a layer again over the value a layer composes over, starting with `members` in their order; a
 * member the value itself holds keeps coming from the value. Used where a folder's members must appear
 * in eager's order.
 * @param {object} layered - A layer {@link copyForComposition} returned, or a value to layer.
 * @param {Array<[PropertyKey, PropertyDescriptor]>} members - Members to start with, in order.
 * @returns {object} The new layer.
 * @package
 *
 * @example
 * const instance = relayer(impl, [["sib", { value: sib }], ["extra", { value: extra }]]);
 */
export function relayer(layered, members) {
	const underlying = LAYERS.get(layered)?.underlying ?? layered;
	return layerOver(
		underlying,
		members.filter(([key]) => !Reflect.getOwnPropertyDescriptor(underlying, key))
	);
}
