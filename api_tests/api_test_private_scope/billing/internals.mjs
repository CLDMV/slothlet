/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_private_scope/billing/internals.mjs
 *	@Date: 2026-11-15T19:24:45-08:00 (1794799485)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:13-08:00 (1795868953)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Private members (`_`/`__`) of the base module, beside one public member.
 * @module api_test_private_scope/billing/internals
 */

/** A private rate. */
export const __rate = 0.2;

/** A private fee. */
export const _fee = 5;

/** A public member. */
export const currency = "USD";

/**
 * A private function.
 * @param {number} amount - An amount.
 * @returns {number} The amount with the rate applied.
 */
export function _scale(amount) {
	return amount * (1 + __rate);
}
