/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_plain_js/host/legacy.cjs
 *	@Date: 2026-11-11T23:30:00-08:00 (1794468600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T23:30:00-08:00 (1794468600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS module exporting a data object and functions that read it.
 * @module api_test_api_node_plain_js/legacy
 */

const state = { port: 80, nested: { a: 1 } };

module.exports = {
	/**
	 * A data object.
	 * @type {{port: number, nested: {a: number}}}
	 */
	state,
	/**
	 * The port the module's own `state` holds.
	 * @returns {number} `state.port`.
	 */
	readPort: () => state.port,
	/**
	 * A member of the module's own `state.nested`.
	 * @param {string} key - The member's key.
	 * @returns {*} `state.nested[key]`.
	 */
	readNested: (key) => state.nested[key]
};
