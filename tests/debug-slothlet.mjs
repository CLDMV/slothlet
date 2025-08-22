import chalk from "chalk";
// const resolvedUrl = new URL("../src/slothlet.mjs?_slothlet=eager", import.meta.url).href;
// console.log("[debug-slothlet.mjs]  resolvedUrl:", resolvedUrl);
// import slothletEager from "file:///P:/Dropbox/Sync/Documents/CLDMV/node/slothlet/slothlet.mjs?testParam=maybe&_slothlet=eager";
// import slothletEager from "./slothlet.mjs?testParam=maybe&_slothlet=eager";
// const slothletEager = await import("./slothlet.mjs?_slothlet=eager");
// const { default: slothletEager } = await import("./slothlet.mjs?_slothlet=eager");
const { slothlet: slothletEager } = await import(new URL("../src/slothlet.mjs?_slothlet=eager", import.meta.url).href);
const { slothlet: slothletLazy } = await import(new URL("../src/slothlet.mjs?_slothlet=lazy", import.meta.url).href);
// import slothlet from "./slothlet.mjs";
// import slothletLazy from "./slothlet.mjs?testParam=maybe&_slothlet=lazy";

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
 * @param {object|Function} a - First object or function to compare.
 * @param {object|Function} b - Second object or function to compare.
 * @param {object} [options] - Optional settings.
 * @param {number} [options.maxDepth=10] - Maximum recursion depth to prevent infinite loops.
 * @param {string} [currentPath=""] - Internal: current path for recursion tracking.
 * @param {number} [currentDepth=0] - Internal: current recursion depth.
 * @param {Set} [checkedPaths] - Internal: set to track all checked paths for verification.
 * @returns {object} Report of differences: { onlyInA, onlyInB, differingFunctions, differingValues, nestedDifferences, checkedPaths }
 * @example
 * compareApiShapes(obj1, obj2);
 */
