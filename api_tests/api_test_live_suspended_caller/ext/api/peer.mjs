/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/ext/api/peer.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A second api path of the extension that imports the sibling file `activate` resumes in,
 * so that file is both paths' code and the stack cannot tell which of them is running in it.
 * @module api_test_live_suspended_caller.ext.peer
 */
import { afterGate } from "./resume.mjs";

/**
 * Stay suspended on the gate — a second api path of this module in flight, sharing `resume.mjs`.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} `"waited"`.
 */
export async function wait(gate) {
	await gate;
	return typeof afterGate === "function" ? "waited" : "missing";
}
