/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_code_strings_helpertop/lib/toplevel-helper.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:46-08:00 (1795868866)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file, imported by an api file, whose own top-level code compiles a string as it is first
 * evaluated, and keeps how that went.
 *
 * @module api_tests/api_test_code_strings/shared/toplevel-helper
 */

let outcome;
try {
	outcome = { ok: true, value: new Function("return 7")() };
} catch (error) {
	outcome = { ok: false, code: error?.code ?? String(error) };
}

/**
 * How the helper's top-level compile went.
 * @returns {{ok: boolean, value?: number, code?: string}} The outcome.
 * @public
 * @example
 * helperOutcome(); // { ok: false, code: "PERMISSION_CAPABILITY_REFUSED" }
 */
export function helperOutcome() {
	return outcome;
}
