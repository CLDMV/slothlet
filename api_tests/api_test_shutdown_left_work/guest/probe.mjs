/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_shutdown_left_work/guest/probe.mjs
 *	@Date: 2026-11-21T14:50:54-08:00 (1795301454)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:51-08:00 (1795868991)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a module that tries the vault from its own calls, and from work it leaves behind (an interval,
 * a timer, an immediate, a promise chain) that goes on running after the instance shuts down, and records the outcomes.
 * @module api_test_shutdown_left_work.probe
 */
import { self } from "@cldmv/slothlet/runtime";

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
 * Try every access through `self`.
 * @returns {object} The outcomes by access.
 */
function attempt() {
	return {
		readSecret: one(() => self.vault.secret),
		readBoxInner: one(() => self.vault.box.inner),
		callHidden: one(() => self.vault.hidden()),
		listsSecret: one(() => Object.keys(self.vault).includes("secret"))
	};
}

/**
 * The shared record of attempts.
 * @returns {Object<string, Array<object>>} Attempts by source.
 */
function log() {
	return (globalThis.__slothletShutdownLeftWork ??= { interval: [], timer: [], immediate: [], chain: [] });
}

/**
 * Try everything now, from this call.
 * @returns {object} The outcomes.
 */
export function now() {
	return attempt();
}

/**
 * Leave work behind: an interval ticking until told to stop, a timer and an immediate that wait for the go-ahead, and a
 * promise chain that waits on it too. Each tries everything once the go-ahead is given.
 * @returns {string} "left".
 */
export function leave() {
	const state = globalThis.__slothletShutdownLeftWorkGate;
	const id = setInterval(() => {
		if (state.stop) {
			clearInterval(id);
			return;
		}
		if (state.go) log().interval.push(attempt());
	}, 1);
	const later = (kind, schedule) => {
		const step = () => {
			if (state.go) log()[kind].push(attempt());
			else schedule(step);
		};
		schedule(step);
	};
	later("timer", (fn) => setTimeout(fn, 1));
	later("immediate", (fn) => setImmediate(fn));
	state.released.then(() => {
		log().chain.push(attempt());
	});
	return "left";
}
