/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/leaf-import-refused.test.vitest.mjs
 *	@Date: 2026-11-23T19:59:51-08:00 (1795492791)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-23T20:11:01-08:00 (1795493461)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module code imports lib files, never a leaf file of an api tree, whatever the permission system's mode.
 *
 * @description
 * Fixture `api_test_leaf_import_refused`. Each folder under `cases/` is a base folder with an `importer/` folder that
 * reaches a file one way, and an `unrelated/` folder that nothing reaches. A file slothlet composes into an api tree is
 * a leaf file: an import of one made by module code (a leaf, or a lib file a leaf loaded) is refused with
 * MODULE_LEAF_IMPORT_REFUSED, naming the importing file and the leaf file, by every route (a static `import`, an
 * `export … from`, `import()`, `require`, a `require` made by `createRequire`, a TypeScript file's import), for a
 * sibling, a file in a subfolder, a file of another folder of the tree and a file of an `api.add()` mount. A lib file
 * outside the tree imports and is imported as before, and the host imports leaf files as before.
 *
 * An eager build of a tree whose file imports a leaf fails with the importer's MODULE_IMPORT_FAILED, the refusal as its
 * cause. A lazy tree builds, and the folder holding the importer fails as it loads; no other folder is built.
 *
 * @module tests/vitests/suites/permissions/leaf-import-refused
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const FIXTURE = path.resolve(process.cwd(), "api_tests/api_test_leaf_import_refused");
const CASES = path.join(FIXTURE, "cases");
const REFUSED = "MODULE_LEAF_IMPORT_REFUSED";

/** One configuration per mode and runtime of the shared matrix. */
const CONFIGS = [];
for (const entry of getMatrixConfigs()) {
	const { mode, runtime } = entry.config;
	if (!CONFIGS.some((c) => c.mode === mode && c.runtime === runtime)) CONFIGS.push({ mode, runtime });
}

/** The permission system's modes: no `permissions` config, on, and disabled. */
const PERMISSIONS = [
	{ name: "permissions off", value: undefined },
	{ name: "permissions on", value: { policy: "allow" } },
	{ name: "permissions disabled", value: { mode: "disabled" } }
];

const MATRIX = [];
for (const config of CONFIGS)
	for (const permissions of PERMISSIONS)
		MATRIX.push({ name: `${config.mode}/${config.runtime} ${permissions.name}`, ...config, permissions: permissions.value });

/**
 * Cases whose importer reaches the file as it loads, and the importer and leaf file the refusal names.
 * @type {Array<{name: string, folder: string, importer: string, leaf: string, typescript?: boolean}>}
 */
const AT_LOAD = [
	{ name: "a static import of another folder's file", folder: "static", importer: "importer/run.mjs", leaf: "static/target/t.mjs" },
	{ name: "a static import of a sibling", folder: "sibling", importer: "importer/run.mjs", leaf: "sibling/importer/peer.mjs" },
	{ name: "a static import of a subfolder's file", folder: "subfolder", importer: "importer/run.mjs", leaf: "importer/deep/inner.mjs" },
	{ name: "a re-export", folder: "reexport", importer: "importer/run.mjs", leaf: "reexport/target/t.mjs" },
	{ name: "a CommonJS require", folder: "cjs", importer: "importer/run.cjs", leaf: "cjs/target/t.cjs" },
	{ name: "a lib file a leaf loaded", folder: "launder", importer: "lib/launder.mjs", leaf: "launder/target/t.mjs" },
	{
		name: "a TypeScript leaf importing a TypeScript leaf",
		folder: "ts",
		importer: "importer/run.mts",
		leaf: "ts/target/t.mts",
		typescript: true
	},
	{
		name: "a TypeScript leaf importing a JavaScript leaf",
		folder: "ts-mjs",
		importer: "importer/run",
		leaf: "ts-mjs/target/t.mjs",
		typescript: true
	}
];

/**
 * Cases whose importer reaches the file when its function is called.
 * @type {Array<{name: string, folder: string, importer: string, leaf: string}>}
 */
const AT_CALL = [
	{ name: "a dynamic import()", folder: "dynamic", importer: "importer/run.mjs", leaf: "dynamic/target/t.mjs" },
	{ name: "a require made by createRequire", folder: "create-require", importer: "importer/run.mjs", leaf: "create-require/target/t.cjs" }
];

/**
 * Every error in a chain of causes.
 * @param {*} error - What was thrown.
 * @returns {Array<*>} The error and its causes.
 */
function chain(error) {
	const list = [];
	for (let at = error; at && list.length < 10; at = at.cause) list.push(at);
	return list;
}

/**
 * The refusal in a chain of causes, or null.
 * @param {*} error - What was thrown.
 * @returns {*} The refusal.
 */
const refusalOf = (error) => chain(error).find((e) => e?.code === REFUSED) ?? null;

/**
 * The outcome of a call: its value, or the refusal it threw, or the code of what else it threw.
 * @param {function(): *} fn - The call.
 * @returns {Promise<{value?: *, refused?: *, code?: string}>} The outcome.
 */
async function outcome(fn) {
	try {
		return { value: await fn() };
	} catch (error) {
		const refused = refusalOf(error);
		return refused ? { refused, top: error.code } : { code: error?.code ?? String(error?.message ?? error) };
	}
}

/**
 * The slothlet options for a configuration and a base folder.
 * @param {object} config - The configuration.
 * @param {string} base - The base folder.
 * @param {boolean} [typescript] - Whether TypeScript files are loaded.
 * @returns {object} The options.
 */
const options = (config, base, typescript = false) => ({
	base,
	mode: config.mode,
	runtime: config.runtime,
	silent: true,
	...(typescript ? { typescript: "fast" } : {}),
	...(config.permissions === undefined ? {} : { permissions: config.permissions })
});

/**
 * Whether a refusal names both files.
 * @param {*} refused - The refusal.
 * @param {string} importer - The end of the importer's path.
 * @param {string} leaf - The end of the leaf file's path.
 * @returns {void}
 */
function expectNames(refused, importer, leaf) {
	const message = String(refused.message).replace(/\\/g, "/");
	expect(message).toContain(importer);
	expect(message).toContain(leaf);
}

describe.each(MATRIX)("Permissions > module code cannot import a leaf file > $name", (config) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	for (const entry of AT_LOAD) {
		it(`refuses ${entry.name}`, async () => {
			const base = path.join(CASES, entry.folder);
			const built = await outcome(() => slothlet(options(config, base, entry.typescript)));
			if (config.mode === "eager") {
				expect(built.refused, "the eager build fails with the refusal as a cause").toBeTruthy();
				expect(built.top).toBe("MODULE_IMPORT_FAILED");
				expectNames(built.refused, entry.importer, entry.leaf);
				return;
			}
			api = built.value;
			expect(api, "a lazy tree builds").toBeTruthy();
			expect(api.slothlet.node(api.unrelated).materialized).toBe(false);
			const called = await outcome(() => api.importer.run());
			expect(called.refused, "the folder holding the importer fails as it loads").toBeTruthy();
			expectNames(called.refused, entry.importer, entry.leaf);
			expect(api.slothlet.node(api.unrelated).materialized, "no other folder is built").toBe(false);
		});
	}

	for (const entry of AT_CALL) {
		it(`refuses ${entry.name}`, async () => {
			api = await slothlet(options(config, path.join(CASES, entry.folder)));
			const called = await outcome(() => api.importer.run());
			expect(called.refused).toBeTruthy();
			expect(called.refused.code).toBe(REFUSED);
			expectNames(called.refused, entry.importer, entry.leaf);
			if (config.mode === "lazy") expect(api.slothlet.node(api.unrelated).materialized).toBe(false);
		});
	}

	it("lets a module import a lib file outside the tree", async () => {
		api = await slothlet(options(config, path.join(CASES, "clean")));
		expect(await api.importer.run()).toBe("lib");
	});

	it("lets the host import a leaf file", async () => {
		api = await slothlet(options(config, path.join(CASES, "clean")));
		const hostCopy = await import(pathToFileURL(path.join(CASES, "clean/target/t.mjs")).href);
		expect(hostCopy.value).toBe("t");
		expect(await api.importer.run()).toBe("lib");
	});

	it("refuses an api.add() mount's file importing a leaf of the base tree", async () => {
		api = await slothlet(options(config, path.join(CASES, "clean")));
		const added = await outcome(async () => {
			await api.slothlet.api.add("added", path.join(FIXTURE, "mounts/reaches-base"));
			return api.added.x();
		});
		expect(added.refused).toBeTruthy();
		expectNames(added.refused, "reaches-base/x.mjs", "clean/target/t.mjs");
	});

	it("refuses an import of an api.add() mount's file once it is mounted", async () => {
		api = await slothlet(options(config, path.join(CASES, "dynamic-mount")));
		expect(await api.importer.run(), "a file no tree composes is a lib file").toBe("m");
		await api.slothlet.api.add("extra", path.join(FIXTURE, "mounts/extra"));
		const called = await outcome(() => api.importer.run());
		expect(called.refused).toBeTruthy();
		expectNames(called.refused, "importer/run.mjs", "extra/m.mjs");
	});
});

describe("Permissions > module code cannot import a leaf file > under Node's own loader", () => {
	it("refuses every route in every mode and runtime, as under vitest's runner", () => {
		const conditions = process.execArgv.filter((arg) => arg.startsWith("--conditions="));
		const result = spawnSync(process.execPath, [...conditions, path.join(FIXTURE, "probe.mjs")], { encoding: "utf8", timeout: 240000 });
		expect(result.stderr).toBe("");
		const out = JSON.parse(result.stdout);
		const expected = {};
		for (const mode of ["eager", "lazy"])
			for (const runtime of ["async", "live"])
				for (const name of [
					"static",
					"sibling",
					"subfolder",
					"reexport",
					"cjs",
					"launder",
					"ts",
					"ts-mjs",
					"dynamic",
					"create-require",
					"clean"
				])
					expected[`${mode}/${runtime}/${name}`] = {
						...(name === "clean" ? { value: "lib" } : { code: REFUSED }),
						...(mode === "lazy" ? { unrelatedBuilt: false } : {})
					};
		expect(out).toEqual(expected);
	}, 300000);
});
