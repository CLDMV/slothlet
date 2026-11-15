/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_root_integrity/inspector/show.mjs
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
 * @fileoverview Inspects the api root through `self` and through `self.slothlet.diag.getAPI()`, and lists the keys
 * the same route gives.
 * @module api_test_api_root_integrity/inspector/show
 */

import { self } from "@cldmv/slothlet/runtime";
import util from "node:util";

/**
 * What `util.inspect` shows of the root through a route, and the keys the route lists.
 * @param {"self"|"api"} via - Through `self` or `self.slothlet.diag.getAPI()`.
 * @returns {{shown: string, keys: string[]}} Both.
 */
export function show(via) {
	const root = via === "api" ? self.slothlet.diag.getAPI() : self;
	return { shown: util.inspect(root, { depth: 0 }), keys: Object.keys(root) };
}
