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
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			expect(self.myConstant).toBeUndefined();
			self.myConstant = "hello world";
			expect(self.myConstant).toBe("hello world");
			expect("myConstant" in self).toBe(true);
		});
	});

	it("persists function assignments and calls them back through `self`", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.myFn = () => "from-myFn";
			expect(typeof self.myFn).toBe("function");
			expect(self.myFn()).toBe("from-myFn");
		});
	});

	it("makes assigned values visible from the outside via `api.*` too", async () => {
		api = await slothlet({ dir: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.outerView = 42;
		});

		expect(api.outerView).toBe(42);
	});
});
