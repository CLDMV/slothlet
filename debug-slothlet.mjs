import chalk from "chalk";
import slothlet from "./slothlet.mjs";
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
	bound = await slothlet.create({ ...config, dir: "./api_test" });
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
		{
			section: "api() default export",
			calls: [
				{
					path: [],
					args: ["World"],
					label: 'bound("World")'
				}
			]
		},
		{
			section: "rootFunction",
			calls: [
				{
					path: ["rootFunctionShout"],
					args: ["World"],
					label: 'bound.rootFunctionShout("World")'
				},
				{
					path: ["rootFunctionWhisper"],
					args: ["World"],
					label: 'bound.rootFunctionWhisper("World")'
				}
			]
		},
		{
			section: "rootMath",
			calls: [
				{
					path: ["rootMath", "add"],
					args: [2, 3],
					label: "bound.rootMath.add(2, 3)"
				},
				{
					path: ["rootMath", "multiply"],
					args: [2, 3],
					label: "bound.rootMath.multiply(2, 3)"
				}
			]
		},
		{
			section: "rootstring",
			calls: [
				{
					path: ["rootstring", "upper"],
					args: ["abc"],
					label: 'bound.rootstring.upper("abc")'
				},
				{
					path: ["rootstring", "reverse"],
					args: ["abc"],
					label: 'bound.rootstring.reverse("abc")'
				}
			]
		},
		{
			section: "objectDefaultMethod",
			calls: [
				{
					path: ["objectDefaultMethod"],
					args: ["Hello World"],
					label: 'bound.objectDefaultMethod("Hello World")'
				},
				...["info", "warn", "error"].map((method) => ({
					path: ["objectDefaultMethod", method],
					args: ["Test"],
					label: `bound.objectDefaultMethod.${method}("Test")`
				}))
			]
		},
		{
			section: "math",
			calls: [
				...["add", "multiply"].map((method) => ({
					path: ["math", method],
					args: [2, 3],
					label: `bound.math.${method}(2, 3)`
				}))
			]
		},
		{
			section: "string",
			calls: [
				...["upper", "reverse"].map((method) => ({
					path: ["string", method],
					args: ["abc"],
					label: `bound.string.${method}("abc")`
				}))
			]
		},
		{
			section: "nested.date",
			calls: [
				{
					path: ["nested", "date", "today"],
					args: [],
					label: "bound.nested.date.today()"
				}
			]
		},
		{
			section: "multi.alpha.hello",
			calls: [
				{
					path: ["multi", "alpha", "hello"],
					args: [],
					label: "bound.multi.alpha.hello()"
				}
			]
		},
		{
			section: "multi.beta.world",
			calls: [
				{
					path: ["multi", "beta", "world"],
					args: [],
					label: "bound.multi.beta.world()"
				}
			]
		},
		{
			section: "multi_func.alpha",
			calls: [
				{
					path: ["multi_func", "alpha"],
					args: ["alpha"],
					label: 'bound.multi_func.alpha("alpha")'
				}
			]
		},
		{
			section: "multi_func.beta.hello",
			calls: [
				{
					path: ["multi_func", "beta", "hello"],
					args: [],
					label: "bound.multi_func.beta.hello()"
				}
			]
		},
		{
			section: "exportDefault",
			calls: [
				{
					path: ["exportDefault"],
					args: [],
					label: "bound.exportDefault()"
				},
				{
					path: ["exportDefault", "extra"],
					args: [],
					label: "bound.exportDefault.extra()"
				}
			]
		},
		{
			section: "advanced",
			calls: [
				{
					path: ["advanced", "selfObject", "addViaSelf"],
					args: [2, 3],
					label: "bound.advanced.selfObject.addViaSelf(2, 3)"
				}
			]
		}
	];

	for (const test of tests) {
		console.log(chalk.magentaBright.bold(`--- Debug: ${test.section} ---`));
		for (const call of test.calls) {
			// Single-shot property access for correct Proxy getter behavior
			let fn;
			try {
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
	await bound.shutdown();
}

(async () => {
	// For lazy, reload a fresh instance
	// const slothletLazy = (await import("./slothlet.mjs?mode=lazy")).default;
	// await runDebug(slothletLazy, { lazy: true }, "LAZY");

	// For Eager, reload a fresh instance
	// const slothletEager = (await import("./slothlet.mjs?mode=eager")).default;
	// await runDebug(slothletEager, { lazy: false }, "EAGER");

	// For Awaited, reload a fresh instance with query string
	// const slothletAwaited = (await import("./slothlet.mjs?mode=awaited")).default;
	// await runDebug(slothletAwaited, { lazy: true }, "LAZY-AWAITED", true);

	// For Eager, reload a fresh instance
	// const slothletEager = (await import("./src/slothlet.mjs")).default;
	await runDebug({ lazy: false }, "EAGER", false);
	// await runDebug({ lazy: true }, "LAZY-AWAITED", true);
})();
