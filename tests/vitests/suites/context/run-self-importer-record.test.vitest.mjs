/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-self-importer-record.test.vitest.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T00:00:00-08:00 (1795334400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The view `run.self()` / `scope({ self: true })` hands a module's code is the `self` binding its own
 * file imported, as slothlet recorded it when the file was loaded, whatever another module's code does with the object
 * slothlet's copies share on the global object.
 * @description
 * `victim/victim.mjs` imports `self` from `@cldmv/slothlet/runtime/live` while `other/other.mjs` imports it from the
 * main entry, so the instance binds `self` through both and only the record of `victim`'s own import says which one
 * its view is. `other`'s code calls the shared object's members for `victim`'s file (adding a record, reading the
 * record, dropping the instance's records), from a function and from its file's top level. Plain-JS expectation: none
 * of that changes which binding `victim`'s file holds, so `victim`'s view stays `=== self`, and the record hands
 * module code nothing.
 *
 * Fixture (written at run time): `api/math.mjs`; `victim/` and `other/` added under `victim` and `other`; `early/`
 * (added under `early`, importing `self` from `/runtime/async`) makes the same calls at its file's top level, and floods
 * the record of its own file with entries that are no runtime entry of this slothlet.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-self-importer-record");
const BASE = path.join(ROOT, "api");
const VICTIM_FILE = path.join(ROOT, "victim", "victim.mjs");
/** The main runtime entry file, which `victim` does not import: a record of it would make its view the main entry's. */
const OTHER_ENTRY = pathToFileURL(path.resolve("src/lib/runtime/runtime.mjs")).href;

const SHARED = 'globalThis[Symbol.for("@cldmv/slothlet.instanceImports")]';

/**
 * Write `early/early.mjs`, whose top-level code makes the calls for the instance `id`.
 * @param {string} id - The instance ID.
 * @returns {void}
 */
function writeEarly(id) {
	writeFileSync(
		path.join(ROOT, "early", "early.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime/async";',
			`const shared = ${SHARED};`,
			`const id = ${JSON.stringify(id)};`,
			// Records for its own file: text that is no runtime entry, and many entries of copies that are not there.
			'shared.noteSelfImporter(id, import.meta.url, "file:///nowhere/elsewhere.mjs");',
			"shared.noteSelfImporter(id, import.meta.url, 42);",
			"for (let i = 0; i < 20; i++) shared.noteSelfImporter(id, import.meta.url, `file:///copy${i}/lib/runtime/runtime.mjs`);",
			`shared.noteSelfImporter(id, ${JSON.stringify(VICTIM_FILE)}, ${JSON.stringify(OTHER_ENTRY)});`,
			`shared.noteSelfImporter(id, ${JSON.stringify(`${pathToFileURL(VICTIM_FILE).href}?slothlet_instance=${encodeURIComponent(id)}`)}, ${JSON.stringify(OTHER_ENTRY)});`,
			`const seen = shared.selfImporterUrls(id, ${JSON.stringify(VICTIM_FILE)});`,
			"export function loaded() {",
			"\treturn seen;",
			"}",
			"export function check() {",
			"\treturn self.slothlet.context.run.self({}, (view) => (view === self ? 'own self' : 'other view'));",
			"}",
			""
		].join("\n")
	);
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const dir of ["api", "victim", "other", "early"]) mkdirSync(path.join(ROOT, dir), { recursive: true });
	writeFileSync(path.join(BASE, "math.mjs"), "export function add(a, b) {\n\treturn a + b;\n}\n");
	writeFileSync(
		VICTIM_FILE,
		[
			'import { self } from "@cldmv/slothlet/runtime/live";',
			"export function check() {",
			"\treturn self.slothlet.context.run.self({}, (view) => (view === self ? 'own self' : 'other view'));",
			"}",
			"export function checkScope() {",
			"\treturn self.slothlet.context.scope({ context: {}, self: true, fn: (view) => (view === self ? 'own self' : 'other view') });",
			"}",
			""
		].join("\n")
	);
	writeFileSync(
		path.join(ROOT, "other", "other.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			`const shared = ${SHARED};`,
			"export function note(id, file, url) {",
			"\tshared.noteSelfImporter(id, file, url);",
			"\treturn typeof self;",
			"}",
			"export function read(id, file) {",
			"\treturn shared.selfImporterUrls(id, file);",
			"}",
			"export function forget(id) {",
			"\tshared.forgetSelfImporters(id);",
			"\treturn true;",
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe.each([
	["async", "eager"],
	["async", "lazy"],
	["live", "eager"],
	["live", "lazy"]
])("run.self view of a module's own file — %s runtime, %s mode", (runtime, mode) => {
	let api;
	let id;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	describe.each([
		["permissions off", undefined],
		["permissions on", { mode: "on" }]
	])("%s", (_label, permissions) => {
		/**
		 * Make the instance with the three modules added, `early` written for its ID.
		 * @returns {Promise<object>} The api.
		 */
		async function make() {
			api = await slothlet({ base: BASE, runtime, mode, silent: true, ...(permissions ? { permissions } : {}) });
			id = api.slothlet.instance.id;
			expect(typeof id).toBe("string");
			writeEarly(id);
			for (const name of ["other", "victim", "early"]) await api.slothlet.api.add(name, path.join(ROOT, name));
			return api;
		}

		it("a record another module adds for the file changes nothing", async () => {
			await make();
			await api.other.note(id, VICTIM_FILE, OTHER_ENTRY);
			expect(await api.victim.check()).toBe("own self");
			expect(await api.victim.checkScope()).toBe("own self");
		});

		it("a record another module adds after the file loaded changes nothing", async () => {
			await make();
			expect(await api.victim.check()).toBe("own self");
			await api.other.note(id, VICTIM_FILE, OTHER_ENTRY);
			await api.other.note(id, pathToFileURL(VICTIM_FILE).href, OTHER_ENTRY);
			expect(await api.victim.check()).toBe("own self");
		});

		it("another module dropping the instance's records changes nothing", async () => {
			await make();
			expect(await api.victim.check()).toBe("own self");
			await api.other.forget(id);
			expect(await api.victim.check()).toBe("own self");
			expect(await api.victim.checkScope()).toBe("own self");
		});

		it("module code reads nothing of the record", async () => {
			await make();
			expect(await api.victim.check()).toBe("own self");
			expect(await api.other.read(id, VICTIM_FILE)).toEqual([]);
		});

		it("records a file's top-level code adds for another file change nothing", async () => {
			await make();
			expect(await api.early.loaded()).toEqual([]);
			expect(await api.victim.check()).toBe("own self");
			// What it recorded for its own file leaves its own view its own as well.
			expect(await api.early.check()).toBe("own self");
			expect(await api.victim.checkScope()).toBe("own self");
		});

		it("a flood of records under made-up instance IDs or entry URLs is taken from no module", async () => {
			await make();
			for (let i = 0; i < 200; i++) await api.other.note(id, `${VICTIM_FILE}.${i}`, `file:///x/${i}/runtime/runtime.mjs`);
			expect(await api.other.read(id, `${VICTIM_FILE}.1`)).toEqual([]);
			expect(await api.victim.check()).toBe("own self");
		});
	});
});
