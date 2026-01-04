/**
 * Device data fetching utilities for Android TV Remote.
 * Provides functions to fetch device properties, app info, network details, etc.
 * @module helpers
 */

// Slothlet runtime imports for live bindings
import { self as _, context, reference } from "@cldmv/slothlet/runtime";

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
export async function fetchDeviceProperties(properties = null) {
	if (properties && Array.isArray(properties)) {
		const results = {};
		for (const prop of properties) {
			try {
				results[prop] = await self.connection.shell(`getprop ${prop}`);
			} catch (error) {
				results[prop] = null;
				if (!context.quiet) {
					context.emitLog("debug", `Could not get property ${prop}: ${error.message}`, "fetchDeviceProperties");
				}
			}
		}
		return results;
	}

	const output = await self.connection.shell("getprop", { trim: false });
	const props = {};
	output.split("\n").forEach((line) => {
		const match = line.match(/\[([^\]]+)\]: \[([^\]]*)\]/);
		if (match) {
			props[match[1]] = match[2];
		}
	});
	return props;
}

/**
 * Fetches information about the currently running application.
 * @returns {Promise<Object|null>} Current app information or null
 * @example
 * const currentApp = await api.helpers.fetchCurrentAppInfo();
 * if (currentApp) {
 *   console.log('Current app:', currentApp.packageName);
 * }
 */
export async function fetchCurrentAppInfo() {
	const output = await self.connection.shell("dumpsys activity activities | grep 'mResumedActivity'");
	const lines = output
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	if (lines.length === 0) return null;

	const lastLine = lines[lines.length - 1];
	const parts = lastLine.split(" ").filter(Boolean);

	let packageName = null;
	let activityName = null;

	for (const part of parts) {
		if (part.includes("/")) {
			packageName = parts[0];
			activityName = part;
			break;
		}
	}

	if (packageName) {
		try {
			const versionResult = await self.connection.shell(`dumpsys package ${packageName} | grep versionName`);
			const versionName = versionResult.match(/versionName=([^\s]+)/)?.[1] || null;

			const labelResult = await self.connection.shell(`pm dump ${packageName} | grep "application-label"`, { trim: false });
			const labelMatch = labelResult.match(/application-label:'([^']+)'/);
			const applicationLabel = labelMatch ? labelMatch[1] : null;

			return {
				packageName,
				activityName,
				versionName,
				applicationLabel,
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			return {
				packageName,
				activityName,
				versionName: null,
				applicationLabel: null,
				timestamp: new Date().toISOString()
			};
		}
	}

	return null;
}

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
export async function fetchInstalledPackages(systemApps = false, thirdPartyOnly = true) {
	let command = "pm list packages";

	if (thirdPartyOnly && !systemApps) {
		command += " -3"; // Third-party only
	} else if (systemApps && !thirdPartyOnly) {
		command += " -s"; // System only
	}
	// If both or neither, get all packages

	const output = await self.connection.shell(command);
	return output
		.split("\n")
		.map((line) => line.replace("package:", "").trim())
		.filter(Boolean);
}

/**
 * Fetches network connection details.
 * @returns {Promise<Object>} Network information object
 * @example
 * const network = await api.helpers.fetchNetworkDetails();
 * console.log('WiFi connected:', network.wifi.connected);
 */
export async function fetchNetworkDetails() {
	try {
		const wifiInfo = await self.connection.shell("dumpsys wifi | grep 'Wi-Fi is'");
		const ethernetInfo = await self.connection.shell("ifconfig eth0 2>/dev/null || echo 'No ethernet'");

		return {
			wifi: { connected: wifiInfo.includes("enabled") },
			ethernet: { connected: !ethernetInfo.includes("No ethernet") },
			activeConnection: wifiInfo.includes("enabled") ? "wifi" : "ethernet"
		};
	} catch (error) {
		return {
			wifi: { connected: false },
			ethernet: { connected: false },
			activeConnection: null
		};
	}
}

/**
 * Fetches audio system information.
 * @returns {Promise<Object>} Audio information object
 * @example
 * const audio = await api.helpers.fetchAudioInfo();
 * console.log('Audio info:', audio);
 */
