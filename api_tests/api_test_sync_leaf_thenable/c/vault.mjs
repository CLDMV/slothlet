/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_sync_leaf_thenable/c/vault.mjs
 *	@Date: 2026-11-03T04:43:57-08:00 (1793709837)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T05:23:26-08:00 (1793712206)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Guarded target for the sync-leaf-thenable tests (#599). Only module `a` may call `secret`;
 * `whoami` is open to everyone and reports who called it.
 *
 * @module api_tests/api_test_sync_leaf_thenable/c/vault
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Return the guarded value. Only module `a` may call this.
 * @returns {string} A constant marker.
 * @public
 * @example
 * api.c.vault.secret(); // "s3cret"
 */
export function secret() {
	return "s3cret";
}

/**
 * Report the api path of the module that called this leaf.
 * @returns {string|null} The caller's api path, or null when called from the host.
 * @public
 * @example
 * api.c.vault.whoami(); // null (host)
 */
export function whoami() {
	return self.slothlet.metadata.caller()?.apiPath ?? null;
}
