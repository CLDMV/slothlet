/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_conflict/addapi/addapi.mjs
 *	@Date: 2026-10-08T00:00:00-07:00 (1791442800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-08T00:00:00-07:00 (1791442800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#583 review): an addapi file whose object default and a named export share a key
 * @module api_smart_flatten_addapi_conflict.addapi.addapi
 */

/** @type {{label: string, init: string}} */
export default {
	label: "plugin-label",
	init: "default-init"
};

/**
 * @returns {string} Marker naming this source; loses to the default object's own `init` (#421).
 */
export function init() {
	return "named-init";
}

/**
 * @returns {string} Marker naming this source.
 */
export function run() {
	return "named-run";
}
