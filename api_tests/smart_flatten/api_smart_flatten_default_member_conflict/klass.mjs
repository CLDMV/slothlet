/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_default_member_conflict/klass.mjs
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
 * @fileoverview Fixture: a class-instance default whose prototype method `add` shares its name with a
 * named export, plus a non-conflicting named export `extra`.
 * @module api_smart_flatten_default_member_conflict.klass
 */

class Store {
	add() {
		return "default.add";
	}
	own() {
		return "default.own";
	}
}

export default new Store();

/**
 * Conflicts with the instance's `add` method.
 * @returns {string} "named.add".
 */
export function add() {
	return "named.add";
}

/**
 * No conflict.
 * @returns {string} "named.extra".
 */
export function extra() {
	return "named.extra";
}
