/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-caller-evidence.test.vitest.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Live runtime: which suspended call a stack belongs to is read from the code that is
 * running, not from where a helper it calls happens to live (#601 review).
 *
 * The running code is the outermost synchronous frame of the job — the callback or resumed function the
 * job started in; frames inside it are helpers it called. Module code belongs to the suspended calls whose
 * leaves import it. So a module calling another module's helper stays itself, a callback of a module with
 * nothing suspended is refused rather than run as some other module's call, and a helper a suspended call
 * imports is that call's wherever it lives.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "context-live-caller-evidence");
const API = path.join(ROOT, "api");
const PROBE = path.join(ROOT, "native-probe.mjs");

const RULES = {
	defaultPolicy: "allow",
	rules: ["rogue", "adminExt", "relay"].map((module) => ({ caller: `${module}.**`, target: "c.**", effect: "deny" }))
};

/**
 * Write a fixture file, creating its folder.
 * @param {string} file - Path below the fixture root.
 * @param {string[]} lines - File contents, one line each.
 * @returns {void}
 */
function write(file, lines) {
	const target = path.join(ROOT, file);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, lines.join("\n") + "\n");
}

// A function that calls the guarded module from a callback slothlet does not patch.
const VIA_UNPATCHED = [
	"export function viaUnpatched(done) {",
	'\tstat(".", () => {',
	"\t\ttry {",
	"\t\t\tdone(self.c.probe());",
	"\t\t} catch (error) {",
	"\t\t\tdone(error.code ?? error.message);",
	"\t\t}",
	"\t});",
	"}"
];
const IMPORTS = ['import { self } from "@cldmv/slothlet/runtime";', 'import { stat } from "node:fs";'];

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("api/c/c.mjs", ["export function probe() {", '\treturn "reached";', "}"]);
	// A module the rules allow, whose call the tests hold suspended, and a helper of its folder.
	write("api/admin/admin.mjs", ["export async function hold(gate) {", "\tawait gate;", '\treturn "held";', "}"]);
	write("api/admin/helper.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function probeC() {",
		"\treturn self.c.probe();",
		"}"
	]);
	// A module the rules deny, which imports admin's helper.
	write("api/rogue/rogue.mjs", [
		...IMPORTS,
		'import { probeC } from "../admin/helper.mjs";',
		"export async function steal(gate) {",
		"\tawait gate;",
		"\treturn probeC();",
		"}",
		"export function stealVia(done) {",
		'\tstat(".", () => {',
		"\t\ttry {",
		"\t\t\tdone(probeC());",
		"\t\t} catch (error) {",
		"\t\t\tdone(error.code ?? error.message);",
		"\t\t}",
		"\t});",
		"}"
	]);
	// A denied module whose folder name starts like admin's: its own namespace, adminExt.
	write("api/admin.ext/ext.mjs", [...IMPORTS, ...VIA_UNPATCHED]);
	// A denied module whose code lives outside the base.
	write("api/relay/relay.mjs", ['export { viaUnpatched } from "../../outside/impl.mjs";']);
	write("outside/impl.mjs", [...IMPORTS, ...VIA_UNPATCHED]);
	// An allowed module handing back the promise of a helper in another top-level folder of the base.
	write("api/tools/tools.mjs", [
		'import { later } from "../__lib/util.mjs";',
		'import { later2 } from "../lib2/util.mjs";',
		"export function run(gate) {",
		"\treturn later(gate);",
		"}",
		"export function run2(gate) {",
		"\treturn later2(gate);",
		"}"
	]);
	write("api/__lib/util.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export async function later(gate) {",
		"\tawait gate;",
		"\treturn self.c.probe();",
		"}"
	]);
	write("api/lib2/util.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export async function later2(gate) {",
		"\tawait gate;",
		"\treturn self.c.probe();",
		"}"
	]);
	// The same cases in a real Node process: Node's own resolver with slothlet's resolve hook, not vite's graph.
	write("native-probe.mjs", [
		'import slothlet from "@cldmv/slothlet";',
		`const RULES = ${JSON.stringify(RULES)};`,
		'const base = new URL("./api/", import.meta.url).pathname;',
		"const out = {};",
		'for (const mode of ["eager", "lazy"]) {',
		'\tconst api = await slothlet({ base, mode, runtime: "live", silent: true, permissions: RULES });',
		'\tfor (const module of ["admin", "rogue", "adminExt", "relay", "tools", "c"]) await api[module];',
		"\tconst turn = () => new Promise((resolve) => setTimeout(resolve, 0));",
		"\tconst settle = (promise) => promise.then((value) => value, (error) => error.code ?? error.message);",
		"\tconst whileAdminSuspended = async (fn) => {",
		"\t\tlet release;",
		"\t\tconst admin = api.admin.hold(new Promise((resolve) => (release = resolve)));",
		"\t\tawait turn();",
		"\t\tconst result = await settle(fn());",
		"\t\trelease();",
		"\t\tawait admin;",
		"\t\treturn result;",
		"\t};",
		"\tconst gated = async (call) => {",
		"\t\tlet release;",
		"\t\tconst pending = settle(call(new Promise((resolve) => (release = resolve))));",
		"\t\tawait turn();",
		"\t\trelease();",
		"\t\treturn pending;",
		"\t};",
		"\tout[mode] = {",
		"\t\tsteal: await whileAdminSuspended(() => gated((gate) => api.rogue.steal(gate))),",
		"\t\tstealVia: await whileAdminSuspended(() => new Promise((resolve) => api.rogue.stealVia(resolve))),",
		"\t\tdotted: await whileAdminSuspended(() => new Promise((resolve) => api.adminExt.ext.viaUnpatched(resolve))),",
		"\t\toutside: await whileAdminSuspended(() => new Promise((resolve) => api.relay.viaUnpatched(resolve))),",
		"\t\trun: await gated((gate) => api.tools.run(gate)),",
		"\t\trun2: await gated((gate) => api.tools.run2(gate))",
		"\t};",
		"\tawait api.shutdown();",
		"}",
		"console.log(JSON.stringify(out));"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe.each([{ mode: "eager" }, { mode: "lazy" }])("Live runtime: the running code decides the caller ($mode)", ({ mode }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	/**
	 * Boot the fixture with every module materialized.
	 * @returns {Promise<object>} The api.
	 */
	async function boot() {
		api = await slothlet({ base: API, mode, runtime: "live", silent: true, permissions: RULES });
		for (const module of ["admin", "rogue", "adminExt", "relay", "tools", "c"]) await api[module];
		return api;
	}

	/**
	 * Run `fn` while admin's call is suspended, then let admin's call finish.
	 * @param {function(): Promise<*>} fn - What to run.
	 * @returns {Promise<*>} What it gave, or the code of the error it threw.
	 */
	async function whileAdminSuspended(fn) {
		let release;
		const admin = api.admin.hold(new Promise((resolve) => (release = resolve)));
		await new Promise((resolve) => setTimeout(resolve, 0));
		try {
			return await fn();
		} catch (error) {
			return error.code ?? error.message;
		} finally {
			release();
			expect(await admin).toBe("held");
		}
	}

	it("a module calling another module's helper after an await is still itself", async () => {
		await boot();
		let release;
		const gate = new Promise((resolve) => (release = resolve));
		const outcome = whileAdminSuspended(() => api.rogue.steal(gate));
		await new Promise((resolve) => setTimeout(resolve, 0));
		release();
		expect(await outcome).toBe("PERMISSION_DENIED");
	});

	it("a module calling another module's helper from an unpatched callback is not run as that module", async () => {
		await boot();
		const outcome = await whileAdminSuspended(() => new Promise((resolve) => api.rogue.stealVia(resolve)));
		expect(outcome).not.toBe("reached");
	});

	it("a module whose folder name starts like another's is not taken for it", async () => {
		await boot();
		const outcome = await whileAdminSuspended(() => new Promise((resolve) => api.adminExt.ext.viaUnpatched(resolve)));
		expect(outcome).not.toBe("reached");
	});

	it("a module whose code lives outside the base is not run as another module's suspended call", async () => {
		await boot();
		const outcome = await whileAdminSuspended(() => new Promise((resolve) => api.relay.viaUnpatched(resolve)));
		expect(outcome).not.toBe("reached");
	});

	it.each([
		["a hidden helper folder", "run"],
		["another top-level folder of the base", "run2"]
	])("a call handing back the promise of a helper in %s keeps its identity", async (_label, fn) => {
		await boot();
		let release;
		const pending = api.tools[fn](new Promise((resolve) => (release = resolve)));
		await new Promise((resolve) => setTimeout(resolve, 0));
		release();
		expect(await pending).toBe("reached");
	});
});

// Inside vitest the leaves load through vite's module graph, which the vite plugin records. A real Node
// process records the graph through slothlet's resolve hook instead.
describe("Live runtime: the running code decides the caller (native Node resolver)", () => {
	it("gives every case the same answer as under vite", () => {
		const result = spawnSync(process.execPath, [PROBE], { cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 120000 });
		expect(result.status, result.stderr).toBe(0);
		const out = JSON.parse(result.stdout.trim().split("\n").pop());
		for (const mode of ["eager", "lazy"]) {
			const { steal, stealVia, dotted, outside, run, run2 } = out[mode];
			expect({ mode, steal, run, run2 }).toEqual({ mode, steal: "PERMISSION_DENIED", run: "reached", run2: "reached" });
			for (const refused of [stealVia, dotted, outside]) expect(refused).not.toBe("reached");
		}
	});
});
