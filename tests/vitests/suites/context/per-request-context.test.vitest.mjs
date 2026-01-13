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
			scope: { merge: "shallow" }
		});

		let contextInside;
		await api.run({ userId: 123, requestId: "req-abc" }, async () => {
			contextInside = await api.requestContext.getContext();
		});

		expect(contextInside.userId).toBe(123);
		expect(contextInside.requestId).toBe("req-abc");
		expect(contextInside.appName).toBe("test");
		expect(contextInside.version).toBe("1.0");

		// Context outside should not have request data
		const contextOutside = await api.requestContext.getContext();
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
		await api.scope({
			context: { userId: 456, traceId: "trace-xyz" },
			fn: async () => {
				contextInside = await api.requestContext.getContext();
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
		await api.run(
			{
				userId: 999,
				config: {
					timeout: 10000,
					nested: { newProp: "added" }
				}
			},
			async () => {
				configValue = await api.requestContext.get("config");
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
		await api.run({ base: { level2: "new" } }, async () => {
			baseValue = await api.requestContext.get("base");
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
		await api.run(
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
		await api.scope({
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
			api.run({ requestId: "req-1" }, async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return await api.requestContext.get("requestId");
			}),
			api.run({ requestId: "req-2" }, async () => {
				await new Promise((resolve) => setTimeout(resolve, 5));
				return await api.requestContext.get("requestId");
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

		const result = await api.run({ level: 1, userId: 100 }, async () => {
			const level1Context = await api.requestContext.getContext();

			const innerResult = await api.run({ level: 2, spanId: "span-456" }, async () => {
				return await api.requestContext.getContext();
			});

			return { level1Context, level2Context: innerResult };
		});

		expect(result.level1Context.level).toBe(1);
		expect(result.level1Context.userId).toBe(100);
		expect(result.level2Context.level).toBe(2);
		expect(result.level2Context.spanId).toBe("span-456");
		expect(result.level2Context.userId).toBe(100); // Inherited from parent request
	});

	it("should maintain base context outside .run()", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST,
			context: { appName: "test", version: "1.0" }
		});

		await api.run({ userId: 123 }, async () => {
			const inside = await api.requestContext.getContext();
			expect(inside.userId).toBe(123);
		});

		const outside = await api.requestContext.getContext();
		expect(outside.userId).toBeUndefined();
		expect(outside.appName).toBe("test");
		expect(outside.version).toBe("1.0");
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
			await api.run({ userId: 123 }, async () => {});
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
			await api.run({ userId: 123 });
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
			await api.scope({
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
			await api.scope({
				fn: async () => {}
			});
			expect.fail("Should have thrown error");
		} catch (error) {
			expect(error.message).toContain("context must be an object");
		}
	});
});
