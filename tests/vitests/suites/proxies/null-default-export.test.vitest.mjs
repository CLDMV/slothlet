/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/null-default-export.test.vitest.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file whose default export is `null` or `undefined` reads as that value at every node, as the plain
 * module's `default` does (#792).
 *
 * @description
 * The fixture holds such files at the api root, in a folder, and as a folder's only self-named file, and the same
 * folder is mounted again at `zz`. Each node reads, awaits and is described as the plain module's default export, for
 * the host and for a module. It stays listed and found by `in`, as a member of a plain object holding `null` is. A
 * module the rules deny is refused the read and the `await`, and the listing leaves it out, as it does for a primitive
 * default beside it. A file with a null default and named exports keeps its shape. Nodes added in memory and from a
 * file, reloads and removes are covered too. Eager and lazy mode, the async and live runtime, both attributions, and the
 * permission system off and disabled.
 * @module tests/vitests/suites/proxies/null-default-export
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_null_default");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const ATTRIBUTIONS = ["precise", "fast"];

const configs = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => ATTRIBUTIONS.map((attribution) => ({ mode, runtime, attribution }))));

/** Each node holding a file's null or undefined default, with the file. */
const NULLISH = [
	["pnull", "pnull.mjs"],
	["pundef", "pundef.mjs"],
	["folder.inner", "folder/inner.mjs"],
	["folder.blank", "folder/blank.mjs"],
	["selfnull", "selfnull/selfnull.mjs"],
	["selfundef", "selfundef/selfundef.mjs"]
];

/** The same nodes, and their twins mounted at `zz`. */
const EVERY = NULLISH.flatMap(([path, file]) => [
	[path, file],
	[`zz.${path}`, file]
]);

/** A primitive default beside each node, for the listing a denied module is given. */
const BESIDE = { "": "pnum", folder: "folder.num", zz: "zz.pnum", "zz.folder": "zz.folder.num" };

/**
 * The node at a dotted path.
 * @param {object} root - Where to start.
 * @param {string} path - The path.
 * @returns {*} The node.
 */
function at(root, path) {
	let node = root;
	for (const segment of path.split(".")) node = node[segment];
	return node;
}

/**
 * A path's parent and last segment.
 * @param {string} path - The path.
 * @returns {[string, string]} The parent's path (empty for the root) and the member's name.
 */
function split(path) {
	const index = path.lastIndexOf(".");
	return index === -1 ? ["", path] : [path.slice(0, index), path.slice(index + 1)];
}

/**
 * A value as the fixture's reader describes it.
 * @param {*} value - The value.
 * @returns {*} Its description.
 */
function described(value) {
	if (value === undefined) return { undefined: true };
	if (value === null || typeof value !== "object") return typeof value === "function" ? { function: true } : value;
	return { object: true };
}

/**
 * The plain module's default export of a fixture file.
 * @param {string} file - The file, relative to the fixture.
 * @returns {Promise<*>} Its `default`.
 */
async function plainDefault(file) {
	const module = await import(`${pathToFileURL(join(FIXTURE, file)).href}?plain-null-default`);
	return module.default;
}

/**
 * Build an instance over the fixture with the same folder mounted again at `zz`.
 * @param {object} options - Instance options.
 * @param {{load?: boolean}} [how] - Whether to load every node first.
 * @returns {Promise<object>} The api.
 */
async function build(options, { load = true } = {}) {
	const api = await slothlet({ base: FIXTURE, silent: true, ...options });
	await api.slothlet.api.add("zz", FIXTURE, { moduleID: "zz" });
	if (load) {
		for (const [path] of EVERY) await at(api, path);
		for (const path of Object.values(BESIDE)) await at(api, path);
		await api.reader;
	}
	return api;
}

/**
 * A deny for the reader on each node holding a null or undefined default and on each primitive beside one.
 * @returns {object[]} The rules.
 */
const denyRules = () =>
	[...EVERY.map(([path]) => path), ...Object.values(BESIDE)].map((target) => ({ caller: "reader.**", target, effect: "deny" }));

