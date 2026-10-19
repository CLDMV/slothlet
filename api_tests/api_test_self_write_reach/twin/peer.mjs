/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_write_reach/twin/peer.mjs
 *	@Date: 2026-10-18T19:48:21-07:00 (1792378101)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T19:51:09-07:00 (1792378269)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// A second api path of the `twin` module that imports the file `go` resumes in (#625).
import { later } from "./resume.mjs";

/**
 * Stay suspended on the gate, a second api path of this module in flight sharing `resume.mjs`.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} `"waited"`.
 */
export async function wait(gate) {
	await gate;
	return typeof later === "function" ? "waited" : "missing";
}
