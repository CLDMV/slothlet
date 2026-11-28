/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/shutdown-left-work.test.vitest.mjs
 *	@Date: 2026-11-21T14:51:12-08:00 (1795301472)
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
 * @fileoverview Work a module leaves behind, still running after its instance shuts down, gets no more than the
 * module's own calls got while the instance ran.
 *
 * @description
 * The guest has deny rules on `vault.secret`, `vault.box.inner` and `vault.hidden`. While the instance runs, its calls
 * are refused those and the listing of the vault leaves `secret` out. It then leaves work behind (an interval, a timer,
 * an immediate, a promise chain) that waits until the instance has shut down and tries the same accesses: every one is
 * still refused, under both runtimes, eager and lazy, precise and fast attribution. Shutting down an instance grants
 * its modules' code nothing.
 */

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const ROOT = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_shutdown_left_work");

const COMBOS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["live", "async"])
		for (const attribution of ["precise", "fast"]) COMBOS.push({ name: `${mode}/${runtime}/${attribution}`, mode, runtime, attribution });

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
		await new Promise((resolve) => {
			setTimeout(resolve, 1);
		});
	}
	return true;
}

/**
 * Assert an attempt was refused everything the module's own call was refused.
 * @param {string} label - What made the attempt.
 * @param {object} attempt - Its outcomes.
 * @returns {void}
 */
function expectRefused(label, attempt) {
	for (const key of ["readSecret", "readBoxInner", "callHidden"])
		expect(String(attempt[key]).startsWith("!"), `${label} ${key}=${attempt[key]}`).toBe(true);
	expect(attempt.listsSecret, `${label} listsSecret`).not.toBe("true");
}

describe.each(COMBOS)("Permissions > work a module leaves behind gets no more once its instance has shut down > $name", (combo) => {
	let api;

	afterEach(async () => {
		const gate = globalThis.__slothletShutdownLeftWorkGate;
		if (gate) gate.stop = true;
		await api?.slothlet.shutdown().catch(() => {});
		api = undefined;
		await new Promise((resolve) => {
			setTimeout(resolve, 5);
		});
		delete globalThis.__slothletShutdownLeftWorkGate;
		delete globalThis.__slothletShutdownLeftWork;
	});

	it("an interval, a timer, an immediate and a promise chain are refused what the module's calls were", async () => {
		let release;
		globalThis.__slothletShutdownLeftWorkGate = {
			go: false,
			stop: false,
			released: new Promise((resolve) => {
				release = resolve;
			})
		};
		api = await slothlet({
			base: path.join(ROOT, "base"),
			mode: combo.mode,
			runtime: combo.runtime,
			silent: true,
			permissions: {
				mode: "on",
				policy: "allow",
				caller: { attribution: combo.attribution },
				rules: [
					{ caller: "guest.**", target: "vault.secret", effect: "deny" },
					{ caller: "guest.**", target: "vault.box.inner", effect: "deny" },
					{ caller: "guest.**", target: "vault.hidden", effect: "deny" }
				]
			}
		});
		await api.slothlet.api.add("guest", path.join(ROOT, "guest"), { id: "guest" });

		// While the instance runs: the module's own call is refused all of them.
		expectRefused("call", await api.guest.probe.now());
		// The host reads them all.
		expect(api.vault.secret).toBe("SECRET");

		expect(await api.guest.probe.leave()).toBe("left");
		await api.slothlet.shutdown();
		api = undefined;

		const gate = globalThis.__slothletShutdownLeftWorkGate;
		gate.go = true;
		release();
		const log = () => globalThis.__slothletShutdownLeftWork;
		expect(
			await until(() => log() && log().interval.length > 2 && log().timer.length && log().immediate.length && log().chain.length)
		).toBe(true);
		gate.stop = true;
		for (const [kind, attempts] of Object.entries(log())) for (const attempt of attempts) expectRefused(kind, attempt);
	});
});
