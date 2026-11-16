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
 * @fileoverview A module file whose top-level code compiles a string as it loads, and reports how that went.
 *
 * @module api_tests/api_test_code_strings/toplevel/boot
 */

let outcome;
try {
	outcome = { ok: true, value: new Function("return 7")() };
} catch (error) {
	outcome = { ok: false, code: error?.code ?? String(error) };
}

/**
 * How the file's top-level compile went.
 * @returns {{ok: boolean, value?: number, code?: string}} The outcome.
 * @public
 * @example
 * api.toplevel.boot.result(); // { ok: false, code: "CAPABILITY_REFUSED" }
 */
export function result() {
	return outcome;
}