export function compareApiShapes(a, b, options = {}, currentPath = "", currentDepth = 0, checkedPaths = null) {
	const { maxDepth = 10 } = options;

	// Initialize checkedPaths set on first call
	if (checkedPaths === null) {
		checkedPaths = new Set();
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
	const onlyInA = [...keysA].filter((k) => !keysB.has(k)).map((k) => (currentPath ? `${currentPath}.${k}` : k));
	const onlyInB = [...keysB].filter((k) => !keysA.has(k)).map((k) => (currentPath ? `${currentPath}.${k}` : k));
	const inBoth = [...keysA].filter((k) => keysB.has(k));

	const differingFunctions = [];
	const differingValues = [];
	const nestedDifferences = [];

	for (const key of inBoth) {
		// Skip common non-enumerable properties that don't matter for API comparison
		if (["constructor", "prototype", "__proto__", "length", "name"].includes(key) && typeof a === "function") {
			continue;
		}

		const valA = a[key];
		const valB = b[key];
		const fullPath = currentPath ? `${currentPath}.${key}` : key;

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
			const funcComparison = compareApiShapes(valA, valB, options, fullPath, currentDepth + 1, checkedPaths);
			nestedDifferences.push(...funcComparison.onlyInA.map((p) => ({ type: "onlyInA", path: p })));
			nestedDifferences.push(...funcComparison.onlyInB.map((p) => ({ type: "onlyInB", path: p })));
			nestedDifferences.push(...funcComparison.differingFunctions.map((f) => ({ type: "differingFunction", ...f })));
			nestedDifferences.push(...funcComparison.differingValues.map((v) => ({ type: "differingValue", ...v })));
			nestedDifferences.push(...funcComparison.nestedDifferences);
		} else if (typeof valA === "object" && typeof valB === "object" && valA !== null && valB !== null) {
			// Recursively compare nested objects
			const nestedComparison = compareApiShapes(valA, valB, options, fullPath, currentDepth + 1, checkedPaths);
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
 * Runs debug tests for the slothlet API.
 * @param {object} slothlet - The slothlet loader instance.
 * @param {object} config - Loader config.
 * @param {string} label - Label for debug output.
 * @param {boolean} [awaitCalls=false] - If true, await all API calls.
 */

async function runDebug(config, label, awaitCalls = false) {
	// await slothlet.load({ ...config, dir: "./api_test" });
	// const bound = slothlet.createBoundApi({});
	let bound;
	// if (awaitCalls) {

	if (label === "EAGER") bound = await slothletEager({ ...config, dir: "./api_test", api_mode: "function", reference: { md5 } });
	else bound = await slothletLazy({ ...config, dir: "./api_test", api_mode: "function", reference: { md5 } });

	// bound = await slothlet.create({ ...config, dir: "./api_test" });
	// } else {
	// 	bound = slothlet.create({ ...config, dir: "./api_test" });
	// }
	// const bound = await slothlet.create({ ...config, debug: true, dir: "./api_test" });
	// const bound = slothlet.createBoundApi({});
	console.log("\n===== DEBUG MODE: " + label + (awaitCalls ? " (awaited)" : "") + " =====\n");

	// console.dir(bound, { depth: null });
	console.log(bound);
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
		{ section: "rootFunction (default)", calls: [{ path: [], args: ["World"], label: 'bound("World")' }] },
		{ section: "rootFunctionShout", calls: [{ path: ["rootFunctionShout"], args: ["World"], label: 'bound.rootFunctionShout("World")' }] },
		{
			section: "rootFunctionWhisper",
			calls: [{ path: ["rootFunctionWhisper"], args: ["World"], label: 'bound.rootFunctionWhisper("World")' }]
		},

		// root-math
		{
			section: "rootMath",
			calls: [
				{ path: ["rootMath", "add"], args: [2, 3], label: "bound.rootMath.add(2, 3)" },
				{ path: ["rootMath", "multiply"], args: [2, 3], label: "bound.rootMath.multiply(2, 3)" }
			]
		},

		// rootstring
		{
			section: "rootstring",
			calls: [
				{ path: ["rootstring", "upper"], args: ["abc"], label: 'bound.rootstring.upper("abc")' },
				{ path: ["rootstring", "reverse"], args: ["abc"], label: 'bound.rootstring.reverse("abc")' }
			]
		},

		// string
		{
			section: "string",
			calls: [
				{ path: ["string", "upper"], args: ["abc"], label: 'bound.string.upper("abc")' },
				{ path: ["string", "reverse"], args: ["abc"], label: 'bound.string.reverse("abc")' }
			]
		},

		// math
		{
			section: "math",
			calls: [
				{ path: ["math", "add"], args: [2, 3], label: "bound.math.add(2, 3)" },
				{ path: ["math", "multiply"], args: [2, 3], label: "bound.math.multiply(2, 3)" }
			]
		},

		// multi_func
		{ section: "multi_func.alpha", calls: [{ path: ["multi_func", "alpha"], args: ["alpha"], label: 'bound.multi_func.alpha("alpha")' }] },
		{
			section: "multi_func.beta.hello",
			calls: [{ path: ["multi_func", "beta", "hello"], args: [], label: "bound.multi_func.beta.hello()" }]
		},
		{
			section: "multi_func.uniqueOne",
			calls: [{ path: ["multi_func", "uniqueOne"], args: ["uniqueOne"], label: 'bound.multi_func.uniqueOne("uniqueOne")' }]
		},
		{
			section: "multi_func.uniqueTwo",
			calls: [{ path: ["multi_func", "uniqueTwo"], args: ["uniqueTwo"], label: 'bound.multi_func.uniqueTwo("uniqueTwo")' }]
		},
		{
			section: "multi_func.uniqueThree",
			calls: [{ path: ["multi_func", "uniqueThree"], args: ["uniqueThree"], label: 'bound.multi_func.uniqueThree("uniqueThree")' }]
		},
		{
			section: "multi_func.multi_func_hello",
			calls: [{ path: ["multi_func", "multi_func_hello"], args: [], label: "bound.multi_func.multi_func_hello()" }]
		},

		// multi
		{ section: "multi.alpha.hello", calls: [{ path: ["multi", "alpha", "hello"], args: [], label: "bound.multi.alpha.hello()" }] },
		{ section: "multi.beta.world", calls: [{ path: ["multi", "beta", "world"], args: [], label: "bound.multi.beta.world()" }] },

		// nested.date
		{ section: "nested.date.today", calls: [{ path: ["nested", "date", "today"], args: [], label: "bound.nested.date.today()" }] },

		// objectDefaultMethod
		{
			section: "objectDefaultMethod (default)",
			calls: [{ path: ["objectDefaultMethod"], args: ["Hello World"], label: 'bound.objectDefaultMethod("Hello World")' }]
		},
		{
			section: "objectDefaultMethod.info",
			calls: [{ path: ["objectDefaultMethod", "info"], args: ["Test"], label: 'bound.objectDefaultMethod.info("Test")' }]
		},
		{
			section: "objectDefaultMethod.warn",
			calls: [{ path: ["objectDefaultMethod", "warn"], args: ["Test"], label: 'bound.objectDefaultMethod.warn("Test")' }]
		},
		{
			section: "objectDefaultMethod.error",
			calls: [{ path: ["objectDefaultMethod", "error"], args: ["Test"], label: 'bound.objectDefaultMethod.error("Test")' }]
		},

		// funcmod
		{ section: "funcmod", calls: [{ path: ["funcmod"], args: [5, 6], label: "bound.funcmod(5, 6)" }] },

		// util
		{ section: "util.size", calls: [{ path: ["util", "size"], args: [123], label: "bound.util.size(123)" }] },
		{ section: "util.secondFunc", calls: [{ path: ["util", "secondFunc"], args: [123], label: "bound.util.secondFunc(123)" }] },
		{
			section: "util.url.cleanEndpoint",
			calls: [
				{
					path: ["util", "url", "cleanEndpoint"],
					args: ["sites_list", "default", {}, false, false],
					label: 'bound.util.url.cleanEndpoint("sites_list", "default", {}, false, false)'
				}
			]
		},
		{
			section: "util.url.buildUrlWithParams",
			calls: [
				{
					path: ["util", "url", "buildUrlWithParams"],
					args: ["10.0.0.1", { foo: "bar" }],
					label: 'bound.util.url.buildUrlWithParams("10.0.0.1", { foo: "bar" })'
				}
			]
		},
		{ section: "util.extract.data", calls: [{ path: ["util", "extract", "data"], args: [], label: "bound.util.extract.data()" }] },
		{ section: "util.extract.section", calls: [{ path: ["util", "extract", "section"], args: [], label: "bound.util.extract.section()" }] },
		{
			section: "util.extract.NVRSection",
			calls: [{ path: ["util", "extract", "NVRSection"], args: [], label: "bound.util.extract.NVRSection()" }]
		},
		{
			section: "util.extract.parseDeviceName",
			calls: [{ path: ["util", "extract", "parseDeviceName"], args: [], label: "bound.util.extract.parseDeviceName()" }]
		},
		{
			section: "util.controller.getDefault",
			calls: [{ path: ["util", "controller", "getDefault"], args: [], label: "bound.util.controller.getDefault()" }]
		},
		{
			section: "util.controller.detectEndpointType",
			calls: [{ path: ["util", "controller", "detectEndpointType"], args: [], label: "bound.util.controller.detectEndpointType()" }]
		},
		{
			section: "util.controller.detectDeviceType",
			calls: [{ path: ["util", "controller", "detectDeviceType"], args: [], label: "bound.util.controller.detectDeviceType()" }]
		},

		// advanced
		{
			section: "advanced.selfObject.addViaSelf",
			calls: [{ path: ["advanced", "selfObject", "addViaSelf"], args: [2, 3], label: "bound.advanced.selfObject.addViaSelf(2, 3)" }]
		},
		{
			section: "advanced.nest3 (default)",
			calls: [{ path: ["advanced", "nest3"], args: ["slothlet"], label: 'bound.advanced.nest3("slothlet")' }]
		},
		{
			section: "advanced.nest",
			calls: [{ path: ["advanced", "nest"], args: ["slothlet"], label: 'bound.advanced.nest("slothlet")' }]
		},
		{
			section: "advanced.nest2.alpha.hello",
			calls: [{ path: ["advanced", "nest2", "alpha", "hello"], args: [], label: "bound.advanced.nest2.alpha.hello()" }]
		},
		{
			section: "advanced.nest2.beta.world",
			calls: [{ path: ["advanced", "nest2", "beta", "world"], args: [], label: "bound.advanced.nest2.beta.world()" }]
		},

		// exportDefault
		{ section: "exportDefault (default)", calls: [{ path: ["exportDefault"], args: [], label: "bound.exportDefault()" }] },
		{
			section: "exportDefault.extra (named)",
			calls: [{ path: ["exportDefault", "extra"], args: [], label: "bound.exportDefault.extra()" }]
		}
	];

	for (const test of tests) {
		console.log(chalk.magentaBright.bold(`--- Debug: ${test.section} ---`));
		for (const call of test.calls) {
			// Single-shot property access for correct Proxy getter behavior
			let fn;
			try {
				console.log("calling: " + chalk.cyanBright(`${awaitCalls ? "await " : ""}${call.label}`));
				fn = call.path.reduce((acc, key) => acc && acc[key], bound);
				let result;
				if (typeof fn === "function") {
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
					const evalStr = `${objName}.${pathStr}(${argsStr})`;
					if (awaitCalls) {
						result = await eval(evalStr);
					} else {
						result = eval(evalStr);
					}
				}
				console.log(chalk.cyanBright(`${awaitCalls ? "await " : ""}${call.label}`), result);
			} catch (e) {
				console.error(`Error calling ${call.label}:`, e);
			}
		}
	}
	// await slothlet.shutdown();
	if (awaitCalls) console.log(bound);
	return bound;
}

(async () => {
	// Command line param: e/eager or l/lazy
	// const modeArg = process.argv.find((arg) => arg === "e" || arg === "eager" || arg === "l" || arg === "lazy");
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

	const compared = compareApiShapes(_lazyBound, _eagerBound);

	console.log("\n" + chalk.yellowBright.bold("===== API SHAPE COMPARISON ====="));
	console.log(chalk.cyanBright("Comparing LAZY vs EAGER API structures...\n"));

	// Show verification of what was checked
	console.log(chalk.blueBright(`🔍 Paths checked: ${compared.checkedPaths.length} total`));
	console.log(chalk.gray("Sample paths checked:"));
	compared.checkedPaths.slice(0, 10).forEach((path) => console.log(chalk.gray(`  • ${path}`)));
	if (compared.checkedPaths.length > 10) {
		console.log(chalk.gray(`  ... and ${compared.checkedPaths.length - 10} more`));
	}
	console.log();

	if (compared.onlyInA.length > 0) {
		console.log(chalk.redBright("⚠️  Properties only in LAZY:"));
		compared.onlyInA.forEach((path) => console.log(`  - ${path}`));
		console.log();
	}

	if (compared.onlyInB.length > 0) {
		console.log(chalk.redBright("⚠️  Properties only in EAGER:"));
		compared.onlyInB.forEach((path) => console.log(`  - ${path}`));
		console.log();
	}

	if (compared.differingFunctions.length > 0) {
		console.log(chalk.yellowBright("⚠️  Function signature differences:"));
		compared.differingFunctions.forEach((diff) => {
			console.log(`  - ${diff.path}: ${diff.aSignature} vs ${diff.bSignature}`);
		});
		console.log();
	}

	if (compared.differingValues.length > 0) {
		console.log(chalk.yellowBright("⚠️  Value differences:"));
		compared.differingValues.forEach((diff) => {
			console.log(`  - ${diff.path}: (${diff.aType}) ${diff.aValue} vs (${diff.bType}) ${diff.bValue}`);
		});
		console.log();
	}

	if (compared.nestedDifferences.length > 0) {
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
})();
