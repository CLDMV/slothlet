/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-search-limits.test.vitest.mjs
 *	@Date: 2026-11-23T18:04:58-08:00 (1795485898)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T14:47:56-08:00 (1795560476)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `permissions.search` bounds how far a value handed into a call, or returned out of one, is searched.
 *
 * @description
 * `cyc.fnmod` is a node built from `cyc/fnmod.mjs`, and a rule denies `reader` that node. `reader` hands `friend` a
 * function it defines itself (`() => self.cyc.fnmod("x")`), nested inside objects (`{ v: { v: fn } }`) or beside
 * filler properties (`{ p0: 0, …, fn }`). `friend` reaches it and calls it, then calls `self.cyc.fnmod("own")` itself.
 * A call handed a function marks the call as handed the caller's code, and so does one handed plain data that nests
 * deeper or wider than the search reaches (it fails closed). So at every depth and width the handed function runs as
 * `reader`, its supplier, and is refused, while `friend`'s own call is allowed: past the limit the call is still marked.
 * `maker.make(n)` returns plain data `n` objects deep; with `caller.provenance: false` returned data is searched when it
 * is handed out, and data deeper than the search reaches comes back as a stand-in (a Proxy) instead of as itself.
 *
 * Levels count the objects around a value, the outermost included: `{ v: fn }` holds `fn` one level deep.
 *
 * Fixtures (written to tmp/): `base/root.mjs`, `cyc/fnmod.mjs` + `cyc/dn.mjs`, `reader/reader.mjs`, `friend/friend.mjs`,
 * `maker/maker.mjs`.
 * @module tests/vitests/suites/permissions/permissions-search-limits
 */

import path from "node:path";
import { types } from "node:util";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const ROOT = path.join(process.cwd(), "tmp", "permissions-search-limits");

/**
 * Write a fixture file under ROOT.
 * @param {string} file - Path relative to ROOT.
 * @param {string[]} lines - The file's lines.
 * @returns {void}
 */
