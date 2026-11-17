/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reject_reserved_folder_sanitized/session/-___materialize-/set.mjs
 *	@Date: 2026-10-08T00:00:00-07:00 (1791442800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T07:26:21-08:00 (1794929181)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#571 review): a folder whose name sanitizes to a framework-reserved key.
 * @module api_test_reject_reserved_folder_sanitized.session.___materialize.set
 */

/**
 * @returns {string} Marker naming this leaf.
 */
export function set() {
	return "session.___materialize.set";
}
