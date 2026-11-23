/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_shutdown_node_reads/guest/keep.mjs
 *	@Date: 2026-11-21T21:11:15-08:00 (1795324275)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T21:31:49-08:00 (1795325509)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a module that keeps api nodes it read through `self` in variables, and reads through them
 * later: from its own call, from a function it hands out, and from a timer it leaves behind.
 * @module api_test_shutdown_node_reads.keep
 */
import { self } from "@cldmv/slothlet/runtime";

/** What the module kept: the vault node, its `box` member and its `shown` function. */
let kept = null;

/**
 * What one attempt gave: its value as a string, or `!` and the code of what it threw.
 * @param {Function} fn - The attempt.
 * @returns {string} The outcome.
 */
function one(fn) {
	try {
		return String(fn());
	} catch (error) {
		return `!${error?.code ?? error?.name ?? String(error)}`;
	}
}

/**
 * Try every access through what was kept, and one through `self`.
 * @returns {Object<string, string>} The outcomes by access.
 */
function attempt() {
	return {
		readSecret: one(() => kept.vault.secret),
		readOpen: one(() => kept.vault.open),
		readBoxOuter: one(() => kept.vault.box.outer),
		readKeptBoxOuter: one(() => kept.box.outer),
		readKeptBoxInner: one(() => kept.box.inner),
		callShown: one(() => kept.shown()),
		callShownOnNode: one(() => kept.vault.shown()),
		listKeys: one(() => Object.keys(kept.vault).sort().join(",")),
		hasOpen: one(() => "open" in kept.vault),
		describeOpen: one(() => Object.getOwnPropertyDescriptor(kept.vault, "open")?.value),
		selfOpen: one(() => self.vault.open)
	};
}

/**
 * Keep the nodes, hand out a function that reads through them, and leave a timer behind that reads through them once
 * the go-ahead is given.
 * @returns {Object<string, string>} The outcomes of reading through them now, from this call.
 */
export function hold() {
	kept = { vault: self.vault, box: self.vault.box, shown: self.vault.shown };
	const record = (globalThis.__slothletShutdownNodeReads = { attempt, timer: [] });
	const gate = globalThis.__slothletShutdownNodeReadsGate;
	const step = () => {
		if (gate.stop) return;
		if (gate.go) record.timer.push(attempt());
		else setTimeout(step, 1);
	};
	setTimeout(step, 1);
	return attempt();
}
