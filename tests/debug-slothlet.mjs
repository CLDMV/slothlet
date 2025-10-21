import chalk from "chalk";
// const resolvedUrl = new URL("../src/slothlet.mjs?_slothlet=eager", import.meta.url).href;
// console.log("[debug-slothlet.mjs]  resolvedUrl:", resolvedUrl);
// import slothletEager from "file:///P:/Dropbox/Sync/Documents/CLDMV/node/slothlet/slothlet.mjs?testParam=maybe&_slothlet=eager";
// import slothletEager from "./slothlet.mjs?testParam=maybe&_slothlet=eager";
// const slothletEager = await import("./slothlet.mjs?_slothlet=eager");
// const { default: slothletEager } = await import("./slothlet.mjs?_slothlet=eager");
// import slothlet from "./slothlet.mjs";
// import slothletLazy from "./slothlet.mjs?testParam=maybe&_slothlet=lazy";

// const { slothlet: slothletEager } = await import(new URL("../src/slothlet.mjs?_slothlet=eager", import.meta.url).href);
// const { slothlet: slothletLazy } = await import(new URL("../src/slothlet.mjs?_slothlet=lazy", import.meta.url).href);
// const { slothlet: slothletEager } = await import(new URL("../index.mjs", import.meta.url).href);
// const { slothlet: slothletLazy } = await import(new URL("../index.mjs", import.meta.url).href);
// const { slothlet } = await import(new URL("../index.mjs", import.meta.url).href);
import slothlet from "@cldmv/slothlet";
import crypto from "crypto";

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

	const getAllKeys = (obj) => {
		if (obj === null || obj === undefined) return [];
		if (typeof obj === "function") {
			return [...new Set([...Object.getOwnPropertyNames(obj), ...Object.keys(obj)])];
		}
		if (typeof obj === "object") {
			return [...new Set([...Object.getOwnPropertyNames(obj), ...Object.keys(obj)])];
		}
		return [];
	};

	const keysA = new Set(getAllKeys(a));
	const keysB = new Set(getAllKeys(b));

	// Helper function to check if a key should be skipped
	const shouldSkipKey = (key, obj) => {
		return (
			["constructor", "prototype", "__proto__", "__ctx", "_impl", "length", "name", "__slothletDefault"].includes(key) &&
			typeof obj === "function"
		);
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

		// Skip circular references dynamically by checking if the property value
		// is the same object reference as any ancestor in the path
		if (
			(valA !== null && typeof valA === "object" && visitedA.has(valA)) ||
			(valB !== null && typeof valB === "object" && visitedB.has(valB))
		) {
			// This is a circular reference, skip it
			continue;
		}

		// Add this path to checked paths
		checkedPaths.add(fullPath);

		if (typeof valA === "function" && typeof valB === "function") {
			// Compare function signatures and implementations
			if (valA.length !== valB.length || valA.toString() !== valB.toString()) {
				differingFunctions.push({
					path: fullPath,
					aSignature: `${valA.name || "anonymous"}(${valA.length} params)`,
					bSignature: `${valB.name || "anonymous"}(${valB.length} params)`,
					aLength: valA.length,
					bLength: valB.length
				});
			}

			// Recursively compare function properties (functions can have properties too)
			const funcComparison = compareApiShapes(valA, valB, options, fullPath, currentDepth + 1, checkedPaths, visitedA, visitedB);
			nestedDifferences.push(...funcComparison.onlyInA.map((p) => ({ type: "onlyInA", path: p })));
			nestedDifferences.push(...funcComparison.onlyInB.map((p) => ({ type: "onlyInB", path: p })));
			nestedDifferences.push(...funcComparison.differingFunctions.map((f) => ({ type: "differingFunction", ...f })));
			nestedDifferences.push(...funcComparison.differingValues.map((v) => ({ type: "differingValue", ...v })));
			nestedDifferences.push(...funcComparison.nestedDifferences);
		} else if (typeof valA === "object" && typeof valB === "object" && valA !== null && valB !== null) {
			// Recursively compare nested objects
			const nestedComparison = compareApiShapes(valA, valB, options, fullPath, currentDepth + 1, checkedPaths, visitedA, visitedB);
			nestedDifferences.push(...nestedComparison.onlyInA.map((p) => ({ type: "onlyInA", path: p })));
			nestedDifferences.push(...nestedComparison.onlyInB.map((p) => ({ type: "onlyInB", path: p })));
			nestedDifferences.push(...nestedComparison.differingFunctions.map((f) => ({ type: "differingFunction", ...f })));
			nestedDifferences.push(...nestedComparison.differingValues.map((v) => ({ type: "differingValue", ...v })));
			nestedDifferences.push(...nestedComparison.nestedDifferences);
		} else if (typeof valA !== typeof valB || valA !== valB) {
			// Values differ in type or content
			differingValues.push({
				path: fullPath,
				aValue: valA,
				bValue: valB,
				aType: typeof valA,
				bType: typeof valB
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

	// if (modeLabel === "EAGER") bound = await slothletEager({ ...config, dir: "../api_test", api_mode: "function", reference: { md5 } });
	// else bound = await slothletLazy({ ...config, dir: "../api_test", api_mode: "function", reference: { md5 } });
	if (modeLabel === "EAGER") bound = await slothlet({ ...config, dir: "../api_tests/api_test", reference: { md5 } });
	else bound = await slothlet({ ...config, dir: "../api_tests/api_test", reference: { md5 } });

	// bound = await slothlet.create({ ...config, dir: "./api_test" });
	// } else {
	// 	bound = slothlet.create({ ...config, dir: "./api_test" });
	// }
	// const bound = await slothlet.create({ ...config, debug: true, dir: "./api_test" });
	// const bound = slothlet.createBoundApi({});
	console.log("\n===== DEBUG MODE: " + modeLabel + (awaitCalls ? " (awaited)" : "") + " =====\n");

	// console.dir(bound, { depth: null });
	console.log("bound api (before calls): ", bound);
	// process.exit(0);
	// console.log(await bound.describe());
	// console.dir(await bound.describe(), { depth: null });

	console.log("\n===== DIRECT HELLO TEST START =====\n");
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
	console.log("\n===== DIRECT HELLO TEST END =====\n");

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
			section: "advanced.nest",
			calls: [{ path: ["advanced", "nest"], args: ["slothlet"] }]
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
			section: "advanced.nest4.singlefile",
			calls: [{ path: ["advanced", "nest4", "singlefile"], args: ["singlefile"] }]
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
		}
	];

	let testCounter = 0;
	const testBeforeOutput = 37;

	for (const test of tests) {
		console.log(chalk.magentaBright.bold(`--- Debug: ${test.section} ---`));
		for (const call of test.calls) {
			// Auto-generate label from path and args
			const pathStr = call.path.join(".");
			const argsStr = call.args.map((a) => JSON.stringify(a)).join(", ");
			const label = `bound${pathStr ? "." + pathStr : ""}(${argsStr})`;

			// Single-shot property access for correct Proxy getter behavior
			let fn;
			try {
				console.log("calling: " + chalk.cyanBright(`${awaitCalls ? "await " : ""}${label}`));
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
					originalConsoleLog(...args);
				};
				console.error = (...args) => {
					capturedOutput.push({ type: "error", args });
					originalConsoleError(...args);
				};
				console.warn = (...args) => {
					capturedOutput.push({ type: "warn", args });
					originalConsoleWarn(...args);
				};

				let result;
				if (typeof fn === "function") {
					console.log("[DEBUG_SCRIPT] About to call function with args:", call.args);
					if (awaitCalls) {
						result = await fn(...call.args);
					} else {
						result = fn(...call.args);
					}
				} else {
					// Fallback to eval for dynamic property/function chains
					const objName = "bound";
					const pathStr = call.path.join(".");
					const argsStr = call.args.map((a) => JSON.stringify(a)).join(",");
					const evalStr = `${objName}${pathStr ? "." + pathStr : ""}(${argsStr})`;
					// console.log("evalStr: ", evalStr);
					// process.exit(0);
					if (awaitCalls) {
						result = await eval(evalStr);
					} else {
						result = eval(evalStr);
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
				console.log("bound api (after " + testCounter + " calls): ", bound);
			}
		}
	}
	// await slothlet.shutdown();
	if (awaitCalls) console.log("bound api (after calls): ", bound);
	return bound;
}

(async () => {
	// Command line param: e/eager or l/lazy
	// const modeArg = process.argv.find((arg) => arg === "e" || arg === "eager" || arg === "l" || arg === "lazy");

	console.log("\n" + chalk.yellowBright.bold("===== EAGER & LAZY MODE TEST ====="));
	console.log(chalk.cyanBright("Running EAGER & LAZY mode tests...\n"));

	let lazy = false;
	let label = "EAGER";
	let awaitCalls = false;
	const _eagerBound = await runDebug({ lazy }, label, awaitCalls);
	// if (modeArg === "l" || modeArg === "lazy") {
	lazy = true;
	label = "LAZY";
	awaitCalls = true;
	// }
	const _lazyBound = await runDebug({ lazy }, label, awaitCalls);

	console.log("\n" + chalk.yellowBright.bold("===== COMPLETED EAGER & LAZY MODE TEST ====="));

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
			console.log(`  - ${diff.path}: ${diff.aSignature} vs ${diff.bSignature}`);
		});
		console.log();
	}

	if (compared.differingValues.length > 0) {
		hasErrors = true;
		console.log(chalk.yellowBright("⚠️  Value differences:"));
		compared.differingValues.forEach((diff) => {
			const aValueStr = typeof diff.aValue === "function" ? "[Function]" : diff.aValue;
			const bValueStr = typeof diff.bValue === "function" ? "[Function]" : diff.bValue;
			console.log(`  - ${diff.path}: (${diff.aType}) ${aValueStr} vs (${diff.bType}) ${bValueStr}`);
		});
		console.log();
	}

	if (compared.nestedDifferences.length > 0) {
		hasErrors = true;
		console.log(chalk.magentaBright("🔍 Nested differences:"));
		compared.nestedDifferences.forEach((diff) => {
			console.log(`  - [${diff.type}] ${diff.path}`);
		});
		console.log();
	}

	if (
		compared.onlyInA.length === 0 &&
		compared.onlyInB.length === 0 &&
		compared.differingFunctions.length === 0 &&
		compared.differingValues.length === 0 &&
		compared.nestedDifferences.length === 0
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
