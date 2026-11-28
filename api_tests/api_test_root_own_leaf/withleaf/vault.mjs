/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_root_own_leaf/withleaf/vault.mjs
 *	@Date: 2026-11-15T13:59:40-08:00 (1794779980)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:33-08:00 (1795868973)
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
