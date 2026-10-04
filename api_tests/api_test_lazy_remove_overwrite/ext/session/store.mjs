/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_remove_overwrite/ext/session/store.mjs
 *	@Date: 2026-09-28T21:58:00-07:00 (1790657880)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:36-07:00 (1791090876)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Original module's leaves at the path the shadow module overwrites (#524).
 * @module api_test_force_overwrite_ownership
 */

/**
 * Return a marker identifying which module's implementation ran.
 * @returns {string} Marker string.
 */
export function create() {
	return "ext-create";
}

/**
 * Return a marker identifying which module's implementation ran.
 * @returns {string} Marker string.
 */
export function destroy() {
	return "ext-destroy";
}
