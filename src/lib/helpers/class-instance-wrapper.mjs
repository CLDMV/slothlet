/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/helpers/class-instance-wrapper.mjs
 *	@Date: 2026-01-29T03:08:11-08:00 (1769684891)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:41-08:00 (1795869041)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Class instance context wrapping for AsyncLocalStorage preservation
 * @module @cldmv/slothlet/helpers/class-instance-wrapper
 * @internal
 * @package
 *
 * @description
 * Provides detection and wrapping logic for class instances to preserve AsyncLocalStorage
 * context when methods are called on returned instances. Adapted from V2.3.0 implementation.
 */

// Node-only EventEmitter resolved in the platform module so node:events stays out of the
// browser static graph (#123).
import { EventEmitter, inheritsFrom } from "#helpers/platform";
import { isFrameworkReservedKey } from "#helpers/reserved-keys";
import { internals as framePlacementInternals } from "#handlers/frame-placement";
import {
	ArrayBuffer,
	Boolean,
	DataView,
	Date,
	Error,
	filterList,
	Map,
	MapMethods,
	NativeArray,
	NativeObject,
	NativeProxy,
	Objects,
	Promise,
	Reflect,
	RegExp,
	Set,
	setFrom,
	SetMethods,
	Symbol,
	Uint8Array,
	WeakMap,
	WeakMapMethods,
	WeakSet
} from "#helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";
const { outerCallerCeiling } = framePlacementInternals("lib/helpers/class-instance-wrapper");

/**
 * Excluded constructors that should NOT be wrapped
 * @constant
 * @private
 */
const EXCLUDED_CONSTRUCTORS = setFrom([NativeObject, NativeArray, Promise, Date, RegExp, Error]);

/**
 * Sentinel marking a Proxy already produced by {@link runtime_wrapClassInstance}.
 * Reading it through the Proxy's `get` trap returns `true`, so any re-wrap attempt can
 * detect an already-wrapped value and skip it.
 *
 * In async runtime a class-instance result is wrapped in two places with the same intent:
 * once inside `AsyncContextManager.runInContext` (so later method calls re-enter the ALS
 * store) and again in the method Proxy's `runtime_contextPreservingMethod` (needed for live
 * mode, where `runInContext` deliberately does not wrap). Proxies are transparent, so the
 * outer wrap could not tell the result was already wrapped and re-wrapped it — doubling the
 * wrap count on every method call and producing the 2^N blow-up on chainable instances (#124).
 * Marking wrapped Proxies makes the wrap idempotent and keeps a chain flat (one layer per step).
 * @constant
 * @private
 */
const SLOTHLET_CLASS_WRAPPED = Symbol("slothlet.classInstanceWrapped");

/**
 * The instance behind each Proxy {@link runtime_wrapClassInstance} produced. Its keys are also how one is told from
 * a module's own Proxy without reading anything through it (reading the sentinel would run a module Proxy's `get` trap).
 * @type {WeakMap<object, object>}
 * @private
 */
const WRAPPED_INSTANCES = new WeakMap();

/**
 * Each wrapped instance's Proxies, by who created the instance (the creating module's wrapper, or the context manager
 * when none is known): the same instance comes back as the same Proxy every time, so `a === b` holds for one instance
 * returned twice and for a method returning `this`.
 * @type {WeakMap<object, WeakMap<object, {proxy: object, instanceID: string}>>}
 */
const WRAPPERS_BY_INSTANCE = new WeakMap();

/**
 * The wrapper of the module that created the instance behind each Proxy {@link runtime_wrapClassInstance} produced.
 * @type {WeakMap<object, object|null>}
 */
const WRAPPED_CREATORS = new WeakMap();

/**
 * Whether an object is an instance of a class some module wrote, as the engine's wrappers tell it. Until one is set,
 * every class instance is taken for a module's.
 * @type {function(object): boolean}
 */
let isModuleInstance = () => true;

/** Whether {@link setModuleInstanceCheck} has run. @type {boolean} */
let moduleInstanceCheckSet = false;

/**
 * Set how an instance of a module's own class is told from one of the language's or Node's own (a `URL`, a
 * `Response`, an `Intl.NumberFormat`), which needs no context and whose methods work only on the object itself.
 * @package
 * @param {function(object): boolean} check - Answers true for an instance of a class a module wrote.
 * @returns {void}
 * @example
 * setModuleInstanceCheck((value) => hasModuleWrittenPrototype(value));
 */
