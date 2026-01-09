/**
 * @fileoverview Comprehensive API structure validation for all test folders
 *
 * @description
 * Tests that API structures are consistent between lazy and eager modes
 * across all api_tests folders. Uses the inspect-api-structure tool
 * in child processes to avoid proxy/debugging conflicts.
 *
 * Original test: tests/test-all-api-structures.mjs
 * Original test count: 16 structure validation tests (8 folders × 2 modes)
 * New test count: 16 folders × 10 matrix pairs = 160 tests
 *
 * @module tests/vitests/all-api-structures.test.vitest
 */

import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAllApiTestFoldersSync, getMatrixConfigs } from "./vitest-helper.mjs";

describe("All API Structures Validation", () => {
	/**
	 * Create matrix pairs from getMatrixConfigs by matching eager/lazy configs with same parameters
	 */
	function createMatrixPairs() {
		const matrixConfigs = getMatrixConfigs({});
		const matrixPairs = [];

		// Separate eager and lazy configs
		const eagerConfigs = matrixConfigs.filter((config) => config.config.mode === "eager");
		const lazyConfigs = matrixConfigs.filter((config) => config.config.mode === "lazy");

		// Match eager configs with corresponding lazy configs
		for (const eagerConfig of eagerConfigs) {
			const lazyConfig = lazyConfigs.find((lazy) => {
				// Match all config parameters except mode
				return (
					lazy.config.runtime === eagerConfig.config.runtime &&
					lazy.config.allowApiOverwrite === eagerConfig.config.allowApiOverwrite &&
					lazy.config.hotReload === eagerConfig.config.hotReload &&
					lazy.config.apiDepth === eagerConfig.config.apiDepth &&
					lazy.config.hooks === eagerConfig.config.hooks
				);
			});

			if (lazyConfig) {
				// Create a descriptive base name from config parameters
				const baseName = `${eagerConfig.config.runtime}_${eagerConfig.config.allowApiOverwrite ? "overwrite" : "nooverwrite"}_${eagerConfig.config.hotReload ? "hotreload" : "nohotreload"}_depth${eagerConfig.config.apiDepth}_${eagerConfig.config.hooks ? "hooks" : "nohooks"}`;

				matrixPairs.push({
					name: baseName,
					lazy: lazyConfig,
					eager: eagerConfig
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
			const rootDir = path.resolve(path.dirname(currentFile), "../..");
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
			if (config.hotReload) {
				args.push("--hotReload");
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

		// Check for errors
		structure.hasErrors = output.includes("❌") || output.includes("Error:");

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
