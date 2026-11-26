/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_odd_promises/api/odd.mjs
 *	@Date: 2026-11-25T01:48:28-08:00 (1795600108)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:07:21-08:00 (1795601241)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Callbacks that return promises of unusual shapes to whatever runs them.
 */

import { oddPromise } from "../lib/promises.mjs";

/**
 * Schedule a timer whose callback returns a promise of the given shape, and say when the callback has run.
 * @param {string} kind - The shape (see `oddPromise`).
 * @returns {Promise<string>} "ran", once the callback has run.
 */
export function viaTimer(kind) {
	return new Promise((resolve) => {
		setTimeout(() => {
			const promise = oddPromise(kind, kind);
			resolve("ran");
			return promise;
		}, 0);
	});
}

/**
 * Schedule a timer whose callback returns the promise the host shares on `globalThis[key]`.
 * @param {string} key - The global's name.
 * @returns {Promise<string>} "ran", once the callback has run.
 */
export function shared(key) {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve("ran");
			return globalThis[key];
		}, 0);
	});
}
