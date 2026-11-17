/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vm_recompiled/base/vault/secret.mjs
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
 * @fileoverview The vault for the recompiled-source tests: a target only the trusted modules may call, and one reporting who
 * called it.
 *
 * @module api_tests/api_test_vm_recompiled/base/vault/secret
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * The secret only the trusted modules may call.
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
	return self.slothlet.metadata.caller()?.path?.join(".") ?? null;
}
