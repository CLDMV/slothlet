/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_runtime_single/api/vault.mjs
 *	@Date: 2026-11-12T22:54:52-08:00 (1794552892)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T22:54:52-08:00 (1794552892)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What the other modules of this fixture are allowed, or not, to read.
 * @module api_test_runtime_single.vault
 */

/**
 * What the vault holds.
 * @returns {string} The secret.
 * @example
 * api.vault.get(); // "SECRET"
 */
export function get() {
	return "SECRET";
}
