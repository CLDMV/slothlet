/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private/reporting/peek.mjs
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
 * @fileoverview Cross-module consumer: attempts to read another module's private members.
 * @module api_test_private.reporting.peek
 * @memberof module:api_test_private
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Attempts the cross-module private read the privacy boundary must refuse.
 * @returns {Promise<{rate: *, error: string|null}>} What the read yielded, or the denial code.
 */
export const rate = async () => {
	try {
		return { rate: await self.billing.internals.__rate, error: null };
	} catch (e) {
		return { rate: undefined, error: e.code ?? e.message };
	}
};
