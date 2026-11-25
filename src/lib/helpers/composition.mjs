/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/composition.mjs
 *	@Date: 2026-10-09T21:13:01-07:00 (1791605581)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T13:35:18-08:00 (1794951318)
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
 * - an array is copied with everything it holds (its elements and holes, any other own member and
 *   each member's descriptor, which `slice()` would drop), and gets a layer when named exports are
 *   added (`addsMembers`); an instance of an Array subclass is treated as a class instance;
 * - a class instance or built-in (a `Map`, a `Date`) keeps private fields and internal slots no copy
 *   reproduces; nothing adopts from it, so it is used as-is unless named exports are added, and then
 *   gets a layer;
 * - a plain function is used as-is unless named exports are added, and then gets a callable layer, so
 *   the module's function is never written to;
 * - a primitive is used as-is.
 *
 * A layer holds the members added to it and sends every other operation to the value, which stays the
 * receiver. Composition never writes to the value: what it adds, the layer holds. A write made through
 * the layer to one of the value's own members, or to an array's element, reaches the value, as the same
 * write to the value would.
 */
import { util } from "#helpers/platform";
import {
	ArrayMethods,
	Arrays,
	concatLists,
	filterList,
	FunctionMethods,
	Map,
	mapEntriesToArray,
	mapKeysToArray,
	mapList,
	MapMethods,
	NativeProxy,
	Number,
	Objects,
	Reflect,
	RegExpMethods,
	Set,
	setFrom,
	SetMethods,
	setToArray,
	WeakMap,
	WeakMapMethods
} from "#helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * Whether a property key is an array index, the keys an array's `length` follows.
 * @param {PropertyKey} key - The key.
 * @returns {boolean} True for a canonical index below 2^32 - 1.
 * @private
 *
 * @example
 * isArrayIndex("2"); // true
 */
function isArrayIndex(key) {
	if (typeof key !== "string" || !(RegExpMethods.exec(/^(?:0|[1-9]\d*)$/, key) !== null)) return false;
	return Number(key) < 4294967295;
}

/**
 * The value each layer composes over, its added members and the value's members it hides, so a layer
 * can be laid again over the same value with its members in another order, or copied as it stands.
 * @type {WeakMap<object, {underlying: object|Function, added: Map<PropertyKey, PropertyDescriptor>, removed: Set<PropertyKey>}>}
 * @private
 */
const LAYERS = new WeakMap();

/**
 * The plain object each copy {@link copyForComposition} made was copied from (see {@link copySourceOf}).
 * @type {WeakMap<object, object>}
 * @private
 */
const COPY_SOURCES = new WeakMap();

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
	return WeakMapMethods.has(LAYERS, value);
}

/**
 * Put a member on a value being composed. A layer holds it itself, by definition, so it never reaches the
 * value under the layer (a write to a member that value has would). Anything else takes an assignment.
 * @param {object|Function} target - The value being composed (a layer, or a copy the build owns).
 * @param {PropertyKey} key - Member name.
 * @param {unknown} value - Member value.
 * @returns {void}
 * @package
 *
 * @example
 * holdMember(moduleContent, "extra", mod.extra);
 */
export function holdMember(target, key, value) {
	if (WeakMapMethods.has(LAYERS, target)) {
		// The shell's fixed key (an array's `length`) takes only a writable data value, in its own form.
		if (!Reflect.defineProperty(target, key, { __proto__: null, value, writable: true, enumerable: true, configurable: true })) {
			Reflect.defineProperty(target, key, { __proto__: null, value, writable: true });
		}
		return;
	}
	target[key] = value;
}

/**
 * The keys a composition layer holds itself (the named exports composed onto it), in order. Every other
 * key the layer reports is answered by the value under it.
 * @param {object|Function} layer - A composition layer (see {@link isCompositionLayer}).
 * @returns {PropertyKey[]} The held keys; none for a value that is not a layer.
 * @package
 *
 * @example
 * layerHeldKeys(flatten.composeFunctionDefault(mod.default)); // ["extra"] once `extra` is composed onto it
 */
export function layerHeldKeys(layer) {
	return mapKeysToArray(WeakMapMethods.get(LAYERS, layer)?.added);
}

/**
 * The method each bound form a layer hands out (see `read` in layerOver) stands for.
 * @type {WeakMap<Function, Function>}
 * @private
 */
