/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/dev/inspect-api-structure.mjs
 *	@Date: 2025-10-23T12:08:52-07:00 (1761246532)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:47-08:00 (1794882647)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Loads a Slothlet API folder and prints the full API tree: all
 * callable paths, lazy vs eager status, function signatures, and nested
 * namespace structure. Useful for verifying module wiring and debugging load issues.
 * @module @cldmv/slothlet/tools/inspect-api-structure
 * @title npm run inspect
 *
 * @example
 * // Run via npm script (inspect api_test folder)
 * npm run inspect -- api_test
 *
 * @example
 * // Use eager loading
 * npm run inspect -- api_test --eager
 *
 * @example
 * // Override traversal depth
 * npm run inspect -- api_test --depth 4
 *
 * @example
 * // Use live runtime
 * npm run inspect -- api_test --runtime live
 *
 * @example
 * // Raw util.inspect output
 * npm run inspect -- api_test --raw
 *
 * @description
 * **CLI Options:**
 *
 * | Option | Default | Description |
 * | --- | --- | --- |
 * | `<api-name>` | — | Name of the `api_tests/` folder to load (required) |
 * | `--depth <n>` | `8` | Maximum tree traversal depth |
 * | `--lazy` | ✓ | Use lazy loading mode (default) |
 * | `--eager` | | Use eager loading mode |
 * | `--raw` | | Print raw `util.inspect` output only |
 * | `--runtime <type>` | `async` | Context runtime: `async` or `live` |
 * | `--apiDepth <n>` | unlimited | Slothlet `depth` config option |
 * | `--debug` | | Enable Slothlet debug output |
 * | `--hooks` | | Enable lifecycle hooks |
 * | `--help` / `-h` | | Show usage information |
 */

import chalk from "chalk";
import { spawn } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "url";
import { existsSync } from "node:fs";
import path from "node:path";
import util from "node:util";
// Loaded with a dynamic import once ensureDevEnvFlags() has respawned with the dev conditions,
// so it resolves to src/.
let slothlet;

/**
 * Ensure slothlet dev conditions are set for V3.
 * @returns {boolean} True if a child process was spawned.
 * @internal
 */
