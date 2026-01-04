/**
 * Metadata data system API module for Android TV Remote.
 * Provides metadata collection and management with age tracking.
 * @module metadata
 */

// Slothlet runtime imports for live bindings
import { self as _, context, reference } from "@cldmv/slothlet/runtime";
import { createDefaultsAPI } from "./utils/defaults.mjs";

// Internal metadata state
let metadataState = {
	device: null,
	network: null,
	audio: null,
	packages: null,
	startup: null,
	lastRefresh: null,
	refreshReason: null
};

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
export async function get(key) {
	// Auto-refresh if data is stale (5 minutes)
	const now = Date.now();
	const lastRefreshTime = metadataState.lastRefresh ? new Date(metadataState.lastRefresh).getTime() : 0;
	if (!metadataState.lastRefresh || now - lastRefreshTime > 300000) {
		await refresh();
	}

	if (key) {
		return metadataState[key];
	}

	return { ...metadataState };
}

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
export function set(key, value) {
	if (typeof key === "object") {
		Object.assign(metadataState, key);
	} else {
		metadataState[key] = value;
	}

	metadataState.lastRefresh = new Date().toISOString();
}

/**
 * Merges metadata with existing metadata.
 * @param {Object} metaObject - Metadata object to merge
 * @param {boolean} [deep=false] - Whether to perform deep merge
 * @returns {Promise<Object>} Updated metadata
 * @example
 * // Merge new metadata
 * await api.metadata.merge({ device: newDeviceMeta });
 */
export async function merge(metaObject, deep = false) {
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

		deepMerge(metadataState, metaObject);
	} else {
		Object.assign(metadataState, metaObject);
	}

	metadataState.lastRefresh = new Date().toISOString();
	return get();
}

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
export async function refresh(reason = "manual", force = false) {
	const now = Date.now();
	const lastRefreshTime = metadataState.lastRefresh ? new Date(metadataState.lastRefresh).getTime() : 0;
	const shouldRefresh = force || !metadataState.lastRefresh || now - lastRefreshTime > 60000; // 1 minute

	if (!shouldRefresh) {
		return get();
	}

	try {
		if (!context.quiet) {
			context.emitLog("debug", `Refreshing metadata: ${reason}`, "metadata.refresh");
		}

		// Collect metadata from helpers
		const collectedMetadata = await self.helpers.collectStartupMetadata(reason);

		if (collectedMetadata) {
			metadataState.device = collectedMetadata.device;
			metadataState.network = collectedMetadata.network;
			metadataState.audio = collectedMetadata.audio;
			metadataState.packages = collectedMetadata.packages;
			metadataState.startup = {
				reason,
				timestamp: new Date().toISOString(),
				app: collectedMetadata.app
			};
		}

		metadataState.lastRefresh = new Date().toISOString();
		metadataState.refreshReason = reason;

		// Update context references
		context.lastMetadataRefreshTimestamp = metadataState.lastRefresh;
		context.lastStartupMetadataReason = reason;
	} catch (error) {
		context.localEmitError(error, "metadata.refresh", `Failed to refresh metadata: ${reason}`);
		throw error;
	}

	return get();
}

/**
 * Collects fresh metadata from the device.
 * @param {string} [reason="collect"] - Reason for collection
 * @returns {Promise<Object>} Collected metadata
 * @example
 * const freshMetadata = await api.metadata.collect("initialization");
 */
export async function collect(reason = "collect") {
	return await refresh(reason, true);
}

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
export function clear(keys) {
	if (keys) {
		const keysArray = Array.isArray(keys) ? keys : [keys];
		keysArray.forEach((key) => {
			metadataState[key] = null;
		});
	} else {
		metadataState = {
			device: null,
			network: null,
			audio: null,
			packages: null,
			startup: null,
			lastRefresh: null,
			refreshReason: null
		};
	}
}

/**
 * Gets the age of the metadata cache.
 * @returns {Object} Cache age information
 * @example
 * const age = api.metadata.age();
 * console.log('Metadata is', age.minutes, 'minutes old');
 */
export function age() {
	if (!metadataState.lastRefresh) {
		return { milliseconds: null, seconds: null, minutes: null, isStale: true };
	}

	const now = Date.now();
	const lastRefreshTime = new Date(metadataState.lastRefresh).getTime();
	const ageMs = now - lastRefreshTime;

	return {
		milliseconds: ageMs,
		seconds: Math.round(ageMs / 1000),
		minutes: Math.round(ageMs / 60000),
		isStale: ageMs > 300000 // 5 minutes
	};
}

/**
 * Gets startup-specific metadata.
 * @returns {Promise<Object|null>} Startup metadata
 * @example
 * const startup = await api.metadata.startup();
 * if (startup) {
 *   console.log('Startup reason:', startup.reason);
 * }
 */
export async function startup() {
	const meta = await get();
	return meta.startup || null;
}

/**
 * Gets device-specific metadata.
 * @returns {Promise<Object|null>} Device metadata
 * @example
 * const deviceMeta = await api.metadata.device();
 */
export async function deviceMeta() {
	const meta = await get();
	return meta.device || null;
}

/**
 * Gets network-specific metadata.
 * @returns {Promise<Object|null>} Network metadata
 * @example
 * const networkMeta = await api.metadata.network();
 */
export async function networkMeta() {
	const meta = await get();
	return meta.network || null;
}

/**
 * Gets packages metadata.
 * @returns {Promise<Array|null>} Packages metadata
 * @example
 * const packages = await api.metadata.packages();
 * console.log('Installed packages:', packages?.length);
 */
export async function packages() {
	const meta = await get();
	return meta.packages || null;
}

/**
 * Gets a snapshot of the current metadata state.
 * @param {boolean} [includeAge=true] - Include age information
 * @returns {Promise<Object>} Metadata snapshot with metadata
 * @example
 * const snapshot = await api.metadata.snapshot();
 * console.log('Metadata snapshot:', snapshot);
 */
export async function snapshot(includeAge = true) {
	const meta = await get();
	const result = {
		timestamp: new Date().toISOString(),
		metadata: meta,
		refreshReason: metadataState.refreshReason
	};

	if (includeAge) {
		result.age = age();
	}

	return result;
}

// Initialize metadata from context
if (context.cachedDeviceInfo) metadataState.device = context.cachedDeviceInfo;
if (context.cachedNetwork) metadataState.network = context.cachedNetwork;
if (context.cachedAudioInfo) metadataState.audio = context.cachedAudioInfo;
if (context.cachedInstalledPackages) metadataState.packages = context.cachedInstalledPackages;
if (context.lastMetadataRefreshTimestamp) metadataState.lastRefresh = context.lastMetadataRefreshTimestamp;
if (context.lastStartupMetadataReason) metadataState.refreshReason = context.lastStartupMetadataReason;

// Create defaults API for this data system
const defaultAPI = createDefaultsAPI(
	"metadata",
	() => metadataState, // getCurrentValues function
	(values) => set(values) // setValues function
);

// Default export object
const metadata = {
	get,
	set,
	merge,
	refresh,
	collect,
	clear,
	age,
	startup,
	device: deviceMeta,
	network: networkMeta,
	packages,
	snapshot,
	default: defaultAPI
};

export default metadata;