function setModuleInstanceCheck(check) {
	// Set once, by the wrapper as it loads: a second set is refused, so code that sets it first makes slothlet's load fail.
	if (moduleInstanceCheckSet) throw ownBindingsRefusal("lib/helpers/class-instance-wrapper", import.meta.url);
	moduleInstanceCheckSet = true;
	isModuleInstance = check;
}

/**
 * The wrapper of the module that created the instance behind a Proxy {@link runtime_wrapClassInstance} produced.
 * @package
 * @param {*} value - Any value.
 * @returns {object|null} The creating module's wrapper, or null for any other value or when none is known.
 * @example
 * runtime_classInstanceCreator(wrappedInstance); // the wrapper of the leaf that returned it
 */
function runtime_classInstanceCreator(value) {
	if (value === null || typeof value !== "object") return null;
	return WeakMapMethods.get(WRAPPED_CREATORS, value) ?? null;
}

/** `WeakMap.prototype.has` as it was when slothlet loaded, so a module replacing it changes no answer below. */
const weakMapHas = WeakMapMethods.has;

// The language's own reflection, taken at load.
const { getPrototypeOf, getOwnPropertyDescriptor } = Reflect;

/**
 * Whether a value is a Proxy {@link runtime_wrapClassInstance} produced. Nothing of the value runs.
 * @package
 * @param {*} value - The value.
 * @returns {boolean} True for slothlet's own class-instance Proxy.
 * @example
 * runtime_isWrappedClassInstance(runtime_wrapClassInstance(instance, cm, id, new WeakMap())); // true
 */
export function runtime_isWrappedClassInstance(value) {
	return value !== null && typeof value === "object" && weakMapHas(WRAPPED_INSTANCES, value);
}

/**
 * Abstract %TypedArray% base constructor (the shared prototype of every
 * TypedArray view, including Buffer). It is not exposed as a global, so it
 * must be derived from a concrete view's prototype chain.
 * @constant
 * @private
 */
const TypedArray = Objects.getPrototypeOf(Uint8Array);

/**
 * Excluded instanceof classes that should NOT be wrapped
 * Note: EventEmitter has built-in AsyncLocalStorage context propagation in Node.js
 * and should not be wrapped to avoid interfering with native behavior.
 * Note: TypedArray (covers Buffer and every numeric view) and DataView rely on
 * internal slots for accessors like `.length`/`.byteLength`; proxy-wrapping them
 * breaks those intrinsics when the value crosses the `self` boundary.
 * @constant
 * @private
 */
const EXCLUDED_INSTANCEOF_CLASSES = filterList([ArrayBuffer, TypedArray, DataView, Map, Set, WeakMap, WeakSet, EventEmitter], Boolean);

/**
 * @function runtime_shouldWrapMethod
 * @package
 * @param {*} value - The value to check
 * @param {string|symbol} prop - The property name
 * @returns {boolean} True if the method should be wrapped
 *
 * @description
 * Determines if a method should be wrapped with context preservation.
 * Excludes constructors, Object.prototype methods, and internal methods.
 *
 * @example
 * runtime_shouldWrapMethod(myInstance.method, "method"); // true
 * runtime_shouldWrapMethod(myInstance.constructor, "constructor"); // false
 */
export function runtime_shouldWrapMethod(value, prop) {
	return (
		typeof value === "function" &&
		typeof prop === "string" &&
		prop !== "constructor" &&
		!(prop in Objects.prototype) &&
		!isFrameworkReservedKey(prop)
	);
}

/**
 * @function runtime_isClassInstance
 * @package
 * @param {*} val - The value to check
 * @returns {boolean} True if the value is a class instance that should be wrapped
 *
 * @description
 * Determines if a value is a class instance (not a plain object, array, or primitive)
 * that should have its methods wrapped to preserve AsyncLocalStorage context.
 * Uses systematic exclusion lists for better maintainability.
 *
 * @example
 * // Check if value is a class instance
 * const isInstance = runtime_isClassInstance(new MyClass());
 */
export function runtime_isClassInstance(val) {
	if (val == null || typeof val !== "object") return false;
	// The constructor is the one a plain read would find, taken from the descriptors of the value and its prototype
	// chain: none of the value's code runs, so a `constructor` accessor is never called and counts as no constructor.
	let constructor;
	try {
		for (let link = val; link !== null; link = getPrototypeOf(link)) {
			const descriptor = getOwnPropertyDescriptor(link, "constructor");
			if (descriptor === undefined) continue;
			constructor = descriptor.value;
			break;
		}
	} catch {
		// A value that refuses to be described is no class instance.
		return false;
	}
	if (typeof constructor !== "function" || SetMethods.has(EXCLUDED_CONSTRUCTORS, constructor)) return false;

	// The language's own check, never a `Symbol.hasInstance` a module gave one of these classes.
	for (let ofIndex = 0, ofList = EXCLUDED_INSTANCEOF_CLASSES; ofIndex < ofList.length; ofIndex++) {
		const cls = ofList[ofIndex];
		if (typeof cls === "function" && inheritsFrom(val, cls)) {
			return false;
		}
	}

	// An instance of a class no module wrote keeps its context on its own, and its methods and getters work only on the
	// object itself: it is handed out as it is.
	return isModuleInstance(val);
}

