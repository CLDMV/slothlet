/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/compare-baseline-tests.mjs
 *	@Date: 2026-02-10T00:00:00-08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-10 00:00:00 -08:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Compare vitest test files in tests/vitests/ with baseline-tests.json
 * Outputs files that exist in the filesystem but are not listed in the baseline
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const vitestsDir = join(rootDir, "tests/vitests");
const baselineFile = join(vitestsDir, "baseline-tests.json");
const testStatusFile = join(vitestsDir, "TEST-STATUS.md");

/**
 * Recursively find all vitest test files in a directory
 * @param {string} dir - Directory to search
 * @param {string} [baseDir] - Base directory for relative paths
 * @returns {Promise<string[]>} Array of relative file paths
 */
async function findVitestFiles(dir, baseDir = dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			// Skip setup directory and any other utility directories
			if (entry.name === "setup") {
				continue;
			}

			const subFiles = await findVitestFiles(fullPath, baseDir);
			files.push(...subFiles);
		} else if (entry.isFile() && entry.name.endsWith(".vitest.mjs")) {
			const relativePath = relative(baseDir, fullPath);
			files.push(relativePath);
		}
	}

	return files;
}

/**
 * Load the baseline tests from JSON file
 * @returns {Promise<string[]>} Array of baseline test file paths
 */
async function loadBaseline() {
	try {
		const content = await readFile(baselineFile, "utf-8");
		return JSON.parse(content);
	} catch (error) {
		console.error(`Error loading baseline file: ${error.message}`);
		return [];
	}
}

/**
 * Parse TEST-STATUS.md to extract tests marked as passing
 * @returns {Promise<string[]>} Array of test file paths marked as passing
 */
async function loadPassingTestsFromStatus() {
	try {
		const content = await readFile(testStatusFile, "utf-8");
		const lines = content.split("\n");
		const passingTests = [];
		
		for (const line of lines) {
			// Match table rows: | suites/path/to/test.test.vitest.mjs | ... | ✅ pass (date) | ...
			const match = line.match(/^\|\s*(suites\/[^|]+\.vitest\.mjs)\s*\|[^|]*\|[^|]*\|\s*✅\s*pass\s*\(/);
			if (match) {
				passingTests.push(match[1].trim());
			}
		}
		
		return passingTests;
	} catch (error) {
		// File doesn't exist or couldn't be read - return empty array
		return [];
	}
}

/**
 * Compare filesystem tests with baseline and output differences
 */
async function compareTests() {
	console.log("🔍 Comparing vitest files with baseline...\n");

	const [filesystemTests, baselineTests, passingTests] = await Promise.all([
		findVitestFiles(vitestsDir),
		loadBaseline(),
		loadPassingTestsFromStatus()
	]);

	// Normalize paths for comparison (handle forward slashes)
	const normalizedBaseline = new Set(baselineTests.map(p => p.replace(/\\/g, "/")));
	const normalizedFilesystem = filesystemTests.map(p => p.replace(/\\/g, "/"));
	const normalizedPassing = new Set(passingTests.map(p => p.replace(/\\/g, "/")));

	// Find files not in baseline
	const notInBaseline = normalizedFilesystem.filter(file => !normalizedBaseline.has(file));

	// Find files in baseline but not in filesystem
	const notInFilesystem = baselineTests.filter(file => 
		!normalizedFilesystem.includes(file.replace(/\\/g, "/"))
	);

	// Find tests marked as passing in TEST-STATUS.md but not in baseline
	const passingNotInBaseline = Array.from(normalizedPassing).filter(file => !normalizedBaseline.has(file));

	// Output results
	console.log(`📊 Summary:`);
	console.log(`   Total filesystem tests: ${normalizedFilesystem.length}`);
	console.log(`   Total baseline tests: ${baselineTests.length}`);
	if (passingTests.length > 0) {
		console.log(`   Total passing tests (TEST-STATUS.md): ${passingTests.length}`);
	}
	console.log(`   Tests not in baseline: ${notInBaseline.length}`);
	console.log(`   Tests in baseline but missing from filesystem: ${notInFilesystem.length}`);
	if (passingNotInBaseline.length > 0) {
		console.log(`   ⚠️  Passing tests not in baseline: ${passingNotInBaseline.length}`);
	}
	console.log();

	if (notInBaseline.length > 0) {
		console.log(`❌ Tests NOT in baseline (${notInBaseline.length}):`);
		notInBaseline.sort().forEach(file => {
			console.log(`   - ${file}`);
		});
		console.log();
	} else {
		console.log(`✅ All filesystem tests are in baseline`);
		console.log();
	}

	if (notInFilesystem.length > 0) {
		console.log(`⚠️  Tests in baseline but missing from filesystem (${notInFilesystem.length}):`);
		notInFilesystem.sort().forEach(file => {
			console.log(`   - ${file}`);
		});
		console.log();
	}

	if (passingNotInBaseline.length > 0) {
		console.log(`🔴 Tests marked as PASSING in TEST-STATUS.md but NOT in baseline.json (${passingNotInBaseline.length}):`);
		console.log(`   These tests should be added to baseline-tests.json:\n`);
		passingNotInBaseline.sort().forEach(file => {
			console.log(`   - ${file}`);
		});
		console.log();
	}

	// Exit with appropriate code
	if (notInBaseline.length > 0 || notInFilesystem.length > 0 || passingNotInBaseline.length > 0) {
		process.exit(1);
	} else {
		console.log(`✅ All tests match baseline perfectly!`);
		process.exit(0);
	}
}

// Run the comparison
compareTests().catch(error => {
	console.error(`Fatal error: ${error.message}`);
	console.error(error.stack);
	process.exit(1);
});
