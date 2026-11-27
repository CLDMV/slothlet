/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/leaf-import-compiled-code.test.vitest.mjs
 *	@Date: 2026-11-27T14:27:34-08:00 (1795818454)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T14:32:42-08:00 (1795818762)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Code a module compiles from a string imports a leaf file no more than the module's own code does.
 *
 * @description
 * Fixture `api_test_leaf_import_compiled`. The leaf file `importer/routes.mjs` compiles code from a string by each route
 * the language and Node offer (the `Function`, `AsyncFunction`, `GeneratorFunction` and `AsyncGeneratorFunction`
 * constructors, an indirect `eval`, `vm.runInThisContext`, `vm.compileFunction`, `vm.SourceTextModule`, a string given
 * to `setTimeout`), and the compiled code imports or requires the leaf file `target/t.mjs`. That import is module code's
 * import of a leaf file wherever the compiled code's import is resolved from, so it is refused with
 * MODULE_LEAF_IMPORT_REFUSED in every permission mode: with the permission system off, and on with `capability:code`
 * opened for the leaf. With the capability closed, compiling is refused first (`PERMISSION_CAPABILITY_REFUSED`), except
 * for an indirect `eval`, which is not wrapped. Node takes no string in `setTimeout`, so that route is refused by Node
 * where no capability check comes first. The host imports the leaf file as before, directly and from code it compiles.
 *
 * The exact outcomes are checked under Node's own loader, in a child process (`lib/probe.mjs`). Under vitest's runner,
 * code compiled inside a module file vitest compiled has no dynamic import callback, so only the `vm` routes reach the
 * resolve hook there; every route is still checked to hand out no copy of the leaf file. Each call compiles text of its
 * own, since V8 reuses what it compiled for the same text, the importer it names included.
 *
 * @module tests/vitests/suites/permissions/leaf-import-compiled-code
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const BASE = path.resolve(process.cwd(), "api_tests/api_test_leaf_import_compiled/api");
const TARGET = pathToFileURL(path.join(BASE, "target/t.mjs")).href;
const LEAF = "MODULE_LEAF_IMPORT_REFUSED";
const CAPABILITY = "PERMISSION_CAPABILITY_REFUSED";
const NO_STRING_TIMER = "ERR_INVALID_ARG_TYPE";

/** One configuration per mode and runtime of the shared matrix. */
const CONFIGS = [];
for (const entry of getMatrixConfigs()) {
	const { mode, runtime } = entry.config;
	if (!CONFIGS.some((c) => c.mode === mode && c.runtime === runtime)) CONFIGS.push({ mode, runtime });
}

/** The permission settings: off, on with `capability:code` opened for the importer, and on with it closed. */
const PERMISSIONS = [
	{ name: "permissions off", value: undefined, codeOpen: true },
	{
		name: "capability:code opened",
		value: { policy: "allow", rules: [{ caller: "importer.**", target: "capability:code", effect: "allow" }] },
		codeOpen: true
	},
	{ name: "capability:code closed", value: { policy: "allow" }, codeOpen: false }
];

const MATRIX = [];
for (const config of CONFIGS)
	for (const permissions of PERMISSIONS)
		MATRIX.push({
			name: `${config.mode}/${config.runtime} ${permissions.name}`,
			...config,
			permissions: permissions.value,
			codeOpen: permissions.codeOpen
		});

/**
 * The routes of `importer/routes.mjs`, each compiling code that imports the leaf file.
 * @type {Array<{route: string, name: string, wrapped: boolean, available?: boolean, timer?: boolean}>}
 */
