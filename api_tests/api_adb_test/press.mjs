/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_adb_test/press.mjs
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
 * @fileoverview Remote key press API module for Android TV Remote - Dummy implementation for testing.
 * @module api_adb_test.press
 * @memberof module:api_adb_test
 */

// Slothlet runtime imports for live bindings
import { self as _ } from "@cldmv/slothlet/runtime";

// Dummy remote key data
const remoteKeys = {
	"POWER": "26",
	"HOME": "3",
	"BACK": "4",
	"UP": "19",
	"DOWN": "20",
	"LEFT": "21",
	"RIGHT": "22",
	"SELECT": "23",
	"MENU": "82"
};

const keycodes = {
	"26": "KEYCODE_POWER",
	"3": "KEYCODE_HOME",
	"4": "KEYCODE_BACK",
	"19": "KEYCODE_DPAD_UP",
	"20": "KEYCODE_DPAD_DOWN",
	"21": "KEYCODE_DPAD_LEFT",
	"22": "KEYCODE_DPAD_RIGHT",
	"23": "KEYCODE_DPAD_CENTER",
	"82": "KEYCODE_MENU"
};

/**
	* Presses a remote control key.
	*	@param {string} keyName - Name of the key to press
	*	@returns {Promise<void>}
	*/
export async function key(keyName) {
	const keyCode = remoteKeys[keyName.toUpperCase()];
	return Promise.resolve({
		keyPressed: keyName,
		keyCode: keyCode || "UNKNOWN"
	});
}

/**
	* Presses the power button.
	*	@returns {Promise<void>}
	*/
export async function power() {
	return key("POWER");
}

/**
	* Presses the home button.
	*	@returns {Promise<void>}
	*/
export async function home() {
	return key("HOME");
}

/**
	* Presses the back button.
	*	@returns {Promise<void>}
	*/
export async function back() {
	return key("BACK");
}

/**
	* Presses navigation keys.
	*	@param {string} direction - Direction ("up", "down", "left", "right")
	*	@returns {Promise<void>}
	*/
export async function navigate(direction) {
	return key(direction.toUpperCase());
}

/**
	* Presses the select/OK button.
	*	@returns {Promise<void>}
	*/
export async function select() {
	return key("SELECT");
}

/**
	* Gets available remote keys.
	*	@returns {Object} Remote keys mapping
	*/
export function getRemoteKeys() {
	return remoteKeys;
}

/**
	* Gets keycodes mapping.
	*	@returns {Object} Keycodes mapping
	*/
export function getKeycodes() {
	return keycodes;
}

// Default export object
const press = {
	key,
	power,
	home,
	back,
	navigate,
	select,
	getRemoteKeys,
	getKeycodes
};

export default press;

