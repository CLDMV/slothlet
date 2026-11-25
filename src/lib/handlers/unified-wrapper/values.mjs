/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper/values.mjs
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
 * @fileoverview Values layer of the wrapper: value predicates (`is*`, `holds*`), data kinds and their readers, inherited and built-in lookups, the realm's intrinsics and inspect labels.
 * @module @cldmv/slothlet/handlers/unified-wrapper/values
 * @internal
 */

import { isNode, util, EventEmitter, inheritsFrom } from "#helpers/platform";
import { isCompositionLayer, layerHeldKeys, layerMethodOriginal, layerUnderlying } from "#helpers/composition";
import { SlothletError } from "#errors";
import { isFrameworkReservedKey } from "#helpers/reserved-keys";
import { runtime_isWrappedClassInstance } from "#helpers/class-instance-wrapper";
import { isFrameworkInternal, isSlothletProxy } from "#handlers/framework-internals";
import { isSharedExport } from "#handlers/shared-values";
import { isBoxedPrimitive } from "#helpers/clone-context";
import { isFunctionSourcePatch } from "#helpers/function-source-context";
import {
	AggregateError,
	ArrayBuffer,
	ArrayBuffers,
	ArrayMethods,
	Arrays,
	BigInt,
	BigInt64Array,
	BigUint64Array,
	Blob,
	Boolean,
	concatLists,
	copyList,
	DataView,
	Date,
	Error,
	Errors,
	EvalError,
	EventTarget,
	filterList,
	Float16Array,
	Float32Array,
	Float64Array,
	Functions,
	functionSource,
	generatorSteps,
	Int16Array,
	Int32Array,
	Int8Array,
	Intl,
	Iterators,
	listPush,
	Map,
	mapEntriesToArray,
	mapFrom,
	mapList,
	MapMethods,
	MessageChannel,
	NativeObject,
	NativeProxy,
	Number,
	Objects,
	Processes,
	Promise,
	PrototypeFunctions,
	TypedArrayPrototype,
	RangeError,
	ReferenceError,
	Reflect,
	RegExp,
	RegExpMethods,
	Set,
	setFrom,
	SetMethods,
	setToArray,
	SharedArrayBuffer,
	splitText,
	String,
	StringMethods,
	structuredClone,
	Symbol,
	Symbols,
	SyntaxError,
	TextDecoder,
	TextEncoder,
	TypeError,
	Uint16Array,
	Uint32Array,
	Uint8Array,
	Uint8ClampedArray,
	URIError,
	URL,
	URLSearchParams,
	WeakMap,
	WeakMapMethods,
	WeakRef,
	WeakSet,
	WeakSetMethods
} from "#helpers/intrinsics";
import { isLanguagePrototype, rawContent } from "#helpers/run-snapshot";
import { isEngineStackAccessor, runUnformatted } from "#helpers/stack-read";

import { internals as sharedValuesInternals } from "#handlers/shared-values";
const { recordSharedExports } = sharedValuesInternals("lib/handlers/unified-wrapper/values");

import { ownBindingsRefusal } from "#helpers/instance-imports";
import { codeLabel, isLanguageNameDescriptor } from "#helpers/builtin-forms";

/**
 * Bindings of the other parts of the wrapper this file uses, taken from the wrapper's method table when the chain is
 * registered (see `WrapperBase.link`), before any wrapper exists.
 *
 * Upward (from layers above this one): hasOwn, SELF_VIEW_NODES, INSPECT_CUSTOM, PROTOTYPE_HANDLE_READER, SELF_MEMBER_VIEWS, NODE_MEMBER, FRAMEWORK_MEMBERS, FRAMEWORK_VIEW_TARGETS, CALLER_LOCKED, nodeWrapperOf, startPrototypes, sameLookup, resolveEnforcedCaller, readGateDecision, enforceCodeMember, recordedPrototype, moduleObjectOf, originalAccessor, STAND_IN_RECORDS, INBOUND_VIEWS, memberHoldsCode, searchDepth, searchBudget, nodeAtPath, readerHoldsPrototype, knownPrototype, prototypeHandleOf, CROSSINGS, CROSSING_ORIGINS, moduleKey, asOneModule, crossSubject, functionOf, hasOwnMember, prototypeChain, ANY_MEMBER_SEGMENT, readsNothingBeneath, memberPathOf, capturedViewChildren, WAITING_CHAINS, rootInspectShown.
 */
let trustedRootOwn,
	hasOwn,
	SELF_VIEW_NODES,
	INSPECT_CUSTOM,
	PROTOTYPE_HANDLE_READER,
	SELF_MEMBER_VIEWS,
	NODE_MEMBER,
	nodeWrapperOf,
	startPrototypes,
	sameLookup,
	resolveEnforcedCaller,
	readGateDecision,
	enforceCodeMember,
	recordedPrototype,
	moduleObjectOf,
	STAND_IN_RECORDS,
	INBOUND_VIEWS,
	memberHoldsCode,
	searchDepth,
	searchBudget,
	nodeAtPath,
	prototypeHandleOf,
	CROSSINGS,
	CROSSING_ORIGINS,
	moduleKey,
	asOneModule,
	functionOf,
	hasOwnMember,
	prototypeChain,
	ANY_MEMBER_SEGMENT,
	readsNothingBeneath,
	memberPathOf,
	capturedViewChildren,
	TYPE_STATES,
	WAITING_CHAINS,
	resolveWrapper;
/** The proxy registry's accessors (see `Values.#proxyRegistry`), set when the class is defined. */
let registeredWrapper, isRegisteredProxy, registerProxy;
/** The registered `UnifiedWrapper`: the only class this layer's constructor builds for. @type {Function|undefined} */
let realClass;

/** The fields a property descriptor can give. @type {ReadonlyArray<string>} @private */
const DESCRIPTOR_FIELDS = Objects.freeze(["value", "writable", "get", "set", "enumerable", "configurable"]);

/**
 * Whether defining `descriptor` on `holder`'s `prop` would change nothing (#667): the member is fixed (non-configurable)
 * and every attribute the descriptor gives is the one it has. Freezing an already frozen object defines each member
 * so, and on a plain object that is no change at all, so no write rule decides it.
 * @param {object} holder - What holds the member as it is reported: a proxy's target or shadow.
 * @param {PropertyKey} prop - The member's key.
 * @param {PropertyDescriptor} descriptor - The definition.
 * @returns {boolean} True when the definition changes nothing.
 * @private
 */
function isUnchangingDefinition(holder, prop, descriptor) {
	const current = Reflect.getOwnPropertyDescriptor(holder, prop);
	if (!current || current.configurable) return false;
	for (let ofIndex = 0, ofList = DESCRIPTOR_FIELDS; ofIndex < ofList.length; ofIndex++) {
		const field = ofList[ofIndex];
		if (field in descriptor && !(field in current && Objects.is(descriptor[field], current[field]))) return false;
	}
	return true;
}

/**
 * Whether a value is a prototype's handle ({@link prototypeHandle}).
 * @param {*} value - The value.
 * @returns {boolean} True for one.
 * @private
 */
function isPrototypeHandle(value) {
	return (
		value !== null &&
		(typeof value === "object" || typeof value === "function") &&
		WeakMapMethods.get(SELF_MEMBER_VIEWS, value)?.reader === PROTOTYPE_HANDLE_READER
	);
}

/**
 * The realm's intrinsics — `Object`, `Function.prototype`, `Map.prototype.get`, `Math`, … — gathered once from
 * the global object without running any getter. They belong to no module: a node reaches them only through the
 * prototype chain every object shares, so they are handed out as they are, and `x.constructor === Object` holds.
 *
 * Gathered when this file loads, before any module's code runs, so what a module puts on the global object later
 * never counts as one (#625). A Proxy found there is passed over, never asked for its members: its traps would
 * run, and it is nobody's intrinsic.
 * @type {WeakSet<object>}
 * @private
 */
const REALM_INTRINSICS = gatherIntrinsics();

/**
 * Gather the realm's intrinsics ({@link REALM_INTRINSICS}): what the global object holds, to a depth of three, by
 * property descriptor and prototype, leaving out every Proxy.
 * @returns {WeakSet<object>} The intrinsics.
 * @private
 */
function gatherIntrinsics() {
	const intrinsics = new WeakSet();
	// Breadth first, so each intrinsic is reached at its shallowest depth and its own members are gathered too.
	const pending = [[globalThis, 0]];
	for (let index = 0; index < pending.length; index++) {
		const unpacked1 = pending[index],
			current = unpacked1[0],
			depth = unpacked1[1];
		if (WeakSetMethods.has(intrinsics, current)) continue;
		WeakSetMethods.add(intrinsics, current);
		if (depth >= 3) continue;
		const next = (candidate) => {
			if (
				candidate !== null &&
				(typeof candidate === "object" || typeof candidate === "function") &&
				!WeakSetMethods.has(intrinsics, candidate) &&
				!util.types.isProxy(candidate)
			) {
				listPush(pending, [candidate, depth + 1]);
			}
		};
		next(Reflect.getPrototypeOf(current));
		for (let ofIndex = 0, ofList = Objects.values(Objects.getOwnPropertyDescriptors(current)); ofIndex < ofList.length; ofIndex++) {
			const descriptor = ofList[ofIndex];
			next(descriptor.value);
			next(descriptor.get);
			next(descriptor.set);
		}
	}
	return intrinsics;
}

/**
 * Whether `value` is one of the realm's intrinsics ({@link REALM_INTRINSICS}).
 * @param {object} value - An object or function.
 * @returns {boolean} Whether it is an intrinsic.
 * @private
 */
function isIntrinsic(value) {
	return WeakSetMethods.has(REALM_INTRINSICS, value);
}

/**
 * Whether `value` is a built-in object whose methods work only on the object itself (a `Map`, a `Date`, a
 * `Promise`, a typed array, …): such a value is handed out as it is, so those methods keep working on it.
 * @param {object} value - An object or function.
 * @returns {boolean} Whether it carries internal state only the object itself answers for.
 * @private
 */
function hasInternalSlots(value) {
	return dataKind(value) !== null;
}

/** @private */
const WEAKREF_DEREF = PrototypeFunctions.WeakRef.deref ?? null;

/** @private */
const ERROR_BRAND =
	typeof Errors.isError === "function"
		? Errors.isError
		: typeof util?.types?.isNativeError === "function"
			? util.types.isNativeError
			: null;

/** @private */
const IS_PROXY = typeof util?.types?.isProxy === "function" ? util.types.isProxy : null;

/**
 * `value instanceof ctor` as the language answers it, without any `Symbol.hasInstance` a module gave the class (see
 * {@link inheritsFrom}). Slothlet's own checks use it so no module's code runs from them.
 * @param {*} value - The value.
 * @param {Function|null|undefined} ctor - The class; anything not a function answers false.
 * @returns {boolean} Whether `ctor.prototype` is on the value's prototype chain.
 * @private
 */
function inherits(value, ctor) {
	return inheritsFrom(value, ctor);
}

/**
 * Whether a value is a promise of the engine's own whose prototype is `Promise.prototype`: one `await` reacts to with
 * the language's own `then`, never reading one off it. Told by the engine's brand check, so a Proxy is never one and
 * none of its traps run.
 * @param {*} value - The value.
 * @returns {boolean} True for such a promise.
 * @private
 */
function isEnginePromise(value) {
	return value !== null && typeof value === "object" && util.types.isPromise(value) && Reflect.getPrototypeOf(value) === Promise.prototype;
}

/**
 * Whether `value` is a `WeakRef`, by the engine's own brand check: `deref` throws for anything else, a Proxy included,
 * without running any code of the value's.
 * @param {*} value - The value.
 * @returns {boolean} True for a `WeakRef`.
 * @private
 */
function isWeakRef(value) {
	if (WEAKREF_DEREF === null || value === null || typeof value !== "object") return false;
	try {
		Reflect.apply(WEAKREF_DEREF, value, []);
		return true;
	} catch {
		return false;
	}
}

/**
 * Whether `value` is an error, as `instanceof Error` answers it, without running a module's `Symbol.hasInstance` or a
 * Proxy's traps: a Proxy is asked by the engine's brand check (which a Proxy never passes), anything else by its
 * prototype chain.
 * @param {object} value - An object or function.
 * @returns {boolean} True for an error.
 * @private
 */
function isErrorValue(value) {
	if (IS_PROXY !== null && IS_PROXY(value)) return ERROR_BRAND !== null && ERROR_BRAND(value);
	return inherits(value, Error);
}

/**
 * The checks {@link dataKind} tells the kinds apart by: the engine's own brand checks where the host has them
 * (so a `SharedArrayBuffer`, and an object made in another realm, are told apart as the engine knows them), the
 * realm's constructors otherwise.
 * @type {Array<[string, function(*): boolean]>}
 * @private
 */
const DATA_KINDS = (() => {
	const types = util?.types ?? {};
	const brand = (name, kind) => (typeof types[name] === "function" ? (value) => types[name](value) : (value) => inherits(value, kind));
	return [
		["map", brand("isMap", Map)],
		["set", brand("isSet", Set)],
		["weakmap", brand("isWeakMap", WeakMap)],
		["weakset", brand("isWeakSet", WeakSet)],
		["date", brand("isDate", Date)],
		["regexp", brand("isRegExp", RegExp)],
		["promise", brand("isPromise", Promise)],
		["dataview", brand("isDataView", DataView)],
		[
			"typedarray",
			typeof types.isTypedArray === "function"
				? (value) => types.isTypedArray(value)
				: (value) => ArrayBuffers.isView(value) && !inherits(value, DataView)
		],
		["sharedarraybuffer", brand("isSharedArrayBuffer", typeof SharedArrayBuffer === "function" ? SharedArrayBuffer : null)],
		["arraybuffer", brand("isArrayBuffer", ArrayBuffer)],
		// No brand check exists for a WeakRef, and reading its tag would run a proxy's traps: this realm's only.
		["weakref", (value) => isWeakRef(value)],
		["error", brand("isNativeError", Error)],
		// A `String`, `Number`, `Boolean`, `BigInt` or `Symbol` object. A realm without the brand check has no way to ask.
		["boxed", typeof types.isBoxedPrimitive === "function" ? (value) => types.isBoxedPrimitive(value) : () => false]
	];
})();

/**
 * Which kind of data object `value` is (#625): `"map"`, `"set"`, `"weakmap"`, `"weakset"`, `"date"`, `"regexp"`,
 * `"promise"`, `"dataview"`, `"typedarray"`, `"sharedarraybuffer"`, `"arraybuffer"`, `"weakref"`, `"error"`, `"boxed"` (a
 * `String`, `Number`, `Boolean`, `BigInt` or `Symbol` object) — or null for none.
 * @param {*} value - A value.
 * @returns {string|null} Its kind.
 * @private
 */
function dataKind(value) {
	if (value === null || typeof value !== "object") return null;
	// Slothlet's own values (a node, a view, a stand-in) are no data object, and asking one would read through its traps:
	// its prototype, which a closed node reports only to a caller that may call it (#632).
	if (isSlothletValue(value)) return null;
	for (let ofIndex = 0, ofList = DATA_KINDS; ofIndex < ofList.length; ofIndex++) {
		const ofEntry = ofList[ofIndex],
			kind = ofEntry[0],
			is = ofEntry[1];
		if (is(value)) return kind;
	}
	return null;
}

/**
 * The methods of each kind of data object that only read it (#625). Every other method the engine gives the kind,
 * one it adds later included, counts as a write when called through a view: a method changing the object
 * cannot slip past by being new. `RegExp#exec` and `#test` move `lastIndex` as using a regular expression does,
 * and are use.
 * @type {Array<[Function, ReadonlySet<string|symbol>]>}
 * @private
 */
