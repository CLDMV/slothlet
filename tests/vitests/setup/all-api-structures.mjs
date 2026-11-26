/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/all-api-structures.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:40-08:00 (1794882520)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Shared body of the all-api-structures tests: the API structure of every api_tests folder must be the
 * same in lazy and eager mode.
 *
 * @description
 * Each case runs the inspect-api-structure tool twice in child processes (one lazy, one eager, to avoid proxy and
 * debugging conflicts) and compares the api type, the callable paths, the root function's name and arity, and the
 * whole mode-neutral api shape. Every fixture folder runs under every matrix pair (runtime × hooks, same settings on
 * both sides). The folders are spread over {@link API_STRUCTURE_PARTS} test files
 * (`suites/api-structures/all-api-structures-part-NN.test.vitest.mjs`) so each file finishes in a few minutes; the
 * cases and assertions are the ones the single file ran.
 *
 * Original test: tests/rewritten/test-all-api-structures.mjs
 * @module tests/vitests/setup/all-api-structures
 */

import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAllApiTestFoldersSync, getMatrixConfigs } from "./vitest-helper.mjs";

/**
 * Api paths whose primitive value differs on every load by design (a random per-instance id, a getter that counts its
 * own reads), so the shape comparison checks their type but not their value. Keyed by fixture; `*` applies to all. A
 * RegExp matches every dotted api path it fits (a function holding itself as `me` is read as `me.me…`).
 * @type {Map<string, Array<string|RegExp>>}
 */
const VOLATILE_VALUES = new Map([
	["*", ["slothlet.instance.id"]],
	["api_tv_test", ["config.state.instanceId"]],
	["api_test_collisions", [/^pair\.(fnprop|fnsolo)(\.me)*\.live$/]]
]);

/**
 * Blank the value of every node in `shape` whose dotted api path `pattern` matches.
 * @param {object} shape - A node's shape (`members` holds its children).
 * @param {RegExp} pattern - The paths to blank.
 * @param {string} [apiPath=""] - The node's dotted api path.
 * @returns {void}
 */
function blankMatching(shape, pattern, apiPath = "") {
	if (apiPath && pattern.test(apiPath) && "value" in shape) shape.value = "<volatile>";
	for (const [key, child] of Object.entries(shape.members ?? {})) blankMatching(child, pattern, apiPath ? `${apiPath}.${key}` : key);
}

/**
 * How many test files the fixture folders are spread over. Each file runs the `part`-th contiguous slice of the sorted
 * folders, so every folder lands in exactly one file and a new fixture joins one without a file being added. Changing
 * this means adding or removing an `all-api-structures-part-NN.test.vitest.mjs` file to match.
 * @type {number}
 */
export const API_STRUCTURE_PARTS = 12;

/**
 * The fixture folders one part runs.
 * @param {number} part - The part, from 1 to {@link API_STRUCTURE_PARTS}.
 * @returns {string[]} Its folders.
 * @example
 * foldersOfPart(1); // ["api_test", "api_test_cjs", ...]
 */
export function foldersOfPart(part) {
	const folders = getAllApiTestFoldersSync();
	const from = Math.floor(((part - 1) * folders.length) / API_STRUCTURE_PARTS);
	const to = Math.floor((part * folders.length) / API_STRUCTURE_PARTS);
	return folders.slice(from, to);
}

/**
 * Register the structure comparison for one part of the fixture folders.
 * @param {number} part - The part, from 1 to {@link API_STRUCTURE_PARTS}.
 * @returns {void}
 * @example
 * describeApiStructures(1);
 */
