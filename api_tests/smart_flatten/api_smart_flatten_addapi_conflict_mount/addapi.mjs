/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_conflict_mount/addapi.mjs
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
 * @fileoverview Fixture (#587): the same addapi file, mounted through api.add
 * @module api_smart_flatten_addapi_conflict_mount.addapi
 */

const plugin = {
	label: "plugin-label",
	init: "default-init"
};

/** @type {{label: string, init: string}} */
export default plugin;

/**
 * @returns {string} Marker naming this source; conflicts with the default object's own `init`.
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

/**
 * The module's own default object keys, to prove composition does not mutate it.
 * @returns {string} Sorted, comma-joined keys.
 */
export function snapshot() {
	return Object.keys(plugin).sort().join(",");
}
