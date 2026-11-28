/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-search-limits.test.vitest.mjs
 *	@Date: 2026-11-23T18:04:58-08:00 (1795485898)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:40-08:00 (1795869160)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `permissions.search` bounds how far a value handed into a call, or returned out of one, is searched.
 *
 * @description
 * Handed data. `cyc.fnmod` is a node built from `cyc/fnmod.mjs`, and a rule denies `reader` that node. `reader` hands
 * `friend` deeply frozen plain data, nested inside objects (`{ v: { v: 1 } }`) or with properties side by side
 * (`{ p0: 0, … }`). `friend` then runs a function nested in data `bag.box` returns, which calls `self.cyc.fnmod("x")`.
 * Deeply frozen plain data within the search leaves the call unmarked, so `bag`'s function runs under `friend` alone and
 * is allowed (`"fn:x"`). Data nesting deeper or wider than the search reaches marks the call as handed `reader`'s code
 * (it fails closed), so `bag`'s function runs under `reader` too and is refused.
 *
 * Handed node functions. `owner/box.mjs` exports `secret` (a node, `owner.box.secret`) and `deep`/`wide`, which hand
 * the module's own `secret` to `friend` nested in data. A rule denies `friend` that node. Within the search the
 * function is found and `friend`'s call of it is a call of the node, refused; past the search it is not found, and
 * `friend` runs it as a bare function (`"secret:x"`), the documented limit.
 *
 * Returned data. `maker.make(n)` returns plain data `n` objects deep; with `caller.provenance: false` returned data is
 * searched when it is handed out, and data deeper than the search reaches comes back as a stand-in (a Proxy) instead of
 * as itself.
 *
 * Levels count the objects around a value, the outermost included: `{ v: 1 }` holds `1` one level deep. Properties
 * count every own property read, all levels together.
 *
 * Fixtures (written to tmp/): `base/root.mjs`, `cyc/fnmod.mjs` + `cyc/dn.mjs`, `reader/reader.mjs`, `friend/friend.mjs`,
 * `bag/bag.mjs`, `owner/box.mjs` + `owner/other.mjs`, `maker/maker.mjs`.
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
		"\tlet value = 1;",
		"\tfor (let i = 0; i < levels; i++) value = Object.freeze({ v: value });",
		"\treturn at(() => self.friend.look(value));",
		"}",
		"export function wide(count) {",
		"\tconst value = {};",
		"\tfor (let i = 0; i < count; i++) value[`p${i}`] = 0;",
		"\treturn at(() => self.friend.look(Object.freeze(value)));",
		"}"
	]);
	write("friend/friend.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export async function look() {",
		"\tconst box = await self.bag.box();",
		"\ttry {",
		"\t\treturn await box.run();",
		"\t} catch (error) {",
		'\t\treturn "!" + (error?.code ?? error?.name);',
		"\t}",
		"}",
		"export async function dig(value, levels) {",
		"\tfor (let i = 0; i < levels; i++) value = value.v;",
		"\ttry {",
		'\t\treturn await value("x");',
		"\t} catch (error) {",
		'\t\treturn "!" + (error?.code ?? error?.name);',
		"\t}",
		"}",
		"export async function pick(value) {",
		"\ttry {",
		'\t\treturn await value.fn("x");',
		"\t} catch (error) {",
		'\t\treturn "!" + (error?.code ?? error?.name);',
		"\t}",
		"}"
	]);
	write("bag/bag.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		'export const box = () => ({ run: () => self.cyc.fnmod("x") });'
	]);
	write("owner/box.mjs", [
		"export function secret(x) {",
		'\treturn "secret:" + x;',
		"}",
		"export function share(key) {",
		"\tglobalThis[key] = secret;",
		"}"
	]);
	write("carrier/carrier.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"const at = async (step) => {",
		"\ttry {",
		"\t\treturn await step();",
		"\t} catch (error) {",
		'\t\treturn "!" + (error?.code ?? error?.name);',
		"\t}",
		"};",
		"export function deep(key, levels) {",
		"\tlet value = globalThis[key];",
		"\tfor (let i = 0; i < levels; i++) value = { v: value };",
		"\treturn at(() => self.friend.dig(value, levels));",
		"}",
		"export function wide(key, filler) {",
		"\tconst value = {};",
		"\tfor (let i = 0; i < filler; i++) value[`p${i}`] = 0;",
		"\tvalue.fn = globalThis[key];",
		"\treturn at(() => self.friend.pick(value));",
		"}"
	]);
	// A second file keeps `owner.box` a file of nodes, so `owner.box.secret` is a node of its own.
	write("owner/other.mjs", ["export function other() {", '\treturn "other";', "}"]);
	write("maker/maker.mjs", [
		"export function make(levels) {",
		"\tlet value = 1;",
		"\tfor (let i = 0; i < levels; i++) value = { v: value };",
		"\treturn value;",
		"}"
	]);
});

