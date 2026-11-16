/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-capabilities.test.vitest.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T00:00:00-08:00 (1794816000)
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
		const build = async (permissions = { defaultPolicy: "deny", rules: [OPEN], attribution }) => {
			api = await slothlet({ ...config, silent: true, base: path.join(ROOT, "base"), permissions });
			await api.slothlet.api.add("coder", path.join(ROOT, "coder"), { moduleID: "coder" });
			await api.slothlet.api.add("other", path.join(ROOT, "other"), { moduleID: "other" });
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
					defaultPolicy: "deny",
					attribution,
					rules: [OPEN, { caller: "coder.probe.attempt", target: `capability:${name}`, effect: "allow" }]
				});
				expect(await tryAll(api.coder.probe.attempt, list)).toEqual(expected(list, null));
				expect(await tryAll(api.coder.probe.attemptToo, list)).toEqual(expected(list, REFUSED));
				expect(await tryAll(api.other.probe.attempt, list)).toEqual(expected(list, REFUSED));
			});

			it("a more specific deny beats a broader allow", async () => {
				await build({
					defaultPolicy: "deny",
					attribution,
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
				await build({ mode, defaultPolicy: "deny", rules: [OPEN], attribution });
				expect(await tryAll(api.coder.probe.attempt, list)).toEqual(expected(list, null));
			});
		});

		// As the file first loads, no node stands for it yet, so its code cannot be told from the instance's other files.
		it.each([
			["by default", []],
			["also under a rule on the file's module path", [{ caller: "toplevel.**", target: "capability:code", effect: "allow" }]]
		])("a file's top-level code compiling a string as it first loads is refused, %s", async (_label, extra) => {
			const outcome = { ok: false, code: "CAPABILITY_REFUSED" };
			api = await slothlet({
				...config,
				silent: true,
				base: path.join(ROOT, "base"),
				permissions: { defaultPolicy: "deny", rules: [OPEN, ...extra], attribution }
			});
			await api.slothlet.api.add("toplevel", path.join(ROOT, "toplevel"), { moduleID: "toplevel" });
			expect(await api.toplevel.boot.result()).toEqual(outcome);
		});

		it("an import statement of a data: URL in a module file is refused, whatever the rules", async () => {
			api = await slothlet({
				...config,
				silent: true,
				base: path.join(ROOT, "base"),
				permissions: {
					defaultPolicy: "deny",
					rules: [OPEN, { caller: "**", target: "capability:imports", effect: "allow" }],
					attribution
				}
			});
			const loading = (async () => {
				await api.slothlet.api.add("staticdata", path.join(ROOT, "staticdata"), { moduleID: "staticdata" });
				return api.staticdata.inline.value();
			})();
			const error = await withSuppressedSlothletErrorOutput(() =>
				loading.then(
					() => null,
					(caught) => caught
				)
			);
			expect(
				JSON.stringify({ code: error?.code, cause: error?.cause?.code ?? error?.originalError?.code, message: String(error?.message) })
			).toContain("CAPABILITY_REFUSED");
		});

		it("Node's contextify binding stays refused to a leaf the capability is opened for", async () => {
			await build({
				defaultPolicy: "deny",
				attribution,
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