const DATA_READERS = mapFrom([
	["map", setFrom(["get", "has", "keys", "values", "entries", "forEach", Symbol.iterator])],
	["weakmap", setFrom(["get", "has"])],
	[
		"set",
		setFrom([
			"has",
			"keys",
			"values",
			"entries",
			"forEach",
			Symbol.iterator,
			"union",
			"intersection",
			"difference",
			"symmetricDifference",
			"isSubsetOf",
			"isSupersetOf",
			"isDisjointFrom"
		])
	],
	["weakset", setFrom(["has"])],
	["regexp", setFrom(["exec", "test", Symbol.match, Symbol.matchAll, Symbol.search, Symbol.split, Symbol.replace])],
	["arraybuffer", setFrom(["slice"])],
	["sharedarraybuffer", setFrom(["slice"])],
	["promise", setFrom(["then", "catch", "finally"])],
	["weakref", setFrom(["deref"])]
]);

/** The methods of a typed array that only read it. @type {ReadonlySet<string|symbol>} @private */
const TYPED_ARRAY_READERS = setFrom([
	"at",
	"entries",
	"every",
	"filter",
	"find",
	"findIndex",
	"findLast",
	"findLastIndex",
	"forEach",
	"includes",
	"indexOf",
	"join",
	"keys",
	"lastIndexOf",
	"map",
	"reduce",
	"reduceRight",
	"slice",
	"some",
	"subarray",
	"toReversed",
	"toSorted",
	"with",
	"toHex",
	"toBase64",
	"values",
	Symbol.iterator
]);

/**
 * The engine's prototypes of the kinds of data object, and `Object.prototype`: a method found on one of them is the
 * engine's, held to {@link isDataReader}; any other is the module's own (#625).
 * @type {ReadonlySet<object>}
 * @private
 */
const ENGINE_DATA_PROTOTYPES = setFrom(
	filterList(
		concatLists(
			[
				Objects.prototype,
				Map.prototype,
				WeakMap.prototype,
				Set.prototype,
				WeakSet.prototype,
				Date.prototype,
				RegExp.prototype,
				ArrayBuffer.prototype,
				typeof SharedArrayBuffer === "function" ? SharedArrayBuffer.prototype : null,
				DataView.prototype,
				Promise.prototype,
				typeof WeakRef === "function" ? WeakRef.prototype : null,
				Error.prototype,
				EvalError.prototype,
				RangeError.prototype,
				ReferenceError.prototype,
				SyntaxError.prototype,
				TypeError.prototype,
				URIError.prototype,
				typeof AggregateError === "function" ? AggregateError.prototype : null,
				String.prototype,
				Number.prototype,
				Boolean.prototype,
				typeof BigInt === "function" ? BigInt.prototype : null,
				Symbol.prototype,
				TypedArrayPrototype
			],
			mapList(
				filterList(
					[
						Int8Array,
						Uint8Array,
						Uint8ClampedArray,
						Int16Array,
						Uint16Array,
						Int32Array,
						Uint32Array,
						Float32Array,
						Float64Array,
						typeof Float16Array === "function" ? Float16Array : null,
						BigInt64Array,
						BigUint64Array
					],
					Boolean
				),
				(kind) => kind.prototype
			)
		),
		Boolean
	)
);

/**
 * Whether the member `prop` a data object answers comes from the engine: the prototype in its chain that holds it is
 * one of {@link ENGINE_DATA_PROTOTYPES}.
 * @param {object} value - The data object.
 * @param {PropertyKey} prop - The member's key.
 * @returns {boolean} Whether it is the engine's.
 * @private
 */
function isEngineMember(value, prop) {
	/**
	 * Whether `fn` is one of the engine's own functions: its source is not code, and it is no bound function, which
	 * reports itself the same way.
	 * @param {Function} fn - A function.
	 * @returns {boolean} Whether it is native.
	 * @private
	 */
	function isNativeFunction(fn) {
		try {
			const source = functionSource(fn);
			return RegExpMethods.exec(/\{\s*\[native code\]\s*\}$/, source) !== null && !StringMethods.startsWith(String(fn.name), "bound ");
		} catch {
			return false;
		}
	}

	for (let proto = value; proto !== null; proto = Reflect.getPrototypeOf(proto)) {
		if (!hasOwn(proto, prop)) continue;
		if (SetMethods.has(ENGINE_DATA_PROTOTYPES, proto)) return true;
		// Another realm's own prototype: its constructor is the engine's, never code a module wrote.
		const ctor = Reflect.getOwnPropertyDescriptor(proto, "constructor")?.value;
		return proto !== value && typeof ctor === "function" && ctor.prototype === proto && isNativeFunction(ctor);
	}
	return false;
}

/**
 * The member `prop` an api node's value inherits from the engine (#630): `hasOwnProperty`, `__lookupGetter__`, `valueOf`
 * and the rest of `Object.prototype`, and `call`, `apply`, `bind` and the rest of `Function.prototype`. Such a member is
 * the value's own surface, not an api child, and runs on whatever it is called on, as it does on a plain value: a
 * composition layer's form of it, bound to the value under the layer, is unbound again, so a call through the node
 * reads, defines and calls through the node.
 * @param {object|Function} impl - The node's value.
 * @param {PropertyKey} prop - The member's key.
 * @param {*} value - What the value answered for `prop`.
 * @returns {{value: *}|null} The engine's member, or `null` when `prop` is the value's own or a member its own code
 *   defined (a class's method).
 * @private
 */
function inheritedEngineMember(impl, prop, value) {
	if (impl === null || (typeof impl !== "object" && typeof impl !== "function")) return null;
	if (hasOwn(impl, prop)) return null;
	const answered = layerMethodOriginal(value) ?? value;
	// A callable node's own answer for `valueOf` (see valueOfFor), read through a layer over that node.
	const original = WeakSetMethods.has(NODE_VALUE_OFS, answered) ? PrototypeFunctions.Object.valueOf : answered;
	// Recognised by identity rather than by walking the value's prototypes: a layer over another api node has none to
	// walk (a node reports none). Only `Object.prototype` and `Function.prototype` are meant: their methods work on any
	// receiver, where a `Map`'s or a `Date`'s need the value itself and stay bound to it.
	// An accessor (`__proto__`) is the engine's when its getter, run on the value, answers what the value did, and what
	// it answers is the engine's too: a prototype that is a class of the module's stays the module's code, behind the
	// node's checks like any other member holding it.
	const isEngines = ArrayMethods.some(INHERITED_HOLDERS, (holder) => {
		const descriptor = Reflect.getOwnPropertyDescriptor(holder, prop);
		if (!descriptor) return false;
		if ("value" in descriptor) return descriptor.value === original;
		return (
			typeof descriptor.get === "function" &&
			(original === null || ArrayMethods.includes(INHERITED_HOLDERS, original)) &&
			Reflect.apply(descriptor.get, impl, []) === original
		);
	});
	return isEngines ? { value: original } : null;
}

/** Every method {@link valueOfFor} made. @type {WeakSet<Function>} @private */
const NODE_VALUE_OFS = new WeakSet();

/** The engine's prototypes every api node's value inherits from. @type {ReadonlyArray<object>} @private */
const INHERITED_HOLDERS = Objects.freeze([Objects.prototype, Functions.prototype]);

/** Methods every object has that only read it. @type {ReadonlySet<string|symbol>} @private */
const COMMON_READERS = setFrom([
	"hasOwnProperty",
	"isPrototypeOf",
	"propertyIsEnumerable",
	"toString",
	"toLocaleString",
	"valueOf",
	"__lookupGetter__",
	"__lookupSetter__"
]);

/**
 * Whether `value` is a built-in data object, decided once per value: what a value is does not change, and every read
 * of a node holding one asks.
 * @param {*} value - The value a node holds.
 * @returns {boolean} Whether it is one.
 * @private
 */
function holdsDataKind(value) {
	if (value === null || typeof value !== "object") return false;
	let isData = WeakMapMethods.get(SELF_DATA_VALUES, value);
	if (isData === undefined) {
		isData = dataKind(value) !== null;
		WeakMapMethods.set(SELF_DATA_VALUES, value, isData);
	}
	return isData;
}

/**
 * The member a node of a built-in data object (a file's default export that is a `Map`, a `Set`, a `Date`, …) answers
 * from the object, as the object does: the node fronts the value as data, so a member its kind defines (`get`, `size`,
 * `entries`, `Symbol.iterator`, a date's `getTime`) is the object's, read on it and, for a method, run on it, never an
 * api child with a path of its own. What `Object.prototype` holds keeps the node's answers (see
 * inheritedEngineMember), and so do `constructor` and `then`. A reader through `self` that may not change the
 * object gets the view's member instead ({@link selfDataMember}).
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {PropertyKey} prop - The member read.
 * @returns {*} The member, or {@link NODE_MEMBER} when the node answers it another way.
 * @private
 *
 * @example
 * // single/dmap.mjs: export default new Map([["one", { n: 1 }]]);
 * [...api.single.dmap]; // [["one", { n: 1 }]]
 * api.single.dmap.get("one"); // { n: 1 }, run on the map: `single.dmap.get` is no api path
 */
function frontedDataMember(wrapper, prop) {
	if (prop === "then" || prop === "constructor") return NODE_MEMBER;
	const impl = wrapper.____slothletInternal.impl;
	if (!holdsDataKind(impl)) return NODE_MEMBER;
	let holder = impl;
	while (holder !== null && !hasOwn(holder, prop)) holder = Reflect.getPrototypeOf(holder);
	if (holder === null || holder === impl || holder === Objects.prototype || !isEngineMember(impl, prop)) return NODE_MEMBER;
	const member = Reflect.get(impl, prop, impl);
	if (typeof member !== "function") return member;
	let byObject = WeakMapMethods.get(SELF_DATA_METHODS, impl);
	if (!byObject) {
		byObject = new Map();
		WeakMapMethods.set(SELF_DATA_METHODS, impl, byObject);
	}
	let method = MapMethods.get(byObject, prop);
	if (method?.fn !== member) {
		method = { fn: member, call: (...args) => Reflect.apply(member, impl, args) };
		MapMethods.set(byObject, prop, method);
	}
	return method.call;
}

/**
 * Whether each value a node holds is a built-in data object ({@link selfDataMember}), decided once per value.
 * @type {WeakMap<object, boolean>}
 * @private
 */
const SELF_DATA_VALUES = new WeakMap();

/**
 * The methods {@link frontedDataMember} made to run on a data object itself, per object and key.
 * @type {WeakMap<object, Map<string|symbol, {fn: Function, call: Function}>>}
 * @private
 */
const SELF_DATA_METHODS = new WeakMap();

/**
 * The privacy of a member an instance of a module's class inherits (`instance._data`, `instance._method()`): a private
 * member a prototype holds is the module's whichever route reaches it, so an instance another module holds reads it as
 * the prototype's handle does, decided for the code reading ({@link selfMemberView}). Found by descriptors along
 * the value's own chain, so nothing of the module's runs. A member the value holds of its own is not decided here.
 * @param {object|null} slothlet - The instance.
 * @param {object|Function} value - The value read, as the module holds it.
 * @param {string|symbol} prop - The member.
 * @returns {object|null} The handle's record that decides it, or null when nothing does.
 * @private
 */
function inheritedPrivate(slothlet, value, prop) {
	if (typeof prop !== "string" || StringMethods.charCodeAt(prop, 0) !== 95 || !slothlet?.handlers?.permissionManager?.isEnabled?.())
		return null;
	if (value === null || (typeof value !== "object" && typeof value !== "function") || util.types.isProxy(value) || hasOwn(value, prop))
		return null;
	for (let holder = Reflect.getPrototypeOf(value), depth = 0; holder !== null && depth < 64; depth++) {
		if (util.types.isProxy(holder) || WeakSetMethods.has(INTRINSICS, holder) || isSharedValue(holder)) return null;
		if (hasOwn(holder, prop)) {
			const record = WeakMapMethods.get(SELF_MEMBER_VIEWS, prototypeHandleOf(slothlet, holder));
			return record?.reader === PROTOTYPE_HANDLE_READER && record.refusePrivate ? record : null;
		}
		holder = Reflect.getPrototypeOf(holder);
	}
	return null;
}

/**
 * Values {@link holdsMember} found holding a function, per function.
 * @type {WeakMap<Function, WeakSet<object>>}
 * @private
 */
const MEMBER_HOLDERS = new WeakMap();

/**
 * Whether a value read off the api is a node of it as a reader is handed one: a wrapper's proxy, a view `self` handed out
 * of one, or a lazy node's stand-in. A full-isolation run's `self` hands these out as its own views, so a change made
 * under them stays in the run; anything else (data, a built-in object, a function a node holds) is handed out as read.
 * @param {*} value - The value.
 * @returns {boolean} True for a node.
 * @internal
 */
function isApiNode(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
	if (WeakMapMethods.has(SELF_VIEW_NODES, value)) return true;
	if (WeakMapMethods.has(capturedViewChildren, value)) return true;
	return resolveWrapper(value) !== null;
}

/**
 * Where a run reads a member a node inherits (one its value does not hold itself), as of the run's start: along the
 * prototype the node held then, each prototype of a module's own read as it was then (a class's prototype, an object
 * made with `Object.create()`; see `helpers/run-snapshot`), to the language's own prototype the chain ends on. The
 * member is read from `from` (the version of the prototype holding it, or that end), with the run's view as the
 * receiver. `same` tells whether the node answers the same now (its value holds no member by that key, and its chain
 * answers as it did), `found` whether a prototype holds the member.
 * Undefined for a member the node's value holds itself, and for a chain the snapshot cannot follow.
 * @param {*} node - The node, as the run's view reads through it.
 * @param {{prototype?: (object|null|symbol)}|null} version - The node's saved version, if any.
 * @param {object} snap - The run's snapshot.
 * @param {PropertyKey} prop - The member.
 * @param {boolean} inherited - Whether the node is known not to have held the member itself at the start (its version
 *   holds none); otherwise its value is asked.
 * @returns {{from: (object|null), found: boolean, same: boolean}|undefined} Where to read it.
 * @internal
 */
function inheritedAtStart(node, version, snap, prop, inherited) {
	if (snap === null || snap === undefined || snap.closed || isFrameworkReservedKey(prop)) return undefined;
	const wrapper = nodeWrapperOf(node);
	if (wrapper === null) return undefined;
	// A node fronting a module's own object holds what the object holds itself; what the node took on from its
	// prototype (a method read through it) is still the prototype's.
	const object = moduleObjectOf(wrapper);
	const ownNow = object !== null ? hasOwn(object, prop) : holdsOwnMember(node, prop);
	if (!inherited && ownNow) return undefined;
	const held = startPrototypes(wrapper, version);
	if (held === undefined) return undefined;
	const atStart = inheritedLookup(held.start, prop, (proto) => rawContent(snap, proto));
	if (atStart === undefined) return undefined;
	return {
		from: atStart.from,
		found: atStart.described !== undefined,
		same: !ownNow && sameLookup(atStart, inheritedLookup(held.now, prop, null))
	};
}

/**
 * Look a member up along a prototype chain of a module's own, to the language's own prototype it ends on: where it is
 * found (a node or Proxy in the chain answers for itself, and ends it).
 * @param {object|null} proto - The first prototype.
 * @param {PropertyKey} prop - The member.
 * @param {function(object): object|null} contentOf - The content each prototype is read as (null: as it is).
 * @returns {{from: (object|null), described: (object|undefined)}|undefined} Where it is read and its descriptor there,
 *   or undefined for a chain the lookup can't follow.
 * @private
 */
function inheritedLookup(proto, prop, contentOf) {
	for (let depth = 0; depth < 1000; depth++) {
		if (proto === null || isLanguagePrototype(proto) || resolveWrapper(proto) !== null) return { from: proto, described: undefined };
		const content = contentOf === null ? proto : contentOf(proto);
		const described = Reflect.getOwnPropertyDescriptor(content, prop);
		if (described !== undefined) return { from: content, described };
		proto = Reflect.getPrototypeOf(content);
	}
	return undefined;
}

/**
 * Whether a node holds `prop` as a member of its own now (as its own store or its value holds it), read by
 * descriptors only: a member a run's snapshot does not hold, which the node holds now, was added after the run started.
 * @param {*} node - The node, as the run's view reads through it.
 * @param {PropertyKey} prop - The member.
 * @returns {boolean} True when it does.
 * @internal
 */
