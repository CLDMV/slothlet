/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_lifecycle_results/app/app.mjs
 *	@Date: 2026-11-16T01:33:20-08:00 (1794821600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:40-08:00 (1795868920)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that adds a folder to the api, which emits lifecycle events in its own call.
 * @module api_test_lifecycle_results/app
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Add a folder under a path, as this module.
 * @param {string} apiPath - Where to mount it.
 * @param {string} dir - The folder.
 * @returns {Promise<void>} Settles once mounted.
 */
export async function mount(apiPath, dir) {
	await self.slothlet.api.add(apiPath, dir);
}
