/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-vite-loaded-registry.test.vitest.mjs
 *	@Date: 2026-11-06T20:01:39-08:00 (1794024099)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T20:18:26-08:00 (1794025106)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The record slothlet keeps of which modules loaded each file vite transformed (#714), and what it takes
 * from it.
 * @description
 * The `slothletInstanceImports()` plugin has each file it registers import a virtual module the plugin writes: one
 * statement creating an `Error`, frozen, its message the JSON of the importers' ids the plugin resolved. slothlet takes a
 * record only when that error is a native, frozen error with its stack unread, created by the virtual module's own code
 * (a location with a leading `\0`, which no file on disk has) that vitest's or vite's runner was evaluating. A record is
 * read as it is pushed. The genuine case is covered by `permissions-vite-late-files`; these are the refusals, and the
 * plugin's side.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";
import { installViteLoadedRegistry } from "#handlers/frame-placement";
import { LOADED_BY_SPECIFIER, VITE_LOADED_BY, slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";

const KEY = Symbol.for(VITE_LOADED_BY);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const FILE = path.join(ROOT, "api_tests", "api_test_vite_late_files", "late-pkg", "context.mjs").replaceAll("\\", "/");
const VIRTUAL = `\0${LOADED_BY_SPECIFIER}${new URLSearchParams({ id: FILE })}`;
const VITEST_EVALUATOR = path.join(ROOT, "node_modules", "vitest", "dist", "module-evaluator.js");

/**
 * A frozen error with `message`, created by code compiled under `ownFile`, called from code compiled under `runnerFile`.
 * @param {string} ownFile - Where the creating code says it is.
 * @param {string} runnerFile - Where the calling code says it is.
 * @param {string} [message] - The message.
 * @returns {Error} The error, its stack unread.
 */
const createdUnder = (ownFile, runnerFile, message = "[]") => {
	const own = vm.runInThisContext(`() => Object.freeze(new Error(${JSON.stringify(message)}))`, { filename: ownFile });
	const runner = vm.runInThisContext("(fn) => fn()", { filename: runnerFile });
	return runner(own);
};

describe("Permissions > the record of who loaded each vite-transformed file (#714)", () => {
	it("is fixed in place, frozen, and used as it is by another copy", () => {
		const target = {};
		const registry = installViteLoadedRegistry(target);
		const descriptor = Object.getOwnPropertyDescriptor(target, KEY);
		expect(descriptor.value).toBe(registry);
		expect([descriptor.writable, descriptor.configurable]).toEqual([false, false]);
		expect(Object.isFrozen(registry)).toBe(true);
		expect(installViteLoadedRegistry(target)).toBe(registry);
		expect(registry.importersOf(FILE)).toBeNull();
	});

	it("offers no registry when one without a reader is fixed in place", () => {
		const target = {};
		Object.defineProperty(target, KEY, { value: [], configurable: false });
		expect(installViteLoadedRegistry(target)).toBeNull();
	});

	it("does not read a Proxy put in the registry's place", () => {
		let read = false;
		const trap = new Proxy([createdUnder(VIRTUAL, VITEST_EVALUATOR)], {
			get(array, key, receiver) {
				read = true;
				return Reflect.get(array, key, receiver);
			}
		});
		const registry = installViteLoadedRegistry({ [KEY]: trap });
		expect(read).toBe(false);
		expect(registry.importersOf(FILE)).toBeNull();
	});

	it("takes no record that is not the virtual module's own, frozen, created under vitest's runner", () => {
		const unfrozen = vm.runInThisContext("(fn) => fn()", { filename: VITEST_EVALUATOR })(
			vm.runInThisContext("() => new Error('[]')", { filename: VIRTUAL })
		);
		const read = createdUnder(VIRTUAL, VITEST_EVALUATOR);
		void read.stack;
		const target = {};
		const registry = installViteLoadedRegistry(target);
		target[KEY].push(
			{ message: "[]", stack: `at (${VIRTUAL}:1:1)` },
			Object.freeze(new Error("[]")),
			unfrozen,
			read,
			// Created by code naming the file itself, not the virtual module.
			createdUnder(FILE, VITEST_EVALUATOR),
			// Created by code compiled under the virtual module's name, called from code that is not a runner's.
			createdUnder(VIRTUAL, path.join(ROOT, "tests", "runner.mjs")),
			// A message that is not a list of importers.
			createdUnder(VIRTUAL, VITEST_EVALUATOR, "not json"),
			createdUnder(VIRTUAL, VITEST_EVALUATOR, "{}")
		);
		expect(registry.importersOf(FILE)).toBeNull();
	});
});

describe("slothletInstanceImports() > the record of who loaded a file (#714)", () => {
	const marker = "?slothlet_instance=i1&module=m1";
	const LEAF = path.join(ROOT, "api_tests", "api_test_vite_late_files", "api", "caller", "caller.mjs").replaceAll("\\", "/");

	/**
	 * A plugin with a stand-in vite context whose `resolve` gives each specifier the id `ids` maps it to.
	 * @param {Record<string, string>} ids - The ids by specifier.
	 * @returns {{plugin: object, context: object}} The plugin and the context its hooks run with.
	 */
	const pluginWith = (ids) => {
		const plugin = slothletInstanceImports();
		const context = {
			resolve: async (source) => (ids[source] ? { id: ids[source] } : null),
			parse: (code) => parse(code, { ecmaVersion: "latest", sourceType: "module" })
		};
		return { plugin, context };
	};

	it("has each file it registers import the virtual module that records who loaded it", async () => {
		const { plugin } = pluginWith({});
		const out = await plugin.transform.handler.call({}, "export const x = 1;", FILE);
		expect(out.code.startsWith("export const x = 1;\n")).toBe(true);
		expect(out.code).toContain(`import ${JSON.stringify(`${LOADED_BY_SPECIFIER}${new URLSearchParams({ id: FILE })}`)};`);
	});

	it("resolves the virtual module to an id no file has", async () => {
		const { plugin, context } = pluginWith({});
		const specifier = `${LOADED_BY_SPECIFIER}${new URLSearchParams({ id: FILE })}`;
		expect(await plugin.resolveId.call(context, specifier, FILE)).toBe(`\0${specifier}`);
	});

	it("records a file a module loaded by a bare specifier, and what that file imports, as the module's", async () => {
		const HELPER = FILE.replace("context.mjs", "imports.mjs");
		const { plugin, context } = pluginWith({ "late-pkg": FILE, "./context.mjs": HELPER });
		await plugin.transform.handler.call(context, 'import "late-pkg";\nexport const x = 1;', LEAF + marker);
		await plugin.resolveId.call(context, "./context.mjs", FILE);
		const record = (id) => plugin.load(`\0${LOADED_BY_SPECIFIER}${new URLSearchParams({ id })}`).code;
		expect(record(FILE)).toContain(JSON.stringify(JSON.stringify([LEAF + marker])));
		expect(record(HELPER)).toContain(JSON.stringify(JSON.stringify([FILE, LEAF + marker])));
	});

	it("records nothing for a file only the host loaded", async () => {
		const { plugin, context } = pluginWith({ "late-pkg": FILE });
		await plugin.resolveId.call(context, "late-pkg", path.join(ROOT, "host.mjs"));
		expect(plugin.load(`\0${LOADED_BY_SPECIFIER}${new URLSearchParams({ id: FILE })}`).code).toContain('new Error("[]")');
	});
});
