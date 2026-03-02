/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_tv_test/manufacturer/lg/keys.mjs
 *	@Date: 2025-10-27T09:42:13-07:00 (1761583333)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:17 -08:00 (1772425277)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * ADB API module for Android TV Remote - Dummy implementation for testing.
 */
export const inputs = {
	HDMI1: "HDMI_1",
	HDMI2: "HDMI_2",
	USB: "USB"
};

export const keys = {
	POWER: "POWER",
	HOME: "HOME",
	UP: "UP",
	DOWN: "DOWN"
};

export const keyMap = new Map([
	["POWER", "POWER"],
	["HOME", "HOME"],
	["UP", "UP"],
	["DOWN", "DOWN"]
]);

export function getKeyCode(keyName) {
	return keys[keyName] || "UNKNOWN";
}

export function getKeyCommand(keyName) {
	return `cmd_${keyName}`;
}

export function isValidKey(keyName) {
	return keyName in keys;
}

export function getAllKeyNames() {
	return Object.keys(keys);
}

export function getAllInputNames() {
	return Object.keys(inputs);
}

export function getInputCode(inputName) {
	return inputs[inputName] || "UNKNOWN";
}

export function isValidInput(inputName) {
	return inputName in inputs;
}