export async function fetchAudioInfo() {
	try {
		const output = await self.connection.shell("dumpsys audio | grep -E '(volume|mute)'");
		// Simplified parsing - can be expanded for more detailed audio info
		return {
			master: {
				volume: null,
				mute: null
			}
		};
	} catch (error) {
		return {
			master: {
				volume: null,
				mute: null
			}
		};
	}
}

/**
 * Resolves the default activity for a given package.
 * @param {string} packageName - The package name to resolve
 * @returns {Promise<string|null>} Default activity name or null
 * @example
 * const activity = await api.helpers.resolveDefaultActivity('com.netflix.ninja');
 * console.log('Default activity:', activity);
 */
export async function resolveDefaultActivity(packageName) {
	try {
		const output = await self.connection.shell(`cmd package resolve-activity --brief ${packageName}`);
		const lines = output
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		const component = lines.pop();

		if (!component || component.includes("no activity")) {
			return null;
		}

		return component.includes("/") ? component : `${packageName}/${component}`;
	} catch (error) {
		return null;
	}
}

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
export async function refreshCurrentAppInfo(reason = "manual", options = {}) {
	const { forceEmit = false } = options;
	const newAppInfo = await fetchCurrentAppInfo();

	if (forceEmit || newAppInfo?.packageName !== context.lastKnownAppInfo?.packageName) {
		const previousApp = context.lastKnownAppInfo;
		context.lastKnownAppInfo = newAppInfo;

		if (forceEmit || previousApp) {
			context.emitter.emit("app.changed", {
				timestamp: new Date().toISOString(),
				host: context.host,
				current: newAppInfo,
				previous: previousApp
			});
		}
	}

	return newAppInfo;
}

/**
 * Collects comprehensive startup metadata from the device.
 * @param {string} [reason="init"] - Reason for collection
 * @returns {Promise<Object|null>} Collected metadata or null on error
 * @example
 * const metadata = await api.helpers.collectStartupMetadata();
 * console.log('Device metadata:', metadata);
 */
export async function collectStartupMetadata(reason = "init") {
	context.lastStartupMetadataReason = reason;
	context.lastMetadataRefreshTimestamp = new Date().toISOString();

	try {
		const [deviceInfo, networkInfo, audioInfo, installedPackages, currentApp] = await Promise.all([
			fetchDeviceProperties(),
			fetchNetworkDetails(),
			fetchAudioInfo(),
			fetchInstalledPackages(),
			fetchCurrentAppInfo()
		]);

		context.cachedDeviceInfo = deviceInfo;
		context.cachedNetwork = networkInfo;
		context.cachedAudioInfo = audioInfo;
		context.cachedInstalledPackages = installedPackages;
		context.lastKnownAppInfo = currentApp;

		return {
			device: deviceInfo,
			network: networkInfo,
			audio: audioInfo,
			packages: installedPackages,
			app: currentApp
		};
	} catch (error) {
		if (!context.quiet) {
			context.emitLog("warn", `Metadata collection failed: ${error.message}`, "collectStartupMetadata");
		}
		return null;
	}
}

/**
 * Schedules an app info refresh with a delay.
 * @param {string} context - Context for the refresh
 * @param {Object} [options={}] - Schedule options
 * @param {boolean} [options.forceEmit=false] - Force emit event
 * @returns {void}
 * @example
 * api.helpers.scheduleAppInfoRefresh("home_pressed", { forceEmit: true });
 */
export function scheduleAppInfoRefresh(context, options = {}) {
	if (context.pendingAppInfoRefresh) return;

	context.pendingAppInfoRefresh = true;

	setTimeout(async () => {
		try {
			await refreshCurrentAppInfo(context, options);
		} catch (error) {
			if (!context.quiet) {
				context.emitLog("debug", `Scheduled app refresh failed: ${error.message}`, "scheduleAppInfoRefresh");
			}
		} finally {
			context.pendingAppInfoRefresh = false;
		}
	}, context.APP_REFRESH_DELAY_MS);
}
