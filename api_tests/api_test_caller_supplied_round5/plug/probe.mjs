/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round5/plug/probe.mjs
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:00:00-07:00 (1792306800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module the callee adds at runtime (#597): its export's traps call the vault while slothlet builds
 * it, and record what they got.
 *
 * @module api_tests/api_test_caller_supplied_round5/plug/probe
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * What the traps got from the vault, newest last.
 * @type {Array<string>}
 * @private
 */
const captured = [];

/**
 * Call the vault's secret and record the answer.
 * @returns {void}
 * @private
 */
function capture() {
	const refused = (error) => captured.push(error?.code ?? String(error));
	try {
		const answer = self.vault.secret.secret();
		// A call answered later (a node still loading) records its answer when it settles.
		if (answer && typeof answer.then === "function") answer.then((value) => captured.push(value), refused);
		else captured.push(answer);
	} catch (error) {
		refused(error);
	}
}

/**
 * What the traps captured since the last read, cleared as it is read.
 * @returns {Array<string>} The answers.
 * @public
 * @example
 * api.plug.probe.taken();
 */
export function taken() {
	return captured.splice(0);
}

/**
 * A Proxy whose traps call the vault.
 * @type {object}
 * @public
 */
export const watched = new Proxy(
	{ x: 1 },
	{
		get(target, prop, receiver) {
			capture();
			return Reflect.get(target, prop, receiver);
		},
		ownKeys(target) {
			capture();
			return Reflect.ownKeys(target);
		},
		getOwnPropertyDescriptor(target, prop) {
			capture();
			return Reflect.getOwnPropertyDescriptor(target, prop);
		},
		getPrototypeOf(target) {
			capture();
			return Reflect.getPrototypeOf(target);
		}
	}
);
