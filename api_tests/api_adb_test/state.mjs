/**
 * State management API module for Android TV Remote.
 * Provides organized access to configuration, device state, defaults, metadata, and device information.
 * @module state
 */

// Slothlet runtime imports for live bindings
import { self as _, context, reference } from "@cldmv/slothlet/runtime";

/**
 * Gets the current configuration settings.
 * @returns {Object} Configuration object
 * @example
 * const config = api.state.getConfig();
 * console.log('Host:', config.host);
 * console.log('Port:', config.port);
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
 * @returns {Promise<Object>} Connection state information
 * @example
 * const connectionState = await api.state.getConnectionState();
 * console.log('Connected:', connectionState.connected);
 * console.log('Status:', connectionState.status);
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
 * @returns {Object} Default configuration object
 * @example
 * const defaults = api.state.getDefaults();
 * console.log('Default port:', defaults.port);
 */
export function getDefaults() {
	return context.configDefaults ? { ...context.configDefaults } : {};
}

/**
 * Gets device metadata collected during initialization.
 * @returns {Promise<Object>} Device metadata object
 * @example
 * const metadata = await api.state.getMetadata();
 * console.log('Device model:', metadata.device?.model);
 * console.log('Android version:', metadata.device?.version);
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
 * @returns {Promise<Object>} Device information object
 * @example
 * const device = await api.state.getDevice();
 * console.log('Device info:', device);
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
 * @returns {Promise<Object>} Complete device information object
 * @example
 * const deviceWithDisplay = await api.state.getDeviceWithDisplay();
 * console.log('Display info:', deviceWithDisplay.display);
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
 * @returns {Promise<Object|null>} Current application information
 * @example
 * const currentApp = await api.state.getCurrentApp();
 * if (currentApp) {
 *   console.log('Current app:', currentApp.packageName);
 * }
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
 * @returns {Promise<Object>} Power state information
 * @example
 * const powerState = await api.state.getPowerState();
 * console.log('Device awake:', powerState.mWakefulness === 'Awake');
 */
export async function getPowerState() {
	await self.connection.ensureConnected();

	const output = await self.connection.shell('dumpsys power | grep -E "(mIsPowered|mWakefulness|mWakeLocks|mScreenOn)"');
	return context.parsePowerState(output);
}

/**
 * Gets current audio state information.
 * @returns {Promise<Object|null>} Audio state information
 * @example
 * const audioState = await api.state.getAudioState();
 * if (audioState) {
 *   console.log('Audio info:', audioState);
 * }
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
 * @returns {Promise<Object|null>} Network information
 * @example
 * const networkInfo = await api.state.getNetworkInfo();
 * if (networkInfo) {
 *   console.log('WiFi connected:', networkInfo.wifi.connected);
 * }
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
 * @param {Object} [options={}] - Options for package listing
 * @param {boolean} [options.systemApps=false] - Include system apps
 * @param {boolean} [options.thirdPartyOnly=true] - Only third-party apps
 * @returns {Promise<string[]>} Array of package names
 * @example
 * const packages = await api.state.getInstalledPackages();
 * console.log('Installed apps:', packages.length);
 */
export async function getInstalledPackages(options = {}) {
	const { systemApps = false, thirdPartyOnly = true } = options;
	return await self.helpers.fetchInstalledPackages(systemApps, thirdPartyOnly);
}

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
 * @returns {Promise<void>}
 * @example
 * await api.state.refreshAppInfo();
 */
export async function refreshAppInfo() {
	await self.helpers.refreshCurrentAppInfo();
}

/**
 * Refreshes network information cache.
 * @returns {Promise<void>}
 * @example
 * await api.state.refreshNetworkInfo();
 */
export async function refreshNetworkInfo() {
	context.cachedNetwork = await self.helpers.fetchNetworkDetails();
}

/**
 * Refreshes audio information cache.
 * @returns {Promise<void>}
 * @example
 * await api.state.refreshAudioInfo();
 */
export async function refreshAudioInfo() {
	context.cachedAudioInfo = await self.helpers.fetchAudioInfo();
}

/**
 * Refreshes all cached information.
 * @returns {Promise<void>}
 * @example
 * // Refresh everything
 * await api.state.refreshAll();
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
