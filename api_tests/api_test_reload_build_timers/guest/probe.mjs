/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_reload_build_timers/guest/probe.mjs
 *	@Date: 2026-11-21T12:54:54-08:00 (1795294494)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:20-08:00 (1795868960)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a module with no grant on the vault or the permission controls, which tries them from timers,
 * immediates and its own calls, and records what each attempt got.
 * @module api_test_reload_build_timers.probe
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The shared record of attempts, keyed by label.
 * @returns {Object<string, object>} The record.
 */
function log() {
	return (globalThis.__slothletReloadBuildProbe ??= {});
}

/**
 * What a throw reports: its code, else its name.
 * @param {*} error - The throw.
 * @returns {string} The code.
 */
function codeOf(error) {
	return `!${error?.code ?? error?.name ?? String(error)}`;
}

/**
 * Try every gated access once and record the outcome of each under `label`.
 * @param {string} label - The record's key.
 * @returns {object} The outcomes.
 */
function attempt(label) {
	const out = {};
	const one = (key, fn) => {
		try {
			out[key] = fn();
		} catch (error) {
			out[key] = codeOf(error);
		}
	};
	one("readSecret", () => String(self.vault.secret));
	one("writeOpen", () => {
		self.vault.open = "W";
		return "done";
	});
	one("ruleAdd", () => {
		self.slothlet.permissions.rules.add({ caller: "guest.**", target: "vault.**", effect: "allow" });
		return "done";
	});
	one("modeOff", () => {
		self.slothlet.permissions.control.mode("off");
		return "done";
	});
	const gate = globalThis.__slothletReloadBuildGate;
	// Whether the reload the test started had not settled yet.
	out.pending = gate?.pending === true && gate?.settled !== true;
	log()[label] = out;
	return out;
}

/**
 * Try everything now, from this call.
 * @param {string} label - The record's key.
 * @returns {object} The outcomes.
 */
export function now(label) {
	return attempt(label);
}

/**
 * Wait for the test to let this call go on, then try everything: the rest of a call started before a reload, resuming
 * while the reload builds.
 * @param {string} label - The record's key.
 * @returns {Promise<object>} The outcomes.
 */
export async function resumeThen(label) {
	await globalThis.__slothletReloadBuildGate.resume;
	return attempt(label);
}

/**
 * Schedule a timer and an immediate that each try everything.
 * @param {string} label - The records' key prefix.
 * @returns {string} "set".
 */
export function later(label) {
	setTimeout(() => attempt(`${label}:timer`), 0);
	setImmediate(() => attempt(`${label}:immediate`));
	return "set";
}

/**
 * Start an interval that tries everything on each tick while `globalThis.__slothletReloadBuildGate.pending` is set, and
 * stops once the gate says stop or another gate (the next test's) has taken its place.
 * @param {string} label - The records' key prefix.
 * @returns {string} "armed".
 */
export function arm(label) {
	let tick = 0;
	const armed = globalThis.__slothletReloadBuildGate;
	const id = setInterval(() => {
		const gate = globalThis.__slothletReloadBuildGate;
		if (gate !== armed || gate?.stop) {
			clearInterval(id);
			return;
		}
		if (gate?.pending !== true) return;
		attempt(`${label}#${++tick}`);
	}, 1);
	return "armed";
}

/**
 * Reload the instance as this module, then try everything from a timer and an immediate while it builds.
 * @param {string} label - The records' key prefix.
 * @returns {string} "started", or the code the reload was refused with.
 */
export function reloadThenLater(label) {
	let reloading;
	try {
		reloading = self.slothlet.reload();
	} catch (error) {
		return codeOf(error);
	}
	attempt(`${label}:sync`);
	later(label);
	const gate = globalThis.__slothletReloadBuildGate;
	gate.reloading = Promise.resolve(reloading).then(
		() => {
			gate.settled = true;
			return "reloaded";
		},
		(error) => {
			gate.settled = true;
			return codeOf(error);
		}
	);
	return "started";
}
