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
import { self } from "@cldmv/slothlet/runtime";

globalThis[Symbol.for("slothlet.test.evidenceSelf")] = self;

const ROOT = path.join(process.cwd(), "tmp", "context-live-caller-evidence");
const API = path.join(ROOT, "api");
const PROBE = path.join(ROOT, "native-probe.mjs");

const RULES = {
	defaultPolicy: "allow",
	rules: ["rogue", "adminExt", "relay", "rcjs", "relayPkg"].map((module) => ({ caller: `${module}.**`, target: "c.**", effect: "deny" }))
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
	write("api/admin/admin.mjs", [
		'import { callWith } from "../__lib/call.mjs";',
		"export async function hold(gate) {",
		"\tawait gate;",
		'\treturn callWith(() => "held");',
		"}",
		"export function apply(fn) {",
		"\treturn fn();",
		"}",
		"// An entry that runs a callback it is given, then stays suspended.",
		"export async function transact(fn, gate) {",
		"\tconst result = fn();",
		"\tawait gate;",
		"\treturn result;",
		"}",
		"export const exposedTools = {",
		"\ttransact(fn) {",
		"\t\treturn fn();",
		"\t}",
		"};"
	]);
	write("api/__lib/call.mjs", ["export function callWith(fn) {", "\treturn fn();", "}"]);
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
		'import { callWith } from "../__lib/call.mjs";',
		'import { apply, transact, exposedTools } from "../admin/admin.mjs";',
		"// Its callback, run by admin's suspended entry function, or a same-named method of admin's file, called raw.",
		"export function viaEntry(done) {",
		'\tstat(".", transact.bind(null, () => attempt(done), Promise.resolve()));',
		"}",
		"export function viaMethod(done) {",
		'\tstat(".", exposedTools.transact.bind(exposedTools, () => attempt(done)));',
		"}",
		"// Its own callback, run by a function of admin's that it hands to a boundary slothlet does not patch.",
		"export function viaLent(done) {",
		'\tstat(".", callWith.bind(null, () => attempt(done)));',
		"}",
		"export function viaLeaf(done) {",
		'\tstat(".", apply.bind(null, () => attempt(done)));',
		"}",
		"function attempt(done) {",
		"\ttry {",
		"\t\tdone(self.c.probe());",
		"\t} catch (error) {",
		"\t\tdone(error.code ?? error.message);",
		"\t}",
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
	// A denied CommonJS leaf calling the guarded module from an unpatched callback.
	write("api/rcjs/rcjs.cjs", [
		"let runtime;",
		'import("@cldmv/slothlet/runtime").then((module) => (runtime = module));',
		'const { stat } = require("node:fs");',
		"exports.own = function own(done) {",
		'\tstat(".", () => {',
		"\t\ttry {",
		"\t\t\tdone(runtime.self.c.probe());",
		"\t\t} catch (error) {",
		"\t\t\tdone(error.code ?? error.message);",
		"\t\t}",
		"\t});",
		"};"
	]);
	// An allowed module handing back the promise of a helper it loaded with a dynamic import().
	write("api/dyn/dyn.mjs", [
		"let helper;",
		"export async function load() {",
		'\thelper = await import("../__lib/dyn.mjs");',
		"}",
		"export function run(gate) {",
		"\treturn helper.later(gate);",
		"}"
	]);
	write("api/__lib/dyn.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export async function later(gate) {",
		"\tawait gate;",
		"\treturn self.c.probe();",
		"}"
	]);
	// A CommonJS leaf whose CommonJS helper resumes after an await: one file for every instance of the folder.
	write("api/t6/t6.cjs", [
		'const { later } = require("../__lib/cutil.cjs");',
		"exports.run = function run(gate) {",
		"\treturn later(gate);",
		"};"
	]);
	write("api/__lib/cutil.cjs", [
		"exports.later = async function later(gate) {",
		'\tconst { self } = await import("@cldmv/slothlet/runtime");',
		"\tawait gate;",
		"\treturn self.c.probe();",
		"};"
	]);
	// A denied module re-exporting a package that runs its callback through its own, untagged copy of admin's leaf.
	write("api/relayPkg/relayPkg.mjs", ['export { viaPkg } from "evil-pkg";']);
	write("node_modules/evil-pkg/package.json", ['{ "name": "evil-pkg", "type": "module", "exports": "./index.mjs" }']);
	// The package cannot resolve slothlet from here; the runtime's `self` is handed to it through a global.
	write("node_modules/evil-pkg/index.mjs", [
		'const self = globalThis[Symbol.for("slothlet.test.evidenceSelf")];',
		'import { stat } from "node:fs";',
		'import { apply } from "../../api/admin/admin.mjs";',
		"export function viaPkg(done) {",
		'\tstat(".", apply.bind(null, () => {',
		"\t\ttry {",
		"\t\t\tdone(self.c.probe());",
		"\t\t} catch (error) {",
		"\t\t\tdone(error.code ?? error.message);",
		"\t\t}",
		"\t}));",
		"}"
	]);
	// A registry whose resumed call runs the handlers other modules gave it, and a factory whose function the
	// caller runs after an await: the code runs as the resumed call, as on the async runtime.
	write("api/registry/registry.mjs", [
		"const handlers = [];",
		"export function register(handler) {",
		"\thandlers.push(handler);",
		"}",
		"export async function fire(gate) {",
		"\tawait gate;",
		"\treturn handlers.map((handler) => handler());",
		"}"
	]);
	write("api/plugin/plugin.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function install() {",
		"\tself.registry.register(function handler() {",
		"\t\ttry {",
		"\t\t\treturn self.c.probe();",
		"\t\t} catch (error) {",
		"\t\t\treturn error.code ?? error.message;",
		"\t\t}",
		"\t});",
		"}"
	]);
	write("api/maker/maker.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function give() {",
		"\treturn function given() {",
		"\t\treturn self.c.probe();",
		"\t};",
		"}"
	]);
	write("api/user/user.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export async function use(gate) {",
		"\tconst given = await self.maker.give();",
		"\tawait gate;",
		"\treturn given();",
		"}"
	]);
	// Helpers reached through a package's own `#imports` and its self-reference: shared copies, untagged on
	// purpose. A package of its own, so the helper takes the runtime's `self` from the global the package uses.
	write("pkgapp/package.json", [
		'{ "name": "evidence-app", "type": "module", "imports": { "#lib/*": "./api/__lib/*" }, "exports": { "./lib/*": "./api/__lib/*" } }'
	]);
	write("pkgapp/api/c/c.mjs", ["export function probe() {", '\treturn "reached";', "}"]);
	write("pkgapp/api/shared/shared.mjs", [
		'import { later as viaImports } from "#lib/shared.mjs";',
		'import { later as viaSelf } from "evidence-app/lib/shared.mjs";',
		"export function imports(gate) {",
		"\treturn viaImports(gate);",
		"}",
		"export function selfReference(gate) {",
		"\treturn viaSelf(gate);",
		"}"
	]);
	write("pkgapp/api/__lib/shared.mjs", [
		'const self = globalThis[Symbol.for("slothlet.test.evidenceSelf")];',
		"export async function later(gate) {",
		"\tawait gate;",
		"\treturn self.c.probe();",
		"}"
	]);
	// TypeScript leaves, which run from their compiled copies.
	write("tsapi/c/c.mjs", ["export function probe() {", '\treturn "reached";', "}"]);
	write("tsapi/tts/tts.ts", [
		'import { self } from "@cldmv/slothlet/runtime";',
		'import { later } from "../__lib/tsutil.ts";',
		"export async function own(gate: Promise<void>): Promise<string> {",
		"\tawait gate;",
		"\treturn self.c.probe();",
		"}",
		"export function viaHelper(gate: Promise<void>): Promise<string> {",
		"\treturn later(gate);",
		"}"
	]);
	write("tsapi/__lib/tsutil.ts", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export async function later(gate: Promise<void>): Promise<string> {",
		"\tawait gate;",
		"\treturn self.c.probe();",
		"}"
	]);
	// One folder mounted twice with api.add(): each mount has its own copy of the leaf, under its own `module` query.
	write("dup/work.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export async function work(gate) {",
		"\tawait gate;",
		"\treturn self.c.probe();",
		"}"
	]);
	// A folder mounted twice whose leaf can hold a call suspended or call from a callback slothlet does not patch.
	write("dup3/work.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		'import { stat } from "node:fs";',
		"export async function hold(gate) {",
		"\tawait gate;",
		'\treturn "held";',
		"}",
		"export function later(done) {",
		'\tstat(".", () => {',
		"\t\ttry {",
		"\t\t\tdone(self.c.probe());",
		"\t\t} catch (error) {",
		"\t\t\tdone(error.code ?? error.message);",
		"\t\t}",
		"\t});",
		"}"
	]);
	// The same cases in a real Node process: Node's own resolver with slothlet's resolve hook, not vite's graph.
	write("native-probe.mjs", [
		'import slothlet from "@cldmv/slothlet";',
		'import { self } from "@cldmv/slothlet/runtime";',
		'globalThis[Symbol.for("slothlet.test.evidenceSelf")] = self;',
		`const RULES = ${JSON.stringify(RULES)};`,
		'const base = new URL("./api/", import.meta.url).pathname;',
		"const out = {};",
		'for (const mode of ["eager", "lazy"]) {',
		'\tconst api = await slothlet({ base, mode, runtime: "live", silent: true, permissions: RULES });',
		'\tfor (const module of ["admin", "rogue", "adminExt", "relay", "tools", "rcjs", "dyn", "relayPkg", "c"]) await api[module];',
		"\tawait api.dyn.load();",
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
		"\t\trun2: await gated((gate) => api.tools.run2(gate)),",
		"\t\tdyn: await gated((gate) => api.dyn.run(gate)),",
		"\t\tviaLent: await whileAdminSuspended(() => new Promise((resolve) => api.rogue.viaLent(resolve))),",
		"\t\tviaLeaf: await whileAdminSuspended(() => new Promise((resolve) => api.rogue.viaLeaf(resolve))),",
		"\t\trcjs: await whileAdminSuspended(() => new Promise((resolve) => api.rcjs.own(resolve))),",
		"\t\tpkg: await whileAdminSuspended(() => new Promise((resolve) => api.relayPkg.viaPkg(resolve)))",
		"\t};",
		"\tawait api.shutdown();",
		'\tconst denying = await slothlet({ base, mode, runtime: "live", silent: true, permissions: { defaultPolicy: "allow", rules: [{ caller: "t6.**", target: "c.**", effect: "deny" }] } });',
		'\tconst allowing = await slothlet({ base, mode, runtime: "live", silent: true });',
		"\tawait denying.t6;",
		"\tawait allowing.t6;",
		"\tawait denying.c;",
		"\tawait allowing.c;",
		"\tlet release;",
		"\tconst gate = new Promise((resolve) => (release = resolve));",
		"\tconst both = [settle(denying.t6.run(gate)), settle(allowing.t6.run(gate))];",
		"\tawait turn();",
		"\trelease();",
		"\tout[mode].instances = await Promise.all(both);",
		"\tawait denying.shutdown();",
		"\tawait allowing.shutdown();",
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
		for (const module of [
			"admin",
			"rogue",
			"adminExt",
			"relay",
			"tools",
			"rcjs",
			"dyn",
			"relayPkg",
			"registry",
			"plugin",
			"maker",
			"user",
			"c"
		]) {
			await api[module];
		}
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

	it.each([
		["a helper of that module's imports", "viaLent"],
		["a function of that module's leaf", "viaLeaf"]
	])("a module's callback run by %s from an unpatched boundary is not run as that module", async (_label, fn) => {
		await boot();
		const outcome = await whileAdminSuspended(() => new Promise((resolve) => api.rogue[fn](resolve)));
		expect(outcome).not.toBe("reached");
	});

	it.each([
		["its suspended entry function", "viaEntry"],
		["a same-named method of its file", "viaMethod"]
	])("a module's callback run by another module's %s from an unpatched boundary is not run as that module", async (_label, fn) => {
		await boot();
		let release;
		const transaction = api.admin.transact(() => "begun", new Promise((resolve) => (release = resolve)));
		await new Promise((resolve) => setTimeout(resolve, 0));
		try {
			const outcome = await new Promise((resolve) => api.rogue[fn](resolve));
			expect(outcome).not.toBe("reached");
		} finally {
			release();
			expect(await transaction).toBe("begun");
		}
	});

	it.each([
		["the package's own #imports", "imports"],
		["the package's self-reference", "selfReference"]
	])("a call handing back the promise of a helper reached through %s keeps its identity", async (_label, fn) => {
		api = await slothlet({ base: path.join(ROOT, "pkgapp", "api"), mode, runtime: "live", silent: true });
		await api.shared;
		await api.c;
		let release;
		const pending = api.shared[fn](new Promise((resolve) => (release = resolve)));
		await new Promise((resolve) => setTimeout(resolve, 0));
		release();
		expect(await pending).toBe("reached");
	});

	it.each([
		["in its own code", "own", null, "reached"],
		["in a helper it imports", "viaHelper", null, "reached"],
		["in its own code, held to its rules", "own", "tts", "PERMISSION_DENIED"],
		["in a helper it imports, held to its rules", "viaHelper", "tts", "PERMISSION_DENIED"]
	])("a TypeScript leaf keeps its identity after an await %s", async (_label, fn, denied, expected) => {
		api = await slothlet({
			base: path.join(ROOT, "tsapi"),
			mode,
			runtime: "live",
			typescript: true,
			silent: true,
			permissions: { defaultPolicy: "allow", rules: denied ? [{ caller: `${denied}.**`, target: "c.**", effect: "deny" }] : [] }
		});
		await api.tts;
		await api.c;
		let release;
		const pending = api.tts[fn](new Promise((resolve) => (release = resolve)));
		await new Promise((resolve) => setTimeout(resolve, 0));
		release();
		expect(await pending.catch((error) => error.code ?? error.message)).toBe(expected);
	});

	it("a package's own copy of another module's leaf does not make its callback that module's", async () => {
		await boot();
		const outcome = await whileAdminSuspended(() => new Promise((resolve) => api.relayPkg.viaPkg(resolve)));
		expect(outcome).not.toBe("reached");
	});

	it.each([
		["a registry running the handlers other modules gave it", "registry", ["PERMISSION_DENIED"]],
		["a module running a function another module's call returned", "user", "PERMISSION_DENIED"]
	])("%s after an await runs them as itself", async (_label, module, expected) => {
		api = await slothlet({
			base: API,
			mode,
			runtime: "live",
			silent: true,
			permissions: { defaultPolicy: "allow", rules: [{ caller: `${module}.**`, target: "c.**", effect: "deny" }] }
		});
		for (const name of ["registry", "plugin", "maker", "user", "c"]) await api[name];
		api.plugin.install();
		let release;
		const gate = new Promise((resolve) => (release = resolve));
		const pending = module === "registry" ? api.registry.fire(gate) : api.user.use(gate);
		await new Promise((resolve) => setTimeout(resolve, 0));
		release();
		expect(await pending.catch((error) => error.code ?? error.message)).toEqual(expected);
	});

	it("a CommonJS leaf with nothing suspended is not run as another module's suspended call", async () => {
		await boot();
		const outcome = await whileAdminSuspended(() => new Promise((resolve) => api.rcjs.own(resolve)));
		expect(outcome).not.toBe("reached");
	});

	it("a call handing back the promise of a helper it loaded with a dynamic import keeps its identity", async () => {
		await boot();
		await api.dyn.load();
		let release;
		const pending = api.dyn.run(new Promise((resolve) => (release = resolve)));
		await new Promise((resolve) => setTimeout(resolve, 0));
		release();
		expect(await pending).toBe("reached");
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
			const { steal, stealVia, dotted, outside, run, run2, dyn, viaLent, viaLeaf, rcjs, pkg, instances } = out[mode];
			expect({ mode, steal, run, run2, dyn }).toEqual({
				mode,
				steal: "PERMISSION_DENIED",
				run: "reached",
				run2: "reached",
				dyn: "reached"
			});
			for (const refused of [stealVia, dotted, outside, viaLent, viaLeaf, rcjs, pkg, instances[0]]) expect(refused).not.toBe("reached");
			expect(instances[1]).not.toBe("PERMISSION_DENIED");
		}
	});
});

