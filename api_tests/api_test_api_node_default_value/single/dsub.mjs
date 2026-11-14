/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_default_value/single/dsub.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794589200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:00:00-08:00 (1794589200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An instance of an `Error` subclass written in this file, the file's default export.
 * @module api_test_api_node_default_value/single/dsub
 */

/** An `Error` subclass with an own enumerable member and a method of its own. */
class Failure extends Error {
	/**
	 * @param {string} message - The message.
	 */
	constructor(message) {
		super(message);
		this.name = "Failure";
		this.code = "E_FAIL";
	}

	/**
	 * @returns {string} A description built from the members.
	 */
	describe() {
		return `${this.name}:${this.code}:${this.message}`;
	}
}

/** An instance of {@link Failure}, the file's default export. */
export default new Failure("broken");