const BOUND_ORIGINALS = new WeakMap();

/** `WeakMap.prototype.has` as it was when slothlet loaded, so a module replacing it changes no answer of {@link isCompositionProxy}. */
const weakMapHas = WeakMapMethods.has;

/**
 * Whether a value is one of the Proxies composition makes: a layer ({@link layerOver}) or a method read
 * through one, bound to the value it came from. Only the registries are read, so nothing of the value runs.
 * @param {*} value - The value.
 * @returns {boolean} True for a layer or a layer's bound method.
 * @internal
 *
 * @example
 * isCompositionProxy(layerOver({})); // true
 */
export function isCompositionProxy(value) {
	return weakMapHas(LAYERS, value) || weakMapHas(BOUND_ORIGINALS, value);
}

/**
 * The method a composition layer's bound form of it stands for: a method of the value under a layer is handed out
 * bound to that value, and is the value's own method all the same (#632).
 * @param {*} value - A value a layer handed out.
 * @returns {Function|undefined} The method behind it, or undefined for anything else.
 * @package
 *
 * @example
 * layerMethodOriginal(layer.get) === Map.prototype.get; // true for a layer over a Map
 */
export function layerMethodOriginal(value) {
	return typeof value === "function" ? WeakMapMethods.get(BOUND_ORIGINALS, value) : undefined;
}

/**
 * Whether a composition layer answers `key` from the value under it, reading or writing it on that value, which is
 * the receiver its getters and setters run on: a key the layer neither holds itself nor hides (#632).
 * @param {object|Function} layer - A composition layer (see {@link isCompositionLayer}).
 * @param {PropertyKey} key - The key.
 * @returns {boolean} True when the value under the layer answers it; false for a value that is not a layer.
 * @package
 *
 * @example
 * layerForwards(flatten.composeFunctionDefault(mod.default), "name"); // true
 */
export function layerForwards(layer, key) {
	const record = WeakMapMethods.get(LAYERS, layer);
	return record !== undefined && !MapMethods.has(record.added, key) && !SetMethods.has(record.removed, key);
}

/**
 * The value under a composition layer: the module's own array or function, which takes an integrity
 * operation (seal, freeze) the layer itself refuses.
 * @param {object|Function} layer - A composition layer, or any other value.
 * @returns {object|Function} The value under a layer; any other value, unchanged.
 * @package
 *
 * @example
 * layerUnderlying(flatten.composeFunctionDefault(mod.default)) === mod.default; // true
 */
export function layerUnderlying(layer) {
	return WeakMapMethods.get(LAYERS, layer)?.underlying ?? layer;
}

/** Whether {@link setApiNodeCheck} has run. @type {boolean} */
let apiNodeCheckSet = false;

/**
 * Register how to recognize an api node (see {@link isApiNode}).
 * @param {function(unknown): boolean} check - Returns true for a slothlet wrapper proxy.
 * @returns {void}
 * @package
 *
 * @example
 * setApiNodeCheck((value) => proxyRegistry.has(value));
 */
