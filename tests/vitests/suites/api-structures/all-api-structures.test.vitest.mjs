/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-structures/all-api-structures.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:50 -08:00 (1770266390)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

﻿/**
 * @fileoverview Comprehensive API structure validation for all test folders
 *
 * @description
 * Tests that API structures are consistent between lazy and eager modes
 * across all api_tests folders. Uses the inspect-api-structure tool
 * in child processes to avoid proxy/debugging conflicts.
 *
 * Original test: tests/rewritten/test-all-api-structures.mjs
 * Original test count: 16 structure validation tests (8 folders × 2 modes)
 * New test count: 16 folders × 10 matrix pairs = 160 tests
 *
 * @module tests/vitests/processed/api-structures/all-api-structures.test.vitest
 */

import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAllApiTestFoldersSync, getMatrixConfigs } from "../../setup/vitest-helper.mjs";

describe("All API Structures Validation", () => {
	/**
	 * Create matrix pairs from getMatrixConfigs by matching eager/lazy configs with same parameters
	 */
	function createMatrixPairs() {
		const matrixConfigs = getMatrixConfigs({});
		const matrixPairs = [];

		// Group configs by their parameters (excluding mode)
		const configGroups = new Map();

		for (const config of matrixConfigs) {
			// Create a key from all config params except mode
			const key = `${config.config.runtime}_${config.config.allowApiOverwrite}_${config.config.apiDepth}_${config.config.hook?.enabled ?? false}`;

			if (!configGroups.has(key)) {
				configGroups.set(key, { eager: null, lazy: null });
			}

			const group = configGroups.get(key);
			if (config.config.mode === "eager") {
				group.eager = config;
			} else {
				group.lazy = config;
			}
		}

		// Create pairs from groups that have both modes
		for (const [key, group] of configGroups) {
			if (group.eager && group.lazy) {
				const baseName = `${group.eager.config.runtime}_${group.eager.config.allowApiOverwrite ? "overwrite" : "nooverwrite"}_depth${group.eager.config.apiDepth}_${group.eager.config.hook?.enabled ? "hooks" : "nohooks"}`;

				matrixPairs.push({
					name: baseName,
					lazy: group.lazy,
					eager: group.eager
				});
			}
		}

		return matrixPairs;
	}

	/**
	 * Create all test combinations (folders × matrix pairs)
	 */
	function createTestCombinations() {
		const folders = getAllApiTestFoldersSync();
		const matrixPairs = createMatrixPairs();
		const combinations = [];

		for (const folder of folders) {
			for (const pair of matrixPairs) {
				combinations.push({
					folder,
					matrixName: pair.name,
					lazy: pair.lazy,
					eager: pair.eager
				});
			}
		}

		return combinations;
	}

	const testCombinations = createTestCombinations();

	/**
	 * Run the inspect-api-structure tool for a specific folder and config.
	 * @param {string} folderName - Name of the api_tests folder
	 * @param {object} config - Slothlet configuration
	 * @returns {Promise<{success: boolean, output: string, error?: string}>}
	 */
	async function runInspection(folderName, config) {
		return new Promise((resolve) => {
			const currentFile = fileURLToPath(import.meta.url);
			const rootDir = path.resolve(path.dirname(currentFile), "../../../..");
			const inspectToolPath = path.join(rootDir, "tools", "inspect-api-structure.mjs");

			// Build arguments for the inspection tool
			const args = [inspectToolPath, folderName];

			// Add mode flag
			if (config.lazy === false) {
				args.push("--eager");
			} else {
				args.push("--lazy");
			}

			// Add matrix configuration parameters
			if (config.allowApiOverwrite) {
				args.push("--allowApiOverwrite");
			}
			if (config.apiDepth !== undefined) {
				args.push("--apiDepth", config.apiDepth.toString());
			}
			if (config.debug) {
				args.push("--debug");
			}

			const childProcess = spawn("node", args, {
				stdio: ["ignore", "pipe", "pipe"],
				cwd: rootDir,
				env: {
					...process.env,
					NODE_ENV: "development",
					NODE_OPTIONS: "--conditions=slothlet-dev"
				}
			});

			let stdout = "";
			let stderr = "";

			childProcess.stdout.on("data", (data) => {
				stdout += data.toString();
			});

			childProcess.stderr.on("data", (data) => {
				stderr += data.toString();
			});

			// Timeout after 20 seconds per test
			const timeout = setTimeout(() => {
				childProcess.kill();
				resolve({
					success: false,
					output: stdout,
					error: "Process timeout after 20 seconds"
				});
			}, 20000);

			childProcess.on("close", (code) => {
				clearTimeout(timeout);
				if (code === 0) {
					resolve({ success: true, output: stdout });
				} else {
					resolve({
						success: false,
						output: stdout,
						error: stderr || `Process exited with code ${code}`
					});
				}
			});
		});
	}

	/**
	 * Extract API structure information from inspection output.
	 * @param {string} output - The inspection output text
	 * @returns {object} API structure information
	 */
	function extractApiStructure(output) {
		const structure = {
			apiType: "unknown",
			callablePathsCount: 0,
			callablePaths: [],
			functionName: null,
			parameterCount: null,
			hasErrors: false
		};

		// Extract API type
		const apiTypeMatch = output.match(/API Type:\s*(\w+)/);
		if (apiTypeMatch) {
			structure.apiType = apiTypeMatch[1];
		}

		// Extract function details for callable APIs
		const functionNameMatch = output.match(/Function Name:\s*(\w+)/);
		if (functionNameMatch) {
			structure.functionName = functionNameMatch[1];
		}

		const paramCountMatch = output.match(/Parameter Count:\s*(\d+)/);
		if (paramCountMatch) {
			structure.parameterCount = parseInt(paramCountMatch[1], 10);
		}

		// Extract all callable paths
		const callableSection = output.match(/Callable Paths:([\s\S]*?)(?=💡|$)/);
		if (callableSection) {
			const paths = callableSection[1]
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.startsWith("api.") || line === "api()")
				.sort();
			structure.callablePaths = paths;
			structure.callablePathsCount = paths.length;
		}

		// Check for errors - exclude success messages containing checkmarks
		const lines = output.split('\n');
		structure.hasErrors = lines.some(line => {
			// Ignore lines that start with success checkmarks
			if (line.trim().startsWith('✅')) return false;
			// Check for actual error indicators  
// Check for actual error indicators (not property listings like "  error: function")
// Real errors start with "Error:" at beginning of line (no spaces before)
return line.includes('❌') || /^Error:/i.test(line);
		});

		return structure;
	}

	describe.each(testCombinations)("$folder with $matrixName config", ({ folder, matrixName, lazy, eager }) => {
		it("should have consistent API structures between lazy and eager modes", async () => {
			// Run both modes
			const [lazyResult, eagerResult] = await Promise.all([runInspection(folder, lazy.config), runInspection(folder, eager.config)]);

			// Both should succeed
			if (!lazyResult.success || !eagerResult.success) {
				const lazyError = !lazyResult.success ? lazyResult.error : "none";
				const eagerError = !eagerResult.success ? eagerResult.error : "none";
				throw new Error(`${folder} (${matrixName}): Execution failed - Lazy: ${lazyError}, Eager: ${eagerError}`);
			}

			// Extract and compare structures
			const lazyStructure = extractApiStructure(lazyResult.output);
			const eagerStructure = extractApiStructure(eagerResult.output);

			// Compare critical aspects for consistency
			expect(lazyStructure.apiType, `${folder} (${matrixName}): API type should be consistent`).toBe(eagerStructure.apiType);

			expect(lazyStructure.callablePathsCount, `${folder} (${matrixName}): Callable path count should be consistent`).toBe(
				eagerStructure.callablePathsCount
			);

			expect(lazyStructure.functionName, `${folder} (${matrixName}): Function name should be consistent`).toBe(eagerStructure.functionName);

			expect(lazyStructure.parameterCount, `${folder} (${matrixName}): Parameter count should be consistent`).toBe(
				eagerStructure.parameterCount
			);

			// Compare callable paths arrays
			expect(lazyStructure.callablePaths.sort(), `${folder} (${matrixName}): Callable paths should be identical`).toEqual(
				eagerStructure.callablePaths.sort()
			);

			// Neither should have errors
			expect(lazyStructure.hasErrors, `${folder} (${matrixName}): Lazy mode should not have errors`).toBe(false);
			expect(eagerStructure.hasErrors, `${folder} (${matrixName}): Eager mode should not have errors`).toBe(false);
		}, 120000); // 2 minute timeout
	});
});
