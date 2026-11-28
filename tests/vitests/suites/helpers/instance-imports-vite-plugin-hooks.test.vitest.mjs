/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/helpers/instance-imports-vite-plugin-hooks.test.vitest.mjs
 *	@Date: 2026-11-25T01:24:50-08:00 (1795598690)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:49-08:00 (1795869109)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The hooks of the `@cldmv/slothlet/vite` plugin (`slothletInstanceImports()`), called directly with a
 * stand-in vite context: where `configureVitest` puts the worker setup, what `resolveId` answers for the plugin's own
 * virtual modules, for a module's import of slothlet's files, of a runtime entry file and of a `data:` URL, what
 * `transform` appends to an instance module, and what `load` gives for each virtual module and for an instance's JSON
 * file.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";
import { afterAll, describe, expect, it } from "vitest";
import { slothletInstanceImports } from "#helpers/instance-imports";
import { plugin as publicPlugin } from "@cldmv/slothlet/vite";
import { makeTestTmpDirSync } from "../../setup/test-fixtures-tmp.mjs";

const LEAF = "/app/api/tally/tally.mjs?slothlet_instance=abc";
const RUNTIME = fileURLToPath(import.meta.resolve("@cldmv/slothlet/runtime"));
const INSTANCE_IMPORTS = fileURLToPath(import.meta.resolve("#helpers/instance-imports"));
const IMPORT_CHECK = "virtual:slothlet-import-check";
const LEAF_CHECK = "virtual:slothlet-leaf-check?";
const NO_RECORD = "\0virtual:slothlet-loaded-by-none";

const dir = makeTestTmpDirSync("vite-plugin-hooks");
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

/**
 * A stand-in vite context: `resolve` answers from a table, `parse` is acorn's.
 * @param {Record<string, object|null>} [table] - What each specifier resolves to.
 * @returns {object} The context.
 */
const contextOf = (table = {}) => ({
	resolve: async (source) => (Object.hasOwn(table, source) ? table[source] : null),
	parse: (code) => parse(code, { ecmaVersion: "latest", sourceType: "module" })
});

/**
 * The error a promise rejects with.
 * @param {Promise<*>} promise - The promise.
 * @returns {Promise<*>} The error, or undefined when it resolves.
 */
const rejection = async (promise) => {
	try {
		await promise;
	} catch (error) {
		return error;
	}
	return undefined;
};

