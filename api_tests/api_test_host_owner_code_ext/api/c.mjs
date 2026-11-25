/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_owner_code_ext/api/c.mjs
 *	@Date: 2026-11-06T06:20:58-08:00 (1793974858)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:05:29-08:00 (1795536329)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module mounted from a package's `api` folder, whose work is done by a helper of the same package
 * outside that folder (`lib/helper.mjs`), as rummage-ext-store's leaves use its `src/lib` (#714).
 * @module api_test_host_owner_code_ext.api.c
 */
import { readHost } from "../lib/helper.mjs";

/**
 * Have the helper call the host's leaf.
 * @returns {Promise<string>} What the host's leaf gives.
 */
export async function useHelper() {
	return readHost();
}
