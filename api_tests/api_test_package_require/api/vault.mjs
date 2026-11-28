/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_package_require/api/vault.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794675600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:06-08:00 (1795868946)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The value the packages read.
 * @module api_test_package_require.vault
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
