/**
 * Test that metadata stays correct after addApi replaces impl
 * This demonstrates the architectural issue where metadata stored on wrapper becomes stale
 */

import { describe, it, expect } from "vitest";
import slothlet from "../../index.mjs";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync, writeFileSync, rmSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Metadata Staleness After addApi", () => {
	const testDir = path.join(__dirname, "../../tmp/test-metadata-staleness");

	it("should have correct metadata after addApi replaces impl", async () => {
		// Setup: Create initial module
		mkdirSync(path.join(testDir, "v1"), { recursive: true });
		writeFileSync(
			path.join(testDir, "v1", "calculator.mjs"),
			`
export function add(a, b) {
	return a + b;
}
		`.trim()
		);

		// Load initial version
		const api = await slothlet({
			dir: testDir,
			mode: "lazy"
		});

		// Call function to materialize
		const result1 = await api.v1.calculator.add(2, 3);
		expect(result1).toBe(5);

		// Check initial metadata
		const meta1 = api.v1.calculator.add.__metadata;
		console.log("\n=== INITIAL METADATA ===");
		console.log("filePath:", meta1.filePath);
		expect(meta1.filePath).toContain("v1");
		expect(meta1.filePath).toContain("calculator.mjs");

		// Create v2 module with DIFFERENT content
		mkdirSync(path.join(testDir, "v2"), { recursive: true });
		writeFileSync(
			path.join(testDir, "v2", "calculator.mjs"),
			`
export function add(a, b) {
	return a + b + 1000; // Different implementation
}
		`.trim()
		);

		// Use addApi to replace the impl - point to v2 directory
		await api.slothlet.api.add("v1", path.join(testDir, "v2"));

		// Call function to materialize new impl
		const result2 = await api.v1.calculator.add(2, 3);
		console.log("\n=== AFTER ADDAPI ===");
		console.log("result2:", result2);

		// Check metadata after addApi
		const meta2 = api.v1.calculator.add.__metadata;
		console.log("filePath:", meta2.filePath);

		// Verify metadata was updated to point to v2
		console.log("\n=== VERIFICATION ===");
		console.log("Expected filePath to contain: v2");
		console.log("Actual filePath:", meta2.filePath);
		console.log("Contains v2?", meta2.filePath.includes("v2"));
		console.log("Contains v1?", meta2.filePath.includes("v1"));

		// Metadata should now point to v2/calculator.mjs
		expect(meta2.filePath).toContain("v2");
		expect(meta2.filePath).toContain("calculator.mjs");
		expect(meta2.filePath).not.toContain("v1");

		// Cleanup
		rmSync(testDir, { recursive: true, force: true });
	});
});