function setApiNodeCheck(check) {
	// Set once, by the wrapper as it loads: a second set is refused, so code that sets it first makes slothlet's load fail.
	if (apiNodeCheckSet) throw ownBindingsRefusal("lib/helpers/composition", import.meta.url);
	apiNodeCheckSet = true;
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
	if (value === null || typeof value !== "object" || Arrays.isArray(value) || util.types.isProxy(value)) return false;
	const proto = Objects.getPrototypeOf(value);
	return proto !== null && proto !== Objects.prototype;
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
			__proto__: null,
			get: "get" in descriptor ? descriptor.get : base.get,
			set: "set" in descriptor ? descriptor.set : base.set,
			enumerable,
			configurable: true
		};
	}
	if (currentIsAccessor && !("value" in descriptor) && !("writable" in descriptor)) return { __proto__: null, ...current, enumerable };
	const base = current && !currentIsAccessor ? current : { __proto__: null, value: undefined, writable: true };
	return {
		__proto__: null,
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
 * A member defined non-configurable is held on the layer's own target as well, so the engine holds the
 * layer to what such a property allows, as it holds an object.
 * @param {object|Function} underlying - The module's default.
 * @param {Array<[PropertyKey, PropertyDescriptor]>} [members=[]] - Members to start with, in order.
 * @param {Iterable<PropertyKey>} [hidden=[]] - The value's members to start hidden, as deleted.
 * @returns {object|Function} The layer.
 * @private
 *
 * @example
 * const layer = layerOver(mod.default);
 * layer.extra = mod.extra; // held by the layer; mod.default is unchanged
 */
function layerOver(underlying, members = [], hidden = []) {
	const added = new Map();
	// `hidden` is an array, or the set another layer hides.
	const removed = Arrays.isArray(hidden) ? setFrom(hidden) : setFrom(setToArray(hidden));
	const bound = new Map();
	const isArray = Arrays.isArray(underlying);
	const isCallable = typeof underlying === "function";
	const forwards = (key) => !MapMethods.has(added, key) && !SetMethods.has(removed, key);
	// A method runs on the value itself, which is the receiver its private fields and internal slots
	// belong to, whether the value inherits it (a class's, a built-in's) or owns it (one its constructor
	// assigned). Only the call's receiver changes: the method answers as itself otherwise, its own
	// members included. The bound form is cached so every read returns the same function.
	const read = (key) => {
		const value = Reflect.get(underlying, key);
		if (typeof value !== "function" || isApiNode(value)) return value;
		const cached = MapMethods.get(bound, key);
		if (cached?.original === value) return cached.fn;
		const fn = new NativeProxy(value, { apply: (method, _receiver, args) => Reflect.apply(method, underlying, args) });
		MapMethods.set(bound, key, { original: value, fn });
		WeakMapMethods.set(BOUND_ORIGINALS, fn, value);
		return fn;
	};
	// The layer's own target is a fresh shell, not the value: the invariants a Proxy must keep are checked
	// against its target, and a frozen or non-extensible value would forbid every added key. The shell is
	// always extensible, so the layer may report the added keys beside the value's own. A callable shell is
	// a bound function: it can be called and constructed, and unlike a plain function it has no fixed
	// `prototype`, which an arrow function or method value does not have either.
	const shell = isCallable ? FunctionMethods.bind(function () {}) : isArray ? [] : {};
	const shellFixedKeys = filterList(Reflect.ownKeys(shell), (key) => !Reflect.getOwnPropertyDescriptor(shell, key).configurable);
	// A member held non-configurable must be the shell's own too: a Proxy may report a property
	// non-configurable only when its target holds it so. The shell's copy is then what the engine checks
	// every later change against, as it would an object's own property (#585 review).
	const pinned = (key) =>
		!ArrayMethods.includes(shellFixedKeys, key) && Reflect.getOwnPropertyDescriptor(shell, key)?.configurable === false;
	const hold = (key, member, nonConfigurable) => {
		if (nonConfigurable && !ArrayMethods.includes(shellFixedKeys, key)) {
			const fixed = { __proto__: null, ...member, configurable: false };
			if (!Reflect.defineProperty(shell, key, fixed)) return false;
			MapMethods.set(added, key, Reflect.getOwnPropertyDescriptor(shell, key));
		} else {
			MapMethods.set(added, key, member);
		}
		SetMethods.delete(removed, key);
		return true;
	};
	for (let ofIndex = 0, ofList = members; ofIndex < ofList.length; ofIndex++) {
		const ofEntry = ofList[ofIndex],
			key = ofEntry[0],
			descriptor = ofEntry[1];
		hold(key, layerMember(undefined, descriptor), descriptor.configurable === false);
	}
	const layer = new NativeProxy(shell, {
		__proto__: null,
		get(_shell, key, receiver) {
			if (!MapMethods.has(added, key)) return forwards(key) ? read(key) : undefined;
			const member = MapMethods.get(added, key);
			// An accessor member runs on the layer, as a getter on an object runs on that object.
			if (!("value" in member)) return member.get ? Reflect.apply(member.get, receiver, []) : undefined;
			return member.value;
		},
		has: (_shell, key) => MapMethods.has(added, key) || (forwards(key) && Reflect.has(underlying, key)),
		set(_shell, key, value, receiver) {
			// A member the value itself holds and the layer does not is the value's: a write to it reaches
			// the value, as a write to the value would, so its methods and getters see it. The build never
			// writes this way; it composes members onto a layer by definition (see `holdMember`).
			if (forwards(key) && Reflect.has(underlying, key)) return Reflect.set(underlying, key, value, underlying);
			// An array's element is the array's too, a new one included: written to the array, its `length`
			// grows as it would on the array itself (#585 review).
			if (isArray && forwards(key) && isArrayIndex(key)) return Reflect.set(underlying, key, value, underlying);
			const member = MapMethods.get(added, key);
			if (member && !("value" in member)) {
				if (!member.set) return false;
				Reflect.apply(member.set, receiver, [value]);
				return true;
			}
			if (member && !member.writable) return false;
			if (pinned(key)) {
				Reflect.defineProperty(shell, key, { __proto__: null, value });
				MapMethods.set(added, key, Reflect.getOwnPropertyDescriptor(shell, key));
				return true;
			}
			SetMethods.delete(removed, key);
			MapMethods.set(
				added,
				key,
				member ? { __proto__: null, ...member, value } : { __proto__: null, value, writable: true, enumerable: true, configurable: true }
			);
			return true;
		},
		defineProperty(_shell, key, descriptor) {
			// The shell's fixed key (an array's `length`) takes only what the array's own would: a data
			// value, staying non-configurable and non-enumerable.
			// It also stays writable: the shell holds it writable, and a non-configurable key may not be
			// reported read-only while its target holds it writable.
			if (
				ArrayMethods.includes(shellFixedKeys, key) &&
				(descriptor.configurable || descriptor.enumerable || descriptor.writable === false || "get" in descriptor || "set" in descriptor)
			) {
				return false;
			}
			// A non-configurable member changes only as the engine allows its shell copy to.
			if (pinned(key)) {
				if (!Reflect.defineProperty(shell, key, descriptor)) return false;
				MapMethods.set(added, key, Reflect.getOwnPropertyDescriptor(shell, key));
				return true;
			}
			// A define that leaves out a field keeps the member's current one, as on an object (#585 review): a
			// member still forwarded starts from the value's own. The fixed key with no new value is unchanged.
			if (ArrayMethods.includes(shellFixedKeys, key) && !MapMethods.has(added, key) && !("value" in descriptor)) return true;
			const current = MapMethods.get(added, key) ?? (forwards(key) ? Reflect.getOwnPropertyDescriptor(underlying, key) : undefined);
			// A new member takes false for each attribute it leaves out, as on an object, so one defined
			// without `configurable` is held non-configurable (#585 review).
			const isAccessor = "get" in descriptor || "set" in descriptor;
			const complete = current
				? descriptor
				: {
						__proto__: null,
						...(isAccessor ? { get: undefined, set: undefined } : { __proto__: null, value: undefined, writable: false }),
						enumerable: false,
						configurable: false,
						...descriptor
					};
			return hold(key, layerMember(current, complete), complete.configurable === false);
		},
		deleteProperty(_shell, key) {
			// The shell's fixed key (an array's `length`) cannot go, as on the array itself, and neither can a
			// member held non-configurable.
			if (ArrayMethods.includes(shellFixedKeys, key) || pinned(key)) return false;
			// Hidden from the layer only; the value keeps the member.
			MapMethods.delete(added, key);
			if (Reflect.getOwnPropertyDescriptor(underlying, key)) SetMethods.add(removed, key);
			return true;
		},
		getOwnPropertyDescriptor(shell, key) {
			// A member held over the shell's fixed key is reported in that key's own form.
			if (MapMethods.has(added, key) && ArrayMethods.includes(shellFixedKeys, key)) {
				return { __proto__: null, value: MapMethods.get(added, key).value, writable: true, enumerable: false, configurable: false };
			}
			if (MapMethods.has(added, key)) return { ...MapMethods.get(added, key) };
			if (!forwards(key)) return undefined;
			const descriptor = Reflect.getOwnPropertyDescriptor(underlying, key);
			if (!descriptor) return undefined;
			// The shell's one fixed key (an array's `length`) is non-configurable and writable; the layer
			// reports the value's member in that same form. Every other member is
			// reported configurable, as the shell, which does not hold it, requires.
			if (ArrayMethods.includes(shellFixedKeys, key)) return { __proto__: null, ...descriptor, configurable: false, writable: true };
			return { __proto__: null, ...descriptor, configurable: true };
		},
		ownKeys: () =>
			setToArray(
				setFrom(
					concatLists(
						filterList(Reflect.ownKeys(underlying), (key) => !SetMethods.has(removed, key) && !MapMethods.has(added, key)),
						mapKeysToArray(added),
						shellFixedKeys
					)
				)
			),
		getPrototypeOf: () => Reflect.getPrototypeOf(underlying),
		// The layer reports the value's prototype, and changing it would change the module's value, so a
		// change is refused; setting the prototype it already has succeeds, as on an object (#585 review).
		setPrototypeOf: (_shell, prototype) => prototype === Reflect.getPrototypeOf(underlying),
		// The layer reports keys its shell does not hold (the value's own and the added ones), which a
		// non-extensible shell would forbid, so it stays extensible: sealing it is refused.
		preventExtensions: () => false,
		...(isCallable && {
			apply: (_shell, thisArg, args) => Reflect.apply(underlying, thisArg, args),
			construct: (_shell, args, newTarget) => Reflect.construct(underlying, args, newTarget === layer ? underlying : newTarget)
		})
	});
	WeakMapMethods.set(LAYERS, layer, { underlying, added, removed });
	return layer;
}

/**
 * Copy an array with everything it holds: its elements and holes, any other own member (`items.label`)
 * and each member's descriptor (a read-only element, a getter), so the copy answers as the array does
 * (#585 review). `slice()` keeps only the elements, as plain data.
 * @param {Array} value - A plain array (an Array subclass instance is never copied).
 * @returns {Array} The copy.
 * @private
 *
 * @example
 * copyArray(Object.assign(["a"], { label: "x" })).label; // "x"
 */
function copyArray(value) {
	const copy = [];
	const { length, ...members } = Objects.getOwnPropertyDescriptors(value);
	Objects.defineProperties(copy, members);
	Objects.defineProperty(copy, "length", length);
	return copy;
}

/**
 * Whether a value or its prototype chain holds a member, read from descriptors without running a getter or
 * asking a trap anything but for descriptors.
 * @param {object} value - The value.
 * @param {PropertyKey} key - The member.
 * @returns {boolean} True when a descriptor for `key` exists on the value or its prototypes.
 * @private
 */
function runtime_holdsMember(value, key) {
	// A Proxy's getPrototypeOf trap can lead the walk back to a value it already passed; it stops there.
	const seen = new Set();
	for (let current = value; current !== null && !SetMethods.has(seen, current); current = Objects.getPrototypeOf(current)) {
		SetMethods.add(seen, current);
		if (Objects.getOwnPropertyDescriptor(current, key)) return true;
	}
	return false;
}

/**
 * The version of a module's value the build may change, without the change reaching the module's
 * export (see the module description for the rule).
 * @param {unknown} value - The module's value.
 * @param {object} [options={}] - Options.
 * @param {boolean} [options.addsMembers=false] - True when named exports will be added to the result,
 *   so a function, an array or a class instance needs a layer as well.
 * @returns {unknown} A copy, a layer, or `value` itself.
 * @package
 *
 * @example
 * const moduleContent = copyForComposition(mod.default, { addsMembers: true });
 * moduleContent.extra = mod.extra; // mod.default is unchanged
 */
export function copyForComposition(value, { addsMembers = false } = {}) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
	// A layer is copied as a fresh layer over the same value, holding what the layer holds and hiding what
	// it hides: layering the layer itself would bury its members a level down, where only its traps could
	// reach them.
	const layered = WeakMapMethods.get(LAYERS, value);
	if (layered)
		return layerOver(
			layered.underlying,
			mapList(mapEntriesToArray(layered.added), (entry1) => {
				const key = entry1[0],
					member = entry1[1];
				return [key, { ...member }];
			}),
			layered.removed
		);
	if (util.types.isProxy(value)) return layerOver(value);
	// A function default with named exports is the node itself (`api.x()` calls it, `api.x.extra` is the
	// named export): the exports go on a callable layer, so the module's own function is never written to.
	if (typeof value === "function") return addsMembers ? layerOver(value) : value;
	// An instance of an Array subclass may hold private fields no copy reproduces: it is kept as itself,
	// as a class instance is (#585 review).
	if (Arrays.isArray(value) && Objects.getPrototypeOf(value) !== Arrays.prototype) return addsMembers ? layerOver(value) : value;
	if (Arrays.isArray(value)) return addsMembers ? layerOver(value) : copyArray(value);
	if (hasOwnClass(value)) return addsMembers ? layerOver(value) : value;
	// A browser cannot tell a Proxy from the object it fronts, so the check above misses one there. A callable
	// `then` that no own or inherited member holds can only come from a trap: such a value is layered, as a
	// Proxy is in Node, so it keeps answering `then` and is refused as a thenable like it would be when awaited.
	if (!runtime_holdsMember(value, "then") && typeof value.then === "function") return layerOver(value);
	const descriptors = Objects.getOwnPropertyDescriptors(value);
	// When named exports are added, each member of the copy can be replaced: one that wins a conflict
	// replaces even a member the value holds read-only and non-configurable. Otherwise the copy keeps
	// the value's descriptors, so a member the value would refuse to delete or redefine is refused too.
	if (addsMembers)
		for (let ofIndex = 0, ofList = Objects.values(descriptors); ofIndex < ofList.length; ofIndex++) {
			const descriptor = ofList[ofIndex];
			descriptor.configurable = true;
		}
	const copy = Objects.create(Objects.getPrototypeOf(value), descriptors);
	WeakMapMethods.set(COPY_SOURCES, copy, value);
	return copy;
}

