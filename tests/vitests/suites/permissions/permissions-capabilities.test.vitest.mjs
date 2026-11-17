/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-capabilities.test.vitest.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:43-08:00 (1794882583)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview While the permission system is on, the language's and Node's built-in capabilities are refused to
 * module code by default, and a host rule naming `capability:<name>` opens one per leaf.
 *
 * @description
 * `capability:code` covers turning a string into code (the four function constructors by every route to them, a
 * string timer, `vm`, `Module#_compile`, Node's `contextify` binding), `capability:imports` an `import()` of a `data:`
 * or `blob:` URL from module code, and `capability:loader` registering module hooks. Each route is tried from module
 * code and from the host, by default, with a rule opening it for exactly one leaf (its sibling stays refused), with a
 * more specific deny under a broader allow, with a rule added at runtime and once the rules are sealed, and with the
 * permission system off or disabled. Where a route is allowed, its outcome is the plain-JavaScript one.
 *
 * @module tests/vitests/suites/permissions/permissions-capabilities
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import vm from "node:vm";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";
import { routes } from "../../../../api_tests/api_test_code_strings/routes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_code_strings");

/** Each capability's routes. `register` starts a loader thread, so it is only tried where it is refused. */
const CAPABILITIES = {
	code: [
		"Function",
		"newFunction",
		"functionConstructor",
		"functionPrototypeConstructor",
		"asyncFunction",
		"generatorFunction",
		"asyncGeneratorFunction",
		"reflectConstruct",
		"subclass",
		"bound",
		"runInThisContext",
		"runInNewContext",
		"runInContext",
		"compileFunction",
		"script",
		"createScript",
		"moduleCompile",
		"stringTimeout",
		"stringInterval"
	],
	imports: ["dataImport"],
	loader: ["registerHooks"]
};
// Node's `contextify` binding compiles under names that cannot be checked, so it stays refused where the capability is
// opened (see permissions-capability-filenames).
const REFUSED_ONLY = { code: ["binding"], loader: ["register"] };

const REFUSED = { ok: false, code: "CAPABILITY_REFUSED" };
const OPEN = { caller: "**", target: "**", effect: "allow" };

/**
 * Run a route the way the module's probe does, as the host.
 * @param {string} route - The route.
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 */
async function hostAttempt(route) {
	try {
		return { ok: true, value: await routes[route]({ vm, Module, file: fileURLToPath(import.meta.url) }) };
	} catch (error) {
		return { ok: false, code: error?.code ?? error?.name ?? String(error) };
	}
}

/** What each route gives in plain JavaScript, with no instance up. */
const PLAIN = {};

beforeAll(async () => {
	for (const list of Object.values(CAPABILITIES)) for (const route of list) PLAIN[route] = await hostAttempt(route);
});

/**
 * Try every route of a capability through a leaf.
 * @param {Function} leaf - The leaf (`attempt` or `attemptToo`).
 * @param {string[]} list - The routes.
 * @returns {Promise<Record<string, object>>} Each route's outcome.
 */
async function tryAll(leaf, list) {
	const outcomes = {};
	for (const route of list) outcomes[route] = await withSuppressedSlothletErrorOutput(() => leaf(route));
	return outcomes;
}

/**
 * The outcomes every route of a list should give.
 * @param {string[]} list - The routes.
 * @param {object|null} refused - The refusal, or null for the plain outcome.
 * @returns {Record<string, object>} The outcomes.
 */
const expected = (list, refused) => Object.fromEntries(list.map((route) => [route, refused ?? PLAIN[route]]));

