/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/diagnostics/diag-inspect-running.test.vitest.mjs
 *	@Date: 2026-11-17T12:27:48-08:00 (1794947268)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T12:38:02-08:00 (1794947882)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.diag.inspect().runtime.running` is true while code of the instance is executing (one of
 * its calls, or a `context.run()` / `context.scope()` callback opened on it, and a call made inside one) and false
 * in the host's own code outside all of them, in both runtimes.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const CASES = [
	{ mode: "eager", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CASES)("diag.inspect().runtime.running > $mode / $runtime", ({ mode, runtime }) => {
	let api;
	let other;

	afterEach(async () => {
		if (api) await api.shutdown();
		if (other) await other.shutdown();
		api = other = undefined;
	});

	/**
	 * An instance with a `probe` path whose leaves read the instance's own `running` flag.
	 * @returns {Promise<{ api: object, running: function(): boolean }>} The api and a reader of its flag.
	 */
	async function make() {
		const made = await slothlet({ base: TEST_DIRS.API_TEST, mode, runtime, diagnostics: true });
		const running = () => made.slothlet.diag.inspect().runtime.running;
		await made.slothlet.api.add("probe", {
			now: () => running(),
			later: async () => {
				await new Promise((resolve) => setTimeout(resolve, 5));
				return running();
			}
		});
		return { api: made, running };
	}

	it("is false in the host's code outside every call, before and after calls", async () => {
		const made = await make();
		api = made.api;
		expect(made.running()).toBe(false);
		api.probe.now();
		await api.probe.later();
		expect(made.running()).toBe(false);
	});

	it("is true inside a call of the instance, also after an await", async () => {
		const made = await make();
		api = made.api;
		expect(api.probe.now()).toBe(true);
		expect(await api.probe.later()).toBe(true);
	});

	it("is true inside a context.run() / context.scope() callback, and in a call made there", async () => {
		const made = await make();
		api = made.api;
		expect(await api.slothlet.context.run({ tenant: "a" }, () => made.running())).toBe(true);
		expect(await api.slothlet.context.run({ tenant: "a" }, () => api.probe.now())).toBe(true);
		expect(await api.slothlet.context.scope({ context: { tenant: "a" }, fn: () => made.running() })).toBe(true);
		expect(await api.slothlet.context.scope({ context: { tenant: "a" }, fn: () => api.probe.now() })).toBe(true);
		expect(made.running()).toBe(false);
	});

	it("is false for an instance while only another instance's code runs", async () => {
		const made = await make();
		api = made.api;
		other = await slothlet({ base: TEST_DIRS.API_TEST, mode, runtime });
		await other.slothlet.api.add("peek", { first: () => made.running() });
		expect(other.peek.first()).toBe(false);
		expect(await other.slothlet.context.run({ tenant: "b" }, () => made.running())).toBe(false);
	});
});
