/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-leaf-function-reached-any-way.test.vitest.mjs
 *	@Date: 2026-11-23T07:47:18-08:00 (1795448838)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-23T08:14:39-08:00 (1795450479)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A node's rules decide a call of its leaf's own function however that function is reached.
 *
 * @description
 * `cyc.fnmod` is a node built from `cyc/fnmod.mjs`. Another module (`carrier`) imports that file itself and hands the
 * function it holds to other modules: returned as it is, inside a returned object, after an `await`, and as the
 * argument of a call into the reader (`self.reader.run(fnmod)`). Each of those is the node's function, so calling it is a call of
 * `cyc.fnmod`: a rule denying the reader `cyc.fnmod` refuses it as it refuses `self.cyc.fnmod()`, a module the rules
 * allow still calls it, and the host, which no rule matches, calls it as before. The same holds for a CommonJS leaf
 * (`cjs/fnmod.cjs`, required by `carrier/cjs.cjs`).
 *
 * Fixtures (written to tmp/): `base/root.mjs`, `cyc/fnmod.mjs` + `cyc/dn.mjs`, `cjs/fnmod.cjs` + `cjs/dn.cjs`,
 * `carrier/esm.mjs` + `carrier/cjs.cjs` (hand the function out), `reader/reader.mjs` and `friend/friend.mjs`
 * (call what they are handed; the rules deny `reader` and leave `friend` alone).
 * @module tests/vitests/suites/permissions/permissions-leaf-function-reached-any-way
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const ROOT = path.join(process.cwd(), "tmp", "permissions-leaf-function-reached-any-way");

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

/**
 * The source of a module that calls, through `self`, every route `carrier` hands the function out by, and takes a
 * function to call (`run`), which `carrier` passes the function to.
 * @param {string} name - The module's own name.
 * @returns {string[]} The file's lines.
 */
function callerSource(name) {
	return [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function run(fn) {",
		'\treturn fn("x");',
		"}",
		"const at = async (step) => {",
		"\ttry {",
		"\t\treturn await step();",
		"\t} catch (error) {",
		'\t\treturn "!" + (error?.code ?? error?.name);',
		"\t}",
		"};",
		"export async function calls() {",
		"\treturn {",
		'\t\tnode: await at(() => self.cyc.fnmod("x")),',
		'\t\treturned: await at(async () => (await self.carrier.esm.give())("x")),',
		'\t\tboxed: await at(async () => (await self.carrier.esm.boxed()).fn("x")),',
		'\t\tlater: await at(async () => (await self.carrier.esm.later())("x")),',
		`\t\tcallback: await at(async () => await self.carrier.esm.handTo(${JSON.stringify(name)})),`,
		'\t\tcjs: await at(async () => (await self.carrier.cjs.give())("x"))',
		"\t};",
		"}"
	];
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("base/root.mjs", ["export function ping() {", '\treturn "pong";', "}"]);
	write("cyc/fnmod.mjs", ["export default function fnmod(x) {", '\treturn "fn:" + x;', "}"]);
	write("cyc/dn.mjs", ["export default function dn(x) {", '\treturn "dn:" + x;', "}"]);
	write("cjs/fnmod.cjs", ["module.exports = function fnmod(x) {", '\treturn "cjs:" + x;', "};"]);
	write("cjs/dn.cjs", ["module.exports = function dn(x) {", '\treturn "dn:" + x;', "};"]);
	write("carrier/esm.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		'import fnmod from "../cyc/fnmod.mjs";',
		"export function give() {",
		"\treturn fnmod;",
		"}",
		"export function boxed() {",
		"\treturn { fn: fnmod };",
		"}",
		"export async function later() {",
		"\tawait null;",
		"\treturn fnmod;",
		"}",
		"export function withCallback(callback) {",
		"\treturn callback(fnmod);",
		"}",
		"export function handTo(name) {",
		"\treturn self[name].run(fnmod);",
		"}",
		"export function same(fn) {",
		"\treturn fn === fnmod;",
		"}"
	]);
	write("carrier/cjs.cjs", ['const fnmod = require("../cjs/fnmod.cjs");', "exports.give = function give() {", "\treturn fnmod;", "};"]);
	write("reader/reader.mjs", callerSource("reader"));
	write("friend/friend.mjs", callerSource("friend"));
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Build an instance with every fixture module mounted.
 * @param {object} config - The matrix config.
 * @param {object} [permissions] - The permissions config.
 * @returns {Promise<object>} The api.
 */
async function build(config, permissions) {
	const api = await slothlet({ ...config, base: path.join(ROOT, "base"), silent: true, ...(permissions ? { permissions } : {}) });
	for (const name of ["cyc", "cjs", "carrier", "reader", "friend"]) await api.slothlet.api.add(name, path.join(ROOT, name), { id: name });
	await api.cyc.fnmod;
	await api.cjs.fnmod;
	return api;
}

const DENY_READER = {
	policy: "allow",
	rules: [
		{ caller: "reader.**", target: "cyc.fnmod", effect: "deny" },
		{ caller: "reader.**", target: "cjs.fnmod", effect: "deny" }
	]
};

const ALL_CALLED = { node: "fn:x", returned: "fn:x", boxed: "fn:x", later: "fn:x", callback: "fn:x", cjs: "cjs:x" };

describe.each(getMatrixConfigs())("Permissions > a leaf's function reached any way > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it("a deny on the node refuses the node's function however the caller was handed it", async () => {
		api = await build(config, DENY_READER);
		expect(await api.reader.calls()).toEqual({
			node: "!PERMISSION_DENIED",
			returned: "!PERMISSION_DENIED",
			boxed: "!PERMISSION_DENIED",
			later: "!PERMISSION_DENIED",
			callback: "!PERMISSION_DENIED",
			cjs: "!PERMISSION_DENIED"
		});
	});

	it("a module the rules leave alone calls the node's function by every route", async () => {
		api = await build(config, DENY_READER);
		expect(await api.friend.calls()).toEqual(ALL_CALLED);
	});

	it("the host, which no rule matches, calls the function a module hands it", async () => {
		api = await build(config, DENY_READER);
		expect((await api.carrier.esm.give())("x")).toBe("fn:x");
		expect((await api.carrier.esm.boxed()).fn("x")).toBe("fn:x");
		expect((await api.carrier.esm.later())("x")).toBe("fn:x");
		expect(await api.carrier.esm.withCallback((fn) => fn("x"))).toBe("fn:x");
		expect((await api.carrier.cjs.give())("x")).toBe("cjs:x");
	});

	it("the module that imports the file still holds the function itself", async () => {
		api = await build(config, DENY_READER);
		expect(await api.carrier.esm.same(await api.carrier.esm.give())).toBe(true);
	});

	it("with no rules every module calls the node's function by every route", async () => {
		api = await build(config, { policy: "allow" });
		expect(await api.reader.calls()).toEqual(ALL_CALLED);
	});

	it("with permissions off or disabled nothing is refused", async () => {
		for (const mode of ["off", "disabled"]) {
			api = await build(config, { mode, rules: DENY_READER.rules });
			expect(await api.reader.calls()).toEqual(ALL_CALLED);
			await api.shutdown();
			api = null;
		}
	});
});