function write(file, lines) {
	mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
	writeFileSync(path.join(ROOT, file), lines.join("\n") + "\n");
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("base/root.mjs", ["export function ping() {", '\treturn "pong";', "}"]);
	write("cyc/fnmod.mjs", ["export default function fnmod(x) {", '\treturn "fn:" + x;', "}"]);
	// A second file keeps `cyc` a folder of nodes, so `cyc.fnmod` is a node of its own.
	write("cyc/dn.mjs", ["export default function dn(x) {", '\treturn "dn:" + x;', "}"]);
	write("reader/reader.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"const at = async (step) => {",
		"\ttry {",
		"\t\treturn await step();",
		"\t} catch (error) {",
		'\t\treturn "!" + (error?.code ?? error?.name);',
		"\t}",
		"};",
		"export function deep(levels) {",
		'\tlet value = () => self.cyc.fnmod("x");',
		"\tfor (let i = 0; i < levels; i++) value = { v: value };",
		"\treturn at(() => self.friend.dig(value, levels));",
		"}",
		"export function wide(filler) {",
		"\tconst value = {};",
		"\tfor (let i = 0; i < filler; i++) value[`p${i}`] = 0;",
		'\tvalue.fn = () => self.cyc.fnmod("x");',
		"\treturn at(() => self.friend.pick(value));",
		"}"
	]);
	write("friend/friend.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"const both = async (handed) => {",
		"\tlet outcome;",
		"\ttry {",
		"\t\toutcome = await handed();",
		"\t} catch (error) {",
		'\t\toutcome = "!" + (error?.code ?? error?.name);',
		"\t}",
		'\treturn (await self.cyc.fnmod("own")) + "|" + outcome;',
		"};",
		"export function dig(value, levels) {",
		"\tfor (let i = 0; i < levels; i++) value = value.v;",
		"\treturn both(value);",
		"}",
		"export function pick(value) {",
		"\treturn both(value.fn);",
		"}"
	]);
	write("maker/maker.mjs", [
		"export function make(levels) {",
		"\tlet value = 1;",
		"\tfor (let i = 0; i < levels; i++) value = { v: value };",
		"\treturn value;",
		"}"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const DENY_READER = { policy: "allow", rules: [{ caller: "reader.**", target: "cyc.fnmod", effect: "deny" }] };

/**
 * What `friend` reports for a call marked as handed `reader`'s code: its own call of `cyc.fnmod` runs, and the handed
 * function runs as `reader` and is refused.
 * @type {string}
 */
const MARKED = "fn:own|!PERMISSION_DENIED";

/**
 * Build an instance with every fixture module mounted.
 * @param {object} config - The matrix config.
 * @param {object} [permissions] - The permissions config.
 * @returns {Promise<object>} The api.
 */
async function build(config, permissions = DENY_READER) {
	const api = await slothlet({ ...config, base: path.join(ROOT, "base"), silent: true, permissions });
	for (const name of ["cyc", "reader", "friend", "maker"]) await api.slothlet.api.add(name, path.join(ROOT, name), { id: name });
	await api.cyc.fnmod;
	return api;
}

/**
 * Read `levels` nested `v` members off a value.
 * @param {*} value - The value.
 * @param {number} levels - How many.
 * @returns {*} What is at the bottom.
 */
function bottom(value, levels) {
	for (let i = 0; i < levels; i++) value = value.v;
	return value;
}

describe.each(getMatrixConfigs())("Permissions > search limits > $name", ({ config }) => {
	let api;
	let other;

	afterEach(async () => {
		await api?.shutdown?.();
		await other?.shutdown?.();
		api = null;
		other = null;
	});

	it("by default finds the caller's function four levels deep in an argument, and past that still marks the call", async () => {
		api = await build(config);
		expect(await api.reader.deep(1)).toBe(MARKED);
		expect(await api.reader.deep(4)).toBe(MARKED);
		expect(await api.reader.deep(5)).toBe(MARKED);
	});

	it("a raised depth searches six levels deep and still marks the call past them, leaving properties at their default", async () => {
		api = await build(config, { ...DENY_READER, search: { depth: 6 } });
		expect(await api.reader.deep(5)).toBe(MARKED);
		expect(await api.reader.deep(6)).toBe(MARKED);
		expect(await api.reader.deep(7)).toBe(MARKED);
		expect(await api.reader.wide(500)).toBe(MARKED);
		expect(await api.reader.wide(600)).toBe(MARKED);
	});

	it("a lowered depth stops sooner and still marks the call past it", async () => {
		api = await build(config, { ...DENY_READER, search: { depth: 1 } });
		expect(await api.reader.deep(1)).toBe(MARKED);
		expect(await api.reader.deep(2)).toBe(MARKED);
	});

	it("by default searches 512 properties and still marks the call past them", async () => {
		api = await build(config);
		expect(await api.reader.wide(10)).toBe(MARKED);
		expect(await api.reader.wide(500)).toBe(MARKED);
		expect(await api.reader.wide(600)).toBe(MARKED);
	});

	it("raised properties search past 512 and leave depth at its default", async () => {
		api = await build(config, { ...DENY_READER, search: { properties: 1024 } });
		expect(await api.reader.wide(600)).toBe(MARKED);
		expect(await api.reader.deep(4)).toBe(MARKED);
		expect(await api.reader.deep(5)).toBe(MARKED);
	});

	it("lowered properties stop sooner and still mark the call past them", async () => {
		api = await build(config, { ...DENY_READER, search: { properties: 8 } });
		expect(await api.reader.wide(10)).toBe(MARKED);
		expect(await api.reader.wide(5)).toBe(MARKED);
	});

	it("with provenance off, returned data within the depth comes back as itself and deeper as a stand-in", async () => {
		api = await build(config, { ...DENY_READER, caller: { provenance: false } });
		const within = await api.maker.make(4);
		expect(types.isProxy(within)).toBe(false);
		expect(within).toEqual({ v: { v: { v: { v: 1 } } } });
		const past = await api.maker.make(5);
		expect(types.isProxy(past)).toBe(true);
		expect(bottom(past, 5)).toBe(1);
	});

	it("with provenance off, a raised depth returns deeper data as itself", async () => {
		api = await build(config, { ...DENY_READER, caller: { provenance: false }, search: { depth: 6 } });
		expect(types.isProxy(await api.maker.make(6))).toBe(false);
		const past = await api.maker.make(7);
		expect(types.isProxy(past)).toBe(true);
		expect(bottom(past, 7)).toBe(1);
	});

	it("two instances keep their own limits", async () => {
		api = await build(config);
		other = await build(config, { ...DENY_READER, search: { depth: 6 } });
		expect(await api.reader.deep(5)).toBe(MARKED);
		expect(await other.reader.deep(5)).toBe(MARKED);
		expect(await other.reader.deep(7)).toBe(MARKED);
		expect(await api.reader.deep(5)).toBe(MARKED);
	});

	it("an api.add cannot change the instance's limit", async () => {
		api = await build(config);
		await expect(
			api.slothlet.api.add("extra", path.join(ROOT, "friend"), { id: "extra", permissions: { search: { depth: 6 } } })
		).rejects.toMatchObject({ code: "INVALID_CONFIG_UNKNOWN_KEY" });
		expect(await api.reader.deep(5)).toBe(MARKED);
	});
});

describe("Permissions > search limits > config validation", () => {
	const base = () => path.join(ROOT, "base");

	it.each([
		["depth 0", { depth: 0 }],
		["a string depth", { depth: "4" }],
		["a fractional depth", { depth: 1.5 }],
		["a depth past 64", { depth: 65 }],
		["negative properties", { properties: -1 }],
		["zero properties", { properties: 0 }],
		["properties past 65536", { properties: 65537 }],
		["a number for the group", 5],
		["an array for the group", []]
	])("refuses %s", async (_label, search) => {
		await expect(slothlet({ base: base(), silent: true, permissions: { search } })).rejects.toMatchObject({ code: "INVALID_CONFIG" });
	});

	it("refuses an unknown key in the group", async () => {
		await expect(slothlet({ base: base(), silent: true, permissions: { search: { levels: 4 } } })).rejects.toMatchObject({
			code: "INVALID_CONFIG_UNKNOWN_KEY"
		});
	});

	it.each([
		["depth alone", { depth: 6 }],
		["properties alone", { properties: 2 }],
		["the lower bounds", { depth: 1, properties: 1 }],
		["the upper bounds", { depth: 64, properties: 65536 }],
		["an empty group", {}]
	])("takes %s", async (_label, search) => {
		const api = await slothlet({ base: base(), silent: true, permissions: { search } });
		expect(api).toBeTruthy();
		await api.shutdown();
	});
});
