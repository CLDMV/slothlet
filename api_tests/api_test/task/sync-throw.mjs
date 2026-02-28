/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/task/sync-throw.mjs
 *	@Date: 2026-03-01T00:00:00-08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T00:00:00-08:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Synchronous function that always throws.
 * Used to test the synchronous error suppression path in the apply trap.
 * @module api_test/task/sync-throw
 */

/**
 * Synchronous function that always throws an error.
 * Used to exercise the catch block in the apply trap (unified-wrapper lines ~2691-2713).
 * @param {string} [message="sync-threw"] - Custom error message.
 * @returns {never} Always throws.
 * @example
 * // Expect this to throw when called without suppressErrors
 * api.task.syncThrow();
 */
export default function syncThrow(message = "sync-threw") {
	throw new Error(message);
}
