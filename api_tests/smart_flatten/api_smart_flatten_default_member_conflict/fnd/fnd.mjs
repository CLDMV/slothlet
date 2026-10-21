/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_default_member_conflict/fnd/fnd.mjs
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
 * @fileoverview Fixture: a function default with named exports `call` and `bind`, which Function.prototype
 * provides but the function itself does not own, so they do not conflict.
 * @module api_smart_flatten_default_member_conflict.fnd.fnd
 */

/**
 * The default.
 * @returns {string} "fnd".
 */
export default function fnd() {
	return "fnd";
}

/**
 * Not a conflict.
 * @returns {string} "named.call".
 */
export function call() {
	return "named.call";
}

/**
 * Not a conflict.
 * @returns {string} "named.bind".
 */
export function bind() {
	return "named.bind";
}
