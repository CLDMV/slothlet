/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/rogue/api/start.mjs
 *	@Date: 2026-09-28 18:00:00 -07:00 (1790643600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:48 -07:00 (1791082968)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An unprivileged module whose call resumes in a sibling file of its own.
 * @module api_test_live_suspended_caller.rogue.start
 */
import { drain } from "./worker.mjs";

/**
 * Hand back a promise created in the sibling worker file.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} The render result, or `"denied"`.
 */
export function start(gate) {
	return drain(gate);
}
