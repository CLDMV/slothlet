/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_add_root_multi/existing.mjs
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
 * @fileoverview Colliding counterpart of api_test_add_root_base's "existing" root key,
 * mounted alongside a brand-new sibling key ("fresh") in the same root add() call.
 * @module api_tests/api_test_add_root_multi
 */

/**
 * Colliding implementation of the "existing" root key.
 * @param {string} x - Input value.
 * @returns {string} Tagged value.
 */
export function existing(x) {
	return `root-multi:${x}`;
}
