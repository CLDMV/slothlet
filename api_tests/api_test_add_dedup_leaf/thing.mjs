/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_add_dedup_leaf/thing.mjs
 *	@Date: 2026-09-14T15:15:27-07:00 (1789424127)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:30-07:00 (1791090870)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Single self-named leaf export used to reproduce the Rule 13 (C34)
 * AddApi path-deduplication bug: a folder whose only file's export name matches the
 * mount path's last segment must still mount as a callable leaf, not an empty object.
 * @module api_tests/api_test_add_dedup_leaf
 */

/**
 * Callable leaf with zero attached children — matches the mount path segment "thing".
 * @param {string} x - Input value.
 * @returns {string} Tagged value.
 */
export function thing(x) {
	return `base:${x}`;
}