/**
 * The object a copy {@link copyForComposition} made was copied from, so a node built from the copy can find the
 * module's own object behind it (a copy of a copy leads there in two steps).
 * @param {unknown} copy - A value.
 * @returns {object|undefined} The object it was copied from, or undefined for anything that is no such copy.
 * @package
 *
 * @example
 * copySourceOf(copyForComposition(mod.config)) === mod.config; // true
 */
export function copySourceOf(copy) {
	return copy !== null && typeof copy === "object" ? WeakMapMethods.get(COPY_SOURCES, copy) : undefined;
}

/**
 * The same layer laid over another value: what the layer holds and hides, over `underlying` (#597). Used where the
 * value a layer composes over is replaced by a stand-in for it.
 * @param {object} layered - A layer {@link copyForComposition} returned.
 * @param {object|Function} underlying - The value to lay it over.
 * @returns {object|Function} The new layer.
 * @package
 *
 * @example
 * const impl = layerOnto(layer, standIn);
 */
export function layerOnto(layered, underlying) {
	const prior = WeakMapMethods.get(LAYERS, layered);
	return layerOver(
		underlying,
		prior
			? mapList(mapEntriesToArray(prior.added), (entry2) => {
					const key = entry2[0],
						member = entry2[1];
					return [key, { ...member }];
				})
			: [],
		prior?.removed ?? []
	);
}

