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

console.log("API TEST DIR: ", TEST_DIRS.API_TEST);

describe.each(getMatrixConfigs())("Runtime Verification > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		// Shutdown any existing API first
		if (api && typeof api.shutdown === "function") {
			await api.shutdown();
		}
		api = null;

		const slothletModule = await import("../../../../index2.mjs");
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

		console.log("TEST: api.slothlet exists?", !!api.slothlet);
		console.log("TEST: api.slothlet.diag exists?", !!api.slothlet?.diag);
		console.log("TEST: api.slothlet keys:", Object.keys(api.slothlet || {}));
		console.log("TEST: api keys:", Object.keys(api));

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
		const diagData = api.slothlet.diag.inspect();
		expect(results.instanceIdTest.available).toBe(true);
		// Verify instanceId from inside runtime-test.mjs matches the actual instanceId
		expect(results.instanceIdTest.value).toBe(diagData.instanceId);
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
		const slothletModule = await import("../../../../index2.mjs");
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
		const asyncDiag = asyncApi.slothlet.diag.inspect();
		const liveDiag = liveApi.slothlet.diag.inspect();
		expect(asyncDiag.instanceId).not.toBe(liveDiag.instanceId);
	});
});
