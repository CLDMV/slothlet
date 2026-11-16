/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules/kin/aside.mjs
 *	@Date: 2026-11-15T16:00:00-08:00 (1794787200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T16:00:00-08:00 (1794787200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview One of three files loaded from one folder (before the owner's file in load order): reaches the owner's
 * class by each route and tries to change it.
 * @module api_test_crossing_rules/kin/aside
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a write and report how it ended.
 * @param {Function} write - The write.
 * @returns {Promise<string>} `"written"`, or the code the write was refused with.
 */
async function attempt(write) {
	try {
		await write();
		return "written";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Reach the owner's class by each route and write onto it, under keys starting `__kin_`. Takes no argument and
 * constructs an instance through the node first, so the owner's class is the first value of the folder's to cross.
 * @returns {Promise<Object<string, string>>} How each route's write ended.
 */
export async function reach() {
	const prefix = "__kin_";
	return {
		constructed: await attempt(() => {
			Object.getPrototypeOf(new self.owner.Base())[`${prefix}constructed`] = 1;
		}),
		returned: await attempt(async () => {
			Object.getPrototypeOf(await self.owner.make())[`${prefix}returned`] = 1;
		}),
		nested: await attempt(async () => {
			Object.getPrototypeOf((await self.owner.wrap()).inner.inst)[`${prefix}nested`] = 1;
		}),
		method: await attempt(async () => {
			Object.getPrototypeOf(await self.owner.make()).hello = () => "changed";
		}),
		node: await attempt(() => {
			self.owner.inst.hello = () => "changed";
		})
	};
}
