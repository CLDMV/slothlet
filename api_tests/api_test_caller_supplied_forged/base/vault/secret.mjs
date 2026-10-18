/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_forged/base/vault/secret.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Guarded targets for the forged-placement tests (#597). Only the victim may call `secret`;
 * `gate` is the attacker's, behind a principal the attacker registers.
 *
 * @module api_tests/api_test_caller_supplied_forged/base/vault/secret
 */

/**
 * Return the guarded value. Only the victim may call this.
 * @returns {string} A constant marker.
 * @public
 * @example
 * api.vault.secret.secret(); // "s3cret"
 */
export function secret() {
	return "s3cret";
}

/**
 * A target whose rule requires the `leak` principal, so calling it resolves that principal.
 * @returns {string} A constant marker.
 * @public
 * @example
 * api.vault.secret.gate(); // "gated"
 */
export function gate() {
	return "gated";
}
