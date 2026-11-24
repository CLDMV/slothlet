/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_parity_cjsroot/api/cjsprobe.cjs
 *	@Date: 2026-11-15T17:25:00-08:00 (1794792300)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:06:36-08:00 (1795536396)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

const { shape } = require("../../api_test_self_parity/lib/shape.cjs");

let runtime;
const ready = import("@cldmv/slothlet/runtime").then((namespace) => {
	runtime = namespace;
});

/**
 * Report what a CommonJS file's `self`, read from the runtime's namespace when called, answers.
 * @returns {Promise<Record<string, *>>} What each operation gave.
 */
exports.report = async function report() {
	await ready;
	return shape(runtime.self);
};
