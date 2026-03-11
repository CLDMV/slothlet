/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_tv_test/devices/firetv.mjs
 *	@Date: 2025-11-04T20:54:38-08:00 (1762318478)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:16 -08:00 (1772425276)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview FireTV device module for TV Remote testing.
 * @module api_tv_test.devices.firetv
 * @memberof module:api_tv_test
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
 * Common remote control keys - constants for external use
 * @namespace
 * @public
 */
export const REMOTE_KEYS = {
	// Power
	/** @public */ POWER: "POWER",
	/** @public */ SLEEP: "SLEEP",

	// Navigation
	/** @public */ HOME: "HOME",
	/** @public */ BACK: "BACK",
	/** @public */ MENU: "MENU",
	/** @public */ UP: "DPAD_UP",
	/** @public */ DOWN: "DPAD_DOWN",
	/** @public */ LEFT: "DPAD_LEFT",
	/** @public */ RIGHT: "DPAD_RIGHT",
	/** @public */ CENTER: "DPAD_CENTER",
	/** @public */ SELECT: "DPAD_CENTER",

	// Volume
	/** @public */ VOLUME_UP: "VOLUME_UP",
	/** @public */ VOLUME_DOWN: "VOLUME_DOWN",
	/** @public */ MUTE: "VOLUME_MUTE",

	// Playback
	/** @public */ PLAY: "MEDIA_PLAY",
	/** @public */ PAUSE: "MEDIA_PAUSE",
	/** @public */ PLAY_PAUSE: "MEDIA_PLAY_PAUSE",
	/** @public */ STOP: "MEDIA_STOP",
	/** @public */ NEXT: "MEDIA_NEXT",
	/** @public */ PREVIOUS: "MEDIA_PREVIOUS",
	/** @public */ FAST_FORWARD: "MEDIA_FAST_FORWARD",
	/** @public */ REWIND: "MEDIA_REWIND"
};

/**
 * Helper function to validate remote key constants (demonstrates usage)
 * @param {string} key - Key to validate
 * @returns {boolean} True if key is valid
 * @example
 * isValidRemoteKey(REMOTE_KEYS.POWER); // true
 */
export function isValidRemoteKey(key) {
	return Object.values(REMOTE_KEYS).includes(key);
}

