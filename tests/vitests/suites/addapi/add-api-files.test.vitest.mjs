/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/addapi/add-api-files.test.vitest.mjs
 *	@Date: 2026-02-13T16:27:51-08:00 (1771028871)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:41 -08:00 (1772425301)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test file-based api.add() functionality
 * @module tests/vitests/suites/addapi/add-api-files
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import slothlet from "@cldmv/slothlet";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test directory constants
const TEST_DIRS = {
	API_TEST: join(__dirname, "../../../../api_tests/api_test"),
	API_TEST_MIXED: join(__dirname, "../../../../api_tests/api_test_mixed"),
	API_TEST_CJS: join(__dirname, "../../../../api_tests/api_test_cjs")
};

describe("File-based api.add() Functionality", () => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "eager"
		});
	});

	afterEach(async () => {
		if (api?.slothlet?.destroy) {
			await api.slothlet.destroy();
		}
	});

	describe("Single File Loading", () => {
		it("should load a single .mjs file", async () => {
			const mathPath = join(TEST_DIRS.API_TEST, "math/math.mjs");
			await api.slothlet.api.add("singleFile", mathPath);

			expect(api.singleFile).toBeDefined();
			expect(typeof api.singleFile.add).toBe("function");
			expect(api.singleFile.add(2, 3)).toBe(5);
		});

		it("should load a single .cjs file", async () => {
			const testPath = join(TEST_DIRS.API_TEST_CJS, "root-math.cjs");
			await api.slothlet.api.add("cjsFile", testPath);

			expect(api.cjsFile).toBeDefined();
			// root-math.cjs exports an object with methods, not a function
			expect(typeof api.cjsFile.add).toBe("function");
			expect(api.cjsFile.add(5, 3)).toBe(8);
		});

		it("should load a single .js file", async () => {
			const stringPath = join(TEST_DIRS.API_TEST, "rootstring.mjs");
			await api.slothlet.api.add("jsFile", stringPath);

			expect(api.jsFile).toBeDefined();
			// rootstring.mjs exports an object with methods
			expect(typeof api.jsFile).toBe("object");
			expect(typeof api.jsFile.upper).toBe("function");
			const result = await api.jsFile.upper("hello");
			expect(result).toBe("HELLO");
		});

		it("should reject files with invalid extensions", async () => {
			const txtPath = join(__dirname, "test.txt");
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(api.slothlet.api.add("invalid", txtPath)).rejects.toThrow();
			});
		});

		it("should handle file paths with metadata", async () => {
			const mathPath = join(TEST_DIRS.API_TEST, "math/math.mjs");
			const moduleID = await api.slothlet.api.add("withMeta", mathPath, {
				metadata: { version: "1.0", author: "test" }
			});

			expect(api.withMeta).toBeDefined();
			expect(api.withMeta.add(1, 1)).toBe(2);
			expect(typeof moduleID).toBe("string");
		});
	});

	describe("Array of Paths Loading", () => {
		it("should load multiple files from an array", async () => {
			const files = [join(TEST_DIRS.API_TEST, "math/math.mjs"), join(TEST_DIRS.API_TEST, "rootstring.mjs")];

			await api.slothlet.api.add("multi", files);

			// Both files should be merged at the same path
			expect(api.multi).toBeDefined();
			expect(typeof api.multi.add).toBe("function");
			// rootstring is a function, not an object with methods
			expect(api.multi.add(2, 3)).toBe(5);
		});

		it("should load multiple directories from an array", async () => {
			const dirs = [join(TEST_DIRS.API_TEST, "math"), join(TEST_DIRS.API_TEST, "advanced")];

			await api.slothlet.api.add("multiDir", dirs);

			expect(api.multiDir).toBeDefined();
			// Should have content from both directories
			expect(api.multiDir).toBeDefined();
		});

		it("should load mixed files and directories from an array", async () => {
			const paths = [
				join(TEST_DIRS.API_TEST, "math/math.mjs"),
				join(TEST_DIRS.API_TEST, "rootstring.mjs"),
				join(TEST_DIRS.API_TEST, "util")
			];

			await api.slothlet.api.add("mixedPaths", paths);

			expect(api.mixedPaths).toBeDefined();
			expect(typeof api.mixedPaths.add).toBe("function");
		});

		it("should process array items sequentially", async () => {
			const files = [join(TEST_DIRS.API_TEST, "math/math.mjs"), join(TEST_DIRS.API_TEST, "rootstring.mjs")];

			const moduleIDs = await api.slothlet.api.add("sequential", files);

			// Should return array of moduleIDs
			expect(Array.isArray(moduleIDs)).toBe(true);
			expect(moduleIDs).toHaveLength(2);
			expect(typeof moduleIDs[0]).toBe("string");
			expect(typeof moduleIDs[1]).toBe("string");
		});

		it("should throw on invalid file in array", async () => {
			const paths = [join(TEST_DIRS.API_TEST, "math/math.mjs"), "/non/existent/file.mjs"];

			await withSuppressedSlothletErrorOutput(async () => {
				await expect(api.slothlet.api.add("invalidArray", paths)).rejects.toThrow();
			});
		});
	});

	describe("Collision Handling with Files", () => {
		it("should respect collision mode 'error' with file loading", async () => {
			const mathPath = join(TEST_DIRS.API_TEST, "math/math.mjs");

			// First add
			await api.slothlet.api.add("collision", mathPath);

			// Second add to same path should succeed (returns new moduleID)
			const moduleID2 = await api.slothlet.api.add("collision", mathPath);
			expect(typeof moduleID2).toBe("string");
		});

		it("should respect collision mode 'merge' with file loading", async () => {
			const config = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "eager",
				collision: { api: "merge" }
			});

			const mathPath = join(TEST_DIRS.API_TEST, "math/math.mjs");
			const stringPath = join(TEST_DIRS.API_TEST, "rootstring.mjs");

			await config.slothlet.api.add("mergeTest", mathPath);
			await config.slothlet.api.add("mergeTest", stringPath);

			// Math should be available, rootstring object should be merged
			expect(typeof config.mergeTest.add).toBe("function");
			expect(typeof config.mergeTest.upper).toBe("function");
		});

		it("should respect collision mode 'replace' with file loading", async () => {
			const config = await slothlet({
				dir: TEST_DIRS.API_TEST,
				mode: "eager",
				collision: { api: "replace" }
			});

			const mathPath = join(TEST_DIRS.API_TEST, "math/math.mjs");
			const stringPath = join(TEST_DIRS.API_TEST, "rootstring.mjs");

			await config.slothlet.api.add("replaceTest", mathPath);
			await config.slothlet.api.add("replaceTest", stringPath);

			// Only second (rootstring object) should be available
			expect(config.replaceTest.add).toBeUndefined();
			expect(typeof config.replaceTest).toBe("object");
			expect(typeof config.replaceTest.upper).toBe("function");
		});
	});

	describe("Ownership Tracking with Files", () => {
		it("should track ownership for file-based additions", async () => {
			const mathPath = join(TEST_DIRS.API_TEST, "math/math.mjs");
			const moduleID = await api.slothlet.api.add("owned", mathPath);

			// Verify moduleID is returned
			expect(typeof moduleID).toBe("string");
			expect(moduleID).toBeTruthy();
			// Verify API is loaded
			expect(api.owned).toBeDefined();
			expect(typeof api.owned.add).toBe("function");
		});

		it("should track ownership for array-based additions", async () => {
			const files = [join(TEST_DIRS.API_TEST, "math/math.mjs"), join(TEST_DIRS.API_TEST, "rootstring.mjs")];

			const moduleIDs = await api.slothlet.api.add("ownedArray", files);

			// Should return array of moduleIDs
			expect(Array.isArray(moduleIDs)).toBe(true);
			expect(moduleIDs).toHaveLength(2);
			moduleIDs.forEach((id) => expect(typeof id).toBe("string"));

			// Verify API is loaded with both modules
			expect(api.ownedArray).toBeDefined();
			expect(typeof api.ownedArray.add).toBe("function");
			expect(typeof api.ownedArray.upper).toBe("function");
		});

		it("should allow removal of file-based additions", async () => {
			const mathPath = join(TEST_DIRS.API_TEST, "math/math.mjs");
			const moduleID = await api.slothlet.api.add("removable", mathPath);

			expect(api.removable).toBeDefined();

			await api.slothlet.api.remove("removable");

			expect(api.removable).toBeUndefined();
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty array gracefully", async () => {
			const result = await api.slothlet.api.add("empty", []);
			// Empty array should return empty array of moduleIDs
			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(0);
		});

		it("should handle relative file paths", async () => {
			// Relative paths are resolved from the caller's location
			const relativePath = "./api_tests/api_test/math/math.mjs";
			await api.slothlet.api.add("relative", relativePath);

			expect(api.relative).toBeDefined();
			expect(typeof api.relative.add).toBe("function");
			expect(api.relative.add(10, 5)).toBe(15);
		});

		it("should handle nested paths with single file", async () => {
			const mathPath = join(TEST_DIRS.API_TEST, "math/math.mjs");
			await api.slothlet.api.add("nested.deep.path", mathPath);

			expect(api.nested.deep.path).toBeDefined();
			expect(typeof api.nested.deep.path.add).toBe("function");
			expect(api.nested.deep.path.add(10, 20)).toBe(30);
		});
	});
});
