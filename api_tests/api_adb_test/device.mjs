/**
 * Device data system API module for Android TV Remote.
 * Provides device information management with caching and refresh capabilities.
 * @module device
 */

// Slothlet runtime imports for live bindings
import { self as _, context, reference } from "@cldmv/slothlet/runtime";
import { createDefaultsAPI } from "./utils/defaults.mjs";

// Internal device data state
let deviceData = {
	info: null,
	network: null,
	audio: null,
	power: null,
	display: null,
	app: null,
	lastRefresh: null
};

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
export async function get(key) {
	// Ensure we have fresh data
	await refresh();

	if (key) {
		return deviceData[key];
	}

	return { ...deviceData };
}

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
export function set(key, value) {
	if (typeof key === "object") {
		Object.assign(deviceData, key);
	} else {
		deviceData[key] = value;
	}

	deviceData.lastRefresh = new Date().toISOString();
}

/**
 * Merges device data with existing data.
 * @param {Object} dataObject - Device data object to merge
 * @param {boolean} [deep=false] - Whether to perform deep merge
 * @returns {Promise<Object>} Updated device data
 * @example
 * // Merge new device info
 * await api.device.merge({ info: newDeviceInfo });
 */
export async function merge(dataObject, deep = false) {
	if (deep) {
		// Deep merge implementation
		function deepMerge(target, source) {
			for (const key in source) {
				if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
					target[key] = target[key] || {};
					deepMerge(target[key], source[key]);
				} else {
					target[key] = source[key];
				}
			}
			return target;
		}

		deepMerge(deviceData, dataObject);
	} else {
		Object.assign(deviceData, dataObject);
	}

	deviceData.lastRefresh = new Date().toISOString();
	return get();
}

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
export async function refresh(keys, force = false) {
	const now = Date.now();
	const lastRefreshTime = deviceData.lastRefresh ? new Date(deviceData.lastRefresh).getTime() : 0;
	const shouldRefresh = force || !deviceData.lastRefresh || now - lastRefreshTime > 30000; // 30 seconds

	if (!shouldRefresh && !keys) {
		return get();
	}

	const keysArray = keys ? (Array.isArray(keys) ? keys : [keys]) : ["info", "network", "audio", "power", "display", "app"];

	try {
		const refreshPromises = [];

		if (keysArray.includes("info")) {
			refreshPromises.push(
				self.helpers.fetchDeviceProperties().then((info) => {
					deviceData.info = info;
					context.cachedDeviceInfo = info;
				})
			);
		}

		if (keysArray.includes("network")) {
			refreshPromises.push(
				self.helpers.fetchNetworkDetails().then((network) => {
					deviceData.network = network;
					context.cachedNetwork = network;
				})
			);
		}

		if (keysArray.includes("audio")) {
			refreshPromises.push(
				self.helpers.fetchAudioInfo().then((audio) => {
					deviceData.audio = audio;
					context.cachedAudioInfo = audio;
				})
			);
		}

		if (keysArray.includes("power")) {
			refreshPromises.push(
				self.connection.shell('dumpsys power | grep -E "(mIsPowered|mWakefulness|mWakeLocks|mScreenOn)"').then((output) => {
					deviceData.power = context.parsePowerState(output);
				})
			);
		}

		if (keysArray.includes("display")) {
			refreshPromises.push(
				self.display.getInfo().then((display) => {
					deviceData.display = display;
				})
			);
		}

		if (keysArray.includes("app")) {
			refreshPromises.push(
				self.helpers.fetchCurrentAppInfo().then((app) => {
					deviceData.app = app;
					context.lastKnownAppInfo = app;
				})
			);
		}

		await Promise.all(refreshPromises);
		deviceData.lastRefresh = new Date().toISOString();

		if (!context.quiet) {
			context.emitLog("debug", `Device data refreshed: ${keysArray.join(", ")}`, "device.refresh");
		}
	} catch (error) {
		context.localEmitError(error, "device.refresh", `Failed to refresh device data: ${keysArray.join(", ")}`);
		throw error;
	}

	return get();
}

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
export function clear(keys) {
	if (keys) {
		const keysArray = Array.isArray(keys) ? keys : [keys];
		keysArray.forEach((key) => {
			deviceData[key] = null;
		});
	} else {
		deviceData = {
			info: null,
			network: null,
			audio: null,
			power: null,
			display: null,
			app: null,
			lastRefresh: null
		};
	}
}

/**
 * Gets device data with display information included.
 * @returns {Promise<Object>} Complete device data including display
 * @example
 * const deviceWithDisplay = await api.device.withDisplay();
 * console.log('Display info:', deviceWithDisplay.display);
 */
export async function withDisplay() {
	await refresh(["info", "network", "audio", "power", "display", "app"]);
	return get();
}

/**
 * Gets basic device data without display information.
 * @returns {Promise<Object>} Basic device data
 * @example
 * const basicDevice = await api.device.basic();
 */
export async function basic() {
	await refresh(["info", "network", "audio", "power", "app"]);
	const data = await get();
	// Return without display
	const { display, ...basicData } = data;
	return basicData;
}

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
export async function snapshot(options = {}) {
	const { includeDisplay = true, refresh: shouldRefresh = false } = options;

	if (shouldRefresh) {
		if (includeDisplay) {
			await refresh();
		} else {
			await refresh(["info", "network", "audio", "power", "app"]);
		}
	}

	const data = await get();

	return {
		timestamp: new Date().toISOString(),
		data: includeDisplay ? data : (({ display, ...rest }) => rest)(data),
		lastRefresh: deviceData.lastRefresh,
		cacheAge: deviceData.lastRefresh ? Date.now() - new Date(deviceData.lastRefresh).getTime() : null
	};
}

// Initialize device data from context cache
if (context.cachedDeviceInfo) deviceData.info = context.cachedDeviceInfo;
if (context.cachedNetwork) deviceData.network = context.cachedNetwork;
if (context.cachedAudioInfo) deviceData.audio = context.cachedAudioInfo;
if (context.lastKnownAppInfo) deviceData.app = context.lastKnownAppInfo;

// Create defaults API for this data system
const defaultAPI = createDefaultsAPI(
	"device",
	() => get(), // getCurrentValues function
	(values) => set(values) // setValues function
);

// Default export object
const device = {
	get,
	set,
	merge,
	refresh,
	clear,
	withDisplay,
	basic,
	snapshot,
	default: defaultAPI
};

export default device;
