/**
 * Eager mode component - builds APIs by loading all modules immediately.
 * @class EagerMode
 * @extends ComponentBase
 * @package
 */
export class EagerMode extends ComponentBase {
    static slothletProperty: string;
    /**
     * Create EagerMode instance.
     * @param {object} slothlet - Slothlet orchestrator instance.
     * @package
     */
    constructor(slothlet: object);
    /**
     * Build API in eager mode (load all modules immediately).
     * @param {Object} options - Build options
     * @param {string} options.dir - Directory path to load from
     * @param {string} [options.apiPathPrefix=""] - Prefix for API paths
     * @param {string} [options.collisionContext="initial"] - Collision context
     * @param {string} [options.moduleID] - Module ID
     * @param {number} [options.apiDepth=Infinity] - Maximum directory depth
     * @param {string|null} [options.cacheBust=null] - Cache-busting value
     * @param {Function|null} [options.fileFilter=null] - Optional filter (fileName) => boolean
     * @returns {Promise<Object>} Built API object
     * @public
     *
     * @example
     * const api = await slothlet.modes.eager.buildAPI({ dir: "./api", moduleID: "base" });
     */
    public buildAPI({ dir, apiPathPrefix, collisionContext, moduleID, apiDepth, cacheBust, fileFilter }: {
        dir: string;
        apiPathPrefix?: string | undefined;
        collisionContext?: string | undefined;
        moduleID?: string | undefined;
        apiDepth?: number | undefined;
        cacheBust?: string | null | undefined;
        fileFilter?: Function | null | undefined;
    }): Promise<Object>;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=eager.d.mts.map