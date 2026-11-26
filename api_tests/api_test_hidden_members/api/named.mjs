/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_hidden_members/api/named.mjs
 *	@Date: 2026-11-25T02:33:27-08:00 (1795602807)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:59:39-08:00 (1795604379)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A named object export with a non-enumerable own member, beside a function.
 * @module api_test_hidden_members/named
 */

/** Options with one member left out of enumeration. */
export const opts = { a: 1 };
Object.defineProperty(opts, "quiet", { value: 2, enumerable: false });

/**
 * Read an option.
 * @returns {number} `opts.a`.
 */
export function run() {
	return opts.a;
}
