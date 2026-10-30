/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_code/__lib/invoke.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper both the supplier and the callee import (#597). Its frames belong to neither module
 * alone, so code running in it inside the callee's call cannot be told to be the callee's own.
 *
 * @module api_tests/api_test_caller_supplied_code/__lib/invoke
 */

/**
 * Call the function at a dotted path of an object, with its parent as `this`.
 * @param {object} holder - The object to walk.
 * @param {string} path - Dotted path of the function.
 * @returns {*} The function's result.
 * @public
 * @example
 * invoke({ a: { b: () => 1 } }, "a.b"); // 1
 */
export function invoke(holder, path) {
	const keys = path.split(".");
	let parent = holder;
	for (const key of keys.slice(0, -1)) parent = parent[key];
	return parent[keys[keys.length - 1]]();
}
