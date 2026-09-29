/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/lib/chain/level1.mjs
 *	@Date: 2026-09-28 20:29:31 -07:00 (1790652571)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 20:49:48 -07:00 (1790653788)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview First link of a two-level helper chain (#518).
 * @module api_test_helper_imports.lib.chain.level1
 * @internal
 */
import { level2Bump } from "./level2.mjs";

/**
 * Forward to the second link.
 * @returns {number} The level-2 counter after incrementing.
 */
export function level1Bump() {
	return level2Bump();
}
