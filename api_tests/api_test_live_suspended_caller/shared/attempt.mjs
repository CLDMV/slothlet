/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/shared/attempt.mjs
 *	@Date: 2026-09-28 18:00:00 -07:00 (1790644800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 18:00:00 -07:00 (1790644800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Shared test helper for the live suspended-caller fixture (#512).
 *
 * @description
 * Lives in a folder the instance hides, so it is never an api leaf — it is plain module code, the
 * way a package's internal helper is. Every fixture leaf reports a gated call through here, so a
 * permission denial comes back as a value the suite can compare instead of a rejection.
 *
 * @module api_test_live_suspended_caller.shared.attempt
 */

/**
 * Turn a permission denial into the string `"denied"`; rethrow anything else.
 * @param {unknown} error - What the gated call threw or rejected with.
 * @returns {string} `"denied"`.
 * @throws {unknown} Any error other than PERMISSION_DENIED.
 */
function denied(error) {
	if (error?.code === "PERMISSION_DENIED") return "denied";
	throw error;
}

/**
 * Run a gated call, turning a permission denial into the string `"denied"`.
 *
 * The call is made synchronously, so it is attributed to whoever is running at this moment. In lazy
 * mode an unmaterialized leaf answers with a pending value and reports a denial by rejecting, so a
 * thenable result is settled into the same shape.
 * @param {Function} thunk - The gated call.
 * @param {Function} [map] - Maps a permitted result before it is reported.
 * @returns {*} The (mapped) result, or `"denied"` — a promise of either for a thenable result.
 * @throws {Error} Any error other than PERMISSION_DENIED.
 */
export function attempt(thunk, map = (value) => value) {
	let value;
	try {
		value = thunk();
	} catch (error) {
		return denied(error);
	}
	if (value && typeof value.then === "function") return Promise.resolve(value).then(map, denied);
	return map(value);
}