describe.each(getMatrixConfigs())("Permissions > built-in capabilities > $name", ({ config }) => {
	describe.each(["precise", "fast"])("attribution %s", (attribution) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		/**
		 * Build the base and mount the two probing modules.
		 * @param {object} [permissions] - The permission settings.
		 * @returns {Promise<object>} The api.
		 */
		const build = async (permissions = { policy: "deny", rules: [OPEN], caller: { attribution } }) => {
			api = await slothlet({ ...config, silent: true, base: path.join(ROOT, "base"), permissions });
			await api.slothlet.api.add("coder", path.join(ROOT, "coder"), { id: "coder" });
			await api.slothlet.api.add("other", path.join(ROOT, "other"), { id: "other" });
			return api;
		};

		describe.each(Object.keys(CAPABILITIES))("capability:%s", (name) => {
			const list = CAPABILITIES[name];

			it("is refused to module code by default, even under a rule allowing everything", async () => {
				await build();
				expect(await tryAll(api.coder.probe.attempt, [...list, ...(REFUSED_ONLY[name] ?? [])])).toEqual(
					expected([...list, ...(REFUSED_ONLY[name] ?? [])], REFUSED)
				);
			});

			it("the host is not restricted", async () => {
				await build();
				const outcomes = {};
				for (const route of list) outcomes[route] = await hostAttempt(route);
				expect(outcomes).toEqual(expected(list, null));
			});

			it("a rule opens it for exactly the leaf it names", async () => {
				await build({
					policy: "deny",
					caller: {
						attribution
					},
					rules: [OPEN, { caller: "coder.probe.attempt", target: `capability:${name}`, effect: "allow" }]
				});
				expect(await tryAll(api.coder.probe.attempt, list)).toEqual(expected(list, null));
				expect(await tryAll(api.coder.probe.attemptToo, list)).toEqual(expected(list, REFUSED));
				expect(await tryAll(api.other.probe.attempt, list)).toEqual(expected(list, REFUSED));
			});

			it("a more specific deny beats a broader allow", async () => {
				await build({
					policy: "deny",
					caller: {
						attribution
					},
					rules: [
						OPEN,
						{ caller: "coder.**", target: `capability:${name}`, effect: "allow" },
						{ caller: "coder.probe.attemptToo", target: `capability:${name}`, effect: "deny" }
					]
				});
				expect(await tryAll(api.coder.probe.attempt, list)).toEqual(expected(list, null));
				expect(await tryAll(api.coder.probe.attemptToo, list)).toEqual(expected(list, REFUSED));
			});

			it("a rule added at runtime opens it, and sealed rules take no more", async () => {
				await build();
				expect(await tryAll(api.coder.probe.attempt, list)).toEqual(expected(list, REFUSED));
				api.slothlet.permissions.addRule({ caller: "coder.probe.attempt", target: `capability:${name}`, effect: "allow" });
				expect(await tryAll(api.coder.probe.attempt, list)).toEqual(expected(list, null));
				api.slothlet.permissions.control.seal();
				expect(() =>
					api.slothlet.permissions.addRule({ caller: "coder.probe.attemptToo", target: `capability:${name}`, effect: "allow" })
				).toThrow();
				expect(await tryAll(api.coder.probe.attemptToo, list)).toEqual(expected(list, REFUSED));
			});

			it.each([["off"], ["disabled"]])("with the permission system %s nothing is refused", async (mode) => {
				await build({ mode, policy: "deny", rules: [OPEN], caller: { attribution } });
				expect(await tryAll(api.coder.probe.attempt, list)).toEqual(expected(list, null));
			});
		});

		// A file's top-level code, as the file first loads, runs as the file's module path (S4): a rule on that path opens a
		// capability for it, a rule on one of its leaves or on another module does not.
		const TOP_PLAIN = {
			newFunction: { ok: true, value: 7 },
			vm: { ok: true, value: 7 },
			stringTimeout: { ok: false, code: "ERR_INVALID_ARG_TYPE" }
		};
		const TOP_REFUSED = {
			newFunction: REFUSED,
			vm: REFUSED,
			stringTimeout: REFUSED
		};
		it.each([
			["refused by default", [], TOP_REFUSED],
			["opened by a rule on the file's module path", [{ caller: "toplevel.boot", target: "capability:code", effect: "allow" }], TOP_PLAIN],
			["opened by a rule on the module's subtree", [{ caller: "toplevel.**", target: "capability:code", effect: "allow" }], TOP_PLAIN],
			[
				"not opened by a rule on one of the file's leaves",
				[{ caller: "toplevel.boot.result", target: "capability:code", effect: "allow" }],
				TOP_REFUSED
			],
			["not opened by a rule on another module", [{ caller: "coder.**", target: "capability:code", effect: "allow" }], TOP_REFUSED]
		])("a file's top-level code turning strings into code as it first loads: %s", async (_label, extra, outcome) => {
			api = await slothlet({
				...config,
				silent: true,
				base: path.join(ROOT, "base"),
				permissions: { policy: "deny", rules: [OPEN, ...extra], caller: { attribution } }
			});
			await api.slothlet.api.add("coder", path.join(ROOT, "coder"), { id: "coder" });
			await api.slothlet.api.add("toplevel", path.join(ROOT, "toplevel"), { id: "toplevel" });
			expect(await api.toplevel.boot.result()).toEqual(outcome);
		});

		// A helper file's top-level code, as it is first evaluated inside the load of the api file importing it, runs as
		// that importer's module path under Node's loader (see the probe below). Under vite's module runner the import record
		// naming the importer is written by the importer's own code, after the helper has run, so it is refused.
		it.each([
			["by default", []],
			[
				"under vite also under a rule on the importing file's module path",
				[{ caller: "helpertop.user", target: "capability:code", effect: "allow" }]
			],
			["under a rule on another module", [{ caller: "coder.**", target: "capability:code", effect: "allow" }]]
		])("a helper file's top-level code compiling a string as it is first evaluated is refused %s", async (_label, extra) => {
			api = await slothlet({
				...config,
				silent: true,
				base: path.join(ROOT, "base"),
				permissions: { policy: "deny", rules: [OPEN, ...extra], caller: { attribution } }
			});
			await api.slothlet.api.add("coder", path.join(ROOT, "coder"), { id: "coder" });
			await api.slothlet.api.add("helpertop", path.join(ROOT, "helpertop"), { id: "helpertop" });
			expect(await api.helpertop.user.result()).toEqual(REFUSED);
		});

		// Under vite's module runner the import statement is resolved where the instance's rules are not (the vite server),
		// so it is refused whatever they say; under Node's own loader the importing file's module path decides (below).
		it.each([
			["by default", []],
			[
				"also under a rule on the importing file's module path",
				[{ caller: "staticdata.inline", target: "capability:imports", effect: "allow" }]
			]
		])("an import statement of a data: URL in a module file under vite is refused, %s", async (_label, extra) => {
			api = await slothlet({
				...config,
				silent: true,
				base: path.join(ROOT, "base"),
				permissions: { policy: "deny", rules: [OPEN, ...extra], caller: { attribution } }
			});
			const loading = (async () => {
				await api.slothlet.api.add("staticdata", path.join(ROOT, "staticdata"), { id: "staticdata" });
				return api.staticdata.inline.value();
			})();
			const outcome = await withSuppressedSlothletErrorOutput(() =>
				loading.then(
					(value) => ({ ok: true, value }),
					(error) => ({ ok: false, refused: String(error?.message).includes("CAPABILITY_REFUSED") })
				)
			);
			expect(outcome).toEqual({ ok: false, refused: true });
		});

		it("Node's contextify binding stays refused to a leaf the capability is opened for", async () => {
			await build({
				policy: "deny",
				caller: {
					attribution
				},
				rules: [OPEN, { caller: "coder.probe.attempt", target: "capability:code", effect: "allow" }]
			});
			expect(await withSuppressedSlothletErrorOutput(() => api.coder.probe.attempt("binding"))).toEqual(REFUSED);
		});

		it("an unknown capability is not a rule", async () => {
			await build();
			expect(() => api.slothlet.permissions.addRule({ caller: "coder.**", target: "capability:nothing", effect: "allow" })).toThrow(
				expect.objectContaining({ code: "INVALID_PERMISSION_RULE" })
			);
		});
	});
});

