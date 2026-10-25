/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_after_async/probe.mjs
 *	@Date: 2026-10-24T21:58:58-07:00 (1792904338)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T01:33:16-07:00 (1792917196)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): a module keeping references to another's data and async function, and using them
 * from a timer slothlet does not patch.
 */
import { self } from "@cldmv/slothlet/runtime";

/** @type {Record<string, *>} References kept for later. */
const kept = {};
/** @type {object|null} What the later uses gave. */
let outcome = null;

/**
 * Run a use, reporting what it gave or the code it threw.
 * @param {function(): *} use - The use.
 * @returns {*} What it gave, or the error code.
 */
function attempt(use) {
	try {
		return use();
	} catch (error) {
		return error.code ?? error.message;
	}
}

/**
 * Keep `store`'s data and async function.
 * @returns {string} "kept".
 */
export function keep() {
	kept.obj = self.store.obj;
	kept.work = self.store.work;
	return "kept";
}

/**
 * From a timer slothlet does not patch: read the kept data, call the kept async function, then read and call again
 * while that call is still running.
 * @returns {Promise<string>} "armed".
 */
export async function useLater() {
	const timers = await import("node:timers");
	outcome = null;
	timers.setTimeout(() => {
		const before = attempt(() => kept.obj.n);
		const first = attempt(() => typeof kept.work().then);
		outcome = {
			before,
			first,
			after: attempt(() => kept.obj.n),
			again: attempt(() => typeof kept.work())
		};
	}, 0);
	return "armed";
}

/**
 * What the later uses gave.
 * @returns {object|null} The outcome, once the timer has run.
 */
export function result() {
	return outcome;
}

/**
 * Keep `store.box`.
 * @returns {string} "kept".
 */
export function keepBox() {
	kept.box = self.store.box;
	return "kept";
}

/**
 * From a timer slothlet does not patch, read a member of the kept `store.box`.
 * @param {string} prop - The member.
 * @returns {Promise<string>} "armed".
 */
export async function readBoxLater(prop) {
	const timers = await import("node:timers");
	outcome = null;
	timers.setTimeout(() => {
		outcome = { read: attempt(() => kept.box[prop]) };
	}, 0);
	return "armed";
}
