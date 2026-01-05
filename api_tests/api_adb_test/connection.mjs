/**
 * Connection management API module for Android TV Remote.
 * Handles ADB connection, heartbeat, and connection state management.
 * @module connection
 */

// Slothlet runtime imports for live bindings
import { self as _, context as __, reference as ___ } from "@cldmv/slothlet/runtime";
import { EventEmitter } from "events";

// Connection state
let connected = false;
let connectionEmitter = new EventEmitter();

// Timers
let heartbeatTimer = null;
let connectionCheckTimer = null;
let disconnectTimer = null;

/**
 * Ensures the device is connected, attempting to connect if not.
 * @returns {Promise<void>}
 * @example
 * await remote.connection.ensureConnected();
 */
export async function ensureConnected() {
	if (connected) {
		if (!self.config?.get("quiet")) {
			console.log(`Already connected to ${self.config?.get("host")}`);
		}
		return;
	}

	const config = self.config?.get();
	if (!config?.host) {
		throw new Error("No host configured for connection");
	}

	try {
		// Emit connecting event
		connectionEmitter.emit("connecting", {
			timestamp: new Date().toISOString(),
			host: config.host,
			reason: "ensure"
		});

		await self.adb.connect();
		connected = true;

		if (!config.quiet) {
			console.log(`Connected to ${config.host}:${config.port}`);
		}

		// Emit connected event
		connectionEmitter.emit("connected", {
			timestamp: new Date().toISOString(),
			host: config.host,
			ip: config.host,
			port: config.port
		});

		// Start heartbeat if enabled
		if (config.maintainConnection) {
			startHeartbeat();
		}

		return true;
	} catch (error) {
		connected = false;
		console.error(`Failed to connect to ${config.host}:${config.port}:`, error.message);
		throw error;
	}
}

/**
 * Disconnects from the device.
 * @param {boolean} [isAutoDisconnect=false] - Whether this is an automatic disconnection.
 * @returns {Promise<void>}
 * @example
 * await remote.connection.disconnect();
 */
export async function disconnect(isAutoDisconnect = false) {
	if (!connected) {
		return;
	}

	const config = self.config?.get();

	try {
		// Clear all timers
		clearTimeouts();

		await self.adb.disconnect();
		connected = false;

		if (!config?.quiet) {
			const reason = isAutoDisconnect ? "auto-disconnect" : "manual disconnect";
			console.log(`Disconnected from ${config.host} (${reason})`);
		}

		// Emit disconnected event
		connectionEmitter.emit("disconnected", {
			timestamp: new Date().toISOString(),
			host: config?.host,
			ip: config?.host,
			port: config?.port,
			reason: isAutoDisconnect ? "timeout" : "manual"
		});
	} catch (error) {
		console.error(`Failed to disconnect from ${config?.host}:`, error.message);
		throw error;
	}
}

/**
 * Gets the current connection status.
 * @returns {boolean} True if connected, false otherwise.
 * @example
 * if (remote.connection.isConnected()) {
 *   // Device is connected
 * }
 */
export function isConnected() {
	return connected;
}

/**
 * Checks if the device is awake and responsive.
 * @returns {Promise<boolean>} True if device is awake, false otherwise.
 * @example
 * const awake = await remote.connection.isAwake();
 */
export async function isAwake() {
	try {
		if (!connected) {
			return false;
		}

		// Quick shell command to check responsiveness
		const result = await self.adb.shell("echo 'ping'");
		return result?.toString().trim() === "ping";
	} catch (error) {
		return false;
	}
}

/**
 * Ensures the device is awake, waking it if necessary.
 * @returns {Promise<boolean>} True if device is awake, false otherwise.
 * @example
 * await remote.connection.ensureAwake();
 */
export async function ensureAwake() {
	if (await isAwake()) {
		return true;
	}

	try {
		// Try to wake the device with power button
		await self.adb.shell("input keyevent KEYCODE_POWER");

		// Wait a moment for device to respond
		await new Promise((resolve) => setTimeout(resolve, 2000));

		return await isAwake();
	} catch (error) {
		return false;
	}
}

/**
 * Starts the heartbeat mechanism to maintain connection.
 * @returns {void}
 * @example
 * remote.connection.startHeartbeat();
 */
export function startHeartbeat() {
	if (heartbeatTimer) return;

	const config = self.config?.get();
	const heartbeatInterval = config?.heartbeatInterval || 20000;

	heartbeatTimer = setInterval(async () => {
		if (!connected) return;

		try {
			await self.adb.shell("echo 'heartbeat'");
		} catch (error) {
			if (!config?.quiet) {
				console.warn(`Heartbeat failed: ${error.message}`);
			}
			connected = false;

			connectionEmitter.emit("disconnected", {
				timestamp: new Date().toISOString(),
				host: config?.host,
				reason: "heartbeat.failed"
			});
		}
	}, heartbeatInterval);
}

/**
 * Stops the heartbeat mechanism.
 * @returns {void}
 * @example
 * remote.connection.stopHeartbeat();
 */
export function stopHeartbeat() {
	if (heartbeatTimer) {
		clearInterval(heartbeatTimer);
		heartbeatTimer = null;
	}
}

/**
 * Clears all active timers.
 * @returns {void}
 * @example
 * remote.connection.clearTimeouts();
 */
export function clearTimeouts() {
	if (heartbeatTimer) {
		clearInterval(heartbeatTimer);
		heartbeatTimer = null;
	}
	if (connectionCheckTimer) {
		clearInterval(connectionCheckTimer);
		connectionCheckTimer = null;
	}
	if (disconnectTimer) {
		clearTimeout(disconnectTimer);
		disconnectTimer = null;
	}
}

/**
 * Executes a shell command on the device.
 * @param {string} command - The shell command to execute
 * @param {Object} [options={}] - Command options
 * @param {boolean} [options.trim=true] - Whether to trim the output
 * @returns {Promise<string>} Command output
 * @example
 * const output = await remote.connection.shell('getprop ro.product.model');
 * console.log('Device model:', output);
 */
export async function shell(command, options = {}) {
	const { trim = true } = options;
	await ensureConnected();

	const output = await self.adb.shell(command);
	const result = output?.toString() || "";
	return trim ? result.trim() : result;
}

/**
 * Gets connection information and statistics.
 * @returns {Object} Connection information
 * @example
 * const info = remote.connection.getInfo();
 * console.log('Connection info:', info);
 */
export function getInfo() {
	const config = self.config?.get();

	return {
		host: config?.host,
		ip: config?.host,
		port: config?.port,
		connected: connected,
		heartbeatActive: !!heartbeatTimer,
		maintainConnection: config?.maintainConnection
	};
}

/**
 * Gets the connection event emitter for subscribing to connection events.
 * @returns {EventEmitter} The connection event emitter
 * @example
 * const emitter = remote.connection.getEmitter();
 * emitter.on('connected', (event) => {
 *   console.log('Connected to', event.host);
 * });
 */
export function getEmitter() {
	return connectionEmitter;
}
