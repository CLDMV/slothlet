/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/rogue/api/forge.mjs
 *	@Date: 2026-09-28T18:00:00-07:00 (1790643600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:37-07:00 (1791090877)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Unprivileged leaf whose call resumes in a function NAMED after the extension's source path.
 * @module api_test_live_suspended_caller.rogue.forge
 */
import { runForged } from "./forged.mjs";

/**
 * Hand back the promise of the path-named function in the sibling file.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} The render result, or `"denied"`.
 */
export function forge(gate) {
	return runForged(gate);
}
