/**
 * Launches an application by package name.
 * @param {string} packageName - The package name of the app to launch
 * @param {Object} [options={}] - Launch options
 * @param {string} [options.activity] - Specific activity to launch (optional)
 * @param {boolean} [options.clearTop=false] - Clear other activities on top
 * @param {number} [options.delay=2000] - Delay after launch in ms
 * @returns {Promise<void>}
 * @example
 * await api.app.launch("com.netflix.ninja");
 *
 * // Launch with specific activity
 * await api.app.launch("com.android.settings", {
 *   activity: ".Settings"
 * });
 */
export function launch(packageName: string, options?: {
    activity?: string;
    clearTop?: boolean;
    delay?: number;
}): Promise<void>;
/**
 * Stops an application by package name.
 * @param {string} packageName - The package name of the app to stop
 * @returns {Promise<void>}
 */
export function stop(packageName: string): Promise<void>;
/**
 * Gets the currently running app.
 * @param {Object} [options={}] - Options
 * @returns {Promise<Object>} Current app info
 */
export function getCurrentApp(options?: any): Promise<any>;
/**
 * Refreshes the app state.
 * @returns {Promise<void>}
 */
export function refresh(): Promise<void>;
/**
 * Gets installed packages.
 * @param {Object} [options={}] - Options
 * @returns {Promise<string[]>} List of package names
 */
export function getInstalledPackages(options?: any): Promise<string[]>;
/**
 * Starts monitoring app changes.
 * @param {Object} [options={}] - Monitor options
 * @returns {Promise<void>}
 */
export function startMonitoring(options?: any): Promise<void>;
/**
 * Stops monitoring app changes.
 * @returns {Promise<void>}
 */
export function stopMonitoring(): Promise<void>;
/**
 * Clears app data.
 * @param {string} packageName - Package name to clear
 * @param {Object} [options={}] - Clear options
 * @returns {Promise<void>}
 */
export function clearData(packageName: string, options?: any): Promise<void>;
/**
 * Enables or disables an app.
 * @param {string} packageName - Package name
 * @param {boolean} enabled - Whether to enable the app
 * @returns {Promise<void>}
 */
export function setEnabled(packageName: string, enabled: boolean): Promise<void>;
/**
 * Gets package information.
 * @param {string} packageName - Package name to get info for
 * @returns {Promise<Object>} Package info
 */
export function getPackageInfo(packageName: string): Promise<any>;
/**
 * Uninstalls an app.
 * @param {string} packageName - Package name to uninstall
 * @param {Object} [options={}] - Uninstall options
 * @returns {Promise<void>}
 */
export function uninstall(packageName: string, options?: any): Promise<void>;
/**
 * Gets the current package name.
 * @returns {Promise<string>} Current package name
 */
export function getCurrentPackage(): Promise<string>;
/**
 * Gets the current activity name.
 * @returns {Promise<string>} Current activity name
 */
export function getCurrentActivity(): Promise<string>;
export default app;
declare namespace app {
    export { launch };
    export { stop };
    export { getCurrentApp };
    export { refresh };
    export { getInstalledPackages };
    export { startMonitoring };
    export { stopMonitoring };
    export { clearData };
    export { setEnabled };
    export { getPackageInfo };
    export { uninstall };
    export { getCurrentPackage };
    export { getCurrentActivity };
}
//# sourceMappingURL=app.d.mts.map