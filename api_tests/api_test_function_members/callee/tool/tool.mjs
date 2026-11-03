/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_members/callee/tool/tool.mjs
 *	@Date: 2026-11-03T00:00:00-08:00 (1793692800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T00:00:00-08:00 (1793692800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #632 — a file whose node is a class: its static members stay on the class once it loads, so a chain
 * read through them before it loads resolves to them.
 *
 * @module api_tests/api_test_function_members/callee/tool/tool
 */

/**
 * A class standing for its file's node.
 * @public
 */
export default class Tool {
	/**
	 * A static method.
	 * @returns {string} A marker.
	 */
	static open() {
		return "tool.open";
	}
}
