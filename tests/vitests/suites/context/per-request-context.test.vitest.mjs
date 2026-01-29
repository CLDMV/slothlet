/**
 * @fileoverview Tests for per-request context feature (.run() and .scope() methods)
 * @module tests/vitests/processed/context/per-request-context.test.vitest
 * @memberof tests.vitests
 *
 * @description
 * Tests the per-request context feature that allows consumers to modify context
 * on a per-request basis using .run() and .scope() methods.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Full matrix for comprehensive testing
const ALL_CONFIGS = getMatrixConfigs({});

describe.each(ALL_CONFIGS)("Per-Request Context (.run/.scope) > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should support .run() with shallow merge", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "test", version: "1.0" },
			reference: { testValue: 42, testFunc: (x) => x * 2 },
			scope: { merge: "shallow" }
		});

		let contextInside;
		await api.slothlet.context.run({ userId: 123, requestId: "req-abc" }, async () => {
			// Call actual API function to verify context propagates
			contextInside = await api.slothlet.context.get();
		});

		expect(contextInside.userId).toBe(123);
		expect(contextInside.requestId).toBe("req-abc");
		expect(contextInside.appName).toBe("test");
		expect(contextInside.version).toBe("1.0");

		// Context outside should not have request data
		const contextOutside = await api.slothlet.context.get();
		expect(contextOutside.userId).toBeUndefined();
		expect(contextOutside.requestId).toBeUndefined();
		expect(contextOutside.appName).toBe("test");
	});

	it("should support .scope() with shallow merge", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "test" },
			scope: { merge: "shallow" }
		});

		let contextInside;
		await api.slothlet.context.scope({
			context: { userId: 456, traceId: "trace-xyz" },
			fn: async () => {
				// Call actual API function
				contextInside = await api.slothlet.context.get();
			}
		});

		expect(contextInside.userId).toBe(456);
		expect(contextInside.traceId).toBe("trace-xyz");
		expect(contextInside.appName).toBe("test");
	});

	it("should support deep merge when configured", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: {
				appName: "test",
				config: {
					timeout: 5000,
					retries: 3,
					nested: { flag: true }
				}
			},
			scope: { merge: "deep" }
		});

		let configValue;
		await api.slothlet.context.run(
			{
				userId: 999,
				config: {
					timeout: 10000,
					nested: { newProp: "added" }
				}
			},
			async () => {
				configValue = await api.slothlet.context.get("config");
			}
		);

		expect(configValue).toBeDefined();
		expect(configValue.timeout).toBe(10000); // Overridden
		expect(configValue.retries).toBe(3); // Preserved
		expect(configValue.nested.flag).toBe(true); // Preserved
		expect(configValue.nested.newProp).toBe("added"); // Added
	});

	it("should default to shallow merge when scope not specified", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { base: { level1: "original" } }
		});

		let baseValue;
		await api.slothlet.context.run({ base: { level2: "new" } }, async () => {
			baseValue = await api.slothlet.context.get("base");
		});

		// Shallow merge replaces entire object
		expect(baseValue.level2).toBe("new");
		expect(baseValue.level1).toBeUndefined();
	});

	it("should pass additional arguments through .run()", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "test" }
		});

		let capturedArgs;
		await api.slothlet.context.run(
			{ requestId: "test" },
			async (arg1, arg2, arg3) => {
				capturedArgs = [arg1, arg2, arg3];
			},
			"first",
			"second",
			"third"
		);

		expect(capturedArgs).toEqual(["first", "second", "third"]);
	});

	it("should pass args array through .scope()", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "test" }
		});

		let capturedArgs;
		await api.slothlet.context.scope({
			context: { requestId: "test" },
			fn: async (arg1, arg2) => {
				capturedArgs = [arg1, arg2];
			},
			args: ["value1", "value2"]
		});

		expect(capturedArgs).toEqual(["value1", "value2"]);
	});

	it("should isolate concurrent request contexts", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "test" }
		});

		const results = await Promise.all([
			api.slothlet.context.run({ requestId: "req-1" }, async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				// Call actual API function
				return await api.slothlet.context.get("requestId");
			}),
			api.slothlet.context.run({ requestId: "req-2" }, async () => {
				await new Promise((resolve) => setTimeout(resolve, 5));
				// Call actual API function
				return await api.slothlet.context.get("requestId");
			})
		]);

		expect(results[0]).toBe("req-1");
		expect(results[1]).toBe("req-2");
	});

	it("should support nested .run() calls with context inheritance", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { level: "base" }
		});

		const result = await api.slothlet.context.run({ level: 1, userId: 100 }, async () => {
			// Call actual API function
			const level1Context = await api.slothlet.context.get();

			const innerResult = await api.slothlet.context.run({ level: 2, spanId: "span-456" }, async () => {
				// Call actual API function
				return await api.slothlet.context.get();
			});

			return { level1Context, level2Context: innerResult };
		});

		expect(result.level1Context.level).toBe(1);
		expect(result.level1Context.userId).toBe(100);
		expect(result.level2Context.level).toBe(2);
		expect(result.level2Context.spanId).toBe("span-456");
		expect(result.level2Context.userId).toBe(100); // Inherited from parent request
	});

	it("should maintain base context outside .run() and not modify existing values", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "test", version: "1.0" }
		});

		await api.slothlet.context.run({ userId: 123, appName: "modified-inside" }, async () => {
			// Call actual API function
			const inside = await api.slothlet.context.get();
			expect(inside.userId).toBe(123);
			expect(inside.appName).toBe("modified-inside"); // Modified inside .run()
			expect(inside.version).toBe("1.0"); // Inherited from base
		});

		// Verify base context is unchanged
		const outside = await api.slothlet.context.get();
		expect(outside.userId).toBeUndefined(); // New value doesn't leak
		expect(outside.appName).toBe("test"); // Original value preserved
		expect(outside.version).toBe("1.0"); // Original value preserved
	});
});

// Multi-instance isolation tests
describe.each(ALL_CONFIGS)("Per-Request Context Multi-Instance > Config: '$name'", ({ config }) => {
	let slothlet;
	let api1;
	let api2;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
	});

	afterEach(async () => {
		if (api1) {
			await api1.shutdown();
			api1 = null;
		}
		if (api2) {
			await api2.shutdown();
			api2 = null;
		}
	});

	it("should isolate context between multiple slothlet instances", async () => {
		api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "app1", instanceName: "first" }
		});

		api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "app2", instanceName: "second" }
		});

		// Verify each instance has its own base context
		const ctx1 = await api1.slothlet.context.get();
		const ctx2 = await api2.slothlet.context.get();

		expect(ctx1.appName).toBe("app1");
		expect(ctx1.instanceName).toBe("first");
		expect(ctx2.appName).toBe("app2");
		expect(ctx2.instanceName).toBe("second");
	});

	it("should not allow .run() on one instance to affect another instance", async () => {
		api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "app1" }
		});

		api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "app2" }
		});

		// Run .run() on api1 with modified context
		await api1.slothlet.context.run({ userId: 111, appName: "app1-modified" }, async () => {
			// Inside api1.run()
			const ctx1Inside = await api1.slothlet.context.get();
			expect(ctx1Inside.userId).toBe(111);
			expect(ctx1Inside.appName).toBe("app1-modified");

			// api2 context should be completely unaffected
			const ctx2Inside = await api2.slothlet.context.get();
			expect(ctx2Inside.userId).toBeUndefined();
			expect(ctx2Inside.appName).toBe("app2"); // Original value
		});

		// After api1.run() completes, both instances should have original contexts
		const ctx1After = await api1.slothlet.context.get();
		const ctx2After = await api2.slothlet.context.get();

		expect(ctx1After.userId).toBeUndefined();
		expect(ctx1After.appName).toBe("app1");
		expect(ctx2After.userId).toBeUndefined();
		expect(ctx2After.appName).toBe("app2");
	});

	it("should support concurrent .run() calls across multiple instances", async () => {
		api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "app1" }
		});

		api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "app2" }
		});

		// Run concurrent .run() calls on both instances
		const results = await Promise.all([
			api1.slothlet.context.run({ requestId: "req-instance1" }, async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return {
					requestId: await api1.slothlet.context.get("requestId"),
					appName: await api1.slothlet.context.get("appName")
				};
			}),
			api2.slothlet.context.run({ requestId: "req-instance2" }, async () => {
				await new Promise((resolve) => setTimeout(resolve, 5));
				return {
					requestId: await api2.slothlet.context.get("requestId"),
					appName: await api2.slothlet.context.get("appName")
				};
			})
		]);

		// Each instance should maintain its own isolated context
		expect(results[0].requestId).toBe("req-instance1");
		expect(results[0].appName).toBe("app1");
		expect(results[1].requestId).toBe("req-instance2");
		expect(results[1].appName).toBe("app2");
	});

	it("should support nested .run() across different instances", async () => {
		api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "app1" }
		});

		api2 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "app2" }
		});

		await api1.slothlet.context.run({ level: "api1-outer", userId: 100 }, async () => {
			const ctx1Outer = await api1.slothlet.context.get();
			expect(ctx1Outer.level).toBe("api1-outer");
			expect(ctx1Outer.userId).toBe(100);
			expect(ctx1Outer.appName).toBe("app1");

			// Nest api2.run() inside api1.run()
			await api2.slothlet.context.run({ level: "api2-inner", userId: 200 }, async () => {
				// CHILD INSTANCE ISOLATION: When calling api1.context.get() from inside api2.run(),
				// we're in a DIFFERENT instance's child context. Cross-instance calls return BASE context.
				// api1's child context exists in the context chain but is NOT returned for cross-instance calls.
				const ctx1Inner = await api1.slothlet.context.get();
				expect(ctx1Inner.level).toBeUndefined(); // Cross-instance = base context
				expect(ctx1Inner.userId).toBeUndefined(); // Cross-instance = base context
				expect(ctx1Inner.appName).toBe("app1"); // Base context value preserved

				// api2 should have its own isolated child context
				const ctx2Inner = await api2.slothlet.context.get();
				expect(ctx2Inner.level).toBe("api2-inner");
				expect(ctx2Inner.userId).toBe(200);
				expect(ctx2Inner.appName).toBe("app2");
			});

			// After api2.run() completes, api1 child context is still active
			const ctx1After = await api1.slothlet.context.get();
			expect(ctx1After.level).toBe("api1-outer");
			expect(ctx1After.userId).toBe(100);
		});
	});

	it("should support partial isolation mode (default - shared self)", async () => {
		api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { counter: 0 }
		});

		// Initialize state on the API

		// Verify initial state
		expect(await api1.isolationTest.isolationTest_getValue()).toBe("initial");
		expect(await api1.isolationTest.isolationTest_getCounter()).toBe(0);

		// Partial isolation: self is SHARED, so API mutations should persist
		await api1.slothlet.context.run({ counter: 100 }, async () => {
			// Verify context is isolated
			const ctx = await api1.slothlet.context.get();
			expect(ctx.counter).toBe(100);

			// Mutate API state via self (inside API functions)
			await api1.isolationTest.isolationTest_setValue("modified-in-run");
			await api1.isolationTest.isolationTest_increment();
			await api1.isolationTest.isolationTest_setFlag(true);
		});

		// In partial mode, API mutations SHOULD persist (shared self)
		expect(await api1.isolationTest.isolationTest_getValue()).toBe("modified-in-run");
		expect(await api1.isolationTest.isolationTest_getCounter()).toBe(1);
		expect(await api1.isolationTest.isolationTest_getFlag()).toBe(true);

		// But context should be restored (always isolated)
		const baseCtx = await api1.slothlet.context.get();
		expect(baseCtx.counter).toBe(0);
	});

	it("should support full isolation mode (cloned self)", async () => {
		api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { counter: 0 },
			scope: { isolation: "full" }
		});

		// Initialize state on the API

		// Verify initial state
		expect(await api1.isolationTest.isolationTest_getValue()).toBe("initial");
		expect(await api1.isolationTest.isolationTest_getCounter()).toBe(0);

		// Full isolation: self is CLONED, so API mutations should NOT persist
		await api1.slothlet.context.run({ counter: 100 }, async () => {
			// Verify context is isolated
			const ctx = await api1.slothlet.context.get();
			expect(ctx.counter).toBe(100);

			// Verify we can see initial state (cloned from base)
			expect(await api1.isolationTest.isolationTest_getValue()).toBe("initial");
			expect(await api1.isolationTest.isolationTest_getCounter()).toBe(0);

			// Mutate API state via self (inside API functions)
			await api1.isolationTest.isolationTest_setValue("modified-in-run");
			await api1.isolationTest.isolationTest_increment();
			await api1.isolationTest.isolationTest_setFlag(true);

			// Verify mutations are visible inside .run()
			expect(await api1.isolationTest.isolationTest_getValue()).toBe("modified-in-run");
			expect(await api1.isolationTest.isolationTest_getCounter()).toBe(1);
			expect(await api1.isolationTest.isolationTest_getFlag()).toBe(true);
		});

		// In full mode, API mutations should NOT persist (cloned self)
		expect(await api1.isolationTest.isolationTest_getValue()).toBe("initial");
		expect(await api1.isolationTest.isolationTest_getCounter()).toBe(0);
		expect(await api1.isolationTest.isolationTest_getFlag()).toBe(false);

		// Context should be restored
		const baseCtx = await api1.slothlet.context.get();
		expect(baseCtx.counter).toBe(0);
	});

	it("should support .scope() with isolation override", async () => {
		api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { counter: 0 },
			scope: { isolation: "partial" } // Default to partial
		});

		expect(await api1.isolationTest.isolationTest_getValue()).toBe("initial");

		// Override with full isolation for this specific .scope() call
		await api1.slothlet.context.scope({
			context: { counter: 200 },
			isolation: "full",
			fn: async () => {
				const ctx = await api1.slothlet.context.get();
				expect(ctx.counter).toBe(200);

				// Mutate API - should NOT persist due to full isolation override
				await api1.isolationTest.isolationTest_setValue("modified");
			}
		});

		// Mutation didn't persist (full isolation override)
		expect(await api1.isolationTest.isolationTest_getValue()).toBe("initial");

		// Now test partial works (default config)
		await api1.slothlet.context.run({ counter: 300 }, async () => {
			await api1.isolationTest.isolationTest_setValue("partial-modified");
		});

		// This mutation SHOULD persist (partial mode)
		expect(await api1.isolationTest.isolationTest_getValue()).toBe("partial-modified");

		// Context restored
		const baseCtx = await api1.slothlet.context.get();
		expect(baseCtx.counter).toBe(0);
	});

	it("should cleanup child instances after .run() completes", async () => {
		api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { counter: 0 },
			diagnostics: true // Enable diagnostics to access instance info
		});

		const baseInstanceID = api1.slothlet.instanceID;

		// Record initial instance count using diagnostics
		const initialDiag = await api1.slothlet.context.diagnostics();
		const initialCount = initialDiag.instancesMapSize;

		let childInstanceIDInsideRun = null;
		let runDiag = null;

		await api1.slothlet.context.run({ counter: 100 }, async () => {
			// Inside .run(), get diagnostics to see child instance
			runDiag = await api1.slothlet.context.diagnostics();

			// Child instance should exist
			expect(runDiag.instancesMapSize).toBe(initialCount + 1);

			// Find the child instance ID (should have __run_ pattern)
			const childIDs = runDiag.instancesMapKeys.filter((id) => id.startsWith(baseInstanceID + "__run_"));
			expect(childIDs.length).toBe(1);
			childInstanceIDInsideRun = childIDs[0];

			// Verify child instance is tracked
			expect(runDiag.instancesMapKeys).toContain(childInstanceIDInsideRun);
		});

		// After .run() completes, child instance should be cleaned up
		const afterDiag = await api1.slothlet.context.diagnostics();
		expect(afterDiag.instancesMapSize).toBe(initialCount);
		expect(afterDiag.instancesMapKeys).not.toContain(childInstanceIDInsideRun);

		// Base instance should still exist
		expect(afterDiag.instancesMapKeys).toContain(baseInstanceID);
	});

	it("should cleanup child instances even when .run() throws error", async () => {
		api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { counter: 0 },
			diagnostics: true
		});

		const baseInstanceID = api1.slothlet.instanceID;
		const initialDiag = await api1.slothlet.context.diagnostics();
		const initialCount = initialDiag.instancesMapSize;

		let childInstanceIDInsideRun = null;

		try {
			await api1.slothlet.context.run({ counter: 100 }, async () => {
				// Capture child instance ID
				const runDiag = await api1.slothlet.context.diagnostics();
				const childIDs = runDiag.instancesMapKeys.filter((id) => id.startsWith(baseInstanceID + "__run_"));
				childInstanceIDInsideRun = childIDs[0];

				// Verify child exists
				expect(runDiag.instancesMapKeys).toContain(childInstanceIDInsideRun);

				// Throw error
				throw new Error("Test error");
			});
			expect.fail("Should have thrown error");
		} catch (error) {
			expect(error.message).toContain("Test error");
		}

		// Even after error, child instance should be cleaned up
		const afterDiag = await api1.slothlet.context.diagnostics();
		expect(afterDiag.instancesMapSize).toBe(initialCount);
		expect(afterDiag.instancesMapKeys).not.toContain(childInstanceIDInsideRun);
	});

	it("should cleanup nested child instances correctly", async () => {
		api1 = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { counter: 0 },
			diagnostics: true
		});

		const baseInstanceID = api1.slothlet.instanceID;
		const initialDiag = await api1.slothlet.context.diagnostics();
		const initialCount = initialDiag.instancesMapSize;

		let outerChildID = null;
		let innerChildID = null;

		await api1.slothlet.context.run({ level: "outer" }, async () => {
			// Capture outer child ID
			const outerDiag = await api1.slothlet.context.diagnostics();
			const outerChildren = outerDiag.instancesMapKeys.filter((id) => id.startsWith(baseInstanceID + "__run_"));
			outerChildID = outerChildren[0];

			expect(outerDiag.instancesMapSize).toBe(initialCount + 1);

			await api1.slothlet.context.run({ level: "inner" }, async () => {
				// Capture inner child ID
				const innerDiag = await api1.slothlet.context.diagnostics();
				const innerChildren = innerDiag.instancesMapKeys.filter((id) => id.startsWith(baseInstanceID + "__run_") && id !== outerChildID);
				innerChildID = innerChildren[0];

				// Both children should exist
				expect(innerDiag.instancesMapSize).toBe(initialCount + 2);
				expect(innerDiag.instancesMapKeys).toContain(outerChildID);
				expect(innerDiag.instancesMapKeys).toContain(innerChildID);
			});

			// After inner .run(), inner child should be cleaned up
			const afterInnerDiag = await api1.slothlet.context.diagnostics();
			expect(afterInnerDiag.instancesMapKeys).not.toContain(innerChildID);
			expect(afterInnerDiag.instancesMapSize).toBe(initialCount + 1);
			expect(afterInnerDiag.instancesMapKeys).toContain(outerChildID);
		});

		// After outer .run(), both children should be cleaned up
		const finalDiag = await api1.slothlet.context.diagnostics();
		expect(finalDiag.instancesMapKeys).not.toContain(outerChildID);
		expect(finalDiag.instancesMapKeys).not.toContain(innerChildID);
		expect(finalDiag.instancesMapSize).toBe(initialCount);
	});
});

// Error handling tests - only need basic config
describe("Per-Request Context Error Handling", () => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should throw error when scope is disabled", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			scope: false
		});

		try {
			await api.slothlet.context.run({ userId: 123 }, async () => {});
			expect.fail("Should have thrown error");
		} catch (error) {
			expect(error.message).toContain("Per-request context");
		}
	});

	it("should throw error for invalid merge strategy", async () => {
		await expect(
			slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "eager",
				runtime: "async",
				scope: { merge: "invalid" }
			})
		).rejects.toThrow();
	});

	it("should throw error when .run() missing callback", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		try {
			await api.slothlet.context.run({ userId: 123 });
			expect.fail("Should have thrown error");
		} catch (error) {
			expect(error.message).toContain("Callback must be a function");
		}
	});

	it("should throw error when .scope() missing fn parameter", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		try {
			await api.slothlet.context.scope({
				context: { userId: 123 }
			});
			expect.fail("Should have thrown error");
		} catch (error) {
			expect(error.message).toContain("fn must be a function");
		}
	});

	it("should throw error when .scope() missing context", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async"
		});

		try {
			await api.slothlet.context.scope({
				fn: async () => {}
			});
			expect.fail("Should have thrown error");
		} catch (error) {
			expect(error.message).toContain("context must be an object");
		}
	});
});
