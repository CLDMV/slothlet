/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/folder-collapse-mount/__base/probe.mjs
 *	@Date: 2026-11-13T16:59:41-08:00 (1794617981)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T17:24:39-08:00 (1794619479)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that calls another by its api path, for rules written against that path (#743).
 * @module folder-collapse-mount.__base
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the function at a dotted api path through `self`.
 * @param {string} apiPath - The dotted path of a function.
 * @returns {Promise<string>} What it returned, or the code of the error it threw.
 * @example
 * await api.probe.call("e.a"); // "e/e/e.mjs:a"
 */
export async function call(apiPath) {
	try {
		let node = self;
		for (const key of apiPath.split(".")) node = node[key];
		return await node();
	} catch (error) {
		return error.code ?? error.name;
	}
}
