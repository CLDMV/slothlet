/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_framework_name_routes/routes/probe/target.mjs
 *	@Date: 2026-11-25T14:52:50-08:00 (1795647170)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:02-08:00 (1795868882)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The namespace and the function node this module plants members on, through `self`, under names with
 * the framework's prefix; then it makes the node create a child.
 * @module api_test_framework_name_routes.routes.probe.target
 */

import { self } from "@cldmv/slothlet/runtime";
import { planted } from "../../lib/capture.mjs";
import { runRoute } from "../../lib/routes.mjs";

/** A namespace node. */
export const box = { first: { leaf: 1 } };

/**
 * A function node.
 * @returns {string} "fn".
 */
export function fn() {
	return "fn";
}

/**
 * Plant `name` on one of this module's nodes through one route, then add a member that makes the node create a child.
 * @param {"box"|"fn"} where - The namespace node or the function node.
 * @param {string} route - The route (see `lib/routes.mjs`).
 * @param {string} name - The member's name.
 * @returns {{outcome: string, later: *}} What the route did, and the leaf read back through the child made after it.
 */
export function plant(where, route, name) {
	const outcome = runRoute(route, self.probe.target[where], name, planted(`${where}.${route}.${name}`));
	self.probe.target[where].later = { nested: { leaf: 2 } };
	return { outcome, later: self.probe.target[where].later.nested.leaf };
}

export { calls } from "../../lib/capture.mjs";
