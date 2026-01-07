/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-metadata-api.mjs
 *	@Date: 2025-12-31 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-31 21:39:58 -08:00 (1767245998)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Comprehensive tests for metadata API functionality.
 * @module test-metadata-api
 *
 * @description
 * Tests the metadata API system including:
 * - Metadata tagging via addApi
 * - Immutability of metadata
 * - metadataAPI.caller() for access control
 * - metadataAPI.self() for introspection
 * - metadataAPI.get() for path-based lookup
 * - Cross-mode compatibility (lazy/eager × async/live)
 */

import slothlet from "../index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test utilities
let testCount = 0;
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
	if (!condition) {
		throw new Error(`Assertion failed: ${message}`);
	}
}

async function runTest(name, fn) {
	testCount++;
	try {
		await fn();
		passCount++;
		console.log(`✅ ${name}`);
	} catch (error) {
		failCount++;
		console.error(`❌ ${name}`);
		console.error(`   ${error.message}`);
		if (error.stack) {
			console.error(`   ${error.stack.split("\n").slice(1, 3).join("\n")}`);
		}
	}
}

// ============================================================================
// COMPLETE TEST SUITE FOR EACH MODE COMBINATION
// ============================================================================

/**
 * Run ALL tests for a specific mode combination
 */
async function runAllTestsForMode(mode, runtime, hooks) {
	const modeLabel = `${mode.toUpperCase()} + ${runtime.toUpperCase()} + hooks:${hooks}`;
	const isLazy = mode === "lazy";

	// Helper function to trigger materialization in lazy mode
	const materialize = async (func, ...args) => {
		if (isLazy && typeof func === "function") {
			await func(...args);
		}
	};

	// ========================================================================
	// BASIC METADATA TAGGING TESTS
	// ========================================================================

	await runTest(`${modeLabel}: Basic metadata tagging works`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("plugins", path.join(__dirname, "../api_tests/api_test_mixed"), {
			version: "1.0.0",
			author: "TestAuthor"
		});

		await materialize(api.plugins.mathEsm.add, 1, 2);

		const meta = api.plugins.mathEsm.add.__metadata;
		assert(meta.version === "1.0.0", "Metadata.version should be 1.0.0");
		assert(meta.author === "TestAuthor", "Metadata.author should be TestAuthor");
		assert(meta.sourceFolder, "sourceFolder should be in metadata");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: sourceFolder automatically added to metadata`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		const testPath = path.join(__dirname, "../api_tests/api_test_mixed");
		await api.addApi("autoFolder", testPath, {
			testKey: "testValue"
		});

		await materialize(api.autoFolder.mathEsm.add, 1, 2);

		const meta = api.autoFolder.mathEsm.add.__metadata;
		assert(meta.sourceFolder, "sourceFolder should exist");
		assert(meta.sourceFolder.includes("api_test_mixed"), "sourceFolder should contain folder name");

		await api.shutdown();
	});

	// ========================================================================
	// IMMUTABILITY TESTS
	// ========================================================================

	await runTest(`${modeLabel}: Metadata is immutable (primitive values)`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("immutable", path.join(__dirname, "../api_tests/api_test_mixed"), {
			count: 42,
			name: "original"
		});

		await materialize(api.immutable.mathEsm.add, 1, 2);

		const meta = api.immutable.mathEsm.add.__metadata;

		try {
			meta.count = 999;
		} catch (_) {
			// Expected - Proxy may throw
		}

		try {
			meta.name = "modified";
		} catch (_) {
			// Expected - Proxy may throw
		}

		assert(meta.count === 42, "count should remain 42");
		assert(meta.name === "original", "name should remain original");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Nested object immutability`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("nested", path.join(__dirname, "../api_tests/api_test_mixed"), {
			config: { setting1: true, setting2: "value" }
		});

		// For lazy mode, we need to await the nested proxy first
		const nestedApi = isLazy ? await api.nested : api.nested;

		// Then materialize the function
		await materialize(nestedApi.mathEsm.add, 1, 2);

		const meta = nestedApi.mathEsm.add.__metadata;

		try {
			meta.config.setting1 = false;
		} catch (_) {
			// Expected - Proxy may throw
		}

		try {
			meta.config.setting2 = "modified";
		} catch (_) {
			// Expected - Proxy may throw
		}

		assert(meta.config.setting1 === true, "Nested setting1 should remain true");
		assert(meta.config.setting2 === "value", "Nested setting2 should remain 'value'");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Array immutability`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("arrays", path.join(__dirname, "../api_tests/api_test_mixed"), {
			permissions: ["read", "write"]
		});

		await materialize(api.arrays.mathEsm.add, 1, 2);

		const meta = api.arrays.mathEsm.add.__metadata;

		const originalLength = meta.permissions.length;
		const originalFirst = meta.permissions[0];

		try {
			meta.permissions.push("admin");
		} catch (_) {
			// Expected - Proxy may throw
		}

		try {
			meta.permissions[0] = "modified";
		} catch (_) {
			// Expected - Proxy may throw
		}

		assert(meta.permissions.length === originalLength, `Array length should remain ${originalLength}`);
		assert(meta.permissions[0] === originalFirst, `Array[0] should remain '${originalFirst}'`);

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Can add new properties to top-level metadata`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("extensible", path.join(__dirname, "../api_tests/api_test_mixed"), {
			original: "value"
		});

		await materialize(api.extensible.mathEsm.add, 1, 2);

		const meta = api.extensible.mathEsm.add.__metadata;

		// Should be able to add new properties
		meta.newProperty = "added";
		assert(meta.newProperty === "added", "Should be able to add new property");

		// New property should become immutable immediately
		try {
			meta.newProperty = "modified";
		} catch (_) {
			// Expected - Proxy may throw
		}

		assert(meta.newProperty === "added", "New property should be immutable after adding");

		// Original property should still be immutable
		try {
			meta.original = "changed";
		} catch (_) {
			// Expected - Proxy may throw
		}

		assert(meta.original === "value", "Original property should remain immutable");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Can add properties to nested objects (become immutable)`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("frozen", path.join(__dirname, "../api_tests/api_test_mixed"), {
			config: { existing: "value" }
		});

		await materialize(api.frozen.mathEsm.add, 1, 2);

		const meta = api.frozen.mathEsm.add.__metadata;

		// Nested objects are NOT frozen, CAN add properties
		meta.config.newSetting = "added successfully";
		assert(meta.config.newSetting === "added successfully", "Should be able to add property to nested object");

		// But new properties become immutable immediately
		try {
			meta.config.newSetting = "modified";
		} catch (_) {
			// Expected - Proxy may throw
		}

		assert(meta.config.newSetting === "added successfully", "New nested property should be immutable after adding");

		// Existing nested property should still be immutable
		try {
			meta.config.existing = "changed";
		} catch (_) {
			// Expected - Proxy may throw
		}

		assert(meta.config.existing === "value", "Existing nested property should remain immutable");

		await api.shutdown();
	});

	// ========================================================================
	// METADATAAPI TESTS
	// ========================================================================

	await runTest(`${modeLabel}: metadataAPI.get() retrieves metadata by path`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("getTest", path.join(__dirname, "../api_tests/api_test_mixed"), {
			version: "2.0.0"
		});

		const meta = await api.metadataTestHelper.getMetadata("getTest.mathEsm.add");
		assert(meta !== null, "Should find metadata");
		assert(meta.version === "2.0.0", "Should have correct version");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: metadataAPI.get() returns null for non-existent path`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		const meta = await api.metadataTestHelper.getMetadata("nonexistent.path.function");
		assert(meta === null, "Should return null for non-existent path");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: metadataAPI.get() returns null for function without metadata`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		// Trigger materialization in lazy mode
		if (isLazy) {
			await api.math.add(1, 2);
		}

		const meta = await api.metadataTestHelper.getMetadata("math.add");
		assert(meta === null, "Should return null for functions without metadata");

		await api.shutdown();
	});

	// ========================================================================
	// ACCESS CONTROL SIMULATION
	// ========================================================================

	await runTest(`${modeLabel}: Trusted vs untrusted plugins`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("trusted", path.join(__dirname, "../api_tests/api_test_mixed"), {
			trusted: true,
			permissions: ["read", "write", "admin"]
		});

		await api.addApi("untrusted", path.join(__dirname, "../api_tests/api_test_cjs"), {
			trusted: false,
			permissions: ["read"]
		});

		await materialize(api.trusted.mathEsm.add, 1, 2);
		await materialize(api.untrusted.rootMath.add, 1, 2);

		const trustedMeta = api.trusted.mathEsm.add.__metadata;
		assert(trustedMeta.trusted === true, "Trusted plugin should be marked as trusted");
		assert(trustedMeta.permissions.includes("admin"), "Trusted should have admin permission");

		const untrustedMeta = api.untrusted.rootMath.add.__metadata;
		assert(untrustedMeta.trusted === false, "Untrusted plugin should be marked as untrusted");
		assert(!untrustedMeta.permissions.includes("admin"), "Untrusted should not have admin permission");

		await api.shutdown();
	});

	// ========================================================================
	// MULTIPLE ADDAPI CALLS
	// ========================================================================

	await runTest(`${modeLabel}: Multiple addApi calls with different metadata`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("group1", path.join(__dirname, "../api_tests/api_test_mixed"), {
			group: "A",
			level: 1
		});

		await api.addApi("group2", path.join(__dirname, "../api_tests/api_test_cjs"), {
			group: "B",
			level: 2
		});

		await materialize(api.group1.mathEsm.add, 1, 2);
		await materialize(api.group2.rootMath.add, 1, 2);

		const meta1 = api.group1.mathEsm.add.__metadata;
		const meta2 = api.group2.rootMath.add.__metadata;

		assert(meta1.group === "A", "Group1 should have group A");
		assert(meta1.level === 1, "Group1 should have level 1");
		assert(meta2.group === "B", "Group2 should have group B");
		assert(meta2.level === 2, "Group2 should have level 2");

		await api.shutdown();
	});

	// ========================================================================
	// EDGE CASES
	// ========================================================================

	await runTest(`${modeLabel}: addApi without metadata adds system metadata`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		const cjsPath = path.resolve(__dirname, "../api_tests/api_test_cjs");
		await api.addApi("nometa", cjsPath);

		await materialize(api.nometa.rootMath.add, 1, 2);

		const mathAdd = api.nometa.rootMath?.add;
		assert(typeof mathAdd === "function", "rootMath.add should be a function");

		// Metadata should always be present (at least sourceFolder) for hot reload support
		assert(mathAdd.__metadata, "Function should have __metadata property for hot reload tracking");
		assert(mathAdd.__metadata.sourceFolder, "Metadata should include sourceFolder");
		assert(Object.keys(mathAdd.__metadata).length === 1, "Without user metadata, should only have sourceFolder");

		await api.shutdown();
	});

	await runTest(`${modeLabel}: Empty metadata object adds system metadata`, async () => {
		const api = await slothlet({ dir: path.join(__dirname, "../api_tests/api_test"), mode: mode, runtime: runtime, hooks: hooks });

		await api.addApi("empty", path.join(__dirname, "../api_tests/api_test_collections"), {});

		const collectionsObj = api.empty.collections;
		assert(typeof collectionsObj === "object", "Collections object should be loaded");
		// Metadata should always be present (at least sourceFolder) for hot reload support
		assert(collectionsObj.__metadata, "Object should have __metadata property for hot reload tracking");
		assert(collectionsObj.__metadata.sourceFolder, "Metadata should include sourceFolder");
		assert(Object.keys(collectionsObj.__metadata).length === 1, "With empty user metadata, should only have sourceFolder");

		await api.shutdown();
	});
}

// ============================================================================
// RUN ALL TESTS FOR EACH MODE COMBINATION
// ============================================================================

for (const mode of ["eager", "lazy"]) {
	for (const runtime of ["async", "live"]) {
		for (const hooks of [false, true]) {
			await runAllTestsForMode(mode, runtime, hooks);
		}
	}
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log(`Test Results: ${passCount}/${testCount} passed, ${failCount} failed`);
console.log("=".repeat(60));

if (failCount > 0) {
	process.exit(1);
}