describe.each([{ mode: "eager" }, { mode: "lazy" }])(
	"Live runtime: two instances of one folder sharing a CommonJS helper ($mode)",
	({ mode }) => {
		it("a call of the instance that denies it is not run as the other instance", async () => {
			const denying = await slothlet({
				base: API,
				mode,
				runtime: "live",
				silent: true,
				permissions: { defaultPolicy: "allow", rules: [{ caller: "t6.**", target: "c.**", effect: "deny" }] }
			});
			const allowing = await slothlet({
				base: API,
				mode,
				runtime: "live",
				silent: true,
				permissions: { defaultPolicy: "allow", rules: [] }
			});
			try {
				for (const api of [denying, allowing]) {
					await api.t6;
					await api.c;
				}
				let release;
				const gate = new Promise((resolve) => (release = resolve));
				const settle = (promise) =>
					promise.then(
						(value) => value,
						(error) => error.code ?? error.message
					);
				const denied = settle(denying.t6.run(gate));
				const allowed = settle(allowing.t6.run(gate));
				await new Promise((resolve) => setTimeout(resolve, 0));
				release();
				expect(await denied).not.toBe("reached");
				expect(await allowed).not.toBe("PERMISSION_DENIED");
			} finally {
				await denying.shutdown();
				await allowing.shutdown();
			}
		});
	}
);

