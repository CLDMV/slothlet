/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/reload-build-timers.test.vitest.mjs
 *	@Date: 2026-11-21T13:06:10-08:00 (1795295170)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:47-08:00 (1795869167)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's timers and immediates that fire while a full `reload()` builds run as that module.
 *
 * @description
 * A full reload builds its new copy as the host, whoever asked for it. Code a module scheduled (an interval armed in an
 * earlier call, or a timer and an immediate set right after the module's own call to `self.slothlet.reload()`) that
 * fires while that build is under way is still that module's code: it gets exactly the answers the same code gets with
 * no reload running. The guest here has a deny rule on `vault.secret`, owns nothing of the vault and has no grant on the
 * permission controls, so every attempt is refused, under both runtimes, eager and lazy, precise and fast attribution.
 *
 * The eager build is held at the import of `base/gate.mjs` until the scheduled code has run, so that code runs inside
 * the build. A lazy build imports nothing, so there the reload is repeated until scheduled code lands before it settles.
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const ROOT = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_reload_build_timers");
const BASE = path.join(ROOT, "base");
const GUEST = path.join(ROOT, "guest");

/** The gated accesses each attempt records. */
const KEYS = ["readSecret", "writeOpen", "ruleAdd", "modeOff"];

/** How many reloads a lazy case tries before giving up on landing scheduled code inside one. */
const LAZY_TRIES = 25;

const COMBOS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["live", "async"])
		for (const attribution of ["precise", "fast"]) COMBOS.push({ name: `${mode}/${runtime}/${attribution}`, mode, runtime, attribution });

/**
 * Wait one macrotask turn.
 * @param {number} [ms=0] - Delay.
 * @returns {Promise<void>}
 */
const sleep = (ms = 0) =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

/**
 * The probe's record.
 * @returns {Object<string, object>} Attempts by label.
 */
const probeLog = () => (globalThis.__slothletReloadBuildProbe ??= {});

/**
 * Put a fresh gate in place.
 * @param {boolean} shut - Whether the eager build is held at `gate.mjs`.
 * @returns {object} The gate.
 */
function freshGate(shut) {
	let entered;
	let open;
	const gate = {
		shut,
		pending: false,
		settled: false,
		stop: false,
		entered: () => entered(),
		open: () => open()
	};
	gate.whenEntered = new Promise((resolve) => {
		entered = resolve;
	});
	gate.opened = new Promise((resolve) => {
		open = resolve;
	});
	let resume;
	gate.resume = new Promise((resolve) => {
		resume = resolve;
	});
	gate.goOn = () => resume();
	globalThis.__slothletReloadBuildGate = gate;
	return gate;
}

/**
 * Only the gated outcomes of an attempt.
 * @param {object} attempt - What the probe recorded.
 * @returns {object} The outcomes by key.
 */
const outcomes = (attempt) => Object.fromEntries(KEYS.map((key) => [key, attempt[key]]));

/**
 * Assert an attempt was refused everything the control was. The denied read and the permission mode answer exactly as
 * in the control; a write and a rule change of the copy being replaced, made after the swap, are refused on that
 * copy's retired node and controls, which can give another refusal code (as the async runtime does), never success.
 * @param {string} label - The attempt's label.
 * @param {object} attempt - What the probe recorded.
 * @param {object} expected - The control outcomes.
 * @returns {void}
 */
function expectRefused(label, attempt, expected) {
	const got = outcomes(attempt);
	expect(got.readSecret, label).toBe(expected.readSecret);
	expect(got.modeOff, label).toBe(expected.modeOff);
	for (const key of KEYS) expect(String(got[key]).startsWith("!"), `${label} ${key}=${got[key]}`).toBe(true);
}

/**
 * Wait until `test` holds, up to `ms`.
 * @param {Function} test - The condition.
 * @param {number} [ms=2000] - The limit.
 * @returns {Promise<boolean>} Whether it held.
 */
async function until(test, ms = 2000) {
	const end = Date.now() + ms;
	while (!test()) {
		if (Date.now() > end) return false;
		await sleep(1);
	}
	return true;
}