describe.each(configs)("a null or undefined default export > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("reads, awaits and is described as the plain module's default export", async () => {
		api = await build({ mode, runtime, permissions: { attribution, rules: [] } });
		for (const [path, file] of EVERY) {
			const plain = await plainDefault(file);
			const [parent, name] = split(path);
			const holder = parent ? at(api, parent) : api;
			expect(at(api, path), `the host reads ${path}`).toBe(plain);
			expect(await at(api, path), `the host awaits ${path}`).toBe(plain);
			expect(at(api, path), `the host reads ${path} again`).toBe(plain);
			expect(Object.keys(holder), `${parent || "the root"} lists ${name}`).toContain(name);
			expect(name in holder, `${name} is in ${parent || "the root"}`).toBe(true);
			expect(Object.getOwnPropertyDescriptor(holder, name)?.value, `${path} is described by its value`).toBe(plain);
			expect(await api.reader.read(path), `a module reads ${path}`).toEqual(described(plain));
			expect(await api.reader.settle(path), `a module awaits ${path}`).toEqual(described(plain));
			expect(await api.reader.member(parent, name), `a module lists ${path}`).toEqual({
				keys: true,
				has: true,
				described: described(plain)
			});
		}
	});

	it("a module the rules deny is refused the read and the await, and is not given it in a listing", async () => {
		api = await build({ mode, runtime, permissions: { attribution, rules: denyRules() } });
		for (const [path, file] of EVERY) {
			const [parent, name] = split(path);
			expect(await api.reader.read(path), `the reader reads ${path}`).toEqual({ threw: "PERMISSION_DENIED" });
			expect(await api.reader.settle(path), `the reader awaits ${path}`).toEqual({ threw: "PERMISSION_DENIED" });
			const listed = await api.reader.member(parent, name);
			expect(listed, `the reader lists ${path}`).toEqual({ keys: false, has: true, described: { none: true } });
			// As it is given the primitive default beside it.
			const [, beside] = split(BESIDE[parent]);
			expect(await api.reader.member(parent, beside), `the reader lists ${BESIDE[parent]}`).toEqual(listed);
			// The host still reads the plain value.
			expect(at(api, path), `the host reads ${path}`).toBe(await plainDefault(file));
		}
	});

	it("a node not loaded yet reads as the plain value once awaited", async () => {
		api = await build({ mode, runtime, permissions: { attribution, rules: [] } }, { load: false });
		for (const [path, file] of EVERY) {
			const plain = await plainDefault(file);
			const awaited = await at(api, path);
			// A lazy folder's only file loads on the await of the folder's own node, which answers that node, as it does
			// for a primitive default; every read from then on is the value.
			if (mode === "eager" || !path.includes("self")) expect(awaited, `the host awaits ${path}`).toBe(plain);
			expect(at(api, path), `the host reads ${path}`).toBe(plain);
		}
	});

	it("a file with a null default and named exports keeps both under its own node", async () => {
		api = await build({ mode, runtime, permissions: { attribution, rules: [] } });
		for (const node of [api.nnamed, api.zz.nnamed]) {
			await node;
			expect(Object.keys(node).sort()).toEqual(["default", "label"]);
			expect(node.default).toBe(null);
			expect(node.label()).toBe("nnamed.label");
		}
	});

	it("a node added in memory or from a file reads as the plain value", async () => {
		api = await build({ mode, runtime, permissions: { attribution, rules: [] } });
		await api.slothlet.api.add("memnull", { default: null });
		await api.slothlet.api.add("memundef", { default: undefined });
		await api.slothlet.api.add("memnamed", { default: null, x: 1 });
		await api.slothlet.api.add("one", join(FIXTURE, "pnull.mjs"));
		await api.slothlet.api.add(["deep", "one"], join(FIXTURE, "pundef.mjs"));
		for (const [path, plain] of [
			["memnull", null],
			["memundef", undefined],
			["one", null],
			["deep.one", undefined]
		]) {
			expect(await at(api, path), `the host awaits ${path}`).toBe(plain);
			expect(at(api, path), `the host reads ${path}`).toBe(plain);
			expect(await api.reader.read(path), `a module reads ${path}`).toEqual(described(plain));
		}
		expect(Object.keys(api.memnamed).sort()).toEqual(["default", "x"]);
		expect(api.memnamed.default).toBe(null);
	});

	it("reloads and removes such a node by its path and its module", async () => {
		api = await build({ mode, runtime, permissions: { attribution, rules: [] } });
		await api.slothlet.api.add("one", join(FIXTURE, "pnull.mjs"), { moduleID: "one" });
		await api.slothlet.api.reload("pnull");
		await api.slothlet.api.reload("zz.folder.inner");
		await api.slothlet.api.reload("zz");
		for (const [path, file] of [...EVERY, ["one", "pnull.mjs"]]) {
			const plain = await plainDefault(file);
			// A reloaded lazy folder loads again on the await (see "a node not loaded yet").
			await at(api, path);
			expect(at(api, path), `the host reads ${path} after the reloads`).toBe(plain);
		}
		expect(Object.keys(api)).toContain("pnull");
		expect(Object.keys(api.zz.folder)).toContain("inner");

		expect(await api.slothlet.api.remove("zz.pnull", "zz")).toBe(true);
		expect("pnull" in api.zz).toBe(false);
		expect(api.zz.pundef).toBe(undefined);
		expect(Object.keys(api.zz)).toContain("pundef");
		await api.slothlet.api.remove("one");
		expect("one" in api).toBe(false);
		expect(api.pnull).toBe(null);
	});
});

describe.each(["off", "disabled"])("a null or undefined default export with permissions %s", (permissionsMode) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each(MODES)("reads as the plain value to every reader: %s", async (mode) => {
		api = await build({ mode, permissions: { mode: permissionsMode, rules: denyRules() } });
		for (const [path, file] of EVERY) {
			const plain = await plainDefault(file);
			const [parent, name] = split(path);
			expect(at(api, path), `the host reads ${path}`).toBe(plain);
			expect(await api.reader.read(path), `a module reads ${path}`).toEqual(described(plain));
			expect(await api.reader.settle(path), `a module awaits ${path}`).toEqual(described(plain));
			expect(await api.reader.member(parent, name), `a module lists ${path}`).toEqual({
				keys: true,
				has: true,
				described: described(plain)
			});
		}
	});
});
