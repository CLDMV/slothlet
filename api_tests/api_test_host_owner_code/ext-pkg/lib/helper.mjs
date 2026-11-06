/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_owner_code/ext-pkg/lib/helper.mjs
 *	@Date: 2026-11-06T06:20:46-08:00 (1793974846)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T06:24:35-08:00 (1793975075)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The helper of `ext-pkg` (#714): a file of the module's package outside its `api` folder, imported by
 * its leaf, calling the host's leaf through `self` after an `await`.
 * @module ext-pkg.lib.helper
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the host's leaf.
 * @returns {Promise<string>} What it gives.
 */
export async function readHost() {
	await Promise.resolve();
	return self.host.echo("helper");
}
