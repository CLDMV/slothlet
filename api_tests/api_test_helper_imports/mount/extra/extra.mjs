/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/mount/extra/extra.mjs
 *	@Date: 2026-09-28 23:11:25 -07:00 (1790662285)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:40 -07:00 (1791082960)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf mounted with `api.slothlet.api.add` that imports the same helper as the base
 * leaves — within one instance a mounted leaf and a base leaf must see ONE helper copy (#518).
 * @module api_test_helper_imports.mount.extra
 */
import { bump } from "../../lib/state.mjs";

/**
 * Bump the shared `lib/state.mjs` counter.
 * @returns {number} The counter after incrementing.
 */
export function count() {
	return bump();
}
