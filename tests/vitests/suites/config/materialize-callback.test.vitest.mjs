/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/config/materialize-callback.test.vitest.mjs
 *	@Date: 2026-11-16T19:34:11-08:00 (1794886451)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:20-08:00 (1795869080)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `loader.materialize` given a function.
 *
 * @description
 * A function turns background materialization on and is called once, with `{ total, at }`, when everything has
 * materialized — at once when that is already so as the instance finishes loading (always in eager mode).
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

describe.each(["eager", "lazy"])("loader.materialize callback - %s", (mode) => {
	it("is called once when everything has materialized, with { total, at }", async () => {
		const calls = [];
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, silent: true, loader: { materialize: (info) => calls.push(info) } });

		if (mode === "eager") {
			// Already complete when the instance finishes loading: called before slothlet() resolves.
			expect(calls).toHaveLength(1);
			expect(calls[0].total).toBe(0);
		} else {
			await until(() => calls.length === 1);
			expect(calls[0].total).toBeGreaterThan(0);
			expect(calls[0].total).toBe(api.slothlet.materialize.get().total);
		}
		expect(typeof calls[0].at).toBe("number");
		expect(api.slothlet.materialize.complete).toBe(true);

		// Once per instance.
		await api.slothlet.materialize.wait();
		await new Promise((r) => setTimeout(r, 20));
		expect(calls).toHaveLength(1);
	});

	it("turns background materialization on", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode, silent: true, loader: { materialize: () => {} } });
		await until(() => api.slothlet.materialize.complete === true);
		expect(api.slothlet.node(api.deep.folder.config).materialized).toBe(true);
	});

	it("reports what the callback throws or rejects with as a warning", async () => {
		api = await slothlet({
			base: TEST_DIRS.API_TEST,
			mode,
			silent: true,
			diagnostics: true,
			loader: {
				materialize: () => {
					throw new Error("boom");
				}
			}
		});
		const handlerWarnings = () => api.slothlet.warnings.get().filter((w) => w.code === "WARNING_LIFECYCLE_HANDLER_ERROR");
		await until(() => handlerWarnings().some((w) => w.cause?.message === "boom"));
		await api.shutdown();

		api = await slothlet({
			base: TEST_DIRS.API_TEST,
			mode,
			silent: true,
			diagnostics: true,
			loader: { materialize: async () => Promise.reject(new Error("later")) }
		});
		await until(() => handlerWarnings().some((w) => w.cause?.message === "later"));
	});
});

describe("loader.materialize value", () => {
	it("refuses anything but a boolean or a function", async () => {
		await expect(slothlet({ base: TEST_DIRS.API_TEST, silent: true, loader: { materialize: "yes" } })).rejects.toMatchObject({
			code: "INVALID_CONFIG"
		});
	});
});