const ROUTES = [
	{ route: "fn", name: "new Function", wrapped: true },
	{ route: "asyncFn", name: "the AsyncFunction constructor", wrapped: true },
	{ route: "generatorFn", name: "the GeneratorFunction constructor", wrapped: true },
	{ route: "asyncGeneratorFn", name: "the AsyncGeneratorFunction constructor", wrapped: true },
	{ route: "indirectEval", name: "an indirect eval", wrapped: false },
	{ route: "runInThisContext", name: "vm.runInThisContext", wrapped: true },
	{ route: "compileFunction", name: "vm.compileFunction", wrapped: true },
	{ route: "sourceTextModule", name: "vm.SourceTextModule", wrapped: true, available: typeof vm.SourceTextModule === "function" },
	{ route: "timerString", name: "a string given to setTimeout", wrapped: true, timer: true },
	{ route: "compiledRequire", name: "a require called from new Function", wrapped: true }
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
 * The outcome of a call: its value, or the codes in the chain of what it threw.
 * @param {function(): *} fn - The call.
 * @returns {Promise<{value?: *, codes?: string[]}>} The outcome.
 */
async function outcome(fn) {
	try {
		return { value: await fn() };
	} catch (error) {
		return { codes: chain(error).map((e) => e?.code ?? String(e?.message ?? e)) };
	}
}

/**
 * Under vitest's runner a module file is compiled by vitest with `vm`, and code it compiles in turn has no dynamic
 * import callback of Node's, so an `import()` from it fails without reaching any file. Either way no copy is handed out.
 */
const NO_CALLBACK = "ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING";

describe.each(MATRIX)("Permissions > code a module compiles cannot import a leaf file > $name", (config) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
		delete globalThis.__slothletCompiledLeafImport;
	});

	const build = () =>
		slothlet({
			base: BASE,
			mode: config.mode,
			runtime: config.runtime,
			silent: true,
			...(config.permissions === undefined ? {} : { permissions: config.permissions })
		});

	for (const entry of ROUTES) {
		it.skipIf(entry.available === false)(`refuses the leaf file to ${entry.name}`, async () => {
			api = await build();
			const called = await outcome(() => api.importer.routes[entry.route](`${config.mode}/${config.runtime}/${config.name}`));
			expect(called.value, "no copy of the leaf file is handed to the module").toBeUndefined();
			const expected = [LEAF, CAPABILITY, NO_STRING_TIMER, NO_CALLBACK];
			expect(
				called.codes.some((code) => expected.includes(code)),
				called.codes.join(" > ")
			).toBe(true);
			if (config.mode === "lazy") expect(api.slothlet.node(api.unrelated).materialized).toBe(false);
		});
	}

	it("lets the host import the leaf file directly", async () => {
		api = await build();
		const namespace = await import(`${TARGET}?host=compiled-${config.mode}-${config.runtime}`);
		expect(namespace.value).toBe("leaf value");
	});
});

describe("Permissions > code a module compiles cannot import a leaf file > under Node's own loader", () => {
	it("refuses every route in every mode, runtime and permission setting, and lets the host import", () => {
		const conditions = process.execArgv.filter((arg) => arg.startsWith("--conditions="));
		const result = spawnSync(
			process.execPath,
			[...conditions, "--disable-warning=ExperimentalWarning", path.join(BASE, "..", "lib", "probe.mjs")],
			{
				encoding: "utf8",
				timeout: 240000
			}
		);
		expect(result.stderr).toBe("");
		const out = JSON.parse(result.stdout);
		const expected = {};
		for (const mode of ["eager", "lazy"])
			for (const runtime of ["async", "live"])
				for (const permissions of ["off", "open", "closed"]) {
					const key = `${mode}/${runtime}/${permissions}`;
					for (const entry of ROUTES) {
						if (entry.available === false) continue;
						let code = LEAF;
						if (permissions === "closed" && entry.wrapped) code = CAPABILITY;
						else if (entry.timer) code = NO_STRING_TIMER;
						expected[`${key}/${entry.route}`] = { code };
					}
					expected[`${key}/host`] = { value: "leaf value" };
					expected[`${key}/hostCompiled`] = { value: "leaf value" };
					if (mode === "lazy") expected[`${key}/unrelatedBuilt`] = false;
				}
		expect(out).toEqual(expected);
	}, 300000);
});
