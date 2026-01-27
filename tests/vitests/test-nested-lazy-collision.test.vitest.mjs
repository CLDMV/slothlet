/**
 * Test nested folder/file collisions in LAZY mode
 * This tests whether collision merge works for nested paths (not just root)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "../../index.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to materialize lazy proxies
async function materialize(obj, pathStr, ...args) {
	const parts = pathStr.split(".");
	let current = obj;
	for (const part of parts) {
		current = current[part];
		if (!current) return undefined;
	}
	if (typeof current === "function") {
		return await current(...args);
	}
	return current;
}

describe("Nested Lazy Collision Test", () => {
	it("should handle nested folder/file collision in LAZY mode", async () => {
		// Create nested collision structure:
		// parent/math.mjs (file with power, sqrt, modulo functions)
		// parent/math/math.mjs (folder with add, multiply, divide functions)
		
		const testDir = path.join(__dirname, "../../api_tests/api_test_collisions");
		
		const api = await slothlet({
			dir: testDir,
			mode: "lazy",
			collision: {
				initial: "merge"
			}
		});
		
		// Check that parent exists
		expect(api.parent).toBeDefined();
		console.log("[TEST] api.parent type:", typeof api.parent);
		console.log("[TEST] api.parent.__wrapper exists:", !!api.parent.__wrapper);
		
		// Check if parent.math exists
		expect(api.parent.math).toBeDefined();
		console.log("[TEST] api.parent.math type:", typeof api.parent.math);
		console.log("[TEST] api.parent.math.__wrapper exists:", !!api.parent.math.__wrapper);
		
		// Materialize and check structure
		const mathProxy = api.parent.math;
		console.log("[TEST] Attempting to call mathProxy.add");
		
		// Try to access file functions (should be from math.mjs file)
		const powerResult = await materialize(api, "parent.math.power", 2, 3);
		console.log("[TEST] powerResult:", powerResult);
		expect(powerResult).toBe(8);
		
		// Try to access folder functions (should be from math/ folder)
		const addResult = await materialize(api, "parent.math.add", 5, 7);
		console.log("[TEST] addResult:", addResult);
		expect(addResult).toBe(12);
		
		// Access slothlet instance from wrapper
		const slothletInstance = api.parent.math.__wrapper?.slothlet || api.parent.__wrapper?.slothlet;
		console.log("[TEST] slothletInstance exists:", !!slothletInstance);
		
		// Check what __childFilePaths has
		const mathWrapper = api.parent.math.__wrapper;
		console.log("[TEST] mathWrapper.__childFilePaths:", mathWrapper.__childFilePaths);
		console.log("[TEST] mathWrapper.__childFilePathsPreMaterialize:", mathWrapper.__childFilePathsPreMaterialize);
		
		console.log("\n=== INTERNAL HANDLER API ===");
		// Check if wrapper itself has metadata
		const wrapperSystemMetadata = slothletInstance.handlers.metadata.getSystemMetadata(mathWrapper);
		console.log("[TEST] mathWrapper system metadata:", JSON.stringify(wrapperSystemMetadata, null, 2));
		
		// Check metadata ON the proxy functions directly
		const powerFunc = api.parent.math.power;
		const addFunc = api.parent.math.add;
		const powerWrapperMeta = slothletInstance.handlers.metadata.getSystemMetadata(powerFunc.__wrapper || powerFunc);
		const addWrapperMeta = slothletInstance.handlers.metadata.getSystemMetadata(addFunc.__wrapper || addFunc);
		
		console.log("[TEST] power function wrapper metadata (handler):", JSON.stringify(powerWrapperMeta, null, 2));
		console.log("[TEST] add function wrapper metadata (handler):", JSON.stringify(addWrapperMeta, null, 2));
		
		console.log("\n=== __metadata PROPERTY ===");
		// Check __metadata property on functions
		const power__metadata = api.parent.math.power.__metadata;
		const add__metadata = api.parent.math.add.__metadata;
		
		console.log("[TEST] power.__metadata:", JSON.stringify(power__metadata, null, 2));
		console.log("[TEST] add.__metadata:", JSON.stringify(add__metadata, null, 2));
		
		console.log("\n=== PUBLIC API (api.slothlet.metadata.get) ===");
		// Debug: Check what get() receives
		console.log("[TEST] typeof api.parent:", typeof api.parent);
		console.log("[TEST] typeof api.parent.math:", typeof api.parent.math);
		console.log("[TEST] typeof api.parent.math.power:", typeof api.parent.math.power);
		console.log("[TEST] typeof api.parent.math.add:", typeof api.parent.math.add);
		
		// Check public API: api.slothlet.metadata.get(path) - MUST AWAIT!
		const powerPublicMeta = await api.slothlet.metadata.get("parent.math.power");
		const addPublicMeta = await api.slothlet.metadata.get("parent.math.add");
		
		console.log("[TEST] api.slothlet.metadata.get('parent.math.power'):", JSON.stringify(powerPublicMeta, null, 2));
		console.log("[TEST] api.slothlet.metadata.get('parent.math.add'):", JSON.stringify(addPublicMeta, null, 2));
		
		// Verify functions work
		expect(powerResult).toBe(8);
		expect(addResult).toBe(12);
		
		// Verify all three access methods return correct filePaths
		expect(powerWrapperMeta.filePath).toContain("parent");
		expect(powerWrapperMeta.filePath).toContain("math.mjs");
		expect(powerWrapperMeta.filePath).not.toContain("math\\math");
		
		expect(power__metadata?.filePath).toContain("parent");
		expect(power__metadata?.filePath).toContain("math.mjs");
		
		expect(powerPublicMeta?.filePath).toContain("parent");
		expect(powerPublicMeta?.filePath).toContain("math.mjs");
		
		expect(addWrapperMeta.filePath).toContain("parent");
		expect(addWrapperMeta.filePath).toContain("math\\math");
		
		expect(add__metadata?.filePath).toContain("parent");
		expect(add__metadata?.filePath).toContain("math\\math");
		
		expect(addPublicMeta?.filePath).toContain("parent");
		expect(addPublicMeta?.filePath).toContain("math\\math");
	});
});
