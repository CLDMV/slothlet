/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_none/users.mjs
 *	@Date: 2026-01-04T16:31:08-08:00 (1767573068)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-10 21:07:57 -07:00 (1773202077)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview User service fixture for api_smart_flatten_none — tests that smart-flatten is disabled
 * when the flatten option is not set, verifying normal nested API structure is preserved.
 * @module api_smart_flatten_none.users
 */
/**
 * getUser.
 * @param {*} id - id.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_smart_flatten_none = await slothlet({ dir: './api_tests/smart_flatten/api_smart_flatten_none' });
 * api_smart_flatten_none.users.getUser('item1');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_smart_flatten_none = await slothlet({ dir: './api_tests/smart_flatten/api_smart_flatten_none' });
 *   api_smart_flatten_none.users.getUser('item1');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_smart_flatten_none = await slothlet({ dir: './api_tests/smart_flatten/api_smart_flatten_none' });
 *   api_smart_flatten_none.users.getUser('item1');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_smart_flatten_none = await slothlet({ dir: './api_tests/smart_flatten/api_smart_flatten_none' });
 * api_smart_flatten_none.users.getUser('item1');
 */
export function getUser(id) {
	return `User ${id}`;
}

/**
 * updateUser.
 * @param {*} id - id.
 * @param {*} data - data.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_none.users.updateUser(null, null);
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_none.users.updateUser(null, null);
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 *   smart_flatten.api_smart_flatten_none.users.updateUser(null, null);
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const smart_flatten = await slothlet({ dir: './api_tests/smart_flatten' });
 * smart_flatten.api_smart_flatten_none.users.updateUser(null, null);
 */
export function updateUser(id, data) {
	return `User ${id} updated with ${data}`;
}

export default {
	name: "user-service",
	version: "1.0.0"
};
