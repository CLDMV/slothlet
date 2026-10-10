/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_slot_default/registry.mjs
 *	@Date: 2026-10-09T00:00:00-07:00 (1791529200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T00:00:00-07:00 (1791529200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a built-in `Map` default plus a named export. A Map's methods and `size` work
 * only on the Map itself (its internal slots), never on a copy.
 * @module api_smart_flatten_slot_default.registry
 */

export default new Map([
	["a", 1],
	["b", 2]
]);

/**
 * A named export composed beside the Map.
 * @returns {string} "registry.extra".
 */
export function extra() {
	return "registry.extra";
}
