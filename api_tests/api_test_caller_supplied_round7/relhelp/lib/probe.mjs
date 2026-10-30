/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round7/relhelp/lib/probe.mjs
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
 * @fileoverview A module whose top level awaits before it calls the vault, through `self` and through the vault the callee
 * left it on `globalThis` (#597): what it gets is recorded, and it is built as no module's code.
 *
 * @module api_tests/api_test_caller_supplied_round7/relhelp/lib/probe
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * What the top level got from the vault after its await.
 * @type {Array<string>}
 * @private
 */
const captured = [];

await new Promise((resolve) => setTimeout(resolve, 30));

for (const read of [() => self.vault.secret.secret(), () => globalThis.__slothletRound7Vault.secret.secret()]) {
	try {
		const answer = read();
		captured.push(answer && typeof answer.then === "function" ? await answer : answer);
	} catch (error) {
		captured.push(error?.code ?? String(error));
	}
}

/**
 * What the top level captured, cleared as it is read.
 * @returns {Array<string>} The answers.
 * @public
 * @example
 * api.relplug.probe.taken();
 */
export function taken() {
	return captured.splice(0);
}
