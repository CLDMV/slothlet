/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/config/materialize-callback-payload.test.vitest.mjs
 *	@Date: 2026-11-21T00:00:00-08:00 (1795248000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T00:00:00-08:00 (1795248000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `loader.materialize` callback is handed the `materialized:complete` event's payload, `{ total, at }`.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

let api;

afterEach(async () => {
	if (api) await api.shutdown().catch(() => {});
	api = null;
});

/**
 * Wait until `check()` is true, or fail after about two seconds.
 * @param {function(): boolean} check - The condition.
 * @returns {Promise<void>}
 */
const until = async (check) => {
	for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
	expect(check()).toBe(true);
};

describe.each(["async", "live"])("loader.materialize callback payload — %s", (runtime) => {
	it("lazy: the callback gets the materialized:complete payload", async () => {
		const calls = [];
		const events = [];
		api = await slothlet({
			base: TEST_DIRS.API_TEST,
			mode: "lazy",
			runtime,
			silent: true,
			lifecycle: { "materialized:complete": (data) => events.push(data) },
			loader: { materialize: (info) => calls.push(info) }
		});
		await until(() => calls.length === 1 && events.length === 1);
		expect(calls[0]).toEqual(events[0]);
		expect(Object.keys(calls[0]).sort()).toEqual(["at", "total"]);
		expect(typeof calls[0].at).toBe("number");
		expect(calls[0].total).toBe(api.slothlet.materialize.get().total);
	});

	it("eager: the callback gets { total, at }", async () => {
		const calls = [];
		api = await slothlet({
			base: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime,
			silent: true,
			loader: { materialize: (info) => calls.push(info) }
		});
		expect(calls).toHaveLength(1);
		expect(Object.keys(calls[0]).sort()).toEqual(["at", "total"]);
		expect(typeof calls[0].at).toBe("number");
	});
});