function holdsOwnMember(node, prop) {
	const wrapper = nodeWrapperOf(node);
	if (wrapper === null || isFrameworkReservedKey(prop)) return false;
	if (hasOwn(wrapper, prop)) return true;
	const impl = wrapper.____slothletInternal.impl;
	if (impl === null || (typeof impl !== "object" && typeof impl !== "function") || (util.types.isProxy(impl) && !isCompositionLayer(impl)))
		return false;
	return hasOwn(layerUnderlying(impl), prop);
}

/**
 * The kind a value has once loaded (#D-4): `"namespace"` when it has members of its own, `"function"` for a callable
 * with none, `"data"` for anything else.
 * @param {*} value - The value.
 * @returns {"function"|"data"|"namespace"} Its kind.
 * @private
 * @example
 * valueKind(() => 1); // "function"
 */
function valueKind(value) {
	if (value !== null && typeof value === "object" && !Arrays.isArray(value) && !isTerminalData(value)) {
		return Objects.keys(value).length > 0 ? "namespace" : "data";
	}
	return typeof value === "function" ? "function" : "data";
}

/**
 * What `slothlet.node(target)` reports about a wrapper it reached.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {string[]|null} [path=null] - The path to report, when it is not the wrapper's own (a stand-in's chain).
 * @param {{value: *}|null} [held=null] - What a stand-in's chain read as once its node loaded, when that is no node.
 * @returns {object} The frozen report.
 * @private
 * @example
 * wrapperReport(wrapper);
 */
function wrapperReport(wrapper, path = null, held = null) {
	const internal = wrapper.____slothletInternal;
	const slothlet = wrapper.slothlet;
	const handlers = slothlet.handlers;
	const system = handlers?.metadata?.getSystemMetadata?.(wrapper) ?? null;
	const lazy = internal.mode === "lazy";
	const materialized = internal.state.materialized === true;
	const loading = internal.state.inFlight === true;

	// A report is a read of what slothlet knows: it never starts loading a lazy node.
	let type;
	let callable;
	if (held) {
		type = valueKind(held.value);
		callable = typeof held.value === "function";
	} else if (lazy && loading) {
		type = TYPE_STATES.IN_FLIGHT;
		callable = false;
	} else if (lazy && !materialized) {
		type = TYPE_STATES.UNMATERIALIZED;
		callable = false;
	} else if (path !== null) {
		// A stand-in whose chain reaches nothing yet.
		type = TYPE_STATES.IN_FLIGHT;
		callable = false;
	} else {
		const impl = internal.impl;
		if (impl === null || (typeof impl !== "object" && typeof impl !== "function") || Arrays.isArray(impl) || isTerminalData(impl)) {
			// A node holding a plain value (a primitive, an array, built-in data such as a Map) is that value: data.
			callable = false;
			type = "data";
		} else {
			callable = internal.isCallable === true || typeof impl === "function";
			const members = filterList(Objects.keys(wrapper), (key) => !isFrameworkReservedKey(key));
			// A callable with members of its own is a callable namespace (a callable folder); one with none is a function.
			if (members.length > 0) type = "namespace";
			else if (callable) type = "function";
			else type = valueKind(impl);
		}
	}

	const rawModule = system?.baseModuleID ?? internal.moduleID ?? null;
	const separatorAt = typeof rawModule === "string" ? StringMethods.indexOf(rawModule, "__slothlet_sep__") : -1;
	const module = separatorAt === -1 ? rawModule : StringMethods.slice(rawModule, 0, separatorAt);
	const versionManager = handlers?.versionManager;
	const segments =
		path ??
		(versionManager?.pathSegments
			? versionManager.pathSegments(String(internal.apiPath ?? ""))
			: internal.apiPath
				? splitText(String(internal.apiPath), ".")
				: []);

	const report = {
		callable,
		file: internal.filePath ?? system?.filePath ?? null,
		folder: internal.sourceFolder ?? system?.sourceFolder ?? null,
		loading: held ? false : loading,
		materialized: held ? true : materialized,
		mode: internal.mode,
		module,
		path: Objects.freeze(copyList(segments)),
		type
	};
	const manifest = handlers?.metadata?.getModuleManifest?.(module);
	if (manifest) report.manifest = manifest;
	return report;
}

/**
 * Classify a resolved property value as terminal data.
 *
 * A value is terminal data unless it is a plain object / array / function that getTrap
 * turns into a child namespace/callable wrapper. Primitives (and null) satisfy
 * `v !== Object(v)`; the named built-ins carry internal slots and are returned to callers
 * as-is. Child UnifiedWrapper proxies are objects that match none of these checks, so they
 * are correctly left ungated (traversal stays free).
 *
 * @param {*} value - Value to classify.
 * @returns {boolean} True when the value is a terminal data value.
 * @private
 */
function isTerminalData(value) {
	if (value !== NativeObject(value)) return true;
	if (isSlothletValue(value)) return false;
	return dataKind(value) !== null || isErrorValue(value);
}

/**
 * The enforcement options of a read of data, per instance: they ask the permission manager for the read (the rules
 * whose level covers it), and tell it which paths above the target are object members of a module's data, so a deny
 * naming one of them exactly covers what it holds.
 * @type {WeakMap<object, {operation: "read", dataMember: function(string): boolean}>}
 * @private
 */
const DATA_READ_OPTIONS = new WeakMap();

/**
 * The enforcement options of a read of data for an instance (see {@link DATA_READ_OPTIONS}).
 * @param {object} slothlet - The instance.
 * @returns {{operation: "read", dataMember: function(string): boolean}} The options.
 * @private
 */
function dataReadOptions(slothlet) {
	let options = WeakMapMethods.get(DATA_READ_OPTIONS, slothlet);
	if (options === undefined) {
		options = Objects.freeze({
			operation: "read",
			dataMember: (apiPath) => isDataMemberNode(nodeAtPath(slothlet, apiPath))
		});
		WeakMapMethods.set(DATA_READ_OPTIONS, slothlet, options);
	}
	return options;
}

/**
 * Whether each node holds an object member of a module's data, by the value it held when asked.
 * @type {WeakMap<object, {impl: *, member: boolean}>}
 * @private
 */
const DATA_MEMBER_NODES = new WeakMap();

/**
 * Objects written to an api node after the api was built (an assignment or definition outside a build), which are data
 * whoever wrote them (#826): a node a module's file never exported holds them as it holds a module's data.
 * @type {WeakSet<object>}
 * @private
 */
const ASSIGNED_DATA = new WeakSet();

/**
 * Record an object written to a node outside a build as data (see {@link ASSIGNED_DATA}): a plain object or array, never
 * a node, a Proxy or a function.
 * @param {object} wrapper - The node written to.
 * @param {*} value - The value written.
 * @returns {void}
 * @private
 */
function markAssignedData(wrapper, value) {
	if (value === null || typeof value !== "object" || wrapper.slothlet?.____buildDepth > 0) return;
	if (util.types.isProxy(value) || resolveWrapper(value) !== null || isTerminalData(value)) return;
	WeakSetMethods.add(ASSIGNED_DATA, value);
}

/**
 * Whether a node holds data written to the api after it was built, or data such a value holds (see
 * {@link ASSIGNED_DATA}).
 * @param {object} wrapper - The node's wrapper.
 * @returns {boolean} True when it does.
 * @private
 */
function holdsAssignedData(wrapper) {
	const internal = wrapper.____slothletInternal;
	return (
		internal.userAssigned === true ||
		internal.assignedData === true ||
		WeakSetMethods.has(ASSIGNED_DATA, internal.impl) ||
		(internal.sourceValue !== undefined && WeakSetMethods.has(ASSIGNED_DATA, internal.sourceValue))
	);
}

/**
 * Whether a node stands for an object member of a module's data: a plain object or array a file exports by name, or
 * one such a value holds, or one a file's default export holds, and an object assigned to a node after the api was
 * built, or one such an object holds (#826). A folder, a file's own node (its default export included), a function and
 * a built-in data value are not. A rule naming such a member's
 * path exactly is about the member, so it covers what the member holds, as reading the member itself is traversal.
 * Decided once per value the node holds.
 * @param {object|null} wrapper - The node's wrapper, or null when no node is there.
 * @returns {boolean} Whether it is one.
 * @private
 *
 * @example
 * // owner.mjs: export const config = { nested: { a: 1 } };
 * isDataMemberNode(nodeOf("owner.config.nested")); // true
 * isDataMemberNode(nodeOf("owner")); // false
 */
function isDataMemberNode(wrapper) {
	if (wrapper === null) return false;
	const internal = wrapper.____slothletInternal;
	const impl = internal.impl;
	const known = WeakMapMethods.get(DATA_MEMBER_NODES, wrapper);
	if (known !== undefined && known.impl === impl) return known.member;
	const exportPath = internal.exportPath;
	const member =
		!internal.isCallable &&
		impl !== null &&
		typeof impl === "object" &&
		!isTerminalData(impl) &&
		((Arrays.isArray(exportPath) && exportPath.length > (exportPath[0] === "default" ? 1 : 0)) || holdsAssignedData(wrapper));
	WeakMapMethods.set(DATA_MEMBER_NODES, wrapper, { impl, member });
	return member;
}

/**
 * Whether the value a node holds answers `name` or `length` itself, through its prototype chain, as an error answers
 * `name` from its class: the node then answers it as a member, as the value does (`api.m.failure.name` is
 * `"RangeError"`), instead of with its own answer (its last api-path segment, and `0`). Only a value that is not a
 * function: a function node keeps its own answers. `Object.prototype` holds neither name, so a plain object without such
 * a member keeps the node's answers. Read by descriptors, so no getter runs to decide it.
 * @param {UnifiedWrapper} wrapper - The node's wrapper.
 * @param {PropertyKey} prop - The member read.
 * @returns {boolean} Whether the value holds it.
 * @private
 *
 * @example
 * // m/failure.mjs: export default new RangeError("bad");
 * api.m.failure.name; // "RangeError"
 */
function valueHoldsName(wrapper, prop) {
	if (prop !== "name" && prop !== "length") return false;
	const impl = wrapper.____slothletInternal.impl;
	if (impl === null || typeof impl !== "object" || Arrays.isArray(impl) || util.types.isProxy(impl)) return false;
	if (typeof Reflect.getOwnPropertyDescriptor(impl, "default")?.value === "function") return false;
	for (let holder = impl, depth = 0; holder !== null && holder !== Objects.prototype && depth < 64; depth++) {
		if (hasOwn(holder, prop)) return true;
		holder = Reflect.getPrototypeOf(holder);
	}
	return false;
}

/**
 * Whether a read of `prop` off a node is of its function's own `name` or `length`, which every function has and
 * which consoles and formatters read of every function they show: such a read is answered without a permission check,
 * as plain JS answers it. A member the module provides by that name (an export, a folder entry, a value that holds
 * one) is the module's data, and stays held to the rules.
 * @param {object} wrapper - The node's wrapper.
 * @param {PropertyKey} prop - The member read.
 * @returns {boolean} True for the function's own `name` or `length`.
 * @private
 *
 * @example
 * // math.mjs: export function add(a, b) {}
 * isBuiltinFunctionMember(addWrapper, "length"); // true: read without a check
 */
function isBuiltinFunctionMember(wrapper, prop) {
	if (prop !== "name" && prop !== "length") return false;
	const internal = wrapper.____slothletInternal;
	if (hasOwnMember(wrapper, prop) || valueHoldsName(wrapper, prop)) return false;
	const fn = functionOf(internal.impl);
	// A module's own Proxy answers for itself, so what it holds there is not taken to be the language's. A composition
	// layer (a callable mount's function with the folder's members) is slothlet's, and answers as its function does.
	if (fn !== null) {
		if (util.types.isProxy(fn) && !isCompositionLayer(fn)) return false;
		return isLanguageNameDescriptor(prop, Reflect.getOwnPropertyDescriptor(fn, prop));
	}
	// A node holding no function that is still a function to the language (a lazy node's stand-in) answers the
	// stand-in's `name` and `length`: its path's last segment, and 0.
	return typeof internal.proxy === "function";
}

/**
 * Whether a member holding the module's code is withheld from whoever describes it (see
 * {@link enforceCodeMember}): a description is not a read that fails, so the member is left out, as the read
 * gate leaves out data it denies.
 * @param {object} wrapper - The node's wrapper.
 * @param {PropertyDescriptor|undefined} descriptor - The member's descriptor.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making.
 * @returns {boolean} True when the description must be withheld.
 * @private
 */
function isCodeMemberWithheld(wrapper, descriptor, kept = null) {
	if (!descriptor || !("value" in descriptor)) return false;
	try {
		enforceCodeMember(wrapper, descriptor.value, kept);
		return false;
	} catch {
		// Denied, or the check could not be completed: either way the member is not described (fail closed).
		return true;
	}
}

/**
 * Whether a node's prototype is the one its record holds (see {@link fillPrototype}): a function node, whose
 * function is the module's and is never changed through the node, and a namespace slothlet composed, which is no value
 * of a module's. Any other node fronts a value a module holds as it is (its own object, an array, an emitter, a class
 * instance, built-in data), and that value's prototype is the node's.
 * @param {object} wrapper - The node's wrapper.
 * @returns {boolean} True when the record's prototype is the node's.
 * @private
 */
function ownsPrototype(wrapper) {
	const internal = wrapper.____slothletInternal;
	const impl = internal.impl;
	// Answered once for the value, and again when what the node knows of where its value came from has changed.
	const known = internal.prototypeOwner;
	if (
		known !== undefined &&
		known.impl === impl &&
		known.sourceValue === internal.sourceValue &&
		known.moduleObject === internal.moduleObject &&
		known.deferChildAdopt === internal.deferChildAdopt
	)
		return known.owns;
	let owns;
	if (typeof impl === "function") owns = !util.types.isProxy(impl) || isCompositionLayer(impl);
	else if (impl === null || typeof impl !== "object" || internal.deferChildAdopt) owns = false;
	else if (hasOwn(internal, "sourceValue") && internal.sourceValue === impl) owns = false;
	else if (Arrays.isArray(impl) || util.types.isProxy(impl) || moduleObjectOf(wrapper) !== null) owns = false;
	else owns = !holdsDataKind(impl) && !(EventEmitter && inherits(impl, EventEmitter));
	internal.prototypeOwner = {
		impl,
		sourceValue: internal.sourceValue,
		moduleObject: internal.moduleObject,
		deferChildAdopt: internal.deferChildAdopt,
		owns
	};
	return owns;
}

/**
 * The prototype a member a node's value does not hold itself is read from, when the node's prototype is its record's
 * (see {@link ownsPrototype}): `undefined` for a member the value holds and for any other node, whose value
 * answers for what it inherits.
 * @param {object} wrapper - The node's wrapper.
 * @param {PropertyKey} prop - The member's key.
 * @returns {object|Function|null|undefined} The prototype, `null` when the node has none, or `undefined`.
 * @private
 */
function nodeInherits(wrapper, prop) {
	if (!ownsPrototype(wrapper) || hasOwn(wrapper.____slothletInternal.impl, prop)) return undefined;
	return recordedPrototype(wrapper);
}

/**
 * Whether a node's value holds or inherits a member, as `in` asks it: from the prototype on the node's record when that
 * is the node's (see {@link ownsPrototype}).
 * @param {object} wrapper - The node's wrapper.
 * @param {object|Function} impl - The node's value.
 * @param {PropertyKey} prop - The member's key.
 * @returns {boolean} Whether it does.
 * @private
 */
function implHas(wrapper, impl, prop) {
	const prototype = nodeInherits(wrapper, prop);
	if (prototype === undefined) return prop in impl;
	return prototype !== null && Reflect.has(prototype, prop);
}

