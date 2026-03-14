/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/runtime-instanceid.test.vitest.mjs
 *	@Date: 2026-02-22T13:20:41-08:00 (1771795241)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:55 -08:00 (1772425315)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for the instanceID proxy from runtime-asynclocalstorage
 * @module tests/vitests/suites/runtime/runtime-instanceid.test.vitest
 *
 * @description
 * Exercises both the out-of-context (no ALS store) branches and the in-context
 * (resolved value) branches of the instanceID Proxy's get and has traps, covering
 * the lines uncovered in runtime-asynclocalstorage.mjs.
 */

import { describe, it, expect, afterEach } from "vitest";
import { instanceID } from "@cldmv/slothlet/runtime/async";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("runtime-asynclocalstorage: instanceID proxy", () => {
	let api;

	afterEach(async () => {
		if (api && typeof api.shutdown === "function") {
			await api.shutdown();
		}
		api = null;
	});

	// ── outside an active ALS context ─────────────────────────────────────────

	describe("outside an active context", () => {
		it("get trap returns undefined for any property when no context is active", () => {
			// Covers the !ctx || !ctx.instanceID branch of the get trap
			expect(instanceID.someRandomProp).toBeUndefined();
			expect(instanceID.foo).toBeUndefined();
		});

		it("has trap returns false when no context is active", () => {
			// Covers the falsy return branch of the has trap
			expect("someRandomProp" in instanceID).toBe(false);
			expect("toString" in instanceID).toBe(false);
		});
	});

	// ── inside an active ALS context ──────────────────────────────────────────

	describe("inside an active context (async runtime)", () => {
		it("resolves toString / toPrimitive / prop traps and has trap in eager mode", async () => {
			const slothletModule = await import("@cldmv/slothlet");
			api = await slothletModule.default({
				dir: TEST_DIRS.API_TEST,
				mode: "eager",
				runtime: "async",
				diagnostics: true,
				context: { user: "instanceid-test" }
			});

			// Runs inside the ALS context — exercises all get/has branches in the fixture
			const result = api.runtimeTest.getAsyncInstanceID();

			// get trap — "toString" prop → function that returns ctx.instanceID
			expect(result.id).toBe(api.slothlet.instanceID);

			// get trap — Symbol.toPrimitive → String() coercion returns instanceID
			expect(result.coerced).toBe(api.slothlet.instanceID);

			// get trap — ctx.instanceID[prop] fallback (string["length"])
			expect(typeof result.length).toBe("number");
			expect(result.length).toBeGreaterThan(0);

			// has trap — "length" in ctx.instanceID (string has "length")
			expect(result.hasProp).toBe(true);

			// has trap — non-existent prop → false
			expect(result.missingProp).toBe(false);
		});

		it("resolves instanceID in lazy mode", async () => {
			const slothletModule = await import("@cldmv/slothlet");
			api = await slothletModule.default({
				dir: TEST_DIRS.API_TEST,
				mode: "lazy",
				runtime: "async",
				diagnostics: true,
				context: { user: "instanceid-lazy-test" }
			});

			const result = await api.runtimeTest.getAsyncInstanceID();

			expect(result.id).toBe(api.slothlet.instanceID);
			expect(result.hasProp).toBe(true);
			expect(result.missingProp).toBe(false);
		});
	});
});
