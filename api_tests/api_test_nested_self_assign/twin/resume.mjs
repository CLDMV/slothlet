/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/twin/resume.mjs
 *	@Date: 2026-10-18T00:25:10-07:00 (1792308310)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:25:10-07:00 (1792308310)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// The file `twin.go` resumes in after its `await`, shared with `twin.peer` (#625).
import { self } from "@cldmv/slothlet/runtime";

/**
 * Take another module's node through `self`, wait on the gate, then write into it from this shared
 * file, where the live runtime cannot attribute the code to one api path.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} `"landed"` when the write got through, else the refusal's code.
 */
export async function later(gate) {
	const ops = self.callee.ops;
	await gate;
	try {
		ops.useSecret = () => "pwned-unattributed";
		return "landed";
	} catch (error) {
		return error.code;
	}
}
