/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_framework_name_routes/routes/probe/writer.mjs
 *	@Date: 2026-11-25T14:52:50-08:00 (1795647170)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:03:27-08:00 (1795651407)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Plants a member under a name with the framework's prefix on `self` itself (the api root).
 * @module api_test_framework_name_routes.routes.probe.writer
 */

import { self } from "@cldmv/slothlet/runtime";
import { planted } from "../../lib/capture.mjs";
import { runRoute } from "../../lib/routes.mjs";

/**
 * Plant `name` on `self` through one route.
 * @param {string} route - The route (see `lib/routes.mjs`), but `prototype`.
 * @param {string} name - The member's name.
 * @returns {string} What the route did.
 */
export function plantOnSelf(route, name) {
	return runRoute(route, self, name, planted(`self.${route}.${name}`));
}

/**
 * Plant `name` on the framework's namespace (`self.slothlet`) through one route.
 * @param {string} route - The route (see `lib/routes.mjs`), but `prototype`.
 * @param {string} name - The member's name.
 * @returns {string} What the route did.
 */
export function plantOnFramework(route, name) {
	return runRoute(route, self.slothlet, name, planted(`framework.${route}.${name}`));
}
