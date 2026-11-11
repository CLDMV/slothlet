/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_inherited_members/probe.mjs
 *	@Date: 2026-11-04T21:15:39-08:00 (1793855739)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T22:25:42-08:00 (1793859942)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Runs the inherited-member cases (#630) against api nodes reached through `self`, so module code is
 * checked the same way as the host.
 * @module api_test_inherited_members/probe
 */

import { self } from "@cldmv/slothlet/runtime";
import { exercise, shadowed } from "../api_test_inherited_members_lib/cases.mjs";

/**
 * Exercise every inherited member of the node at `path`, read through `self`.
 * @param {string} path - Dotted api path of the node.
 * @param {string} ownKey - A key the node holds as its own.
 * @returns {object} The outcomes, see `exercise`.
 */
export function run(path, ownKey) {
	return exercise(
		path.split(".").reduce((node, key) => node[key], self),
		ownKey
	);
}

/**
 * Call the exports named like `Object.prototype` members, through `self`.
 * @returns {object} The results, see `shadowed`.
 */
export function runShadowed() {
	return shadowed(self);
}
