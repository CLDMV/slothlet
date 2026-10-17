/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_caller_identity/twin/twin.mjs
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
 * @fileoverview One leaf called twice concurrently; each call registers deferred work after its await.
 * @module api_test_live_caller_identity.twin
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * After the gate opens, register a timer and a promise reaction, and report who `c.probe` says
 * called it from each.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<{timer: string|null, reaction: string|null}>} The callers seen.
 */
export async function twice(gate) {
	await gate;
	// Registered while this call and its twin are both suspended: the stack names this file for both.
	const timer = new Promise((resolve) => setTimeout(() => resolve(self.c.probe()), 0));
	const reaction = Promise.resolve().then(() => self.c.probe());
	return { timer: await timer, reaction: await reaction };
}
