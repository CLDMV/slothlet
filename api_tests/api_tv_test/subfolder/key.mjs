/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_tv_test/subfolder/key.mjs
 *	@Date: 2025-10-27T09:42:13-07:00 (1761583333)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:18 -08:00 (1772425278)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Key input API module for TV Remote subfolder testing.
 * @module api_tv_test.subfolder.key
 * @memberof module:api_tv_test
 */
/**
 * @namespace key
 * @memberof module:api_tv_test.subfolder
 * @alias module:api_tv_test.subfolder.key
 */
/**
 * key.
 * @param {*} keyName - keyName.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * await api_tv_test.subfolder.key.key('myKey');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   await api_tv_test.subfolder.key.key('myKey');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   await api_tv_test.subfolder.key.key('myKey');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * await api_tv_test.subfolder.key.key('myKey');
 */
export async function key(keyName, _ = {}) {
	return { success: true, key: keyName };
}

/**
 * getAllKeyNames.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.subfolder.key.getAllKeyNames();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.subfolder.key.getAllKeyNames();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.subfolder.key.getAllKeyNames();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.subfolder.key.getAllKeyNames();
 */
export function getAllKeyNames() {
	return ["POWER", "HOME", "UP", "DOWN", "LEFT", "RIGHT", "OK", "BACK"];
}

/**
 * getKeyCode.
 * @param {*} keyName - keyName.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.subfolder.key.getKeyCode(null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.subfolder.key.getKeyCode(null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.subfolder.key.getKeyCode(null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.subfolder.key.getKeyCode(null);
 */
export function getKeyCode(keyName) {
	const codes = {
		POWER: 1,
		HOME: 2,
		UP: 3,
		DOWN: 4
	};
	return codes[keyName] || 0;
}

export default key;
