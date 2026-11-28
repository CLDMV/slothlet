/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/internal-import-compiled-code.test.vitest.mjs
 *	@Date: 2026-11-27T14:52:35-08:00 (1795819955)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:16-08:00 (1795869136)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Code a module compiles from a string imports one of slothlet's own files, or a leaf file, no more than
 * the module's own code does, whoever calls that code.
 *
 * @description
 * Fixture `api_test_internal_import_compiled`. The leaf file `importer/routes.mjs` compiles code from a string by each
 * route the language and Node offer (the four function constructors, an indirect `eval`, `vm.runInThisContext`,
 * `vm.compileFunction`, `vm` code under the name of a file that is not there, an indirect `eval` inside code compiled
 * with `new Function`, code naming a host file in a `sourceURL` comment, a `require()` made inside compiled code), and
 * the compiled code imports or requires a file of slothlet's own (by its URL, and by one of slothlet's `#imports`
 * specifiers) or the leaf file `target/t.mjs`. Its `run` export calls that code itself; its `give` export returns it
 * uncalled, and the host calls it.
 *
 * Either way the import is the module's: slothlet's file is refused with MODULE_INTERNAL_NOT_IMPORTABLE and the leaf
 * file with MODULE_LEAF_IMPORT_REFUSED, with the permission system off and on with `capability:code` opened for the
 * leaf. With the capability closed, compiling is refused first (`PERMISSION_CAPABILITY_REFUSED`), except for an
 * indirect `eval`, which is not wrapped. A `require()` of an `#imports` specifier that has no `require` condition fails
 * as it fails for the host. The host's own imports and requires, and those of code it compiles, work as before.
 *
 * With the permission system off, the `vm` functions are not wrapped, and code they compile names no importer and no
 * file of the module's: such code handed to the host and called by it, and code compiled under a file name the module
 * chose, cannot be told from the host's own. Those outcomes are not checked here (see `docs/MODULE-STRUCTURE.md`).
 *
 * The exact outcomes are checked under Node's own loader, in a child process (`lib/probe.mjs`). Under vitest's runner,
 * code compiled inside a module file vitest compiled has no dynamic import callback, so only some routes reach the
 * resolve hook there; every route is still checked to hand out nothing of either file.
 *
 * @module tests/vitests/suites/permissions/internal-import-compiled-code
 */
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const FIXTURE = path.resolve(process.cwd(), "api_tests/api_test_internal_import_compiled");
const BASE = path.join(FIXTURE, "api");
const INTERNAL = "MODULE_INTERNAL_NOT_IMPORTABLE";
const LEAF = "MODULE_LEAF_IMPORT_REFUSED";
const CAPABILITY = "PERMISSION_CAPABILITY_REFUSED";
const NO_REQUIRE_IMPORT = "ERR_PACKAGE_IMPORT_NOT_DEFINED";
const NO_CALLBACK = "ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING";

/** The routes of `importer/routes.mjs`, and whether the permission system wraps each. */
const ROUTES = [
	{ route: "fn", wrapped: true },
	{ route: "asyncFn", wrapped: true },
	{ route: "generatorFn", wrapped: true },
	{ route: "asyncGeneratorFn", wrapped: true },
	{ route: "indirectEval", wrapped: false },
	{ route: "runInThisContext", wrapped: true, vm: true },
	{ route: "compileFunction", wrapped: true, vm: true },
	{ route: "namedScript", wrapped: true, vm: true, named: true },
	{ route: "nestedEval", wrapped: true },
	{ route: "namedSource", wrapped: true },
	{ route: "compiledRequire", wrapped: true, require: true }
];
const TARGETS = ["internal", "internalSpecifier", "leaf"];

/**
 * Whether an outcome is one the permission system off leaves to the host (see the file's description): `vm` code
 * handed to the host, or `vm` code under a file name the module chose.
 * @param {string} permissions - `off`, `open` or `closed`.
 * @param {"run"|"give"} how - Who calls the compiled code.
 * @param {{vm?: boolean, named?: boolean}} entry - The route.
 * @returns {boolean} True for such an outcome.
 */
const isUnwrappedVm = (permissions, how, entry) => permissions === "off" && entry.vm === true && (how === "give" || entry.named === true);

/**
 * The outcome each call is expected to give.
 * @param {string} permissions - `off`, `open` or `closed`.
 * @param {{route: string, wrapped: boolean, require?: boolean}} entry - The route.
 * @param {string} target - The target.
 * @returns {{code: string}} The outcome.
 */
function expectedOutcome(permissions, entry, target) {
	if (permissions === "closed" && entry.wrapped) return { code: CAPABILITY };
	if (entry.require && target === "internalSpecifier") return { code: NO_REQUIRE_IMPORT };
	return { code: target === "leaf" ? LEAF : INTERNAL };
}