/**
 * The nodes a node made for members its value inherits, by key, each with the value it was made for (#913). Such a node
 * is never kept as a member of the node's own, which would list it and keep it after the prototype changed; it is kept
 * here so the same inherited member reads as the same node each time, as the same function does in plain JavaScript.
 * @type {WeakMap<object, Map<PropertyKey, {value: *, node: *}>>}
 * @private
 */
const INHERITED_MEMBER_NODES = new WeakMap();

/** An empty map, read when a node has made no node for an inherited member. @type {Map} @private */
const EMPTY_INHERITED_NODES = new Map();

/**
 * The language's own objects — every global constructor and its prototype, and the prototypes of functions,
 * generators and iterators — which hold none of a module's code and are handed through as they are.
 * @type {WeakSet<object>}
 * @private
 */
const INTRINSICS = (() => {
	const intrinsics = new WeakSet();
	const add = (value) => {
		if (value !== null && (typeof value === "object" || typeof value === "function")) WeakSetMethods.add(intrinsics, value);
	};
	// Descriptors only: a global accessor (Node's lazily created globals) is never run to find its value.
	for (let ofIndex = 0, ofList = Reflect.ownKeys(globalThis); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		const value = Reflect.getOwnPropertyDescriptor(globalThis, key)?.value;
		if (typeof value !== "function") continue;
		add(value);
		add(Reflect.getOwnPropertyDescriptor(value, "prototype")?.value);
	}
	/** Add every prototype above a sample, up to `Object.prototype`. */
	const addChain = (sample) => {
		for (let link = Objects.getPrototypeOf(sample); link !== null; link = Objects.getPrototypeOf(link)) add(link);
	};
	const samples = [function* () {}, async function* () {}, async function () {}];
	for (let ofIndex = 0, ofList = samples; ofIndex < ofList.length; ofIndex++) {
		const sample = ofList[ofIndex];
		addChain(sample);
		addChain(sample.prototype ?? sample);
	}
	for (
		let ofIndex = 0, ofList = [[][Symbol.iterator](), new Map()[Symbol.iterator](), new Set()[Symbol.iterator](), ""[Symbol.iterator]()];
		ofIndex < ofList.length;
		ofIndex++
	) {
		const iterator = ofList[ofIndex];
		addChain(iterator);
	}
	addChain(Uint8Array);
	// Above `Uint8Array.prototype`: `%TypedArray%.prototype` and what it inherits, as they were when slothlet loaded.
	add(TypedArrayPrototype);
	addChain(TypedArrayPrototype);
	return intrinsics;
})();

/**
 * Whether a function read from `holder` is a method of a native binding (#708): the engine's native code, held by the
 * prototype of a native class that is none of the language's (a socket's `TCP` handle, a hash's handle, a native
 * addon's object), as its own class's `prototype`, and not that class itself. Such a method works on its receiver's internal state, so it works
 * only on the native object itself, and runs none of a module's code on it. The language's own methods are held by its
 * own prototypes, and its hidden ones (an iterator's `next`) by prototypes without a class of their own.
 * @param {Function} fn - A function that is not a Proxy.
 * @param {object|null} holder - The object holding it as an own member.
 * @returns {boolean} True for a binding's method.
 * @private
 */
function isBindingMethod(fn, holder) {
	if (holder === null || typeof holder !== "object" || WeakSetMethods.has(INTRINSICS, holder) || util.types.isProxy(holder)) return false;
	if (!isBuiltinFunction(fn)) return false;
	const constructor = Reflect.getOwnPropertyDescriptor(holder, "constructor")?.value;
	return (
		typeof constructor === "function" &&
		constructor !== fn &&
		!util.types.isProxy(constructor) &&
		!WeakSetMethods.has(INTRINSICS, constructor) &&
		isBuiltinFunction(constructor) &&
		Reflect.getOwnPropertyDescriptor(constructor, "prototype")?.value === holder
	);
}

/**
 * The prototypes of Node's data classes (`URL`, `Blob`, `TextDecoder` …) and of what Node keeps inside the objects
 * {@link recordNodeObjectPrototypes} samples (a key's native `KeyObjectHandle` on Node 22): data of Node's whose
 * every behaviour is on its prototype. Only an object of
 * one of these is plain data for its prototype being Node's; another built-in's instance (a `vm.Script`) can hold a
 * module's code in a slot no member shows.
 * @type {WeakSet<object>}
 * @private
 */
const NODE_DATA_PROTOTYPES = new WeakSet();

/**
 * The prototypes of objects Node makes that its built-ins do not export (a secret key's `SecretKeyObject`, a
 * `CryptoKey`'s own class, a `MessagePort`'s event target), recorded as made by no module like the built-ins' exports
 * (#597), so such an object a module hands on is handed out as it is, and Node, which checks what kind of object it
 * is given, still takes it. Read from one sample of each, made before any module's code runs.
 * @returns {void}
 * @private
 */
function recordNodeObjectPrototypes() {
	const crypto = Processes.getBuiltinModule("node:crypto");
	const samples = [crypto.createSecretKey(new Uint8Array(16))];
	const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
	listPush(samples, publicKey, privateKey);
	if (typeof samples[0].toCryptoKey === "function")
		listPush(samples, samples[0].toCryptoKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign"]));
	if (typeof MessageChannel === "function") {
		const channel = new MessageChannel();
		listPush(samples, channel.port1);
		channel.port1.close();
		channel.port2.close();
	}
	// Node's data classes: what they do is on their prototypes, what they hold is data, none holds code of its own.
	const util = Processes.getBuiltinModule("node:util");
	const net = Processes.getBuiltinModule("node:net");
	const data = [new URL("https://localhost/"), new URLSearchParams(), new TextDecoder(), new TextEncoder()];
	if (typeof Blob === "function") listPush(data, new Blob([]));
	if (typeof util.MIMEType === "function") listPush(data, new util.MIMEType("text/plain"));
	if (typeof net.SocketAddress === "function") listPush(data, new net.SocketAddress());
	// What a sample holds is Node's too: on older Node lines (22) a key keeps its native handle (`KeyObjectHandle`) in an own
	// symbol property, and a `CryptoKey` keeps its `KeyObject` there.
	const held = [];
	for (let ofIndex = 0, ofList = concatLists(samples, data); ofIndex < ofList.length; ofIndex++) {
		const sample = ofList[ofIndex];
		for (let ofIndex = 0, ofList = Reflect.ownKeys(sample); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			const member = Reflect.getOwnPropertyDescriptor(sample, key)?.value;
			if (member !== null && typeof member === "object") listPush(held, member);
		}
	}
	const isData = setFrom(concatLists(data, held));
	for (let ofIndex = 0, ofList = concatLists(samples, data, held); ofIndex < ofList.length; ofIndex++) {
		const sample = ofList[ofIndex];
		for (
			let link = Objects.getPrototypeOf(sample);
			link !== null && !WeakSetMethods.has(INTRINSICS, link);
			link = Objects.getPrototypeOf(link)
		) {
			recordSharedExports(link);
			if (SetMethods.has(isData, sample)) WeakSetMethods.add(NODE_DATA_PROTOTYPES, link);
		}
	}
}

if (isNode) recordNodeObjectPrototypes();

/**
 * The prototypes of the state Node keeps on the streams it makes (a stream's `ReadableState` and `WritableState`, a
 * socket's `TCP` handle and idle `Timeout`, a zlib stream's or a hash's native handle), read from streams made before any module's code runs (#708).
 * Like an emitter's listener table, that state holds Node's own closures and the callbacks handed to the stream (a
 * `write` callback, a pipe destination), so it is not read for code (see {@link slotHoldsCode}). With
 * `permissions.caller.provenance` on (the default) such a callback, or a module's function planted there, still runs as the
 * module whose file it is in; with it off, it runs with the permissions of whichever call runs it.
 * @type {WeakSet<object>}
 * @private
 */
const NODE_STREAM_STATE_PROTOTYPES = new WeakSet();

/**
 * Record {@link NODE_STREAM_STATE_PROTOTYPES} from one sample of each of Node's stream kinds, crypto's among them. The socket gets its
 * handle from `connect()`, which makes it at once and connects on a later tick; destroyed straight away, it never
 * connects.
 * @returns {void}
 * @private
 */
function recordNodeStreamState() {
	const stream = Processes.getBuiltinModule("node:stream");
	const zlib = Processes.getBuiltinModule("node:zlib");
	const net = Processes.getBuiltinModule("node:net");
	const crypto = Processes.getBuiltinModule("node:crypto");
	const gzip = zlib.createGzip();
	const socket = new net.Socket();
	socket.on("error", () => {});
	socket.connect({ port: 9, host: "127.0.0.1" });
	// Its idle timer: the `Timeout` a socket keeps once `setTimeout()` is called on it.
	socket.setTimeout(60000);
	const secret = new Uint8Array(16);
	const samples = [
		new stream.Readable(),
		new stream.Writable(),
		new stream.Duplex(),
		new stream.PassThrough(),
		gzip,
		socket,
		crypto.createHash("sha256"),
		crypto.createHmac("sha256", secret),
		crypto.createCipheriv("aes-128-cbc", secret, secret),
		crypto.createDecipheriv("aes-128-cbc", secret, secret),
		crypto.createSign("sha256"),
		crypto.createVerify("sha256")
	];
	for (let ofIndex = 0, ofList = samples; ofIndex < ofList.length; ofIndex++) {
		const sample = ofList[ofIndex];
		for (let ofIndex = 0, ofList = Reflect.ownKeys(sample); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (key === "_events") continue;
			const member = Reflect.getOwnPropertyDescriptor(sample, key)?.value;
			if (member === null || typeof member !== "object" || util.types.isProxy(member)) continue;
			const prototype = Objects.getPrototypeOf(member);
			if (prototype !== null && !WeakSetMethods.has(INTRINSICS, prototype)) WeakSetMethods.add(NODE_STREAM_STATE_PROTOTYPES, prototype);
		}
	}
	socket.destroy();
	gzip.close();
}

if (isNode) recordNodeStreamState();

/**
 * Whether a value is made by no module (#597) and can be handed out as it is: a built-in's export or slothlet's
 * runtime. A package's export is not: anyone can put code under `node_modules`, a plugin shipping its own dependency
 * among them, so it is handed out as the module's like the module's own code. Everything callable the value reaches,
 * as {@link holdsOnlySharedCode} reads it, has to be made by no module too: a function a module put on it
 * after it loaded (`EventEmitter.helper = …`) keeps it a stand-in.
 * @param {*} value - The value.
 * @returns {boolean} True when it is made by no module and holds no module's code.
 * @private
 */
function isSharedValue(value) {
	/**
	 * Whether every function a value reaches — through own members, accessors and prototypes, everything up to
	 * {@link SHARED_SEARCH_PROPERTIES} properties — is made by no module, the engine's own, or slothlet's: so handing the
	 * value out as it is hands out none of a module's code, however deep a module put one. Read by descriptor; nothing of
	 * the value runs. The realm's intrinsics end the walk. A Proxy, or what is too large to read, counts as holding code.
	 * @param {*} value - The value.
	 * @param {{remaining: number}} budget - Properties still allowed.
	 * @param {Set<object>} seen - Values already read.
	 * @returns {boolean} True when it holds only such code.
	 * @private
	 */
	function holdsOnlySharedCode(value, budget, seen) {
		const pending = [value];
		try {
			while (pending.length) {
				const member = ArrayMethods.pop(pending);
				if (member === null || (typeof member !== "object" && typeof member !== "function") || SetMethods.has(seen, member)) continue;
				SetMethods.add(seen, member);
				if (WeakSetMethods.has(INTRINSICS, member) || isSlothletValue(member)) continue;
				if (util.types.isProxy(member)) return false;
				if (typeof member === "function" && !isBuiltinFunction(member) && !isSharedExport(member)) return false;
				const keys = Reflect.ownKeys(member);
				budget.remaining -= keys.length;
				if (budget.remaining < 0) return false;
				for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					const descriptor = Reflect.getOwnPropertyDescriptor(member, key);
					if (!descriptor) continue;
					if ("value" in descriptor) listPush(pending, descriptor.value);
					else listPush(pending, descriptor.get, descriptor.set);
				}
				listPush(pending, Reflect.getPrototypeOf(member));
			}
			return true;
		} catch {
			// A value that refuses to be described is taken to hold code.
			return false;
		}
	}

	if (!isSharedExport(value)) return false;
	return holdsOnlySharedCode(value, { remaining: SHARED_SEARCH_PROPERTIES }, new Set());
}

/**
 * How many own properties, across everything a value made by no module reaches, are read before it is taken to hold a
 * module's code (see {@link holdsOnlySharedCode}).
 * @type {number}
 * @private
 */
const SHARED_SEARCH_PROPERTIES = 20000;

/**
 * Whether a value is one slothlet hands out on its own account, already attributed: an api node, a per-reader view,
 * a stand-in, an inbound view, a class-instance wrapper, or another Proxy of slothlet's own (a context view).
 * @param {object|Function} value - The value.
 * @returns {boolean} True for slothlet's own value.
 * @private
 */
function isSlothletValue(value) {
	return (
		isRegisteredProxy(value) ||
		WeakSetMethods.has(capturedViewSet, value) ||
		WeakMapMethods.has(STAND_IN_RECORDS, value) ||
		WeakMapMethods.has(INBOUND_VIEWS, value) ||
		WeakSetMethods.has(trustedRootOwn.genuineWrappers, value) ||
		isSlothletProxy(value) ||
		runtime_isWrappedClassInstance(value) ||
		WeakMapMethods.has(CROSSINGS, value)
	);
}

/**
 * Whether a value is the stand-in slothlet hands a module's Proxy or object holding code out as (see
 * {@link membrane}), directly or behind a composition layer: its traps run the module's code.
 * @param {object} value - A Proxy.
 * @returns {boolean} True for such a stand-in.
 * @private
 */
function isModuleStandIn(value) {
	const underlying = isCompositionLayer(value) ? layerUnderlying(value) : value;
	return util.types.isProxy(underlying) && (WeakMapMethods.has(STAND_IN_RECORDS, underlying) || runtime_isWrappedClassInstance(underlying));
}

/**
 * Whether a value is a Proxy of a module's own, whose traps are that module's code: not one of slothlet's (an api
 * node, a per-reader view, a stand-in, a version dispatcher, a class-instance wrapper), and for a composition layer,
 * one whose underlying value is such a Proxy. Nothing of the value runs.
 * @param {*} value - The value.
 * @returns {boolean} True for a module's own Proxy.
 * @private
 */
function isModuleProxy(value) {
	if (value === null || (typeof value !== "object" && typeof value !== "function") || !util.types.isProxy(value)) return false;
	if (isSlothletValue(value) || isFrameworkInternal(value)) return false;
	if (isCompositionLayer(value)) return isModuleProxy(layerUnderlying(value));
	return true;
}

/**
 * Whether a function is one of the engine's own (a builtin), which runs none of a module's code. Decided from
 * `Function.prototype.toString` alone, so nothing of the function runs: a builtin reports itself as native code
 * under its own non-empty name (`function push() { [native code] }`), while a bound function — a module's function
 * behind it — reports native code with no name, whatever its `name` property was set to.
 * @param {Function} fn - A function that is not a Proxy.
 * @returns {boolean} True for a builtin.
 * @private
 */
