/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_scope_ext/list.mjs
 *	@Date: 2026-11-15T20:41:31-08:00 (1794804091)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T21:06:52-08:00 (1794805612)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Lists a module's leaf paths as this module is shown them.
 * @module api_test_private_scope_ext/list
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * The leaf paths `api.slothlet.api.leaves(key)` gives this module.
 * @param {string} key - A moduleID, mount endpoint or `"."`.
 * @returns {Promise<{paths: string[]|null, error: string|null}>} The paths, or the error's code.
 */
export async function paths(key) {
	try {
		return { paths: await self.slothlet.api.leaves(key), error: null };
	} catch (error) {
		return { paths: null, error: error?.code ?? error?.message ?? String(error) };
	}
}