/**
 * @function runtime_wrapClassInstance
 * @package
 * @param {object} instance - The class instance to wrap
 * @param {object} contextManager - The context manager (async or live)
 * @param {string} instanceID - The slothlet instance ID
 * @param {WeakMap} instanceCache - The cache for wrapped instances
 * @param {object} [capturedWrapper] - Wrapper of the module that created this instance,
 *   snapshotted at wrap time. Used as the caller identity for the instance's method calls so
 *   that `self.*` calls from a class method are permission-checked as the creating module
 *   (the method is neither exempt from nor spuriously denied by the permission layer).
 * @returns {Proxy} A proxied instance with context-aware method calls
 *
 * @description
 * Wraps a class instance so that all method calls maintain the AsyncLocalStorage context.
 * This ensures that calls to methods on returned class instances preserve the slothlet
 * context for runtime imports like `self` and `context`.
 *
 * V3 Adaptation: Uses contextManager.runInContext() instead of V2's runWithCtx().
 *
 * @example
 * // Wrap a class instance to preserve context
 * const wrappedInstance = runtime_wrapClassInstance(instance, contextManager, instanceID, instanceCache, creatingWrapper);
 */
function runtime_wrapClassInstance(instance, contextManager, instanceID, instanceCache, capturedWrapper) {
	// Idempotent: a value we already wrapped carries the sentinel (readable through the Proxy
	// get trap below). Re-wrapping would nest a fresh Proxy per call and, on chainable instances,
	// double the wrap count on every method call (#124). Return the already-wrapped value as-is.
	if (instance != null && instance[SLOTHLET_CLASS_WRAPPED]) {
		return instance;
	}

	if (WeakMapMethods.has(instanceCache, instance)) {
		return WeakMapMethods.get(instanceCache, instance);
	}

	// The same instance from the same creator is the same Proxy, whichever call returned it.
	const creatorKey = capturedWrapper ?? contextManager;
	const known =
		WeakMapMethods.get(WRAPPERS_BY_INSTANCE, instance) == null
			? undefined
			: WeakMapMethods.get(WeakMapMethods.get(WRAPPERS_BY_INSTANCE, instance), creatorKey);
	if (known && known.instanceID === instanceID) {
		WeakMapMethods.set(instanceCache, instance, known.proxy);
		return known.proxy;
	}

	// DEBUG logging
	// if (process.env.DEBUG_CLASS_WRAP === "1") {
	// 	console.log("[CLASS_WRAP] Wrapping class instance:", instance.constructor?.name || "Unknown");
	// 	console.log("[CLASS_WRAP] Instance keys:", Object.keys(instance).slice(0, 10));
	// }

	// Cache for wrapped methods to avoid creating new function instances on repeated access
	const methodCache = new Map();

	const wrappedInstance = new NativeProxy(instance, {
		get(target, prop) {
			// Sentinel probe: identify Proxies we created so re-wrap stays idempotent (#124).
			if (prop === SLOTHLET_CLASS_WRAPPED) {
				return true;
			}

			// Check method cache first to avoid unnecessary property access and function creation
			if (MapMethods.has(methodCache, prop)) {
				return MapMethods.get(methodCache, prop);
			}

			// Read on the instance itself: a getter over a private field or an internal slot works only on the object, and
			// the Proxy stands for it.
			const value = Reflect.get(target, prop, target);

			// If it's a method (function), wrap it to preserve context
			// Exclude constructor, Object.prototype methods, and double-underscore methods
			if (runtime_shouldWrapMethod(value, prop)) {
				const runtime_contextPreservingMethod = function (...args) {
					// V3: Use contextManager.runInContext() to execute in context.
					// Pass: instanceID, function, thisArg (the instance), args, capturedWrapper.
					// capturedWrapper is the wrapper of the module that CREATED this instance,
					// snapshotted at wrap time. Passing it as the caller identity makes a class
					// method's `self.*` calls subject to the same permission rules as that module's
					// plain functions — a class method is not a way to bypass (or, post fail-closed,
					// be spuriously denied by) the permission layer.
					// rawErrors: a class method's throw is application data, same as a plain leaf's —
					// it must reach the caller unchanged, never re-typed as CONTEXT_EXECUTION_FAILED (#252).
					// The method runs as its creator (its definer) under the caller running it as its ceiling: no grant (#726).
					const ceiling = capturedWrapper ? outerCallerCeiling(contextManager, instanceID, capturedWrapper.____slothlet) : null;
					const result = contextManager.runInContext(instanceID, value, target, args, capturedWrapper, true, false, ceiling);

					// Recursively wrap returned class instances, carrying the same creating-module identity.
					if (result != null && runtime_isClassInstance(result)) {
						return runtime_wrapClassInstance(result, contextManager, instanceID, instanceCache, capturedWrapper);
					}

					return result;
				};

				// Cache the wrapped method for future access - prevents recreation on subsequent calls
				MapMethods.set(methodCache, prop, runtime_contextPreservingMethod);
				return runtime_contextPreservingMethod;
			}

			// For non-function properties, recursively wrap if it's a class instance
			if (value != null && runtime_isClassInstance(value)) {
				return runtime_wrapClassInstance(value, contextManager, instanceID, instanceCache, capturedWrapper);
			}

			return value;
		},

		set(target, prop, value) {
			// Clear method cache for this property if it's being overwritten
			if (MapMethods.has(methodCache, prop)) {
				MapMethods.delete(methodCache, prop);
			}
			// Written on the instance itself, as it is read: a setter over a private field works only on the object.
			return Reflect.set(target, prop, value, target);
		}
	});

	WeakMapMethods.set(instanceCache, instance, wrappedInstance);
	WeakMapMethods.set(WRAPPED_INSTANCES, wrappedInstance, instance);
	WeakMapMethods.set(WRAPPED_CREATORS, wrappedInstance, capturedWrapper ?? null);
	let byCreator = WeakMapMethods.get(WRAPPERS_BY_INSTANCE, instance);
	if (!byCreator) WeakMapMethods.set(WRAPPERS_BY_INSTANCE, instance, (byCreator = new WeakMap()));
	WeakMapMethods.set(byCreator, creatorKey, { proxy: wrappedInstance, instanceID });
	return wrappedInstance;
}

