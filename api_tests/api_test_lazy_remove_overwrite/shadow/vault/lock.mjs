/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_remove_overwrite/shadow/vault/lock.mjs
 *	@Date: 2026-09-28T21:58:00-07:00 (1790657880)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:27:49-07:00 (1791091669)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Shadow module's nested replacement leaf, added with forceOverwrite (#524).
 * @module api_test_force_overwrite_ownership
 */

/**
 * Return a marker identifying which module's implementation ran.
 * @returns {string} Marker string.
 */
export function open() {
	return "shadow-open";
}
