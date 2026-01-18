/**
 * Normalize runtime input to internal standard format
 * @param {string} runtime - Input runtime type (various formats accepted)
 * @returns {string} Normalized runtime type ("async" or "live")
 * @public
 */
export function normalizeRuntime(runtime: string): string;
/**
 * Normalize mode input to internal standard format
 * @param {string} mode - Input mode type (various formats accepted)
 * @returns {string} Normalized mode type ("eager" or "lazy")
 * @public
 */
export function normalizeMode(mode: string): string;
/**
 * Normalize debug configuration
 * @param {boolean|Object} debug - Debug flag or object with targeted flags
 * @returns {Object} Normalized debug object with all flags
 * @public
 */
export function normalizeDebug(debug: boolean | any): any;
/**
 * Transform and validate configuration
 * @param {Object} config - Raw configuration options
 * @returns {Object} Normalized configuration
 * @throws {SlothletError} If configuration is invalid
 * @public
 */
export function transformConfig(config?: any): any;
//# sourceMappingURL=config.d.mts.map