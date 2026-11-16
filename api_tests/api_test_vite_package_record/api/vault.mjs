/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_package_record/api/vault.mjs
 *	@Date: 2026-11-15T14:56:32-08:00 (1794783392)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T17:05:17-08:00 (1794791117)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The value the packages read.
 * @module api_test_vite_package_record.vault
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
