/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_special_numbers/nested.mjs
 *	@Date: 2026-10-12T03:09:00-07:00 (1791799740)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T03:41:38-07:00 (1791801698)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a member deeper than the tool's display depth, and an underscore-prefixed function.
 * @module api_test_special_numbers.nested
 */

export const tree = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { leaf: 1 } } } } } } } } } } };

export function _hidden() {
	return "hidden";
}
