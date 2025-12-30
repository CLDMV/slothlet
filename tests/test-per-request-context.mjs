/**
 * @fileoverview Tests for per-request context feature (.run() and .scope() methods)
 * @module @cldmv/slothlet.tests.test-per-request-context
 * @memberof module:@cldmv/slothlet
 * @internal
 * @private
 *
 * @description
 * Tests the per-request context feature that allows consumers to modify context
 * on a per-request basis using .run() and .scope() methods.
 *
 * Tests cover:
 * - .run() and .scope() methods with shallow/deep merge strategies
 * - Argument passing through both methods
 * - Concurrent request isolation
 * - Nested context calls
 * - Cross-mode compatibility (async/live runtimes)
 * - Error cases (disabled scope, invalid merge strategy)
 *
 * @example
 * // Run tests
 * node tests/test-per-request-context.mjs
 */

import slothlet from "../index.mjs";

let failedTests = 0;
let passedTests = 0;

async function runTest(testName, testFn) {
	try {
		await testFn();
		console.log(`✓ ${testName}`);
		passedTests++;
	} catch (error) {
		console.error(`✗ ${testName}`);
		console.error(`  ${error.message}`);
		if (error.stack) {
			console.error(`  ${error.stack.split("\n").slice(1, 3).join("\n")}`);
		}
		failedTests++;
	}
}

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

console.log("=== Per-Request Context Tests ===\n");

// ============================================================================
// MATRIX TESTS: All combinations of lazy/eager × async/live × shallow/deep
// ============================================================================

await runTest("MATRIX: .run() works across all mode/runtime/merge combinations", async () => {
	const combinations = [
		{ mode: "lazy", runtime: "async", merge: "shallow" },
		{ mode: "lazy", runtime: "async", merge: "deep" },
		{ mode: "lazy", runtime: "live", merge: "shallow" },
		{ mode: "lazy", runtime: "live", merge: "deep" },
		{ mode: "eager", runtime: "async", merge: "shallow" },
		{ mode: "eager", runtime: "async", merge: "deep" },
		{ mode: "eager", runtime: "live", merge: "shallow" },
		{ mode: "eager", runtime: "live", merge: "deep" }
	];

	for (const config of combinations) {
		const api = await slothlet({
			dir: "./api_tests/api_test",
			context: { appName: "test", version: "1.0" },
			...config,
			scope: { merge: config.merge }
		});

		let contextInside;
		await api.run({ userId: 123, requestId: "req-abc" }, async () => {
			contextInside = await api.requestContext.getContext();
		});

		assert(contextInside.userId === 123, `userId should be 123 [mode=${config.mode}, runtime=${config.runtime}, merge=${config.merge}]`);
		assert(
			contextInside.requestId === "req-abc",
			`requestId should be req-abc [mode=${config.mode}, runtime=${config.runtime}, merge=${config.merge}]`
		);
		assert(
			contextInside.appName === "test",
			`appName should be test [mode=${config.mode}, runtime=${config.runtime}, merge=${config.merge}]`
		);
		assert(
			contextInside.version === "1.0",
			`version should be 1.0 [mode=${config.mode}, runtime=${config.runtime}, merge=${config.merge}]`
		);

		// Context outside should not have request data
		const contextOutside = await api.requestContext.getContext();
		assert(
			contextOutside.userId === undefined,
			`userId should be undefined outside [mode=${config.mode}, runtime=${config.runtime}, merge=${config.merge}]`
		);
		assert(
			contextOutside.requestId === undefined,
			`requestId should be undefined outside [mode=${config.mode}, runtime=${config.runtime}, merge=${config.merge}]`
		);
		assert(
			contextOutside.appName === "test",
			`appName should still be test outside [mode=${config.mode}, runtime=${config.runtime}, merge=${config.merge}]`
		);

		await api.shutdown();
	}
});

