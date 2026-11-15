/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-reload-single-file.test.vitest.mjs
 *	@Date: 2026-11-14T23:40:00-08:00 (1794728400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T23:40:00-08:00 (1794728400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A scoped reload of an add whose source is a single file.
 *
 * @description
 * `api.slothlet.api.add("calc", "/abs/calc.mjs", { moduleID: "calc-mod" })` mounts the file's exports at `calc`
 * (RELOAD.md: "Mount a single file — its exports mount AT the apiPath"). `api.slothlet.api.reload("calc-mod")` and
 * `api.slothlet.api.reload("calc")` re-read that file from disk and leave the add where it was: same path, same
 * members, same moduleID and ownership, a held reference that now runs the new code, hooks and permission rules on
 * the path still in force, and a sibling add under the same parent untouched. For each shape the result is compared
 * with what a full `api.slothlet.reload()` gives for the same add, which replays the add from its history.
 *
 * Each test writes its own copy of the files under `tmp/test-fixtures/` and rewrites them between the add and the
 * reload, so the reload has new content to pick up.
 *
 * @module tests/vitests/suites/api-manager/api-manager-reload-single-file
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_MATRIX } from "../../setup/vitest-helper.mjs";
import { makeTestTmpDirSync } from "../../setup/test-fixtures-tmp.mjs";

// A cold build on a loaded runner can be slow; each test builds one or two instances.
const TIMEOUT = 60_000;

/**
 * Write the fixture files at version `n`.
 * @param {string} root - Scratch directory.
 * @param {number} n - Version written into every file.
 * @returns {void}
 */
function writeFixture(root, n) {
	const put = (rel, text) => {
		fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
		fs.writeFileSync(path.join(root, rel), text);
	};
	put("base/secret.mjs", `export function get() { return "secret"; }\n`);
	put("base/root.mjs", `export function hello() { return "hi"; }\n`);
	put(
		"calc.mjs",
		`import { self } from "@cldmv/slothlet/runtime";\n` +
			`export default function calc(x) { return x * ${n}; }\n` +
			`export function half(x) { return x / 2 + ${n} * 0; }\n` +
			`export function peek() { return self.secret.get(); }\n` +
			`export const ver = ${n};\n`
	);
	put("plain.mjs", `export function ping() { return "plain${n}"; }\nexport const ver = ${n};\n`);
	put("c.cjs", `module.exports = { ping() { return "cjs${n}"; }, ver: ${n} };\n`);
	put(
		"cdef.cjs",
		`module.exports = function cdef() { return "cdef${n}"; };\nmodule.exports.extra = function extra() { return "extra${n}"; };\n`
	);
	put("more.mjs", `export function extra() { return "more${n}"; }\n`);
	put("sib.mjs", `export function ping() { return "sib${n}"; }\n`);
}

/**
 * The single-file adds. `read` returns what the add shows at its path; `expected(n)` is that for file version `n`,
 * as plain JavaScript gives it for the same exports.
 * @type {Array<{ name: string, at: string, src: string, id: string, read: (api: object) => Promise<unknown>, expected: (n: number) => unknown }>}
 */
const SHAPES = [
	{
		name: "an .mjs file with a default function and named exports",
		at: "calc",
		src: "calc.mjs",
		id: "calc-mod",
		read: async (api) => ({
			call: await api.calc(4),
			half: await api.calc.half(4),
			ver: await api.calc.ver,
			members: Object.keys(api.calc).sort()
		}),
		expected: (n) => ({ call: 4 * n, half: 2, ver: n, members: ["half", "peek", "ver"] })
	},
	{
		name: "an .mjs file named differently from its nested path",
		at: "a.b",
		src: "plain.mjs",
		id: "plain-mod",
		read: async (api) => ({ ping: await api.a.b.ping(), ver: await api.a.b.ver, keys: Object.keys(api.a.b).sort() }),
		expected: (n) => ({ ping: `plain${n}`, ver: n, keys: ["ping", "ver"] })
	},
	{
		name: "a .cjs file exporting an object",
		at: "tools.c",
		src: "c.cjs",
		id: "c-mod",
		read: async (api) => ({ ping: await api.tools.c.ping(), ver: await api.tools.c.ver }),
		expected: (n) => ({ ping: `cjs${n}`, ver: n })
	},
	{
		name: "a .cjs file exporting a function with a member",
		at: "cdef",
		src: "cdef.cjs",
		id: "cdef-mod",
		read: async (api) => ({ call: await api.cdef(), extra: await api.cdef.extra() }),
		expected: (n) => ({ call: `cdef${n}`, extra: `extra${n}` })
	},
	{
		name: "an .mjs file merged onto a path the base already has",
		at: "root",
		src: "more.mjs",
		id: "more-mod",
		read: async (api) => ({ hello: await api.root.hello(), extra: await api.root.extra() }),
		expected: (n) => ({ hello: "hi", extra: `more${n}` })
	}
];

describe.each(TEST_MATRIX)("scoped reload of a single-file add > $name", ({ config }) => {
	let api;
	let root;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
		if (root) fs.rmSync(root, { recursive: true, force: true });
		root = null;
	});

	/**
	 * Build an instance over the scratch base, add `shape` and the sibling, at file version 1.
	 * @param {object} shape - One of SHAPES.
	 * @param {object} [extra] - Extra instance config.
	 * @returns {Promise<object>} The api.
	 */
	async function setup(shape, extra = {}) {
		root = makeTestTmpDirSync("reload-single-file");
		writeFixture(root, 1);
		api = await slothlet({ ...config, dir: path.join(root, "base"), silent: true, ...extra });
		await api.slothlet.api.add(shape.at, path.join(root, shape.src), { moduleID: shape.id });
		await api.slothlet.api.add("tools.sib", path.join(root, "sib.mjs"), { moduleID: "sib-mod" });
		return api;
	}

	for (const shape of SHAPES) {
		for (const by of ["moduleID", "path"]) {
			it(
				`re-reads ${shape.name} when reloaded by its ${by}`,
				async () => {
					await setup(shape);
					expect(await shape.read(api)).toEqual(shape.expected(1));
					writeFixture(root, 2);
					await api.slothlet.api.reload(by === "moduleID" ? shape.id : shape.at);
					expect(await shape.read(api)).toEqual(shape.expected(2));
					expect([...api.slothlet.diag.owner.get(shape.at)]).toContain(shape.id);
					// The sibling under the same parent was not reloaded: still the code it was added with.
					expect(await api.tools.sib.ping()).toBe("sib1");
				},
				TIMEOUT
			);
		}

		it(
			`gives ${shape.name} the same api as a full reload`,
			async () => {
				await setup(shape);
				writeFixture(root, 2);
				await api.slothlet.reload();
				const full = await shape.read(api);
				await api.shutdown();
				fs.rmSync(root, { recursive: true, force: true });

				await setup(shape);
				writeFixture(root, 2);
				await api.slothlet.api.reload(shape.id);
				expect(await shape.read(api)).toEqual(full);
			},
			TIMEOUT
		);
	}

	it(
		"keeps a held reference, the moduleID and the metadata, across two reloads in a row",
		async () => {
			const shape = SHAPES[0];
			await setup(shape);
			const held = api.calc;
			const before = api.calc.half.__metadata;
			writeFixture(root, 2);
			await api.slothlet.api.reload("calc-mod");
			writeFixture(root, 3);
			await api.slothlet.api.reload("calc-mod");
			expect(api.calc).toBe(held);
			expect(await held(4)).toBe(12);
			expect(await held.half(4)).toBe(2);
			const after = api.calc.half.__metadata;
			expect(after.moduleID).toBe(before.moduleID);
			expect(after.apiPath).toBe("calc.half");
			expect(after.filePath).toBe(path.join(root, "calc.mjs"));
			expect(api.calc.__metadata.apiPath).toBe("calc");
		},
		TIMEOUT
	);

	it.skipIf(!config.hook?.enabled)(
		"still runs the hooks registered on the path after the reload",
		async () => {
			const shape = SHAPES[0];
			await setup(shape);
			const seen = [];
			api.slothlet.hook.on("calc.half:before", ({ path: p }) => void seen.push(p), { id: "reload-single-file" });
			writeFixture(root, 2);
			await api.slothlet.api.reload("calc");
			expect(await api.calc.half(4)).toBe(2);
			expect(seen).toEqual(["calc.half"]);
		},
		TIMEOUT
	);

	for (const attribution of ["precise", "fast"]) {
		it(
			`still applies a rule on the path after the reload (attribution "${attribution}")`,
			async () => {
				const shape = SHAPES[0];
				await setup(shape, { permissions: { attribution, rules: [{ caller: "calc.**", target: "secret.**", effect: "deny" }] } });
				await expect(Promise.resolve().then(() => api.calc.peek())).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
				writeFixture(root, 2);
				await api.slothlet.api.reload("calc-mod");
				expect(await api.calc(4)).toBe(8);
				await expect(Promise.resolve().then(() => api.calc.peek())).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
				expect(await api.secret.get()).toBe("secret");
			},
			TIMEOUT
		);
	}
});
