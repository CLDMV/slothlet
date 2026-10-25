/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_has/probe.mjs
 *	@Date: 2026-10-25T10:07:47-07:00 (1792948067)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T10:30:43-07:00 (1792949443)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): a module keeping `trapmod.tbox` and `worker.work`, and asking the kept node whether
 * it has a member from a timer slothlet does not patch, after calling the kept async function.
 */
import { self } from "@cldmv/slothlet/runtime";

/** @type {Record<string, *>} References kept for later. */
const kept = {};
/** @type {object|null} What the later use gave. */
let outcome = null;

/**
 * Keep `worker.work` and `trapmod.tbox`.
 * @returns {string} "kept".
 */
export function keep() {
	kept.work = self.worker.work;
	kept.tbox = self.trapmod.tbox;
	return "kept";
}

/**
 * From a timer slothlet does not patch, call the kept async function, then ask the kept node whether it has a
 * member.
 * @returns {Promise<string>} "armed".
 */
export async function askLater() {
	const timers = await import("node:timers");
	outcome = null;
	timers.setTimeout(() => {
		kept.work();
		try {
			outcome = { has: "nope" in kept.tbox };
		} catch (error) {
			outcome = { has: error.code ?? error.message };
		}
	}, 0);
	return "armed";
}

/**
 * What the later use gave.
 * @returns {object|null} The outcome, once the timer has run.
 */
export function result() {
	return outcome;
}