/** The permission settings: off, on with `capability:code` opened for the importer, and on with it closed. */
const PERMISSIONS = {
	off: undefined,
	open: { policy: "allow", rules: [{ caller: "importer.**", target: "capability:code", effect: "allow" }] },
	closed: { policy: "allow" }
};

/** One configuration per mode and runtime of the shared matrix, in each permission setting. */
const MATRIX = [];
for (const entry of getMatrixConfigs()) {
	const { mode, runtime } = entry.config;
	for (const permissions of Object.keys(PERMISSIONS))
		if (!MATRIX.some((c) => c.mode === mode && c.runtime === runtime && c.permissions === permissions))
			MATRIX.push({ name: `${mode}/${runtime} permissions ${permissions}`, mode, runtime, permissions });
}

/** How the host calls compiled code of each kind (see `importer/routes.mjs`). */
const INVOKE = {
	call: (fn) => fn(),
	generator: (fn) => fn().next().value,
	asyncGenerator: async (fn) => (await fn().next()).value
};

/**
 * The outcome of a call: its value, or the codes in the chain of what it threw.
 * @param {function(): *} fn - The call.
 * @returns {Promise<{value?: *, codes?: string[]}>} The outcome.
 */
async function outcome(fn) {
	try {
		return { value: await fn() };
	} catch (error) {
		const codes = [];
		for (let at = error; at && codes.length < 10; at = at.cause) codes.push(at?.code ?? String(at?.message ?? at));
		return { codes };
	}
}

describe.each(MATRIX)("Permissions > code a module compiles cannot import slothlet's own files > $name", (config) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	const build = () =>
		slothlet({
			base: BASE,
			mode: config.mode,
			runtime: config.runtime,
			silent: true,
			...(PERMISSIONS[config.permissions] === undefined ? {} : { permissions: PERMISSIONS[config.permissions] })
		});

	for (const entry of ROUTES)
		for (const how of ["run", "give"]) {
			it.skipIf(isUnwrappedVm(config.permissions, how, entry))(`hands out nothing to ${entry.route} (${how})`, async () => {
				api = await build();
				for (const target of TARGETS) {
					const tag = `vitest ${config.name} ${how} ${entry.route} ${target}`;
					const called = await outcome(async () => {
						if (how === "run") return await api.importer.routes.run(entry.route, target, tag);
						const { kind, fn } = await api.importer.routes.give(entry.route, target, tag);
						return await INVOKE[kind](fn);
					});
					expect(called.value, `${target}: nothing is handed out`).toBeUndefined();
					const allowed = [INTERNAL, LEAF, CAPABILITY, NO_REQUIRE_IMPORT, NO_CALLBACK];
					expect(
						called.codes.some((code) => allowed.includes(code)),
						`${target}: ${called.codes.join(" > ")}`
					).toBe(true);
				}
				if (config.mode === "lazy") expect(api.slothlet.node(api.unrelated).materialized).toBe(false);
			});
		}

	it("lets the host require the leaf file", async () => {
		api = await build();
		const required = createRequire(import.meta.url)(path.join(BASE, "target/t.mjs"));
		expect(required.value).toBe("leaf value");
	});
});

describe("Permissions > code a module compiles cannot import slothlet's own files > under Node's own loader", () => {
	it("refuses every route in every mode, runtime and permission setting, and lets the host import", () => {
		const conditions = process.execArgv.filter((arg) => arg.startsWith("--conditions="));
		const result = spawnSync(
			process.execPath,
			[...conditions, "--disable-warning=ExperimentalWarning", path.join(FIXTURE, "lib", "probe.mjs")],
			{
				encoding: "utf8",
				timeout: 280000
			}
		);
		expect(result.stderr).toBe("");
		const out = JSON.parse(result.stdout);
		const expected = {};
		for (const mode of ["eager", "lazy"])
			for (const runtime of ["async", "live"])
				for (const permissions of Object.keys(PERMISSIONS)) {
					const key = `${mode}/${runtime}/${permissions}`;
					for (const entry of ROUTES)
						for (const target of TARGETS)
							for (const how of ["run", "give"]) {
								const name = `${key}/${how}/${entry.route}/${target}`;
								if (isUnwrappedVm(permissions, how, entry)) delete out[name];
								else expected[name] = expectedOutcome(permissions, entry, target);
							}
					expected[`${key}/host/internal`] = { value: "loaded" };
					expected[`${key}/host/leaf`] = { value: "leaf value" };
					expected[`${key}/host/require`] = { value: "leaf value" };
					expected[`${key}/hostCompiled/internal`] = { value: "loaded" };
					expected[`${key}/hostCompiled/leaf`] = { value: "leaf value" };
					if (mode === "lazy") expected[`${key}/unrelatedBuilt`] = false;
				}
		expect(out).toEqual(expected);
	}, 300000);
});
