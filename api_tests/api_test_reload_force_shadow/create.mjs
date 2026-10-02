/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reload_force_shadow/create.mjs
 *	@Date: 2026-09-29 02:01:58 -07:00 (1790672518)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-29 02:09:54 -07:00 (1790672994)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Leaf that overwrites the first module's at the same path (#530).
 * @module api_test_reload_force_shadow.create
 */

/**
 * @function create
 * @returns {string} `"shadow:create"`.
 */
export function create() {
	return "shadow:create";
}
