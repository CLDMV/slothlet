/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/api/peer/peer.mjs
 *	@Date: 2026-09-28T20:29:31-07:00 (1790652571)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:34-07:00 (1791090874)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Second ESM leaf importing the same helper as `tally` — within one instance both
 * must see ONE helper copy (#518).
 * @module api_test_helper_imports.peer
 */
import { bump } from "../../lib/state.mjs";

/**
 * Bump the shared `lib/state.mjs` counter.
 * @returns {number} The counter after incrementing.
 */
export function count() {
	return bump();
}
