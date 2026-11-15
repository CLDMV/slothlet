/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-readd-after-remove.test.vitest.mjs
 *	@Date: 2026-11-15T11:06:27-08:00 (1794769587)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:49:03-08:00 (1794775743)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An `add()` of a module that was added before and then removed loads the code on disk now (#793).
 *
 * @description
 * `add`, `remove`, edit the file, `add` again under the same moduleID: the second add imports the file fresh, the
 * way `api.slothlet.api.reload()` does, so it runs the edited code and the file's top level runs again. The
 * expected values are what a separate Node process gets by importing the edited file.
 *
 * A first add is a plain import (no reload stamp), and an add under a moduleID that still has a live mount is not
 * imported again: in plain JavaScript a module that is already loaded is the same instance for every importer.
 *
 * @module tests/vitests/suites/api-manager/api-manager-readd-after-remove
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";
import slothlet from "@cldmv/slothlet";
import { TEST_MATRIX } from "../../setup/vitest-helper.mjs";
import { makeTestTmpDirSync } from "../../setup/test-fixtures-tmp.mjs";

// A cold build on a loaded runner can be slow; a TypeScript add also starts the transpiler.
const TIMEOUT = 60_000;

/**
 * Count one run of a file's top level, on `globalThis.__readd793`.
 * @param {string} name - The file's counter name.
 * @returns {string} Source text for the top of a fixture file.
 */
const countRun = (name) =>
	`globalThis.__readd793 = globalThis.__readd793 || {}; globalThis.__readd793.${name} = (globalThis.__readd793.${name} || 0) + 1;\n`;

/**
 * Write every fixture file at version `n`.
 * @param {string} root - Scratch directory.
 * @param {number} n - Version written into every file.
 * @returns {void}
 */
function writeFixture(root, n) {
	const put = (rel, text) => {
		fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
		fs.writeFileSync(path.join(root, rel), text);
	};
	put("base/root.mjs", `export function hello() { return "hi"; }\n`);
	put("base/extra.mjs", `${countRun("extra")}export function ping() { return "extra${n}"; }\n`);
	put("plug/p.mjs", `${countRun("p")}export function ping() { return "pong${n}"; }\n`);
	put("one.mjs", `${countRun("one")}export function ping() { return "one${n}"; }\n`);
	put("cj/c.cjs", `${countRun("c")}module.exports = { ping() { return "cjs${n}"; } };\n`);
	put("ts/t.ts", `${countRun("t")}export function ping(): string { return "ts${n}"; }\n`);
}

/** The files whose `ping()` a fresh process reads, relative to the fixture root. */
const FRESH_FILES = ["base/extra.mjs", "plug/p.mjs", "one.mjs", "cj/c.cjs", "ts/t.ts"];

/**
 * What a separate Node process gets from `ping()` of each file at version `n`, importing it once.
 * @param {number} n - Fixture version.
 * @returns {Record<string, string>} `ping()` per file.
 */
function freshProcessPings(n) {
	const dir = makeTestTmpDirSync("readd-fresh");
	try {
		writeFixture(dir, n);
		const script =
			`const out = {};` +
			`for (const [rel, href] of JSON.parse(process.argv[1])) {` +
			` const m = await import(href);` +
			` const ns = m.default && typeof m.default.ping === "function" ? m.default : m;` +
			` out[rel] = ns.ping();` +
			`}` +
			`process.stdout.write(JSON.stringify(out));`;
		const files = FRESH_FILES.map((rel) => [rel, url.pathToFileURL(path.join(dir, rel)).href]);
		const stdout = execFileSync(process.execPath, ["--no-warnings", "--input-type=module", "-e", script, JSON.stringify(files)], {
			encoding: "utf8"
		});
		return JSON.parse(stdout);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

/**
 * The adds re-added after a remove. `read` returns the add's `ping()`.
 * @type {Array<{ name: string, at: string, src: string, file: string, counter: string, read: (api: object) => Promise<string> }>}
 */
const SHAPES = [
	{ name: "an .mjs folder", at: "plug", src: "plug", file: "plug/p.mjs", counter: "p", read: (api) => api.plug.p.ping() },
	{ name: "an .mjs file", at: "one", src: "one.mjs", file: "one.mjs", counter: "one", read: (api) => api.one.ping() },
	{ name: "a .cjs folder", at: "c", src: "cj", file: "cj/c.cjs", counter: "c", read: (api) => api.c.ping() },
	{ name: "a .ts folder", at: "t", src: "ts", file: "ts/t.ts", counter: "t", read: (api) => api.t.ping() }
];

/** @type {Record<number, Record<string, string>>} */
const FRESH = {};

beforeAll(() => {
	FRESH[1] = freshProcessPings(1);
	FRESH[2] = freshProcessPings(2);
	FRESH[3] = freshProcessPings(3);
}, TIMEOUT);

afterAll(() => {
	delete globalThis.__readd793;
});

describe.each(TEST_MATRIX)("add after remove > $name", ({ config }) => {
	let api;
	let root;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
		if (root) fs.rmSync(root, { recursive: true, force: true });
		root = null;
	});

	/**
	 * Build an instance over the scratch base at fixture version 1, with the run counters cleared.
	 * @returns {Promise<object>} The api.
	 */
	async function setup() {
		globalThis.__readd793 = {};
		root = makeTestTmpDirSync("readd-after-remove");
		writeFixture(root, 1);
		api = await slothlet({ ...config, base: path.join(root, "base"), typescript: true, silent: true });
		return api;
	}

	const runs = (counter) => globalThis.__readd793[counter] ?? 0;

	for (const shape of SHAPES) {
		for (const by of ["moduleID", "path"]) {
			it(
				`loads the edited code when ${shape.name} removed by its ${by} is added again under the same moduleID`,
				async () => {
					await setup();
					const id = `${shape.at}-mod`;
					await api.slothlet.api.add(shape.at, path.join(root, shape.src), { moduleID: id });
					expect(await shape.read(api)).toBe(FRESH[1][shape.file]);
					expect(runs(shape.counter)).toBe(1);

					expect(await api.slothlet.api.remove(by === "moduleID" ? id : shape.at)).toBe(true);
					writeFixture(root, 2);
					await api.slothlet.api.add(shape.at, path.join(root, shape.src), { moduleID: id });

					expect(await shape.read(api)).toBe(FRESH[2][shape.file]);
					// The file was imported once more: its top level ran again, as a new import of it does.
					expect(runs(shape.counter)).toBe(2);
					expect([...api.slothlet.diag.owner.get(shape.at)]).toContain(id);
				},
				TIMEOUT
			);
		}
	}

	it(
		"loads the edited code on every re-add, however quickly they follow each other",
		async () => {
			await setup();
			const add = () => api.slothlet.api.add("plug", path.join(root, "plug"), { moduleID: "pm" });
			await add();
			await api.plug.p.ping();
			for (const n of [2, 3]) {
				await api.slothlet.api.remove("pm");
				writeFixture(root, n);
				await add();
				expect(await api.plug.p.ping()).toBe(FRESH[n]["plug/p.mjs"]);
			}
			expect(runs("p")).toBe(3);
		},
		TIMEOUT
	);

	it(
		"imports a first add plainly, with no reload stamp, and only once",
		async () => {
			globalThis.__readd793 = {};
			root = makeTestTmpDirSync("readd-after-remove");
			writeFixture(root, 1);
			// The injectable importer (TESTING.md) receives the exact URL each api file is imported with.
			const seen = [];
			const importer = (href) => {
				seen.push(String(href));
				return import(href);
			};
			api = await slothlet({ ...config, base: path.join(root, "base"), silent: true, import: importer });
			const stamps = () => seen.filter((href) => href.includes("/plug/p.mjs")).map((href) => new URL(href).searchParams.has("_reload"));

			await api.slothlet.api.add("plug", path.join(root, "plug"), { moduleID: "pm" });
			expect(await api.plug.p.ping()).toBe(FRESH[1]["plug/p.mjs"]);
			expect(stamps()).toEqual([false]);
			expect(runs("p")).toBe(1);

			await api.slothlet.api.remove("pm");
			await api.slothlet.api.add("plug", path.join(root, "plug"), { moduleID: "pm" });
			await api.plug.p.ping();
			expect(stamps()).toEqual([false, true]);
			expect(runs("p")).toBe(2);
		},
		TIMEOUT
	);

	it(
		"loads the edited code when a removed path is added again under a different moduleID",
		async () => {
			await setup();
			await api.slothlet.api.add("plug", path.join(root, "plug"), { moduleID: "first" });
			expect(await api.plug.p.ping()).toBe(FRESH[1]["plug/p.mjs"]);
			await api.slothlet.api.remove("first");
			writeFixture(root, 2);
			await api.slothlet.api.add("plug", path.join(root, "plug"), { moduleID: "second" });
			expect(await api.plug.p.ping()).toBe(FRESH[2]["plug/p.mjs"]);
			expect(runs("p")).toBe(2);
		},
		TIMEOUT
	);

	it(
		"does not import again a module whose moduleID still has a live mount",
		async () => {
			await setup();
			await api.slothlet.api.add("a", path.join(root, "plug"), { moduleID: "mm" });
			await api.slothlet.api.add("b", path.join(root, "plug"), { moduleID: "mm" });
			const liveA = await api.a.p.ping();
			expect(await api.b.p.ping()).toBe(liveA);
			const before = runs("p");

			await api.slothlet.api.remove("b");
			writeFixture(root, 2);
			await api.slothlet.api.add("b", path.join(root, "plug"), { moduleID: "mm" });

			// Plain JavaScript: a module that is still loaded is the same instance for a new importer.
			expect(await api.a.p.ping()).toBe(liveA);
			expect(await api.b.p.ping()).toBe(liveA);
			expect(runs("p")).toBe(before);
		},
		TIMEOUT
	);

	it(
		"loads the edited code when a file of the base load is removed and added again",
		async () => {
			await setup();
			expect(await api.extra.ping()).toBe(FRESH[1]["base/extra.mjs"]);
			expect(await api.slothlet.api.remove("extra")).toBe(true);
			writeFixture(root, 2);
			await api.slothlet.api.add("extra", path.join(root, "base/extra.mjs"), { moduleID: "extra-mod" });
			expect(await api.extra.ping()).toBe(FRESH[2]["base/extra.mjs"]);
			expect(runs("extra")).toBe(2);
		},
		TIMEOUT
	);
});
