/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/debug-slothlet.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-07 15:32:28 -08:00 (1770507148)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import chalk from "chalk";
import { spawn } from "node:child_process";

let slothlet;
const verbose =
	process.argv.includes("--verbose") ||
	process.env.SLOTHLET_DEBUG_SCRIPT_VERBOSE === "1" ||
	process.env.SLOTHLET_DEBUG_SCRIPT_VERBOSE === "true";

function ensureDevEnvFlags() {
	/**
	 * @param {string[]} args
	 * @param {string} condition
	 * @returns {boolean}
	 */
	const hasCondition = (args, condition) =>
		args.some((arg) => arg.startsWith("--conditions=") && arg.slice("--conditions=".length).split(/[|,]/u).includes(condition));

	process.env.NODE_ENV = "development";

	// Use V3 slothlet-dev condition
	const allExecArgv = [...process.execArgv];
	const envOptions = (process.env.NODE_OPTIONS ?? "").split(/\s+/u).filter(Boolean);
	const allConditions = [...allExecArgv, ...envOptions];

	const slothletCondition = "slothlet-dev";

	const requiredConditions = [slothletCondition, "development"];
	const nextExecArgv = [...process.execArgv];
	const envConditions = (process.env.NODE_OPTIONS ?? "")
		.split(/\s+/u)
		.filter(Boolean)
		.filter((token) => token !== "--conditions=development|production");

	let needsRespawn = process.env.NODE_ENV !== "development";

	for (const condition of requiredConditions) {
		const flag = `--conditions=${condition}`;
		if (!hasCondition(nextExecArgv, condition)) {
			nextExecArgv.push(flag);
			needsRespawn = true;
		}
		if (!envConditions.includes(flag)) {
			envConditions.push(flag);
		}
	}

	process.env.NODE_OPTIONS = envConditions.join(" ");

	if (!needsRespawn) {
		return false;
	}

	const child = spawn(process.argv[0], [...nextExecArgv, ...process.argv.slice(1)], {
		env: { ...process.env, NODE_ENV: "development", NODE_OPTIONS: process.env.NODE_OPTIONS },
		stdio: "inherit"
	});

	child.on("exit", (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}
		process.exit(code ?? 0);
	});

	return true;
}

const verboseLog = (...args) => {
	if (verbose) {
		console.log(...args);
	}
};

/**
 * Returns the MD5 hash of a string.
 * @param {string} str
 * @returns {string}
 */
function md5(str) {
	return crypto.createHash("md5").update(str).digest("hex");
}

/**
 * Compares two objects or functions-with-methods and reports differences in keys and function signatures.
 * Recursively walks through nested objects and functions to provide comprehensive comparison.
 * @param {function|object} a - First object or function to compare.
 * @param {function|object} b - Second object or function to compare.
 * @param {object} [options] - Optional settings.
 * @param {number} [options.maxDepth=10] - Maximum recursion depth to prevent infinite loops.
 * @param {string} [currentPath=""] - Internal: current path for recursion tracking.
 * @param {number} [currentDepth=0] - Internal: current recursion depth.
 * @param {Set} [checkedPaths] - Internal: set to track all checked paths for verification.
 * @param {WeakSet} [visitedA] - Internal: set to track visited objects in A for circular reference detection.
 * @param {WeakSet} [visitedB] - Internal: set to track visited objects in B for circular reference detection.
 * @returns {object} Report of differences: { onlyInA, onlyInB, differingFunctions, differingValues, nestedDifferences, checkedPaths }
 * @example
 * compareApiShapes(obj1, obj2);
 */
