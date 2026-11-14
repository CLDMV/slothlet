/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/isolation/internal-imports.test.vitest.mjs
 *	@Date: 2026-11-13T12:00:00-08:00 (1794600000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T12:00:00-08:00 (1794600000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Slothlet's own files are slothlet's: a module's files import slothlet by its main entry and its
 * runtime, and nothing else of it, however the import is spelled.
 *
 * @description
 * Fixture `api_test_internal_imports`. The api files `esm.mjs` and `cjs.cjs`, and the helpers they load (one imported,
 * so the instance's copy; one required through a `require` made from a plain path, so one module of the process), load
 * files of slothlet's by every route a file has (`import()`, `import.meta.resolve`, `require` from the file's URL and
 * from its plain path, `require.resolve`, a `require` made from one of slothlet's own paths) and by every spelling
 * (package subpaths, a `#imports` specifier, a file URL, an absolute and a relative path). `host/host.mjs` and
 * `host/host.cjs` make the same loads as files of the host.
 *
 * The expected values come from the host's twin: where the host's load resolves the file, a module's load of one of
 * slothlet's own files is refused with MODULE_INTERNAL_NOT_IMPORTABLE; where the host's load fails before that (a
 * subpath with no `require` export, a `require` of a URL), the module's fails the same way; the main entry and the
 * runtime load for a module as they load for the host. An api file importing one of slothlet's own files at its top
 * does not load. The host's own loads keep working.
 *
 * Run in this process (vitest's runner, with the `slothletInstanceImports()` vite plugin, loads the ES modules; Node
 * loads the CommonJS files), and in a child process under Node's own loader alone.
 *
 * @module tests/vitests/suites/isolation/internal-imports
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import { API_DIR, REFUSED_DIR, collect } from "../../../../api_tests/api_test_internal_imports/table.mjs";

const REFUSED = "MODULE_INTERNAL_NOT_IMPORTABLE";
const PROBE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_internal_imports/probe.mjs");

const MATRIX = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"])
		for (const permissions of ["off", "precise", "fast"])
			MATRIX.push({ name: `${mode}/${runtime} permissions ${permissions}`, mode, runtime, permissions });

/**
 * Whether the host's load got as far as the file: it loaded it, or the file itself could not be loaded that way.
 * @param {string} outcome - The host's outcome.
 * @returns {boolean} True when the host's load resolved the file.
 */
const resolvedForHost = (outcome) => outcome === "loaded" || outcome === "ERR_REQUIRE_ASYNC_MODULE";

/**
 * What a module's load is expected to give, from the host's.
 * @param {{internal: boolean, host: string}} row - The load.
 * @returns {string} The expected outcome.
 */
const expected = (row) => (row.internal && resolvedForHost(row.host) ? REFUSED : row.host);

/**
 * The code a failed load reports, through the error slothlet wraps it in.
 * @param {*} error - What was thrown.
 * @returns {string} The code.
 */
const codeOf = (error) =>
	error?.cause?.code ?? /^\[([A-Z_]+)\]/.exec(String(error?.cause?.message))?.[1] ?? error?.code ?? String(error?.message ?? error);

/**
 * The options for one configuration.
 * @param {{mode: string, runtime: string, permissions: string}} config - The configuration.
 * @param {string} base - The api folder.
 * @returns {object} The options.
 */
const options = ({ mode, runtime, permissions }, base) => ({
	base,
	mode,
	runtime,
	silent: true,
	...(permissions === "off" ? {} : { permissions: { defaultPolicy: "allow", attribution: permissions } })
});

describe.each(MATRIX)("Isolation > slothlet's own files stay slothlet's > $name", (config) => {
	let api;
	let rows;

	beforeAll(async () => {
		api = await slothlet(options(config, API_DIR));
		rows = await collect(api);
	}, 120000);

	afterAll(async () => {
		await api?.shutdown();
	});

	it("refuses a module's load of slothlet's own files and loads the main entry and the runtime", () => {
		expect(rows.map((row) => [row.target, row.route, row.module])).toEqual(rows.map((row) => [row.target, row.route, expected(row)]));
	});

	it("refuses an api file importing one of slothlet's own files at its top", async () => {
		let outcome;
		try {
			const held = await slothlet(options(config, REFUSED_DIR));
			try {
				outcome = `loaded:${await held.held.kind()}`;
			} catch (error) {
				outcome = codeOf(error);
			} finally {
				await held.shutdown();
			}
		} catch (error) {
			outcome = codeOf(error);
		}
		expect(outcome).toBe(REFUSED);
	});

	it("keeps the host's own imports of slothlet's files working", async () => {
		const { sanitizePropertyName } = await import("@cldmv/slothlet/helpers/sanitize");
		expect(sanitizePropertyName("a-b")).toBe("aB");
		const { instanceImporters } = await import("@cldmv/slothlet/helpers/instance-imports");
		expect(typeof instanceImporters).toBe("function");
	});
});

describe("Isolation > slothlet's own files stay slothlet's > under Node's own loader", () => {
	it("refuses a module's load of them in every mode and runtime, as in this process", () => {
		const conditions = process.execArgv.filter((arg) => arg.startsWith("--conditions="));
		const result = spawnSync(process.execPath, [...conditions, PROBE], { encoding: "utf8", timeout: 240000 });
		expect(result.stderr).toBe("");
		const out = JSON.parse(result.stdout);
		expect(Object.keys(out).sort()).toEqual(["eager/async", "eager/live", "lazy/async", "lazy/live"]);
		for (const [name, { rows, refused }] of Object.entries(out)) {
			expect([name, refused]).toEqual([name, REFUSED]);
			expect(rows.map((row) => [name, row.target, row.route, row.module])).toEqual(
				rows.map((row) => [name, row.target, row.route, expected(row)])
			);
		}
	});
});