afterAll(() => {
	delete globalThis.__slothletSearchLimitsSecret;
	rmSync(ROOT, { recursive: true, force: true });
});

const DENY_READER = { policy: "allow", rules: [{ caller: "reader.**", target: "cyc.fnmod", effect: "deny" }] };

/**
 * Both rules at once: `reader` is denied `cyc.fnmod`, `carrier` is denied the node `owner.box.secret`.
 * @type {object}
 */
const DENY_BOTH = {
	policy: "allow",
	rules: [...DENY_READER.rules, { caller: "carrier.**", target: "owner.box.secret", effect: "deny" }]
};

/**
 * What `friend` reports when the call `reader` made was not marked: `bag`'s function runs under `friend` alone.
 * @type {string}
 */
const UNMARKED = "fn:x";

/**
 * What `friend` reports when the call `reader` made was marked: `bag`'s function runs under `reader` too, and is refused.
 * @type {string}
 */
const MARKED = "!PERMISSION_DENIED";

/**
 * What `carrier` gets when `owner.box.secret` is found in what it hands `friend`: handing it is checked as `carrier`'s
 * call of the node, and refused.
 * @type {string}
 */
const FOUND = "!PERMISSION_DENIED";

/**
 * What `carrier` gets when `owner.box.secret` is nested past the search: it is not found, the call is not checked as
 * `carrier`'s call of the node, and `friend` (which the rules allow the node) runs it.
 * @type {string}
 */
const NOT_FOUND = "secret:x";

/**
 * The global `owner.box.share` puts its own `secret` in, outside slothlet, for `carrier` to read.
 * @type {string}
 */
const SHARED = "__slothletSearchLimitsSecret";

/**
 * Have `carrier` hand `friend` the node's own function nested `levels` objects deep.
 * @param {object} instance - The api.
 * @param {number} levels - How deep.
 * @returns {Promise<string>} What `carrier` gets.
 */
async function handDeep(instance, levels) {
	await instance.owner.box.share(SHARED);
	return instance.carrier.deep(SHARED, levels);
}

/**
 * Have `carrier` hand `friend` the node's own function beside `filler` other properties.
 * @param {object} instance - The api.
 * @param {number} filler - How many other properties.
 * @returns {Promise<string>} What `carrier` gets.
 */
async function handWide(instance, filler) {
	await instance.owner.box.share(SHARED);
	return instance.carrier.wide(SHARED, filler);
}

/**
 * Build an instance with every fixture module mounted.
 * @param {object} config - The matrix config.
 * @param {object} [permissions] - The permissions config.
 * @returns {Promise<object>} The api.
 */
