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
 * @function runtime_wrapClassInstance
 * @package
 * @param {object} instance - The class instance to wrap
 * @param {object} contextManager - The context manager (async or live)
 * @param {string} instanceID - The slothlet instance ID
 * @param {WeakMap} instanceCache - The cache for wrapped instances
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
 * const wrappedInstance = runtime_wrapClassInstance(instance, contextManager, instanceID, instanceCache);
 */
export function runtime_wrapClassInstance(instance: object, contextManager: object, instanceID: string, instanceCache: WeakMap<any, any>): ProxyConstructor;
//# sourceMappingURL=class-instance-wrapper.d.mts.map