describe.each([{ mode: "eager" }, { mode: "lazy" }])("Live runtime: one folder mounted twice ($mode)", ({ mode }) => {
	it.each([
		["ok:x", "ok"],
		["a&b", "a"],
		["a#b", "a"],
		["a)b", "a"],
		["a%20b", "a b"],
		["a b", "a+b"]
	])("a mount with moduleID %j is not taken for one with moduleID %j", async (deniedID, allowedID) => {
		const api = await slothlet({
			base: API,
			mode,
			runtime: "live",
			silent: true,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "dupA.**", target: "c.**", effect: "deny" }] }
		});
		try {
			await api.slothlet.api.add(["dupA"], path.join(ROOT, "dup"), { moduleID: deniedID });
			await api.slothlet.api.add(["dupB"], path.join(ROOT, "dup"), { moduleID: allowedID });
			await api.c;
			const settle = (promise) =>
				promise.then(
					(value) => value,
					(error) => error.code ?? error.message
				);
			let release;
			const gate = new Promise((resolve) => (release = resolve));
			const fromA = settle(api.dupA.work(gate));
			const fromB = settle(api.dupB.work(gate));
			await new Promise((resolve) => setTimeout(resolve, 0));
			release();
			expect(await fromA).toBe("PERMISSION_DENIED");
			expect(await fromB).toBe("reached");
		} finally {
			await api.shutdown();
		}
	});

	it("a mount's callback with nothing of its own suspended is not run as the other mount's call", async () => {
		const api = await slothlet({
			base: API,
			mode,
			runtime: "live",
			silent: true,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "dupB.**", target: "c.**", effect: "deny" }] }
		});
		try {
			await api.slothlet.api.add(["dupA"], path.join(ROOT, "dup3"));
			await api.slothlet.api.add(["dupB"], path.join(ROOT, "dup3"));
			await api.c;
			let release;
			const held = api.dupA.work.hold(new Promise((resolve) => (release = resolve)));
			await new Promise((resolve) => setTimeout(resolve, 0));
			const outcome = await new Promise((resolve) => api.dupB.work.later(resolve));
			release();
			expect(await held).toBe("held");
			// B has nothing suspended, so its callback is code no suspended call accounts for: refused, not B's or A's.
			expect(outcome).toBe("RUNTIME_NO_ACTIVE_CONTEXT_SELF");
		} finally {
			await api.shutdown();
		}
	});

	it("a mount reloaded on its own keeps its identity after an await", async () => {
		const api = await slothlet({ base: API, mode, runtime: "live", silent: true });
		try {
			await api.slothlet.api.add(["dupA"], path.join(ROOT, "dup"));
			await api.slothlet.api.add(["dupB"], path.join(ROOT, "dup"));
			await api.slothlet.api.reload("dupB");
			await api.c;
			let release;
			const pending = api.dupB.work(new Promise((resolve) => (release = resolve)));
			await new Promise((resolve) => setTimeout(resolve, 0));
			release();
			expect(await pending.catch((error) => error.code ?? error.message)).toBe("reached");
		} finally {
			await api.shutdown();
		}
	});

	it("each mount's suspended call is told apart by its own copy of the leaf", async () => {
		const api = await slothlet({
			base: API,
			mode,
			runtime: "live",
			silent: true,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "dupB.**", target: "c.**", effect: "deny" }] }
		});
		try {
			await api.slothlet.api.add(["dupA"], path.join(ROOT, "dup"));
			await api.slothlet.api.add(["dupB"], path.join(ROOT, "dup"));
			await api.c;
			const settle = (promise) =>
				promise.then(
					(value) => value,
					(error) => error.code ?? error.message
				);
			let release;
			const gate = new Promise((resolve) => (release = resolve));
			const fromA = settle(api.dupA.work(gate));
			const fromB = settle(api.dupB.work(gate));
			await new Promise((resolve) => setTimeout(resolve, 0));
			release();
			expect(await fromA).toBe("reached");
			expect(await fromB).toBe("PERMISSION_DENIED");
		} finally {
			await api.shutdown();
		}
	});
});
