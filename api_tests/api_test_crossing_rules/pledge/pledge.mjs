/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules/pledge/pledge.mjs
 *	@Date: 2026-11-11T11:09:11-08:00 (1794424151)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:12:37-08:00 (1794431557)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Hands another module a promise inside data, and rejects it later.
 * @module api_test_crossing_rules/pledge
 */

/** Rejects the promise last handed out. */
let rejectIt = () => {};

/**
 * Data holding a pending promise whose rejection this module handles itself.
 * @returns {{pending: Promise<never>}} The data.
 */
export function handled() {
	const pending = new Promise((_, reject) => (rejectIt = reject));
	pending.catch(() => {});
	return { pending };
}

/**
 * Data holding a pending promise nobody has handled.
 * @returns {{pending: Promise<never>}} The data.
 */
export function unhandled() {
	return { pending: new Promise((_, reject) => (rejectIt = reject)) };
}

/**
 * Reject the promise last handed out.
 * @returns {void}
 */
export function settle() {
	rejectIt(new Error("boom"));
}
