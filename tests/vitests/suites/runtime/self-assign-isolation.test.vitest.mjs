/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-isolation.test.vitest.mjs
 *	@Date: 2026-05-14T00:00:00-07:00 (1778803200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-14 00:00:00 -07:00 (1778803200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview `self.X = …` inside a full-isolation scope must NOT leak the
 * write to the global API tree.
 *
 * In `scope({ isolation: "full" })`, `ctx.self` is `utilities.deepClone(parent.self)` —
 * a distinct object from `slothlet.boundApi`. The runtime self set trap detects
 * this case and writes directly to `ctx.self`, instead of going through
 * `apiManager.setOwnedProperty(...)` (which writes to the global boundApi).
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";
import { self } from "@cldmv/slothlet/runtime";

describe("self.X = ... under scope({ isolation: 'full' })", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("does not leak the write to the global API tree", async () => {
		api = await slothlet({
			base: "./api_tests/api_test",
			mode: "eager",
			scope: { isolation: "full" }
		});

		expect(api.bootstrapIsolated).toBeUndefined();

		await api.slothlet.run({}, () => {
			// Inside the full-isolation scope: write should land on the cloned
			// `ctx.self`, NOT on the global boundApi.
			self.bootstrapIsolated = "scope-only";
			expect(self.bootstrapIsolated).toBe("scope-only");
		});

		// After the scope exits, the global tree must be untouched.
		expect(api.bootstrapIsolated).toBeUndefined();
	});

	it("partial isolation (default) still routes through apiManager and persists", async () => {
		// Counter-test: with partial isolation, writes DO persist (existing behavior).
		// This exercises the false arm of the new isolation check.
		api = await slothlet({
			base: "./api_tests/api_test",
			mode: "eager",
			scope: { isolation: "partial" }
		});

		expect(api.bootstrapPartial).toBeUndefined();

		await api.slothlet.run({}, () => {
			self.bootstrapPartial = "persists";
			expect(self.bootstrapPartial).toBe("persists");
		});

		// Partial isolation: write persists to the global tree.
		expect(api.bootstrapPartial).toBe("persists");
	});
});
