/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-persist.test.vitest.mjs
 *	@Date: 2026-05-12T21:37:58-07:00 (1778647078)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 22:32:56 -07:00 (1778650376)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Stage 1 regression test for `self.X = …`.
 *
 * Prior to the fix, the runtime `self` proxy had no `set` trap. JS would
 * default-set on the proxy's empty `{}` target while `get` routed reads to the
 * live API — so writes were silently lost (even from the writer's perspective).
 *
 * The set trap added in stage 1 forwards the assignment through `ctx.self`
 * (boundApi) so it lands on the underlying API object. Subsequent stages will
 * layer wrap-on-set, ownership constraints, collision checks, and reload survival.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";
import { self } from "@cldmv/slothlet/runtime";

describe("self.X = ... (Stage 1: persistence)", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("persists primitive assignments across reads from `self`", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			expect(self.myConstant).toBeUndefined();
			self.myConstant = "hello world";
			expect(self.myConstant).toBe("hello world");
			expect("myConstant" in self).toBe(true);
		});
	});

	it("persists function assignments and calls them back through `self`", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.myFn = () => "from-myFn";
			expect(typeof self.myFn).toBe("function");
			expect(self.myFn()).toBe("from-myFn");
		});
	});

	it("makes assigned values visible from the outside via `api.*` too", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.outerView = 42;
		});

		expect(api.outerView).toBe(42);
	});

	it("persists self.X = … in live runtime mode (covers runtime-livebindings)", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager", runtime: "live" });

		await api.slothlet.run({}, () => {
			self.liveModeValue = "from-live";
			self.liveModeFn = () => "live-fn-result";
		});

		expect(api.liveModeValue).toBe("from-live");
		expect(typeof api.liveModeFn).toBe("function");
		expect(api.liveModeFn()).toBe("live-fn-result");
	});
});
