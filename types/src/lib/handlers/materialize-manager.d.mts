/**
 * Manager for tracking lazy folder materialization state
 * @class MaterializeManager
 * @extends ComponentBase
 * @package
 *
 * @description
 * Provides access to lazy materialization state via `api.slothlet.materialize`.
 * Tracks count of unmaterialized lazy folders and provides boolean state, statistics,
 * and wait functionality for synchronization.
 *
 * @example
 * const api = await slothlet({ dir: "./api", mode: "lazy" });
 *
 * // Check if fully materialized
 * if (api.slothlet.materialize.materialized) {
 *   console.log("All lazy folders loaded!");
 * }
 *
 * // Get statistics
 * const stats = api.slothlet.materialize.get();
 * console.log(`${stats.percentage}% loaded (${stats.remaining}/${stats.total} remaining)`);
 *
 * // Wait for full materialization
 * await api.slothlet.materialize.wait();
 */
export class MaterializeManager extends ComponentBase {
    static slothletProperty: string;
    /**
     * Create MaterializeManager instance
     * @param {object} slothlet - Slothlet orchestrator instance
     * @package
     */
    constructor(slothlet: object);
    /**
     * Get materialization state as a boolean
     * Returns true when all lazy wrappers have been materialized
     * @returns {boolean} True if fully materialized, false if any lazy folders remain
     * @public
     *
     * @example
     * if (api.slothlet.materialize.materialized) {
     *   console.log("API is fully loaded");
     * }
     */
    public get materialized(): boolean;
    /**
     * Get detailed materialization statistics
     * @returns {Object} Statistics object with total, materialized, remaining, percentage
     * @public
     *
     * @example
     * const stats = api.slothlet.materialize.get();
     * // { total: 5, materialized: 3, remaining: 2, percentage: 60 }
     */
    public get(): any;
    /**
     * Wait for full materialization (all lazy folders loaded)
     * Returns immediately if already fully materialized
     * @returns {Promise<void>} Resolves when all lazy wrappers have materialized
     * @public
     *
     * @example
     * // Wait for API to fully load
     * await api.slothlet.materialize.wait();
     * console.log("All modules loaded!");
     *
     * @example
     * // Wait with timeout
     * const timeoutPromise = new Promise((_, reject) =>
     *   setTimeout(() => reject(new Error("Timeout")), 5000)
     * );
     * await Promise.race([
     *   api.slothlet.materialize.wait(),
     *   timeoutPromise
     * ]);
     */
    public wait(): Promise<void>;
}
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=materialize-manager.d.mts.map