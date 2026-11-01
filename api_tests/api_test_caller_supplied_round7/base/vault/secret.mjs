/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round7/base/vault/secret.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The vault for the seventh round of caller-supplied-code tests (#597): a secret only the callee may call,
 * and a target reporting who called it.
 *
 * @module api_tests/api_test_caller_supplied_round7/base/vault/secret
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * The secret only the callee may call.
 * @returns {string} The secret.
 * @public
 * @example
 * api.vault.secret.secret(); // "s3cret"
 */
export function secret() {
	return "s3cret";
}

/**
 * Report who called.
 * @returns {string|null} The caller's api path.
 * @public
 * @example
 * api.vault.secret.whoami(); // null
 */
export function whoami() {
	return self.slothlet.metadata.caller()?.apiPath ?? null;
}
