/**
 * Gets device data.
 * @param {string} [key] - Specific device data key, or undefined for entire device data
 * @returns {Promise<any>} Device data value(s)
 * @example
 * // Get entire device data
 * const device = await api.device.get();
 *
 * // Get specific data
 * const info = await api.device.get('info');
 * const network = await api.device.get('network');
 */
export function get(key?: string): Promise<any>;
/**
 * Sets device data (primarily for caching).
 * @param {string|Object} key - Device data key or object of key-value pairs
 * @param {any} [value] - Value to set (if key is string)
 * @returns {void}
 * @example
 * // Set single value
 * api.device.set('info', deviceInfo);
 *
 * // Set multiple values
 * api.device.set({
 *   info: deviceInfo,
 *   network: networkInfo
 * });
 */
export function set(key: string | any, value?: any): void;
/**
 * Merges device data with existing data.
 * @param {Object} dataObject - Device data object to merge
 * @param {boolean} [deep=false] - Whether to perform deep merge
 * @returns {Promise<Object>} Updated device data
 * @example
 * // Merge new device info
 * await api.device.merge({ info: newDeviceInfo });
 */
export function merge(dataObject: any, deep?: boolean): Promise<any>;
/**
 * Refreshes device data from the device.
 * @param {string|string[]} [keys] - Specific keys to refresh, or undefined to refresh all
 * @param {boolean} [force=false] - Force refresh even if recently updated
 * @returns {Promise<Object>} Updated device data
 * @example
 * // Refresh all device data
 * await api.device.refresh();
 *
 * // Refresh specific data
 * await api.device.refresh(['info', 'network']);
 * await api.device.refresh('power');
 */
export function refresh(keys?: string | string[], force?: boolean): Promise<any>;
/**
 * Clears cached device data.
 * @param {string|string[]} [keys] - Specific keys to clear, or undefined to clear all
 * @returns {void}
 * @example
 * // Clear all cached data
 * api.device.clear();
 *
 * // Clear specific data
 * api.device.clear(['info', 'network']);
 * api.device.clear('power');
 */
export function clear(keys?: string | string[]): void;
/**
 * Gets device data with display information included.
 * @returns {Promise<Object>} Complete device data including display
 * @example
 * const deviceWithDisplay = await api.device.withDisplay();
 * console.log('Display info:', deviceWithDisplay.display);
 */
export function withDisplay(): Promise<any>;
/**
 * Gets basic device data without display information.
 * @returns {Promise<Object>} Basic device data
 * @example
 * const basicDevice = await api.device.basic();
 */
export function basic(): Promise<any>;
/**
 * Gets a snapshot of the current device state.
 * @param {Object} [options={}] - Snapshot options
 * @param {boolean} [options.includeDisplay=true] - Include display information
 * @param {boolean} [options.refresh=false] - Refresh data before snapshot
 * @returns {Promise<Object>} Device data snapshot with metadata
 * @example
 * const snapshot = await api.device.snapshot();
 * console.log('Device snapshot:', snapshot);
 */
export function snapshot(options?: {
    includeDisplay?: boolean;
    refresh?: boolean;
}): Promise<any>;
export default device;
declare namespace device {
    export { get };
    export { set };
    export { merge };
    export { refresh };
    export { clear };
    export { withDisplay };
    export { basic };
    export { snapshot };
    export { defaultAPI as default };
}
declare const defaultAPI: any;
//# sourceMappingURL=device.d.mts.map