export function compareApiShapes(
	a,
	b,
	options = {},
	currentPath = "",
	currentDepth = 0,
	checkedPaths = null,
	visitedA = null,
	visitedB = null
) {
	const { maxDepth = 10 } = options;

	/**
	 * Normalizes wrapper proxies to their underlying implementation when available.
	 * @param {unknown} value - Value to normalize for comparison.
	 * @returns {unknown} Normalized value for comparison.
	 */
	const normalizeForCompare = (value) => {
		if (value === null || value === undefined) {
			return value;
		}
		const valueType = typeof value;
		if (valueType !== "object" && valueType !== "function") {
			return value;
		}
		const wrapper = value.__wrapper;
		if (wrapper && typeof wrapper === "object") {
			const impl = wrapper._impl;
			const childCache = wrapper._childCache;
			if (impl && typeof impl === "object") {
				const descriptors = Object.getOwnPropertyDescriptors(impl);
				const view = Object.create(Object.getPrototypeOf(impl) || Object.prototype, descriptors);
				if (childCache && childCache.size > 0) {
					for (const [key, childValue] of childCache.entries()) {
						if (!Object.prototype.hasOwnProperty.call(view, key)) {
							Object.defineProperty(view, key, {
								value: childValue,
								writable: false,
								enumerable: true,
								configurable: true
							});
						}
					}
				}
				return view;
			}
			if ((impl === null || impl === undefined) && childCache && childCache.size > 0) {
				const view = {};
				for (const [key, childValue] of childCache.entries()) {
					view[key] = childValue;
				}
				return view;
			}
			if (impl !== undefined && impl !== null) {
				return impl;
			}
		}
		return value;
	};

	a = normalizeForCompare(a);
	b = normalizeForCompare(b);

	// Initialize checkedPaths set on first call
	if (checkedPaths === null) {
		checkedPaths = new Set();
	}

	// Initialize circular reference tracking on first call
	if (visitedA === null) {
		visitedA = new WeakSet();
	}
	if (visitedB === null) {
		visitedB = new WeakSet();
	}

	// Check for circular references
	if (a !== null && typeof a === "object" && visitedA.has(a)) {
		return {
			onlyInA: [],
			onlyInB: [],
			differingFunctions: [],
			differingValues: [{ path: currentPath, reason: "Circular reference in A", aValue: "[Circular]", bValue: typeof b }],
			nestedDifferences: [],
			checkedPaths: currentDepth === 0 ? [...checkedPaths] : []
		};
	}
	if (b !== null && typeof b === "object" && visitedB.has(b)) {
		return {
			onlyInA: [],
			onlyInB: [],
			differingFunctions: [],
			differingValues: [{ path: currentPath, reason: "Circular reference in B", aValue: typeof a, bValue: "[Circular]" }],
			nestedDifferences: [],
			checkedPaths: currentDepth === 0 ? [...checkedPaths] : []
		};
	}

	// Add current objects to visited sets
	if (a !== null && typeof a === "object") {
		visitedA.add(a);
	}
	if (b !== null && typeof b === "object") {
		visitedB.add(b);
	}

	// Add current path to checked paths (even if it's root "")
	if (currentPath !== "") {
		checkedPaths.add(currentPath);
	}

	// Prevent infinite recursion
	if (currentDepth > maxDepth) {
		return {
			onlyInA: [],
			onlyInB: [],
			differingFunctions: [],
			differingValues: [{ path: currentPath, reason: "Max depth reached", aValue: typeof a, bValue: typeof b }],
			nestedDifferences: [],
			checkedPaths: currentDepth === 0 ? [...checkedPaths] : []
		};
	}

	/**
	 * Collects keys for comparison without traversing noisy function prototype helpers.
	 * @param {unknown} obj - Value to inspect for keys.
	 * @returns {Array<string|symbol>} Keys to compare.
	 */
	const getAllKeys = (obj) => {
		if (obj === null || obj === undefined) return [];
		if (typeof obj === "function") {
			const allKeys = [...new Set([...Object.getOwnPropertyNames(obj), ...Object.keys(obj)])];
			return allKeys.filter((key) => !["toString", "valueOf", "apply", "bind", "call", "prototype", "name", "length"].includes(key));
		}
		if (typeof obj === "object") {
			return [...new Set([...Object.getOwnPropertyNames(obj), ...Object.keys(obj)])];
		}
		return [];
	};

	const keysA = new Set(getAllKeys(a));
	const keysB = new Set(getAllKeys(b));

	// Helper function to check if a key should be skipped
	/**
	 * Determines whether a key should be skipped during API shape comparison.
	 * @param {string|symbol} key - Key being inspected.
	 * @param {unknown} obj - Object or function containing the key.
	 * @returns {boolean} True when the key should be ignored.
	 */
	const shouldSkipKey = (key, obj) => {
		// Always skip internal path properties - these may differ between modes
		// but don't affect user-facing API behavior
		if (key === "__slothletPath") {
			return true;
		}
		if (key === "instanceID") {
			return true;
		}
		return false;
	};

	const onlyInA = [...keysA].filter((k) => !keysB.has(k) && !shouldSkipKey(k, a)).map((k) => (currentPath ? `${currentPath}.${k}` : k));
	const onlyInB = [...keysB].filter((k) => !keysA.has(k) && !shouldSkipKey(k, b)).map((k) => (currentPath ? `${currentPath}.${k}` : k));
	const inBoth = [...keysA].filter((k) => keysB.has(k));

	const differingFunctions = [];
	const differingValues = [];
	const nestedDifferences = [];

	for (const key of inBoth) {
		// Skip common non-enumerable properties that don't matter for API comparison
		if (shouldSkipKey(key, a)) {
			continue;
		}
		if (currentPath === "__slothletInstance" && key === "config") {
			continue;
		}

		const valA = a[key];
		const valB = b[key];
		const fullPath = currentPath ? `${currentPath}.${key}` : key;
		const normalizedValA = normalizeForCompare(valA);
		const normalizedValB = normalizeForCompare(valB);

		// Skip circular references dynamically by checking if the property value
		// is the same object reference as any ancestor in the path
		if (
			(normalizedValA !== null && typeof normalizedValA === "object" && visitedA.has(normalizedValA)) ||
			(normalizedValB !== null && typeof normalizedValB === "object" && visitedB.has(normalizedValB))
		) {
			// This is a circular reference, skip it
			continue;
		}

		// Add this path to checked paths
		checkedPaths.add(fullPath);

		if (typeof normalizedValA === "function" && typeof normalizedValB === "function") {
			// Compare function signatures and implementations
			// Extract name, length, and toString from ORIGINAL proxies, not normalized impls
			// This ensures we get the API-path-derived names and actual impl toString
			const aName = typeof valA.name === "string" ? valA.name : "anonymous";
			const bName = typeof valB.name === "string" ? valB.name : "anonymous";
			const aLength = typeof valA.length === "number" ? valA.length : 0;
			const bLength = typeof valB.length === "number" ? valB.length : 0;

			// Call toString through the proxy to get the actual impl's toString
			const aToString = typeof valA.toString === "function" ? valA.toString() : normalizedValA.toString();
			const bToString = typeof valB.toString === "function" ? valB.toString() : normalizedValB.toString();

			if (aLength !== bLength || aToString !== bToString) {
				differingFunctions.push({
					path: fullPath,
					aSignature: `${aName}(${aLength} params)`,
					bSignature: `${bName}(${bLength} params)`,
					aLength: aLength,
					bLength: bLength,
					aToString: aToString.substring(0, 100),
					bToString: bToString.substring(0, 100)
				});
			}

			// Recursively compare function properties (functions can have properties too)
			const funcComparison = compareApiShapes(
				normalizedValA,
				normalizedValB,
				options,
				fullPath,
				currentDepth + 1,
				checkedPaths,
				visitedA,
				visitedB
			);
			nestedDifferences.push(...funcComparison.onlyInA.map((p) => ({ type: "onlyInA", path: p })));
			nestedDifferences.push(...funcComparison.onlyInB.map((p) => ({ type: "onlyInB", path: p })));
			nestedDifferences.push(...funcComparison.differingFunctions.map((f) => ({ type: "differingFunction", ...f })));
			nestedDifferences.push(...funcComparison.differingValues.map((v) => ({ type: "differingValue", ...v })));
			nestedDifferences.push(...funcComparison.nestedDifferences);
		} else if (
			typeof normalizedValA === "object" &&
			typeof normalizedValB === "object" &&
			normalizedValA !== null &&
			normalizedValB !== null
		) {
			// Recursively compare nested objects
			const nestedComparison = compareApiShapes(
				normalizedValA,
				normalizedValB,
				options,
				fullPath,
				currentDepth + 1,
				checkedPaths,
				visitedA,
				visitedB
			);
			nestedDifferences.push(...nestedComparison.onlyInA.map((p) => ({ type: "onlyInA", path: p })));
			nestedDifferences.push(...nestedComparison.onlyInB.map((p) => ({ type: "onlyInB", path: p })));
			nestedDifferences.push(...nestedComparison.differingFunctions.map((f) => ({ type: "differingFunction", ...f })));
			nestedDifferences.push(...nestedComparison.differingValues.map((v) => ({ type: "differingValue", ...v })));
			nestedDifferences.push(...nestedComparison.nestedDifferences);
		} else if (typeof normalizedValA !== typeof normalizedValB || normalizedValA !== normalizedValB) {
			// Values differ in type or content
			differingValues.push({
				path: fullPath,
				aValue: normalizedValA,
				bValue: normalizedValB,
				aType: typeof normalizedValA,
				bType: typeof normalizedValB
			});
		}
	}

	// Clean up visited sets before returning (remove current objects)
	if (a !== null && typeof a === "object") {
		visitedA.delete(a);
	}
	if (b !== null && typeof b === "object") {
		visitedB.delete(b);
	}

	// Only return checkedPaths array on the top-level call
	return {
		onlyInA,
		onlyInB,
		differingFunctions,
		differingValues,
		nestedDifferences,
		checkedPaths: currentDepth === 0 ? [...checkedPaths].sort() : []
	};
}

