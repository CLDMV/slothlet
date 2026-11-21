/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_inherited_members/shadow.mjs
 *	@Date: 2026-11-04T21:15:39-08:00 (1793855739)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T22:25:42-08:00 (1793859942)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Exports named like `Object.prototype` members (#630): they are the module's own members and
 * must stay api children. `__hidden` is a genuine module-private export.
 * @module api_test_inherited_members/shadow
 */

/** @returns {string} Marker. */
export function toString() {
	return "own toString";
}

/** @returns {string} Marker. */
export function valueOf() {
	return "own valueOf";
}

/** @returns {string} Marker. */
export function hasOwnProperty() {
	return "own hasOwnProperty";
}

/** @returns {string} Marker. */
export function __hidden() {
	return "hidden";
}
