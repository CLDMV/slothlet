/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_force_overwrite_ownership/ext/main.mjs
 *	@Date: 2026-09-28 21:58:00 -07:00 (1790657880)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 22:41:59 -07:00 (1790660519)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Original module's own leaf outside the overwritten path (#524).
 * @module api_test_force_overwrite_ownership
 */

/**
 * Return a marker identifying which module's implementation ran.
 * @returns {string} Marker string.
 */
export function activate() {
	return "ext-activate";
}
