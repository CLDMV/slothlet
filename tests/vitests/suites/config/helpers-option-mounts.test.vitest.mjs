/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/config/helpers-option-mounts.test.vitest.mjs
 *	@Date: 2026-11-12T23:33:41-08:00 (1794555221)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:33:41-08:00 (1794555221)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `helpers` option end to end: with one folder mounted twice, and through each of the two loaders
 * an api file can come through (vite's module runner with the `slothletInstanceImports()` plugin, and Node's own).
 *
 * @description
 * Fixture `api_test_helper_copies`, loaded as the instance's base and mounted a second time under `again`
 * (`api.slothlet.api.add("again", dir)`). `helpers/tally.mjs` is imported by `one.mjs` and `two.mjs`, `helpers/tally.cjs`
 * by those two and required by `three.cjs` and `four.cjs`, so each helper has an importer in the base and one in the
 * mount for every importing file.
 *
 * Expected values:
 * - State comes from plain JavaScript and the option as documented (docs/CONFIGURATION.md). `helpers: "instance"` is
 *   one module per instance, shared by the base and every mount: every importer counts on the same number.
 *   `helpers: "module"` is one module per importing api file and mount: `one.mjs` of the base and `one.mjs` of the
 *   mount each count on their own.
 * - Permissions come from the rules as ruled. Where only the stack can say whose a helper's code is (its function
 *   nested in returned data, what it started when it loaded), one copy is held to every importing api file's module,
 *   in the base and in the mount alike; a copy per api file is held to the module of the file, and the mount, it was
 *   loaded for. A CommonJS copy's frames carry only the file's path, so it stays held to every file loading it.
 *
 * Every row runs twice. In this process the api files are loaded by vitest's module runner, where the plugin gives
 * each helper its copy; in a Node process of its own they are loaded by Node, where slothlet's hooks do. Both have to
 * give the same answers.
 *
 * @module tests/vitests/suites/config/helpers-option-mounts
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const DIR = path.resolve(ROOT, "api_tests/api_test_helper_copies/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

/** The module path of each api file importing the ES module helper, and of each loading the CommonJS one. */
const ESM_IMPORTERS = ["one", "two", "again.one", "again.two"];
const CJS_LOADERS = ["one", "two", "three", "four", "again.one", "again.two", "again.three", "again.four"];

/** The rule sets: the rules, and which caller paths they deny the vault. */
const RULE_SETS = [
	{ rules: "nothing denied", list: [], denies: () => false },
	{
		rules: "the module path one of the base denied",
		list: [{ caller: "one", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "one"
	},
	{
		rules: "the module path one of the mount denied",
		list: [{ caller: "again.one", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "again.one"
	},
	{
		rules: "the module path three of the mount denied",
		list: [{ caller: "again.three", target: "vault.**", effect: "deny" }],
		denies: (caller) => caller === "again.three"
	}
];

/**
 * Build the fixture with its folder mounted a second time and report what the helpers gave. Written to run as it
 * stands in this process and, as text, in a process of its own.
 * @param {Function} build - `slothlet`.
 * @param {string} dir - The fixture's api folder.
 * @param {{mode: string, runtime: string, attribution: string}} config - The config.
 * @param {string} helpers - The `helpers` option.
 * @param {Array<object>|null} rules - The permission rules, or null for no permissions.
 * @returns {Promise<object>} The counts, and what each helper's own code read.
 */
async function scenario(build, dir, config, helpers, rules) {
	const settle = async (fn) => {
		try {
			return await fn();
		} catch (error) {
			return error?.code ?? String(error?.message ?? error);
		}
	};
	const api = await build({
		base: dir,
		mode: config.mode,
		runtime: config.runtime,
		helpers,
		silent: true,
		...(rules ? { permissions: { defaultPolicy: "allow", attribution: config.attribution, rules } } : {})
	});
	try {
		await api.slothlet.api.add("again", dir);
		const out = { counts: {}, reads: {} };
		if (!rules) {
			out.counts.esm = [
				await api.one.bump(),
				await api.again.one.bump(),
				await api.two.bump(),
				await api.again.two.bump(),
				await api.one.bump()
			];
			out.counts.cjs = [
				await api.three.bumpCjs(),
				await api.again.three.bumpCjs(),
				await api.one.bumpCjs(),
				await api.again.one.bumpCjs(),
				await api.three.bumpCjs()
			];
			return out;
		}
		// Load every file, so a lazy tree records the same imports an eager one does.
		for (const files of [api, api.again]) for (const file of ["one", "two", "three", "four"]) await files[file].bumpCjs();
		for (const [name, files] of [
			["one", api.one],
			["again.one", api.again.one]
		]) {
			out.reads[name] = {
				boxed: await settle(async () => (await files.box()).run()),
				queued: await settle(() => files.viaQueue()),
				boxedCjs: await settle(async () => (await files.boxCjs()).run())
			};
		}
		return out;
	} finally {
		await api.shutdown();
	}
}

/**
 * Run {@link scenario} for every rule set under Node's own loader, in one process of its own.
 * @param {{mode: string, runtime: string, attribution: string}} config - The config.
 * @param {string} helpers - The `helpers` option.
 * @returns {Record<string, object>} The outcome by rule set, and under `state` with no permissions.
 */
function runUnderNode(config, helpers) {
	const script = `
		import slothlet from "@cldmv/slothlet";
		const keep = setInterval(() => {}, 1000);
		const scenario = ${scenario.toString()};
		const out = { state: await scenario(slothlet, ${JSON.stringify(DIR)}, ${JSON.stringify(config)}, ${JSON.stringify(helpers)}, null) };
		for (const { rules, list } of ${JSON.stringify(RULE_SETS.map(({ rules, list }) => ({ rules, list })))})
			out[rules] = await scenario(slothlet, ${JSON.stringify(DIR)}, ${JSON.stringify(config)}, ${JSON.stringify(helpers)}, list);
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
		clearInterval(keep);
	`;
	const child = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", script], {
		cwd: ROOT,
		encoding: "utf8",
		timeout: 240000
	});
	const line = String(child.stdout)
		.split("\n")
		.find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`no result: ${child.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

/**
 * What the helpers' own code reads through one api file, under a rule set.
 * @param {string} file - The api file's module path (`one` or `again.one`).
 * @param {boolean} perModule - Whether helpers are loaded once per api file.
 * @param {function(string): boolean} denies - Which caller paths the rules deny.
 * @returns {{boxed: string, queued: string, boxedCjs: string}} The expected reads.
 */
function expectedReads(file, perModule, denies) {
	// An ES module copy names the api file and mount it was loaded for; one copy stands for every importer.
	const esm = (perModule ? [file] : ESM_IMPORTERS).some(denies) ? DENIED : SECRET;
	// A CommonJS copy's frames carry the file's path alone: every api file loading the helper.
	const cjs = CJS_LOADERS.some(denies) ? DENIED : SECRET;
	return { boxed: esm, queued: esm, boxedCjs: cjs };
}

describe.each([
	{ loader: "vitest's module runner and the plugin", inProcess: true },
	{ loader: "Node's own loader", inProcess: false }
])("Config > helpers > one folder mounted twice > $loader", ({ inProcess }) => {
	describe.each(MATRIX)("$name", (config) => {
		describe.each([
			{ helpers: "instance", perModule: false },
			{ helpers: "module", perModule: true }
		])('helpers: "$helpers"', ({ helpers, perModule }) => {
			/** @type {Record<string, object>|null} */
			let underNode = null;
			/**
			 * The outcome under one rule set (`state` for no permissions), from the loader this block is about.
			 * @param {string} rules - The rule set's name.
			 * @param {Array<object>|null} list - Its rules.
			 * @returns {Promise<object>} The outcome.
			 */
			const outcome = async (rules, list) => {
				if (inProcess) return scenario(slothlet, DIR, config, helpers, list);
				return (underNode ??= runUnderNode(config, helpers))[rules];
			};

			// The attribution setting changes no module state: counted once per mode and runtime.
			it.runIf(config.attribution === "precise")(
				"module state is shared, or not, across the base and the mount",
				async () => {
					const { counts } = await outcome("state", null);
					// One module counts on; a copy per api file and mount starts at one each.
					expect(counts.esm).toEqual(perModule ? [1, 1, 1, 1, 2] : [1, 2, 3, 4, 5]);
					expect(counts.cjs).toEqual(perModule ? [1, 1, 1, 1, 2] : [1, 2, 3, 4, 5]);
				},
				240000
			);

			it.each(RULE_SETS)(
				"a helper's own code is held to the files and mounts its copy stands for, $rules",
				async ({ rules, list, denies }) => {
					const { reads } = await outcome(rules, list);
					expect(reads).toEqual({
						one: expectedReads("one", perModule, denies),
						"again.one": expectedReads("again.one", perModule, denies)
					});
				},
				240000
			);
		});
	});
});
