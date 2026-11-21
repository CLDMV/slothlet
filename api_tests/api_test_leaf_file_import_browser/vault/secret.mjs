/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_file_import_browser/vault/secret.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T00:00:00-08:00 (1794816000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The vault for the leaf-file import tests: a target only the keeper leaves may call, and one reporting
 * who called it.
 *
 * @module api_tests/api_test_leaf_file_import_browser/vault/secret
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * The secret only the keeper leaves may call.
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
