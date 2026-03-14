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
 * @fileoverview Key constants module for LG TV manufacturer testing.
 * @module api_tv_test.manufacturer.lg.keys
 * @memberof module:api_tv_test
 */
/**
 * @namespace keys
 * @memberof module:api_tv_test.manufacturer.lg
 * @alias module:api_tv_test.manufacturer.lg.keys
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

/**
 * getKeyCode.
 * @param {*} keyName - keyName.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.getKeyCode(null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.getKeyCode(null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.getKeyCode(null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.getKeyCode(null);
 */
export function getKeyCode(keyName) {
	return keys[keyName] || "UNKNOWN";
}

/**
 * getKeyCommand.
 * @param {*} keyName - keyName.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.getKeyCommand(null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.getKeyCommand(null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.getKeyCommand(null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.getKeyCommand(null);
 */
export function getKeyCommand(keyName) {
	return `cmd_${keyName}`;
}

/**
 * isValidKey.
 * @param {*} keyName - keyName.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.isValidKey(null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.isValidKey(null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.isValidKey(null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.isValidKey(null);
 */
export function isValidKey(keyName) {
	return keyName in keys;
}

/**
 * getAllKeyNames.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.getAllKeyNames();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.getAllKeyNames();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.getAllKeyNames();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.getAllKeyNames();
 */
export function getAllKeyNames() {
	return Object.keys(keys);
}

/**
 * getAllInputNames.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.getAllInputNames();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.getAllInputNames();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.getAllInputNames();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.getAllInputNames();
 */
export function getAllInputNames() {
	return Object.keys(inputs);
}

/**
 * getInputCode.
 * @param {*} inputName - inputName.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.getInputCode(null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.getInputCode(null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.getInputCode(null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.getInputCode(null);
 */
export function getInputCode(inputName) {
	return inputs[inputName] || "UNKNOWN";
}

/**
 * isValidInput.
 * @param {*} inputName - inputName.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.isValidInput(null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.isValidInput(null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.manufacturer.lg.keys.isValidInput(null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.manufacturer.lg.keys.isValidInput(null);
 */
export function isValidInput(inputName) {
	return inputName in inputs;
}
