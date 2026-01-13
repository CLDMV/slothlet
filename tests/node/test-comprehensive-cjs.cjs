/**
 * @fileoverview Comprehensive CJS runner covering pure CJS, mixed CJS/ESM, context isolation,
 * and explicit default export handling for api_test_cjs assets. Internal file (not exported in
 * package.json).
 * @module @cldmv/slothlet.tests.node.test-comprehensive-cjs
 * @internal
 * @private
 *
 * @description
 * Verifies that CJS and mixed module trees load correctly through slothlet, that per-instance
 * context data is injected via the `context` option (not the deprecated `contextData` key), and
 * that live-binding scenarios keep contexts isolated across instances. This runner mirrors the
 * legacy vest flow while keeping everything in plain Node CJS for portability.
 *
 * @example
 * // Run directly with Node
 * node tests/node/test-comprehensive-cjs.cjs
 */

"use strict";

const assert = require("node:assert/strict");
const slothlet = require("@cldmv/slothlet");

const CJS_API_DIR = "../../api_tests/api_test_cjs";
const MIXED_API_DIR = "../../api_tests/api_test_mixed";
const NON_API_KEYS = new Set([
	"shutdown",
	"addApi",
	"removeApi",
	"reload",
	"reloadApi",
	"run",
	"scope",
	"instanceId",
	"context",
	"reference",
	"hooks",
	"describe"
]);

/**
 * @function getApiContext
 * @private
 * @param {object} api - Slothlet API instance.
 * @returns {Record<string, unknown>} - The bound context object.
 *
 * @description
 * Context is not exposed as api.context on bound APIs; it lives on the non-enumerable __ctx
 * object that slothlet attaches during binding. This helper retrieves it for assertions.
 *
 * @example
 * const ctx = getApiContext(api);
 */
function getApiContext(api) {
	const ctx = api?.__ctx?.context;
	assert.ok(ctx, "api.__ctx.context should be available on bound API instances");
	return ctx;
}

/**
 * @function assertContextFields
 * @private
 * @param {object} api - Slothlet API instance.
 * @param {Record<string, unknown>} expectedContext - Keys that must be present on api.context.
 * @returns {void}
 *
 * @description
 * Ensures api.context exists and contains the expected key/value pairs without requiring a
 * deep match against all runtime-provided metadata.
 *
 * @example
 * assertContextFields(api, { user: "alice" });
 */
function assertContextFields(api, expectedContext) {
	assert.ok(api, "API instance should exist");
	const ctx = getApiContext(api);

	for (const [key, value] of Object.entries(expectedContext)) {
		assert.strictEqual(ctx[key], value, `Expected context[${key}] to equal ${String(value)} for this instance`);
	}
}

/**
 * @function listApiMethods
 * @private
 * @param {object} api - Slothlet API instance.
 * @returns {string[]}
 *
 * @description
 * Returns the API keys excluding administrative helpers such as describe/shutdown to keep logs
 * readable when debugging manual runs.
 *
 * @example
 * listApiMethods(api);
 */
function listApiMethods(api) {
	return Object.keys(api).filter((key) => !NON_API_KEYS.has(key));
}

/**
 * @function createApiInstance
 * @private
 * @async
 * @param {string} dir - Directory to load the test API from.
 * @param {Record<string, unknown>} context - Context object passed into slothlet.
 * @returns {Promise<object>}
 *
 * @description
 * Creates a slothlet instance with the provided context, validates that the bound API exposes the
 * same context values, and returns the hydrated API.
 *
 * @example
 * const api = await createApiInstance(CJS_API_DIR, { user: "alice" });
 */
async function createApiInstance(dir, context) {
	const api = await slothlet({ dir, context });
	assertContextFields(api, context);
	return api;
}

/**
 * @function testCjsOnly
 * @private
 * @async
 * @returns {Promise<void>}
 *
 * @description
 * Validates two independent CJS-only APIs with distinct contexts, ensuring math operations work
 * and context values remain isolated between instances.
 *
 * @example
 * await testCjsOnly();
 */
