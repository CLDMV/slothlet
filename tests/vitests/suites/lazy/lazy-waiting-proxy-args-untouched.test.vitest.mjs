/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-waiting-proxy-args-untouched.test.vitest.mjs
 *	@Date: 2026-10-16T19:30:00-07:00 (1792204200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T19:30:00-07:00 (1792204200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A call through a lazy waiting proxy hands its arguments to the leaf untouched.
 *
 * @description
 * Found while working on #597. The waiting proxy's `apply` built a debug message with `args.join(",")` on
 * every call, whether or not debug output was on. Joining converts each argument to a string, so the
 * framework itself ran the caller's `toString` / `Symbol.toPrimitive` / Proxy traps before the leaf ever
 * saw the value, and threw outright for values that have no string form — a Symbol, or an object with no
 * prototype. The same call against an eager instance, or as plain JavaScript, works.
 *
 * @module tests/vitests/suites/lazy/lazy-waiting-proxy-args-untouched
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_CALLER_SUPPLIED_CODE;

describe.each(getMatrixConfigs())("Lazy > waiting proxy leaves call arguments untouched > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("passes a Symbol argument through", async () => {
		api = await slothlet({ ...config, base: BASE });
		const token = Symbol("token");
		expect(await api.callee.ops.run(() => "ran", token)).toBe("ran");
	});

	it("passes an object with no prototype through", async () => {
		api = await slothlet({ ...config, base: BASE });
		expect(await api.callee.ops.read(Object.assign(Object.create(null), { a: 1 }), "a")).toBe(1);
	});

	it("does not convert an argument the leaf never converts", async () => {
		api = await slothlet({ ...config, base: BASE });
		let conversions = 0;
		const value = {
			a: 1,
			toString() {
				conversions++;
				return "x";
			}
		};
		expect(await api.callee.ops.read(value, "a")).toBe(1);
		expect(conversions).toBe(0);
	});
});
