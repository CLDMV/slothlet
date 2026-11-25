/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_code_strings/api/vault/secret.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:05:08-08:00 (1795536308)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The base for the code-from-strings tests: one plain leaf.
 *
 * @module api_tests/api_test_code_strings/base/vault/secret
 */

/**
 * A plain value.
 * @returns {string} A marker.
 * @public
 * @example
 * api.vault.secret.value(); // "v"
 */
export function value() {
	return "v";
}