async function testCjsOnly() {
	console.log("\n🧪 Testing CJS-only API...\n");

	let api1;
	let api2;

	try {
		api1 = await createApiInstance(CJS_API_DIR, { user: "alice" });
		api2 = await createApiInstance(CJS_API_DIR, { user: "bob" });

		console.log("API 1 methods:", listApiMethods(api1));
		console.log("API 2 methods:", listApiMethods(api2));

		assert.strictEqual(api1.rootMath.add(5, 3), 8, "api1 rootMath.add should add correctly");
		assert.strictEqual(api2.rootMath.add(10, 7), 17, "api2 rootMath.add should add correctly");

		assert.strictEqual(api1.math.multiply(4, 3), 12, "api1 math.multiply should multiply");
		assert.strictEqual(api2.math.multiply(6, 2), 12, "api2 math.multiply should multiply");

		assertContextFields(api1, { user: "alice" });
		assertContextFields(api2, { user: "bob" });

		const selfResult1 = await api1.advanced.selfObject.addViaSelf(10, 20);
		const selfResult2 = await api2.advanced.selfObject.addViaSelf(15, 25);
		assert.strictEqual(selfResult1, 30, "api1 self-reference should add correctly");
		assert.strictEqual(selfResult2, 40, "api2 self-reference should add correctly");
	} finally {
		if (api1?.shutdown) await api1.shutdown();
		if (api2?.shutdown) await api2.shutdown();
	}

	console.log("✅ CJS-only test completed successfully!\n");
}

/**
 * @function testMixed
 * @private
 * @async
 * @returns {Promise<void>}
 *
 * @description
 * Validates mixed ESM/CJS API loading, checks per-instance contexts, and exercises cross-module
 * interoperability.
 *
 * @example
 * await testMixed();
 */
async function testMixed() {
	console.log("\n🧪 Testing Mixed ESM/CJS API...\n");

	let api1;
	let api2;

	try {
		api1 = await createApiInstance(MIXED_API_DIR, { user: "charlie" });
		api2 = await createApiInstance(MIXED_API_DIR, { user: "diana" });

		console.log("Mixed API 1 methods:", listApiMethods(api1));
		console.log("Mixed API 2 methods:", listApiMethods(api2));

		assert.strictEqual(api1.mathEsm.add(3, 4), 7, "api1 ESM add should add correctly");
		assert.strictEqual(api2.mathEsm.subtract(10, 3), 7, "api2 ESM subtract should subtract");

		assert.strictEqual(await api1.mathCjs.multiply(5, 6), 30, "api1 CJS multiply should work");
		assert.strictEqual(await api2.mathCjs.divide(20, 4), 5, "api2 CJS divide should work");

		const interopResult1 = await api1.interop.interopEsm.testCrossCall(7, 8);
		const interopResult2 = await api2.interop.interopCjs.testCrossCall(9, 11);
		assert.strictEqual(interopResult1, 56, "api1 ESM->CJS cross-call should multiply inputs");
		assert.strictEqual(interopResult2, 20, "api2 CJS->ESM cross-call should sum inputs");

		assertContextFields(api1, { user: "charlie" });
		assertContextFields(api2, { user: "diana" });
	} finally {
		if (api1?.shutdown) await api1.shutdown();
		if (api2?.shutdown) await api2.shutdown();
	}

	console.log("✅ Mixed ESM/CJS test completed successfully!\n");
}

/**
 * @function testContextIsolation
 * @private
 * @async
 * @returns {Promise<void>}
 *
 * @description
 * Ensures contexts stay isolated between instances while exercising live-binding behavior through
 * the selfObject helper.
 *
 * @example
 * await testContextIsolation();
 */