describe.each(COMBOS)("Permissions > code a module scheduled runs as that module while a full reload builds > $name", (combo) => {
	let api;

	afterEach(async () => {
		const gate = globalThis.__slothletReloadBuildGate;
		if (gate) {
			gate.stop = true;
			gate.open();
			gate.goOn();
		}
		await api?.slothlet.shutdown().catch(() => {});
		api = undefined;
		delete globalThis.__slothletReloadBuildGate;
		delete globalThis.__slothletReloadBuildProbe;
	});

	/**
	 * Make the instance with the guest mounted.
	 * @param {Array<object>} [extra=[]] - More rules.
	 * @returns {Promise<object>} The api.
	 */
	async function make(extra = []) {
		freshGate(false);
		api = await slothlet({
			base: BASE,
			mode: combo.mode,
			runtime: combo.runtime,
			silent: true,
			permissions: {
				mode: "on",
				policy: "allow",
				caller: { attribution: combo.attribution },
				rules: [{ caller: "guest.**", target: "vault.secret", effect: "deny" }, ...extra]
			}
		});
		await api.slothlet.api.add("guest", GUEST, { id: "guest" });
		return api;
	}

	/**
	 * What the guest's timer and immediate get with no reload running: the answers every attempt below must match.
	 * @returns {Promise<object>} The control outcomes.
	 */
	async function control() {
		await api.guest.probe.later("ctl");
		await until(() => probeLog()["ctl:timer"] && probeLog()["ctl:immediate"]);
		const timer = outcomes(probeLog()["ctl:timer"]);
		expect(outcomes(probeLog()["ctl:immediate"])).toEqual(timer);
		// The guest is refused every one of them.
		for (const key of KEYS) expect(String(timer[key]).startsWith("!")).toBe(true);
		return timer;
	}

	/**
	 * After the reloads: the instance kept its permission mode, and the guest's own call is still refused as before.
	 * @param {object} expected - The control outcomes.
	 * @returns {Promise<void>}
	 */
	async function expectInstanceUnchanged(expected) {
		expect(api.slothlet.permissions.control.mode()).toBe("on");
		expect(api.vault.open).toBe("open");
		expect(outcomes(await api.guest.probe.now("after"))).toEqual(expected);
	}

	it("an interval armed in an earlier call gets the same refusals when it ticks inside a host's reload", async () => {
		await make();
		const expected = await control();
		await api.guest.probe.arm("iv");
		let inside = [];
		const tries = combo.mode === "eager" ? 1 : LAZY_TRIES;
		for (let attempt = 0; attempt < tries && inside.length === 0; attempt++) {
			const gate = globalThis.__slothletReloadBuildGate;
			gate.shut = combo.mode === "eager";
			gate.pending = true;
			gate.settled = false;
			const before = Object.keys(probeLog()).length;
			const reloading = api.slothlet.reload();
			if (gate.shut) {
				await gate.whenEntered;
				// A tick has run while the build waits at the gate.
				expect(await until(() => Object.keys(probeLog()).length > before)).toBe(true);
				gate.open();
			}
			await reloading;
			gate.settled = true;
			gate.pending = false;
			gate.shut = false;
			inside = Object.entries(probeLog()).filter(([label, record]) => label.startsWith("iv#") && record.pending);
		}
		globalThis.__slothletReloadBuildGate.stop = true;
		expect(inside.length).toBeGreaterThan(0);
		for (const [label, record] of inside) expectRefused(label, record, expected);
		await expectInstanceUnchanged(expected);
	});

	it("a call into the module made inside a host's reload, and the rest of one made before it, get the same refusals", async () => {
		await make();
		const expected = await control();
		let inside = [];
		const tries = combo.mode === "eager" ? 1 : LAZY_TRIES;
		for (let attempt = 0; attempt < tries && inside.length === 0; attempt++) {
			let gate = globalThis.__slothletReloadBuildGate;
			if (attempt > 0) gate = freshGate(false);
			gate.shut = combo.mode === "eager";
			const resumed = api.guest.probe.resumeThen(`aw${attempt}`);
			gate.pending = true;
			gate.settled = false;
			const reloading = api.slothlet.reload();
			if (gate.shut) {
				await gate.whenEntered;
				await api.guest.probe.now(`call${attempt}`);
				gate.goOn();
				expect(await until(() => probeLog()[`aw${attempt}`])).toBe(true);
				gate.open();
			} else {
				setImmediate(() => {
					api.guest.probe.now(`call${attempt}`);
					gate.goOn();
				});
			}
			await reloading;
			await resumed;
			gate.settled = true;
			gate.pending = false;
			gate.shut = false;
			for (const key of [`aw${attempt}`, `call${attempt}`]) expectRefused(key, probeLog()[key], expected);
			inside = Object.entries(probeLog()).filter(([key, record]) => (key === `aw${attempt}` || key === `call${attempt}`) && record.pending);
		}
		expect(inside.length).toBeGreaterThan(0);
		await expectInstanceUnchanged(expected);
	});

	it("a timer and an immediate set after the module's own reload() call get the same refusals while it builds", async () => {
		await make([{ caller: "guest.**", target: "slothlet.reload", effect: "allow" }]);
		const expected = await control();
		let inside = [];
		const tries = combo.mode === "eager" ? 1 : LAZY_TRIES;
		for (let attempt = 0; attempt < tries && inside.length === 0; attempt++) {
			const gate = globalThis.__slothletReloadBuildGate;
			gate.shut = combo.mode === "eager";
			gate.pending = true;
			gate.settled = false;
			const label = `gr${attempt}`;
			expect(await api.guest.probe.reloadThenLater(label)).toBe("started");
			if (gate.shut) {
				await gate.whenEntered;
				// Both ran while the build waits at the gate.
				expect(await until(() => probeLog()[`${label}:timer`] && probeLog()[`${label}:immediate`])).toBe(true);
				gate.open();
			}
			expect(await gate.reloading).toBe("reloaded");
			gate.settled = true;
			gate.pending = false;
			gate.shut = false;
			await until(() => probeLog()[`${label}:timer`] && probeLog()[`${label}:immediate`]);
			expectRefused(`${label}:sync`, probeLog()[`${label}:sync`], expected);
			inside = Object.entries(probeLog()).filter(
				([key, record]) => key.startsWith(`${label}:`) && key !== `${label}:sync` && record.pending
			);
			// What landed after the reload settled is refused just the same.
			for (const key of [`${label}:timer`, `${label}:immediate`]) expectRefused(key, probeLog()[key], expected);
		}
		expect(inside.length).toBeGreaterThan(0);
		for (const [label, record] of inside) expectRefused(label, record, expected);
		await expectInstanceUnchanged(expected);
	});
});
