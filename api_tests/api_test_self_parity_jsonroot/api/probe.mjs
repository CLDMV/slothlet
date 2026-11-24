/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_parity_jsonroot/api/probe.mjs
 *	@Date: 2026-11-15T17:03:37-08:00 (1794791017)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:06:36-08:00 (1795536396)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run one operation, reporting a throw as its error code or name.
 * @param {function(): *} op - The operation.
 * @returns {*} Its result, or `threw:<code|name>`.
 */
function attempt(op) {
	try {
		return op();
	} catch (error) {
		return `threw:${error?.code ?? error?.name}`;
	}
}

/**
 * Serialize `self` as a whole, as plain JavaScript serializes the api.
 * @returns {string} What `JSON.stringify(self)` gave, or `threw:<code>`.
 */
export function json() {
	return attempt(() => JSON.stringify(self));
}

/**
 * Read the framework's `principal.toJSON` by name.
 * @returns {string} `"read"`, or `threw:<code>`.
 */
export function principalToJSON() {
	return attempt(() => {
		void self.slothlet.permissions.principal.toJSON;
		return "read";
	});
}

/**
 * Read the refused-by-rule member by name.
 * @returns {*} Its value, or `threw:<code>`.
 */
export function hidden() {
	return attempt(() => self.config.settings.hidden);
}
