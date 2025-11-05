/**
 * @file api/devices/mxnet.mjs - MXNet device control (stripped for testing)
 * @description Minimal device control module for testing slothlet behavior
 */

/**
 * Initializes MXNet device controller (mock)
 * @param {Object} config - MXNet configuration
 * @returns {Promise<Object|null>} Mock device instance or null if disabled
 */
export async function initialize(config) {
	if (!config || !config.enabled) {
		console.log("MXNet device disabled in configuration");
		return null;
	}

	console.log(`Mock: Initializing MXNet device: ${config.host || "localhost"}:${config.port || 8080}`);

	// Return mock device
	return {
		host: config.host || "localhost",
		port: config.port || 8080,
		mac: config.mac || null,
		connected: true,
		type: "mxnet"
	};
}

/**
 * Powers on MXNet device (mock)
 * @param {string} deviceId - Device identifier
 * @returns {Promise<boolean>} Success status
 */
export async function powerOn(deviceId = "default") {
	console.log(`Mock: Powering on MXNet device: ${deviceId}`);
	return true;
}

/**
 * Powers off MXNet device (mock)
 * @param {string} deviceId - Device identifier
 * @returns {Promise<boolean>} Success status
 */
export async function powerOff(deviceId = "default") {
	console.log(`Mock: Powering off MXNet device: ${deviceId}`);
	return true;
}

/**
 * Sends command to MXNet device (mock)
 * @param {string} deviceId - Device identifier
 * @param {string} command - Command to send
 * @returns {Promise<Object>} Command response
 */
export async function sendCommand(deviceId = "default", command) {
	console.log(`Mock: Sending command "${command}" to MXNet device: ${deviceId}`);
	return {
		success: true,
		command,
		deviceId,
		timestamp: Date.now()
	};
}

/**
 * Gets device status (mock)
 * @param {string} deviceId - Device identifier
 * @returns {Promise<Object>} Device status
 */
export async function getStatus(deviceId = "default") {
	console.log(`Mock: Getting status for MXNet device: ${deviceId}`);
	return {
		deviceId,
		power: "on",
		connected: true,
		type: "mxnet",
		lastSeen: Date.now()
	};
}

/**
 * Common MXNet commands - constants for external use
 * @namespace
 * @public
 */
export const COMMANDS = {
	/** @public */ POWER_ON: "power.on",
	/** @public */ POWER_OFF: "power.off",
	/** @public */ STATUS: "status",
	/** @public */ REBOOT: "reboot",
	/** @public */ RESET: "reset"
};

/**
 * Helper function to validate command constants (demonstrates usage)
 * @param {string} command - Command to validate
 * @returns {boolean} True if command is valid
 * @example
 * isValidCommand(COMMANDS.POWER_ON); // true
 */
export function isValidCommand(command) {
	return Object.values(COMMANDS).includes(command);
}
