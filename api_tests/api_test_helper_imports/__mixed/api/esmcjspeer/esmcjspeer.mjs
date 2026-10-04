/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/__mixed/api/esmcjspeer/esmcjspeer.mjs
 *	@Date: 2026-10-02 12:27:51 -07:00 (1790969271)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:38 -07:00 (1791082958)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Second ESM leaf importing the same CommonJS helper as `esmcjs` — within one instance
 * both must see ONE helper copy (#534).
 * @module api_test_helper_imports.mixed.esmcjspeer
 */
import { bump } from "../../lib/cjs-counter.cjs";

/**
 * Bump the `cjs-counter.cjs` counter.
 * @returns {number} The counter after incrementing.
 */
export function count() {
	return bump();
}
