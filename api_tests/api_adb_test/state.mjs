/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_adb_test/state.mjs
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
 * @fileoverview Device state API module for Android TV Remote - Dummy implementation for testing.
 * @module api_adb_test.state
 * @memberof module:api_adb_test
 */
/**
 * @namespace state
 * @memberof module:api_adb_test
 * @alias module:api_adb_test.state
 */

// Slothlet runtime imports for live bindings
import { self, context } from "@cldmv/slothlet/runtime";

/**
	* Gets the current configuration settings.
	*	@returns {Object} Configuration object
	*	@example
	* const config = api.state.getConfig();
	* console.log('Host:', config.host);
	* console.log('Port:', config.port);
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.state.getConfig();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.state.getConfig();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.state.getConfig();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.state.getConfig();
/
/**
 * getConfig.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.state.getConfig();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.state.getConfig();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.state.getConfig();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.state.getConfig();
 */
export function getConfig() {
	return {
		host: context.host,
		ip: context.ip,
		port: context.port,
		quiet: context.quiet,
		inputDevice: context.inputDevice,
		maintainConnection: context.maintainConnection,
		heartbeatInterval: context.heartbeatInterval,
		connectionCheckInterval: context.connectionCheckInterval,
		autoDisconnect: context.autoDisconnect,
		disconnectTimeout: context.disconnectTimeout
	};
}

/**
	* Gets the current connection state.
	*	@returns {Promise<Object>} Connection state information
	*	@example
	* const connectionState = await api.state.getConnectionState();
	* console.log('Connected:', connectionState.connected);
	* console.log('Status:', connectionState.status);
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getConnectionState();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getConnectionState();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getConnectionState();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getConnectionState();
/
/**
 * getConnectionState.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getConnectionState();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getConnectionState();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getConnectionState();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getConnectionState();
 */
export async function getConnectionState() {
	return {
		connected: self.connection.isConnected(),
		status: await self.connection.getStatus(),
		info: self.connection.getInfo(),
		host: context.host,
		port: context.port
	};
}

/**
	* Gets default configuration values.
	*	@returns {Object} Default configuration object
	*	@example
	* const defaults = api.state.getDefaults();
	* console.log('Default port:', defaults.port);
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.state.getDefaults();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.state.getDefaults();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.state.getDefaults();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.state.getDefaults();
/
/**
 * getDefaults.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.state.getDefaults();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.state.getDefaults();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.state.getDefaults();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.state.getDefaults();
 */
export function getDefaults() {
	return context.configDefaults ? { ...context.configDefaults } : {};
}

/**
	* Gets device metadata collected during initialization.
	*	@returns {Promise<Object>} Device metadata object
	*	@example
	* const metadata = await api.state.getMetadata();
	* console.log('Device model:', metadata.device?.model);
	* console.log('Android version:', metadata.device?.version);
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getMetadata();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getMetadata();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getMetadata();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getMetadata();
/
/**
 * getMetadata.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getMetadata();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getMetadata();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getMetadata();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getMetadata();
 */
export async function getMetadata() {
	// Check if we need to refresh metadata
	const now = Date.now();
	if (!context.lastMetadataRefreshTimestamp || now - context.lastMetadataRefreshTimestamp > 300000) {
		// 5 minutes
		await self.helpers.collectStartupMetadata("refresh");
	}

	return {
		device: context.cachedDeviceInfo ? { ...context.cachedDeviceInfo } : null,
		network: context.cachedNetwork ? { ...context.cachedNetwork } : null,
		audio: context.cachedAudioInfo ? { ...context.cachedAudioInfo } : null,
		lastRefresh: context.lastMetadataRefreshTimestamp,
		refreshed: true
	};
}

/**
	* Gets basic device information without display info.
	*	@returns {Promise<Object>} Device information object
	*	@example
	* const device = await api.state.getDevice();
	* console.log('Device info:', device);
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getDevice();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getDevice();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getDevice();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getDevice();
/
/**
 * getDevice.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getDevice();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getDevice();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getDevice();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getDevice();
 */
export async function getDevice() {
	// Ensure we have fresh device properties
	if (!context.cachedDeviceInfo) {
		await self.helpers.fetchDeviceProperties();
	}

	return {
		info: context.cachedDeviceInfo ? { ...context.cachedDeviceInfo } : null,
		network: context.cachedNetwork ? { ...context.cachedNetwork } : null,
		audio: context.cachedAudioInfo ? { ...context.cachedAudioInfo } : null,
		power: await getPowerState(),
		app: await getCurrentApp()
	};
}

