/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_typegen_mixed/greet.mjs
 *	@Date: 2026-09-28T00:01:45-07:00 (1790578905)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:46-07:00 (1791090886)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A default-export function (typegen mixed-tree fixture, #484).
 * @module api_test_typegen_mixed.greet
 */

/**
 * Greet someone by name.
 * @param {string} name - Who to greet.
 * @returns {string} The greeting.
 */
export default function greet(name) {
	return `Hello, ${name}`;
}
