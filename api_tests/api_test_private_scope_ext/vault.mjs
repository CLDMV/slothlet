/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_scope_ext/vault.mjs
 *	@Date: 2026-11-15T19:24:45-08:00 (1794799485)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T20:09:55-08:00 (1794802195)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Private members of a module added with `api.slothlet.api.add()`.
 * @module api_test_private_scope_ext/vault
 */

/** A private key. */
export const __key = "ext-key";

/** A public member. */
export const name = "vault";

/**
 * A private function.
 * @returns {string} The key.
 */
export function _peek() {
	return __key;
}
