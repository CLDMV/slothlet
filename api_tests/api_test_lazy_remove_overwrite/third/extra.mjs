/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_remove_overwrite/third/extra.mjs
 *	@Date: 2026-09-28 23:35:31 -07:00 (1790663731)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-29 00:19:49 -07:00 (1790666389)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Third module's leaf, merged into the overwritten namespace after the overwrite (#531).
 * @module api_test_lazy_remove_overwrite
 */

/**
 * Return a marker identifying which module's implementation ran.
 * @returns {string} Marker string.
 */
export function hello() {
	return "third-hello";
}
