/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private/introspect/list.mjs
 *	@Date: 2026-08-08 12:00:00 -07:00 (1786215600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-08 12:00:00 -07:00 (1786215600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Cross-module consumer of the enumeration surface (#247 × #260).
 * @module api_test_private.introspect.list
 * @memberof module:api_test_private
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Enumerates the base load from INSIDE a module, so the caller is not the host.
 * @param {object} [options] - Passed through to `leaves()`.
 * @returns {Promise<{paths: string[]|null, error: string|null}>} The listing, or the refusal code.
 */
export const paths = async (options) => {
	try {
		return { paths: await self.slothlet.api.leaves(".", options), error: null };
	} catch (e) {
		return { paths: null, error: e.code ?? e.message };
	}
};
