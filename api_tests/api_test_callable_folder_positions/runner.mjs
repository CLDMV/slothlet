/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_callable_folder_positions/runner.mjs
 *	@Date: 2026-11-14T14:30:00-08:00 (1794695400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T14:30:00-08:00 (1794695400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module the rules allow the vault, which runs a function another file handed out.
 * @module api_test_callable_folder_positions.runner
 * @memberof module:api_test_callable_folder_positions
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Ask a node for its function and run it: the node itself is called when no export is named.
 * @function run
 * @memberof module:api_test_callable_folder_positions.runner
 * @param {string} name - The node's api name.
 * @param {string} [member] - The member to call; the node itself when omitted.
 * @returns {Promise<string>} What the function returned, or the code of the error it threw.
 * @example
 * await api.runner.run("selfnamed"); // "SECRET"
 */
export async function run(name, member) {
	try {
		const node = self[name];
		const made = await (member ? node[member]() : node());
		return await made();
	} catch (error) {
		return error.code ?? error.name;
	}
}
