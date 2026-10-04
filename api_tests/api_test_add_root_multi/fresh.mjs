/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_add_root_multi/fresh.mjs
 *	@Date: 2026-09-14T15:15:27-07:00 (1789424127)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:31-07:00 (1791090871)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Brand-new root key mounted alongside a colliding sibling ("existing")
 * in the same root add() call — see api_test_add_root_multi/existing.mjs.
 * @module api_tests/api_test_add_root_multi
 */

/**
 * A root key with no prior collision.
 * @param {string} x - Input value.
 * @returns {string} Tagged value.
 */
export function fresh(x) {
	return `root-multi:fresh:${x}`;
}