/**
 * Under Node's own loader, outside vitest's module runner: an import statement of a `data:` URL in a module file is
 * decided by the importing file's module path, as the file links.
 */
describe("Permissions > built-in capabilities > a static data: import and a helper's top level under Node's own loader", () => {
	const SCENARIOS = {
		none: [],
		own: [{ caller: "staticdata.inline", target: "capability:imports", effect: "allow" }],
		sibling: [{ caller: "coder.**", target: "capability:imports", effect: "allow" }]
	};
	const script = `
		import path from "node:path";
		import slothlet from "@cldmv/slothlet";
		const ROOT = ${JSON.stringify(ROOT)};
		const SCENARIOS = ${JSON.stringify(SCENARIOS)};
		const out = {};
		for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) for (const attribution of ["precise", "fast"]) {
			for (const [name, extra] of Object.entries(SCENARIOS)) {
				const api = await slothlet({ mode, runtime, silent: true, base: path.join(ROOT, "base"),
					permissions: { policy: "deny", rules: [{ caller: "**", target: "**", effect: "allow" }, ...extra], caller: { attribution } } });
				await api.slothlet.api.add("coder", path.join(ROOT, "coder"), { id: "coder" });
				let outcome;
				try {
					await api.slothlet.api.add("staticdata", path.join(ROOT, "staticdata"), { id: "staticdata" });
					outcome = await api.staticdata.inline.value();
				} catch (error) {
					outcome = String(error?.message).includes("CAPABILITY_REFUSED") ? "CAPABILITY_REFUSED" : String(error?.code);
				}
				out[mode + "/" + runtime + "/" + attribution + "/" + name] = outcome;
				await api.shutdown();
				const helperRules = name === "own" ? [{ caller: "helpertop.user", target: "capability:code", effect: "allow" }] : name === "sibling" ? [{ caller: "coder.**", target: "capability:code", effect: "allow" }] : [];
				const helperApi = await slothlet({ mode, runtime, silent: true, base: path.join(ROOT, "base"),
					permissions: { policy: "deny", rules: [{ caller: "**", target: "**", effect: "allow" }, ...helperRules], caller: { attribution } } });
				await helperApi.slothlet.api.add("coder", path.join(ROOT, "coder"), { id: "coder" });
				await helperApi.slothlet.api.add("helpertop", path.join(ROOT, "helpertop"), { id: "helpertop" });
				const helper = await helperApi.helpertop.user.result();
				out[mode + "/" + runtime + "/" + attribution + "/helper/" + name] = helper.ok ? helper.value : helper.code;
				await helperApi.shutdown();
			}
		}
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
		process.exit(0);
	`;
	const child = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", script], {
		cwd: path.resolve(ROOT, "../.."),
		encoding: "utf8",
		timeout: 240000
	});
	const line = String(child.stdout)
		.split("\n")
		.find((text) => text.startsWith("RESULT "));
	const out = line ? JSON.parse(line.slice("RESULT ".length)) : {};

	it("runs the probe", () => {
		expect(child.status).toBe(0);
	});

	for (const mode of ["eager", "lazy"])
		for (const runtime of ["async", "live"])
			for (const attribution of ["precise", "fast"]) {
				it(`${mode}/${runtime}/${attribution}: refused by default, opened by a rule on the importing file's module path, not by another module's`, () => {
					const at = `${mode}/${runtime}/${attribution}`;
					expect([out[`${at}/none`], out[`${at}/own`], out[`${at}/sibling`]]).toEqual(["CAPABILITY_REFUSED", 7, "CAPABILITY_REFUSED"]);
				});

				it(`${mode}/${runtime}/${attribution}: a helper's top-level compile runs as its importer's module path`, () => {
					const at = `${mode}/${runtime}/${attribution}/helper`;
					expect([out[`${at}/none`], out[`${at}/own`], out[`${at}/sibling`]]).toEqual(["CAPABILITY_REFUSED", 7, "CAPABILITY_REFUSED"]);
				});
			}
});
