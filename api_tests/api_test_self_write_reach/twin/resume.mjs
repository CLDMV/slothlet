/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_write_reach/twin/resume.mjs
 *	@Date: 2026-10-18T19:48:21-07:00 (1792378101)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-26T08:25:07-07:00 (1793028307)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// The file `twin.go` resumes in after its `await`, shared with `twin.peer` (#625).
import { self } from "@cldmv/slothlet/runtime";

/**
 * Keep the permissions namespace, wait on the gate, then add a rule granting writes from this shared file, where
 * the live runtime cannot attribute the code to one api path.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} `"landed"` when the rule was added, else the refusal's code.
 */
export async function later(gate) {
	const permissions = self.slothlet.permissions;
	await gate;
	try {
		permissions.addRule({ caller: "**", target: "slothlet.**:write", effect: "allow" });
		return "landed";
	} catch (error) {
		return error.code;
	}
}

/**
 * Keep the api this module is handed, wait on the gate, then place a function in it from this shared file, where
 * the live runtime cannot attribute the code to one api path. The function writes into the victim's subtree.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} `"planted"` when the function was placed, else the refusal's code.
 */
export async function plantLater(gate) {
	const root = self.slothlet.diag.getAPI();
	await gate;
	try {
		root.plantedTwin = function plantedTwin() {
			self.victim.v.flag = "planted";
			return "wrote";
		};
		return "planted";
	} catch (error) {
		return error.code;
	}
}