function isBuiltinFunction(fn) {
	// This copy's wrapper of `Function.prototype.toString` (see helpers/function-source-context) stands in for the
	// engine's own while an instance is up, and runs none of a module's code. It is told by identity, never by its text.
	if (isFunctionSourcePatch(fn)) return true;
	return RegExpMethods.exec(/^function\s+(?:get\s+|set\s+)?[^\s(][^(]*\(\)\s*\{\s*\[native code\]\s*\}\s*$/, functionSource(fn)) !== null;
}

/**
 * What a serialization leaves out: a member whose value JSON writes nothing for, or one the reader is refused.
 * @type {symbol}
 * @private
 */
const SNAPSHOT_OMIT = Symbol("slothlet.snapshotOmit");

/**
 * Whether an error is a refusal by the permission system.
 * @param {*} error - What was thrown.
 * @returns {boolean} True for `PERMISSION_DENIED`.
 * @private
 */
function isRefusal(error) {
	return error instanceof SlothletError && error.code === "PERMISSION_DENIED";
}

/**
 * Objects whose behaviour lives in internal slots a Proxy cannot carry (a `Map`, a `Date`, a `Buffer`, a
 * `Promise`, a key …), or that keep their context on their own (an `EventEmitter`, an `EventTarget`): handed through
 * as they are while they carry none of a module's code (see {@link slotHoldsCode}).
 * @param {object} value - An object that is not a Proxy.
 * @returns {boolean} True for such an object.
 * @private
 */
function isSlotObject(value) {
	const types = util.types;
	return (
		types.isMap(value) ||
		types.isSet(value) ||
		types.isWeakMap(value) ||
		types.isWeakSet(value) ||
		types.isDate(value) ||
		types.isRegExp(value) ||
		types.isPromise(value) ||
		types.isAnyArrayBuffer(value) ||
		types.isArrayBufferView(value) ||
		types.isBoxedPrimitive(value) ||
		types.isNativeError(value) ||
		types.isMapIterator(value) ||
		types.isSetIterator(value) ||
		types.isKeyObject(value) ||
		types.isCryptoKey(value) ||
		isWeakRef(value) ||
		(typeof EventTarget === "function" && inherits(value, EventTarget)) ||
		Boolean(EventEmitter && inherits(value, EventEmitter))
	);
}

/**
 * The language's own symbols (`Symbol.iterator`, `Symbol.toPrimitive` …), which the language itself calls.
 * @type {Set<symbol>}
 * @private
 */
const WELL_KNOWN_SYMBOLS = setFrom(
	filterList(
		mapList(Reflect.ownKeys(Symbol), (key) => Symbol[key]),
		(value) => typeof value === "symbol"
	)
);

/**
 * The prototypes of the language's own iterators whose `next` steps through state held in an internal slot of the
 * iterator, taken before any module's code runs: an array's iterator (`values()`, `keys()`, `entries()`, and an
 * array's `Symbol.iterator`), the one `matchAll` returns, an iterator helper, the wrapper `Iterator.from` returns, and
 * an `Intl.Segmenter`'s. A `Map`'s and a `Set`'s iterators are told by `util.types` (see isSlotObject).
 * @type {Set<object>}
 * @private
 */
const NATIVE_ITERATOR_PROTOTYPES = (() => {
	const prototypes = new Set();
	const samples = [
		() => [][Symbol.iterator](),
		() => /a/g[Symbol.matchAll](""),
		() => Reflect.apply(PrototypeFunctions.Iterator.map, ArrayMethods.values([]), [(value) => value]),
		() => Iterators.from({ next: () => ({ done: true, value: undefined }) }),
		() => new Intl.Segmenter().segment("")[Symbol.iterator]()
	];
	for (let ofIndex = 0, ofList = samples; ofIndex < ofList.length; ofIndex++) {
		const sample = ofList[ofIndex];
		try {
			const prototype = Reflect.getPrototypeOf(sample());
			if (prototype !== null) SetMethods.add(prototypes, prototype);
		} catch {
			// An engine without the iterator (no iterator helpers, no `Intl`) has no such prototype.
		}
	}
	return prototypes;
})();

/**
 * Whether an object is one of the language's own iterators listed in {@link NATIVE_ITERATOR_PROTOTYPES}: its methods
 * work only on the iterator itself, and what it has left cannot be read without stepping it.
 * @param {object} value - An object that is not a Proxy.
 * @returns {boolean} True for such an iterator.
 * @private
 */
function isNativeIterator(value) {
	return SetMethods.has(NATIVE_ITERATOR_PROTOTYPES, Reflect.getPrototypeOf(value));
}

/**
 * Node's `vm.Script`, taken before any module's code runs: a script's code is held in a slot of its own, so a module's
 * script runs as that module (see membrane).
 * @type {Function|null}
 * @private
 */
const VM_SCRIPT = isNode ? Processes.getBuiltinModule("node:vm").Script : null;

/**
 * The native class `vm.Script` extends, whose instances hold compiled code the same way (#708): one made directly is a
 * script too, its native `runInContext` the module's code, never a binding's method run on the object as it is.
 * @type {Function|null}
 * @private
 */
const VM_NATIVE_SCRIPT = (() => {
	const parent = VM_SCRIPT === null ? null : Objects.getPrototypeOf(VM_SCRIPT);
	return typeof parent === "function" && parent !== Functions.prototype ? parent : null;
})();

/**
 * Whether an object with internal slots (see {@link isSlotObject}) carries a module's code (#597): a class of
 * a module's anywhere in its prototype chain (a `Map` subclass, an `Error` subclass, a key given another prototype) —
 * every prototype below the language's own has to be one made by no module, holding none of a module's code — or a
 * function, accessor or object holding code among its own members, or among the entries of a `Map` or `Set`. What
 * cannot be read without running it — what a promise settles to, the target of a `WeakRef`, the values of a `WeakMap`,
 * what an iterator has left — is taken to hold code. An emitter's listener table, and the internals an event target keeps under symbols of its
 * own, hold the listeners registered on it, which run as whoever registered them, and are not read.
 * @param {object} value - An object with internal slots, not a Proxy.
 * @param {number} depth - Levels still allowed, this one included.
 * @param {{remaining: number}} budget - Properties still allowed.
 * @returns {boolean} True when it carries a module's code.
 * @private
 */
function slotHoldsCode(value, depth, budget) {
	/**
	 * Whether a member of an emitter of Node's own class is state Node keeps for it (see
	 * {@link NODE_STREAM_STATE_PROTOTYPES}), which is not read for code (#708).
	 * @param {*} member - The member's value.
	 * @returns {boolean} True for Node's state of a stream.
	 * @private
	 */
	function isNodeStreamState(member) {
		if (member === null || typeof member !== "object" || util.types.isProxy(member)) return false;
		return WeakSetMethods.has(NODE_STREAM_STATE_PROTOTYPES, Reflect.getPrototypeOf(member));
	}

	for (
		let link = Reflect.getPrototypeOf(value);
		link !== null && !WeakSetMethods.has(INTRINSICS, link);
		link = Reflect.getPrototypeOf(link)
	) {
		if (util.types.isProxy(link) || !isSharedValue(link)) return true;
	}
	const types = util.types;
	if (types.isPromise(value) || types.isWeakMap(value) || types.isMapIterator(value) || types.isSetIterator(value)) return true;
	if (isWeakRef(value)) return true;
	if (types.isMap(value) || types.isSet(value)) {
		// Read with the forEach taken at load: the map or set itself, not its iterator.
		const entries = types.isMap(value) ? mapEntriesToArray(value) : setToArray(value);
		for (let i = 0; i < entries.length; i++) {
			budget.remaining -= 1;
			if (budget.remaining < 0) return true;
			const members = types.isMap(value) ? entries[i] : [entries[i]];
			for (let m = 0; m < members.length; m++) if (memberHoldsCode(members[m], depth, budget)) return true;
		}
	}
	const isEmitter = Boolean(EventEmitter && inherits(value, EventEmitter));
	const isTarget = typeof EventTarget === "function" && inherits(value, EventTarget);
	const keys = Reflect.ownKeys(value);
	budget.remaining -= keys.length;
	if (budget.remaining < 0) return true;
	for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (isEmitter && key === "_events") continue;
		if (isTarget && typeof key === "symbol" && Symbols.keyFor(key) === undefined && !SetMethods.has(WELL_KNOWN_SYMBOLS, key)) continue;
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (!descriptor) continue;
		if (!("value" in descriptor)) {
			// An error's `stack` accessor is the engine's, which names no function.
			for (let ofIndex = 0, ofList = [descriptor.get, descriptor.set]; ofIndex < ofList.length; ofIndex++) {
				const half = ofList[ofIndex];
				if (typeof half === "function" && !isBuiltinFunction(half) && !(key === "stack" && isEngineStackAccessor(half))) return true;
			}
			continue;
		}
		if (isEmitter && isNodeStreamState(descriptor.value)) continue;
		if (memberHoldsCode(descriptor.value, depth, budget)) return true;
	}
	return false;
}

/**
 * Whether an object can hold code of the module that made it — a function, an accessor, a Proxy, a generator, a
 * prototype of its own (a class instance, `Object.create(proto)`) — anywhere within the code search ({@link searchDepth}). Plain data
 * (primitives, the language's own objects, slothlet's own values, values made by no module) holds none. Decided from
 * descriptors, so nothing of the object runs.
 * @param {object} value - An object that is not a Proxy.
 * @param {number} depth - Levels still allowed, this one included.
 * @param {{remaining: number}} budget - Properties still allowed.
 * @returns {boolean} True when it can hold code.
 * @private
 */
function holdsCode(value, depth, budget) {
	/**
	 * Whether an object with the prototype of plain data (or none, or another of the language's own), not an array, may
	 * keep internal state of the engine's that holds a module's code where no member shows it: one of the language's
	 * iterators (an array's, a string's, an iterator helper, the wrapper `Iterator.from` makes) given such a prototype
	 * yields what it holds only when stepped, and no check of what kind of object it is runs without stepping it. A copy
	 * with `structuredClone` tells it, refusing such an object before it reads any member; the copy is made only where it
	 * runs none of a module's code and can be refused for nothing else ({@link copyRunsNoCode}). An object it
	 * cannot be made for, or that the copy refuses, cannot be told from such an iterator and is taken to keep such state.
	 * Objects found ordinary are remembered ({@link ORDINARY_OBJECTS}).
	 * @param {object} value - The object, not a Proxy and not an array.
	 * @param {number} depth - Levels still allowed, this one included.
	 * @returns {boolean} True when it may keep such state.
	 * @private
	 */
	function keepsHiddenState(value, depth) {
		/**
		 * Whether copying a value with `structuredClone` runs none of a module's code and can be refused only for what kind of
		 * object something in it is: every member the copy reads (each enumerable own string-keyed member, at every depth) is a
		 * data property holding a primitive other than a symbol, an array or an object with the prototype of plain data (or
		 * none), a date, a regular expression, a buffer, a typed array, a boxed primitive other than a symbol, or a `Map` or
		 * `Set` whose entries are such values. Read from descriptors alone; members the copy skips (symbol keys, members that
		 * are not enumerable) are not looked at.
		 * @param {*} value - The value.
		 * @param {number} depth - Levels still allowed, this one included.
		 * @returns {boolean} True when it is.
		 * @private
		 */
		function copyRunsNoCode(value, depth) {
			/**
			 * Whether copying an error of the language's own with `structuredClone` runs none of a module's code: the copy reads
			 * its own `message` (a string), its `name` (a data property on it or up its chain), its `stack` (the engine's getter,
			 * whose formatting {@link keepsHiddenState} holds, or a data property) and its own `cause` (a value whose copy
			 * runs no code either). Other members of its own, `errors` of an `AggregateError` among them, are not copied.
			 * @param {Error} error - The error ({@link isEngineError}).
			 * @param {number} depth - Levels still allowed, this one included.
			 * @returns {boolean} True when it does.
			 * @private
			 */
			function errorCopyRunsNoCode(error, depth) {
				const message = Reflect.getOwnPropertyDescriptor(error, "message");
				if (message !== undefined && (!("value" in message) || typeof message.value !== "string")) return false;
				const cause = Reflect.getOwnPropertyDescriptor(error, "cause");
				if (cause !== undefined && (!("value" in cause) || !copyRunsNoCode(cause.value, depth - 1))) return false;
				let name = null;
				let stack = null;
				for (let link = error; link !== null && (name === null || stack === null); link = Reflect.getPrototypeOf(link)) {
					name ??= Reflect.getOwnPropertyDescriptor(link, "name") ?? null;
					stack ??= Reflect.getOwnPropertyDescriptor(link, "stack") ?? null;
				}
				if (name !== null && !("value" in name)) return false;
				return stack === null || "value" in stack || isEngineStackAccessor(stack.get);
			}

			/**
			 * Whether a value is an error of the language's own, told by the engine's brand check ({@link isBrandedError};
			 * where the engine has none, nothing is), with one of the language's own error
			 * prototypes. A look-alike (an object of another kind given an error's prototype, or posing as one by its members)
			 * is not, and neither is an error whose prototype was replaced.
			 * @param {object} value - An object that is not a Proxy.
			 * @returns {boolean} True for such an error.
			 * @private
			 */
			function isEngineError(value) {
				if (!isNode && typeof Errors.isError !== "function") return false;
				return isBrandedError(value) && SetMethods.has(ERROR_PROTOTYPES, Reflect.getPrototypeOf(value));
			}

			/**
			 * Whether a boxed primitive is a boxed symbol, which `structuredClone` refuses.
			 * @param {object} value - A boxed primitive.
			 * @returns {boolean} True for a boxed symbol.
			 * @private
			 */
			function isBoxedSymbol(value) {
				try {
					Reflect.apply(SYMBOL_VALUE_OF, value, []);
					return true;
				} catch {
					return false;
				}
			}

			if (value === null || typeof value !== "object") return typeof value !== "symbol" && typeof value !== "function";
			if (depth <= 0 || util.types.isProxy(value)) return false;
			const types = util.types;
			if (types.isDate(value) || types.isRegExp(value) || types.isAnyArrayBuffer(value) || types.isArrayBufferView(value)) return true;
			if (types.isBoxedPrimitive(value)) return !isBoxedSymbol(value);
			// An error is copied from its `message`, `name`, `stack` and `cause`, whatever its prototype: one whose prototype is
			// not the language's own may hand the copy a getter of a module's to run.
			if (isEngineError(value)) return errorCopyRunsNoCode(value, depth);
			if (isBrandedError(value)) return false;
			if (types.isMap(value) || types.isSet(value)) {
				// Read with the forEach taken at load: the map or set itself, not its iterator.
				const entries = types.isMap(value) ? mapEntriesToArray(value) : setToArray(value);
				for (let i = 0; i < entries.length; i++) {
					const members = types.isMap(value) ? entries[i] : [entries[i]];
					for (let m = 0; m < members.length; m++) if (!copyRunsNoCode(members[m], depth - 1)) return false;
				}
				return true;
			}
			const prototype = Reflect.getPrototypeOf(value);
			if (!Arrays.isArray(value) && prototype !== null && prototype !== Objects.prototype) return false;
			for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				if (typeof key === "symbol") continue;
				const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
				if (!descriptor || !descriptor.enumerable) continue;
				if (!("value" in descriptor) || !copyRunsNoCode(descriptor.value, depth - 1)) return false;
			}
			return true;
		}

		if (WeakSetMethods.has(ORDINARY_OBJECTS, value)) return false;
		const types = util.types;
		if (types.isModuleNamespaceObject?.(value) || types.isArgumentsObject?.(value)) return false;
		if (typeof structuredClone !== "function") return true;
		// The copy reads the object's members as they are now; whatever it finds, it is the object's own kind that decides.
		const prototype = Reflect.getPrototypeOf(value);
		if (prototype !== null && prototype !== Objects.prototype) return true;
		for (let ofIndex = 0, ofList = Reflect.ownKeys(value); ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			if (typeof key === "symbol") continue;
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
			if (!descriptor || !descriptor.enumerable) continue;
			if (!("value" in descriptor) || !copyRunsNoCode(descriptor.value, depth - 1)) return true;
		}
		// An error's stack not read yet is not formatted for the copy: the copy stops there, past the check of the
		// object's own kind, and the stack is left to be formatted when it is first read.
		const copy = runUnformatted(() => structuredClone(value));
		if (!copy.held || (Objects.hasOwn(copy, "error") && !copy.unformatted)) return true;
		WeakSetMethods.add(ORDINARY_OBJECTS, value);
		return false;
	}

	if (depth <= 0) return true;
	try {
		if (util.types.isGeneratorObject(value)) return true;
		if (isSlotObject(value)) return slotHoldsCode(value, depth, budget);
		// What one of the language's own iterators has left cannot be read without stepping it.
		if (isNativeIterator(value)) return true;
		const prototype = Reflect.getPrototypeOf(value);
		// Node's own data (the `KeyObjectHandle` a key holds on Node 22) runs none of a module's code; its own members are
		// still read below.
		if (
			prototype !== null &&
			!WeakSetMethods.has(INTRINSICS, prototype) &&
			!(WeakSetMethods.has(NODE_DATA_PROTOTYPES, prototype) && isSharedValue(prototype))
		)
			return true;
		if (Arrays.isArray(value) && value.length > budget.remaining) return true;
		const keys = Reflect.ownKeys(value);
		budget.remaining -= keys.length;
		if (budget.remaining < 0) return true;
		for (let ofIndex = 0, ofList = keys; ofIndex < ofList.length; ofIndex++) {
			const key = ofList[ofIndex];
			const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
			if (!descriptor) continue;
			if (!("value" in descriptor)) {
				for (let ofIndex = 0, ofList = [descriptor.get, descriptor.set]; ofIndex < ofList.length; ofIndex++) {
					const half = ofList[ofIndex];
					if (typeof half === "function" && !isBuiltinFunction(half)) return true;
				}
				continue;
			}
			const member = descriptor.value;
			if (member === null || (typeof member !== "object" && typeof member !== "function")) continue;
			if (isSlothletValue(member) || WeakSetMethods.has(INTRINSICS, member) || isSharedValue(member)) continue;
			if (util.types.isProxy(member)) return true;
			if (typeof member === "function") {
				if (!isBuiltinFunction(member)) return true;
				continue;
			}
			if (holdsCode(member, depth - 1, budget)) return true;
		}
		// One of the language's own objects given the prototype of plain data (an array's iterator, an iterator helper)
		// keeps what it holds where no member shows it.
		if (!Arrays.isArray(value) && (prototype === null || WeakSetMethods.has(INTRINSICS, prototype)) && keepsHiddenState(value, depth))
			return true;
		return false;
	} catch {
		// An exotic object that refuses to be described is taken to hold code.
		return true;
	}
}

