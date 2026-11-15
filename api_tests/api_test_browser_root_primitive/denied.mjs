/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser_root_primitive/denied.mjs
 *	@Date: 2026-11-15T07:43:15-08:00 (1794757395)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T07:55:10-08:00 (1794758110)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module the rules deny the root file's value.
 * @module api_test_browser_root_primitive/denied
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * What a check answers: its value, or the code it threw.
 * @param {Error} error - What the check threw.
 * @returns {{threw: string}} The code it threw.
 */
const threw = (error) => ({ threw: error?.code ?? error?.name ?? "threw" });

/**
 * Read a member of the api root through `self`.
 * @param {string} name - The member's name.
 * @returns {*} Its value, or what was thrown.
 */
export function read(name) {
	try {
		return self[name];
	} catch (error) {
		return threw(error);
	}
}

/**
 * Await a member of the api root through `self`.
 * @param {string} name - The member's name.
 * @returns {Promise<*>} What it settles to, or what was thrown.
 */
export async function settle(name) {
	try {
		return await self[name];
	} catch (error) {
		return threw(error);
	}
}

/**
 * The api root's keys as `self` lists them.
 * @returns {string[]|{threw: string}} The keys, or what was thrown.
 */
export function keys() {
	try {
		return Object.keys(self);
	} catch (error) {
		return threw(error);
	}
}
