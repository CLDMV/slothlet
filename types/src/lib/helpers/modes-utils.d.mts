/**
 * Mode processing utilities component class
 * @extends ComponentBase
 */
export class ModesUtils {
    static slothletProperty: string;
    /**
     * Create a named wrapper for default export functions when they are anonymous.
     * NOTE: This function is now a pass-through since UnifiedWrapper handles name/length/toString
     * through its proxy get trap. Wrapping is no longer needed and causes toString mismatches.
     * @param {Function} fn - Original function.
     * @param {string} nameHint - Name to apply if fn is anonymous or named "default" (unused).
     * @returns {Function} Original function unmodified.
     * @public
     */
    public ensureNamedExportFunction(fn: Function, ____nameHint: any): Function;
    /**
     * Clone eager-mode module exports to avoid mutating import cache objects.
     * @param {unknown} value - Value to clone for wrapping
     * @param {string} mode - Current mode ("eager" or "lazy")
     * @returns {unknown} Cloned value for eager mode, original otherwise
     * @public
     */
    public cloneWrapperImpl(value: unknown, mode: string): unknown;
    /**
     * Helper to determine collision mode for ownership conflicts
     * @param {Object} config - Slothlet configuration
     * @param {string} collisionContext - Either 'initial' or 'api'
     * @returns {string} Collision mode from config
     * @public
     */
    public getOwnershipCollisionMode(config: any, collisionContext?: string): string;
}
//# sourceMappingURL=modes-utils.d.mts.map