describe("slothletInstanceImports() > hooks", () => {
	it("is what @cldmv/slothlet/vite exports as plugin", () => {
		expect(publicPlugin).toBe(slothletInstanceImports);
	});

	describe("configureVitest", () => {
		const plugin = slothletInstanceImports();

		it("puts the worker setup first in setupFiles, once", () => {
			const setupFiles = ["./tests/a.mjs"];
			plugin.configureVitest({ project: { config: { setupFiles } } });
			expect(setupFiles).toHaveLength(2);
			const setup = setupFiles[0];
			expect(path.basename(setup)).toBe("vitest-worker-setup.mjs");
			expect(path.isAbsolute(setup)).toBe(true);
			// Already first: left as it is.
			plugin.configureVitest({ project: { config: { setupFiles } } });
			expect(setupFiles).toEqual([setup, "./tests/a.mjs"]);
			// Listed later: moved to the front.
			const later = ["./tests/a.mjs", setup, "./tests/b.mjs"];
			plugin.configureVitest({ project: { config: { setupFiles: later } } });
			expect(later).toEqual([setup, "./tests/a.mjs", "./tests/b.mjs"]);
		});

		it("leaves a project with no setupFiles list alone", () => {
			const config = {};
			plugin.configureVitest({ project: { config } });
			expect(config).toEqual({});
			plugin.configureVitest({ project: { config: { setupFiles: "./tests/a.mjs" } } });
			plugin.configureVitest({});
		});
	});

	describe("resolveId", () => {
		it("resolves the import check and the leaf check to virtual modules", async () => {
			const plugin = slothletInstanceImports();
			const context = contextOf();
			expect(await plugin.resolveId.call(context, IMPORT_CHECK, LEAF, {})).toBe(`\0${IMPORT_CHECK}`);
			const leafCheck = `${LEAF_CHECK}importer=x&targets=%5B%5D`;
			expect(await plugin.resolveId.call(context, leafCheck, LEAF, {})).toBe(`\0${leafCheck}`);
		});

		it("refuses a module's import of slothlet's own files, by every spelling that reaches them", async () => {
			const plugin = slothletInstanceImports();
			const context = contextOf({
				"#helpers/instance-imports": { id: INSTANCE_IMPORTS },
				"@cldmv/slothlet/helpers": { id: INSTANCE_IMPORTS },
				"../../../src/lib/helpers/instance-imports.mjs": { id: INSTANCE_IMPORTS }
			});
			for (const source of ["#helpers/instance-imports", "@cldmv/slothlet/helpers", "../../../src/lib/helpers/instance-imports.mjs"]) {
				const error = await rejection(plugin.resolveId.call(context, source, LEAF, {}));
				expect(error?.code).toBe("MODULE_INTERNAL_NOT_IMPORTABLE");
			}
			// The same import from a file no module loaded is the host's, and vite resolves it.
			expect(await plugin.resolveId.call(context, "#helpers/instance-imports", "/app/host.mjs", {})).toBe(null);
		});

		it("lets a module import a file of slothlet's that resolves outside its code, or not at all", async () => {
			const plugin = slothletInstanceImports();
			const external = { id: INSTANCE_IMPORTS, external: true };
			expect(await plugin.resolveId.call(contextOf({ "#x": external }), "#x", LEAF, {})).toBe(null);
			expect(await plugin.resolveId.call(contextOf({}), "@cldmv/slothlet/missing", LEAF, {})).toBe(null);
		});

		it("gives an instance file's import of a runtime entry file the instance's own module for it", async () => {
			const plugin = slothletInstanceImports();
			const context = contextOf({ "@cldmv/slothlet/runtime": { id: RUNTIME } });
			expect(await plugin.resolveId.call(context, "@cldmv/slothlet/runtime", LEAF, {})).toBe(`\0slothlet-self:abc|${RUNTIME}`);
		});

		it("leaves an instance file's import of anything else under the runtime name to vite", async () => {
			const plugin = slothletInstanceImports();
			const other = contextOf({ "@cldmv/slothlet/runtime/other": { id: "/app/node_modules/other/index.mjs" } });
			expect(await plugin.resolveId.call(other, "@cldmv/slothlet/runtime/other", LEAF, {})).toBe(null);
			const external = contextOf({ "@cldmv/slothlet/runtime": { id: RUNTIME, external: true } });
			expect(await plugin.resolveId.call(external, "@cldmv/slothlet/runtime", LEAF, {})).toBe(null);
			// An importer whose query names no instance.
			const untagged = "/app/api/tally/tally.mjs?xslothlet_instance=abc";
			const runtime = contextOf({ "@cldmv/slothlet/runtime": { id: RUNTIME } });
			expect(await plugin.resolveId.call(runtime, "@cldmv/slothlet/runtime", untagged, {})).toBe(null);
			expect(await plugin.resolveId.call(runtime, "@cldmv/slothlet/runtime", "/app/slothlet_instance=abc/a.mjs", {})).toBe(null);
		});

		it("refuses an instance file's import statement of a data: or blob: URL", async () => {
			const plugin = slothletInstanceImports();
			for (const source of ["data:text/javascript,export default 1", "blob:nodedata:1234"]) {
				const error = await rejection(plugin.resolveId.call(contextOf(), source, LEAF, {}));
				expect(error?.code).toBe("PERMISSION_CAPABILITY_REFUSED");
			}
		});

		it("records a file a module loaded only for an absolute path outside slothlet's own files", async () => {
			const plugin = slothletInstanceImports();
			const context = contextOf({
				"./lib.mjs": { id: "/app/lib/lib.mjs" },
				"./relative.mjs": { id: "relative/x.mjs" },
				"./own.mjs": { id: RUNTIME },
				"./tagged.mjs": { id: "/app/lib/t.mjs?slothlet_instance=abc" }
			});
			// A file a module loads is resolved through vite, and its own imports are then a module's.
			await plugin.transform.handler.call(context, 'import "./lib.mjs";\nimport "./relative.mjs";\nimport "./own.mjs";\nexport {};', LEAF);
			expect(await plugin.resolveId.call(context, "./relative.mjs", "/app/lib/lib.mjs", {})).toEqual({ id: "relative/x.mjs" });
			expect(await plugin.resolveId.call(context, "./tagged.mjs", "/app/lib/lib.mjs", {})).toEqual({
				id: "/app/lib/t.mjs?slothlet_instance=abc"
			});
			// A second module loading the same file is recorded beside the first.
			await plugin.transform.handler.call(context, 'import "./lib.mjs";\nexport {};', "/app/api/other.mjs?slothlet_instance=abc");
			const record = `virtual:slothlet-loaded-by?${new URLSearchParams({ id: "/app/lib/lib.mjs", by: "/app/api/other.mjs?slothlet_instance=abc" })}`;
			expect(await plugin.resolveId.call(context, record, "/app/api/other.mjs?slothlet_instance=abc", {})).toBe(`\0${record}`);
			// The file the relative import resolved to was not recorded as a module's, so its imports are the host's.
			expect(await plugin.resolveId.call(context, "./lib.mjs", "relative/x.mjs", {})).toBe(null);
		});
	});

	describe("transform", () => {
		it("leaves an id that is not a string, an instance CommonJS file and an id naming no instance alone", async () => {
			const plugin = slothletInstanceImports();
			const context = contextOf();
			expect(await plugin.transform.handler.call(context, "export {};", undefined)).toBe(null);
			expect(await plugin.transform.handler.call(context, "module.exports = 1;", "/app/api/a.cjs?slothlet_instance=abc")).toBe(null);
			expect(await plugin.transform.handler.call(context, "export {};", "/app/api/a.mjs?xslothlet_instance=abc")).toBe(null);
			expect(await plugin.transform.handler.call(context, "export {};", "/app/slothlet_instance=abc/a.mjs")).toBe(null);
		});

		it("appends only the script registration to code its parser cannot read", async () => {
			const plugin = slothletInstanceImports();
			const out = await plugin.transform.handler.call(contextOf(), "export const = ;", LEAF);
			expect(out.code.startsWith("export const = ;\n;")).toBe(true);
			expect(out.code).toContain(".push(new Error());");
			// A file the plugin registers no script for is left as it is.
			const pkg = "/app/node_modules/pkg/api/a.mjs?slothlet_instance=abc";
			expect(await plugin.transform.handler.call(contextOf(), "export const = ;", pkg)).toBe(null);
		});

		it("holds the specifier of each import() and each import.meta.resolve() of an instance module to the import check", async () => {
			const plugin = slothletInstanceImports();
			const context = contextOf({ "./lib/s.mjs": { id: "/app/api/tally/lib/s.mjs?slothlet_instance=abc" } });
			const code = [
				"const re = /a+b/g;",
				'export const load = () => import("./lib/s.mjs");',
				"export const dynamic = (name) => import(name);",
				'export const where = import.meta.resolve("./x.mjs");',
				'export const other = import.meta.dirname ?? "./x.mjs";'
			].join("\n");
			const out = await plugin.transform.handler.call(context, code, LEAF);
			const name = /import \{ checkImport as (__slothlet_import_check_\w+) \} from "virtual:slothlet-import-check";/.exec(out.code)?.[1];
			expect(name).toBeDefined();
			expect(out.code).toContain(`import(${name}("./lib/s.mjs", import.meta.url, "/app/api/tally/lib/s.mjs"))`);
			expect(out.code).toContain(`import(${name}(name, import.meta.url))`);
			expect(out.code).toContain(`${name}(import.meta.resolve("./x.mjs"), import.meta.url)`);
			expect(out.code).toContain("const re = /a+b/g;");
			expect(out.code).toContain(`recordImports?.("abc", ${JSON.stringify(LEAF)}, ["/app/api/tally/lib/s.mjs?slothlet_instance=abc"]);`);
		});

		it("refuses an instance module's import or re-export statement of a data: URL", async () => {
			const plugin = slothletInstanceImports();
			for (const code of ['import x from "data:text/javascript,export default 1";', 'export * from "blob:nodedata:1234";']) {
				const error = await rejection(plugin.transform.handler.call(contextOf(), code, LEAF));
				expect(error?.code).toBe("PERMISSION_CAPABILITY_REFUSED");
			}
		});

		it("puts the leaf-file check of its static imports first, after a hashbang line", async () => {
			const plugin = slothletInstanceImports();
			const context = contextOf({ "./b.mjs": { id: "/app/api/tally/b.mjs?slothlet_instance=abc" } });
			const out = await plugin.transform.handler.call(
				context,
				'#!/usr/bin/env node\nimport { b } from "./b.mjs";\nexport const a = b;',
				LEAF
			);
			const lines = out.code.split("\n");
			expect(lines[0]).toBe("#!/usr/bin/env node");
			expect(lines[1].startsWith(`import "${LEAF_CHECK}`)).toBe(true);
			const query = new URLSearchParams(JSON.parse(lines[1].slice("import ".length, lines[1].indexOf(";"))).slice(LEAF_CHECK.length));
			expect(query.get("importer")).toBe(LEAF);
			expect(JSON.parse(query.get("targets"))).toEqual(["/app/api/tally/b.mjs"]);
		});

		it("records a package's file an instance module imports by a bare specifier as the module's", async () => {
			const plugin = slothletInstanceImports();
			const pkg = "/app/node_modules/pkg/index.mjs";
			const context = contextOf({ pkg: { id: pkg }, "./c.cjs": { id: "/app/api/tally/c.cjs" } });
			const out = await plugin.transform.handler.call(context, 'import "pkg";\nimport "./c.cjs";\nexport {};', LEAF);
			expect(out.code).toContain(`import ${JSON.stringify(`virtual:slothlet-loaded-by?${new URLSearchParams({ id: pkg, by: LEAF })}`)};`);
			expect(out.code).not.toContain("c.cjs&by");
		});

		it("notes the runtime entry file an instance module takes self from", async () => {
			const plugin = slothletInstanceImports();
			const context = contextOf({ "@cldmv/slothlet/runtime": { id: RUNTIME } });
			const selfId = await plugin.resolveId.call(context, "@cldmv/slothlet/runtime", LEAF, {});
			const code = `import { self } from ${JSON.stringify(selfId)};\nexport const read = () => self;`;
			const out = await plugin.transform.handler.call(contextOf(), code, LEAF);
			expect(out.code).toContain(
				`noteSelfImporter?.("abc", import.meta.url, ${JSON.stringify(import.meta.resolve("@cldmv/slothlet/runtime"))});`
			);
		});

		it("returns null for an instance module with nothing to append", async () => {
			const plugin = slothletInstanceImports();
			const pkg = "/app/node_modules/pkg/api/a.mjs?slothlet_instance=abc";
			expect(await plugin.transform.handler.call(contextOf(), "export const a = 1;", pkg)).toBe(null);
		});
	});

	describe("load", () => {
		const plugin = slothletInstanceImports();

		it("gives an empty module for a record the plugin did not write", () => {
			expect(plugin.load(NO_RECORD)).toEqual({ code: "export {};\n", map: null });
			// A record naming no file.
			expect(plugin.load(`\0virtual:slothlet-loaded-by?${new URLSearchParams({ by: LEAF })}`)).toEqual({ code: "export {};\n", map: null });
		});

		it("gives an instance's module for a runtime entry file, re-exporting it with the instance's self", () => {
			const out = plugin.load(`\0slothlet-self:abc|${RUNTIME}?v=1`);
			expect(out.code).toContain(`export * from ${JSON.stringify(`${RUNTIME}?v=1`)};`);
			expect(out.code).toContain("export let self = shared;");
			expect(out.code).toContain('("abc", (form) => { self = form; });');
		});

		it("gives the import check from the shared state", () => {
			expect(plugin.load(`\0${IMPORT_CHECK}`).code).toMatch(/^export const checkImport = globalThis\[Symbol\.for\(.*\)\]\.checkImport;\n$/);
		});

		it("gives the leaf check the importer and the string targets, and no target for a malformed list", () => {
			const good = plugin.load(`\0${LEAF_CHECK}${new URLSearchParams({ importer: LEAF, targets: JSON.stringify(["/a.mjs", 1, null]) })}`);
			expect(good.code).toContain(`.checkLeafImports?.(${JSON.stringify(LEAF)}, ["/a.mjs"]);`);
			const notList = plugin.load(`\0${LEAF_CHECK}${new URLSearchParams({ importer: LEAF, targets: '{"a":1}' })}`);
			expect(notList.code).toContain(`.checkLeafImports?.(${JSON.stringify(LEAF)}, []);`);
			const malformed = plugin.load(`\0${LEAF_CHECK}${new URLSearchParams({ targets: "[" })}`);
			expect(malformed.code).toContain('.checkLeafImports?.("", []);');
			const none = plugin.load(`\0${LEAF_CHECK}`);
			expect(none.code).toContain('.checkLeafImports?.("", []);');
		});

		it("loads an instance's JSON file as Node loads a JSON module", () => {
			const file = path.join(dir, "data.json");
			fs.writeFileSync(file, JSON.stringify({ a: [1, 2], b: "x" }, null, 2));
			const out = plugin.load(`${file}?slothlet_instance=abc`);
			expect(out).toEqual({ code: `export default ${JSON.stringify({ a: [1, 2], b: "x" })};\n`, map: null });
		});

		it("leaves an instance's ES module, an id naming no instance and an untagged id to vite", () => {
			expect(plugin.load(LEAF)).toBe(null);
			expect(plugin.load("/app/api/a.cjs?xslothlet_instance=abc")).toBe(null);
			expect(plugin.load("/app/api/a.mjs")).toBe(null);
			expect(plugin.load(undefined)).toBe(null);
			// The instance key in a folder's name, not in a query.
			expect(plugin.load("/app/slothlet_instance=abc/a.cjs")).toBe(null);
		});
	});
});