/**
	* Gets comprehensive device information including display details.
	*	@returns {Promise<Object>} Complete device information object
	*	@example
	* const deviceWithDisplay = await api.state.getDeviceWithDisplay();
	* console.log('Display info:', deviceWithDisplay.display);
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getDeviceWithDisplay();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getDeviceWithDisplay();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getDeviceWithDisplay();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getDeviceWithDisplay();
/
/**
 * getDeviceWithDisplay.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getDeviceWithDisplay();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getDeviceWithDisplay();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getDeviceWithDisplay();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getDeviceWithDisplay();
 */
export async function getDeviceWithDisplay() {
	const device = await getDevice();

	// Get display information through the display API
	const displayInfo = await self.display.getInfo();

	return {
		...device,
		display: displayInfo
	};
}

/**
	* Gets the current application state.
	*	@returns {Promise<Object|null>} Current application information
	*	@example
	* const currentApp = await api.state.getCurrentApp();
	* if (currentApp) {
	*   console.log('Current app:', currentApp.packageName);
	* }
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getCurrentApp();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getCurrentApp();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getCurrentApp();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getCurrentApp();
/
/**
 * getCurrentApp.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getCurrentApp();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getCurrentApp();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getCurrentApp();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getCurrentApp();
 */
export async function getCurrentApp() {
	// Refresh app info if needed
	if (context.pendingAppInfoRefresh) {
		await self.helpers.refreshCurrentAppInfo();
	}

	return context.lastKnownAppInfo ? { ...context.lastKnownAppInfo } : null;
}

/**
	* Gets device power state information.
	*	@returns {Promise<Object>} Power state information
	*	@example
	* const powerState = await api.state.getPowerState();
	* console.log('Device awake:', powerState.mWakefulness === 'Awake');
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getPowerState();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getPowerState();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getPowerState();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getPowerState();
/
/**
 * getPowerState.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getPowerState();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getPowerState();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getPowerState();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getPowerState();
 */
export async function getPowerState() {
	await self.connection.ensureConnected();

	const output = await self.connection.shell('dumpsys power | grep -E "(mIsPowered|mWakefulness|mWakeLocks|mScreenOn)"');
	return context.parsePowerState(output);
}

/**
	* Gets current audio state information.
	*	@returns {Promise<Object|null>} Audio state information
	*	@example
	* const audioState = await api.state.getAudioState();
	* if (audioState) {
	*   console.log('Audio info:', audioState);
	* }
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getAudioState();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getAudioState();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getAudioState();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getAudioState();
/
/**
 * getAudioState.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getAudioState();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getAudioState();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getAudioState();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getAudioState();
 */
export async function getAudioState() {
	// Ensure we have fresh audio info
	if (!context.cachedAudioInfo) {
		await self.helpers.fetchAudioInfo();
	}

	return context.cachedAudioInfo ? { ...context.cachedAudioInfo } : null;
}

/**
	* Gets network information for the device.
	*	@returns {Promise<Object|null>} Network information
	*	@example
	* const networkInfo = await api.state.getNetworkInfo();
	* if (networkInfo) {
	*   console.log('WiFi connected:', networkInfo.wifi.connected);
	* }
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getNetworkInfo();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getNetworkInfo();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getNetworkInfo();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getNetworkInfo();
/
/**
 * getNetworkInfo.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getNetworkInfo();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getNetworkInfo();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getNetworkInfo();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getNetworkInfo();
 */
export async function getNetworkInfo() {
	// Ensure we have fresh network info
	if (!context.cachedNetwork) {
		await self.helpers.fetchNetworkDetails();
	}

	return context.cachedNetwork ? { ...context.cachedNetwork } : null;
}

/**
	* Gets the list of installed packages.
	*	@param {Object} [options={}] - Options for package listing
	*	@param {boolean} [options.systemApps=false] - Include system apps
	*	@param {boolean} [options.thirdPartyOnly=true] - Only third-party apps
	*	@returns {Promise<string[]>} Array of package names
	*	@example
	* const packages = await api.state.getInstalledPackages();
	* console.log('Installed apps:', packages.length);
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getInstalledPackages();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getInstalledPackages();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getInstalledPackages();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getInstalledPackages();
/
/**
 * getInstalledPackages.
 * @param {*} [options] - options.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getInstalledPackages();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getInstalledPackages();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.getInstalledPackages();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.getInstalledPackages();
 */
export async function getInstalledPackages(options = {}) {
	const { systemApps = false, thirdPartyOnly = true } = options;
	return await self.helpers.fetchInstalledPackages(systemApps, thirdPartyOnly);
}

