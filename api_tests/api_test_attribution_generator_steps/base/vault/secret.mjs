/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_attribution_generator_steps/base/vault/secret.mjs
 *	@Date: 2026-11-27T00:00:00-08:00 (1795766400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T00:00:00-08:00 (1795766400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The vault for the generator-step attribution tests: a secret only the callee may call.
 *
 * @module api_tests/api_test_attribution_generator_steps/base/vault/secret
 */

/**
 * The secret only the callee may call.
 * @returns {string} The secret.
 * @public
 * @example
 * api.vault.secret.secret(); // "s3cret"
 */
export function secret() {
	return "s3cret";
}

/**
 * Something every module may call, to load the vault.
 * @returns {string} "vault".
 * @public
 * @example
 * api.vault.secret.ping(); // "vault"
 */
export function ping() {
	return "vault";
}
