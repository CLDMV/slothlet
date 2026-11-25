/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-capability-filenames.test.vitest.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:08:43-08:00 (1795536523)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview With `capability:code` opened for a leaf, compiling under the name of a real file outside the leaf's
 * own folder is still refused.
 *
 * @description
 * A leaf a rule opens `capability:code` for compiles `return 7` under a file name, with `vm.compileFunction`,
 * `vm.runInThisContext`, `new vm.Script` and `Module#_compile`. Under its own file, or a name no file holds, the
 * compile goes through. Under another module's file, a package's file or a file of the host's, it is refused with
 * `PERMISSION_CAPABILITY_REFUSED`, reason `foreign-filename`, however the name is spelled: a `file:` URL, a path through `..`, a
 * symbolic link to the file. Host code, and every compile while the permission system is off or disabled, is not
 * checked.
 *
 * @module tests/vitests/suites/permissions/permissions-capability-filenames
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(HERE), "../../../../api_tests/api_test_code_strings");
const OWN = path.join(`${ROOT}_coder`, "api", "probe.mjs");
const SIBLING = path.join(`${ROOT}_other`, "api", "probe.mjs");
const PACKAGE = createRequire(import.meta.url).resolve("vitest/package.json");
const SCRATCH = path.resolve(path.dirname(HERE), "../../../../tmp/capability-filenames");
const LINK = path.join(SCRATCH, `link-${process.pid}.mjs`);

const ROUTES = ["compileFunction", "runInThisContext", "script", "moduleCompile"];
const OPEN = { caller: "**", target: "**", effect: "allow" };
const RULES = [OPEN, { caller: "coder.probe.compileUnder", target: "capability:code", effect: "allow" }];
const ALLOWED = { ok: true, value: 7 };
const FOREIGN = { ok: false, code: "PERMISSION_CAPABILITY_REFUSED", reason: "foreign-filename" };

/** The names compiled under, with the outcome each gives a leaf the capability is opened for. */
const NAMES = [
	["its own file", () => OWN, ALLOWED],
	["its own file as a file: URL", () => pathToFileURL(OWN).href, ALLOWED],
	["a name no file holds", () => "made-up-name.js", ALLOWED],
	["a missing file in its own folder", () => path.join(`${ROOT}_coder`, "api", "nothere.mjs"), ALLOWED],
	["another module's file", () => SIBLING, FOREIGN],
	["another module's file as a file: URL", () => pathToFileURL(SIBLING).href, FOREIGN],
	[
		"another module's file through ..",
		() => path.join(`${ROOT}_coder`, "api", "..", "..", "api_test_code_strings_other", "api", "probe.mjs"),
		FOREIGN
	],
	["a symbolic link to another module's file", () => LINK, FOREIGN],
	["a package's file", () => PACKAGE, FOREIGN],
	["a file of the host's", () => HERE, FOREIGN]
];

beforeAll(() => {
	fs.mkdirSync(SCRATCH, { recursive: true });
	fs.rmSync(LINK, { force: true });
	fs.symlinkSync(SIBLING, LINK);
});

afterAll(() => {
	fs.rmSync(LINK, { force: true });
});

/**
 * Compile under a name as the host.
 * @param {string} route - The route.
 * @param {string} filename - The name.
 * @returns {{ok: boolean, value?: number, code?: string}} The outcome.
 */
function hostCompile(route, filename) {
	try {
		if (route === "compileFunction") return { ok: true, value: vm.compileFunction("return 7", [], { filename })() };
		if (route === "runInThisContext") return { ok: true, value: vm.runInThisContext("7", { filename }) };
		if (route === "script") return { ok: true, value: new vm.Script("7", { filename }).runInThisContext() };
		const required = createRequire(import.meta.url)("node:module");
		const module = new required.Module(filename);
		module._compile("module.exports = 7;", filename);
		return { ok: true, value: module.exports };
	} catch (error) {
		return { ok: false, code: error?.code ?? String(error) };
	}
}

describe.each(getMatrixConfigs())("Permissions > capability:code and the file names compiled under > $name", ({ config }) => {
	describe.each(["precise", "fast"])("attribution %s", (attribution) => {
		let api;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		/**
		 * Build the base and mount the probing modules.
		 * @param {object} [permissions] - The permission settings.
		 * @returns {Promise<object>} The api.
		 */
		const build = async (permissions = { policy: "deny", rules: RULES, caller: { attribution } }) => {
			api = await slothlet({ ...config, silent: true, base: path.join(ROOT, "api"), permissions });
			await api.slothlet.api.add("coder", path.join(`${ROOT}_coder`, "api"), { id: "coder" });
			await api.slothlet.api.add("other", path.join(`${ROOT}_other`, "api"), { id: "other" });
			return api;
		};

		it.each(NAMES)("a leaf the capability is opened for, compiling under %s", async (_label, name, outcome) => {
			await build();
			for (const route of ROUTES) expect([route, await api.coder.probe.compileUnder(route, name())]).toEqual([route, outcome]);
		});

		it.each(NAMES)("the host compiling under %s is not checked", async (_label, name) => {
			await build();
			for (const route of ROUTES) expect([route, hostCompile(route, name())]).toEqual([route, ALLOWED]);
		});

		it.each([["off"], ["disabled"]])("with the permission system %s nothing is checked", async (mode) => {
			await build({ mode, policy: "deny", rules: [OPEN], caller: { attribution } });
			for (const route of ROUTES) expect([route, await api.coder.probe.compileUnder(route, SIBLING)]).toEqual([route, ALLOWED]);
		});
	});
});
