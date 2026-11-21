/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_call/vault/vault.mjs
 *	@Date: 2026-11-11T22:59:51-08:00 (1794466791)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:53-08:00 (1794477413)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The module the rules guard: `api.vault.get()`.
 * @module api_test_leaf_call.vault
 * @memberof module:api_test_leaf_call
 */

/**
 * What the rules guard.
 * @function get
 * @memberof module:api_test_leaf_call.vault
 * @returns {string} "SECRET"
 * @example
 * api.vault.get(); // "SECRET"
 */
export function get() {
	return "SECRET";
}
