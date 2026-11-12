/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_folder_dedupe/probe/probe.mjs
 *	@Date: 2026-11-11T21:25:45-08:00 (1794461145)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:02-08:00 (1794477362)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that calls another by its api path, for rules written against that path (#743).
 * @module api_test_folder_dedupe.probe
 * @memberof module:api_test_folder_dedupe
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the function at a dotted api path through `self`.
 * @function call
 * @memberof module:api_test_folder_dedupe.probe
 * @param {string} apiPath - The dotted path of a function.
 * @returns {Promise<string>} What it returned, or the code of the error it threw.
 * @example
 * await api.probe.call("e.x.where"); // "e.x.where"
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
