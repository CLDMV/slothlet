/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/capability-context-host-routes.test.vitest.mjs
 *	@Date: 2026-11-25T01:23:14-08:00 (1795598594)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:42:16-08:00 (1795599736)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The capability wrappers slothlet installs while an instance has the permission system on, as the host
 * meets them (see `src/lib/helpers/capability-context.mjs`): the host keeps every route, each with its plain-JavaScript
 * outcome; a reference to a wrapped constructor taken while the wrappers were installed keeps answering as the
 * constructor once they are gone; and a member the host replaced in the meantime is left as the host set it.
 *
 * Also covers `namesForeignFile`, which decides whether the name code is compiled under names a file outside a leaf's
 * folder, and the refusal of the file's internal bindings to anyone but slothlet.
 */

import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import slothlet from "@cldmv/slothlet";
import { BINDING_NAME, internals, namesForeignFile } from "#helpers/capability-context";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";
import { makeTestTmpDirSync } from "../../setup/test-fixtures-tmp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_code_strings");
const OPEN = { caller: "**", target: "**", effect: "allow" };

describe.each(getMatrixConfigs())("Permissions > capability wrappers, from the host > $name", ({ config }) => {
	let api = null;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	const build = async () => {
		api = await slothlet({ ...config, silent: true, base: path.join(ROOT, "api"), permissions: { policy: "deny", rules: [OPEN] } });
		return api;
	};

	it("gives the host every route with its plain-JavaScript outcome", async () => {
		const plainScript = vm.runInThisContext("6 * 7", "plain-named.js");
		const plainConstants = Object.keys(process.binding("constants")).sort();
		const plainModule = new Module("/virtual/plain.js");
		plainModule._compile("module.exports = 6 * 7;", "/virtual/plain.js");
		await build();
		// A file name given as the options argument itself.
		expect(vm.runInThisContext("6 * 7", "host-named.js")).toBe(plainScript);
		// `Module#_compile` called by the host, not by Node's own loader.
		const compiled = new Module("/virtual/host.js");
		compiled._compile("module.exports = 6 * 7;", "/virtual/host.js");
		expect(compiled.exports).toBe(plainModule.exports);
		// A binding of Node's other than the one that compiles strings.
		expect(Object.keys(process.binding("constants")).sort()).toEqual(plainConstants);
		// The other function constructors still inherit from `Function`.
		expect(Object.getPrototypeOf(async function () {}.constructor)).toBe(Function);
	});

	it("keeps a constructor taken while the wrappers were installed working as the constructor once they are gone", async () => {
		await build();
		const held = async function () {}.constructor;
		const heldFunction = Function;
		await api.shutdown();
		api = null;
		expect(Object.getPrototypeOf(held)).toBe(Function);
		expect(await held("return 3")()).toBe(3);
		expect(await new held("return 4")()).toBe(4);
		expect(heldFunction("return 5")()).toBe(5);
		expect(new heldFunction("return 6")()).toBe(6);
	});

	it("leaves a member the host replaced while the wrappers were installed as the host set it", async () => {
		const original = vm.compileFunction;
		await build();
		const replacement = function compileFunction(...args) {
			return Reflect.apply(original, vm, args);
		};
		vm.compileFunction = replacement;
		try {
			await api.shutdown();
			api = null;
			expect(vm.compileFunction).toBe(replacement);
		} finally {
			vm.compileFunction = original;
		}
	});
});

describe("Permissions > namesForeignFile", () => {
	const dir = makeTestTmpDirSync("names-foreign");
	const leafDir = path.join(dir, "api");
	fs.mkdirSync(path.join(leafDir, "nested"), { recursive: true });
	const leaf = path.join(leafDir, "leaf.mjs");
	const sibling = path.join(leafDir, "nested", "sibling.mjs");
	const outside = path.join(dir, "outside.mjs");
	for (const file of [leaf, sibling, outside]) fs.writeFileSync(file, "export {};\n");

	afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

	it("finds no file in a name that is empty, not a string, of another scheme, or held by no file", () => {
		expect(namesForeignFile("", leaf)).toBe(false);
		expect(namesForeignFile(undefined, leaf)).toBe(false);
		expect(namesForeignFile("http://example.com/outside.mjs", leaf)).toBe(false);
		expect(namesForeignFile("node:internal/child_process", leaf)).toBe(false);
		expect(namesForeignFile(path.join(dir, "missing.mjs"), leaf)).toBe(false);
	});

	it("tells a file in the leaf's folder from one outside it, by path or by file: URL", () => {
		expect(namesForeignFile(sibling, leaf)).toBe(false);
		expect(namesForeignFile(leafDir, leaf)).toBe(false);
		expect(namesForeignFile(`${pathToFileURL(sibling).href}?v=1#x`, leaf)).toBe(false);
		expect(namesForeignFile(outside, leaf)).toBe(true);
		expect(namesForeignFile(pathToFileURL(outside).href, leaf)).toBe(true);
	});

	it("counts any real file as foreign when the leaf's own file is unknown", () => {
		expect(namesForeignFile(sibling, undefined)).toBe(true);
		expect(namesForeignFile(sibling, path.join(dir, "missing.mjs"))).toBe(true);
	});

	it("counts Node's contextify binding as foreign", () => {
		expect(namesForeignFile(BINDING_NAME, leaf)).toBe(true);
	});
});

describe("Permissions > capability-context internals", () => {
	it("refuses its bindings to a file not listed, and to slothlet's own file asking again", () => {
		expect(() => internals("lib/helpers/not-listed")).toThrow(expect.objectContaining({ code: "MODULE_INTERNAL_NOT_IMPORTABLE" }));
		expect(() => internals(undefined)).toThrow(expect.objectContaining({ code: "MODULE_INTERNAL_NOT_IMPORTABLE" }));
		expect(() => internals("slothlet")).toThrow(expect.objectContaining({ code: "MODULE_INTERNAL_NOT_IMPORTABLE" }));
	});
});
