/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_closed_self_set/api/probe.mjs
 *	@Date: 2026-11-25T02:24:45-08:00 (1795602285)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:45-08:00 (1795868865)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Writes on this module's `self`, inside the module, once the host has closed the api root.
 */
import { self } from "@cldmv/slothlet/runtime";
import { writes } from "../lib/writes.mjs";

/**
 * Place the member the writes then change, as a module does: on its `self`.
 * @returns {number} What `self` holds there.
 */
export function seed() {
	self.counter = 0;
	// A hook this module registers is handed the api as the module reads it: the writes run on that too.
	self.slothlet.hook.on("probe.target:before", ({ api }) => {
		fromHook = writes(api, "counter");
	});
	return self.counter;
}

/** What the writes gave on the api the hook was handed. */
let fromHook = null;

/**
 * The call the hook runs before.
 * @returns {boolean} True.
 */
export function target() {
	return true;
}

/**
 * What the writes gave on the api the hook was last handed.
 * @returns {Record<string, *>|null} What each write gave.
 */
export function hookWrites() {
	return fromHook;
}

/**
 * Each write on `self`, as it answers here.
 * @returns {Record<string, *>} What each write gave.
 */
export function closedWrites() {
	return writes(self, "counter");
}
