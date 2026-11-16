/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vm_recompiled/shared/peek.mjs
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
 * @fileoverview A helper the trusted ES module imports: it calls the vault's secret, as the code of whichever api file
 * it is loaded for.
 *
 * @module api_tests/api_test_vm_recompiled/shared/peek
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the vault's secret.
 * @returns {string} The secret.
 * @public
 * @example
 * peek(); // "s3cret"
 */
export function peek() {
	return self.vault.secret.secret();
}
