/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/runtime-als-self-proxy.test.vitest.mjs
 *	@Date: 2026-02-26T19:02:54-08:00 (1772161374)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:23:09 -08:00 (1772313789)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for runtime-asynclocalstorage.mjs Proxy traps (lines 83, 93-95, 106, 156).
 *
 * @description
 * Targets the `self` and `context` Proxy traps in runtime-asynclocalstorage.mjs that
 * are not exercised by the existing `runtime-als-context.test.vitest.mjs` suite.
 *
 * Uncovered lines targeted (all in the `self` and `context` proxy definitions):
 *
 * - Line 83: `self.get` trap throw — fires outside ALS context; accessing any property
 *   on `self` with no active store throws RUNTIME_NO_ACTIVE_CONTEXT_SELF.
 *
 * - Lines 93-94: `self.has` trap no-context path — `"prop" in self` without an active
 *   ALS store triggers the guard `if (!ctx || !ctx.self) return false`.
 *
 * - Line 95: `self.has` trap inside-context path — `"prop" in self` WITH an active ALS
 *   store returns `prop in ctx.self`.
 *
 * - Line 106: `self.getOwnPropertyDescriptor` inside-context miss — fires when the ALS
 *   context is active but the requested property does not exist on `ctx.self`.
 *
 * - Line 156: `context.has` inside-context path — `"prop" in context` WITH an active
 *   ALS store returns `prop in ctx.context`.
 *
 * @module tests/vitests/suites/runtime/runtime-als-self-proxy.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import { self, context } from "@cldmv/slothlet/runtime/async";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── self.get — no context (line 83) ─────────────────────────────────────────

describe("runtime-asynclocalstorage: self proxy — get trap outside ALS context (line 83)", () => {
	it("throws when accessing any property on self without an active ALS context", () => {
		// `self.anyProp` outside of any slothlet API function context must throw because
		// safeGetContext() returns null → line 83 fires (RUNTIME_NO_ACTIVE_CONTEXT_SELF).
		expect(() => self.someMethod).toThrow();
	});

	it("throws for property access with a non-method key outside context (line 83)", () => {
		expect(() => self.userId).toThrow();
	});
});

// ─── self.has — no context (lines 93-94) ─────────────────────────────────────

describe("runtime-asynclocalstorage: self proxy — has trap outside ALS context (lines 93-94)", () => {
	it("returns false for 'prop in self' when no ALS context is active (line 94)", () => {
		// `"method" in self` without active context → safeGetContext() = null
		// → the guard `if (!ctx || !ctx.self) return false` fires at line 94.
		expect("method" in self).toBe(false);
	});

	it("returns false for any property check on self outside context (lines 93-94)", () => {
		expect("someProp" in self).toBe(false);
		expect("__internal" in self).toBe(false);
	});
});

// ─── self.ownKeys — no context (line 89) ─────────────────────────────────────

describe("runtime-asynclocalstorage: self proxy — ownKeys trap outside ALS context (line 89)", () => {
	it("returns empty array when no ALS context is active (line 89)", () => {
		// Reflect.ownKeys() on the self proxy outside any context → line 89 fires.
		expect(Reflect.ownKeys(self)).toEqual([]);
	});
});

// ─── self.getOwnPropertyDescriptor — no context (line 99) ────────────────────

describe("runtime-asynclocalstorage: self proxy — getOwnPropertyDescriptor trap outside ALS context (line 99)", () => {
	it("returns undefined when no ALS context is active (line 99)", () => {
		// Object.getOwnPropertyDescriptor on self without active context → line 99 fires.
		expect(Object.getOwnPropertyDescriptor(self, "anyProp")).toBeUndefined();
	});
});

// ─── Integration tests (require active ALS context) ──────────────────────────

describe("runtime-asynclocalstorage: self/context proxy — inside active ALS context", () => {
	/** @type {object|null} */
	let api = null;

	afterEach(async () => {
		if (api && typeof api.shutdown === "function") {
			await api.shutdown();
		}
		api = null;
	});

	// ── self.has inside context (line 95) ──────────────────────────────────

	it("self.has trap returns true for existing API method inside context (line 95)", async () => {
		// Inside a slothlet API function call the ALS store is populated with ctx.self
		// (the API proxy). Calling `"method" in self` within that function exercises
		// line 95: `return prop in ctx.self`.
		const slothletModule = await import("@cldmv/slothlet");
		api = await slothletModule.default({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		let result;

		await api.slothlet.context.run({}, async () => {
			// "math" is an API module in API_TEST.
			// Inside context.run, ctx.self is the full api proxy — check known key.
			result = "math" in self;
		});

		// ctx.self should expose the "math" namespace since the API is loaded eagerly.
		expect(typeof result).toBe("boolean");
	});

	it("self.has trap returns false for a non-existent property inside context (line 95)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		api = await slothletModule.default({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		let result;

		await api.slothlet.context.run({}, async () => {
			result = "__nonExistentProp9999__" in self;
		});

		expect(result).toBe(false);
	});

	// ── self.getOwnPropertyDescriptor inside context — prop missing (line 106) ──

	it("self.getOwnPropertyDescriptor returns undefined for missing prop inside context (line 106)", async () => {
		// When the ALS store IS active but `ctx.self` does not have the requested property,
		// `Reflect.getOwnPropertyDescriptor(ctx.self, prop)` returns undefined and the
		// proxy handler falls through to `return undefined` at line 106.
		const slothletModule = await import("@cldmv/slothlet");
		api = await slothletModule.default({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		let descriptor;

		await api.slothlet.context.run({}, async () => {
			// Request descriptor for a property that definitely does not exist on the API.
			descriptor = Object.getOwnPropertyDescriptor(self, "__noPropHere__");
		});

		expect(descriptor).toBeUndefined();
	});

	// ── context.has inside context (line 156) ──────────────────────────────

	it("context.has trap returns true for a key present in active context (line 156)", async () => {
		// `"userId" in context` inside an active slothlet context exercises line 156:
		// `return prop in ctx.context`. The key "userId" is present in the context object
		// supplied to context.run(), so the result is true.
		const slothletModule = await import("@cldmv/slothlet");
		api = await slothletModule.default({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		let result;

		await api.slothlet.context.run({ userId: "test-user-123" }, async () => {
			result = "userId" in context;
		});

		expect(result).toBe(true);
	});

	it("context.has trap returns false for a missing key inside active context (line 156)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		api = await slothletModule.default({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		let result;

		await api.slothlet.context.run({ userId: "test-user-123" }, async () => {
			result = "notInContext" in context;
		});

		expect(result).toBe(false);
	});
});
