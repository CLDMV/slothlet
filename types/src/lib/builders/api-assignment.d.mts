/**
 * Manages unified API assignment logic
 * @class ApiAssignment
 * @extends ComponentBase
 * @package
 *
 * @description
 * Class-based utility for assigning values to API paths with collision detection,
 * wrapper sync, and merge operations. Extends ComponentBase for Slothlet property access.
 *
 * @example
 * const assignment = new ApiAssignment(slothlet);
 * assignment.assignToApiPath(api, "math", mathWrapper, {});
 */
export class ApiAssignment {
    static slothletProperty: string;
    /**
     * Create an ApiAssignment instance.
     * @param {object} slothlet - Slothlet class instance.
     * @package
     *
     * @description
     * Creates ApiAssignment with ComponentBase support for config access.
     */
    constructor(slothlet: object);
    /**
     * Check if a value is a UnifiedWrapper proxy
     * @param {unknown} value - Value to check
     * @returns {boolean} True if value is a wrapper proxy
     * @private
     */
    private isWrapperProxy;
    /**
     * Assign a value to an API object at a given property key.
     * Handles wrapper sync, collision detection, and proper proxy preservation.
     *
     * @param {Object} targetApi - Target object to assign to (may be a UnifiedWrapper proxy)
     * @param {string|symbol} key - Property name to assign
     * @param {unknown} value - Value to assign (may be UnifiedWrapper proxy, raw value, etc.)
     * @param {Object} options - Assignment options
     * @param {boolean} [options.allowOverwrite=false] - Allow overwriting existing non-wrapper values
     * @param {boolean} [options.mutateExisting=false] - Sync existing wrappers instead of replacing
     * @param {boolean} [options.useCollisionDetection=false] - Enable collision detection using config.collision mode
     * @param {Object} [options.config] - Slothlet config (uses config.collision.initial or config.collision.api)
     * @param {string} [options.collisionContext="initial"] - Collision context: "initial" or "api"
     * @param {Function} [options.syncWrapper] - Function to sync two wrapper proxies
     * @returns {boolean} True if assignment succeeded, false if blocked by collision or other constraint
     *
     * @description
     * This function encapsulates all assignment patterns from processFiles:
     * - Direct assignment when no collision
     * - Wrapper sync when both existing and new are wrappers
     * - Collision detection using config.collision[context] mode (merge/replace/error/skip/warn)
     * - Proper handling of UnifiedWrapper proxies (preserves them, doesn't unwrap)
     *
     * @example
     * // Direct assignment
     * assignment.assignToApiPath(api, "math", mathWrapper, {});
     *
     * @example
     * // Sync existing wrapper with new data
     * assignment.assignToApiPath(api, "config", newConfigWrapper, { mutateExisting: true, syncWrapper });
     *
     * @example
     * // With collision detection
     * assignment.assignToApiPath(api.math, "add", addFunction, {
     *     useCollisionDetection: true,
     *     config,
     *     collisionContext: "initial"
     * });
     */
    assignToApiPath(targetApi: any, key: string | symbol, value: unknown, options?: {
        allowOverwrite?: boolean;
        mutateExisting?: boolean;
        useCollisionDetection?: boolean;
        config?: any;
        collisionContext?: string;
        syncWrapper?: Function;
    }): boolean;
    /**
     * Recursively merge a source object into a target object using assignToApiPath logic.
     *
     * @param {Object} targetApi - Target object
     * @param {Object} sourceApi - Source object to merge from
     * @param {Object} options - Assignment options (passed to assignToApiPath)
     * @param {boolean} [options.removeMissing=false] - Remove keys from target that don't exist in source
     * @returns {Promise<void>}
     *
     * @description
     * Recursively walks the source object and assigns each value to the target using
     * assignToApiPath. This provides consistent merge behavior for both initial build
     * and hot reload operations.
     *
     * @example
     * await assignment.mergeApiObjects(api.config, newConfigApi, {
     *     mutateExisting: true,
     *     syncWrapper,
     *     removeMissing: false
     * });
     */
    mergeApiObjects(targetApi: any, sourceApi: any, options?: {
        removeMissing?: boolean;
    }): Promise<void>;
}
//# sourceMappingURL=api-assignment.d.mts.map