/**
 * @function runtime_unwrapClassInstance
 * @package
 * @param {*} value - A value that may be a Proxy {@link runtime_wrapClassInstance} produced.
 * @returns {*} The instance the Proxy wraps, or `value` when it is not one.
 *
 * @description
 * The class instance a context-preserving Proxy stands for, so code that keeps track of instances by
 * identity (#625) can tell the Proxy and the instance are the same value.
 *
 * @example
 * runtime_unwrapClassInstance(runtime_wrapClassInstance(instance, manager, id, new WeakMap())) === instance; // true
 */
function runtime_unwrapClassInstance(value) {
	if (value === null || typeof value !== "object") return value;
	return WeakMapMethods.get(WRAPPED_INSTANCES, value) ?? value;
}

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (!mayTakeInternals(consumer, ["lib/handlers/context-async", "lib/handlers/context-live", "lib/handlers/unified-wrapper"]))
		throw ownBindingsRefusal("lib/helpers/class-instance-wrapper", import.meta.url);
	return { runtime_classInstanceCreator, runtime_unwrapClassInstance, runtime_wrapClassInstance, setModuleInstanceCheck };
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
/** @type {typeof setModuleInstanceCheck} */
const guarded_setModuleInstanceCheck = guardInternal(setModuleInstanceCheck, "setModuleInstanceCheck", import.meta.url);
/** @type {typeof runtime_classInstanceCreator} */
const guarded_runtime_classInstanceCreator = guardInternal(runtime_classInstanceCreator, "runtime_classInstanceCreator", import.meta.url);
/** @type {typeof runtime_wrapClassInstance} */
const guarded_runtime_wrapClassInstance = guardInternal(runtime_wrapClassInstance, "runtime_wrapClassInstance", import.meta.url);
/** @type {typeof runtime_unwrapClassInstance} */
const guarded_runtime_unwrapClassInstance = guardInternal(runtime_unwrapClassInstance, "runtime_unwrapClassInstance", import.meta.url);
export {
	guarded_setModuleInstanceCheck as setModuleInstanceCheck,
	guarded_runtime_classInstanceCreator as runtime_classInstanceCreator,
	guarded_runtime_wrapClassInstance as runtime_wrapClassInstance,
	guarded_runtime_unwrapClassInstance as runtime_unwrapClassInstance
};