/**
	* Refreshes device information cache.
	*	@param {Object} [options={}] - Refresh options
	*	@param {boolean} [options.force=false] - Force refresh even if recently updated
	*	@returns {Promise<void>}
	*	@example
	* // Refresh device info
	* await api.state.refreshDeviceInfo();
	*
	* // Force refresh
	* await api.state.refreshDeviceInfo({ force: true });
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshDeviceInfo();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshDeviceInfo();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshDeviceInfo();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshDeviceInfo();
/
/**
 * refreshDeviceInfo.
 * @param {*} [options] - options.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshDeviceInfo();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshDeviceInfo();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshDeviceInfo();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshDeviceInfo();
 */
export async function refreshDeviceInfo(options = {}) {
	const { force = false } = options;

	if (force || !context.cachedDeviceInfo) {
		if (!context.quiet) {
			context.emitLog("info", "Refreshing device information...", "state.refreshDeviceInfo");
		}

		try {
			context.cachedDeviceInfo = await self.helpers.fetchDeviceProperties();
			if (!context.quiet) {
				context.emitLog("info", "Device information refreshed", "state.refreshDeviceInfo");
			}
		} catch (error) {
			context.localEmitError(error, "state.refreshDeviceInfo", "Failed to refresh device information");
			throw error;
		}
	}
}

/**
	* Refreshes application information cache.
	*	@returns {Promise<void>}
	*	@example
	* await api.state.refreshAppInfo();
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshAppInfo();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshAppInfo();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshAppInfo();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshAppInfo();
/
/**
 * refreshAppInfo.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshAppInfo();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshAppInfo();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshAppInfo();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshAppInfo();
 */
export async function refreshAppInfo() {
	await self.helpers.refreshCurrentAppInfo();
}

/**
	* Refreshes network information cache.
	*	@returns {Promise<void>}
	*	@example
	* await api.state.refreshNetworkInfo();
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshNetworkInfo();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshNetworkInfo();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshNetworkInfo();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshNetworkInfo();
/
/**
 * refreshNetworkInfo.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshNetworkInfo();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshNetworkInfo();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshNetworkInfo();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshNetworkInfo();
 */
export async function refreshNetworkInfo() {
	context.cachedNetwork = await self.helpers.fetchNetworkDetails();
}

/**
	* Refreshes audio information cache.
	*	@returns {Promise<void>}
	*	@example
	* await api.state.refreshAudioInfo();
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshAudioInfo();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshAudioInfo();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshAudioInfo();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshAudioInfo();
/
/**
 * refreshAudioInfo.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshAudioInfo();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshAudioInfo();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshAudioInfo();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshAudioInfo();
 */
export async function refreshAudioInfo() {
	context.cachedAudioInfo = await self.helpers.fetchAudioInfo();
}

/**
	* Refreshes all cached information.
	*	@returns {Promise<void>}
	*	@example
	* // Refresh everything
	* await api.state.refreshAll();
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshAll();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshAll();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshAll();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshAll();
/
/**
 * refreshAll.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshAll();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshAll();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.refreshAll();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.refreshAll();
 */
export async function refreshAll() {
	if (!context.quiet) {
		context.emitLog("info", "Refreshing all cached information...", "state.refreshAll");
	}

	await self.helpers.collectStartupMetadata("manual_refresh");

	if (!context.quiet) {
		context.emitLog("info", "All cached information refreshed", "state.refreshAll");
	}
}

/**
	* Creates a complete snapshot of the current device state.
	*	@param {Object} [options={}] - Snapshot options
	*	@param {boolean} [options.includeDisplay=true] - Include display information
	*	@param {boolean} [options.compact=false] - Create compact snapshot
	*	@returns {Promise<Object>} Complete device state snapshot
	*	@example
	* const snapshot = await api.state.createSnapshot();
	* console.log('Device snapshot:', snapshot);
	*
	* // Compact snapshot without display
	* const compactSnapshot = await api.state.createSnapshot({
	*   includeDisplay: false,
	*   compact: true
	* });
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.createSnapshot();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.createSnapshot();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.createSnapshot();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.createSnapshot();
/
/**
 * createSnapshot.
 * @param {*} [options] - options.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.createSnapshot();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.createSnapshot();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.state.createSnapshot();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.state.createSnapshot();
 */
export async function createSnapshot(options = {}) {
	const { includeDisplay = true, compact = false } = options;

	const timestamp = new Date().toISOString();

	// Get all state information
	const [config, connectionState, device, powerState, audioState, networkInfo, currentApp] = await Promise.all([
		getConfig(),
		getConnectionState(),
		includeDisplay ? getDeviceWithDisplay() : getDevice(),
		getPowerState(),
		getAudioState(),
		getNetworkInfo(),
		getCurrentApp()
	]);

	const snapshot = {
		timestamp,
		config,
		connection: connectionState,
		device,
		power: powerState,
		audio: audioState,
		network: networkInfo,
		app: currentApp,
		metadata: await getMetadata()
	};

	return compact ? context.compactObject(snapshot) : snapshot;
}

