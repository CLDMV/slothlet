/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/__mixed/lib/esm-chain.mjs
 *	@Date: 2026-10-02T12:27:51-07:00 (1790969271)
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
 * @fileoverview Second-level ES module below `esm-counter.mjs` (#534).
 * @module api_test_helper_imports.mixed.lib.esmChain
 * @internal
 */
let count = 0;

/**
 * Increment this module's counter.
 * @returns {number} The counter after incrementing.
 */
export function bump() {
	return ++count;
}
