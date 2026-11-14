/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules/taker/taker.mjs
 *	@Date: 2026-11-11T11:09:11-08:00 (1794424151)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:12:38-08:00 (1794431558)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Takes a promise another module holds in data and does with it what ordinary code does: nothing, a
 * `catch`, a `then`, an `await`.
 * @module api_test_crossing_rules/taker
 */

import { self } from "@cldmv/slothlet/runtime";

/** What a handler of this module's saw, and a wait it started. */
let seen = "nothing";
let waiting = null;
/** The promise taken, kept so it is not collected. */
let kept = null;

/** Each thing this module does with the promise. `pledge` is `self.pledge`, or the module imported plainly. */
const CASES = {
	ignoredHandled: (pledge) => {
		kept = pledge.handled().pending;
	},
	ignoredUnhandled: (pledge) => {
		kept = pledge.unhandled().pending;
	},
	caught: (pledge) => {
		kept = pledge.unhandled().pending;
		kept.catch((error) => (seen = error.message));
	},
	chainedWithoutCatch: (pledge) => {
		kept = pledge.handled().pending;
		kept.then(() => (seen = "fulfilled"));
	},
	awaited: (pledge) => {
		kept = pledge.unhandled().pending;
		waiting = (async () => {
			try {
				await kept;
				return "fulfilled";
			} catch (error) {
				return error.message;
			}
		})();
	}
};

/**
 * Take the promise and do one thing with it.
 * @param {string} name - Which thing.
 * @param {object} [pledge] - The other module's functions.
 * @returns {string} What the promise looks like to ordinary checks.
 */
export function take(name, pledge = self.pledge) {
	CASES[name](pledge);
	return [kept instanceof Promise, typeof kept.then, Object.prototype.toString.call(kept)].join();
}

/**
 * What this module's handlers saw once the promise settled.
 * @returns {Promise<string>} What the handler saw and what the wait ended with.
 */
export async function outcome() {
	return [seen, waiting === null ? "no wait" : await waiting].join();
}
