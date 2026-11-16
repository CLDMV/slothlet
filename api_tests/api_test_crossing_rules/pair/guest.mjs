/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules/pair/guest.mjs
 *	@Date: 2026-11-11T10:10:16-08:00 (1794420616)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T10:13:02-08:00 (1794420782)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The other of two files loaded from one folder: reaches the keeper's instances through a callback and a
 * container of its own, and tries to change the keeper's class through them.
 * @module api_test_crossing_rules/pair/guest
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Write a member onto the prototype of an instance.
 * @param {object} instance - The instance.
 * @param {string} key - The member.
 * @returns {string} `"written"`, or the code the write was refused with.
 */
function plant(instance, key) {
	try {
		Object.getPrototypeOf(instance)[key] = () => "planted";
		return "written";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Reach the keeper's instance by each route and write onto its class.
 * @param {string} prefix - The prefix of the members written.
 * @returns {Object<string, string>} How each route's write ended.
 */
export function reach(prefix) {
	const outcome = {};
	outcome.returned = plant(self.keeper.give(), `${prefix}returned`);
	let got;
	self.keeper.each((instance) => (got = instance));
	outcome.callback = plant(got, `${prefix}callback`);
	const box = {};
	self.keeper.fill(box);
	outcome.stored = plant(box.inst, `${prefix}stored`);
	return outcome;
}
