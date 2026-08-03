/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/debug-slothlet.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-27 20:16:27 -07:00 (1779938187)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import chalk from "chalk";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Populated after ensureDevEnvFlags() confirms slothlet-dev condition is active.
// Must NOT be a static top-level import - that fires before the respawn check and
// fails when NODE_OPTIONS=--conditions=slothlet-dev is not yet set.
let resolveWrapper;
// Framework-metadata names the production surface filters from enumeration. Imported rather than
// re-listed so the comparator can never drift from what the real api exposes.
let IMPL_METADATA_KEYS;
// The surface's own reserved-name predicate. Same reason: a hand-rolled underscore-prefix test here
// would hide a module's `_x` folder or export from the walker and let mode drift on it go unseen.
let isFrameworkReservedKey;

let slothlet;
const verbose =
	process.argv.includes("--verbose") ||
	process.env.SLOTHLET_DEBUG_SCRIPT_VERBOSE === "1" ||
	process.env.SLOTHLET_DEBUG_SCRIPT_VERBOSE === "true";

function ensureDevEnvFlags() {
	const distPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../dist");
	if (existsSync(distPath)) {
		return false;
	}

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
	const ____allConditions = [...allExecArgv, ...envOptions];

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

	process.stderr.write(
		`[debug-slothlet] Missing env flags detected - relaunching with: NODE_ENV=development NODE_OPTIONS="${process.env.NODE_OPTIONS}"\n` +
			`[debug-slothlet] All output below is from the respawned child process.\n` +
			`[debug-slothlet] -------------------------------------------------------\n`
	);

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
		const wrapper = resolveWrapper(value);
		if (wrapper && typeof wrapper === "object") {
			const impl = wrapper.____slothletInternal.impl;
			// Children are stored directly on the wrapper, not in a separate childCache.
			// Reserved by exact name, not by underscore prefix: a `_x`-named folder is a scanned module
			// (only `.`/`__` entries are hidden — docs/MODULE-STRUCTURE.md), so a prefix test here would
			// drop a real child from the walker and make mode drift on it undetectable.
			const childKeys = Object.keys(wrapper).filter((k) => !isFrameworkReservedKey(k));
			if (impl && typeof impl === "object") {
				// The real surface's enumeration filters framework metadata off the impl; mirror it or
				// the walker reports keys no caller can see.
				const descriptors = Object.getOwnPropertyDescriptors(impl);
				for (const metaKey of IMPL_METADATA_KEYS) {
					delete descriptors[metaKey];
				}
				const view = Object.create(Object.getPrototypeOf(impl) || Object.prototype, descriptors);
				// Add children from wrapper
				for (const key of childKeys) {
					if (!Object.prototype.hasOwnProperty.call(view, key)) {
						Object.defineProperty(view, key, {
							value: wrapper[key],
							writable: false,
							enumerable: true,
							configurable: true
						});
					}
				}
				return view;
			}
			if (impl && typeof impl === "function") {
				// A callable slot: members live partly on the function and partly as wrapper children
				// (lazy pre-populates collision keys there; eager attaches siblings there). Both modes
				// must normalize to the same callable view or the walker reports phantom diffs the real
				// surface does not have.
				const callableView = function (...args) {
					return impl.apply(this, args);
				};
				callableView.toString = () => impl.toString();
				// Wrapper children SHADOW impl members on the real surface (getTrap serves children
				// first), so the view defines them first and lets impl descriptors fill only the gaps.
				for (const key of childKeys) {
					Object.defineProperty(callableView, key, { value: wrapper[key], writable: false, enumerable: true, configurable: true });
				}
				for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(impl))) {
					if (key === "length" || key === "name" || key === "prototype" || IMPL_METADATA_KEYS.has(key)) continue;
					if (Object.prototype.hasOwnProperty.call(callableView, key)) continue;
					Object.defineProperty(callableView, key, { ...desc, configurable: true });
				}
				return callableView;
			}
			if ((impl === null || impl === undefined) && childKeys.length > 0) {
				const view = {};
				for (const key of childKeys) {
					view[key] = wrapper[key];
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
	const shouldSkipKey = (key, ____obj) => {
		// Always skip internal path properties - these may differ between modes
		// but don't affect user-facing API behavior
		if (key === "____slothletInternal") {
			return true;
		}
		if (key === "instanceID") {
			return true;
		}
		// Skip ____slothlet property (inherited from ComponentBase, not part of user API)
		if (key === "____slothlet") {
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
 * Compares two composed API surfaces using only the operations a caller has.
 *
 * @param {unknown} a - Eager-composed value.
 * @param {unknown} b - Lazy-composed value.
 * @param {string} [pathPrefix] - Dotted path of the current node, for messages.
 * @param {string[]} [out] - Accumulator for difference descriptions.
 * @param {WeakSet<object>} [seen] - Cycle guard over already-visited eager nodes.
 * @param {number} [depth] - Current recursion depth.
 * @returns {string[]} Difference descriptions; empty when the surfaces agree.
 *
 * @description
 * {@link compareApiShapes} normalizes every wrapper to its RAW IMPL before comparing, so it cannot
 * see a difference that lives in the proxy traps — which is exactly how underscore-prefixed exports
 * came to be served by eager and dropped by lazy without this script noticing. This comparator never
 * touches `____slothletInternal`: it enumerates with `Object.keys`, reads properties, and asks `in`
 * and `getOwnPropertyDescriptor`, so a trap that disagrees with its siblings — or with the other
 * mode — shows up as a difference.
 *
 * @example
 * const diffs = compareSurfaceShapes(eagerApi.mod, lazyApi.mod, "mod");
 * // [] when both modes expose the same members with the same values.
 */
export function compareSurfaceShapes(a, b, pathPrefix = "", out = [], seen = new WeakSet(), depth = 0) {
	const label = pathPrefix || "<root>";
	// Container vs leaf, deliberately NOT `typeof`: a lazy namespace proxy is built on a callable
	// target so `typeof` reports "function" where eager reports "object". That is mode-inherent, not
	// drift, and {@link compareApiShapes} already compares impl callability. What must match here is
	// which members each mode publishes.
	const kindOf = (v) => (v === null || v === undefined ? "empty" : typeof v === "object" || typeof v === "function" ? "container" : "leaf");
	if (kindOf(a) !== kindOf(b)) {
		out.push(`${label}: kind eager=${kindOf(a)}(${typeof a}) lazy=${kindOf(b)}(${typeof b})`);
		return out;
	}
	if (kindOf(a) !== "container") {
		if (!Object.is(a, b)) {
			out.push(`${label}: value eager=${String(a)} lazy=${String(b)}`);
		}
		return out;
	}
	// Depth cap and cycle guard: api trees can reference themselves through `self`.
	if (depth >= 12 || seen.has(/** @type {object} */ (a))) {
		return out;
	}
	seen.add(/** @type {object} */ (a));

	/**
	 * @param {object|Function} obj - Surface node to enumerate.
	 * @returns {string[]} Member names the node publishes to a caller.
	 */
	const surfaceKeys = (obj) =>
		Object.keys(obj).filter((k) => !isFrameworkReservedKey(k) && !["slothlet", "shutdown", "destroy", "instanceID"].includes(k));

	const keysA = surfaceKeys(/** @type {object} */ (a));
	const keysB = surfaceKeys(/** @type {object} */ (b));
	for (const key of keysA.filter((k) => !keysB.includes(k))) {
		out.push(`${label}.${key}: enumerated by eager only`);
	}
	for (const key of keysB.filter((k) => !keysA.includes(k))) {
		out.push(`${label}.${key}: enumerated by lazy only`);
	}

	for (const key of keysA.filter((k) => keysB.includes(k))) {
		const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
		// A key `Object.keys` reports must also answer `in` and yield a descriptor, in both modes —
		// trap-by-trap disagreement is a defect even when both modes disagree the same way.
		for (const [mode, obj] of [
			["eager", a],
			["lazy", b]
		]) {
			if (!(key in /** @type {object} */ (obj))) {
				out.push(`${childPath}: enumerated by ${mode} but absent from \`in\``);
			}
			if (!Object.getOwnPropertyDescriptor(obj, key)) {
				out.push(`${childPath}: enumerated by ${mode} but has no descriptor`);
			}
		}
		let valueA, valueB;
		try {
			valueA = /** @type {Record<string, unknown>} */ (a)[key];
			valueB = /** @type {Record<string, unknown>} */ (b)[key];
		} catch (error) {
			out.push(`${childPath}: read threw ${/** @type {Error} */ (error).message}`);
			continue;
		}
		compareSurfaceShapes(valueA, valueB, childPath, out, seen, depth + 1);
	}
	return out;
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

		const currentWrapper = resolveWrapper(current);
		if (currentWrapper && typeof current._materialize === "function") {
			const state = currentWrapper.____slothletInternal.state;
			if (state && !state.materialized && !state.inFlight) {
				await current._materialize();
			}
		}

		const keys = new Set([...Object.getOwnPropertyNames(current), ...Object.keys(current)]);
		for (const key of keys) {
			if (typeof key === "string") {
				// Exact reserved names, not an underscore prefix: a `_x`-named folder is a real module,
				// and skipping it here would leave that subtree unmaterialized and thus uncompared.
				if (isFrameworkReservedKey(key)) {
					continue;
				}
				if (currentType === "function" && ["toString", "valueOf", "apply", "bind", "call", "prototype", "name", "length"].includes(key)) {
					continue;
				}
			}
			try {
				queue.push(current[key]);
			} catch (____error) {
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
	// await slothlet.load({ ...config, base: "./api_test" });
	// const bound = slothlet.createBoundApi({});
	let bound;
	// if (awaitCalls) {

	// Use V3 API test directory
	const apiTestDir = "../api_tests/api_test";

	// if (modeLabel === "EAGER") bound = await slothletEager({ ...config, base: "../api_test", api_mode: "function", reference: { md5 } });
	// else bound = await slothletLazy({ ...config, base: "../api_test", api_mode: "function", reference: { md5 } });
	bound = await slothlet({ ...config, base: apiTestDir, reference: { md5 } });

	// bound = await slothlet.create({ ...config, base: "./api_test" });
	// } else {
	// 	bound = slothlet.create({ ...config, base: "./api_test" });
	// }
	// const bound = await slothlet.create({ ...config, debug: true, base: "./api_test" });
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

		// notifications (C02/C03 multi-default test)
		{ section: "notifications.email", calls: [{ path: ["notifications", "email"], args: ["test@example.com", "hello"] }] },
		{ section: "notifications.sms", calls: [{ path: ["notifications", "sms"], args: ["5551234567", "hello"] }] },
		{ section: "notifications.formatPhone", calls: [{ path: ["notifications", "formatPhone"], args: ["5551234567"] }] },

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

	// Now safe to import - slothlet-dev condition is active
	({ resolveWrapper, IMPL_METADATA_KEYS, isFrameworkReservedKey } = await import("#handlers/unified-wrapper"));

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

	// Second parity pass over the collision fixture base: api_test carries no same-name
	// file+directory pairs, so mode drift on collision composition was invisible to the main
	// compare — that is exactly how the eager/lazy collision divergence fixed against the
	// documented MIGRATION.md table went unnoticed. Booting both modes over the dedicated
	// collision base keeps that family under comparison permanently.
	// The framework's own control tree (api.slothlet, shutdown, destroy) carries mode-varying
	// STATUS fields (e.g. materialize.materialized) — legitimate differences, not composition
	// drift. Parity passes compare the composed USER surface only.
	const pickUserSurface = (apiObj) => {
		const view = {};
		for (const key of Object.keys(apiObj)) {
			if (key === "slothlet" || key === "shutdown" || key === "destroy" || key.startsWith("____")) continue;
			view[key] = apiObj[key];
		}
		return view;
	};
	let collisionParityFailed = false;
	{
		const collisionBase = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../api_tests/api_test_collisions");
		const eagerCollisions = await slothlet({ mode: "eager", base: collisionBase });
		const lazyCollisions = await slothlet({ mode: "lazy", base: collisionBase });
		await materializeLazyWrappers(lazyCollisions);
		const collisionCompared = compareApiShapes(pickUserSurface(eagerCollisions), pickUserSurface(lazyCollisions));
		const collisionDiffs =
			collisionCompared.onlyInA.length +
			collisionCompared.onlyInB.length +
			collisionCompared.differingFunctions.length +
			collisionCompared.differingValues.length +
			collisionCompared.nestedDifferences.length;
		if (collisionDiffs > 0) {
			console.log(chalk.redBright(`❌ Collision-base parity: ${collisionDiffs} difference(s) between eager and lazy`));
			console.log(JSON.stringify(collisionCompared, null, 2));
			collisionParityFailed = true;
		} else {
			console.log(
				chalk.greenBright(`✅ Collision-base parity: eager and lazy compose identically (${collisionCompared.checkedPaths.length} paths)`)
			);
		}
		await eagerCollisions.shutdown();
		await lazyCollisions.shutdown();
	}
	// Third parity pass: the same collision base MOUNTED AT RUNTIME via api.add(). Runtime
	// mounting takes its own composition path (mount-prefix hoisting, addApi collision context),
	// which has drifted from the initial build independently before — an add-mounted subtree must
	// compose identically to a boot-time one, in both modes, or this pass fails the script.
	{
		const collisionBase = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../api_tests/api_test_collisions");
		const neutralBase = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../api_tests/api_test");
		const eagerHost = await slothlet({ mode: "eager", base: neutralBase });
		const lazyHost = await slothlet({ mode: "lazy", base: neutralBase });
		await eagerHost.slothlet.api.add("mounted", collisionBase);
		await lazyHost.slothlet.api.add("mounted", collisionBase);
		await materializeLazyWrappers(lazyHost);
		const mountCompared = compareApiShapes(pickUserSurface(eagerHost.mounted), pickUserSurface(lazyHost.mounted));
		const mountDiffs =
			mountCompared.onlyInA.length +
			mountCompared.onlyInB.length +
			mountCompared.differingFunctions.length +
			mountCompared.differingValues.length +
			mountCompared.nestedDifferences.length;
		if (mountDiffs > 0) {
			console.log(chalk.redBright(`❌ Mounted collision-base parity: ${mountDiffs} difference(s) between eager and lazy`));
			console.log(JSON.stringify(mountCompared, null, 2));
			collisionParityFailed = true;
		} else {
			console.log(
				chalk.greenBright(
					`✅ Mounted collision-base parity: eager and lazy compose identically (${mountCompared.checkedPaths.length} paths)`
				)
			);
		}
		await eagerHost.shutdown();
		await lazyHost.shutdown();
	}
	// Fourth parity pass: underscore-prefixed EXPORT names, compared through the SURFACE. `api_test`
	// carries none, and the passes above normalize each wrapper to its raw impl, so a mode that
	// mistook the prefix for a framework marker could drop such members from the composed api under
	// lazy while eager served them without anything here noticing. This base puts `__priv` / `_semi`
	// on a self-named file, on a clash file, and behind a `self` read, and compares what a caller can
	// actually enumerate, read, and describe.
	{
		const underscoreBase = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../api_tests/api_test_underscore");
		const eagerUnderscore = await slothlet({ mode: "eager", base: underscoreBase });
		const lazyUnderscore = await slothlet({ mode: "lazy", base: underscoreBase });
		await materializeLazyWrappers(lazyUnderscore);
		const underscoreDiffs = compareSurfaceShapes(pickUserSurface(eagerUnderscore), pickUserSurface(lazyUnderscore));
		if (underscoreDiffs.length > 0) {
			console.log(chalk.redBright(`❌ Underscore-export surface parity: ${underscoreDiffs.length} difference(s) between eager and lazy`));
			underscoreDiffs.forEach((diff) => console.log(chalk.red(`  - ${diff}`)));
			collisionParityFailed = true;
		} else {
			console.log(chalk.greenBright(`✅ Underscore-export surface parity: eager and lazy expose the same members`));
		}
		await eagerUnderscore.shutdown();
		await lazyUnderscore.shutdown();
	}

	// Show verification of what was checked
	console.log(chalk.blueBright(`🔍 Paths checked: ${compared.checkedPaths.length} total`));
	console.log(chalk.gray("Sample paths checked:"));
	compared.checkedPaths.slice(0, 10).forEach((path) => console.log(chalk.gray(`  • ${path}`)));
	if (compared.checkedPaths.length > 10) {
		console.log(chalk.gray(`  ... and ${compared.checkedPaths.length - 10} more`));
	}
	console.log();

	// Track if any errors occurred
	let hasErrors = collisionParityFailed;

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
