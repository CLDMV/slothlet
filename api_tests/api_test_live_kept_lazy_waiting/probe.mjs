/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_lazy_waiting/probe.mjs
 *	@Date: 2026-10-25T02:50:59-07:00 (1792921859)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T03:12:48-07:00 (1792923168)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): a module keeping a node of `store.sub` before `sub` has loaded, and reading it from
 * a timer slothlet does not patch.
 */
import { self } from "@cldmv/slothlet/runtime";

/** @type {object|null} The kept node. */
let box = null;
/** @type {object|null} What the later read gave. */
let outcome = null;

/**
 * Keep `store.sub.box` while `store.sub` has not loaded.
 * @returns {string} The kept node's `typeof`.
 */
export function keep() {
	box = self.store.sub.box;
	return typeof box;
}

/**
 * From a timer slothlet does not patch, read the kept node's `evil`.
 * @returns {Promise<string>} "armed".
 */
export async function readLater() {
	const timers = await import("node:timers");
	outcome = null;
	timers.setTimeout(() => {
		try {
			outcome = { read: box.evil };
		} catch (error) {
			outcome = { read: error.code ?? error.message };
		}
	}, 0);
	return "armed";
}

/**
 * What the later read gave.
 * @returns {object|null} The outcome, once the timer has run.
 */
export function result() {
	return outcome;
}
