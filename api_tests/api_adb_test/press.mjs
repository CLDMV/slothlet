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
/**
 * @namespace press
 * @memberof module:api_adb_test
 * @alias module:api_adb_test.press
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
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.key('myKey');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.key('myKey');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.key('myKey');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.key('myKey');
 */
/**
 * key.
 * @param {*} keyName - keyName.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.key('myKey');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.key('myKey');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.key('myKey');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.key('myKey');
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
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.power();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.power();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.power();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.power();
 */
/**
 * power.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.power();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.power();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.power();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.power();
 */
export async function power() {
	return key("POWER");
}

/**
	* Presses the home button.
	*	@returns {Promise<void>}
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.home();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.home();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.home();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.home();
 */
/**
 * home.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.home();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.home();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.home();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.home();
 */
export async function home() {
	return key("HOME");
}

/**
	* Presses the back button.
	*	@returns {Promise<void>}
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.back();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.back();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.back();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.back();
 */
/**
 * back.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.back();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.back();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.back();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.back();
 */
export async function back() {
	return key("BACK");
}

/**
	* Presses navigation keys.
	*	@param {string} direction - Direction ("up", "down", "left", "right")
	*	@returns {Promise<void>}
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.navigate('./');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.navigate('./');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.navigate('./');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.navigate('./');
 */
/**
 * navigate.
 * @param {*} direction - direction.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.navigate('./');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.navigate('./');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.navigate('./');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.navigate('./');
 */
export async function navigate(direction) {
	return key(direction.toUpperCase());
}

/**
	* Presses the select/OK button.
	*	@returns {Promise<void>}
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.select();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.select();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.select();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.select();
 */
/**
 * select.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.select();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.select();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.press.select();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.press.select();
 */
export async function select() {
	return key("SELECT");
}

/**
	* Gets available remote keys.
	*	@returns {Object} Remote keys mapping
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.press.getRemoteKeys();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.press.getRemoteKeys();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.press.getRemoteKeys();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.press.getRemoteKeys();
 */
/**
 * getRemoteKeys.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.press.getRemoteKeys();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.press.getRemoteKeys();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.press.getRemoteKeys();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.press.getRemoteKeys();
 */
export function getRemoteKeys() {
	return remoteKeys;
}

/**
	* Gets keycodes mapping.
	*	@returns {Object} Keycodes mapping
	* *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.press.getKeycodes();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.press.getKeycodes();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.press.getKeycodes();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.press.getKeycodes();
 */
/**
 * getKeycodes.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.press.getKeycodes();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.press.getKeycodes();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   api_adb_test.press.getKeycodes();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * api_adb_test.press.getKeycodes();
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

