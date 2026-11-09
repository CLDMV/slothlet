/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-vite-loaded-by-forged.test.vitest.mjs
 *	@Date: 2026-11-08T16:45:27-08:00 (1794185127)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:59:11-08:00 (1794185951)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A record of who loaded a file is only ever the one the `slothletInstanceImports()` plugin wrote (#715).
 * @description
 * Any module can import the virtual module that records who loaded a file, and write its parameters itself. The plugin
 * takes a record naming a module as a file's loader (`by`) only when it resolved that module's import of that file, and a
 * file's own record (no `by`) only from the file itself. Any other import of the virtual module records nothing: no
 * module is named as the loader of a file it never imported, and no record is made of a file that no import of its own
 * asked for, so `importersOf()` stays null for it.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";
import { LOADED_BY_SPECIFIER, slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const FIXTURE = path.join(ROOT, "api_tests", "api_test_vite_late_files").replaceAll("\\", "/");
const SHARED = `${FIXTURE}/late-pkg/context.mjs`;
const HOST_ONLY = `${FIXTURE}/calls.mjs`;
const LEAF = `${FIXTURE}/api/caller/caller.mjs?slothlet_instance=i1&module=m1`;
const OTHER = `${FIXTURE}/api/callee/callee.mjs?slothlet_instance=i1&module=m2`;

/**
 * The specifier of the virtual module that records who loaded a file.
 * @param {Record<string, string>} params - Its parameters.
 * @returns {string} The specifier.
 */
const recordOf = (params) => `${LOADED_BY_SPECIFIER}${new URLSearchParams(params)}`;

/**
 * A plugin with a stand-in vite context: `late-pkg` resolves to the shared file.
 * @returns {{plugin: object, context: object}} The plugin and the context its hooks run with.
 */
const pluginWith = () => {
	const plugin = slothletInstanceImports();
	const context = {
		resolve: async (source) => (source === "late-pkg" ? { id: SHARED } : null),
		parse: (code) => parse(code, { ecmaVersion: "latest", sourceType: "module" })
	};
	return { plugin, context };
};

/**
 * What an import of a record's specifier from `importer` evaluates: the code of the module it resolves to.
 * @param {object} plugin - The plugin.
 * @param {object} context - Its context.
 * @param {string} specifier - The specifier.
 * @param {string} importer - The importing module's id.
 * @returns {Promise<string>} The code.
 */
const evaluated = async (plugin, context, specifier, importer) => {
	const id = await plugin.resolveId.call(context, specifier, importer);
	expect(typeof id).toBe("string");
	return plugin.load(id)?.code ?? "";
};

describe("slothletInstanceImports() > a forged record of who loaded a file (#715)", () => {
	it("still writes the record of a file a module imported, naming that module", async () => {
		const { plugin, context } = pluginWith();
		const out = await plugin.transform.handler.call(context, 'import "late-pkg";\nexport const x = 1;', LEAF);
		const specifier = recordOf({ id: SHARED, by: LEAF });
		expect(out.code).toContain(`import ${JSON.stringify(specifier)};`);
		expect(await plugin.resolveId.call(context, specifier, LEAF)).toBe(`\0${specifier}`);
		expect(await evaluated(plugin, context, specifier, LEAF)).toContain(JSON.stringify(JSON.stringify([LEAF])));
	});

	it("records nothing for a module named as the loader of a file it never imported", async () => {
		const { plugin, context } = pluginWith();
		await plugin.transform.handler.call(context, 'import "late-pkg";\nexport const x = 1;', LEAF);
		const specifier = recordOf({ id: HOST_ONLY, by: LEAF });
		for (const importer of [OTHER, LEAF, HOST_ONLY]) {
			expect(await plugin.resolveId.call(context, specifier, importer)).not.toBe(`\0${specifier}`);
			expect(await evaluated(plugin, context, specifier, importer)).not.toContain("new Error");
		}
		expect(plugin.load(`\0${specifier}`)?.code ?? "").not.toContain("new Error");
	});

	it("records nothing for a module named as a loader the plugin never saw", async () => {
		const { plugin, context } = pluginWith();
		await plugin.transform.handler.call(context, 'import "late-pkg";\nexport const x = 1;', LEAF);
		const specifier = recordOf({ id: SHARED, by: OTHER });
		expect(await evaluated(plugin, context, specifier, OTHER)).not.toContain("new Error");
		expect(plugin.load(`\0${specifier}`)?.code ?? "").not.toContain("new Error");
	});

	it("makes no record of a file from an import that is not the file's own", async () => {
		const { plugin, context } = pluginWith();
		const specifier = recordOf({ id: HOST_ONLY });
		for (const importer of [OTHER, SHARED]) {
			expect(await plugin.resolveId.call(context, specifier, importer)).not.toBe(`\0${specifier}`);
			expect(await evaluated(plugin, context, specifier, importer)).not.toContain("new Error");
		}
	});

	it("still makes the file's own record from the file's own import", async () => {
		const { plugin, context } = pluginWith();
		const out = await plugin.transform.handler.call(context, "export const x = 1;", HOST_ONLY);
		const specifier = recordOf({ id: HOST_ONLY });
		expect(out.code).toContain(`import ${JSON.stringify(specifier)};`);
		expect(await evaluated(plugin, context, specifier, HOST_ONLY)).toContain('new Error("[]")');
	});
});
