/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_code_strings/toplevel/boot.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module file whose top-level code turns strings into code as it loads, and reports how that went.
 *
 * @module api_tests/api_test_code_strings/toplevel/boot
 */

import vm from "node:vm";

/**
 * Try one route, as the file's own top-level code.
 * @param {function(): *} run - The route.
 * @returns {{ok: boolean, value?: *, code?: string}} The outcome.
 * @private
 */
function attempt(run) {
	try {
		return { ok: true, value: run() };
	} catch (error) {
		return { ok: false, code: error?.code ?? String(error) };
	}
}

const outcomes = {
	newFunction: attempt(() => new Function("return 7")()),
	vm: attempt(() => vm.runInThisContext("7")),
	// Node refuses a string callback itself; what matters is which refusal comes first.
	stringTimeout: attempt(() => setTimeout("void 0", 0))
};

/**
 * How the file's top-level routes went.
 * @returns {Record<string, {ok: boolean, value?: *, code?: string}>} Each route's outcome.
 * @public
 * @example
 * api.toplevel.boot.result(); // { ok: false, code: "CAPABILITY_REFUSED" }
 */
export function result() {
	return outcomes;
}
