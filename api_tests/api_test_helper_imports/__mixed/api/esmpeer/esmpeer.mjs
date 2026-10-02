/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/__mixed/api/esmpeer/esmpeer.mjs
 *	@Date: 2026-10-02 12:27:51 -07:00 (1790969271)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02 12:27:51 -07:00 (1790969271)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview ESM leaf importing the ES module the `cjsesm` leaf requires (#534).
 * @module api_test_helper_imports.mixed.esmpeer
 */
import { bump } from "../../lib/esm-counter.mjs";

/**
 * Bump the `esm-counter.mjs` counter.
 * @returns {number} The counter after incrementing.
 */
export function count() {
	return bump();
}
