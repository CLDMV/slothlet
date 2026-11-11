/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-toplevel-identity.test.vitest.mjs
 *	@Date: 2026-11-11T11:27:22-08:00 (1794425242)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:14:56-08:00 (1794431696)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Code outside every export of a file has its own permission path: the path of the file's module. A rule
 * has to name that path itself. A rule on the module's leaves (`m.*`) does not reach it, and a rule on the module path
 * does not reach its leaves.
 *
 * @description
 * Fixture `api_test_toplevel_identity`: one file per way a file becomes a module (see docs/API-RULES.md). Each file
 * reads the vault from code outside every export, two ways that leave no export's frame below it on the stack: from a
 * timer the file starts when it loads, and through a helper a leaf returns and the host runs. A third read runs the
 * same helper from a leaf's own code, which is the leaf's.
 *
 * The CommonJS form runs in a plain Node process: under vitest a CommonJS file's own `import()` of slothlet's runtime is
 * Node's copy, not the one the rest of the test uses.
 *
 * Expected values come from the rule: the denial names the path the code ran as, and only a rule on exactly that path
 * (or one whose pattern matches it) refuses it. Checked in both runtimes, eager and lazy, under both values of
 * `permissions.attribution`.
 *
 * @module tests/vitests/suites/permissions/permissions-toplevel-identity
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_toplevel_identity");

/**
 * The file's four functions, whatever shape its exports take.
 * @param {object} node - The file's node.
 * @returns {{arm: Function, result: Function, give: Function, direct: Function}} The functions.
 */
const named = (node) => ({ arm: () => node.arm(), result: () => node.result(), give: () => node.give(), direct: () => node.direct() });

/**
 * Each form: the file, the path its file-level code runs as, the path of the leaf that runs the helper itself, and how
 * its functions are reached.
 * @type {Array<{form: string, file: string, module: string, leaf: string, reach: function(object): object}>}
 */
const FORMS = [
	{ form: "a file at the root", file: "rootfile.mjs", module: "rootfile", leaf: "rootfile.direct", reach: (api) => named(api.rootfile) },
	{
		form: "a file named after its folder",
		file: "samename/samename.mjs",
		module: "samename",
		leaf: "samename.direct",
		reach: (api) => named(api.samename)
	},
	{
		form: "a file in a folder",
		file: "folder/part.mjs",
		module: "folder.part",
		leaf: "folder.part.direct",
		reach: (api) => named(api.folder.part)
	},
	{
		// A folder named after its parent folder is one level of the path, so the file's module is `deep.part`.
		form: "a file in a folder named after its parent folder",
		file: "deep/deep/part.mjs",
		module: "deep.part",
		leaf: "deep.part.direct",
		reach: (api) => named(api.deep.deep.part)
	},
	{
		form: "the only file of a folder",
		file: "single/only.mjs",
		module: "single.only",
		leaf: "single.only.direct",
		reach: (api) => named(api.single.only)
	},
	{
		form: "a file with a generic name",
		file: "generic/main.mjs",
		module: "generic.main",
		leaf: "generic.main.direct",
		reach: (api) => named(api.generic.main)
	},
	{ form: "a default export object", file: "defobj.mjs", module: "defobj", leaf: "defobj.direct", reach: (api) => named(api.defobj) },
	{
		form: "a default function with named exports",
		file: "kit/callable.mjs",
		module: "kit.callable",
		leaf: "kit.callable.direct",
		reach: (api) => named(api.kit.callable)
	},
	{
		form: "a file whose one export is named after it",
		file: "lone.mjs",
		module: "lone",
		leaf: "lone.lone",
		reach: (api) => ({
			arm: () => api.lone.lone("arm"),
			result: () => api.lone.lone("result"),
			give: () => api.lone.lone("give"),
			direct: () => api.lone.lone("direct")
		})
	},
	{
		form: "an addapi file of an added folder",
		file: "plug/addapi.mjs",
		module: "plug",
		leaf: "plug.direct",
		reach: (api) => named(api.plug)
	},
	{
		form: "a file of an added folder's sub-folder named after the mount",
		file: "dedupe/dedupe/dedupe.mjs",
		module: "dedupe",
		leaf: "dedupe.direct",
		reach: (api) => named(api.dedupe)
	},
	{
		form: "a file of a folder added under a nested path",
		file: "mounted/tool.mjs",
		module: "ext.mounted.tool",
		leaf: "ext.mounted.tool.direct",
		reach: (api) => named(api.ext.mounted.tool)
	}
];

const MATRIX = [];
for (const attribution of ["precise", "fast"])
	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"]) MATRIX.push({ name: `${attribution} ${mode}/${runtime}`, attribution, mode, runtime });

/**
 * The rule sets: one naming each module path itself, one naming each module's leaves.
 * @type {Array<{rules: string, pattern: function(string): string, onModule: boolean}>}
 */