await runTest("MATRIX: .scope() works across all mode/runtime/merge combinations", async () => {
	const combinations = [
		{ mode: "lazy", runtime: "async", merge: "shallow" },
		{ mode: "lazy", runtime: "async", merge: "deep" },
		{ mode: "lazy", runtime: "live", merge: "shallow" },
		{ mode: "lazy", runtime: "live", merge: "deep" },
		{ mode: "eager", runtime: "async", merge: "shallow" },
		{ mode: "eager", runtime: "async", merge: "deep" },
		{ mode: "eager", runtime: "live", merge: "shallow" },
		{ mode: "eager", runtime: "live", merge: "deep" }
	];

	for (const config of combinations) {
		const api = await slothlet({
			dir: "./api_tests/api_test",
			context: { appName: "test" },
			...config,
			scope: { merge: config.merge }
		});

		let contextInside;
		await api.scope({
			context: { userId: 456, traceId: "trace-xyz" },
			fn: async () => {
				contextInside = await api.requestContext.getContext();
			}
		});

		assert(contextInside.userId === 456, `userId should be 456 [mode=${config.mode}, runtime=${config.runtime}, merge=${config.merge}]`);
		assert(
			contextInside.traceId === "trace-xyz",
			`traceId should be trace-xyz [mode=${config.mode}, runtime=${config.runtime}, merge=${config.merge}]`
		);
		assert(
			contextInside.appName === "test",
			`appName should be test [mode=${config.mode}, runtime=${config.runtime}, merge=${config.merge}]`
		);

		await api.shutdown();
	}
});

await runTest("MATRIX: Deep merge preserves nested properties across all modes", async () => {
	const combinations = [
		{ mode: "lazy", runtime: "async" },
		{ mode: "lazy", runtime: "live" },
		{ mode: "eager", runtime: "async" },
		{ mode: "eager", runtime: "live" }
	];

	for (const config of combinations) {
		const api = await slothlet({
			dir: "./api_tests/api_test",
			context: {
				appName: "test",
				config: {
					timeout: 5000,
					retries: 3,
					nested: {
						flag: true
					}
				}
			},
			...config,
			scope: { merge: "deep" }
		});

		let configValue;
		await api.run(
			{
				userId: 999,
				config: {
					timeout: 10000,
					nested: {
						newProp: "added"
					}
				}
			},
			async () => {
				configValue = await api.requestContext.get("config");
			}
		);

		assert(configValue !== undefined, `config should exist [mode=${config.mode}, runtime=${config.runtime}]`);
		assert(configValue.timeout === 10000, `timeout should be overridden to 10000 [mode=${config.mode}, runtime=${config.runtime}]`);
		assert(configValue.retries === 3, `retries should be preserved as 3 [mode=${config.mode}, runtime=${config.runtime}]`);
		assert(configValue.nested !== undefined, `nested should exist [mode=${config.mode}, runtime=${config.runtime}]`);
		assert(configValue.nested.flag === true, `nested.flag should be preserved as true [mode=${config.mode}, runtime=${config.runtime}]`);
		assert(configValue.nested.newProp === "added", `nested.newProp should be added [mode=${config.mode}, runtime=${config.runtime}]`);

		await api.shutdown();
	}
});

// ============================================================================
// DEFAULT BEHAVIOR TESTS
// ============================================================================

await runTest("DEFAULT: Shallow merge when scope not specified", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		context: {
			config: { timeout: 5000, retries: 3 }
		},
		runtime: "async"
		// No scope config - should default to shallow
	});

	let configValue;
	await api.run(
		{
			config: { timeout: 10000 }
		},
		async () => {
			configValue = await api.requestContext.get("config");
		}
	);

	// Shallow merge replaces entire config object
	assert(configValue.timeout === 10000, "timeout should be overridden");
	assert(configValue.retries === undefined, "retries should NOT be preserved with shallow merge (entire object replaced)");

	await api.shutdown();
});

await runTest("DEFAULT: Shallow merge when scope.merge not specified", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		context: {
			config: { timeout: 5000, retries: 3 }
		},
		runtime: "async",
		scope: {} // Empty scope config should default to shallow
	});

	let configValue;
	await api.run(
		{
			config: { timeout: 10000 }
		},
		async () => {
			configValue = await api.requestContext.get("config");
		}
	);

	// Shallow merge replaces entire config object
	assert(configValue.timeout === 10000, "timeout should be overridden");
	assert(configValue.retries === undefined, "retries should NOT be preserved with shallow merge");

	await api.shutdown();
});

