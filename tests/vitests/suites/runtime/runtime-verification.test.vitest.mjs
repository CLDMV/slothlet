/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/runtime-verification.test.vitest.mjs
 *	@Date: 2026-01-16T21:11:21-08:00 (1768626681)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:59 -08:00 (1770266399)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Runtime verification tests that validate async vs live context manager implementation
 * @module tests/vitests/suites/runtime/runtime-verification.test.vitest
 * @memberof tests.vitests
 *
 * @description
 * Tests that verify the correct context manager (AsyncContextManager vs LiveContextManager)
 * is being used based on runtime config. Uses the runtime-test.mjs module to perform
 * comprehensive verification of runtime behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// console.log("API TEST DIR: ", TEST_DIRS.API_TEST);

describe.each(getMatrixConfigs())("Runtime Verification > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		// Shutdown any existing API first
		if (api && typeof api.shutdown === "function") {
			await api.shutdown();
		}
		api = null;

		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
	});

	afterEach(async () => {
		if (api && typeof api.shutdown === "function") {
			await api.shutdown();
		}
		api = null;
	});

	it("should use correct runtime implementation based on config", async () => {
		const expectedRuntime = config.runtime || "async";

		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			diagnostics: true,
			context: {
				user: "test-user",
				expectedRuntime: expectedRuntime
			}
		});

		// Call the runtime verification module
		const isLazy = config.mode === "lazy";
		const results = isLazy ? await api.runtimeTest.verifyRuntime() : api.runtimeTest.verifyRuntime();

		// console.log("TEST: api.slothlet exists?", !!api.slothlet);
		// console.log("TEST: api.slothlet.diag exists?", !!api.slothlet?.diag);
		// console.log("TEST: api.slothlet keys:", Object.keys(api.slothlet || {}));
		// console.log("TEST: api keys:", Object.keys(api));

		// Verify runtime type detection
		expect(results.runtimeType).toBe(expectedRuntime);

		// Verify self is available
		expect(results.selfTest.available).toBe(true);
		expect(results.selfTest.hasApi).toBe(true);

		// Verify context is available
		expect(results.contextTest.available).toBe(true);
		expect(results.contextTest.hasUserData).toBe(true);
		expect(results.contextTest.userData).toBe("test-user");

		// Verify instanceId is available and matches between runtime test and actual API
		expect(results.instanceIdTest.available).toBe(true);
		// Verify instanceId from inside runtime-test.mjs matches the actual instanceId
		expect(results.instanceIdTest.value).toBe(api.slothlet.instanceID);
	});

	it("should pass comprehensive runtime verification", async () => {
		const expectedRuntime = config.runtime || "async";

		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			diagnostics: true,
			context: {
				user: "comprehensive-test",
				expectedRuntime: expectedRuntime
			}
		});

		// Run comprehensive test
		const isLazy = config.mode === "lazy";
		const results = isLazy ? await api.runtimeTest.comprehensiveRuntimeTest() : api.runtimeTest.comprehensiveRuntimeTest();

		// Verify all test components passed
		expect(results.verification).toBeDefined();
		expect(results.verification.runtimeType).toBe(expectedRuntime);

		expect(results.crossCall).toBeDefined();
		expect(results.crossCall.success).toBe(true);
		expect(results.crossCall.actual).toBe(8); // 5 + 3

		expect(results.isolation).toBeDefined();
		expect(results.isolation.contextAvailable).toBe(true);
		if (results.isolation.runtimeType) {
			expect(results.isolation.runtimeType).toBe(expectedRuntime);
		}

		expect(results.performance).toBeDefined();
		expect(results.performance.totalTime).toBeGreaterThan(0);
	});
});

