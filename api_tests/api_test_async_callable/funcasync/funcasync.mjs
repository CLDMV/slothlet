/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_async_callable/funcasync/funcasync.mjs
 *	@Date: 2026-08-08 18:30:00 -07:00 (1786239000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-08 18:12:44 -07:00 (1786237964)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

// A lazy TOP-LEVEL callable whose target is declared async. A chained first touch
// materializes through the waiting proxy before the apply trap runs, so only a
// top-level callable lands a promoted call on a not-yet-materialized wrapper —
// the one case where dispatch classification cannot brand-check the target.

/**
 * Greets asynchronously.
 * @param {string} name - Name to greet.
 * @returns {Promise<string>} Greeting message.
 * @example
 * // const api = await slothlet({ mode: "lazy", base: "./api_tests/api_test_async_callable" });
 * // await api.funcasync("World"); // "Hello, World!"
 */
export default async function (name) {
	return `Hello, ${name}!`;
}
