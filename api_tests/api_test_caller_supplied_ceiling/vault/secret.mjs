/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_ceiling/vault/secret.mjs
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
 * @fileoverview Guarded targets for the ceiling tests (#597): `secret` is the callee's alone, `forSupplier` the
 * supplier's alone, so code the supplier hands the callee may call neither.
 *
 * @module api_tests/api_test_caller_supplied_ceiling/vault/secret
 */

/**
 * The callee's guarded value.
 * @returns {string} A marker.
 * @public
 * @example
 * api.vault.secret.secret(); // "s3cret"
 */
export function secret() {
	return "s3cret";
}

/**
 * The supplier's guarded value.
 * @returns {string} A marker.
 * @public
 * @example
 * api.vault.secret.forSupplier(); // "supplied"
 */
export function forSupplier() {
	return "supplied";
}
