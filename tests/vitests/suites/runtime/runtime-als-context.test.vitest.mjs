/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/runtime-als-context.test.vitest.mjs
 *	@Date: 2026-02-24T18:55:20-08:00 (1771988120)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:55 -08:00 (1772425315)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Direct coverage tests for the ALS context proxy from runtime-asynclocalstorage
 * @module tests/vitests/suites/runtime/runtime-als-context.test.vitest
 *
 * @description
 * Exercises the "no active ALS context" branches of the `context` Proxy exported from
 * @cldmv/slothlet/runtime/async. Every slothlet API call is wrapped in runInContext()
 * which always activates an ALS store, so these branches can only be reached by
 * accessing the proxy directly in test code — not via a slothlet API fixture function.
 *
 * Uncovered lines targeted:
 *   136 — context.get trap: return undefined (no ctx)
 *   143 — context.set trap: throw RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT (no ctx)
 *   154–156 — context.getOwnPropertyDescriptor trap: return undefined (no ctx)
 */

import { describe, it, expect, afterEach } from "vitest";
import { context } from "@cldmv/slothlet/runtime/async";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("runtime-asynclocalstorage: context proxy (no active ALS context)", () => {
	// ── get trap (line 136) ────────────────────────────────────────────────

	it("get trap returns undefined for any property when no ALS context is active", () => {
		// Calling `context.someKey` outside of any api.slothlet.context.run() means
		// safeGetContext() returns null → the no-context branch fires (line 136).
		expect(context.userId).toBeUndefined();
		expect(context.someRandomProp).toBeUndefined();
		expect(context.__noContextProbe).toBeUndefined();
	});

	// ── set trap (line 143) ────────────────────────────────────────────────

	it("set trap throws RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT when no ALS context is active", () => {
		// Assigning to `context.key` without an active ALS store must throw. (line 143)
		expect(() => {
			context.__noContextWrite = "should-throw";
		}).toThrow();
	});

	// ── getOwnPropertyDescriptor trap (lines 154-156) ─────────────────────

	it("getOwnPropertyDescriptor trap returns undefined when no ALS context is active", () => {
		// Object.getOwnPropertyDescriptor on the proxy triggers the trap.
		// Without active context, safeGetContext() returns null → return undefined (lines 154-156).
		const descriptor = Object.getOwnPropertyDescriptor(context, "userId");
		expect(descriptor).toBeUndefined();
	});

	// ── ownKeys and has no-context (should already be covered; confirm) ────

	it("ownKeys trap returns empty array when no ALS context is active", () => {
		expect(Reflect.ownKeys(context)).toEqual([]);
	});

	it("has trap returns false when no ALS context is active", () => {
		expect("userId" in context).toBe(false);
		expect("someRandomProp" in context).toBe(false);
	});
});

describe("runtime-asynclocalstorage: context proxy (inside active ALS context)", () => {
	let api;

	afterEach(async () => {
		if (api && typeof api.shutdown === "function") {
			await api.shutdown();
		}
		api = null;
	});

	it("get trap returns value from active context store", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		api = await slothletModule.default({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			context: { userId: "als-test-user" }
		});

		// Inside context.run() the ALS store is active — context.get returns from ctx.context
		let captured;
		await api.slothlet.context.run({ userId: "run-user" }, async () => {
			captured = context.userId;
		});
		expect(captured).toBe("run-user");
	});
});
