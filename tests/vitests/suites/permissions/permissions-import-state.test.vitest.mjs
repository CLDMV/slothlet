/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-import-state.test.vitest.mjs
 *	@Date: 2026-11-12T23:27:21-08:00 (1794554841)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:27:21-08:00 (1794554841)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What slothlet keeps about the files an instance loads is the instance's alone: no module changes it,
 * and no permission answer changes with what a module tries.
 *
 * @description
 * Whose code a helper file's code is, and which CommonJS files are an instance's code, are read from what slothlet
 * recorded as the instance's files loaded. Fixture `api_test_import_state`:
 * ```
 * api/vault.mjs       get() → "SECRET"
 * api/trusted.mjs     may read the vault; imports no helper
 * api/guest.mjs       imports helpers/reader.mjs and helpers/reader.cjs; reach() and relabel() try to change the record
 * helpers/reader.mjs  read() reads the vault and keeps the answer
 * helpers/reader.cjs  the same, as a CommonJS file
 * ```
 * The rule the expected values come from: a helper's own function is held to the module of the api file importing it,
 * here `guest`. With `guest` denied the vault it is refused wherever it runs (run by the host from data the module
 * returned, and from a timer once the call is over), and that answer does not depend on anything `guest` does.
 *
 * `guest.reach()` tries every member of the object slothlet shares between its copies on the global object (the
 * collections of an instance's CommonJS files and module copies, the scope of a running require, the entry points of
 * generated code, the record of imports, a claim of the instance's own ID) and every function of slothlet's own
 * module that keeps the record (reading the record and writing to what it hands out, loading a file as the
 * instance's, claiming and releasing the instance's ID). It reports each attempt that got hold of something it could
 * change: none does. `guest.relabel()` rewrites the importers of the ES module helper, as read through slothlet's own
 * module, to name `trusted.mjs`. That module is one of slothlet's own files, which slothlet refuses to a module's import
 * (`guest.importable()` is false), so the attempts through its functions are made only where the import loads; the
 * answers must stay the same either way.
 *
 * Each config runs in a Node process of its own, under Node's own loader, whose hooks keep the record.
 *
 * @module tests/vitests/suites/permissions/permissions-import-state
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const BASE = path.resolve(ROOT, "api_tests/api_test_import_state/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/** What each helper's read gives, run by the host and from a timer. */
const answers = (value) => ({ esm: { host: value, timer: value }, cjs: { host: value, timer: value } });

/**
 * Build the fixture in a process of its own, once per case, and report what the helpers' reads gave in each.
 * @param {{mode: string, runtime: string, attribution: string}} config - The config.
 * @returns {object} The answers by case.
 */
function runCases(config) {
	const script = `
		import slothlet from "@cldmv/slothlet";
		const config = ${JSON.stringify(config)};
		const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
		const build = (deny) => slothlet({
			base: ${JSON.stringify(BASE)}, mode: config.mode, runtime: config.runtime, silent: true,
			permissions: { defaultPolicy: "allow", attribution: config.attribution, rules: deny ? [{ caller: "guest.**", target: "vault.**", effect: "deny" }] : [] }
		});
		const runHelpers = async (api) => {
			const out = {};
			for (const kind of ["esm", "cjs"]) {
				const boxed = await api.guest.box(kind);
				await boxed.run();
				const host = await api.guest.peek(kind);
				await api.guest.arm(kind);
				await wait(60);
				out[kind] = { host, timer: await api.guest.peek(kind) };
			}
			return out;
		};
		const out = {};
		let api = await build(false);
		out.allowed = await runHelpers(api);
		await api.slothlet.shutdown();
		api = await build(true);
		out.denied = await runHelpers(api);
		await api.slothlet.shutdown();
		api = await build(true);
		out.importable = await api.guest.importable();
		out.reached = await api.guest.reach();
		out.afterReach = await runHelpers(api);
		// The instance still loads and shuts down as before.
		out.afterwards = await api.trusted.ping();
		await api.slothlet.shutdown();
		api = await build(true);
		await api.guest.relabel();
		out.relabelled = await runHelpers(api);
		await api.slothlet.shutdown();
		process.stdout.write("RESULT " + JSON.stringify(out) + "\\n");
	`;
	const child = spawnSync(process.execPath, ["--conditions=slothlet-dev", "--input-type=module", "-e", script], {
		cwd: ROOT,
		encoding: "utf8",
		timeout: 120000
	});
	const line = String(child.stdout)
		.split("\n")
		.find((text) => text.startsWith("RESULT "));
	if (!line) throw new Error(`no result: ${child.stderr}`);
	return JSON.parse(line.slice("RESULT ".length));
}

describe.each(matrix)("what slothlet keeps about an instance's files ($mode, $runtime, $attribution)", (config) => {
	/** @type {ReturnType<typeof runCases>|null} */
	let cases = null;
	const results = () => (cases ??= runCases(config));

	it("runs a helper as its importing module: allowed where the module is", () => {
		expect(results().allowed).toEqual(answers(SECRET));
	}, 120000);

	it("refuses a helper what its importing module is denied", () => {
		expect(results().denied).toEqual(answers(DENIED));
	}, 120000);

	it("refuses the module's import of slothlet's own module that keeps the record", () => {
		expect(results().importable).toBe(false);
	}, 120000);

	it("hands a module nothing it can change", () => {
		expect(results().reached).toEqual([]);
	}, 120000);

	it("answers the same after the module has tried every member and every function", () => {
		expect(results().afterReach).toEqual(answers(DENIED));
		expect(results().afterwards).toBe("pong");
	}, 120000);

	it("answers the same after the module has rewritten the importers it read", () => {
		expect(results().relabelled).toEqual(answers(DENIED));
	}, 120000);
});
