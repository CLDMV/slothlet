/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser_fn_members/later/af.mjs
 *	@Date: 2026-11-15T12:30:32-08:00 (1794774632)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T13:05:14-08:00 (1794776714)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An async default function, which has no `prototype`, beside a named export.
 * @module api_test_browser_fn_members/later/af
 */

/**
 * The default function.
 * @returns {Promise<string>} Its name.
 */
export default async function af() {
	return "af";
}

/**
 * A plain named export.
 * @returns {string} Its name.
 */
export function extra() {
	return "extra";
}
