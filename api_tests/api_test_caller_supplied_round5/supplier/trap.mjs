/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round5/supplier/trap.mjs
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
 * @fileoverview A Proxy the supplier exports whose every trap calls the vault (#597): however slothlet or a reader
 * touches it, the traps are the supplier's code.
 *
 * @module api_tests/api_test_caller_supplied_round5/supplier/trap
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
 * api.supplier.trap.taken();
 */
export function taken() {
	return captured.splice(0);
}

/**
 * A Proxy whose traps call the vault.
 * @type {object}
 * @public
 */
export const p = new Proxy(
	{ x: 1 },
	{
		get(target, prop, receiver) {
			capture();
			return Reflect.get(target, prop, receiver);
		},
		has(target, prop) {
			capture();
			return Reflect.has(target, prop);
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
