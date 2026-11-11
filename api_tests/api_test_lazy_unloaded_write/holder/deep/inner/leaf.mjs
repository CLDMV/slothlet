/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/holder/deep/inner/leaf.mjs
 *	@Date: 2026-11-03T08:00:39-08:00 (1793721639)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T08:38:45-08:00 (1793723925)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A leaf several folders down, which a lazy instance loads only when it is reached (#653).
 */

/**
 * @returns {string} `"leaf"`.
 * @example
 * leaf(); // "leaf"
 */
export function leaf() {
	return "leaf";
}
