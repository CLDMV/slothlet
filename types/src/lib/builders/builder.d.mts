/**
 * API builder class for orchestrating mode-based API construction.
 * @class Builder
 * @extends ComponentBase
 * @package
 *
 * @description
 * Orchestrates API building by delegating to mode-specific builders (eager/lazy).
 * Extends ComponentBase for access to Slothlet configuration and error classes.
 *
 * @example
 * const builder = new Builder(slothlet);
 * const api = await builder.buildAPI({ dir: "./api" });
 */
export class Builder extends ComponentBase {
    static slothletProperty: string;
    /**
     * Create Builder instance.
     * @param {object} slothlet - Slothlet orchestrator instance.
     * @package
     *
     * @description
     * Stores Slothlet reference for accessing configuration and components.
     *
     * @example
     * const builder = new Builder(slothlet);
     */
    constructor(slothlet: object);
    /**
     * Build API from directory or file.
     * @param {Object} options - Build options
     * @param {string} [options.dir] - Directory or file to build from. Required unless `syntheticExports` is set (synthetic / in-memory leaf, #117).
     * @param {string} [options.mode="eager"] - Loading mode (eager or lazy)
     * @param {Object} [options.ownership] - Ownership manager (uses slothlet's if not provided)
     * @param {Object} [options.contextManager] - Context manager (uses slothlet's if not provided)
     * @param {string} [options.instanceID] - Instance ID (uses slothlet's if not provided)
     * @param {Object} [options.config] - Configuration (uses slothlet's if not provided)
     * @param {string} [options.apiPathPrefix=""] - Prefix for API paths (for api.add support)
     * @param {string} [options.collisionContext="initial"] - Collision context
     * @param {string} [options.moduleID] - Stable module identifier (cache key; enables later reload/remove)
     * @param {string|null} [options.cacheBust=null] - Cache-busting value forwarded to the loader/mode
     * @param {string|null} [options.collisionMode=null] - Per-call collision mode override (lazy builds)
     * @param {Function|null} [options.fileFilter=null] - Optional filter function (fileName) => boolean to load specific files only
     * @param {Object|null} [options.syntheticExports=null] - Inline `{ default?, ...named }` exports to build
     *   from instead of scanning `dir` (synthetic / in-memory leaf, #117). When set, `dir` is not required.
     * @param {string} [options.syntheticName="synthetic"] - Intermediate key name for the synthetic build.
     * @returns {Promise<Object>} Raw API object (unwrapped)
     * @public
     *
     * @description
     * Validates inputs and delegates to mode-specific builder (buildEagerAPI or buildLazyAPI).
     * When fileFilter is provided, only files matching the filter are loaded.
     *
     * @example
     * const api = await builder.buildAPI({ dir: "./api_tests/api_test", mode: "eager" });
     *
     * @example
     * // Load specific file only
     * const api = await builder.buildAPI({
     *   dir: "./api_tests/api_test",
     *   mode: "eager",
     *   fileFilter: (fileName) => fileName === "math.mjs"
     * });
     */
    public buildAPI(options: {
        dir?: string | undefined;
        mode?: string | undefined;
        ownership?: Object | undefined;
        contextManager?: Object | undefined;
        instanceID?: string | undefined;
        config?: Object | undefined;
        apiPathPrefix?: string | undefined;
        collisionContext?: string | undefined;
        moduleID?: string | undefined;
        cacheBust?: string | null | undefined;
        collisionMode?: string | null | undefined;
        fileFilter?: Function | null | undefined;
        syntheticExports?: Object | null | undefined;
        syntheticName?: string | undefined;
    }): Promise<Object>;
}
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=builder.d.mts.map