/**
 * Materializes all lazy wrappers reachable from a root value to normalize comparisons.
 * @param {unknown} root - Root value to traverse for lazy wrapper materialization.
 * @returns {Promise<void>} Resolves after traversal and materialization.
 */
async function materializeLazyWrappers(root) {
	const visited = new WeakSet();
	const queue = [root];

	while (queue.length > 0) {
		const current = queue.pop();
		if (current === null || current === undefined) {
			continue;
		}
		const currentType = typeof current;
		if (currentType !== "object" && currentType !== "function") {
			continue;
		}
		if (visited.has(current)) {
			continue;
		}
		visited.add(current);

		if (typeof current.__getState === "function" && typeof current._materialize === "function") {
			const state = current.__getState();
			if (state && !state.materialized && !state.inFlight) {
				await current._materialize();
			}
		}

		const keys = new Set([...Object.getOwnPropertyNames(current), ...Object.keys(current)]);
		for (const key of keys) {
			if (typeof key === "string") {
				if (key.startsWith("__") || key.startsWith("_")) {
					continue;
				}
				if (currentType === "function" && ["toString", "valueOf", "apply", "bind", "call", "prototype", "name", "length"].includes(key)) {
					continue;
				}
			}
			try {
				queue.push(current[key]);
			} catch (error) {
				// Ignore getter errors during traversal
			}
		}
	}
}

// Error tracking arrays (global to collect errors from both runs)
const nanResults = [];
const callErrors = [];

/**
 * Runs debug tests for the slothlet API.
 * @param {object} slothlet - The slothlet loader instance.
 * @param {object} config - Loader config.
 * @param {string} label - Label for debug output.
 * @param {boolean} [awaitCalls=false] - If true, await all API calls.
 */