/**
 * Objects with the prototype of plain data (or none) that a copy showed to be ordinary objects: no internal state of the
 * engine's behind them. An object never gains such state, so the answer holds for as long as the object lives.
 * @type {WeakSet<object>}
 * @private
 */
const ORDINARY_OBJECTS = new WeakSet();

/**
 * The engine's own `PrototypeFunctions.Symbol.valueOf`, taken when slothlet loaded: it reads a boxed symbol's internal data and
 * throws for any other object.
 * @type {Function}
 * @private
 */
const SYMBOL_VALUE_OF = PrototypeFunctions.Symbol.valueOf;

/**
 * The prototypes of the language's own errors, taken when slothlet loaded.
 * @type {Set<object>}
 * @private
 */
const ERROR_PROTOTYPES = setFrom(
	mapList(
		filterList(
			[Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError, AggregateError],
			(constructor) => typeof constructor === "function"
		),
		(constructor) => constructor.prototype
	)
);

/**
 * Whether the engine's brand check tells a value to be an error, whatever its prototype: Node's `util.types`, or
 * `Error.isError` where the engine has it. Where it has neither, an object is taken to be one.
 * @param {object} value - An object that is not a Proxy.
 * @returns {boolean} True when it is, or cannot be told.
 * @private
 */
function isBrandedError(value) {
	if (isNode) return util.types.isNativeError(value);
	return typeof Errors.isError === "function" ? Errors.isError(value) : true;
}

/**
 * Whether an object, not a Proxy and not a function, is itself code a module made (#726): an object with a prototype
 * some module wrote — a class instance, `Object.create(proto)`, a subclass of `Map` — a class's own prototype, or a
 * compiled `vm.Script`, which holds code no member shows. Plain objects and arrays, and the language's and Node's own objects, are data, whatever
 * they hold: nothing in them is read. Only the prototype chain is, which runs none of the object's code.
 * @param {object} value - The object.
 * @returns {boolean} True when it is code.
 * @private
 */
function isCodeObject(value) {
	try {
		for (
			let link = Reflect.getPrototypeOf(value);
			link !== null && !WeakSetMethods.has(INTRINSICS, link);
			link = Reflect.getPrototypeOf(link)
		) {
			if (util.types.isProxy(link) || !isSharedValue(link)) return true;
		}
		// A class's own prototype (`C.prototype`, whose `constructor` is the class) holds the class's methods: it is the
		// class's code, read from its descriptors only.
		const constructor = Reflect.getOwnPropertyDescriptor(value, "constructor");
		if (
			constructor &&
			typeof constructor.value === "function" &&
			Reflect.getOwnPropertyDescriptor(constructor.value, "prototype")?.value === value
		)
			return !isSharedValue(value);
		return (VM_SCRIPT !== null && inherits(value, VM_SCRIPT)) || (VM_NATIVE_SCRIPT !== null && inherits(value, VM_NATIVE_SCRIPT));
	} catch {
		// A prototype chain that refuses to be read is taken to be code.
		return true;
	}
}

/**
 * Whether a value is one no module made (the language's own, a built-in's export, a node or a view of slothlet's): what
 * the host is handed of these comes from no module.
 * @param {object|Function} value - The value.
 * @returns {boolean} True for one.
 * @private
 */
function isShared(value) {
	if (WeakSetMethods.has(INTRINSICS, value) || isSharedValue(value)) return true;
	return !WeakMapMethods.has(STAND_IN_RECORDS, value) && isSlothletValue(value);
}

/**
 * Whether a value can carry a prototype of a module's to whoever it reaches, as plain data does (#667): a plain object,
 * an array, an object of no prototype, or an error. Never a Proxy (slothlet's own views are Proxies), whose traps would
 * run.
 * @param {object} value - An object.
 * @returns {boolean} True for such a value.
 * @private
 */
function isCarrier(value) {
	if (util.types.isProxy(value)) return false;
	if (Arrays.isArray(value)) return true;
	const prototype = Reflect.getPrototypeOf(value);
	return prototype === Objects.prototype || prototype === null || isErrorValue(value);
}

/**
 * Whether a value keeps its data where only the engine reads it: a built-in data object, an error, or a boxed primitive.
 * @param {object} value - An object.
 * @returns {boolean} True for one.
 * @private
 */
function holdsSlottedData(value) {
	return dataKind(value) !== null || isErrorValue(value) || isBoxedPrimitive(value);
}

/**
 * Whether `reader`'s module is the one a value was recorded as held as itself by.
 * @param {*} value - The value.
 * @param {object} reader - Who reads it.
 * @returns {boolean} True when it is.
 * @private
 */
function isOwnOrigin(value, reader) {
	const origin = WeakMapMethods.get(CROSSING_ORIGINS, value);
	if (origin === undefined || origin.slothlet !== reader?.slothlet || origin.module !== moduleKey(reader)) return false;
	// Modules of one id with a deny rule between them are not each other's.
	return asOneModule(origin.slothlet, origin.wrapper, reader);
}

/**
 * The engine's own `byteLength` and `length` of a typed array, taken when slothlet loaded.
 * @type {Function}
 * @private
 */
const TYPED_ARRAY_BYTE_LENGTH = PrototypeFunctions.TypedArray.byteLength;

const TYPED_ARRAY_LENGTH = PrototypeFunctions.TypedArray.length;

/**
 * Whether a value is the result the engine makes for one step of an iterator: a plain object holding `value` and
 * `done` as data and nothing else. Told from its descriptors, so nothing of anyone's runs.
 * @param {*} result - What a step returned.
 * @returns {boolean} True for such a result.
 * @private
 */
function isStepResult(result) {
	if (result === null || typeof result !== "object" || util.types.isProxy(result)) return false;
	if (Reflect.getPrototypeOf(result) !== Objects.prototype) return false;
	const keys = Reflect.ownKeys(result);
	if (keys.length !== 2 || keys[0] !== "value" || keys[1] !== "done") return false;
	const value = Reflect.getOwnPropertyDescriptor(result, "value");
	const done = Reflect.getOwnPropertyDescriptor(result, "done");
	return "value" in value && "value" in done && typeof done.value === "boolean";
}

/**
 * Whether a key of an array member is one of its members, read through a child wrapper: an index, or a key the
 * module put on the array itself. `length` and what the array inherits (its methods, `Symbol.iterator`) are the
 * array's own and are read from it directly.
 *
 * @param {Array<*>} array - The array member's impl.
 * @param {string|symbol} prop - The key.
 * @returns {boolean} True for an index, or a key the array or a prototype of its own holds, except `length`.
 * @private
 */
function isArrayMember(array, prop) {
	if (isArrayIndex(prop)) return true;
	// A composed node's layer may hold a named export that won the `length` slot, which the node then reads
	// and describes; otherwise `length` is the array's own.
	if (prop === "length") return isCompositionLayer(array) && ArrayMethods.includes(layerHeldKeys(array), "length");
	// A key the module put on the array, or on a prototype it gave the array: a member like an element. Only
	// `Array.prototype` and `Object.prototype` hold the intrinsics, and a prototype's own `constructor` is the
	// array's class, which the array reports as plain JS does.
	for (const holder of generatorSteps(prototypeChain(array))) {
		if (holder === Arrays.prototype || holder === Objects.prototype) break;
		if (hasOwn(holder, prop)) return holder === array || prop !== "constructor";
	}
	return false;
}

/**
 * True when reading `prop` off `wrapper` would be denied, so the key must be redacted from
 * enumeration and serialization rather than disclosed.
 *
 * Read gating exists so a terminal data value cannot be obtained past a deny rule. A gate on
 * `getTrap` alone is not sufficient: `Object.keys()` reaches keys through `ownKeys` /
 * `getOwnPropertyDescriptor` and `JSON.stringify()` reaches values through `toJSON`, none of
 * which perform a `[[Get]]`. Denied leaves are therefore filtered out of those paths — the
 * caller sees exactly what it is permitted to see, and a partially-permitted namespace stays
 * enumerable. Each redaction still emits `permission:denied`, so a denial is never silent.
 *
 * The value is read from a descriptor rather than by property access: only own *data*
 * properties are classified, so enumerating an object never invokes an accessor. The impl is
 * consulted first, then the wrapper itself — a materialized wrapper carries its leaves as own
 * properties and leaves the impl empty, so checking only one of the two misses every key on
 * whichever shape the wrapper happens to be in.
 *
 * @param {object} wrapper - Parent UnifiedWrapper being enumerated.
 * @param {string|symbol} prop - Property key being considered for disclosure.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making (see
 *   {@link resolveEnforcedCaller}).
 * @param {object|null} [access=null] - The access the read is part of (see {@link beginAccess}).
 * @param {boolean} [listing=false] - Whether the key is being listed (`ownKeys`): a getter is withheld from a listing
 *   too, while its description is still given.
 * @returns {boolean} True when the key must be withheld.
 * @private
 */
function isReadRedacted(wrapper, prop, kept = null, access = null, listing = false) {
	/**
	 * Whether `value` is a lazy node that has not loaded yet: a folder whose files are not read, so nothing is known of
	 * what it holds until it loads. A stand-in for a chain below one is not the node.
	 * @param {*} value - A member's value.
	 * @returns {boolean} True for such a node.
	 * @private
	 */
	function isUnloadedLazyNode(value) {
		if (value === null || (typeof value !== "object" && typeof value !== "function") || WeakMapMethods.has(WAITING_CHAINS, value))
			return false;
		const internal = resolveWrapper(value)?.____slothletInternal;
		return (
			!!internal && internal.mode === "lazy" && !internal.state.materialized && (internal.impl === null || internal.impl === undefined)
		);
	}

	/**
	 * Whether a member value is a module's own Proxy, or the stand-in slothlet hands one out as (#597), directly or as the
	 * value behind its node: reading through it runs the module's traps (#632).
	 * @param {*} value - The member's value.
	 * @returns {boolean} Whether it answers with the module's code.
	 * @private
	 */
	function answersWithModuleCode(value) {
		const inner = resolveWrapper(value);
		const held = inner ? inner.____slothletInternal.impl : value;
		return util.types.isProxy(held) && (isModuleProxy(held) || isModuleStandIn(held));
	}

	const pm = wrapper.slothlet.handlers?.permissionManager;
	if (!pm || !pm.isEnabled() || !pm.isReadGatingEnabled()) return false;
	// A function's own `name` and `length` are never withheld (see isBuiltinFunctionMember).
	if (isBuiltinFunctionMember(wrapper, prop)) return false;
	const impl = wrapper.____slothletInternal?.impl;
	// The non-object/function arm guards a wrapper whose impl is a primitive. Every wrapper the read
	// gate is consulted for is built over an object or a function — a primitive becomes a terminal value
	// and is gated at its parent instead — so the arm exists for a shape this path is not handed.
	/* v8 ignore next 2 */
	const desc =
		(impl && (typeof impl === "object" || typeof impl === "function") ? Objects.getOwnPropertyDescriptor(impl, prop) : undefined) ??
		Objects.getOwnPropertyDescriptor(wrapper, prop);
	if (!desc) return false;
	// A getter is listed only to a caller that may read its path (#747): what it answers is not known without running
	// it, and a read of it is refused to a caller the rules deny, so `Object.keys` and a spread leave it out as
	// `JSON.stringify` and `toJSON` do. Its description is still given, and running the getter it holds is refused.
	const isAccessor = listing && !("value" in desc) && typeof desc.get === "function";
	// A lazy folder that has not loaded holds nothing yet, and is no data: it is listed and described as the folder it
	// is once loaded, whatever the rules on its path say. What it holds is gated when it is read.
	if ("value" in desc && isUnloadedLazyNode(desc.value)) return false;
	const targetPath = memberPathOf(wrapper, prop);
	// An object member the rules leave the reader nothing of is listed no more than a value it may not read is.
	if (listing && "value" in desc && typeof prop === "string") {
		const member = unwrapLeafValue(desc.value);
		if (member !== null && typeof member === "object" && !isTerminalData(member)) {
			if (readsNothingBeneath(wrapper, targetPath, undefined, kept, access, member)) return true;
			// A module's own Proxy answers with the module's traps, so reading through it is a call of its node (#632): it
			// is listed only to a caller that may call its path, as a getter is (a rule level with the read and not the
			// call, such as `:write`, lists neither).
			return answersWithModuleCode(member) && !readGateDecision(wrapper, targetPath, undefined, kept, access, null, "call").allowed;
		}
	}
	if (!isAccessor && (!("value" in desc) || !isTerminalData(unwrapLeafValue(desc.value)))) return false;
	if (!readGateDecision(wrapper, targetPath, undefined, kept, access).allowed) return true;
	// Reading a getter runs it, which is a call of the module's code: it is listed only to a caller that may also call
	// its path, as running it is refused otherwise (a rule level with the read and not the call, such as `:write`).
	return isAccessor && !readGateDecision(wrapper, targetPath, undefined, kept, access, null, "call").allowed;
}

/**
 * Whether a node's impl is a primitive a node holding it answers in its place, as a file's primitive default export
 * is: a number, a string, a boolean, a bigint or a symbol.
 * @param {*} impl - The node's impl.
 * @returns {boolean} True for such a primitive.
 * @private
 */
function isHeldPrimitive(impl) {
	const kind = typeof impl;
	return kind === "string" || kind === "number" || kind === "boolean" || kind === "bigint" || kind === "symbol";
}

/**
 * Whether a node stands for a file whose module value is `null` or `undefined` (#792): it was built or loaded from such
 * a file, still holds nothing, and has no members of its own, so a read answers the value as the plain module's
 * `default` does. A node a later contribution gave members stays the node it is.
 * @param {object} wrapper - The node's wrapper.
 * @returns {boolean} True for such a node.
 * @private
 */
function holdsNullish(wrapper) {
	const internal = wrapper.____slothletInternal;
	if (!internal.nullish || internal.invalid || (internal.impl !== null && internal.impl !== undefined)) return false;
	for (let ofIndex = 0, ofList = Objects.keys(wrapper); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		if (!isFrameworkReservedKey(key)) return false;
	}
	return true;
}

