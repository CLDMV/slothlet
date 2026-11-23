/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-leaf-copy-lazy-and-async.test.vitest.mjs
 *	@Date: 2026-11-23T14:25:11-08:00 (1795472711)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-23T14:44:12-08:00 (1795473852)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A copy of a leaf's function is a call of its node before the node is built, and when the copy's module
 * graph has a top-level await.
 *
 * @description
 * `carrier` imports two leaf files itself and hands the functions it holds to other modules:
 * - `cyc/deep/inner.mjs`, the file of `cyc.deep.inner`, a node of a folder a lazy tree builds only when something reaches
 *   it. Nothing reaches `cyc.deep` through `self` before the copy is called.
 * - `tla/slow.mjs`, the file of `tla.slow`, whose module awaits at its top level. Under Node's own loader a namespace of
 *   such a module cannot be read synchronously.
 *
 * A rule denying `reader` both nodes refuses the copies as it refuses the nodes, by every route (returned, passed into the
 * reader's call), while `friend`, which no rule matches, calls them as before. `cyc.far`, a folder no module imported a file
 * of, stays unbuilt in a lazy tree. The same runs under Node's own loader in a child process (vitest's module runner loads
 * the files otherwise).
 *
 * Fixtures (written to tmp/): `base/root.mjs`, `cyc/dn.mjs`, `cyc/deep/inner.mjs` + `cyc/deep/other.mjs`,
 * `cyc/far/far.mjs` + `cyc/far/near.mjs`, `tla/slow.mjs` + `tla/quick.mjs`, `carrier/esm.mjs`, `reader/reader.mjs`,
 * `friend/friend.mjs`, and `probe.mjs` (the child process).
 * @module tests/vitests/suites/permissions/permissions-leaf-copy-lazy-and-async
 */

import path from "node:path";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const ROOT = path.join(process.cwd(), "tmp", "permissions-leaf-copy-lazy-and-async");

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
 * The source of a module that calls each copy `carrier` hands out, and takes a function to call (`run`), which
 * `carrier` passes the copy of `cyc/deep/inner.mjs` to. It never reads `self.cyc`.
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
		'\t\tdeep: await at(async () => (await self.carrier.esm.give())("x")),',
		'\t\tboxed: await at(async () => (await self.carrier.esm.boxed()).fn("x")),',
		`\t\tcallback: await at(async () => await self.carrier.esm.handTo(${JSON.stringify(name)})),`,
		'\t\tslow: await at(async () => (await self.carrier.esm.giveSlow())("x"))',
		"\t};",
		"}"
	];
}

/** The rules: `reader` may not call either node. */
const DENY_READER = {
	policy: "allow",
	rules: [
		{ caller: "reader.**", target: "cyc.deep.inner", effect: "deny" },
		{ caller: "reader.**", target: "tla.slow", effect: "deny" }
	]
};

/** What each route gives when the call is made. */
const ALL_CALLED = { deep: "inner:x", boxed: "inner:x", callback: "inner:x", slow: "slow:x" };