async function runDebug(config, modeLabel, awaitCalls = false) {
	// await slothlet.load({ ...config, dir: "./api_test" });
	// const bound = slothlet.createBoundApi({});
	let bound;
	// if (awaitCalls) {

	// Use V3 API test directory
	const apiTestDir = "../api_tests/api_test";

	// if (modeLabel === "EAGER") bound = await slothletEager({ ...config, dir: "../api_test", api_mode: "function", reference: { md5 } });
	// else bound = await slothletLazy({ ...config, dir: "../api_test", api_mode: "function", reference: { md5 } });
	bound = await slothlet({ ...config, dir: apiTestDir, reference: { md5 } });

	// bound = await slothlet.create({ ...config, dir: "./api_test" });
	// } else {
	// 	bound = slothlet.create({ ...config, dir: "./api_test" });
	// }
	// const bound = await slothlet.create({ ...config, debug: true, dir: "./api_test" });
	// const bound = slothlet.createBoundApi({});
	console.log(chalk.green("\n===== DEBUG MODE: " + modeLabel + (awaitCalls ? " (awaited)" : "") + " =====\n"));

	// console.dir(bound, { depth: null });
	verboseLog("bound api (before calls): ", bound);
	// process.exit(0);
	// console.log(await bound.describe());
	// console.dir(await bound.describe(), { depth: null });

	console.log(chalk.green("\n===== DIRECT HELLO TEST START =====\n"));
	try {
		let directResult;
		if (awaitCalls) {
			directResult = await bound.multi_func.beta.hello();
		} else {
			directResult = bound.multi_func.beta.hello();
		}
		console.log(chalk.cyanBright(`${awaitCalls ? "await " : ""}bound.multi_func.beta.hello()`), directResult);
	} catch (e) {
		console.error("Error during direct hello test:", e);
	}
	console.log(chalk.green("\n===== DIRECT HELLO TEST END =====\n"));

	// List of debug API calls to run
	const tests = [
		// root-function
		{ section: "rootFunction (default)", calls: [{ path: [], args: ["World"] }] },
		{ section: "rootFunctionShout", calls: [{ path: ["rootFunctionShout"], args: ["World"] }] },
		{
			section: "rootFunctionWhisper",
			calls: [{ path: ["rootFunctionWhisper"], args: ["World"] }]
		},

		// root-math
		{
			section: "rootMath",
			calls: [
				{ path: ["rootMath", "add"], args: [2, 3] },
				{ path: ["rootMath", "multiply"], args: [2, 3] }
			]
		},

		// rootstring
		{
			section: "rootstring",
			calls: [
				{ path: ["rootstring", "upper"], args: ["abc"] },
				{ path: ["rootstring", "reverse"], args: ["abc"] }
			]
		},

		// string
		{
			section: "string",
			calls: [
				{ path: ["string", "upper"], args: ["abc"] },
				{ path: ["string", "reverse"], args: ["abc"] }
			]
		},

		// math
		{
			section: "math",
			calls: [
				{ path: ["math", "add"], args: [2, 3] },
				{ path: ["math", "multiply"], args: [2, 3] }
			]
		},

		// deep math
		{
			section: "deep2.folder.math",
			calls: [{ path: ["deep2", "folder", "math", "add"], args: [2, 3] }]
		},

		// multi_func
		{ section: "multi_func.alpha", calls: [{ path: ["multi_func", "alpha"], args: ["alpha"] }] },
		{
			section: "multi_func.beta.hello",
			calls: [{ path: ["multi_func", "beta", "hello"], args: [] }]
		},
		{
			section: "multi_func.uniqueOne",
			calls: [{ path: ["multi_func", "uniqueOne"], args: ["uniqueOne"] }]
		},
		{
			section: "multi_func.uniqueTwo",
			calls: [{ path: ["multi_func", "uniqueTwo"], args: ["uniqueTwo"] }]
		},
		{
			section: "multi_func.uniqueThree",
			calls: [{ path: ["multi_func", "uniqueThree"], args: ["uniqueThree"] }]
		},
		{
			section: "multi_func.multi_func_hello",
			calls: [{ path: ["multi_func", "multi_func_hello"], args: [] }]
		},

		// multi
		{ section: "multi.alpha.hello", calls: [{ path: ["multi", "alpha", "hello"], args: [] }] },
		{ section: "multi.beta.world", calls: [{ path: ["multi", "beta", "world"], args: [] }] },

		// multi_defaults
		{ section: "multi_defaults.key", calls: [{ path: ["multi_defaults", "key"], args: ["ENTER"] }] },
		{ section: "multi_defaults.power", calls: [{ path: ["multi_defaults", "power"], args: [] }] },
		{ section: "multi_defaults.volume", calls: [{ path: ["multi_defaults", "volume"], args: [50] }] },
		{
			section: "multi_defaults.key.press",
			calls: [{ path: ["multi_defaults", "key", "press"], args: ["ESC"] }]
		},
		{
			section: "multi_defaults.power.on",
			calls: [{ path: ["multi_defaults", "power", "on"], args: [] }]
		},
		{
			section: "multi_defaults.volume.up",
			calls: [{ path: ["multi_defaults", "volume", "up"], args: [] }]
		},

		// nested.date
		{ section: "nested.date.today", calls: [{ path: ["nested", "date", "today"], args: [] }] },

		// objectDefaultMethod
		{
			section: "objectDefaultMethod (default)",
			calls: [{ path: ["objectDefaultMethod"], args: ["Hello World"] }]
		},
		{
			section: "objectDefaultMethod.info",
			calls: [{ path: ["objectDefaultMethod", "info"], args: ["Test"] }]
		},
		{
			section: "objectDefaultMethod.warn",
			calls: [{ path: ["objectDefaultMethod", "warn"], args: ["Test"] }]
		},
		{
			section: "objectDefaultMethod.error",
			calls: [{ path: ["objectDefaultMethod", "error"], args: ["Test"] }]
		},

		// funcmod
		{ section: "funcmod", calls: [{ path: ["funcmod"], args: [5, 6] }] },

		// logger (callable namespace test)
		{
			section: "logger (default)",
			calls: [{ path: ["logger"], args: ["Test log message"] }]
		},
		{
			section: "logger.utils.debug",
			calls: [{ path: ["logger", "utils", "debug"], args: ["Debug message"] }]
		},
		{
			section: "logger.utils.error",
			calls: [{ path: ["logger", "utils", "error"], args: ["Error message"] }]
		},

		// util
		{ section: "util.size", calls: [{ path: ["util", "size"], args: [123] }] },
		{ section: "util.secondFunc", calls: [{ path: ["util", "secondFunc"], args: [123] }] },
		{
			section: "util.url.cleanEndpoint",
			calls: [
				{
					path: ["util", "url", "cleanEndpoint"],
					args: ["sites_list", "default", {}, false, false]
				}
			]
		},
		{
			section: "util.url.buildUrlWithParams",
			calls: [
				{
					path: ["util", "url", "buildUrlWithParams"],
					args: ["10.0.0.1", { foo: "bar" }]
				}
			]
		},
		{ section: "util.extract.data", calls: [{ path: ["util", "extract", "data"], args: [] }] },
		{ section: "util.extract.section", calls: [{ path: ["util", "extract", "section"], args: [] }] },
		{
			section: "util.extract.NVRSection",
			calls: [{ path: ["util", "extract", "NVRSection"], args: [] }]
		},
		{
			section: "util.extract.parseDeviceName",
			calls: [{ path: ["util", "extract", "parseDeviceName"], args: [] }]
		},
		{
			section: "util.controller.getDefault",
			calls: [{ path: ["util", "controller", "getDefault"], args: [] }]
		},
		{
			section: "util.controller.detectEndpointType",
			calls: [{ path: ["util", "controller", "detectEndpointType"], args: [] }]
		},
		{
			section: "util.controller.detectDeviceType",
			calls: [{ path: ["util", "controller", "detectDeviceType"], args: [] }]
		},

		// advanced
		{
			section: "advanced.selfObject.addViaSelf",
			calls: [{ path: ["advanced", "selfObject", "addViaSelf"], args: [2, 3] }]
		},
		{
			section: "advanced.selfObject.addViaSelf",
			calls: [{ path: ["advanced", "selfObject", "addViaSelf"], args: [2, 3] }]
		},
		{
			section: "advanced.nest3 (default)",
			calls: [{ path: ["advanced", "nest3"], args: ["slothlet"] }]
		},
		{
			section: "advanced.nest.alpha",
			calls: [{ path: ["advanced", "nest", "alpha"], args: ["slothlet"] }]
		},
		{
			section: "advanced.nest2.alpha.hello",
			calls: [{ path: ["advanced", "nest2", "alpha", "hello"], args: [] }]
		},
		{
			section: "advanced.nest2.beta.world",
			calls: [{ path: ["advanced", "nest2", "beta", "world"], args: [] }]
		},
		{
			section: "advanced.nest4.beta",
			calls: [{ path: ["advanced", "nest4", "beta"], args: ["singlefile"] }]
		},

		// exportDefault
		{ section: "exportDefault (default)", calls: [{ path: ["exportDefault"], args: [] }] },
		{
			section: "exportDefault.extra (named)",
			calls: [{ path: ["exportDefault", "extra"], args: [] }]
		},
		{
			section: "task.autoIP",
			calls: [{ path: ["task", "autoIP"], args: [] }]
		},
		{
			section: "tcp.testContext",
			calls: [{ path: ["tcp", "testContext"], args: [] }]
		},

		// utilities.helpers (Rule 11 test case - single file with named exports)
		{
			section: "utilities.helpers.parse",
			calls: [{ path: ["utilities", "helpers", "parse"], args: ['{"test":true}'] }]
		},

		// Rule 8 Pattern B: Mixed Export Flattening (C10)
		{
			section: "mixed (default)",
			calls: [{ path: ["mixed"], args: ["test message"] }]
		},
		{
			section: "mixed.mixedNamed",
			calls: [{ path: ["mixed", "mixedNamed"], args: ["test value"] }]
		},
		{
			section: "mixed.mixedAnother",
			calls: [{ path: ["mixed", "mixedAnother"], args: [5] }]
		},

		// Rule 8 Pattern C: Non-matching Object Export (C13)
		{
			section: "singletest.helper.utilities.format",
			calls: [{ path: ["singletest", "helper", "utilities", "format"], args: ["test input"] }]
		},
		{
			section: "singletest.helper.utilities.parse",
			calls: [{ path: ["singletest", "helper", "utilities", "parse"], args: ["test value"] }]
		},

		// Rule 9: Additional Function Name Preference Tests (actual API paths)
		{
			section: "task.parseJSON",
			calls: [{ path: ["task", "parseJSON"], args: ['{"key": "value"}'] }]
		},
		{
			section: "util.getHTTPStatus",
			calls: [{ path: ["util", "getHTTPStatus"], args: [200] }]
		},
		{
			section: "util.XMLParser",
			calls: [{ path: ["util", "XMLParser"], args: ["<root><item>test</item></root>"] }]
		},

		// empty folder test (Rule 5 verification - should create empty object)
		{
			section: "empty (empty folder/object)",
			calls: [{ path: ["empty"], args: [], isObject: true }]
		},

		// deep config
		{
			section: "deep.folder.config",
			// calls: [{ path: ["deep", "folder", "config"], args: [], isObject: true }]
			calls: [{ path: ["deep", "folder", "config", "get"], args: ["host"] }]
		}
	];

	let testCounter = 0;
	const testBeforeOutput = 40;

	console.log(chalk.green("\n===== TEST RUNNING START =====\n"));

	for (const test of tests) {
		verboseLog(chalk.magentaBright.bold(`--- Debug: ${test.section} ---`));
		for (const call of test.calls) {
			// Auto-generate label from path and args
			const pathStr = call.path.join(".");
			const argsStr = call.args.map((a) => JSON.stringify(a)).join(", ");
			let label;
			if (call.isObject) {
				// Object access - no parentheses
				label = `bound${pathStr ? "." + pathStr : ""}`;
			} else {
				// Function call - with parentheses and args
				label = `bound${pathStr ? "." + pathStr : ""}(${argsStr})`;
			}

			// Single-shot property access for correct Proxy getter behavior
			let fn;
			try {
				verboseLog("calling: " + chalk.cyanBright(`${awaitCalls ? "await " : ""}${label}`));
				if (pathStr) {
					fn = call.path.reduce((acc, key) => acc && acc[key], bound);
				} else {
					fn = bound;
				}

				// console.log("typeof bound: ", typeof bound);
				// console.log("typeof fn: ", typeof fn);

				// Capture console output during function execution
				const originalConsoleLog = console.log;
				const originalConsoleError = console.error;
				const originalConsoleWarn = console.warn;
				const capturedOutput = [];

				console.log = (...args) => {
					capturedOutput.push({ type: "log", args });
					if (verbose) originalConsoleLog(...args);
				};
				console.error = (...args) => {
					capturedOutput.push({ type: "error", args });
					originalConsoleError(...args);
				};
				console.warn = (...args) => {
					capturedOutput.push({ type: "warn", args });
					if (verbose) originalConsoleWarn(...args);
				};

				let result;
				if (call.isObject) {
					// Object access - just return the object/property, don't call it
					verboseLog("[DEBUG_SCRIPT] Accessing object property:", call.path.join("."));
					result = fn;
				} else if (typeof fn === "function") {
					verboseLog("[DEBUG_SCRIPT] About to call function with args:", call.args);
					if (awaitCalls) {
						result = await fn(...call.args);
					} else {
						result = fn(...call.args);
					}
				} else if (typeof fn === "object" && fn !== null) {
					// Handle objects - don't try to call them, just return the object
					verboseLog("[DEBUG_SCRIPT] Target is object, not function. Returning object directly.");
					result = fn;
				} else {
					// Fallback to eval for dynamic property/function chains
					const objName = "bound";
					const pathStr = call.path.join(".");
					if (call.isObject) {
						// Just access the property, don't call it
						const evalStr = `${objName}${pathStr ? "." + pathStr : ""}`;
						result = eval(evalStr);
					} else {
						// Call the function
						const argsStr = call.args.map((a) => JSON.stringify(a)).join(",");
						const evalStr = `${objName}${pathStr ? "." + pathStr : ""}(${argsStr})`;
						if (awaitCalls) {
							result = await eval(evalStr);
						} else {
							result = eval(evalStr);
						}
					}
				}

				// Restore original console methods
				console.log = originalConsoleLog;
				console.error = originalConsoleError;
				console.warn = originalConsoleWarn;

				// Format the result for better display
				let displayResult = result;
				if (result && typeof result === "object" && typeof result.then === "function") {
					// It's a Promise - show a short representation first
					const promiseName = result.constructor.name || "Promise";
					displayResult = `[${promiseName}: <pending>]`;
					console.log(chalk.cyanBright(`${awaitCalls ? "await " : ""}${label}`), displayResult);

					// If we're not already in await mode, also await and show the resolved value
					if (!awaitCalls) {
						try {
							const awaitedResult = await result;
							console.log(chalk.cyanBright(`await ${label}`), awaitedResult);

							// Check if awaited result is NaN
							if (Number.isNaN(awaitedResult)) {
								nanResults.push({
									path: label,
									mode: `${modeLabel} (awaited)`,
									result: awaitedResult,
									capturedOutput: capturedOutput
								});
							}
						} catch (e) {
							console.log(chalk.cyanBright(`await ${label}`), chalk.red(`[Promise rejected: ${e.message}]`));
							callErrors.push({
								path: label,
								mode: modeLabel,
								error: e.message,
								capturedOutput: capturedOutput
							});
						}
					} else {
						// Check if awaited promise result is NaN
						if (Number.isNaN(result)) {
							nanResults.push({
								path: label,
								mode: modeLabel,
								result: result,
								capturedOutput: capturedOutput
							});
						}
					}
				} else {
					console.log(chalk.cyanBright(`${awaitCalls ? "await " : ""}${label}`), displayResult);

					// Check if result is NaN
					if (Number.isNaN(result)) {
						nanResults.push({
							path: label,
							mode: modeLabel,
							result: result,
							capturedOutput: capturedOutput
						});
					}
				}
			} catch (e) {
				console.error(`Error calling ${label}:`, e);
				callErrors.push({
					path: label,
					mode: modeLabel,
					error: e.message,
					capturedOutput: []
				});
			}
			testCounter++;
			if (testCounter === testBeforeOutput) {
				verboseLog("bound api (after " + testCounter + " calls): ", bound);
			}
		}
	}
	// await slothlet.shutdown();

	console.log(chalk.green("\n===== TEST RUNNING END =====\n"));

	if (awaitCalls) verboseLog("bound api (after calls): ", bound);
	return bound;
}

