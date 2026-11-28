/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_load_package_frame/api/hrunner/hrunner.mjs
 *	@Date: 2026-11-14T08:00:00-08:00 (1794672000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:50-08:00 (1795868930)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that runs code from the job queue a helper file it imports started when it loaded: the bag's
 * functions, or its own code calling the vault through a package or a host file's function.
 * @module api_test_load_package_frame.hrunner
 * @memberof module:api_test_load_package_frame
 */
import { self } from "@cldmv/slothlet/runtime";
import { descend } from "callback-walker";
import { enqueue } from "../../lib/queue.mjs";

/**
 * This file's own code calling the vault, outside every export.
 * @param {string} route - `"package"`, `"host"` or `"direct"`.
 * @param {number} depth - How deep the code between recurses.
 * @returns {function(): string} The code.
 */
function own(route, depth) {
	if (route === "package") return () => descend(depth, self.vault.get);
	if (route === "host") return () => globalThis.__loadPackageFrameWalk(depth, self.vault.get);
	return () => self.vault.get();
}

/**
 * Run a route's code later, from the helper's job queue.
 * @function later
 * @memberof module:api_test_load_package_frame.hrunner
 * @param {string} route - The bag's route, or `"own-<route>"` for this file's own code.
 * @param {number} depth - How deep the code between recurses.
 * @returns {Promise<string>} What the vault answered, or the code of the refusal.
 * @example
 * await api.hrunner.later("package", 5); // "SECRET"
 */
export const later = async (route, depth) => {
	const code = route.startsWith("own-") ? own(route.slice(4), depth) : await self.bag.give(route, depth);
	return new Promise((resolve) =>
		enqueue(async () => {
			try {
				resolve(await code());
			} catch (error) {
				resolve(error?.code ?? String(error?.message ?? error));
			}
		})
	);
};
