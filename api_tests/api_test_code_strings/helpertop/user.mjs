/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_code_strings/helpertop/user.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:25:28-08:00 (1794882328)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api file importing a helper whose top-level code compiles a string.
 *
 * @module api_tests/api_test_code_strings/helpertop/user
 */

import { helperOutcome } from "../shared/toplevel-helper.mjs";

/**
 * How the helper's top-level compile went.
 * @returns {{ok: boolean, value?: number, code?: string}} The outcome.
 * @public
 * @example
 * api.helpertop.user.result(); // { ok: false, code: "PERMISSION_CAPABILITY_REFUSED" }
 */
export function result() {
	return helperOutcome();
}
