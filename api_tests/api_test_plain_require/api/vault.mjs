/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_require/api/vault.mjs
 *	@Date: 2026-11-13T09:00:00-08:00 (1794589200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T09:00:00-08:00 (1794589200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The value the helper reads.
 * @module api_test_plain_require.vault
 */

/**
 * The secret.
 * @returns {string} "SECRET".
 * @example
 * api.vault.get(); // "SECRET"
 */
export function get() {
	return "SECRET";
}
