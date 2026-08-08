/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private/billing/quote.mjs
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
 * @fileoverview Same-module consumer: reads the sibling file's private members through `self`.
 * @module api_test_private.billing.quote
 * @memberof module:api_test_private
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Quotes a total using the module's own private rate and fee.
 * @param {number} amount - Base amount.
 * @returns {Promise<number>} Total after the private rate and fee.
 */
export const total = async (amount) => {
	const rate = await self.billing.internals.__rate;
	const fee = await self.billing.internals._fee;
	return amount * (1 + rate) + fee;
};
