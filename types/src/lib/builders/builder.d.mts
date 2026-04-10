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
     * Build API from directory or file.
     * @param {Object} options - Build options
     * @param {string} options.dir - Directory or file to build from
     * @param {string} [options.mode="eager"] - Loading mode (eager or lazy)
     * @param {Object} [options.ownership] - Ownership manager (uses slothlet's if not provided)
     * @param {Object} [options.contextManager] - Context manager (uses slothlet's if not provided)
     * @param {string} [options.instanceID] - Instance ID (uses slothlet's if not provided)
     * @param {Object} [options.config] - Configuration (uses slothlet's if not provided)
     * @param {string} [options.apiPathPrefix=""] - Prefix for API paths (for api.add support)
     * @param {string} [options.collisionContext="initial"] - Collision context
     * @param {Function|null} [options.fileFilter=null] - Optional filter function (fileName) => boolean to load specific files only
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
        dir: string;
        mode?: string;
        ownership?: any;
        contextManager?: any;
        instanceID?: string;
        config?: any;
        apiPathPrefix?: string;
        collisionContext?: string;
        fileFilter?: Function | null;
    }): Promise<any>;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=builder.d.mts.map