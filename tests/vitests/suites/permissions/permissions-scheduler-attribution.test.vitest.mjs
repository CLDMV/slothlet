/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-scheduler-attribution.test.vitest.mjs
 *	@Date: 2026-07-30 12:00:00 -07:00 (1785438000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-07-30 12:00:00 -07:00 (1785438000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Work a leaf defers onto a timer or microtask still runs as that leaf.
 *
 * @description
 * `setTimeout(() => self.x())` is ordinary module code, and the scheduling call returns long before
 * the callback runs. Under the async runtime AsyncLocalStorage carries the caller across that gap for
 * free. The live runtime has nothing equivalent, so the callback executed with no caller at all —
 * which enforcement reads as host-initiated and exempt. A leaf's deferred work therefore ran with
 * *more* authority than the leaf itself, and rules that denied the leaf did not apply to anything it
 * scheduled.
 *
 * Both cases below let the scheduling call settle first. That ordering is the whole point: while it
 * is still in flight the runtime is holding the leaf's identity anyway, and the callback would be
 * attributed correctly for a reason that has nothing to do with the scheduling boundary.
 *
 * Outcomes are recorded on a module variable and read back through a synchronous accessor, never by
 * awaiting a second call into the module — that would hold a call open across the callback and
 * reintroduce exactly the identity it is meant to be testing for.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe.each(getMatrixConfigs())("Permissions > scheduler attribution > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Arm a deferred read, then poll the synchronous accessor until it reports.
	 * @param {Function} arm - Bound entry point that schedules the work.
	 * @param {Function} read - Bound synchronous accessor for the outcome.
	 * @returns {Promise<object|null>} The recorded outcome.
	 */
	const armAndPoll = async (arm, read) => {
		expect(await arm()).toBe("armed");
		for (let attempt = 0; attempt < 200; attempt++) {
			const outcome = await read();
			if (outcome) return outcome;
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		return null;
	};

	/**
	 * Deny `callers.**` any access to `db.secrets.**`.
	 * @returns {Promise<object>} Bound api.
	 */
	const denySecrets = async () =>
		await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

	it("a timer callback is attributed to the leaf that scheduled it, not exempted", async () => {
		api = await denySecrets();

		const outcome = await armAndPoll(api.callers.dataReader.armTimerRead, api.callers.dataReader.readTimerOutcome);

		expect(outcome).not.toBeNull();
		expect(outcome.ok).toBe(false);
		expect(outcome.code).toMatch(/PERMISSION_DENIED/);
	});

	it("a microtask callback is attributed the same way", async () => {
		api = await denySecrets();

		const outcome = await armAndPoll(api.callers.dataReader.armMicrotaskRead, api.callers.dataReader.readMicrotaskOutcome);

		expect(outcome).not.toBeNull();
		expect(outcome.ok).toBe(false);
		expect(outcome.code).toMatch(/PERMISSION_DENIED/);
	});

	it("keeps carrying identity for a live instance after a different instance shuts down", async () => {
		// The boundary patches are process-global, so unpatching is global too. A second instance going
		// away must not take them from this one: its deferred work would arrive unattributed, and an
		// unattributed caller cannot read `self` at all — so a read the rules permit starts failing.
		const other = await denySecrets();
		api = await denySecrets();
		await other.shutdown();

		const outcome = await armAndPoll(api.callers.dataReader.armTimerRead, api.callers.dataReader.readTimerOutcome);

		expect(outcome).not.toBeNull();
		// Denied by the rules is the correct outcome. RUNTIME_NO_ACTIVE_CONTEXT_SELF would mean the
		// callback lost its identity entirely, which is the regression this guards.
		expect(outcome.code).toMatch(/PERMISSION_DENIED/);
	});

	it("a permitted leaf keeps its deferred access", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "deny",
				rules: [
					{ caller: "callers.dataReader.**", target: "db.secrets.**", effect: "allow" },
					{ caller: "**", target: "callers.**", effect: "allow" }
				]
			}
		});

		// Attribution must not cost a permitted leaf its deferred work.
		const outcome = await armAndPoll(api.callers.dataReader.armTimerRead, api.callers.dataReader.readTimerOutcome);

		expect(outcome).not.toBeNull();
		expect(outcome.ok).toBe(true);
		expect(outcome.value).toContain("super-secret-token");
	});
});

describe("Permissions > scheduler attribution > mixed runtimes in one process", () => {
	/**
	 * Deny `callers.**` any access to `db.secrets.**`, on a chosen runtime.
	 * @param {string} runtime - "async" or "live".
	 * @returns {Promise<object>} Bound api.
	 */
	const boot = async (runtime) =>
		await slothlet({
			base: BASE,
			mode: "eager",
			runtime,
			permissions: {
				defaultPolicy: "allow",
				rules: [{ caller: "callers.**", target: "db.secrets.**", effect: "deny" }]
			}
		});

	it("an async instance is unaffected by a live instance's global patching", async () => {
		// The live runtime registers a caller-pinner and patches the schedulers process-wide. The async
		// runtime needs neither — AsyncLocalStorage already spans a timer — so the pinner must decline to
		// act on work that is not the live instance's, rather than attributing it to whatever the live
		// runtime last had in its single caller field.
		const live = await boot("live");
		const asyncApi = await boot("async");
		try {
			expect(await asyncApi.callers.dataReader.armTimerRead()).toBe("armed");

			let outcome = null;
			for (let attempt = 0; attempt < 200 && !outcome; attempt++) {
				outcome = await asyncApi.callers.dataReader.readTimerOutcome();
				if (!outcome) await new Promise((resolve) => setTimeout(resolve, 20));
			}

			expect(outcome).not.toBeNull();
			expect(outcome.ok).toBe(false);
			expect(outcome.code).toMatch(/PERMISSION_DENIED/);
		} finally {
			await asyncApi.shutdown();
			await live.shutdown();
		}
	});
});