(async () => {
	if (ensureDevEnvFlags()) {
		return;
	}

	const module = await import("@cldmv/slothlet");
	// Prefer default export, fallback to named, then module itself
	slothlet = module?.default ?? module?.slothlet ?? module;
	if (typeof slothlet !== "function") {
		throw new Error("slothlet entrypoint did not export a callable function");
	}

	// Check for mode-specific arguments
	const eagerOnly = process.argv.includes("--eager");
	const lazyOnly = process.argv.includes("--lazy");

	if (eagerOnly && lazyOnly) {
		throw new Error("Cannot specify both --eager and --lazy. Choose one or neither.");
	}

	if (eagerOnly) {
		console.log("\n" + chalk.yellowBright.bold("===== EAGER MODE TEST ONLY ====="));
		console.log(chalk.cyanBright("Running EAGER mode tests...\n"));
		await runDebug({ mode: "eager" }, "EAGER", false);
		console.log(chalk.cyanBright("FINISHED EAGER mode tests...\n"));
		console.log("\n" + chalk.yellowBright.bold("===== COMPLETED EAGER MODE TEST ====="));
		return;
	}

	if (lazyOnly) {
		console.log("\n" + chalk.yellowBright.bold("===== LAZY MODE TEST ONLY ====="));
		console.log(chalk.cyanBright("Running LAZY mode tests...\n"));
		await runDebug({ mode: "lazy" }, "LAZY", true);
		console.log(chalk.cyanBright("FINISHED LAZY mode tests...\n"));
		console.log("\n" + chalk.yellowBright.bold("===== COMPLETED LAZY MODE TEST ====="));
		return;
	}

	console.log("\n" + chalk.yellowBright.bold("===== EAGER & LAZY MODE TEST ====="));
	console.log(chalk.cyanBright("Running EAGER & LAZY mode tests...\n"));

	let label = "EAGER";
	let awaitCalls = false;
	const _eagerBound = await runDebug({ mode: "eager" }, label, awaitCalls);
	console.log(chalk.cyanBright("FINISHED EAGER mode tests...\n"));

	label = "LAZY";
	awaitCalls = true;
	const _lazyBound = await runDebug({ mode: "lazy" }, label, awaitCalls);
	console.log(chalk.cyanBright("FINISHED LAZY mode tests...\n"));

	console.log("\n" + chalk.yellowBright.bold("===== COMPLETED EAGER & LAZY MODE TEST ====="));

	await materializeLazyWrappers(_lazyBound);

	const compared = compareApiShapes(_eagerBound, _lazyBound);

	// Show verification of what was checked
	console.log(chalk.blueBright(`🔍 Paths checked: ${compared.checkedPaths.length} total`));
	console.log(chalk.gray("Sample paths checked:"));
	compared.checkedPaths.slice(0, 10).forEach((path) => console.log(chalk.gray(`  • ${path}`)));
	if (compared.checkedPaths.length > 10) {
		console.log(chalk.gray(`  ... and ${compared.checkedPaths.length - 10} more`));
	}
	console.log();

	// Track if any errors occurred
	let hasErrors = false;

	// Error Summary Section
	if (nanResults.length === 0 && callErrors.length === 0) {
		console.log(chalk.greenBright("✅ No NaN results or call errors detected!"));
	} else {
		hasErrors = true;
		console.log(chalk.redBright.bold("\n===== ERROR SUMMARY ====="));

		if (nanResults.length > 0) {
			console.log(chalk.redBright("⚠️  Functions returning NaN:"));
			nanResults.forEach((item) => {
				console.log(chalk.red(`  - [${item.mode}] ${item.path} (${item.mode}) → NaN`));
				if (item.capturedOutput && item.capturedOutput.length > 0) {
					console.log(chalk.gray(`    Function console output:`));
					item.capturedOutput.forEach((output) => {
						const formattedArgs = output.args
							.map((arg) => {
								if (typeof arg === "string") return arg;
								if (typeof arg === "function") return `[Function: ${arg.name || "anonymous"}]`;
								if (typeof arg === "object" && arg !== null) return JSON.stringify(arg, null, 2);
								return String(arg);
							})
							.join(" ");
						console.log(chalk.gray(`      [${output.type}] ${formattedArgs}`));
					});
				}
			});
			console.log();
		}

		if (callErrors.length > 0) {
			console.log(chalk.redBright("⚠️  Function call errors:"));
			callErrors.forEach((item) => {
				console.log(chalk.red(`  - [${item.mode}] ${item.path} (${item.mode}) → ${item.error}`));
				if (item.capturedOutput && item.capturedOutput.length > 0) {
					console.log(chalk.gray(`    Function console output:`));
					item.capturedOutput.forEach((output) => {
						const formattedArgs = output.args
							.map((arg) => {
								if (typeof arg === "string") return arg;
								if (typeof arg === "function") return `[Function: ${arg.name || "anonymous"}]`;
								if (typeof arg === "object" && arg !== null) return JSON.stringify(arg, null, 2);
								return String(arg);
							})
							.join(" ");
						console.log(chalk.gray(`      [${output.type}] ${formattedArgs}`));
					});
				}
			});
			console.log();
		}
	}
	console.log();

	// COMPARISON DISABLED - only running lazy mode
	if (compared.onlyInA.length > 0) {
		hasErrors = true;
		console.log(chalk.redBright("⚠️  Properties only in LAZY:"));
		compared.onlyInA.forEach((path) => console.log(`  - ${path}`));
		console.log();
	}

	if (compared.onlyInB.length > 0) {
		hasErrors = true;
		console.log(chalk.redBright("⚠️  Properties only in EAGER:"));
		compared.onlyInB.forEach((path) => console.log(`  - ${path}`));
		console.log();
	}

	if (compared.differingFunctions.length > 0) {
		hasErrors = true;
		console.log(chalk.yellowBright("⚠️  Function signature differences:"));
		compared.differingFunctions.forEach((diff) => {
			console.log(`  - ${diff.path}: ${diff.aSignature} [eager] vs ${diff.bSignature} [lazy]`);
			if (diff.aToString && diff.bToString) {
				console.log(chalk.gray(`    Eager toString: ${diff.aToString}`));
				console.log(chalk.gray(`    Lazy toString:  ${diff.bToString}`));
			}
		});
		console.log();
	}

	if (compared.differingValues.length > 0) {
		// Filter out instanceId differences (expected to be different between instances)
		const significantDifferences = compared.differingValues.filter((diff) => diff.path !== "instanceId");

		if (significantDifferences.length > 0) {
			hasErrors = true;
			console.log(chalk.yellowBright("⚠️  Value differences:"));
			significantDifferences.forEach((diff) => {
				const aValueStr = typeof diff.aValue === "function" ? "[Function]" : diff.aValue;
				const bValueStr = typeof diff.bValue === "function" ? "[Function]" : diff.bValue;
				console.log(`  - ${diff.path}: (${diff.aType}) ${aValueStr} vs (${diff.bType}) ${bValueStr}`);
			});
			console.log();
		}
	}

	// Filter out expected nested differences (mode configs naturally differ between eager and lazy)
	const significantNestedDifferences = compared.nestedDifferences.filter(
		(diff) =>
			diff.path !== "__slothletInstance.debugLogger.config.mode" &&
			diff.path !== "__slothletInstance.config.mode" &&
			diff.path !== "__slothletInstance.handlers.metadata._instanceId" &&
			diff.path !== "__slothletInstance.handlers.apiManager.state.initialConfig.mode" &&
			!diff.path.includes("prototype.constructor.__slothletInstance.debugLogger.config.mode") &&
			!diff.path.includes("prototype.constructor.__slothletInstance.config.mode") &&
			!diff.path.includes("prototype.constructor.__slothletInstance.handlers.apiManager.state.initialConfig.mode") &&
			!diff.path.includes("prototype.constructor.__slothletInstance.handlers.metadata._instanceId") &&
			// __childFilePaths is lazy-mode only metadata for file path tracking (expected difference)
			!diff.path.includes("__childFilePaths")
	);

	if (significantNestedDifferences.length > 0) {
		hasErrors = true;
		console.log(chalk.magentaBright("🔍 Nested differences:"));
		significantNestedDifferences.forEach((diff) => {
			const typeLabel = diff.type === "onlyInA" ? "only in eager" : diff.type === "onlyInB" ? "only in lazy" : diff.type;
			console.log(`  - [${typeLabel}] ${diff.path}`);
		});
		console.log();
	}

	if (
		compared.onlyInA.length === 0 &&
		compared.onlyInB.length === 0 &&
		compared.differingFunctions.length === 0 &&
		compared.differingValues.length === 0 &&
		significantNestedDifferences.length === 0
	) {
		console.log(chalk.greenBright("✅ APIs are structurally identical!"));
	}

	// console.log(chalk.gray("\nFull list of checked paths:"));
	// compared.checkedPaths.forEach(path => console.log(chalk.gray(`  ${path}`)));

	// console.log(chalk.gray("\nRaw comparison object:"));
	// console.log(compared);

	await _eagerBound.shutdown();
	await _lazyBound.shutdown();

	// Exit with error code if any errors occurred
	if (hasErrors) {
		console.log(chalk.redBright("\n❌ Debug tests detected issues!"));
		process.exit(1);
	}

	console.log(chalk.greenBright("\n✅ All debug tests passed!"));
})();
