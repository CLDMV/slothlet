/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_add_dedup_leaf_override/thing.mjs
 *	@Date: 2026-09-14T15:15:27-07:00 (1789424127)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-26 22:30:34 -07:00 (1790487034)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Override counterpart of api_test_add_dedup_leaf's self-named leaf, used to
 * verify a forceOverwrite replace onto the leaf actually swaps its callable impl.
 * @module api_tests/api_test_add_dedup_leaf_override
 */

/**
 * Callable leaf with zero attached children — matches the mount path segment "thing".
 * @param {string} x - Input value.
 * @returns {string} Tagged value.
 */
export function thing(x) {
	return `override:${x}`;
}
