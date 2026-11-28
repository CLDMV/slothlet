/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_self_parity_ownleaf/api/vault.mjs
 *	@Date: 2026-11-15T16:00:00-08:00 (1794787200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:45-08:00 (1795868985)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The member the root function reads.
 * @module api_test_root_own_leaf.vault
 */

/**
 * The secret.
 * @returns {string} `"SECRET"`.
 * @example
 * api.vault.get(); // "SECRET"
 */
export function get() {
	return "SECRET";
}
