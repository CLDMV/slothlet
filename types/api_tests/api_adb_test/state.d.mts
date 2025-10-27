/**
 * Gets the current configuration settings.
 * @returns {Object} Configuration object
 * @example
 * const config = api.state.getConfig();
 * console.log('Host:', config.host);
 * console.log('Port:', config.port);
 */
export function getConfig(): any;
/**
 * Gets the current connection state.
 * @returns {Promise<Object>} Connection state information
 * @example
 * const connectionState = await api.state.getConnectionState();
 * console.log('Connected:', connectionState.connected);
 * console.log('Status:', connectionState.status);
 */
export function getConnectionState(): Promise<any>;
/**
 * Gets default configuration values.
 * @returns {Object} Default configuration object
 * @example
 * const defaults = api.state.getDefaults();
 * console.log('Default port:', defaults.port);
 */
export function getDefaults(): any;
/**
 * Gets device metadata collected during initialization.
 * @returns {Promise<Object>} Device metadata object
 * @example
 * const metadata = await api.state.getMetadata();
 * console.log('Device model:', metadata.device?.model);
 * console.log('Android version:', metadata.device?.version);
 */
export function getMetadata(): Promise<any>;
/**
 * Gets basic device information without display info.
 * @returns {Promise<Object>} Device information object
 * @example
 * const device = await api.state.getDevice();
 * console.log('Device info:', device);
 */
export function getDevice(): Promise<any>;
/**
 * Gets comprehensive device information including display details.
 * @returns {Promise<Object>} Complete device information object
 * @example
 * const deviceWithDisplay = await api.state.getDeviceWithDisplay();
 * console.log('Display info:', deviceWithDisplay.display);
 */
export function getDeviceWithDisplay(): Promise<any>;
/**
 * Gets the current application state.
 * @returns {Promise<Object|null>} Current application information
 * @example
 * const currentApp = await api.state.getCurrentApp();
 * if (currentApp) {
 *   console.log('Current app:', currentApp.packageName);
 * }
 */
export function getCurrentApp(): Promise<any | null>;
/**
 * Gets device power state information.
 * @returns {Promise<Object>} Power state information
 * @example
 * const powerState = await api.state.getPowerState();
 * console.log('Device awake:', powerState.mWakefulness === 'Awake');
 */
export function getPowerState(): Promise<any>;
/**
 * Gets current audio state information.
 * @returns {Promise<Object|null>} Audio state information
 * @example
 * const audioState = await api.state.getAudioState();
 * if (audioState) {
 *   console.log('Audio info:', audioState);
 * }
 */
export function getAudioState(): Promise<any | null>;
/**
 * Gets network information for the device.
 * @returns {Promise<Object|null>} Network information
 * @example
 * const networkInfo = await api.state.getNetworkInfo();
 * if (networkInfo) {
 *   console.log('WiFi connected:', networkInfo.wifi.connected);
 * }
 */
export function getNetworkInfo(): Promise<any | null>;
/**
 * Gets the list of installed packages.
 * @param {Object} [options={}] - Options for package listing
 * @param {boolean} [options.systemApps=false] - Include system apps
 * @param {boolean} [options.thirdPartyOnly=true] - Only third-party apps
 * @returns {Promise<string[]>} Array of package names
 * @example
 * const packages = await api.state.getInstalledPackages();
 * console.log('Installed apps:', packages.length);
 */
export function getInstalledPackages(options?: {
    systemApps?: boolean;
    thirdPartyOnly?: boolean;
}): Promise<string[]>;
/**
 * Refreshes device information cache.
 * @param {Object} [options={}] - Refresh options
 * @param {boolean} [options.force=false] - Force refresh even if recently updated
 * @returns {Promise<void>}
 * @example
 * // Refresh device info
 * await api.state.refreshDeviceInfo();
 *
 * // Force refresh
 * await api.state.refreshDeviceInfo({ force: true });
 */
export function refreshDeviceInfo(options?: {
    force?: boolean;
}): Promise<void>;
/**
 * Refreshes application information cache.
 * @returns {Promise<void>}
 * @example
 * await api.state.refreshAppInfo();
 */
export function refreshAppInfo(): Promise<void>;
/**
 * Refreshes network information cache.
 * @returns {Promise<void>}
 * @example
 * await api.state.refreshNetworkInfo();
 */
export function refreshNetworkInfo(): Promise<void>;
/**
 * Refreshes audio information cache.
 * @returns {Promise<void>}
 * @example
 * await api.state.refreshAudioInfo();
 */
export function refreshAudioInfo(): Promise<void>;
/**
 * Refreshes all cached information.
 * @returns {Promise<void>}
 * @example
 * // Refresh everything
 * await api.state.refreshAll();
 */
export function refreshAll(): Promise<void>;
/**
 * Creates a complete snapshot of the current device state.
 * @param {Object} [options={}] - Snapshot options
 * @param {boolean} [options.includeDisplay=true] - Include display information
 * @param {boolean} [options.compact=false] - Create compact snapshot
 * @returns {Promise<Object>} Complete device state snapshot
 * @example
 * const snapshot = await api.state.createSnapshot();
 * console.log('Device snapshot:', snapshot);
 *
 * // Compact snapshot without display
 * const compactSnapshot = await api.state.createSnapshot({
 *   includeDisplay: false,
 *   compact: true
 * });
 */
export function createSnapshot(options?: {
    includeDisplay?: boolean;
    compact?: boolean;
}): Promise<any>;
//# sourceMappingURL=state.d.mts.map