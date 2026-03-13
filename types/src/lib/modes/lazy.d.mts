/**
 * Lazy mode component - builds APIs with deferred (on-demand) loading.
 * @class LazyMode
 * @extends ComponentBase
 * @package
 */
export class LazyMode extends ComponentBase {
    static slothletProperty: string;
    /**
     * Create a named async materialization function for lazy subdirectories.
     * @param {string} apiPath - API path to derive the function name from.
     * @param {Function} handler - Async handler that performs materialization.
     * @returns {Function} Named async materialization function.
     * @public
     *
     * @example
     * const fn = lazyMode.createNamedMaterializeFunc('api.math', async () => ({ add: (a,b) => a+b }));
     */
    public createNamedMaterializeFunc(apiPath: string, handler: Function): Function;
    /**
     * Build API in lazy mode (proxy-based deferred loading).
     * @param {Object} options - Build options
     * @param {string} options.dir - Directory to build from
     * @param {string} [options.apiPathPrefix=""] - Prefix for API paths
     * @param {string} [options.collisionContext="initial"] - Collision context
     * @param {string|null} [options.collisionMode=null] - Collision mode override from api.add()
     * @param {string} [options.moduleID] - Module ID
     * @param {number} [options.apiDepth=Infinity] - Maximum directory depth
     * @param {string|null} [options.cacheBust=null] - Cache-busting value
     * @param {Function|null} [options.fileFilter=null] - Optional filter (fileName) => boolean
     * @returns {Promise<Object>} Built API object with lazy proxies
     * @public
     *
     * @example
     * const api = await slothlet.modes.lazy.buildAPI({ dir: "./api", moduleID: "base" });
     */
    public buildAPI({ dir, apiPathPrefix, collisionContext, collisionMode, moduleID, apiDepth, cacheBust, fileFilter }: {
        dir: string;
        apiPathPrefix?: string;
        collisionContext?: string;
        collisionMode?: string | null;
        moduleID?: string;
        apiDepth?: number;
        cacheBust?: string | null;
        fileFilter?: Function | null;
    }): Promise<any>;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=lazy.d.mts.map