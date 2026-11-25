/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round7_rebuilt/api/probe.mjs
 *	@Date: 2026-11-21T00:00:00-08:00 (1795248000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:05:06-08:00 (1795536306)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose top level calls the vault through `self` each time it is built, and records what it got:
 * built as no module's code, at its first build and when a reload builds it again.
 *
 * @module api_tests/api_test_caller_supplied_round7/rebuilt/probe
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * What the top level got from the vault, newest last.
 * @type {Array<string>}
 * @private
 */
const captured = [];

try {
	const answer = self.vault.secret.secret();
	// A call answered later (a node still loading) records its answer when it settles.
	if (answer && typeof answer.then === "function")
		answer.then(
			(value) => captured.push(value),
			(error) => captured.push(error?.code ?? String(error))
		);
	else captured.push(answer);
} catch (error) {
	captured.push(error?.code ?? String(error));
}

/**
 * What the top level captured, cleared as it is read.
 * @returns {Array<string>} The answers.
 * @public
 * @example
 * api.rebuilt.probe.taken();
 */
export function taken() {
	return captured.splice(0);
}
