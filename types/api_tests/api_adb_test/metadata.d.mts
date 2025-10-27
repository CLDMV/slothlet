/**
 * Gets metadata.
 * @param {string} [key] - Specific metadata key, or undefined for entire metadata
 * @returns {Promise<any>} Metadata value(s)
 * @example
 * // Get entire metadata
 * const metadata = await api.metadata.get();
 *
 * // Get specific metadata
 * const deviceMeta = await api.metadata.get('device');
 * const networkMeta = await api.metadata.get('network');
 */
export function get(key?: string): Promise<any>;
/**
 * Sets metadata (primarily for caching).
 * @param {string|Object} key - Metadata key or object of key-value pairs
 * @param {any} [value] - Value to set (if key is string)
 * @returns {void}
 * @example
 * // Set single value
 * api.metadata.set('device', deviceMetadata);
 *
 * // Set multiple values
 * api.metadata.set({
 *   device: deviceMeta,
 *   network: networkMeta
 * });
 */
export function set(key: string | any, value?: any): void;
/**
 * Merges metadata with existing metadata.
 * @param {Object} metaObject - Metadata object to merge
 * @param {boolean} [deep=false] - Whether to perform deep merge
 * @returns {Promise<Object>} Updated metadata
 * @example
 * // Merge new metadata
 * await api.metadata.merge({ device: newDeviceMeta });
 */
export function merge(metaObject: any, deep?: boolean): Promise<any>;
/**
 * Refreshes metadata by collecting it from the device.
 * @param {string} [reason="manual"] - Reason for refresh
 * @param {boolean} [force=false] - Force refresh even if recently updated
 * @returns {Promise<Object>} Updated metadata
 * @example
 * // Refresh metadata
 * await api.metadata.refresh("user_requested");
 *
 * // Force refresh
 * await api.metadata.refresh("force_update", true);
 */
export function refresh(reason?: string, force?: boolean): Promise<any>;
/**
 * Collects fresh metadata from the device.
 * @param {string} [reason="collect"] - Reason for collection
 * @returns {Promise<Object>} Collected metadata
 * @example
 * const freshMetadata = await api.metadata.collect("initialization");
 */
export function collect(reason?: string): Promise<any>;
/**
 * Clears cached metadata.
 * @param {string|string[]} [keys] - Specific keys to clear, or undefined to clear all
 * @returns {void}
 * @example
 * // Clear all metadata
 * api.metadata.clear();
 *
 * // Clear specific metadata
 * api.metadata.clear(['device', 'network']);
 * api.metadata.clear('packages');
 */
export function clear(keys?: string | string[]): void;
/**
 * Gets the age of the metadata cache.
 * @returns {Object} Cache age information
 * @example
 * const age = api.metadata.age();
 * console.log('Metadata is', age.minutes, 'minutes old');
 */
export function age(): any;
/**
 * Gets startup-specific metadata.
 * @returns {Promise<Object|null>} Startup metadata
 * @example
 * const startup = await api.metadata.startup();
 * if (startup) {
 *   console.log('Startup reason:', startup.reason);
 * }
 */
export function startup(): Promise<any | null>;
/**
 * Gets device-specific metadata.
 * @returns {Promise<Object|null>} Device metadata
 * @example
 * const deviceMeta = await api.metadata.device();
 */
export function deviceMeta(): Promise<any | null>;
/**
 * Gets network-specific metadata.
 * @returns {Promise<Object|null>} Network metadata
 * @example
 * const networkMeta = await api.metadata.network();
 */
export function networkMeta(): Promise<any | null>;
/**
 * Gets packages metadata.
 * @returns {Promise<Array|null>} Packages metadata
 * @example
 * const packages = await api.metadata.packages();
 * console.log('Installed packages:', packages?.length);
 */
export function packages(): Promise<any[] | null>;
/**
 * Gets a snapshot of the current metadata state.
 * @param {boolean} [includeAge=true] - Include age information
 * @returns {Promise<Object>} Metadata snapshot with metadata
 * @example
 * const snapshot = await api.metadata.snapshot();
 * console.log('Metadata snapshot:', snapshot);
 */
export function snapshot(includeAge?: boolean): Promise<any>;
export default metadata;
declare namespace metadata {
    export { get };
    export { set };
    export { merge };
    export { refresh };
    export { collect };
    export { clear };
    export { age };
    export { startup };
    export { deviceMeta as device };
    export { networkMeta as network };
    export { packages };
    export { snapshot };
    export { defaultAPI as default };
}
declare const defaultAPI: any;
//# sourceMappingURL=metadata.d.mts.map