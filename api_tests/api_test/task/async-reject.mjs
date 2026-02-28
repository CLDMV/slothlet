/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /api_tests/api_test/task/async-reject.mjs
 *      @Date: 2026-02-27T12:00:00-08:00 (1772373600)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-02-27 12:00:00 -08:00 (1772373600)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Async function that always rejects with an error.
 * Used in tests to exercise the async rejection path in the unified-wrapper apply trap.
 *
 * @function asyncReject
 * @public
 * @async
 * @param {string} [message="async-rejected"] - Custom error message.
 * @returns {Promise<never>} Always rejects.
 * @example
 * try {
 *   await api.task.asyncReject();
 * } catch (err) {
 *   console.log(err.message); // "async-rejected"
 * }
 */
export default async function asyncReject(message = "async-rejected") {
	throw new Error(message);
}
