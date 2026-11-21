/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_node_named_compile/api/other.mjs
 *	@Date: 2026-11-17T08:00:00-08:00 (1794931200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T08:15:14-08:00 (1794932114)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A leaf the test's rules open `capability:code` for: it compiles code under the name it is given.
 * @module api_test_plain_node_named_compile.api.other
 */
import vm from "node:vm";

/**
 * Compile and run code under a file name.
 * @param {string} code - The code.
 * @param {string} [filename] - The name to compile it under.
 * @returns {*} What the code evaluates to.
 * @public
 * @example
 * api.other.compile("1 + 1", "file:///x.mjs"); // 2
 */
export function compile(code, filename) {
	return vm.runInThisContext(code, filename === undefined ? undefined : { filename });
}