// ============================================================================
// MERGE STRATEGY TESTS
// ============================================================================

await runTest("MERGE: Shallow merge replaces entire nested objects", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		context: {
			settings: { a: 1, b: 2, nested: { x: 10, y: 20 } }
		},
		runtime: "async",
		scope: { merge: "shallow" }
	});

	let settingsValue;
	await api.run(
		{
			settings: { b: 99, nested: { z: 30 } }
		},
		() => {
			settingsValue = api.requestContext.get("settings");
		}
	);

	assert(settingsValue.a === undefined, "a should be lost (shallow merge)");
	assert(settingsValue.b === 99, "b should be overridden");
	assert(settingsValue.nested.x === undefined, "nested.x should be lost (shallow merge)");
	assert(settingsValue.nested.y === undefined, "nested.y should be lost (shallow merge)");
	assert(settingsValue.nested.z === 30, "nested.z should exist");

	await api.shutdown();
});

await runTest("MERGE: Deep merge preserves all nested properties", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		context: {
			settings: { a: 1, b: 2, nested: { x: 10, y: 20 } }
		},
		runtime: "async",
		scope: { merge: "deep" }
	});

	let settingsValue;
	await api.run(
		{
			settings: { b: 99, nested: { z: 30 } }
		},
		async () => {
			settingsValue = await api.requestContext.get("settings");
		}
	);

	assert(settingsValue.a === 1, "a should be preserved (deep merge)");
	assert(settingsValue.b === 99, "b should be overridden");
	assert(settingsValue.nested.x === 10, "nested.x should be preserved (deep merge)");
	assert(settingsValue.nested.y === 20, "nested.y should be preserved (deep merge)");
	assert(settingsValue.nested.z === 30, "nested.z should be added");

	await api.shutdown();
});

// ============================================================================
// ARGUMENT PASSING TESTS
// ============================================================================

await runTest("ARGS: .run() passes additional arguments correctly", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		runtime: "async",
		scope: { merge: "shallow" }
	});

	const result = await api.run(
		{ requestId: "test" },
		async (a, b, c) => {
			return { a, b, c, requestId: await api.requestContext.get("requestId") };
		},
		"arg1",
		"arg2",
		"arg3"
	);

	assert(result.a === "arg1", "a should be arg1");
	assert(result.b === "arg2", "b should be arg2");
	assert(result.c === "arg3", "c should be arg3");
	assert(result.requestId === "test", "requestId should be test");

	await api.shutdown();
});

await runTest("ARGS: .scope() passes args array correctly", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		runtime: "async",
		scope: { merge: "shallow" }
	});

	const result = await api.scope({
		context: { requestId: "test" },
		fn: async (x, y) => {
			return { sum: x + y, requestId: await api.requestContext.get("requestId") };
		},
		args: [10, 20]
	});

	assert(result.sum === 30, "sum should be 30");
	assert(result.requestId === "test", "requestId should be test");

	await api.shutdown();
});

// ============================================================================
// ISOLATION & CONCURRENCY TESTS
// ============================================================================

await runTest("ISOLATION: Concurrent requests maintain separate contexts", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		runtime: "async",
		scope: { merge: "shallow" }
	});

	const request1Promise = api.run({ userId: 1, requestId: "req-1" }, async () => {
		return await api.requestContext.getContextAfterDelay(50);
	});

	const request2Promise = api.run({ userId: 2, requestId: "req-2" }, async () => {
		return await api.requestContext.getContextAfterDelay(30);
	});

	const request3Promise = api.run({ userId: 3, requestId: "req-3" }, async () => {
		return await api.requestContext.getContextAfterDelay(10);
	});

	const [result1, result2, result3] = await Promise.all([request1Promise, request2Promise, request3Promise]);

	assert(result1.userId === 1 && result1.requestId === "req-1", "Request 1 context should be isolated");
	assert(result2.userId === 2 && result2.requestId === "req-2", "Request 2 context should be isolated");
	assert(result3.userId === 3 && result3.requestId === "req-3", "Request 3 context should be isolated");

	await api.shutdown();
});