function ensureDevEnvFlags() {
	const distPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../dist");
	if (existsSync(distPath)) {
		return false;
	}

	/**
	 * @internal
	 * @param {string[]} args
	 * @param {string} condition
	 * @returns {boolean}
	 */
	const hasCondition = (args, condition) =>
		args.some((arg) => arg.startsWith("--conditions=") && arg.slice("--conditions=".length).split(/[|,]/u).includes(condition));

	process.env.NODE_ENV = "development";

	const desiredCondition = "slothlet-dev";
	const requiredConditions = [desiredCondition, "development"];

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

/**
 * Api paths whose contents the tool never prints, relative to the api root. `slothlet.env` is the process
 * environment: printing it writes every environment variable (a CI job's included) to the output and, through
 * the structures test's failure message, to the test log (#759). The node is shown as present, its contents not.
 * @type {Set<string>}
 * @internal
 */
const WITHHELD_PATHS = new Set(["slothlet.env"]);

/**
 * Whether a displayed path (the api folder's name, then the api path) names a node whose contents are withheld.
 * @param {string} displayPath - The path as the structure display builds it, e.g. `api_test.slothlet.env`.
 * @returns {boolean} True for a withheld node.
 * @internal
 */
function isWithheldDisplayPath(displayPath) {
	const dot = displayPath.indexOf(".");
	return dot !== -1 && WITHHELD_PATHS.has(displayPath.slice(dot + 1));
}

/**
 * The api as the tool prints it with `util.inspect`: the root's members as they are, each withheld path's contents
 * replaced by a marker. `util.inspect(api)` shows the root's members (`slothlet.env` included) as the host reads them,
 * so the printed api is built from them rather than the api itself.
 * @param {object|Function} api - The api.
 * @returns {object} What the tool prints.
 * @internal
 */
function printableApi(api) {
	const withheld = { [util.inspect.custom]: () => "[withheld]" };
	const shown = { ...api };
	for (const withheldPath of WITHHELD_PATHS) {
		const parts = withheldPath.split(".");
		let holder = shown;
		for (const part of parts.slice(0, -1)) {
			if (holder[part] === null || typeof holder[part] !== "object") break;
			holder = holder[part] = { ...holder[part] };
		}
		const last = parts[parts.length - 1];
		if (Object.hasOwn(holder, last)) holder[last] = withheld;
	}
	return shown;
}

/**
 * Display the structure of an object or function recursively.
 * @param {any} obj - Object to inspect
 * @param {string} [path=""] - Current path for display
 * @param {number} [depth=0] - Current recursion depth
 * @param {number} [maxDepth=8] - Maximum depth to traverse
 * @param {WeakSet} [visited=new WeakSet()] - Visited objects to prevent cycles
 * @returns {string[]} Array of formatted strings describing the structure
 * @internal
 */
function inspectApiStructure(obj, path = "", depth = 0, maxDepth = 8, visited = new WeakSet()) {
	const indent = "  ".repeat(depth);
	const results = [];

	// Prevent infinite recursion
	if (depth > maxDepth || (obj && typeof obj === "object" && visited.has(obj))) {
		results.push(`${indent}${chalk.yellow("[circular or max depth]")}`);
		return results;
	}

	if (obj && typeof obj === "object") {
		visited.add(obj);
	}

	// Handle functions (including callable objects)
	if (typeof obj === "function") {
		const functionInfo = [];

		// Show if it's async
		if (obj.constructor.name === "AsyncFunction") {
			functionInfo.push(chalk.cyan("async"));
		}

		// Show parameter count
		functionInfo.push(chalk.blue(`(${obj.length} params)`));

		// Show function name if different from path
		if (obj.name && obj.name !== path.split(".").pop()) {
			functionInfo.push(chalk.green(`name: ${obj.name}`));
		}

		results.push(`${indent}${chalk.magenta("function")} ${functionInfo.join(" ")}`);

		// Check for properties on the function
		const ownProps = Object.getOwnPropertyNames(obj).filter(
			(prop) => prop !== "length" && prop !== "name" && prop !== "prototype" && prop !== "constructor"
		);

		if (ownProps.length > 0) {
			results.push(`${indent}${chalk.gray("  Properties:")}`);
			for (const prop of ownProps) {
				try {
					const value = obj[prop];
					const newPath = path ? `${path}.${prop}` : prop;
					results.push(`${indent}  ${chalk.yellow(prop)}:`);
					if (isWithheldDisplayPath(newPath)) results.push(`${indent}    ${chalk.gray("[contents not shown]")}`);
					else results.push(...inspectApiStructure(value, newPath, depth + 2, maxDepth, visited));
				} catch (_) {
					results.push(`${indent}  ${chalk.yellow(prop)}: ${chalk.red("[error accessing]")}`);
				}
			}
		}
	}
	// Handle objects
	else if (obj && typeof obj === "object") {
		const keys = Object.keys(obj);
		if (keys.length === 0) {
			results.push(`${indent}${chalk.gray("empty object")}`);
		} else {
			for (const key of keys) {
				try {
					const value = obj[key];
					const newPath = path ? `${path}.${key}` : key;

					// Type indicator
					let typeInfo = "";
					if (typeof value === "function") {
						typeInfo = chalk.magenta("function");
					} else if (Array.isArray(value)) {
						typeInfo = chalk.blue(`array[${value.length}]`);
					} else if (value && typeof value === "object") {
						typeInfo = chalk.cyan("object");
					} else {
						typeInfo = chalk.gray(typeof value);
					}

					results.push(`${indent}${chalk.yellow(key)}: ${typeInfo}`);

					if (isWithheldDisplayPath(newPath)) {
						results.push(`${indent}  ${chalk.gray("[contents not shown]")}`);
					} else if (depth < maxDepth) {
						results.push(...inspectApiStructure(value, newPath, depth + 1, maxDepth, visited));
					}
				} catch (_) {
					// Try to detect if this is a lazy folder by checking the descriptor
					try {
						const descriptor = Object.getOwnPropertyDescriptor(obj, key);
						if (
							descriptor &&
							"value" in descriptor &&
							typeof descriptor.value === "function" &&
							typeof descriptor.value.name === "string" &&
							descriptor.value.name.includes("lazy")
						) {
							results.push(`${indent}${chalk.yellow(key)}: ${chalk.blue("function (lazy folder)")}`);
							results.push(`${indent}  ${chalk.gray("Name:")} ${chalk.cyan(descriptor.value.name)}`);
							results.push(`${indent}  ${chalk.gray("[Access a property to trigger materialization]")}`);
						} else {
							results.push(`${indent}${chalk.yellow(key)}: ${chalk.red("[error accessing]")}`);
						}
					} catch {
						results.push(`${indent}${chalk.yellow(key)}: ${chalk.red("[error accessing]")}`);
					}
				}
			}
		}
	}
	// Handle primitives
	else {
		const valueStr = typeof obj === "string" ? `"${obj}"` : String(obj);
		results.push(`${indent}${chalk.gray(typeof obj)}: ${chalk.white(valueStr)}`);
	}

	return results;
}

/**
 * How deep the load and materialize walks go. A function can hold itself as a member (`fn.me = fn`), and each read of
 * it is a node one level deeper (`me.me…`, as plain JavaScript reads it), so a walk keyed on node identity alone
 * never ends.
 * @type {number}
 */
const WALK_DEPTH = 24;

/**
 * Load every node of a lazy api, so it is inspected as eager composes it: once loaded, a lazy node is
 * what eager builds. An unloaded lazy node is a thenable function proxy, and awaiting it loads it; a
 * loaded node is not thenable. A node that fails to load (a module refused at load, say) throws here,
 * as eager's load does, and is reported as the api's load error.
 * @param {any} api - The API object to load.
 * @returns {Promise<void>}
 * @internal
 */
async function forceMaterializeLazyFolders(api) {
	if (!api) return;
	console.log(chalk.gray("  Loading every lazy node..."));
	const seen = new Set();
	const load = async (node, isRoot, depth) => {
		if (depth > WALK_DEPTH) return;
		for (const key of Object.keys(node)) {
			if (isRoot && (key === "slothlet" || key === "shutdown" || key === "destroy")) continue;
			let child;
			// A member whose read throws (a getter that fails on purpose) is not a load failure; loading is the
			// await below.
			try {
				child = node[key];
			} catch {
				continue;
			}
			if (child === null || (typeof child !== "object" && typeof child !== "function") || seen.has(child)) continue;
			seen.add(child);
			if (typeof child === "function" && typeof child.then === "function") child = await child;
			if (child !== null && (typeof child === "object" || typeof child === "function")) await load(child, false, depth + 1);
		}
	};
	await load(api, true, 0);
}

/**
 * Main inspection function that loads an API and displays its structure.
 * @param {string} apiName - Name of the API folder in api_tests (e.g., "api_test", "api_test_cjs")
 * @param {object} [options] - Options for display
 * @param {number} [options.maxDepth=8] - Maximum depth to traverse
 * @param {boolean} [options.showMethods=false] - Whether to show available methods for functions
 * @param {boolean} [options.raw=false] - Output only the raw API via console.log
 * @param {object} [options.slothletConfig] - Configuration for slothlet initialization
 * @returns {Promise<void>}
 * @internal
 */
async function inspectApi(apiName, options = {}) {
	const { maxDepth = 8, lazy = true, raw = false, slothletConfig = {} } = options;

	// Ensure correct environment is set (will respawn if needed)
	if (ensureDevEnvFlags()) {
		return;
	}

	// Dynamic import after the dev-env gate so it resolves under the slothlet-dev condition.
	if (!slothlet) {
		slothlet = (await import("@cldmv/slothlet")).default;
	}

	const mode = lazy ? "lazy" : "eager";
	if (!raw) {
		console.log(chalk.cyan("Using v3 (src/)"));
	}
	console.log(chalk.bold.blue(`\n=== Inspecting API: ${apiName} (${mode} mode) ===\n`));

	try {
		// Use V3 api_tests base path
		const basePath = "./api_tests";
		const apiPath = `${basePath}/${apiName}`;
		console.log(chalk.gray(`Loading from: ${apiPath}`));

		// Build slothlet configuration (both v2 and v3 use 'mode' now)
		const config = {
			base: apiPath,
			mode: lazy ? "lazy" : "eager",
			...(slothletConfig.runtime ? { runtime: slothletConfig.runtime } : {}),
			...slothletConfig
		};

		console.log(chalk.gray(`Configuration:`, JSON.stringify(config, null, 2)));

		// Load the API
		const api = await slothlet(config);
		nodeOf = api.slothlet.node;

		console.log(chalk.green("✅ API loaded successfully"));

		// Force materialization of lazy folders if in lazy mode
		if (lazy) {
			await forceMaterializeLazyFolders(api);
			console.log(chalk.green("✅ Lazy folders materialized\n"));
		} else {
			console.log(chalk.green("✅ Eager mode - all modules pre-loaded\n"));
		}

		if (raw) {
			// await api?.math?.add(2, 4);
			// console.log(api);
			// console.log(api.utilities.helpers);
			// process.exit(0);
			const inspectDepth = Number.isFinite(maxDepth) ? maxDepth : null;
			console.log(util.inspect(printableApi(api), { depth: inspectDepth, colors: true }));
			if (typeof api.shutdown === "function") {
				await api.shutdown();
			}
			return;
		}

		const inspectDepth = Number.isFinite(maxDepth) ? maxDepth : null;
		console.log(util.inspect(printableApi(api), { depth: inspectDepth, colors: true }));

		// Display basic info
		console.log(chalk.bold("API Type:"), typeof api);
		if (typeof api === "function") {
			console.log(chalk.bold("Function Name:"), api.name || "(anonymous)");
			console.log(chalk.bold("Parameter Count:"), api.length);
			if (api.constructor.name === "AsyncFunction") {
				console.log(chalk.bold("Async:"), chalk.cyan("yes"));
			}
		}

		console.log(chalk.bold("\nAPI Structure:"));
		console.log(chalk.gray("─".repeat(50)));

		// Display the structure
		const structure = inspectApiStructure(api, apiName, 0, maxDepth);
		for (const line of structure) {
			console.log(line);
		}

		console.log(chalk.gray("─".repeat(50)));

		// Show callable paths
		console.log(chalk.bold("\nCallable Paths:"));
		const callablePaths = await findCallablePaths(api, "api", new WeakSet(), false, 0, maxDepth);
		if (callablePaths.length === 0) {
			console.log(chalk.gray("  No callable functions found"));
		} else {
			for (const path of callablePaths) {
				console.log(`  ${chalk.green(path)}`);
			}
		}

		// Mode-neutral shape of the whole api, for comparing eager and lazy composition (#583). It is not cut
		// at the display depth, which would make every subtree below it compare equal (#585 review), so
		// every lazy node is loaded first, down to WALK_DEPTH: past any real api's depth, and where a node that
		// holds itself (`fn.me = fn`, read as `me.me…`) stops, the same in both modes.
		await findCallablePaths(api, "api", new WeakSet(), false, 0, WALK_DEPTH);
		console.log(`\nAPI Shape: ${JSON.stringify(describeApiShape(api, 0, WALK_DEPTH))}`);

		// Shutdown the API instance to clean up resources
		if (typeof api.shutdown === "function") {
			await api.shutdown();
			console.log(chalk.green("✅ API instance shutdown cleanly"));
		}
	} catch (error) {
		console.error(chalk.red("❌ Error loading API:"), error.message);
		if (error.code === "MODULE_NOT_FOUND") {
			console.error(chalk.gray("Make sure the API folder exists and contains valid modules"));
		}
	}
}

/**
 * Recursively materializes lazy proxy structures by calling their ___materialize methods.
 * @param {any} obj - Object to materialize
 * @param {WeakSet} [visited] - Visited objects tracker to prevent infinite recursion
 * @param {number} [depth=0] - How deep this node is below where the walk started (see {@link WALK_DEPTH}).
 * @returns {Promise<void>}
 * @internal
 */
async function materializeLazyStructure(obj, visited = new WeakSet(), depth = 0) {
	// Avoid infinite recursion
	if (!obj || visited.has(obj) || depth > WALK_DEPTH) return;

	// Only process objects and functions
	if (typeof obj !== "object" && typeof obj !== "function") return;

	visited.add(obj);

	// Check if this is a lazy proxy with a ___materialize method
	if (typeof obj === "function" && obj.___materialize && typeof obj.___materialize === "function") {
		try {
			await obj.___materialize();
		} catch (_) {
			// Silently ignore materialization errors
		}
	}

	// Recursively materialize all properties
	if (typeof obj === "object" || typeof obj === "function") {
		// The api's own members: every one is enumerable. Walking non-enumerable names too (a function's `prototype`,
		// its `constructor`) only multiplies the walk below each node.
		const propNames = Object.keys(obj);
		for (const prop of propNames) {
			try {
				const value = obj[prop];
				if (value && (typeof value === "object" || typeof value === "function")) {
					await materializeLazyStructure(value, visited, depth + 1);
				}
			} catch {
				// Ignore property access errors (getters that throw, etc.)
			}
		}
	}
}

/**
 * Finds all callable paths in an API object structure.
 * @param {any} obj - Object to traverse
 * @param {string} [basePath="api"] - Base path string
 * @param {WeakSet} [visited] - Visited objects tracker
 * @param {boolean} [skipSelf=false] - Skip adding the object itself as callable (to avoid duplicates)
 * @param {number} [depth=0] - Current depth
 * @param {number} [maxDepth=8] - Maximum depth to traverse
 * @returns {Promise<string[]>} Array of callable paths
 * @internal
 */
/**
 * The loaded api's `slothlet.node`, set once the api is built; null before.
 * @type {((target: unknown) => ({callable: boolean}|undefined))|null}
 */
let nodeOf = null;

/**
 * Whether an api node can be called. A lazy folder is a function-typed proxy even when it is a plain
 * namespace (its callability is unknown until it loads), so `typeof` alone listed every lazy folder as
 * a callable path and the eager/lazy comparison could not match (#583). A slothlet node reports its
 * own callability through `api.slothlet.node(node).callable` (the tool loads every lazy node before
 * asking); anything else is callable when it is a function.
 * @param {unknown} value - Node to test.
 * @returns {boolean} True when the node is callable.
 * @internal
 */
function isCallableNode(value) {
	if (typeof value !== "function") return false;
	let report;
	try {
		report = nodeOf ? nodeOf(value) : undefined;
	} catch {
		report = undefined;
	}
	// Only a non-slothlet function has no report at all.
	return report === undefined ? true : report.callable === true;
}

/**
 * Describe an api node as a mode-neutral, JSON-serializable shape. A lazy node is always a
 * function-typed proxy, so the printed structure differs between modes even when the composed api is
 * the same; this shape classifies a node by what it is (callable, object, array, primitive) rather than
 * by its proxy target, so eager and lazy output compare directly. Call it after every lazy node is
 * loaded. Keys are sorted, so the order in which a mode composed them does not matter.
 * @param {unknown} value - Node to describe.
 * @param {number} depth - Current depth.
 * @param {number} maxDepth - Depth past which a node is reported as `max-depth`.
 * @param {Set<unknown>} [ancestors] - Nodes on the current path, to report cycles.
 * @param {string} [apiPath] - The node's api path (`""` for the root), to withhold the nodes {@link WITHHELD_PATHS} names.
 * @returns {object} The node's shape.
 * @internal
 */
function describeApiShape(value, depth, maxDepth, ancestors = new Set(), apiPath = "") {
	// A withheld node keeps its type and nothing else, as the structures test blanks a volatile value (#759).
	if (WITHHELD_PATHS.has(apiPath)) return { type: value === null ? "null" : typeof value, withheld: true };
	if (value === null || (typeof value !== "object" && typeof value !== "function")) {
		// JSON writes NaN and both infinities as null and -0 as 0, so they are kept as strings: two apis
		// differing only in them would otherwise print the same shape (#585 review).
		const unrepresentable =
			typeof value === "symbol" ||
			typeof value === "bigint" ||
			(typeof value === "number" && (!Number.isFinite(value) || Object.is(value, -0)));
		return { type: typeof value, value: unrepresentable ? (Object.is(value, -0) ? "-0" : String(value)) : value };
	}
	if (ancestors.has(value)) return { type: "circular" };
	if (depth > maxDepth) return { type: "max-depth" };
	const callable = isCallableNode(value);
	// An array's `length` is observable apart from its elements (a trailing hole adds to it), so it is part
	// of the shape (#585 review).
	const shape = Array.isArray(value)
		? { type: "array", length: value.length }
		: callable
			? { type: "callable", params: value.length }
			: { type: "object" };
	ancestors.add(value);
	const members = {};
	for (const key of Object.keys(value).sort()) {
		try {
			members[key] = describeApiShape(value[key], depth + 1, maxDepth, ancestors, apiPath ? `${apiPath}.${key}` : key);
		} catch (error) {
			members[key] = { type: "error", message: error?.message };
		}
	}
	ancestors.delete(value);
	if (Object.keys(members).length > 0) shape.members = members;
	return shape;
}

async function findCallablePaths(obj, basePath = "api", visited = new WeakSet(), skipSelf = false, depth = 0, maxDepth = 8) {
	const paths = [];

	// Stop if too deep or if we've already processed this object (but only for non-functions or deep objects)
	if (!obj || depth > maxDepth) return paths;

	// Only prevent revisiting for objects/functions at deeper levels to avoid infinite recursion
	if ((typeof obj === "object" || typeof obj === "function") && depth > 1 && visited.has(obj)) return paths;

	// Add to visited set (for both objects and functions to prevent cycles)
	if (typeof obj === "object" || typeof obj === "function") {
		visited.add(obj);
	}

	// Force materialization of lazy proxies using the exposed ___materialize method
	await materializeLazyStructure(obj);

	// If the object itself is callable, add it (unless skipSelf is true)
	if (isCallableNode(obj) && !skipSelf) {
		paths.push(`${basePath}()`);
	}

	// Search properties (works for both objects and functions since functions can have properties)
	if (typeof obj === "object" || typeof obj === "function") {
		for (const key of Object.keys(obj)) {
			// A module's `_` and `__` members are api members like any other; the framework's own keys are
			// not on the node's surface (#585 review).
			if (key === "shutdown") continue;
			// A getter that throws is a member like any other; reading it must not end the walk.
			let value;
			try {
				value = obj[key];
			} catch {
				continue;
			}

			const newPath = `${basePath}.${key}`;

			if (typeof value === "function") {
				if (isCallableNode(value)) paths.push(`${newPath}()`);

				// Check for properties on functions (but skip adding the function itself again)
				const subPaths = await findCallablePaths(value, newPath, visited, true, depth + 1, maxDepth);
				paths.push(...subPaths);
			} else if (value && typeof value === "object") {
				const subPaths = await findCallablePaths(value, newPath, visited, false, depth + 1, maxDepth);
				paths.push(...subPaths);
			}
		}
	}

	return paths;
}

/**
 * Main entry point for the utility.
 * @returns {Promise<void>}
 * @internal
 */
async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
		console.log(chalk.bold("Usage:"));
		console.log("  node tools/inspect-api-structure.mjs <api-name> [options]");
		console.log("\nExamples:");
		console.log("  node tools/inspect-api-structure.mjs api_test");
		console.log("  node tools/inspect-api-structure.mjs api_test --eager");
		console.log("  node tools/inspect-api-structure.mjs api_test --eager --runtime live");
		console.log("\nOptions:");
		console.log("  --depth <n>           Maximum depth to traverse (default: 3)");
		console.log("  --show-methods        Show available methods for functions");
		console.log("  --lazy                Use lazy loading mode (default)");
		console.log("  --eager               Use eager loading mode");
		console.log("  --raw                 Output raw API via console.log only");
		console.log("  --runtime <type>      Runtime type: 'async' or 'live' (default: async)");
		console.log("  --apiDepth <n>        Set API depth limit (default: no limit)");
		console.log("  --debug               Enable debug mode");
		console.log("\nOther options:");
		console.log("  --hooks               Enable lifecycle hooks");
		return;
	}

	const apiName = args[0];
	const options = { lazy: true }; // Default to lazy mode
	const slothletConfig = {}; // Configuration for slothlet initialization

	// Parse options
	for (let i = 1; i < args.length; i++) {
		if (args[i] === "--depth" && i + 1 < args.length) {
			options.maxDepth = parseInt(args[i + 1], 10);
			i++; // Skip next arg
		} else if (args[i] === "--apiDepth" && i + 1 < args.length) {
			slothletConfig.depth = parseInt(args[i + 1], 10);
			i++; // Skip next arg
		} else if (args[i] === "--runtime" && i + 1 < args.length) {
			slothletConfig.runtime = args[i + 1];
			i++; // Skip next arg
		} else if (args[i] === "--show-methods") {
			options.showMethods = true;
		} else if (args[i] === "--lazy") {
			options.lazy = true;
		} else if (args[i] === "--eager") {
			options.lazy = false;
		} else if (args[i] === "--raw") {
			options.raw = true;
		} else if (args[i] === "--hooks") {
			// The option is `hook`; a `hooks` key is not read, so this flag used to enable nothing (#583).
			slothletConfig.hook = true;
		} else if (args[i] === "--debug") {
			slothletConfig.debug = true;
		}
	}

	// Pass slothlet configuration as part of options
	options.slothletConfig = slothletConfig;

	await inspectApi(apiName, options);
}

// Run if called directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(chalk.red("Error:"), error);
		process.exit(1);
	});
}
