/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_adb_test/metadata.mjs
 *	@Date: 2025-10-27T11:28:27-07:00 (1761589707)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:16:57 -08:00 (1772425017)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Metadata management API module for Android TV Remote - Dummy implementation for testing.
 * @module api_adb_test.metadata
 * @memberof module:api_adb_test
 */
/**
 * @namespace metadata
 * @memberof module:api_adb_test
 * @alias module:api_adb_test.metadata
 */

// Slothlet runtime imports for live bindings
import { self, context } from "@cldmv/slothlet/runtime";
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
	*	@param {string} [key] - Specific metadata key, or undefined for entire metadata
	*	@returns {Promise<any>} Metadata value(s)
	*	@example
	* // Get entire metadata
	* const metadata = await api.metadata.get();
	*
	* // Get specific metadata
	* const deviceMeta = await api.metadata.get('device');
	* const networkMeta = await api.metadata.get('network');
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.get();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.get();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.get();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.get();
 */
/**
 * get.
 * @param {*} key - key.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.get('myKey');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.get('myKey');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.get('myKey');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.get('myKey');
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
	*	@param {string|Object} key - Metadata key or object of key-value pairs
	*	@param {any} [value] - Value to set (if key is string)
	*	@returns {void}
	*	@example
	* // Set single value
	* api.metadata.set('device', deviceMetadata);
	*
	* // Set multiple values
	* api.metadata.set({
	*   device: deviceMeta,
	*   network: networkMeta
	* });
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.metadata.set('myKey');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.metadata.set('myKey');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.metadata.set('myKey');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.metadata.set('myKey');
 */
/**
 * set.
 * @param {*} key - key.
 * @param {*} value - value.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.metadata.set('myKey', null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.metadata.set('myKey', null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.metadata.set('myKey', null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.metadata.set('myKey', null);
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
	*	@param {Object} metaObject - Metadata object to merge
	*	@param {boolean} [deep=false] - Whether to perform deep merge
	*	@returns {Promise<Object>} Updated metadata
	*	@example
	* // Merge new metadata
	* await api.metadata.merge({ device: newDeviceMeta });
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.merge(null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.merge(null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.merge(null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.merge(null);
 */
/**
 * merge.
 * @param {*} metaObject - metaObject.
 * @param {*} [deep] - deep.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.merge(null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.merge(null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.merge(null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.merge(null);
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
	*	@param {string} [reason="manual"] - Reason for refresh
	*	@param {boolean} [force=false] - Force refresh even if recently updated
	*	@returns {Promise<Object>} Updated metadata
	*	@example
	* // Refresh metadata
	* await api.metadata.refresh("user_requested");
	*
	* // Force refresh
	* await api.metadata.refresh("force_update", true);
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.refresh();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.refresh();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.refresh();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.refresh();
 */
/**
 * refresh.
 * @param {*} [reason] - reason.
 * @param {*} [force] - force.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.refresh();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.refresh();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.refresh();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.refresh();
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
	*	@param {string} [reason="collect"] - Reason for collection
	*	@returns {Promise<Object>} Collected metadata
	*	@example
	* const freshMetadata = await api.metadata.collect("initialization");
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.collect();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.collect();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.collect();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.collect();
 */
/**
 * collect.
 * @param {*} [reason] - reason.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.collect();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.collect();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.collect();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.collect();
 */
export async function collect(reason = "collect") {
	return await refresh(reason, true);
}

/**
	* Clears cached metadata.
	*	@param {string|string[]} [keys] - Specific keys to clear, or undefined to clear all
	*	@returns {void}
	*	@example
	* // Clear all metadata
	* api.metadata.clear();
	*
	* // Clear specific metadata
	* api.metadata.clear(['device', 'network']);
	* api.metadata.clear('packages');
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.metadata.clear();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.metadata.clear();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.metadata.clear();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.metadata.clear();
 */
/**
 * clear.
 * @param {*} keys - keys.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.metadata.clear('myKey');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.metadata.clear('myKey');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.metadata.clear('myKey');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.metadata.clear('myKey');
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
	*	@returns {Object} Cache age information
	*	@example
	* const age = api.metadata.age();
	* console.log('Metadata is', age.minutes, 'minutes old');
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.metadata.age();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.metadata.age();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.metadata.age();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.metadata.age();
 */
/**
 * age.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.metadata.age();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.metadata.age();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.metadata.age();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.metadata.age();
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
	*	@returns {Promise<Object|null>} Startup metadata
	*	@example
	* const startup = await api.metadata.startup();
	* if (startup) {
	*   console.log('Startup reason:', startup.reason);
	* }
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.startup();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.startup();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.startup();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.startup();
 */
/**
 * startup.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.startup();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.startup();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.startup();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.startup();
 */
export async function startup() {
	const meta = await get();
	return meta.startup || null;
}

/**
	* Gets device-specific metadata.
	*	@returns {Promise<Object|null>} Device metadata
	*	@example
	* const deviceMeta = await api.metadata.device();
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.deviceMeta();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.deviceMeta();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.deviceMeta();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.deviceMeta();
 */
/**
 * deviceMeta.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.deviceMeta();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.deviceMeta();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.deviceMeta();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.deviceMeta();
 */
export async function deviceMeta() {
	const meta = await get();
	return meta.device || null;
}

/**
	* Gets network-specific metadata.
	*	@returns {Promise<Object|null>} Network metadata
	*	@example
	* const networkMeta = await api.metadata.network();
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.networkMeta();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.networkMeta();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.networkMeta();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.networkMeta();
 */
/**
 * networkMeta.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.networkMeta();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.networkMeta();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.networkMeta();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.networkMeta();
 */
export async function networkMeta() {
	const meta = await get();
	return meta.network || null;
}

/**
	* Gets packages metadata.
	*	@returns {Promise<Array|null>} Packages metadata
	*	@example
	* const packages = await api.metadata.packages();
	* console.log('Installed packages:', packages?.length);
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.packages();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.packages();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.packages();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.packages();
 */
/**
 * packages.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.packages();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.packages();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.packages();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.packages();
 */
export async function packages() {
	const meta = await get();
	return meta.packages || null;
}

/**
	* Gets a snapshot of the current metadata state.
	*	@param {boolean} [includeAge=true] - Include age information
	*	@returns {Promise<Object>} Metadata snapshot with metadata
	*	@example
	* const snapshot = await api.metadata.snapshot();
	* console.log('Metadata snapshot:', snapshot);
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.snapshot();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.snapshot();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.snapshot();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.snapshot();
 */
/**
 * snapshot.
 * @param {*} [includeAge] - includeAge.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.snapshot();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.snapshot();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.metadata.snapshot();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.metadata.snapshot();
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