await runTest("ISOLATION: Nested .run() calls inherit parent context", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		context: { appId: "main-app" },
		runtime: "async",
		scope: { merge: "shallow" }
	});

	const result = await api.run({ level: 1, userId: 100 }, async () => {
		const level1Context = await api.requestContext.getContext();

		const innerResult = await api.run({ level: 2, spanId: "span-456" }, async () => {
			return await api.requestContext.getContext();
		});

		return { level1Context, level2Context: innerResult };
	});

	assert(result.level1Context.level === 1, "Level 1 should be 1");
	assert(result.level1Context.userId === 100, "userId should be 100");
	assert(result.level1Context.appId === "main-app", "appId should be main-app");

	assert(result.level2Context.level === 2, "Level 2 should be 2");
	assert(result.level2Context.spanId === "span-456", "spanId should be span-456");
	assert(result.level2Context.appId === "main-app", "appId should still be main-app (from instance)");
	assert(result.level2Context.userId === 100, "userId should be 100 (inherited from parent request)");

	await api.shutdown();
});

await runTest("ISOLATION: Context outside .run() has no request data", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		context: { appName: "test" },
		runtime: "async",
		scope: { merge: "shallow" }
	});

	await api.run({ userId: 999, secret: "hidden" }, () => {
		// Inside .run()
	});

	// Outside .run() - request data should not leak
	const contextOutside = await api.requestContext.getContext();
	assert(contextOutside.userId === undefined, "userId should not leak outside");
	assert(contextOutside.secret === undefined, "secret should not leak outside");
	assert(contextOutside.appName === "test", "instance context should still be accessible");

	await api.shutdown();
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

await runTest("ERROR HANDLING: Scope disabled throws error", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		runtime: "async",
		scope: false
	});

	let errorCaught = false;
	try {
		await api.run({ userId: 1 }, () => {});
	} catch (error) {
		errorCaught = true;
		assert(error.message.includes("disabled"), "Error should mention scope is disabled");
	}

	assert(errorCaught, "Should throw error when scope is disabled");

	await api.shutdown();
});

await runTest("ERROR HANDLING: Invalid merge strategy throws error", async () => {
	let errorCaught = false;
	try {
		await slothlet({
			dir: "./api_tests/api_test",
			scope: { merge: "invalid" }
		});
	} catch (error) {
		errorCaught = true;
		assert(error.message.includes("Invalid scope.merge"), "Error should mention invalid merge value");
	}

	assert(errorCaught, "Should throw error for invalid merge strategy");
});

await runTest("ERROR HANDLING: .run() requires callback function", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		runtime: "async"
	});

	let errorCaught = false;
	try {
		await api.run({ userId: 1 }, "not a function");
	} catch (error) {
		errorCaught = true;
		assert(error.message.includes("Callback must be a function"), "Error should mention callback requirement");
	}

	assert(errorCaught, "Should throw error when callback is not a function");

	await api.shutdown();
});

await runTest("ERROR HANDLING: .scope() requires function fn parameter", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		runtime: "async"
	});

	let errorCaught = false;
	try {
		await api.scope({
			context: { userId: 1 },
			fn: "not a function"
		});
	} catch (error) {
		errorCaught = true;
		assert(error.message.includes("fn must be a function"), "Error should mention fn requirement");
	}

	assert(errorCaught, "Should throw error when fn is not a function");

	await api.shutdown();
});

await runTest("ERROR HANDLING: .scope() requires context object", async () => {
	const api = await slothlet({
		dir: "./api_tests/api_test",
		runtime: "async"
	});

	let errorCaught = false;
	try {
		await api.scope({
			context: null,
			fn: () => {}
		});
	} catch (error) {
		errorCaught = true;
		assert(error.message.includes("context must be an object"), "Error should mention context requirement");
	}

	assert(errorCaught, "Should throw error when context is not an object");

	await api.shutdown();
});

console.log(`\n${"=".repeat(50)}`);
console.log(`Tests passed: ${passedTests}`);
console.log(`Tests failed: ${failedTests}`);
console.log(`${"=".repeat(50)}\n`);

if (failedTests > 0) {
	console.error(`❌ ${failedTests} test(s) failed`);
	process.exit(1);
}

console.log("✅ All per-request context tests passed!");
process.exit(0);
