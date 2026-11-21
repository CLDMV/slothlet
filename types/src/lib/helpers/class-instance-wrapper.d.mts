/**
 * Whether a value is a Proxy {@link runtime_wrapClassInstance} produced. Nothing of the value runs.
 * @package
 * @param {*} value - The value.
 * @returns {boolean} True for slothlet's own class-instance Proxy.
 * @example
 * runtime_isWrappedClassInstance(runtime_wrapClassInstance(instance, cm, id, new WeakMap())); // true
 */
export function runtime_isWrappedClassInstance(value: any): boolean;
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
export function runtime_shouldWrapMethod(value: any, prop: string | symbol): boolean;
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
export function runtime_isClassInstance(val: any): boolean;
/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/** @type {typeof setModuleInstanceCheck} */
declare const guarded_setModuleInstanceCheck: typeof setModuleInstanceCheck;
/** @type {typeof runtime_classInstanceCreator} */
declare const guarded_runtime_classInstanceCreator: typeof runtime_classInstanceCreator;
/** @type {typeof runtime_wrapClassInstance} */
declare const guarded_runtime_wrapClassInstance: typeof runtime_wrapClassInstance;
/** @type {typeof runtime_unwrapClassInstance} */
declare const guarded_runtime_unwrapClassInstance: typeof runtime_unwrapClassInstance;
/**
 * Set how an instance of a module's own class is told from one of the language's or Node's own (a `URL`, a
 * `Response`, an `Intl.NumberFormat`), which needs no context and whose methods work only on the object itself.
 * @package
 * @param {function(object): boolean} check - Answers true for an instance of a class a module wrote.
 * @returns {void}
 * @example
 * setModuleInstanceCheck((value) => hasModuleWrittenPrototype(value));
 */
declare function setModuleInstanceCheck(check: (arg0: object) => boolean): void;
/**
 * The wrapper of the module that created the instance behind a Proxy {@link runtime_wrapClassInstance} produced.
 * @package
 * @param {*} value - Any value.
 * @returns {object|null} The creating module's wrapper, or null for any other value or when none is known.
 * @example
 * runtime_classInstanceCreator(wrappedInstance); // the wrapper of the leaf that returned it
 */
declare function runtime_classInstanceCreator(value: any): object | null;
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
declare function runtime_wrapClassInstance(instance: object, contextManager: object, instanceID: string, instanceCache: WeakMap<any, any>, capturedWrapper?: object): ProxyConstructor;
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
declare function runtime_unwrapClassInstance(value: any): any;
export { guarded_setModuleInstanceCheck as setModuleInstanceCheck, guarded_runtime_classInstanceCreator as runtime_classInstanceCreator, guarded_runtime_wrapClassInstance as runtime_wrapClassInstance, guarded_runtime_unwrapClassInstance as runtime_unwrapClassInstance };
//# sourceMappingURL=class-instance-wrapper.d.mts.map