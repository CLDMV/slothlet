/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_namespace_callable_second/main.mjs
 *	@Date: 2026-10-02T00:00:00-07:00 (1790924400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:27:55-07:00 (1791091675)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A second single-file module whose default export makes a shared namespace callable, so
 * two modules compete for the same namespace function (#533).
 * @module api_test_namespace_callable_second.main
 */

/**
 * @function main
 * @returns {string} `"second:main"`.
 */
export default function main() {
	return "second:main";
}

/**
 * @function more
 * @returns {string} `"second:more"`.
 */
export function more() {
	return "second:more";
}