const RULE_SETS = [
	{ rules: "a rule on the module path", pattern: (module) => module, onModule: true },
	{ rules: "a rule on the module's leaves", pattern: (module) => `${module}.*`, onModule: false }
];

/**
 * Build an instance with the fixture's three added folders.
 * @param {object} config - The matrix row.
 * @param {Array<object>} rules - The permission rules.
 * @returns {Promise<object>} The api.
 */
async function build({ attribution, mode, runtime }, rules) {
	const api = await slothlet({
		base: path.join(DIR, "base"),
		mode,
		runtime,
		silent: true,
		permissions: { defaultPolicy: "allow", attribution, rules }
	});
	await api.slothlet.api.add("plug", path.join(DIR, "plug"), { moduleID: "plug" });
	await api.slothlet.api.add("dedupe", path.join(DIR, "dedupe"), { moduleID: "dedupe" });
	await api.slothlet.api.add("ext.mounted", path.join(DIR, "mounted"), { moduleID: "mounted" });
	return api;
}

/**
 * What the file's own timer read, once it has run.
 * @param {{arm: Function, result: Function}} fns - The file's functions.
 * @returns {Promise<*>} The outcome.
 */
async function fromTimer(fns) {
	await fns.arm();
	for (let tries = 0; tries < 200; tries++) {
		const outcome = await fns.result();
		if (outcome !== undefined) return outcome;
		await new Promise((resolve) => setTimeout(resolve, 2));
	}
	return "the timer never ran";
}

describe.each(MATRIX)("Permissions > file-level code has its own path > $name", (config) => {
	describe.each(RULE_SETS)("$rules", ({ pattern, onModule }) => {
		let api;

		beforeAll(async () => {
			api = await build(
				config,
				FORMS.map(({ module }) => ({ caller: pattern(module), target: "vault.**", effect: "deny" }))
			);
			// Load every file, so its timer runs and a lazy node answers as an eager one.
			await api.vault.get();
			for (const { reach } of FORMS) await reach(api).result();
		});

		afterAll(async () => {
			await api?.shutdown();
		});

		it.each(FORMS)("$form ($file): the file's own timer runs as $module", async ({ module, reach }) => {
			expect(await fromTimer(reach(api))).toBe(onModule ? `PERMISSION_DENIED:${module}` : "SECRET");
		});

		it.each(FORMS)("$form ($file): a helper the host runs is $module's", async ({ module, reach }) => {
			const helper = await reach(api).give();
			expect(await helper()).toBe(onModule ? `PERMISSION_DENIED:${module}` : "SECRET");
		});

		it.each(FORMS)("$form ($file): the helper run by a leaf's code is $leaf's", async ({ leaf, reach }) => {
			expect(await reach(api).direct()).toBe(onModule ? "SECRET" : `PERMISSION_DENIED:${leaf}`);
		});
	});
});

/**
 * Run the CommonJS form in a plain Node process, once under each rule set, one instance after the other.
 * @param {{attribution: string, mode: string, runtime: string}} config - The matrix row.
 * @returns {Array<{timer: *, host: *, leaf: *}>} The three reads under a rule on `cjsfile`, then under one on `cjsfile.*`.
 */
function runCommonJS({ attribution, mode, runtime }) {
	const script = `
		import slothlet from "@cldmv/slothlet";
		const out = [];
		for (const caller of ["cjsfile", "cjsfile.*"]) {
			const api = await slothlet({ base: ${JSON.stringify(path.join(DIR, "base"))}, mode: ${JSON.stringify(mode)}, runtime: ${JSON.stringify(runtime)},
				silent: true, permissions: { defaultPolicy: "allow", attribution: ${JSON.stringify(attribution)},
				rules: [{ caller, target: "vault.**", effect: "deny" }] } });
			await api.vault.get();
			await api.cjsfile.result();
			await api.cjsfile.arm();
			let timer;
			for (let tries = 0; tries < 200 && timer === undefined; tries++) {
				timer = await api.cjsfile.result();
				if (timer === undefined) await new Promise((resolve) => setTimeout(resolve, 2));
			}
			const helper = await api.cjsfile.give();
			out.push({ timer, host: await helper(), leaf: await api.cjsfile.direct() });
			await api.shutdown();
		}
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
		process.exit(0);
	`;
	const child = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", script], {
		cwd: path.resolve(DIR, "../.."),
		encoding: "utf8",
		timeout: 120000
	});
	const line = String(child.stdout)
		.split("\n")
		.find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`no result: ${child.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

describe.each(MATRIX)("Permissions > file-level code has its own path > a CommonJS file > $name", (config) => {
	it("runs as cjsfile from its own timer and when the host runs its helper, and as cjsfile.direct from a leaf's code", () => {
		expect(runCommonJS(config)).toEqual([
			{ timer: "PERMISSION_DENIED:cjsfile", host: "PERMISSION_DENIED:cjsfile", leaf: "SECRET" },
			{ timer: "SECRET", host: "SECRET", leaf: "PERMISSION_DENIED:cjsfile.direct" }
		]);
	});
});