async function testContextIsolation() {
	console.log("\n🧪 Testing Context Isolation Between Instances...\n");

	let api1;
	let api2;

	try {
		api1 = await createApiInstance(CJS_API_DIR, {
			user: "isolation_test_1",
			environment: "test1",
			secretKey: "secret123"
		});
		api2 = await createApiInstance(CJS_API_DIR, {
			user: "isolation_test_2",
			environment: "test2",
			secretKey: "secret456"
		});

		assert.strictEqual(await api1.advanced.selfObject.addViaSelf(1, 1), 2);
		assert.strictEqual(await api2.advanced.selfObject.addViaSelf(2, 2), 4);

		assertContextFields(api1, { user: "isolation_test_1", environment: "test1" });
		assertContextFields(api2, { user: "isolation_test_2", environment: "test2" });
	} finally {
		if (api1?.shutdown) await api1.shutdown();
		if (api2?.shutdown) await api2.shutdown();
	}

	console.log("✅ Context isolation test completed successfully!\n");
}

/**
 * @function testExplicitDefaults
 * @private
 * @async
 * @returns {Promise<void>}
 *
 * @description
 * Validates explicit default export handling for underscore and hyphenated folders while ensuring
 * context injection succeeds.
 *
 * @example
 * await testExplicitDefaults();
 */
async function testExplicitDefaults() {
	console.log("\n🧪 Testing Explicit CJS Default Exports...\n");

	let api;

	try {
		api = await createApiInstance(CJS_API_DIR, { user: "explicit_test" });
		console.log("Explicit defaults API methods:", listApiMethods(api));

		assert.ok(api.explicit_defaults, "explicit_defaults namespace should exist");
		assert.ok(api.explicit_defaults.explicitDefault, "explicit default should be flattened");

		assert.strictEqual(api.explicit_defaults.explicitDefault.multiply(3, 4), 12);
		assert.strictEqual(api.explicit_defaults.explicitDefault.divide(12, 3), 4);
		assert.strictEqual(api.explicit_defaults.explicitDefault.getCalculatorName(), "Explicit Default Calculator");

		assert.ok(api.explicitDefault, "hyphenated folder should sanitize to explicitDefault");
		assert.strictEqual(api.explicitDefault.multiply(5, 6), 30);
		assert.strictEqual(api.explicitDefault.divide(20, 4), 5);
		assert.strictEqual(api.explicitDefault.getCalculatorName(), "Hyphenated Default Calculator");

		assertContextFields(api, { user: "explicit_test" });
	} finally {
		if (api?.shutdown) await api.shutdown();
	}

	console.log("✅ Explicit CJS defaults test completed successfully!\n");
}

/**
 * @function runAllTests
 * @private
 * @async
 * @returns {Promise<void>}
 *
 * @description
 * Orchestrates the comprehensive CJS test suite, propagating any failure to the process exit code.
 *
 * @example
 * await runAllTests();
 */
async function runAllTests() {
	console.log("🚀 Starting Comprehensive CJS Live Bindings Test Suite\n");
	console.log("============================================================\n");

	let hasErrors = false;

	try {
		await testCjsOnly();
	} catch (error) {
		hasErrors = true;
		console.error("❌ testCjsOnly failed:", error.message);
	}

	try {
		await testMixed();
	} catch (error) {
		hasErrors = true;
		console.error("❌ testMixed failed:", error.message);
	}

	try {
		await testContextIsolation();
	} catch (error) {
		hasErrors = true;
		console.error("❌ testContextIsolation failed:", error.message);
	}

	try {
		await testExplicitDefaults();
	} catch (error) {
		hasErrors = true;
		console.error("❌ testExplicitDefaults failed:", error.message);
	}

	if (hasErrors) {
		console.log("\n❌ Some tests failed!\n");
		process.exit(1);
	}

	console.log("🎉 All tests completed!\n");
}

runAllTests().catch((error) => {
	console.error("❌ Test runner failed:", error.message);
	process.exit(1);
});
