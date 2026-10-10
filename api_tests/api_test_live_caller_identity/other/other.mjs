/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_caller_identity/other/other.mjs
 *	@Date: 2026-10-09T18:00:00-07:00 (1791594000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T18:00:00-07:00 (1791594000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Schedules deferred work through promise reactions and `on*` handler properties.
 * @module api_test_live_caller_identity.other
 */
import { self } from "@cldmv/slothlet/runtime";

/** @type {Array<string|null>} */
const seen = [];

/** @type {Promise<void>[]} */
const pending = [];

/**
 * Record who `c.probe` says called it, or the error code when `self` refuses.
 * @returns {Promise<void>} Settles once recorded.
 */
function record() {
	let caller;
	try {
		// Read synchronously, so the identity in force is the one this reaction runs with.
		caller = self.c.probe();
	} catch (error) {
		caller = error.code;
	}
	// A lazy leaf answers with a promise; results() waits for every recording still in flight.
	const recorded = Promise.resolve(caller).then(
		(value) => void seen.push(value),
		(error) => void seen.push(error.code)
	);
	pending.push(recorded);
	return recorded;
}

/**
 * Register a fire-and-forget reaction of the given kind and return without awaiting it.
 * @param {"then"|"catch"|"finally"|"thenable"} kind - Which reaction to register.
 * @returns {boolean} `true`.
 */
export function kick(kind) {
	if (kind === "then") Promise.resolve().then(record);
	else if (kind === "catch") Promise.reject(new Error("kick")).catch(record);
	else if (kind === "finally") Promise.resolve().finally(record);
	// A native promise resolved with another promise adopts it through `then`, from a job the engine
	// queues — not a call the module makes itself.
	else if (kind === "thenable") new Promise((resolve) => resolve(Promise.resolve())).then(record);
	return true;
}

/**
 * Assign a handler to an `on*` property of the given target.
 * @param {object} target - A DOM-like object.
 * @param {string} property - The handler property, e.g. `"onclick"`.
 * @returns {boolean} `true`.
 */
export function assign(target, property) {
	target[property] = record;
	return true;
}

/**
 * Drain what the deferred work recorded, once every recording still in flight has landed.
 * @returns {Promise<Array<string|null>>} The callers seen, oldest first.
 */
export async function results() {
	while (pending.length) await Promise.all(pending.splice(0));
	return seen.splice(0);
}