/**
 * Whether a node answers a value in its place: a primitive it holds (see {@link isHeldPrimitive}), or a file's
 * `null` or `undefined` (see {@link holdsNullish}).
 * @param {object} wrapper - The node's wrapper.
 * @returns {boolean} True when a read of the node answers {@link heldValue}.
 * @private
 */
function holdsValue(wrapper) {
	return isHeldPrimitive(wrapper.____slothletInternal.impl) || holdsNullish(wrapper);
}

/**
 * The members a function node answers from its function rather than as api members (see the node's get trap), which
 * the api root answers the same way when its file's default export is a function.
 * @type {ReadonlySet<string>}
 * @private
 */
const ROOT_FUNCTION_ANSWERS = setFrom(["prototype", "toString", "name", "length"]);

/**
 * Whether a key of the api root is one its function answers itself (see {@link ROOT_FUNCTION_ANSWERS}): the root is a
 * function, and holds no api member by that name (a member the root's file exports under it is an ordinary member).
 * @param {object} slothlet - The instance.
 * @param {string|symbol} prop - The key.
 * @returns {boolean} True when it is.
 * @private
 */
function isRootFunctionAnswer(slothlet, prop) {
	if (typeof slothlet.api !== "function" || !SetMethods.has(ROOT_FUNCTION_ANSWERS, prop)) return false;
	return !Objects.getOwnPropertyDescriptor(slothlet.api, prop)?.enumerable;
}

/**
 * Whether the read being made is the host's own: a read the gate allows whatever the rules say, but for a
 * module-private member (see {@link readGateDecision}). The gate's answer for each member is then that one, and
 * the root's listing and descriptions take it without deciding the member by its rules.
 * @param {object} gate - The api root's stand-in for the gate (see {@link rootGate}).
 * @returns {boolean} True for the host.
 * @private
 */
function isHostRead(gate) {
	return resolveEnforcedCaller(gate, undefined).verdict === "allow";
}

/**
 * Unwrap a stored child value down to what a reader would ultimately receive.
 *
 * A materialized leaf may hold its terminal value behind a child UnifiedWrapper rather than
 * storing it raw — which of the two happens depends on mode and materialization state. The
 * gate must classify the underlying value either way, or the same export reads as terminal in
 * one mode and as a traversable namespace in another. A child *namespace* wrapper unwraps to
 * its object impl, which is correctly not terminal, so traversal stays ungated.
 *
 * @param {*} value - Stored child value.
 * @returns {*} The underlying value, with any wrapper layers removed.
 * @private
 */
function unwrapLeafValue(value) {
	let current = value;
	// Bounded: wrapper nesting is shallow, and the bound stops a cyclic impl from spinning.
	for (let depth = 0; depth < 8; depth++) {
		if (!current || (typeof current !== "object" && typeof current !== "function")) return current;
		// A wrapper is identified through the proxy registry, not `instanceof`: the proxy's
		// getPrototypeOf trap reports `null` for every non-array wrapper, so an instanceof check
		// silently misses them. `____slothletInternal` is likewise filtered on the proxy.
		// The hasOwn arm accepts a RAW (unproxied) wrapper. Everything reaching this walk came from the
		// registry, since wrappers are handed out only as proxies; the arm is a backstop for an internal
		// construction that has not been proxied yet.
		/* v8 ignore next */
		const inner = registeredWrapper(current) ?? (hasOwn(current, "____slothletInternal") ? current : null);
		if (!inner) return current;
		current = inner.____slothletInternal?.impl;
	}
	/* v8 ignore next — depth bound is a backstop; real wrapper chains never nest this deep. */
	return current;
}

/**
 * Whether a value of a module's data serializes through a `toJSON` of its own (own or inherited), which
 * `JSON.stringify` calls in place of reading its members. Slothlet's own nodes and the language's own data (a `Date`)
 * are not: a node serializes through its own `toJSON`, and data is read as a value.
 * @param {*} value - A member's value.
 * @returns {boolean} True when the value's own code gives its serialized form.
 * @private
 */
function serializesItself(value) {
	if (value === null || typeof value !== "object" || isTerminalData(value) || resolveWrapper(value) !== null) return false;
	return typeof value.toJSON === "function";
}

/**
 * Stand-in for a value that serializes through its own `toJSON`, in a snapshot handed to `JSON.stringify`: its
 * `toJSON` runs the value's own, as `JSON.stringify` would, and leaves out of what that gives each member the reader
 * may not read at the value's path and the member's name (see {@link redactSerializedResult}).
 * @param {object} wrapper - Wrapper the snapshot was extracted from.
 * @param {object} value - The value.
 * @param {string} path - Api path the value is at.
 * @param {{currentWrapper: object, context: object}|undefined} callerOverride - The reader, when it is not the one
 *   reading now.
 * @param {{wrapper: object, reader: object}|null} kept - The access a node a module kept is making.
 * @returns {object} The stand-in.
 * @private
 */
function serializedHolder(wrapper, value, path, callerOverride, kept) {
	const holder = Objects.create(null);
	holder.toJSON = (key) =>
		redactSerializedResult(wrapper, Reflect.apply(value.toJSON, value, [key]), path, new WeakSet(), callerOverride, kept);
	return holder;
}

/**
 * What a module's own `toJSON` gave, with the members the reader may not read left out at `basePath` and each
 * member's name, as a node's own members are left out of its serialization (see {@link redactSerialized}):
 * an object member the rules leave the reader nothing of goes, arrays are read element by element at `<path>.<i>`,
 * and a value inside that serializes through a `toJSON` of its own is held to the same at its path. What the result
 * holds is never changed: an object or array that loses a member is copied.
 * @param {object} wrapper - The node whose `toJSON` gave the result.
 * @param {*} data - What the `toJSON` gave.
 * @param {string} basePath - Api path the result stands for.
 * @param {WeakSet<object>} seen - The objects on the current path.
 * @param {{currentWrapper: object, context: object}|undefined} callerOverride - The reader, when it is not the one
 *   reading now.
 * @param {{wrapper: object, reader: object}|null} [kept] - The access a node a module kept is making.
 * @returns {*} `data`, or a copy of it with what the reader may not read left out.
 * @private
 *
 * @example
 * // rule: deny reader.** → owner.cfg.hidden; owner.cfg.toJSON() gives { pub: 1, hidden: "H" }
 * JSON.stringify(self.owner.cfg); // '{"pub":1}'
 */
function redactSerializedResult(wrapper, data, basePath, seen, callerOverride, kept = null) {
	/**
	 * Whether the rules leave the reader nothing at a path that names no node (a member of what a module's `toJSON`
	 * gave): the path is denied and nothing beneath it is allowed, as {@link readsNothingBeneath} answers for a
	 * member of a node's data.
	 * @param {object} wrapper - The node being serialized.
	 * @param {string} targetPath - The member's api path.
	 * @param {{currentWrapper: object, context: object}|undefined} callerOverride - The reader, when it is not the one
	 *   reading now.
	 * @param {{wrapper: object, reader: object}|null} kept - The access a node a module kept is making.
	 * @returns {boolean} Whether the reader may read nothing there.
	 * @private
	 */
	function deniedWithNothingBeneath(wrapper, targetPath, callerOverride, kept) {
		if (readGateDecision(wrapper, targetPath, callerOverride, kept).allowed) return false;
		const probePath = `${targetPath}.${ANY_MEMBER_SEGMENT}`;
		const beneath = readGateDecision(wrapper, probePath, callerOverride, kept);
		if (beneath.allowed) return false;
		return !wrapper.slothlet.handlers.permissionManager.allowsBeneath(beneath.caller, targetPath, probePath);
	}

	if (!data || typeof data !== "object" || WeakSetMethods.has(seen, data) || isTerminalData(data) || resolveWrapper(data) !== null)
		return data;
	WeakSetMethods.add(seen, data);
	const isList = Arrays.isArray(data);
	let copy = null;
	const own = () => (copy ??= isList ? Objects.assign([], data) : Objects.assign(Objects.create(Objects.getPrototypeOf(data)), data));
	for (let ofIndex = 0, ofList = Objects.keys(data); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		const value = data[key];
		const targetPath = `${basePath}.${key}`;
		if (isTerminalData(value)) {
			if (!readGateDecision(wrapper, targetPath, callerOverride, kept).allowed) delete own()[key];
		} else if (value === null || typeof value !== "object" || resolveWrapper(value) !== null) {
			// A function is left out by JSON.stringify, and a node serializes for its reader through its own toJSON.
			continue;
		} else if (deniedWithNothingBeneath(wrapper, targetPath, callerOverride, kept)) {
			delete own()[key];
		} else if (serializesItself(value)) {
			own()[key] = serializedHolder(wrapper, value, targetPath, callerOverride, kept);
		} else {
			const redacted = redactSerializedResult(wrapper, value, targetPath, seen, callerOverride, kept);
			if (redacted !== value) own()[key] = redacted;
		}
	}
	WeakSetMethods.delete(seen, data);
	return copy ?? data;
}

/**
 * What a `toJSON` of a node's own gave, held for each reader in turn (see {@link redactSerializedResult}),
 * when the permission system gates reads.
 * @param {object} wrapper - The node's wrapper.
 * @param {*} result - What the `toJSON` gave.
 * @param {string} path - The node's api path.
 * @param {Array<{currentWrapper: object, context: object}|undefined>} readers - The readers (`undefined` for whoever is
 *   reading now).
 * @param {{wrapper: object, reader: object}|null} kept - The access a node a module kept is making.
 * @returns {*} The result with what the readers may not read left out.
 * @private
 */
function redactToJSONResult(wrapper, result, path, readers, kept) {
	const pm = wrapper.slothlet.handlers?.permissionManager;
	if (!pm || !pm.isEnabled() || !pm.isReadGatingEnabled()) return result;
	let redacted = result;
	for (let ofIndex = 0, ofList = readers; ofIndex < ofList.length; ofIndex++) {
		const reader = ofList[ofIndex];
		redacted = redactSerializedResult(wrapper, redacted, path, new WeakSet(), reader, kept);
	}
	return redacted;
}

/**
 * Every per-reader view, so a view handed to a leaf is recognised as slothlet's own (#597).
 * @type {WeakSet<object>}
 * @private
 */
const capturedViewSet = new WeakSet();

/**
 * Whether a function can be called with `new`. Asked by constructing a proxy whose construct trap answers in its
 * place: the proxy is constructible exactly when `fn` is, and nothing of `fn` is read or run to find out — not even
 * a node's `prototype`, which a class holds fixed, so a proxy cannot answer for it.
 * @param {Function} fn - The function.
 * @returns {boolean} True when `fn` is a constructor.
 * @private
 *
 * @example
 * isConstructor(class {}); // true
 * isConstructor(() => {}); // false
 */
function isConstructor(fn) {
	try {
		Reflect.construct(new NativeProxy(fn, { construct: () => ({}) }), []);
		return true;
	} catch {
		return false;
	}
}

/**
 * Inspect hooks the wrapper put on its proxy targets, so the proxy can leave them out of what it describes.
 * @type {WeakSet<Function>}
 * @private
 */
const INSPECT_HOOKS = new WeakSet();

/**
 * Record a function as one of the wrapper's inspect hooks.
 * @param {Function} hook - The hook.
 * @returns {Function} The hook.
 * @private
 */
function registerInspectHook(hook) {
	WeakSetMethods.add(INSPECT_HOOKS, hook);
	return hook;
}

/**
 * Whether a wrapper belongs to an api tree that a restart() has since replaced (#504).
 *
 * @param {UnifiedWrapper} wrapper - Wrapper to test.
 * @returns {boolean} True when a newer tree is live and this wrapper's traps must forward to it.
 * @private
 *
 * @example
 * if (isRestartStale(wrapper)) return forwardToLiveTree();
 */
function isRestartStale(wrapper) {
	const slothlet = wrapper.____slothlet;
	// While copies hold trees of their own (#876), a node answers for the tree of the code reading it: the reading
	// code's tree is the one whose epoch it reads, so a node of any other tree forwards to the node at its path there.
	if (slothlet._treeCopies !== 0) {
		const epoch = wrapper.____slothletInternal.epoch;
		// The tree being built for the reader's set (a restart's, while it builds) answers as itself too.
		return epoch !== slothlet._treeEpoch && epoch !== slothlet._buildEpoch;
	}
	return wrapper.____slothletInternal.epoch < slothlet._liveEpoch;
}

/**
 * Whether `prop` is a non-configurable own property of a proxy target. Proxy invariants tie the
 * answers for such a property to the target itself, so the forwarding traps report it from there.
 *
 * @param {object} target - Proxy target.
 * @param {string|symbol} prop - Property key.
 * @returns {boolean} True when the target owns `prop` non-configurably.
 * @private
 *
 * @example
 * isFixedOnTarget(function () {}, "prototype"); // true
 */
function isFixedOnTarget(target, prop) {
	const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
	return descriptor !== undefined && descriptor.configurable === false;
}

/**
 * Whether `prop` is a canonical non-negative integer key (`"0"`, `"12"`), the keys an array-backed
 * wrapper answers from its current array rather than from the element wrappers it caches (#602).
 * Keys from `"4294967295"` up are not array indices, but the array holds them as ordinary own
 * properties, so answering them from the array reports them as the array itself does; the
 * target-based path would answer from the array the wrapper was built over, stale after a reload.
 * @param {string|symbol} prop - Property key.
 * @returns {boolean} True for an array index.
 * @private
 *
 * @example
 * isArrayIndex("3"); // true
 */
function isArrayIndex(prop) {
	return typeof prop === "string" && RegExpMethods.exec(/^(?:0|[1-9]\d*)$/, prop) !== null;
}

/**
 * Whether a key is a position of an array: a canonical index below 2^32 - 1. "4294967295" and above are
 * ordinary properties of the array, and a held member under one does not move.
 *
 * @param {string|symbol} key - Property key.
 * @returns {boolean} True for an array position.
 * @private
 *
 * @example
 * isPosition("2"); // true
 * isPosition("4294967295"); // false
 */
function isPosition(key) {
	return isArrayIndex(key) && Number(key) < 4294967295;
}

/**
 * Whether a key is a position at or past an array shell's read-only `length`, which takes no write or definition.
 *
 * @param {object} target - The proxy target.
 * @param {string|symbol} prop - Property key.
 * @returns {boolean} True when the shell is an array whose `length` is read-only and `prop` is a position at or past it.
 * @private
 *
 * @example
 * isPastFixedLength(Object.defineProperty([1], "length", { writable: false }), "1"); // true
 */
function isPastFixedLength(target, prop) {
	if (!Arrays.isArray(target) || !isPosition(prop)) return false;
	return Reflect.getOwnPropertyDescriptor(target, "length")?.writable === false && Number(prop) >= target.length;
}

/**
 * Whether a definition must land on a proxy target as well as on the object that holds the member: the
 * target is sealed, holds the key non-configurably, or the definition leaves the key non-configurable.
 * An attribute the descriptor leaves out keeps the holder's current one, and is `false` for a new key,
 * as `Object.defineProperty` applies it; a non-configurable result must be reported from the target too.
 *
 * @param {object} target - Proxy target.
 * @param {object} holder - The object the member is defined on.
 * @param {string|symbol} prop - Property key.
 * @param {PropertyDescriptor} descriptor - Descriptor to define.
 * @returns {boolean} True when the target takes the definition as well.
 * @private
 *
 * @example
 * bindsTarget(shell, wrapper, "x", { value: 1 }); // true: a new key defined this way is non-configurable
 */
function definitionBindsTarget(target, holder, prop, descriptor) {
	if (!Reflect.isExtensible(target) || isFixedOnTarget(target, prop)) return true;
	if ("configurable" in descriptor) return descriptor.configurable === false;
	const current = Reflect.getOwnPropertyDescriptor(holder, prop);
	return current ? current.configurable === false : true;
}