/** What each route gives when the call is refused. */
const ALL_REFUSED = { deep: "!PERMISSION_DENIED", boxed: "!PERMISSION_DENIED", callback: "!PERMISSION_DENIED", slow: "!PERMISSION_DENIED" };

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("base/root.mjs", ["export function ping() {", '\treturn "pong";', "}"]);
	write("cyc/dn.mjs", ["export default function dn(x) {", '\treturn "dn:" + x;', "}"]);
	write("cyc/deep/inner.mjs", ["export default function inner(x) {", '\treturn "inner:" + x;', "}"]);
	write("cyc/deep/other.mjs", ["export default function other(x) {", '\treturn "other:" + x;', "}"]);
	write("cyc/far/far.mjs", [
		"globalThis.__leafCopyFarLoads = (globalThis.__leafCopyFarLoads ?? 0) + 1;",
		"export default function far(x) {",
		'\treturn "far:" + x;',
		"}"
	]);
	write("cyc/far/near.mjs", ["export default function near(x) {", '\treturn "near:" + x;', "}"]);
	write("tla/slow.mjs", [
		"await new Promise((resolve) => setTimeout(resolve, 5));",
		"export default function slow(x) {",
		'\treturn "slow:" + x;',
		"}"
	]);
	write("tla/quick.mjs", ["export default function quick(x) {", '\treturn "quick:" + x;', "}"]);
	write("carrier/esm.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		'import inner from "../cyc/deep/inner.mjs";',
		'import slow from "../tla/slow.mjs";',
		"export function give() {",
		"\treturn inner;",
		"}",
		"export function boxed() {",
		"\treturn { fn: inner };",
		"}",
		"export function giveSlow() {",
		"\treturn slow;",
		"}",
		"export function handTo(name) {",
		"\treturn self[name].run(inner);",
		"}",
		"export function same(fn) {",
		"\treturn fn === inner;",
		"}"
	]);
	write("reader/reader.mjs", callerSource("reader"));
	write("friend/friend.mjs", callerSource("friend"));
	write("probe.mjs", [
		'import path from "node:path";',
		'import { fileURLToPath } from "node:url";',
		'const { default: slothlet } = await import("@cldmv/slothlet");',
		"const here = path.dirname(fileURLToPath(import.meta.url));",
		`const rules = ${JSON.stringify(DENY_READER)};`,
		"const out = {};",
		'for (const mode of ["eager", "lazy"])',
		'\tfor (const runtime of ["async", "live"]) {',
		"\t\tconst farBefore = globalThis.__leafCopyFarLoads ?? 0;",
		'\t\tconst api = await slothlet({ base: path.join(here, "base"), mode, runtime, silent: true, permissions: rules });',
		'\t\tfor (const name of ["cyc", "tla", "carrier", "reader", "friend"]) await api.slothlet.api.add(name, path.join(here, name), { id: name });',
		"\t\tout[`${mode}/${runtime}/reader`] = await api.reader.calls();",
		"\t\tout[`${mode}/${runtime}/friend`] = await api.friend.calls();",
		'\t\tout[`${mode}/${runtime}/host`] = (await api.carrier.esm.give())("x") + "," + (await api.carrier.esm.giveSlow())("x");',
		"\t\tout[`${mode}/${runtime}/same`] = await api.carrier.esm.same(await api.carrier.esm.give());",
		'\t\tawait api.cyc.deep.other("x");',
		"\t\tout[`${mode}/${runtime}/far`] = (globalThis.__leafCopyFarLoads ?? 0) - farBefore;",
		"\t\tawait api.shutdown();",
		"\t}",
		"console.log(JSON.stringify(out));"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Build an instance with every fixture module mounted, building no node of `cyc.deep`.
 * @param {object} config - The matrix config.
 * @param {object} [permissions] - The permissions config.
 * @returns {Promise<object>} The api.
 */
async function build(config, permissions) {
	const api = await slothlet({ ...config, base: path.join(ROOT, "base"), silent: true, ...(permissions ? { permissions } : {}) });
	for (const name of ["cyc", "tla", "carrier", "reader", "friend"]) await api.slothlet.api.add(name, path.join(ROOT, name), { id: name });
	return api;
}

describe.each(getMatrixConfigs())(
	"Permissions > a leaf's copy, before its node is built and under a top-level await > $name",
	({ config }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		it("a deny on the node refuses its copy however the caller was handed it", async () => {
			api = await build(config, DENY_READER);
			expect(await api.reader.calls()).toEqual(ALL_REFUSED);
		});

		it("a module the rules leave alone calls the copy by every route", async () => {
			api = await build(config, DENY_READER);
			expect(await api.friend.calls()).toEqual(ALL_CALLED);
		});

		it("the host calls the copy a module hands it, and the importer still holds the function itself", async () => {
			api = await build(config, DENY_READER);
			expect((await api.carrier.esm.give())("x")).toBe("inner:x");
			expect((await api.carrier.esm.giveSlow())("x")).toBe("slow:x");
			expect(await api.carrier.esm.same(await api.carrier.esm.give())).toBe(true);
		});

		it("builds no folder no module imported a file of", async () => {
			const before = globalThis.__leafCopyFarLoads ?? 0;
			api = await build(config, DENY_READER);
			await api.reader.calls();
			expect(await api.cyc.deep.other("x")).toBe("other:x");
			// `cyc/far/far.mjs` counts its loads: a lazy tree loads it only once something reaches `cyc.far`.
			const loads = (globalThis.__leafCopyFarLoads ?? 0) - before;
			if (config.mode === "lazy") expect(loads).toBe(0);
			else expect(loads).toBe(1);
		});

		it("with permissions off nothing is refused", async () => {
			api = await build(config, { mode: "off", rules: DENY_READER.rules });
			expect(await api.reader.calls()).toEqual(ALL_CALLED);
		});
	}
);

/**
 * The export conditions this worker runs under, so the child loads the same build of slothlet.
 * @returns {string[]} The conditions, as `--conditions=x` arguments.
 */
function probeConditions() {
	const conditions = [];
	process.execArgv.forEach((arg, index, all) => {
		if (arg.startsWith("--conditions=")) conditions.push(arg);
		else if ((arg === "--conditions" || arg === "-C") && all[index + 1]) conditions.push(`--conditions=${all[index + 1]}`);
	});
	return conditions;
}

describe("Permissions > a leaf's copy, before its node is built and under a top-level await > Node's own loader", () => {
	let result;
	let out = {};

	beforeAll(() => {
		result = spawnSync(process.execPath, [...probeConditions(), path.join(ROOT, "probe.mjs")], { encoding: "utf8", timeout: 120000 });
		out = result.status === 0 ? JSON.parse(result.stdout) : {};
	});

	it("runs the probe cleanly", () => {
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
	});

	it.each(["eager/async", "eager/live", "lazy/async", "lazy/live"])(
		"refuses the reader and lets the friend and host call — %s",
		(config) => {
			expect(out[`${config}/reader`]).toEqual(ALL_REFUSED);
			expect(out[`${config}/friend`]).toEqual(ALL_CALLED);
			expect(out[`${config}/host`]).toBe("inner:x,slow:x");
			expect(out[`${config}/same`]).toBe(true);
			expect(out[`${config}/far`]).toBe(config.startsWith("lazy") ? 0 : 1);
		}
	);
});