export function describeApiStructures(part) {
	if (!Number.isInteger(part) || part < 1 || part > API_STRUCTURE_PARTS)
		throw new RangeError(`part ${part} is not 1..${API_STRUCTURE_PARTS}`);
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
				const key = `${config.config.runtime}_${config.config.allowApiOverwrite}_${config.config.depth}_${config.config.hook?.enabled ?? false}`;

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
			for (const [____key, group] of configGroups) {
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
			const folders = foldersOfPart(part);
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
				const rootDir = path.resolve(path.dirname(currentFile), "../../..");
				const inspectToolPath = path.join(rootDir, "tools", "dev", "inspect-api-structure.mjs");

				// Build arguments for the inspection tool
				const args = [inspectToolPath, folderName];

				// Mode flag. The matrix configs carry `mode`; this used to test a `lazy` field they never
				// set, so both sides of every pair ran lazy and eager mode was never compared (#583).
				args.push(config.mode === "eager" ? "--eager" : "--lazy");

				// Add matrix configuration parameters
				if (config.runtime) {
					args.push("--runtime", config.runtime);
				}
				if (config.hook?.enabled) {
					args.push("--hooks");
				}
				if (config.depth !== undefined) {
					args.push("--apiDepth", config.depth.toString());
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
						resolve({ success: true, output: stdout, stderr });
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
			const lines = output.split("\n");
			structure.hasErrors = lines.some((line) => {
				// Ignore lines that start with success checkmarks
				if (line.trim().startsWith("✅")) return false;
				// Check for actual error indicators
				// Check for actual error indicators (not property listings like "  error: function")
				// Real errors start with "Error:" at beginning of line (no spaces before)
				return line.includes("❌") || /^Error:/i.test(line);
			});

			return structure;
		}

		/**
		 * Read the mode-neutral api shape the inspection tool prints (`API Shape: <json>`), with the values
		 * of the fixture's volatile paths blanked so only their type is compared.
		 * @param {string} output - The inspection stdout.
		 * @param {string} folder - Fixture folder name.
		 * @returns {object|null} The shape, or null when the api did not load.
		 */
		function extractApiShape(output, folder) {
			const line = output.split("\n").find((entry) => entry.startsWith("API Shape: "));
			if (!line) return null;
			const shape = JSON.parse(line.slice("API Shape: ".length));
			for (const apiPath of [...(VOLATILE_VALUES.get("*") ?? []), ...(VOLATILE_VALUES.get(folder) ?? [])]) {
				if (apiPath instanceof RegExp) {
					blankMatching(shape, apiPath);
					continue;
				}
				const node = apiPath.split(".").reduce((current, segment) => current?.members?.[segment], shape);
				if (node && "value" in node) node.value = "<volatile>";
			}
			return shape;
		}

		/**
		 * Read what a failed api load reports from the inspection stderr: its `[CODE]` when it carries one,
		 * otherwise its whole message, so a load error without a code is compared too.
		 * @param {string} [stderr] - The inspection stderr.
		 * @returns {string|null} The load error's code or message, or null when the api loaded.
		 */
		function extractLoadError(stderr) {
			const line = (stderr ?? "").split("\n").find((entry) => entry.includes("Error loading API:"));
			if (!line) return null;
			const message = line.slice(line.indexOf("Error loading API:") + "Error loading API:".length).trim();
			const code = message.match(/^\[([A-Z0-9_]+)\]/);
			return code ? code[1] : message;
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

				// Which paths one mode lists and the other does not, so a failed count says where the two apis differ.
				const onlyLazy = lazyStructure.callablePaths.filter((entry) => !eagerStructure.callablePaths.includes(entry));
				const onlyEager = eagerStructure.callablePaths.filter((entry) => !lazyStructure.callablePaths.includes(entry));
				const difference = `only in lazy: [${onlyLazy.join(", ")}], only in eager: [${onlyEager.join(", ")}]`;

				expect(
					lazyStructure.callablePathsCount,
					`${folder} (${matrixName}): Callable path count should be consistent (${difference})`
				).toBe(eagerStructure.callablePathsCount);

				expect(lazyStructure.functionName, `${folder} (${matrixName}): Function name should be consistent`).toBe(
					eagerStructure.functionName
				);

				expect(lazyStructure.parameterCount, `${folder} (${matrixName}): Parameter count should be consistent`).toBe(
					eagerStructure.parameterCount
				);

				// Compare callable paths arrays
				expect(lazyStructure.callablePaths.sort(), `${folder} (${matrixName}): Callable paths should be identical`).toEqual(
					eagerStructure.callablePaths.sort()
				);

				// The whole composed api must match, not only its callable paths: every key, the kind of every
				// node (callable, object, array, primitive), each callable's arity and each primitive's value.
				// A fixture that refuses to load must refuse the same way in both modes.
				const lazyShape = extractApiShape(lazyResult.output, folder);
				const eagerShape = extractApiShape(eagerResult.output, folder);
				if (lazyShape === null && eagerShape === null) {
					const lazyLoadError = extractLoadError(lazyResult.stderr);
					expect(lazyLoadError, `${folder} (${matrixName}): an api that does not load should report a load error`).not.toBeNull();
					expect(lazyLoadError, `${folder} (${matrixName}): both modes should refuse the api the same way`).toBe(
						extractLoadError(eagerResult.stderr)
					);
				} else {
					expect(lazyShape, `${folder} (${matrixName}): API shape should be identical`).toEqual(eagerShape);
				}

				// Neither should have errors
				expect(lazyStructure.hasErrors, `${folder} (${matrixName}): Lazy mode should not have errors`).toBe(false);
				expect(eagerStructure.hasErrors, `${folder} (${matrixName}): Eager mode should not have errors`).toBe(false);
			}, 120000); // 2 minute timeout
		});
	});
}
