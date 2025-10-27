/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_adb_test/adb.mjs
 *	@Date: 2025-10-27 10:20:49 -07:00 (1761585649)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-27 11:05:54 -07:00 (1761588354)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * ADB API module for Android TV Remote - Dummy implementation for testing.
 * Provides direct ADB client access and common ADB operations.
 * @module adb
 */

// Slothlet runtime imports for live bindings
import { self } from "@cldmv/slothlet/runtime";

// Dummy ADB client state
let adbClient = { connected: false };
let currentDevice = { id: null };
let currentDeviceId = null;

/**
 * Initializes ADB client and device connection.
 * @param {string} host - Device host/IP
 * @param {number} [port=5555] - ADB port
 * @returns {Promise<void>}
 */
export async function initialize(host, port = 5555) {
	if (!adbClient.connected) {
		adbClient.connected = true;
	}

	currentDeviceId = `${host}:${port}`;
	currentDevice.id = currentDeviceId;

	// Store in config for other modules to access
	if (self.config) {
		self.config.set({
			host,
			port,
			deviceId: currentDeviceId
		});
	}
}

/**
 * Gets the current ADB client instance.
 * @returns {Object} ADB client
 */
export function getClient() {
	return adbClient;
}

/**
 * Gets the current device instance.
 * @returns {Object} ADB device
 */
export function getDevice() {
	return currentDevice;
}

/**
 * Gets the current device ID.
 * @returns {string} Device ID
 */
export function getDeviceId() {
	return currentDeviceId;
}

/**
 * Executes an ADB shell command.
 * @param {string} command - Shell command to execute
 * @returns {Promise<string>} Command output
 */
export async function shell(command) {
	if (!currentDevice.id) {
		throw new Error("ADB device not initialized");
	}

	// Dummy implementation - return success response
	return Promise.resolve(`Executed: ${command}`);
}

/**
 * Connects to the device.
 * @returns {Promise<void>}
 */
export async function connect() {
	if (!adbClient || !currentDeviceId) {
		throw new Error("ADB not initialized");
	}

	adbClient.connected = true;
	return Promise.resolve();
}

/**
 * Disconnects from the device.
 * @returns {Promise<void>}
 */
export async function disconnect() {
	if (!adbClient || !currentDeviceId) {
		return;
	}

	try {
		adbClient.connected = false;
		return Promise.resolve();
	} catch (_) {
		// Ignore disconnect errors
	}
}

/**
 * Executes an input command.
 * @param {string} inputCommand - Input command (keyevent, text, tap, etc.)
 * @returns {Promise<string>} Command output
 */
export async function input(inputCommand) {
	return await shell(`input ${inputCommand}`);
}

/**
 * Takes a screenshot and returns the buffer.
 * @returns {Promise<Buffer>} Screenshot buffer
 */
export async function screenshot() {
	if (!currentDevice.id) {
		throw new Error("ADB device not initialized");
	}

	// Return dummy buffer
	return Promise.resolve(Buffer.from("dummy-screenshot-data"));
}

/**
 * Lists installed packages.
 * @returns {Promise<string[]>} Array of package names
 */
export async function listPackages() {
	// Return dummy package list
	return Promise.resolve(["com.netflix.ninja", "com.youtube.tv", "com.android.settings", "com.google.android.apps.tv.launcherx"]);
}

/**
 * Gets device properties.
 * @returns {Promise<Object>} Device properties
 */
export async function getProperties() {
	// Return dummy device properties
	return Promise.resolve({
		"ro.product.model": "Android TV",
		"ro.product.brand": "Google",
		"ro.build.version.release": "11",
		"ro.product.manufacturer": "NVIDIA"
	});
}

// Default export object
const adb = {
	initialize,
	getClient,
	getDevice,
	getDeviceId,
	shell,
	connect,
	disconnect,
	input,
	screenshot,
	listPackages,
	getProperties
};

export default adb;
