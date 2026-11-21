/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules/split/readers/narrow.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T00:00:00-08:00 (1794816000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview One of two readers of the split fixture, held to a write rule covering one member of the owner's: takes the owner's class
 * and writes a static onto it itself and through a built-in the owner runs.
 * @module api_test_crossing_rules/split/readers/narrow
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
 * Take the owner's class, so this file is handed it.
 * @returns {Promise<string>} Its `typeof`.
 */
export async function take() {
	return typeof (await self.owner.hiddenCls()).Hidden;
}

/**
 * Have the owner run a built-in bound to a write of a static onto its class.
 * @returns {Promise<string>} How the write ended.
 */
export async function deputy() {
	return attempt(async () => self.owner.run(Object.assign.bind(null, (await self.owner.hiddenCls()).Hidden, { make: 1 })));
}

/**
 * Write a static onto the owner's class.
 * @returns {Promise<string>} How the write ended.
 */
export async function direct() {
	return attempt(async () => {
		(await self.owner.hiddenCls()).Hidden.make = 1;
	});
}
