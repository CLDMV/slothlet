/**
 * @file api/devices/firetv.mjs - Fire TV control (stripped for testing)
 * @description Minimal device control module for testing slothlet proxy behavior
 */

/**
 * Initializes Fire TV/Android TV controller (mock)
 * @param {Object} config - Android TV configuration
 * @returns {Promise<Object|null>} Mock device instance or null if disabled
 */
export async function initialize(config) {
	if (!config || !config.enabled) {
		console.log("Fire TV device disabled in configuration, skipping");
		return null;
	}

	console.log(`Mock: Initializing Fire TV device: ${config.host || "localhost"}:${config.port || 5555}`);

	// Return mock device
	return {
		host: config.host || "localhost",
		port: config.port || 5555,
		connected: true,
		type: "firetv"
	};
}

/**
 * Powers on Fire TV device (mock)
 * @param {string} deviceId - Device identifier
 * @returns {Promise<boolean>} Success status
 */
export async function powerOn(deviceId = "default") {
	console.log(`Mock: Powering on Fire TV device: ${deviceId}`);
	return true;
}

/**
 * Powers off Fire TV device (mock)
 * @param {string} deviceId - Device identifier
 * @returns {Promise<boolean>} Success status
 */
export async function powerOff(deviceId = "default") {
	console.log(`Mock: Powering off Fire TV device: ${deviceId}`);
	return true;
}

/**
 * Sends key to Fire TV device (mock)
 * @param {string} deviceId - Device identifier
 * @param {string} keyCode - Key to send
 * @returns {Promise<boolean>} Success status
 */
export async function sendKey(deviceId = "default", keyCode) {
	console.log(`Mock: Sending key ${keyCode} to Fire TV device: ${deviceId}`);
	return true;
}

/**
 * Common remote control keys
 */
export const REMOTE_KEYS = {
	// Power
	POWER: "POWER",
	SLEEP: "SLEEP",

	// Navigation
	HOME: "HOME",
	BACK: "BACK",
	MENU: "MENU",
	UP: "DPAD_UP",
	DOWN: "DPAD_DOWN",
	LEFT: "DPAD_LEFT",
	RIGHT: "DPAD_RIGHT",
	CENTER: "DPAD_CENTER",
	SELECT: "DPAD_CENTER",

	// Volume
	VOLUME_UP: "VOLUME_UP",
	VOLUME_DOWN: "VOLUME_DOWN",
	MUTE: "VOLUME_MUTE",

	// Playback
	PLAY: "MEDIA_PLAY",
	PAUSE: "MEDIA_PAUSE",
	PLAY_PAUSE: "MEDIA_PLAY_PAUSE",
	STOP: "MEDIA_STOP",
	NEXT: "MEDIA_NEXT",
	PREVIOUS: "MEDIA_PREVIOUS",
	FAST_FORWARD: "MEDIA_FAST_FORWARD",
	REWIND: "MEDIA_REWIND"
};
