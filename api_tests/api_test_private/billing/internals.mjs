/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private/billing/internals.mjs
 *	@Date: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-04 12:00:00 -07:00 (1785870000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Module-private members (#260): the `_`/`__` prefix marks these as reachable only
 * by the other files of the billing module.
 * @module api_test_private.billing.internals
 * @memberof module:api_test_private
 */

/** @type {number} Module-private rate — same-module reads only. */
export const __rate = 0.2;

/** @type {number} Module-private fee — same-module reads only. */
export const _fee = 5;

/** @type {string} Ordinary public member of the same file. */
export const currency = "USD";

/**
 * Module-private callable — the call path enforces privacy exactly as the read path does.
 * @param {number} amount - Base amount.
 * @returns {number} Amount scaled by the private rate.
 */
export const _scale = (amount) => amount * 1.2;
