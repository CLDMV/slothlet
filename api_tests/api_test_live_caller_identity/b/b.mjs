/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_caller_identity/b/b.mjs
 *	@Date: 2026-10-09T18:00:00-07:00 (1791594000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T18:00:00-07:00 (1791594000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A call that resumes after an overlapping call has settled, and reads its identity back.
 * @module api_test_live_caller_identity.b
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the caller a nested leaf sees, before and after an await.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<{before: string|null, after: string|null, pinnedAfter: string|null}>} The callers seen.
 */
export async function render(gate) {
	const before = await self.c.probe();
	await gate;
	const after = await self.c.probe();
	const pinnedAfter = await self.c.pinCaller();
	return { before, after, pinnedAfter };
}
