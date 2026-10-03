/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_set_materialize/ext/session/store.mjs
 *	@Date: 2026-10-02 09:52:13 -07:00 (1790959933)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02 09:57:55 -07:00 (1790960275)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Module leaf used to materialize the session namespace first (#543).
 * @module api_test_lazy_set_materialize
 */

/**
 * Return a marker identifying which module's implementation ran.
 * @returns {string} Marker string.
 */
export function create() {
	return "ext-create";
}
