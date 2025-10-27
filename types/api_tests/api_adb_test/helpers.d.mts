/**
 * Fetches device properties from the Android system.
 * @param {string[]|null} [properties=null] - Specific properties to fetch, or null for all
 * @returns {Promise<Object>} Device properties object
 * @example
 * // Get all properties
 * const allProps = await api.helpers.fetchDeviceProperties();
 *
 * // Get specific properties
 * const specificProps = await api.helpers.fetchDeviceProperties(['ro.product.model', 'ro.build.version.release']);
 */
export function fetchDeviceProperties(properties?: string[] | null): Promise<any>;
/**
 * Fetches information about the currently running application.
 * @returns {Promise<Object|null>} Current app information or null
 * @example
 * const currentApp = await api.helpers.fetchCurrentAppInfo();
 * if (currentApp) {
 *   console.log('Current app:', currentApp.packageName);
 * }
 */
export function fetchCurrentAppInfo(): Promise<any | null>;
/**
 * Fetches the list of installed packages.
 * @param {boolean} [systemApps=false] - Include system apps
 * @param {boolean} [thirdPartyOnly=true] - Only third-party apps
 * @returns {Promise<string[]>} Array of package names
 * @example
 * const packages = await api.helpers.fetchInstalledPackages();
 * console.log('Installed packages:', packages.length);
 *
 * // Include system apps
 * const allPackages = await api.helpers.fetchInstalledPackages(true, false);
 */
export function fetchInstalledPackages(systemApps?: boolean, thirdPartyOnly?: boolean): Promise<string[]>;
/**
 * Fetches network connection details.
 * @returns {Promise<Object>} Network information object
 * @example
 * const network = await api.helpers.fetchNetworkDetails();
 * console.log('WiFi connected:', network.wifi.connected);
 */
export function fetchNetworkDetails(): Promise<any>;
/**
 * Fetches audio system information.
 * @returns {Promise<Object>} Audio information object
 * @example
 * const audio = await api.helpers.fetchAudioInfo();
 * console.log('Audio info:', audio);
 */
export function fetchAudioInfo(): Promise<any>;
/**
 * Resolves the default activity for a given package.
 * @param {string} packageName - The package name to resolve
 * @returns {Promise<string|null>} Default activity name or null
 * @example
 * const activity = await api.helpers.resolveDefaultActivity('com.netflix.ninja');
 * console.log('Default activity:', activity);
 */
export function resolveDefaultActivity(packageName: string): Promise<string | null>;
/**
 * Refreshes current app information and emits change events if needed.
 * @param {string} [reason="manual"] - Reason for refresh
 * @param {Object} [options={}] - Refresh options
 * @param {boolean} [options.forceEmit=false] - Force emit event even if app hasn't changed
 * @returns {Promise<Object|null>} Updated app information
 * @example
 * const appInfo = await api.helpers.refreshCurrentAppInfo();
 *
 * // Force emit event
 * await api.helpers.refreshCurrentAppInfo("user_action", { forceEmit: true });
 */
export function refreshCurrentAppInfo(reason?: string, options?: {
    forceEmit?: boolean;
}): Promise<any | null>;
/**
 * Collects comprehensive startup metadata from the device.
 * @param {string} [reason="init"] - Reason for collection
 * @returns {Promise<Object|null>} Collected metadata or null on error
 * @example
 * const metadata = await api.helpers.collectStartupMetadata();
 * console.log('Device metadata:', metadata);
 */
export function collectStartupMetadata(reason?: string): Promise<any | null>;
/**
 * Schedules an app info refresh with a delay.
 * @param {string} context - Context for the refresh
 * @param {Object} [options={}] - Schedule options
 * @param {boolean} [options.forceEmit=false] - Force emit event
 * @returns {void}
 * @example
 * api.helpers.scheduleAppInfoRefresh("home_pressed", { forceEmit: true });
 */
export function scheduleAppInfoRefresh(context: string, options?: {
    forceEmit?: boolean;
}): void;
//# sourceMappingURL=helpers.d.mts.map