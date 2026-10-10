/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_default_member_conflict/nonenum.mjs
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
 * @fileoverview Fixture: an object default with a non-enumerable, read-only own member `secret`, and
 * named exports `secret` (conflicts with that member) and `toString` (does not: Object.prototype's
 * `toString` is not a member of the default).
 * @module api_smart_flatten_default_member_conflict.nonenum
 */

const value = {
	visible() {
		return "default.visible";
	}
};
Object.defineProperty(value, "secret", {
	value() {
		return "default.secret";
	},
	enumerable: false
});

export default value;

/**
 * Conflicts with the default's own non-enumerable `secret`.
 * @returns {string} "named.secret".
 */
export function secret() {
	return "named.secret";
}

/**
 * Not a conflict: `toString` is inherited from Object.prototype.
 * @returns {string} "named.toString".
 */
export function toString() {
	return "named.toString";
}