/**
 * Whether `prop` is a non-configurable own property of a proxy target that takes no write: a data
 * property that is not writable, or an accessor without a setter (a frozen array's index or `length`).
 *
 * @param {object} target - Proxy target.
 * @param {string|symbol} prop - Property key.
 * @returns {boolean} True when the target owns `prop` non-configurably and refuses a write to it.
 * @private
 *
 * @example
 * isFixedReadOnly(Object.freeze([1]), "0"); // true
 */
function isFixedReadOnly(target, prop) {
	const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
	if (descriptor === undefined || descriptor.configurable) return false;
	return "value" in descriptor ? !descriptor.writable : descriptor.set === undefined;
}

/**
 * What `util.inspect` shows for a namespace node: its members as the caller inspecting it may read them, through
 * the node, so a member listed is read-gated and a primitive shows as the value it is, as in plain JS (#603 review).
 * A member the caller may not read is left out, as `Object.keys()` leaves it out.
 *
 * @param {object} wrapper - The node's wrapper.
 * @returns {object} The members to show.
 * @private
 *
 * @example
 * util.inspect(api.config); // { host: 'db', port: 5432 }
 */
function inspectMembers(wrapper) {
	/**
	 * What `util.inspect` shows for an accessor, as it shows one of a plain object: `[Getter]`, `[Setter]` or
	 * `[Getter/Setter]`, without running it.
	 * @param {PropertyDescriptor} descriptor - The accessor's descriptor.
	 * @returns {object} A value `util.inspect` shows as that text.
	 * @private
	 */
	function accessorLabel(descriptor) {
		return inspectLabel(descriptor.get && descriptor.set ? "[Getter/Setter]" : descriptor.get ? "[Getter]" : "[Setter]");
	}

	const node = wrapper.____slothletInternal.proxy;
	const shown = {};
	for (let ofIndex = 0, ofList = Objects.keys(node); ofIndex < ofList.length; ofIndex++) {
		const key = ofList[ofIndex];
		// A member listed that the caller may not read after all (one the module's Proxy among the value's prototypes
		// answers, which reading runs as a call of the node) is left out as well.
		try {
			// An accessor is shown by its form, as `util.inspect` shows one, and not run: it is the module's code.
			const descriptor = Reflect.getOwnPropertyDescriptor(node, key);
			shown[key] = descriptor && !("value" in descriptor) ? accessorLabel(descriptor) : node[key];
		} catch (error) {
			if (error?.code !== "PERMISSION_DENIED") throw error;
		}
	}
	return shown;
}

/**
 * A value `util.inspect` shows as `text` itself, unquoted, as it shows a form such as `[Function: name]` inside an object.
 * @param {string} text - The text.
 * @returns {object} The label.
 * @private
 */
function inspectLabel(text) {
	return Objects.freeze(Objects.create(null, { [INSPECT_CUSTOM]: { value: () => text } }));
}

/**
 * What a node shows to `util.inspect`: its members for a namespace, its function form for a lazy node not loaded yet,
 * and otherwise its value — which, to a module, is never the module's runnable code (#632). A function or an object
 * holding code is shown to a module as its form instead (see {@link inspectSafe}), so a hook a module reads
 * and calls does not hand it the function behind the node, nor a class's inherited statics.
 * @param {object} wrapper - The node's wrapper.
 * @param {Array<*>} args - The hook's arguments (`depth`, `options`, `inspect`).
 * @param {boolean} [forModule] - Show it as to a module, whoever is reading.
 * @returns {*} What is shown.
 * @private
 */
function inspectShown(wrapper, args, forModule = inspectReaderIsModule(wrapper)) {
	const internal = wrapper.____slothletInternal;
	const childKeys = filterList(Objects.keys(wrapper), (k) => !isFrameworkReservedKey(k));
	if (childKeys.length > 0 && !internal.isCallable) return inspectMembers(wrapper);
	// A lazy node not loaded yet shows as the function stand-in it is, `[Function: name]` — the form a module's view of
	// it shows (#824) — not as the Proxy around it, which `util.inspect` prints as `Proxy([Function: name])`. Its members
	// are not read: reading them would load it. A node on an object shell that holds nothing (a loaded node removed, #811) shows what it holds, as eager's
	// does: one that showed itself would be asked again by an inspector that inspects what a hook returns, without end.
	// impl is always null (not undefined) at this point; the || undefined branch is never evaluated.
	/* v8 ignore next */
	const unloaded = internal.mode === "lazy" && !internal.state.materialized && (internal.impl === null || internal.impl === undefined);
	if (unloaded && typeof internal.proxy === "function") {
		const name = ArrayMethods.pop(splitText(String(internal.apiPath ?? ""), "."));
		return inspectLabel(name ? `[Function: ${name}]` : "[Function (anonymous)]");
	}
	// A function the node composed its members onto is a layer, which `util.inspect` would show as its bare shell: it is
	// shown by its form and members, as to a module.
	const layered = isCompositionLayer(internal.impl) && typeof internal.impl === "function";
	if (!layered && (!forModule || !memberHoldsCode(internal.impl, searchDepth(wrapper.slothlet) + 1, searchBudget(wrapper.slothlet))))
		return internal.impl;
	// The node's own members, read through it as the module reading them may.
	if (typeof internal.impl !== "function") return inspectMembers(wrapper);
	const label = codeLabel(layered ? layerUnderlying(internal.impl) : internal.impl);
	const members = inspectMembers(wrapper);
	if (Objects.keys(members).length === 0) return label;
	const options = args[1],
		inspect = args[2];
	return `${label} ${(typeof inspect === "function" ? inspect : util.inspect)(members, options)}`;
}

/**
 * A value as an inspect hook shows it to `forModule`'s reader: the module's code — a function, or an object holding code —
 * as its form, a label that runs nothing, and anything else as it is.
 * @param {*} value - The value.
 * @param {Array<*>} args - The hook's arguments.
 * @param {boolean} forModule - Whether a module is reading.
 * @param {object|null} slothlet - The instance, whose `permissions.search` bounds the search for code.
 * @returns {*} What is shown.
 * @private
 */
function inspectSafe(value, args, forModule, slothlet) {
	if (!forModule || !memberHoldsCode(value, searchDepth(slothlet) + 1, searchBudget(slothlet))) return value;
	return typeof value === "function" ? codeLabel(value) : "[Object]";
}

/**
 * Whether a module's code is what reads a node's inspect hook now (not the host's).
 * @param {object} wrapper - The node's wrapper.
 * @returns {boolean} True for a module, or a reader that cannot be told.
 * @private
 */
function inspectReaderIsModule(wrapper) {
	const identity = wrapper.slothlet?.contextManager?.getCallerIdentity?.(wrapper.slothlet.instanceID);
	return Boolean(identity?.currentWrapper || identity?.unresolved);
}

/**
 * Give a wrapper's proxy target the custom `util.inspect` hook that shows the wrapper's children
 * (or its impl), unless the target already has one.
 *
 * @description
 * An array member's target is an empty array shell the wrapper owns (#603, #609), and Node inspects a
 * Proxy's target directly, so the shell's hook shows the module's current array. Every target is
 * created extensible by the wrapper, so no extensibility guard is needed. Shared by createProxy() and
 * the callable-proxy upgrade (#533).
 *
 * @param {UnifiedWrapper} wrapper - The wrapper the target belongs to.
 * @param {object|Function|Array} target - The proxy target.
 * @returns {void}
 * @private
 *
 * @example
 * defineProxyInspect(wrapper, createNamedProxyTarget(apiPath, "callableProxy"));
 */
function defineProxyInspect(wrapper, target) {
	if (Arrays.isArray(target)) {
		Objects.defineProperty(target, util.inspect.custom, {
			__proto__: null,
			// Shown through the node, so each element is read as the caller reading it may: the caller's `inspect`
			// is not trusted with the backing array, which a callback that returns its argument would take.
			value: registerInspectHook(() => {
				const node = wrapper.____slothletInternal.proxy;
				const shown = [];
				for (let ofIndex = 0, ofList = Objects.keys(node); ofIndex < ofList.length; ofIndex++) {
					const key = ofList[ofIndex];
					shown[key] = node[key];
				}
				shown.length = node.length;
				return shown;
			}),
			writable: false,
			enumerable: false,
			configurable: true
		});
		return;
	}
	if (!(util.inspect.custom in target)) {
		Objects.defineProperty(target, util.inspect.custom, {
			__proto__: null,
			value: registerInspectHook(function (...args) {
				return inspectShown(wrapper, args);
			}),
			writable: false,
			enumerable: false,
			configurable: true
		});
	}
}

/** Whether {@link ValuesLayer} has built its class: it builds one, for the wrapper's chain. @type {boolean} */
let built = false;

/**
 * Build this layer of the wrapper class over `Base`, once (see `unified-wrapper.mjs`).
 * @param {Function} Base - The class below this layer.
 * @returns {Function} The layer's class.
 * @internal
 */
export function ValuesLayer(Base) {
	if (built) throw ownBindingsRefusal("lib/handlers/unified-wrapper/values", import.meta.url);
	built = true;
	return Base.layer(
		class Values extends Base {
			/**
			 * Proxy -> wrapper registry used by resolveWrapper() and by every layer that finds the wrapper behind a node's
			 * proxy. Held here, as a static private of the bottom layer, so only the table entries this class defines over it
			 * (`registeredWrapper`, `isRegisteredProxy`, `registerProxy`) read or write it.
			 * @type {WeakMap<object, object>}
			 */
			static #proxyRegistry = new WeakMap();

			static {
				registeredWrapper = (value) => WeakMapMethods.get(Values.#proxyRegistry, value);
				isRegisteredProxy = (value) => WeakMapMethods.has(Values.#proxyRegistry, value);
				registerProxy = (proxy, wrapper) => WeakMapMethods.set(Values.#proxyRegistry, proxy, wrapper);
				Base.define("values", {
					registeredWrapper,
					registerProxy,
					inherits,
					dataKind,
					NODE_VALUE_OFS,
					frontedDataMember,
					dataReadOptions,
					ASSIGNED_DATA,
					markAssignedData,
					valueHoldsName,
					ownsPrototype,
					INTRINSICS,
					SNAPSHOT_OMIT,
					VM_SCRIPT,
					VM_NATIVE_SCRIPT,
					redactToJSONResult,
					INSPECT_HOOKS,
					definitionBindsTarget,
					defineProxyInspect,
					COMMON_READERS,
					TYPED_ARRAY_READERS,
					DATA_READERS,
					MEMBER_HOLDERS,
					INHERITED_MEMBER_NODES,
					EMPTY_INHERITED_NODES,
					WELL_KNOWN_SYMBOLS,
					TYPED_ARRAY_BYTE_LENGTH,
					TYPED_ARRAY_LENGTH,
					serializesItself,
					serializedHolder,
					registerInspectHook
				});
				Base.define("is", {
					registeredProxy: isRegisteredProxy,
					unchangingDefinition: isUnchangingDefinition,
					prototypeHandle: isPrototypeHandle,
					intrinsic: isIntrinsic,
					enginePromise: isEnginePromise,
					errorValue: isErrorValue,
					engineMember: isEngineMember,
					apiNode: isApiNode,
					terminalData: isTerminalData,
					dataMemberNode: isDataMemberNode,
					builtinFunctionMember: isBuiltinFunctionMember,
					codeMemberWithheld: isCodeMemberWithheld,
					bindingMethod: isBindingMethod,
					sharedValue: isSharedValue,
					slothletValue: isSlothletValue,
					moduleStandIn: isModuleStandIn,
					moduleProxy: isModuleProxy,
					builtinFunction: isBuiltinFunction,
					slotObject: isSlotObject,
					nativeIterator: isNativeIterator,
					codeObject: isCodeObject,
					shared: isShared,
					carrier: isCarrier,
					ownOrigin: isOwnOrigin,
					stepResult: isStepResult,
					arrayMember: isArrayMember,
					readRedacted: isReadRedacted,
					heldPrimitive: isHeldPrimitive,
					rootFunctionAnswer: isRootFunctionAnswer,
					hostRead: isHostRead,
					constructor: isConstructor,
					restartStale: isRestartStale,
					fixedOnTarget: isFixedOnTarget,
					arrayIndex: isArrayIndex,
					position: isPosition,
					pastFixedLength: isPastFixedLength,
					fixedReadOnly: isFixedReadOnly,
					refusal: isRefusal
				});
				Base.define("has", { internalSlots: hasInternalSlots });
				Base.define("inherited", { engineMember: inheritedEngineMember, private: inheritedPrivate, atStart: inheritedAtStart });
				Base.define("holds", {
					dataKind: holdsDataKind,
					ownMember: holdsOwnMember,
					assignedData: holdsAssignedData,
					code: holdsCode,
					slottedData: holdsSlottedData,
					value: holdsValue
				});
				Base.define("wrapper", { report: wrapperReport });
				Base.define("node", { inherits: nodeInherits });
				Base.define("impl", { has: implHas });
				Base.define("captured", { viewSet: capturedViewSet });
				Base.define("inspect", { label: inspectLabel, shown: inspectShown, safe: inspectSafe, readerIsModule: inspectReaderIsModule });
				Base.define("is", { wrapper: (value) => value !== null && typeof value === "object" && #brand in value });
				Base.linkLayer(this, (methods, registered) => {
					realClass = registered;
					moduleKey = methods.module.key;
					moduleObjectOf = methods.module.objectOf;
					nodeAtPath = methods.node.atPath;
					nodeWrapperOf = methods.node.wrapperOf;
					prototypeChain = methods.prototype.chain;
					prototypeHandleOf = methods.prototype.handleOf;
					sameLookup = methods.nodes.sameLookup;
					WAITING_CHAINS = methods.nodes.WAITING_CHAINS;
					resolveEnforcedCaller = methods.rules.resolveEnforcedCaller;
					enforceCodeMember = methods.rules.enforceCodeMember;
					hasOwnMember = methods.has.ownMember;
					memberHoldsCode = methods.rules.memberHoldsCode;
					readGateDecision = methods.read.gateDecision;
					readsNothingBeneath = methods.rules.readsNothingBeneath;
					recordedPrototype = methods.run.recordedPrototype;
					startPrototypes = methods.run.startPrototypes;
					capturedViewChildren = methods.captured.viewChildren;
					hasOwn = methods.has.own;
					NODE_MEMBER = methods.views.NODE_MEMBER;
					PROTOTYPE_HANDLE_READER = methods.views.PROTOTYPE_HANDLE_READER;
					functionOf = methods.function.of;
					SELF_MEMBER_VIEWS = methods.views.SELF_MEMBER_VIEWS;
					SELF_VIEW_NODES = methods.views.SELF_VIEW_NODES;
					ANY_MEMBER_SEGMENT = methods.membrane.ANY_MEMBER_SEGMENT;
					CROSSING_ORIGINS = methods.membrane.CROSSING_ORIGINS;
					CROSSINGS = methods.membrane.CROSSINGS;
					INBOUND_VIEWS = methods.membrane.INBOUND_VIEWS;
					INSPECT_CUSTOM = methods.membrane.INSPECT_CUSTOM;
					asOneModule = methods.membrane.asOneModule;
					memberPathOf = methods.membrane.memberPathOf;
					searchBudget = methods.membrane.searchBudget;
					searchDepth = methods.membrane.searchDepth;
					STAND_IN_RECORDS = methods.membrane.STAND_IN_RECORDS;
					resolveWrapper = methods.uw.resolveWrapper;
					trustedRootOwn = methods.uw.trustedRootOwn;
					TYPE_STATES = methods.uw.TYPE_STATES;
				});
			}

			/** The wrapper brand: only instances of the registered chain carry it. */
			#brand = true;

			/**
			 * @param {object} slothlet - The instance the wrapper belongs to.
			 */
			constructor(slothlet) {
				if (new.target !== realClass) throw ownBindingsRefusal("lib/handlers/unified-wrapper/values", import.meta.url);
				super(slothlet);
			}
		}
	);
}