describe("Runtime Implementation Verification", () => {
	let slothlet;
	let instances = [];

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
		instances = [];
	});

	afterEach(async () => {
		for (const instance of instances) {
			if (instance && typeof instance.shutdown === "function") {
				await instance.shutdown();
			}
		}
		instances = [];
	});

	it("should use AsyncContextManager for async runtime", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			diagnostics: true,
			context: { expectedRuntime: "async" }
		});
		instances.push(api);

		const results = api.runtimeTest.verifyRuntime();

		// Verify async runtime is detected
		expect(results.runtimeType).toBe("async");

		// Verify context is available (ALS-based)
		expect(results.contextTest.available).toBe(true);
	});

	it("should use LiveContextManager for live runtime", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "live",
			diagnostics: true,
			context: { expectedRuntime: "live" }
		});
		instances.push(api);

		const results = api.runtimeTest.verifyRuntime();

		// Verify live runtime is detected
		expect(results.runtimeType).toBe("live");

		// Verify context is available (direct state)
		expect(results.contextTest.available).toBe(true);
	});

	it("should correctly isolate async and live instances", async () => {
		const asyncApi = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			diagnostics: true,
			context: {
				user: "async-user",
				expectedRuntime: "async"
			}
		});
		instances.push(asyncApi);

		const liveApi = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "live",
			diagnostics: true,
			context: {
				user: "live-user",
				expectedRuntime: "live"
			}
		});
		instances.push(liveApi);

		// Verify async instance
		const asyncResults = asyncApi.runtimeTest.verifyRuntime();
		expect(asyncResults.runtimeType).toBe("async");
		expect(asyncResults.contextTest.userData).toBe("async-user");

		// Verify live instance
		const liveResults = liveApi.runtimeTest.verifyRuntime();
		expect(liveResults.runtimeType).toBe("live");
		expect(liveResults.contextTest.userData).toBe("live-user");

		// Verify different instanceIds
		expect(asyncApi.slothlet.instanceID).not.toBe(liveApi.slothlet.instanceID);
	});

	it("should exercise context dispatcher proxy traps via live runtime", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "live",
			context: { userId: 99, role: "admin" }
		});
		instances.push(api);

		// exerciseContextDispatcherTraps calls Reflect.ownKeys, has, getOwnPropertyDescriptor,
		// and set on the @cldmv/slothlet/runtime context dispatcher proxy — covering lines 99-112
		const result = api.runtimeTest.exerciseContextDispatcherTraps();

		expect(Array.isArray(result.keys)).toBe(true);
		expect(result.keys).toContain("userId");
		expect(result.hasUserId).toBe(true);
		expect(result.hasMissing).toBe(false);
		expect(result.descriptor).toBeDefined();
		expect(result.descriptor.value).toBe(99);
		expect(result.setWorked).toBe(true);
	});

	it("should exercise instanceID dispatcher proxy traps via live runtime", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "live",
			context: { userId: 1 }
		});
		instances.push(api);

		// exerciseInstanceIDDispatcherTraps accesses instanceID from @cldmv/slothlet/runtime
		// dispatcher, covering the get and has traps at lines 128-133.
		// Live runtime has no instanceID export so the falsy branch fires (returns undefined/false).
		const result = api.runtimeTest.exerciseInstanceIDDispatcherTraps();

		expect(result.id).toBeUndefined();
		expect(result.hasProp).toBe(false);
		expect(result.hasMissing).toBe(false);
	});

	it("should exercise async context set and getOwnPropertyDescriptor traps within context.run", async () => {
		// Use async runtime so the ALS context is active during context.run()
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			context: { userId: 99 }
		});
		instances.push(api);

		let result;
		// exerciseAsyncContextWriteTraps writes to asyncContext and calls
		// getOwnPropertyDescriptor — covering runtime-asynclocalstorage.mjs lines 141-146 and 154-156.
		// MUST be called inside context.run() so the ALS store is active.
		await api.slothlet.context.run({ userId: 99 }, async () => {
			result = api.runtimeTest.exerciseAsyncContextWriteTraps();
		});

		expect(result.setWorked).toBe(true);
		expect(result.setError).toBeNull();
		// Descriptor for userId should be the plain-object own-property descriptor
		expect(result.descriptor).toBeDefined();
		expect(result.descriptor.value).toBe(99);
	});
});