/**
 * Lay a layer again over the value a layer composes over, starting with `members` in their order; a
 * member the value itself holds keeps coming from the value, unless the layer being relaid held it over
 * the value's own. Members that layer hid stay hidden. Used where a folder's members must appear in
 * eager's order.
 * @param {object} layered - A layer {@link copyForComposition} returned, or a value to layer.
 * @param {Array<[PropertyKey, PropertyDescriptor]>} members - Members to start with, in order.
 * @returns {object} The new layer.
 * @package
 *
 * @example
 * const instance = relayer(impl, [["sib", { value: sib }], ["extra", { value: extra }]]);
 */
export function relayer(layered, members) {
	const prior = WeakMapMethods.get(LAYERS, layered);
	const underlying = prior?.underlying ?? layered;
	// A member the value holds keeps coming from the value, unless the layer being relaid held it over the
	// value's own: a named export that won its collision with the value's member stays the winner (#585 review).
	return layerOver(
		underlying,
		filterList(members, (entry3) => {
			const key = entry3[0];
			return (prior == null ? undefined : MapMethods.has(prior.added, key)) || !Reflect.getOwnPropertyDescriptor(underlying, key);
		}),
		prior?.removed ?? []
	);
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (!mayTakeInternals(consumer, ["lib/handlers/unified-wrapper"])) throw ownBindingsRefusal("lib/helpers/composition", import.meta.url);
	return { setApiNodeCheck };
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
/** @type {typeof setApiNodeCheck} */
const guarded_setApiNodeCheck = guardInternal(setApiNodeCheck, "setApiNodeCheck", import.meta.url);
export { guarded_setApiNodeCheck as setApiNodeCheck };
