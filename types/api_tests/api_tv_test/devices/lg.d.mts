/**
 * Powers on all TVs (mock)
 * @returns {Promise<boolean>} Success status
 */
export function powerOnAll(): Promise<boolean>;
/**
 * Powers off all TVs (mock)
 * @returns {Promise<boolean>} Success status
 */
export function powerOffAll(): Promise<boolean>;
/**
 * Gets TV status (mock)
 * @param {string} tvId - TV identifier
 * @returns {Promise<Object>} TV status
 */
export function getStatus(tvId: string): Promise<any>;
/**
 * Clear the TV controller cache (mock)
 */
export function clearCache(): void;
export default LGTVControllers;
/**
 * Combined LG TV Controller object (Slothlet-compatible)
 * Provides both named exports (lg.power.on, lg.volume.set) and array-style access (lg[0], lg.tv1)
 * Uses caching to ensure consistent instances: lg[0] === lg[0]
 */
declare const LGTVControllers: {};
//# sourceMappingURL=lg.d.mts.map