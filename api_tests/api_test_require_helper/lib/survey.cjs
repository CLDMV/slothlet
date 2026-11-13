/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_require_helper/lib/survey.cjs
 *	@Date: 2026-11-12T23:03:11-08:00 (1794553391)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:03:11-08:00 (1794553391)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS helper file the api files of this fixture load with `createRequire`: it keeps a count in
 * module state and reads members of an api node it is handed.
 * @module api_test_require_helper.lib.survey
 */
let count = 0;

/**
 * Run a read, giving back what it returns or the code of the error it threw.
 * @param {Function} read - The read.
 * @returns {*} The outcome.
 * @example
 * attempt(() => node.hid); // "S3CRET"
 */
function attempt(read) {
	try {
		return read();
	} catch (error) {
		return error.code ?? error.name;
	}
}

/**
 * Count one up.
 * @returns {number} The count so far in this copy of the module.
 * @example
 * bump(); // 1
 */
function bump() {
	return ++count;
}

/**
 * Read three members of a node: one directly, one through a member, one through a described member.
 * @param {object} node - The node.
 * @returns {{hid: *, k: *, kDesc: *}} What each read gave.
 * @example
 * survey(node); // { hid: "S3CRET", k: 1, kDesc: 1 }
 */
function survey(node) {
	return {
		hid: attempt(() => node.hid),
		k: attempt(() => node.obj.k),
		kDesc: attempt(() => Object.getOwnPropertyDescriptor(node, "obj").value.k)
	};
}

module.exports = { bump, survey };