async function build(config, permissions = DENY_BOTH) {
	const api = await slothlet({ ...config, base: path.join(ROOT, "base"), silent: true, permissions });
	for (const name of ["cyc", "reader", "friend", "bag", "owner", "carrier", "maker"])
		await api.slothlet.api.add(name, path.join(ROOT, name), { id: name });
	await api.cyc.fnmod;
	await api.owner.box.secret;
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

	it("by default deeply frozen data four levels deep leaves the call unmarked, and five levels marks it", async () => {
		api = await build(config);
		expect(await api.reader.deep(1)).toBe(UNMARKED);
		expect(await api.reader.deep(4)).toBe(UNMARKED);
		expect(await api.reader.deep(5)).toBe(MARKED);
	});

	it("a raised depth leaves six levels unmarked and marks seven, leaving properties at their default", async () => {
		api = await build(config, { ...DENY_BOTH, search: { depth: 6 } });
		expect(await api.reader.deep(5)).toBe(UNMARKED);
		expect(await api.reader.deep(6)).toBe(UNMARKED);
		expect(await api.reader.deep(7)).toBe(MARKED);
		expect(await api.reader.wide(512)).toBe(UNMARKED);
		expect(await api.reader.wide(513)).toBe(MARKED);
	});

	it("a lowered depth leaves one level unmarked and marks two", async () => {
		api = await build(config, { ...DENY_BOTH, search: { depth: 1 } });
		expect(await api.reader.deep(1)).toBe(UNMARKED);
		expect(await api.reader.deep(2)).toBe(MARKED);
	});

	it("by default 512 properties leave the call unmarked and 513 mark it", async () => {
		api = await build(config);
		expect(await api.reader.wide(10)).toBe(UNMARKED);
		expect(await api.reader.wide(512)).toBe(UNMARKED);
		expect(await api.reader.wide(513)).toBe(MARKED);
	});

	it("raised properties leave 1024 unmarked and mark 1025, leaving depth at its default", async () => {
		api = await build(config, { ...DENY_BOTH, search: { properties: 1024 } });
		expect(await api.reader.wide(1024)).toBe(UNMARKED);
		expect(await api.reader.wide(1025)).toBe(MARKED);
		expect(await api.reader.deep(4)).toBe(UNMARKED);
		expect(await api.reader.deep(5)).toBe(MARKED);
	});

	it("lowered properties leave 8 unmarked and mark 9", async () => {
		api = await build(config, { ...DENY_BOTH, search: { properties: 8 } });
		expect(await api.reader.wide(8)).toBe(UNMARKED);
		expect(await api.reader.wide(9)).toBe(MARKED);
	});

	it("by default finds a node's function four levels deep in an argument and not five", async () => {
		api = await build(config);
		expect(await handDeep(api, 0)).toBe(FOUND);
		expect(await handDeep(api, 1)).toBe(FOUND);
		expect(await handDeep(api, 4)).toBe(FOUND);
		expect(await handDeep(api, 5)).toBe(NOT_FOUND);
	});

	it("a raised depth finds a node's function six levels deep and not seven, leaving properties at their default", async () => {
		api = await build(config, { ...DENY_BOTH, search: { depth: 6 } });
		expect(await handDeep(api, 6)).toBe(FOUND);
		expect(await handDeep(api, 7)).toBe(NOT_FOUND);
		expect(await handWide(api, 511)).toBe(FOUND);
		expect(await handWide(api, 512)).toBe(NOT_FOUND);
	});

	it("a lowered depth finds a node's function one level deep and not two", async () => {
		api = await build(config, { ...DENY_BOTH, search: { depth: 1 } });
		expect(await handDeep(api, 1)).toBe(FOUND);
		expect(await handDeep(api, 2)).toBe(NOT_FOUND);
	});

	it("by default finds a node's function among 512 properties and not past them", async () => {
		api = await build(config);
		expect(await handWide(api, 10)).toBe(FOUND);
		expect(await handWide(api, 511)).toBe(FOUND);
		expect(await handWide(api, 512)).toBe(NOT_FOUND);
	});

	it("raised properties find a node's function among 1024 and not past them, leaving depth at its default", async () => {
		api = await build(config, { ...DENY_BOTH, search: { properties: 1024 } });
		expect(await handWide(api, 1023)).toBe(FOUND);
		expect(await handWide(api, 1024)).toBe(NOT_FOUND);
		expect(await handDeep(api, 4)).toBe(FOUND);
		expect(await handDeep(api, 5)).toBe(NOT_FOUND);
	});

	it("lowered properties find a node's function among 8 and not past them", async () => {
		api = await build(config, { ...DENY_BOTH, search: { properties: 8 } });
		expect(await handWide(api, 7)).toBe(FOUND);
		expect(await handWide(api, 8)).toBe(NOT_FOUND);
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
		other = await build(config, { ...DENY_BOTH, search: { depth: 6 } });
		expect(await api.reader.deep(5)).toBe(MARKED);
		expect(await other.reader.deep(5)).toBe(UNMARKED);
		expect(await other.reader.deep(7)).toBe(MARKED);
		expect(await api.reader.deep(5)).toBe(MARKED);
		expect(await handDeep(api, 5)).toBe(NOT_FOUND);
		expect(await handDeep(other, 5)).toBe(FOUND);
		expect(await handDeep(other, 7)).toBe(NOT_FOUND);
	});

	it("an api.add cannot change the instance's limit", async () => {
		api = await build(config);
		await expect(
			api.slothlet.api.add("extra", path.join(ROOT, "friend"), { id: "extra", permissions: { search: { depth: 6 } } })
		).rejects.toMatchObject({ code: "INVALID_CONFIG_UNKNOWN_KEY" });
		expect(await api.reader.deep(4)).toBe(UNMARKED);
		expect(await api.reader.deep(5)).toBe(MARKED);
		expect(await handDeep(api, 4)).toBe(FOUND);
		expect(await handDeep(api, 5)).toBe(NOT_FOUND);
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
