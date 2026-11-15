/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_package_frame/api/bag/bag.mjs
 *	@Date: 2026-11-14T08:00:00-08:00 (1794672000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T19:57:20-08:00 (1794715040)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that hands out functions calling the vault: through one package, through two, through a host
 * file's function, and directly.
 * @module api_test_load_package_frame.bag
 * @memberof module:api_test_load_package_frame
 */
import { self } from "@cldmv/slothlet/runtime";
import { descend } from "callback-walker";
import { relay } from "frame-relay";

/**
 * A function calling the vault's node the way `route` says, from `depth` frames of the code between.
 * @function give
 * @memberof module:api_test_load_package_frame.bag
 * @param {string} route - `"package"`, `"two"` (two packages), `"host"` (a host file's function) or `"direct"`.
 * @param {number} depth - How deep the code between recurses.
 * @returns {function(): string} The function.
 * @example
 * (await api.bag.give("package", 5))(); // "SECRET"
 */
export const give = (route, depth) => {
	if (route === "package") return () => descend(depth, self.vault.get);
	if (route === "two") return () => relay(depth, self.vault.get);
	if (route === "host") return () => globalThis.__loadPackageFrameWalk(depth, self.vault.get);
	return () => self.vault.get();
};
