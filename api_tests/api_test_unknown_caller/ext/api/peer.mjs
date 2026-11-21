/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_unknown_caller/ext/api/peer.mjs
 *	@Date: 2026-11-09T01:56:06-08:00 (1794218166)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-09T02:12:50-08:00 (1794219170)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A second api path of the extension that imports the file `ext.start` resumes in, so the stack cannot
 * tell which of the two is running there.
 * @module api_test_unknown_caller.ext.peer
 */
import { afterGate } from "./resume.mjs";

/**
 * Stay suspended on the gate.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} `"waited"`.
 */
export async function wait(gate) {
	await gate;
	return typeof afterGate === "function" ? "waited" : "missing";
}
