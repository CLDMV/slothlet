/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_code/vault/secret.mjs
 *	@Date: 2026-10-16T19:30:00-07:00 (1792204200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T19:30:00-07:00 (1792204200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Guarded target for the caller-supplied-code tests (#597). The rules allow `secret` to the
 * callee module only; `whoami` is open to everyone and reports who called it.
 *
 * @module api_tests/api_test_caller_supplied_code/vault/secret
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Return the guarded value. Only the callee module may call this.
 * @returns {string} A constant marker.
 * @public
 * @example
 * api.vault.secret.secret(); // "s3cret"
 */
export function secret() {
	return "s3cret";
}

/**
 * Report the api path of the module that called this leaf.
 * @returns {string|null} The caller's api path, or null when called from the host.
 * @public
 * @example
 * api.vault.secret.whoami(); // null (host)
 */
export function whoami() {
	return self.slothlet.metadata.caller()?.apiPath ?? null;
}
