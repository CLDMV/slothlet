/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/returned-shared-values.test.vitest.mjs
 *	@Date: 2026-10-27T06:58:07-07:00 (1793109487)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-10T21:30:05-08:00 (1794375005)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Values a module hands out that no module made (#597).
 * @description
 * What a module returns that its own code made comes back as a stand-in that runs as that module. A built-in's export
 * and slothlet's runtime are made by no module and come back as themselves: `===` and `instanceof` hold against the
 * host's own import, for every module and instance. A package's exports are handed out as the module's, like its own
 * code — anyone can put code under `node_modules` — and work as they would, though `instanceof` holds against the class
 * the module hands out rather than the host's own import of the package. A function a module puts on a built-in,
 * and a plugin's own helper reached through its package name, are that module's code and stay stand-ins.
 */

import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
import { types } from "node:util";
import { createHash, createHmac, sign, webcrypto } from "node:crypto";
import slothlet from "@cldmv/slothlet";
import * as runtime from "@cldmv/slothlet/runtime";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_returned_packages");
const API = path.join(FIXTURE, "api");
const PACKAGES = path.join(FIXTURE, "node_modules");
const REPO = path.resolve(FIXTURE, "../..");

// A plugin installed as a package whose files import slothlet's runtime: written at run time, beside a link to this
// checkout as its `@cldmv/slothlet`, which a package inside the fixture's own `node_modules` could not resolve.
const PLUGIN_ROOT = path.join(process.cwd(), "tmp", "returned-shared-values");
const PLUGIN = path.join(PLUGIN_ROOT, "node_modules", "plug2");
const PROBE = path.join(PLUGIN_ROOT, "probe.mjs");
const SHUTDOWN_PROBE = path.join(PLUGIN_ROOT, "shutdown-probe.mjs");
const CHANNELS_PROBE = path.join(PLUGIN_ROOT, "channels-probe.mjs");
const CHANNELS = path.join(FIXTURE, "channels");
// Modules whose packages use slothlet's runtime themselves: written at run time beside the `@cldmv/slothlet` link.
const PACKAGES_API = path.join(PLUGIN_ROOT, "pkgapi");
const PACKAGES_PROBE = path.join(PLUGIN_ROOT, "packages-probe.mjs");
const SHORT_STACK_PROBE = path.join(PLUGIN_ROOT, "short-stack-probe.mjs");

beforeAll(() => {
	rmSync(PLUGIN_ROOT, { recursive: true, force: true });
	mkdirSync(path.join(PLUGIN, "api", "__lib"), { recursive: true });
	mkdirSync(path.join(PLUGIN_ROOT, "node_modules", "@cldmv"), { recursive: true });
	symlinkSync(REPO, path.join(PLUGIN_ROOT, "node_modules", "@cldmv", "slothlet"), "dir");
	writeFileSync(
		path.join(PLUGIN, "package.json"),
		JSON.stringify({ name: "plug2", type: "module", exports: { "./util": "./api/__lib/util.mjs" } })
	);
	// The leaf reads from inside its own helper, which it imports through its package name from inside its mounted folder.
	writeFileSync(
		path.join(PLUGIN, "api", "leaf.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			'import { invoke } from "plug2/util";',
			"export function read(_callback) {",
			"\treturn invoke(() => self.vault.secret);",
			"}",
			""
		].join("\n")
	);
	writeFileSync(path.join(PLUGIN, "api", "__lib", "util.mjs"), "export function invoke(fn) {\n\treturn fn();\n}\n");
	// Run under Node's own loader: vite would load the plugin's leaf, and so its runtime, through its own module graph.
	writeFileSync(
		PROBE,
		[
			'import slothlet from "@cldmv/slothlet";',
			"const out = {};",
			'for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) {',
			"\tconst api = await slothlet({",
			`\t\tbase: ${JSON.stringify(API)},`,
			"\t\tmode,",
			"\t\truntime,",
			"\t\tsilent: true,",
			'\t\tpermissions: { defaultPolicy: "allow", rules: [{ caller: "caller.**", target: "vault.**", effect: "deny" }] }',
			"\t});",
			`\tawait api.slothlet.api.add("plug2", ${JSON.stringify(path.join(PLUGIN, "api"))}, { moduleID: "plug2" });`,
			"\tout[`${mode}/${runtime}`] = await api.caller.viaPlugin();",
			"\tawait api.slothlet.shutdown();",
			"}",
			"console.log(JSON.stringify(out));",
			""
		].join("\n")
	);
	// A module that may not read the vault passes its own function to one that may, by routes slothlet does not hand
	// values through, and the other calls it after: under Node's own loader, as the stack places frames there.
	writeFileSync(
		CHANNELS_PROBE,
		[
			'import slothlet from "@cldmv/slothlet";',
			"const out = {};",
			'for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) {',
			"\tconst api = await slothlet({",
			`\t\tbase: ${JSON.stringify(CHANNELS)},`,
			"\t\tmode,",
			"\t\truntime,",
			"\t\tsilent: true,",
			'\t\tpermissions: { defaultPolicy: "allow", rules: [{ caller: "plug.**", target: "vault.**", effect: "deny" }] }',
			"\t});",
			"\tconst results = { own: await api.trusted.own() };",
			'\tfor (const route of ["objCb", "arrCb", "fill", "map", "emitter", "global", "patched", "generator", "chainKept", "chainRoot", "chainNode", "nsKept"])',
			"\t\tresults[route] = await api.trusted.run(route);",
			"\tconst run = (fn) => { try { return fn(); } catch (error) { return error.code ?? error.message; } };",
			"\tconst runAsync = async (fn) => { try { return await fn(); } catch (error) { return error.code ?? error.message; } };",
			"\tconst fresh = await slothlet({",
			`\t\tbase: ${JSON.stringify(CHANNELS)},`,
			"\t\tmode,",
			"\t\truntime,",
			"\t\tsilent: true,",
			'\t\tpermissions: { defaultPolicy: "allow", rules: [{ caller: "plug.**", target: "vault.**", effect: "deny" }] }',
			"\t});",
			"\tconst unloaded = {};",
			"\tawait fresh.plug.keepNamespace(unloaded);",
			"\tresults.hostNsCalled = await runAsync(unloaded.g);",
			"\tawait fresh.slothlet.shutdown();",
			"\tconst held = {};",
			"\tawait api.plug.keepNamespace(held);",
			"\tresults.hostNsKept = run(held.f);",
			"\tawait api.slothlet.shutdown();",
			"\tconst open = await slothlet({",
			`\t\tbase: ${JSON.stringify(CHANNELS)},`,
			"\t\tmode,",
			"\t\truntime,",
			"\t\tsilent: true,",
			'\t\tpermissions: { defaultPolicy: "allow", provenance: false, rules: [{ caller: "plug.**", target: "vault.**", effect: "deny" }] }',
			"\t});",
			'\tresults.provenanceOff = await open.trusted.run("global");',
			"\tawait open.slothlet.shutdown();",
			"\tfor (const [name, rules] of [",
			'\t\t["bothAllowed", []],',
			'\t\t["onlyPlugAllowed", [{ caller: "trusted.**", target: "vault.**", effect: "deny" }]]',
			"\t]) {",
			`\t\tconst other = await slothlet({ base: ${JSON.stringify(CHANNELS)}, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", rules } });`,
			'\t\tresults[name] = await other.trusted.run("global");',
			"\t\tconst kept = {};",
			"\t\tawait other.plug.keepNamespace(kept);",
			"\t\tresults[`${name}Kept`] = run(kept.f);",
			"\t\tresults[`${name}KeptCall`] = await runAsync(kept.g);",
			"\t\tawait other.slothlet.shutdown();",
			"\t}",
			"\tout[`${mode}/${runtime}`] = results;",
			"}",
			"console.log(JSON.stringify(out));",
			""
		].join("\n")
	);
	// A plugin's package function, planted in an object the caller handed it, and a module's own dependency, both
	// reading the vault through slothlet's runtime (#597).
	const packageSource = (name) =>
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			`export async function ${name}() {`,
			"\ttry {",
			"\t\treturn await self.vault.secret;",
			"\t} catch (error) {",
			"\t\treturn error.code ?? error.message;",
			"\t}",
			"}",
			""
		].join("\n");
	for (const [name, fn] of [
		["evilpkg", "steal"],
		["goodpkg", "readVault"]
	]) {
		mkdirSync(path.join(PLUGIN_ROOT, "node_modules", name), { recursive: true });
		writeFileSync(
			path.join(PLUGIN_ROOT, "node_modules", name, "package.json"),
			JSON.stringify({ name, type: "module", exports: "./index.mjs" })
		);
		writeFileSync(path.join(PLUGIN_ROOT, "node_modules", name, "index.mjs"), packageSource(fn));
	}
	// A package linked in from a folder outside node_modules (npm link, workspaces), and a CommonJS file outside every
	// module's folder that a module requires through createRequire, naming a file nothing loaded as the importer.
	mkdirSync(path.join(PLUGIN_ROOT, "linksrc"), { recursive: true });
	writeFileSync(
		path.join(PLUGIN_ROOT, "linksrc", "package.json"),
		JSON.stringify({ name: "linkedpkg", type: "module", exports: "./index.mjs" })
	);
	writeFileSync(path.join(PLUGIN_ROOT, "linksrc", "index.mjs"), packageSource("stealLinked"));
	symlinkSync(path.join(PLUGIN_ROOT, "linksrc"), path.join(PLUGIN_ROOT, "node_modules", "linkedpkg"), "dir");
	mkdirSync(path.join(PLUGIN_ROOT, "hostarea"), { recursive: true });
	writeFileSync(
		path.join(PLUGIN_ROOT, "hostarea", "x.cjs"),
		[
			"module.exports = (self) => async () => {",
			"\ttry {",
			"\t\treturn await self.vault.secret;",
			"\t} catch (error) {",
			"\t\treturn error.code ?? error.message;",
			"\t}",
			"};",
			""
		].join("\n")
	);
	for (const dir of ["vault", "plug", "trusted"]) mkdirSync(path.join(PACKAGES_API, dir), { recursive: true });
	writeFileSync(path.join(PACKAGES_API, "vault", "vault.mjs"), "export const secret = 42;\n");
	writeFileSync(
		path.join(PACKAGES_API, "plug", "plug.mjs"),
		[
			'import { createRequire, Module } from "node:module";',
			'import vm from "node:vm";',
			'import { self } from "@cldmv/slothlet/runtime";',
			'const reader = "(self) => async function read() { try { return await self.vault.secret; } catch (error) { return error.code ?? error.message; } }";',
			'import { steal } from "evilpkg";',
			'import { stealLinked } from "linkedpkg";',
			"export function fill(target) {",
			"\ttarget.f = steal;",
			"}",
			"export function fillLinked(target) {",
			"\ttarget.f = stealLinked;",
			"}",
			"export function fillVm(target) {",
			'\ttarget.f = vm.runInThisContext(reader, { filename: "/nowhere/host/app.js" })(self);',
			"}",
			"export function fillCompiled(target) {",
			'\tconst made = new Module("/nowhere/host/m.js");',
			'\tmade._compile(`module.exports = ${reader};`, "/nowhere/host/m.js");',
			"\ttarget.f = made.exports(self);",
			"}",
			"export function fillNodeName(target) {",
			'\ttarget.f = vm.runInThisContext(reader, { filename: "node:internal/x" })(self);',
			"}",
			"export function fillSourceURL(target) {",
			"\ttarget.f = eval(`${reader}\\n//# sourceURL=node:internal/z`)(self);",
			"}",
			"export async function fillData(target) {",
			"\tconst { make } = await import(`data:text/javascript,export const make = ${encodeURIComponent(reader)};`);",
			"\ttarget.f = make(self);",
			"}",
			"export function fillRequired(target) {",
			`\ttarget.f = createRequire(${JSON.stringify(path.join(PLUGIN_ROOT, "hostarea", "anchor.js"))})("./x.cjs")(self);`,
			"}",
			""
		].join("\n")
	);
	writeFileSync(
		path.join(PACKAGES_API, "trusted", "trusted.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			'import { readVault } from "goodpkg";',
			'export async function viaPlug(route = "fill") {',
			"\tconst target = {};",
			"\tawait self.plug[route](target);",
			"\treturn target.f();",
			"}",
			"export function ownPackage() {",
			"\treturn readVault();",
			"}",
			""
		].join("\n")
	);
	writeFileSync(
		PACKAGES_PROBE,
		[
			'import slothlet from "@cldmv/slothlet";',
			"const out = {};",
			'for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) {',
			"\tconst results = {};",
			"\tfor (const [name, permissions] of [",
			'\t\t["plugDenied", { defaultPolicy: "allow", rules: [{ caller: "plug.**", target: "vault.**", effect: "deny" }] }],',
			'\t\t["bothAllowed", { defaultPolicy: "allow", rules: [] }],',
			'\t\t["plugDeniedProvenanceOff", { defaultPolicy: "allow", provenance: false, rules: [{ caller: "plug.**", target: "vault.**", effect: "deny" }] }]',
			"\t]) {",
			`\t\tconst api = await slothlet({ base: ${JSON.stringify(PACKAGES_API)}, mode, runtime, silent: true, permissions });`,
			"\t\tresults[name] = {",
			"\t\t\tviaPlug: await api.trusted.viaPlug(),",
			'\t\t\tviaLinked: await api.trusted.viaPlug("fillLinked"),',
			'\t\t\tviaRequired: await api.trusted.viaPlug("fillRequired"),',
			'\t\t\tcompiled: [await api.trusted.viaPlug("fillVm"), await api.trusted.viaPlug("fillCompiled"), await api.trusted.viaPlug("fillData"), await api.trusted.viaPlug("fillNodeName"), await api.trusted.viaPlug("fillSourceURL")],',
			"\t\t\townPackage: await api.trusted.ownPackage()",
			"\t\t};",
			"\t\tawait api.slothlet.shutdown();",
			"\t}",
			"\tout[`${mode}/${runtime}`] = results;",
			"}",
			"console.log(JSON.stringify(out));",
			""
		].join("\n")
	);
	// The same file required with the host's stack limit at one frame: who required it is read from the whole stack.
	writeFileSync(
		SHORT_STACK_PROBE,
		[
			'import slothlet from "@cldmv/slothlet";',
			"Error.stackTraceLimit = 1;",
			"const out = {};",
			'for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) {',
			`\tconst api = await slothlet({ base: ${JSON.stringify(PACKAGES_API)}, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", rules: [{ caller: "plug.**", target: "vault.**", effect: "deny" }] } });`,
			'\tout[`${mode}/${runtime}`] = await api.trusted.viaPlug("fillRequired");',
			"\tawait api.slothlet.shutdown();",
			"}",
			"console.log(JSON.stringify(out));",
			""
		].join("\n")
	);
	// A function a shut-down instance's module made reads the vault from a timer, while another instance's call waits
	// on it: under Node's own loader, as the stack places frames there.
	writeFileSync(
		SHUTDOWN_PROBE,
		[
			'import slothlet from "@cldmv/slothlet";',
			"const out = {};",
			'for (const format of ["esm", "cjs"]) for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) {',
			`\tconst base = ${JSON.stringify(API)};`,
			'\tconst rules = [{ caller: `${format}.**`, target: "vault.**", effect: "deny" }];',
			'\tconst gone = await slothlet({ base, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", rules } });',
			'\tconst live = await slothlet({ base, mode, runtime, silent: true, permissions: { defaultPolicy: "allow", rules } });',
			"\tconst read = await gone[format].laterReader();",
			"\tawait gone.slothlet.shutdown();",
			"\tout[`${format}/${mode}/${runtime}`] = await live.esm.callLater(read);",
			"\tawait live.slothlet.shutdown();",
			"}",
			"console.log(JSON.stringify(out));",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(PLUGIN_ROOT, { recursive: true, force: true });
});

/**
 * The export conditions this worker runs under (`--conditions=x`, or `--conditions x` / `-C x`), so a probe loads the
 * same build of slothlet.
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

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("values a module hands out that no module made (#597) — $mode / $runtime", (config) => {
	const instances = [];

	afterEach(async () => {
		while (instances.length) await instances.pop().slothlet.shutdown();
	});

	/**
	 * Create an instance over the fixture, tracked for shutdown.
	 * @param {object} [permissions] - A `permissions` block, or none for the permission system off.
	 * @returns {Promise<object>} The api.
	 */
	async function create(permissions) {
		const api = await slothlet({ base: API, ...config, silent: true, ...(permissions ? { permissions } : {}) });
		instances.push(api);
		return api;
	}

	/**
	 * The fixture's packages as the host imports them itself.
	 * @returns {Promise<{fakeEsm: object, fakeCjs: object}>} The packages.
	 */
	async function hostPackages() {
		const fakeEsm = await import(pathToFileURL(path.join(PACKAGES, "fake-esm", "index.mjs")).href);
		const fakeCjs = createRequire(path.join(API, "x.js"))("fake-cjs");
		return { fakeEsm, fakeCjs };
	}

	it("hands out a built-in's class and the runtime as they are", async () => {
		const api = await create();
		const refs = await api.esm.refs();
		expect(refs.EventEmitter).toBe(EventEmitter);
		expect(refs.runtime).toBe(runtime);
		expect(new EventEmitter()).toBeInstanceOf(refs.EventEmitter);
	});

	it("hands the host a package's exports a module returns in data as the exports themselves, working as they would", async () => {
		// Plain data comes back to the host as it is, unsearched (#726): what it holds is the package's own export, as
		// `return { Thing, tools, make, fakeCjs }` gives in plain JavaScript, with the permission system off or on.
		for (const permissions of [undefined, { defaultPolicy: "allow" }]) {
			const api = await create(permissions);
			const refs = await api.esm.refs();
			const { fakeEsm, fakeCjs } = await hostPackages();
			for (const key of ["Thing", "tools", "make", "fakeCjs"]) expect(types.isProxy(refs[key])).toBe(false);
			expect(refs.Thing).toBe(fakeEsm.Thing);
			expect(refs.fakeCjs).toBe(fakeCjs);
			expect(refs.make()).toBeInstanceOf(refs.Thing);
			expect(refs.tools.make()).toBeInstanceOf(refs.Thing);
			expect(new refs.Thing()).toBeInstanceOf(refs.Thing);
			expect(refs.make()).toBeInstanceOf(fakeEsm.Thing);
			expect(refs.fakeCjs.fn()).toBe("fn");
		}
	});

	it("hands the host a CommonJS package's exports a CommonJS module returns in data as the exports themselves", async () => {
		const api = await create();
		const refs = await api.cjs.refs();
		const { fakeCjs } = await hostPackages();
		// Plain data, handed to the host as it is (#726).
		expect(refs.fakeCjs).toBe(fakeCjs);
		expect(refs.fn).toBe(fakeCjs.fn);
		expect(refs.fn()).toBe("fn");
		expect(refs.inner()).toBe("inner");
		expect(refs.fakeCjs.nested.inner()).toBe("inner");
	});

	it("hands out the same built-in's class and runtime to every instance", async () => {
		const a = await create();
		const b = await create();
		const [refsA, refsB] = [await a.esm.refs(), await b.esm.refs()];
		for (const key of ["EventEmitter", "runtime"]) expect(refsA[key]).toBe(refsB[key]);
	});

	it("keeps a built-in's class a module put its own code on as that module's", async () => {
		// A stand-in is made only while the permission system is on; with it off the class comes back as itself (#726).
		const api = await create({ defaultPolicy: "allow" });
		const off = await create();
		try {
			const handed = await api.esm.plantOnBuiltin();
			expect(handed).not.toBe(EventEmitter);
			expect(types.isProxy(handed)).toBe(true);
			expect(await off.esm.plantOnBuiltin()).toBe(EventEmitter);
		} finally {
			delete EventEmitter.slothletTestPlanted;
		}
		expect((await api.esm.refs()).EventEmitter).toBe(EventEmitter);
	});

	it("keeps a built-in's class a module put its own code on deep below it as that module's", async () => {
		const api = await create({ defaultPolicy: "allow" });
		const off = await create();
		try {
			const handed = await api.esm.plantDeepOnBuiltin();
			expect(types.isProxy(handed)).toBe(true);
			expect(await off.esm.plantDeepOnBuiltin()).toBe(EventEmitter);
		} finally {
			delete EventEmitter.prototype.slothletTestDeep;
		}
		expect((await api.esm.refs()).EventEmitter).toBe(EventEmitter);
	});

	it("records none of a module's code through the instance-import state", async () => {
		// The function is the module's code: a stand-in while the permission system is on.
		const api = await create({ defaultPolicy: "allow" });
		const forged = await api.esm.forge();
		expect(types.isProxy(forged)).toBe(true);
		expect(forged()).toBe("forged");
		expect((await api.esm.refs()).EventEmitter).toBe(EventEmitter);
	});

	it("keeps a plugin's own helper, reached through its package name, as the plugin's", async () => {
		const api = await create();
		await api.slothlet.api.add("plug", path.join(PACKAGES, "plug", "api"), { moduleID: "plug" });
		const helper = await api.plug.leaf.helper();
		const own = await import(pathToFileURL(path.join(PACKAGES, "plug", "lib", "helper.mjs")).href);
		expect(helper).not.toBe(own.helperFn);
		expect(helper()).toBe("helper");
	});
});

describe.each(CONFIGS)("objects with internal slots a module hands out (#597) — $mode / $runtime", (config) => {
	let api = null;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	/**
	 * Create an instance over the fixture whose slots module may not read the vault.
	 * @param {object} [permissions] - Further permission options.
	 * @returns {Promise<object>} The api.
	 */
	async function create(permissions = {}) {
		api = await slothlet({
			base: API,
			...config,
			silent: true,
			permissions: { defaultPolicy: "allow", ...permissions, rules: [{ caller: "slots.**", target: "vault.**", effect: "deny" }] }
		});
		return api;
	}

	it.each(["map", "emitter", "date"])("runs the module's code a %s carries as that module, whoever calls it", async (kind) => {
		await create();
		expect(await api.esm.viaSlots(kind)).toBe("PERMISSION_DENIED");
	});

	const HOLDERS = ["map", "set", "promise", "promiseTagged", "promiseSymbol", "weakRef", "cause", "iterator", "mapForEach", "setForEach"];

	it.each(HOLDERS)("runs the module's code a %s holds in its internal slots as that module, whoever takes it out", async (kind) => {
		await create();
		expect(await api.esm.viaHolding(kind)).toBe("PERMISSION_DENIED");
	});

	// With provenance off no frames are read, and what a holder holds is data, handed over unsearched (#726): the
	// function runs with the permissions of the call that runs it, here `esm`, which may read the vault.
	it.each(HOLDERS)("runs the module's code a %s holds under the call that runs it with provenance off", async (kind) => {
		await create({ provenance: false });
		expect(await api.esm.viaHolding(kind)).toBe(42);
	});

	it("hands out a compiled script of the module's as the module's, with provenance off", async () => {
		await create({ provenance: false });
		expect(types.isProxy(await api.slots.script())).toBe(true);
		expect(await api.esm.viaScript()).toBe("PERMISSION_DENIED");
	});

	it("runs a compiled script of the module's that may read the vault, with provenance off", async () => {
		api = await slothlet({ base: API, ...config, silent: true, permissions: { defaultPolicy: "allow", provenance: false, rules: [] } });
		expect(await api.esm.viaScript()).toBe(42);
	});

	it("hands out Node's data objects a module made as they are, so Node accepts them", async () => {
		await create();
		const data = await api.slots.nodeData();
		for (const [name, value] of Object.entries(data)) expect([name, types.isProxy(value)]).toEqual([name, false]);
		const { buffer, blob, url, params, decoder, encoder, mime, address } = data;
		expect(createHash("sha256").update(buffer).digest("hex")).toHaveLength(64);
		expect(await blob.text()).toBe("hello");
		expect(fileURLToPath(new URL("file:///x")) && url.searchParams.get("b")).toBe("1");
		expect(params.get("a")).toBe("1");
		expect(decoder.decode(encoder.encode("hi"))).toBe("hi");
		expect(mime.essence).toBe("text/plain");
		expect(address.port).toBe(80);
	});

	it("hands out a promise carrying only symbol members, as Node's async hooks leave them, as a promise", async () => {
		await create();
		const held = await api.slots.holding("promiseSymbol");
		expect(types.isProxy(held.p)).toBe(false);
		expect(held.p).toBeInstanceOf(Promise);
	});

	it.each(["thenable", "callback"])(
		"refuses the module's code it passes back through a %s it was handed, run after its call is over",
		async (kind) => {
			await create();
			// Refused: as the module, or as code of no module running inside the caller's call.
			expect(["PERMISSION_DENIED", "RUNTIME_NO_ACTIVE_CONTEXT_SELF"]).toContain(await api.esm.viaCallback(kind));
		}
	);

	it("keeps what holds the module's code working", async () => {
		await create();
		expect(typeof (await api.slots.holding("map")).get("f")).toBe("function");
		expect((await api.slots.holding("map")).size).toBe(1);
		const held = await api.slots.holding("map");
		const mine = () => "mine";
		held.set("h", mine);
		expect(held.get("h")).toBe(mine);
		expect([...(await api.slots.holding("set"))]).toHaveLength(1);
		expect(typeof (await (await api.slots.holding("promise")).p)).toBe("function");
		expect(typeof (await api.slots.holding("weakRef")).deref()).toBe("function");
		expect((await api.slots.holding("cause")).message).toBe("held");
		expect([...(await api.slots.holding("iterator"))]).toHaveLength(1);
	});

	it("keeps a Map and an emitter of the module's own class working", async () => {
		await create();
		const map = await api.slots.map();
		map.set("a", 1);
		expect(map.get("a")).toBe(1);
		expect(map.has("a")).toBe(true);
		expect(map.size).toBe(1);
		expect([...map]).toEqual([["a", 1]]);
		const emitter = await api.slots.emitter();
		let fired = 0;
		emitter.on("x", () => fired++);
		emitter.emit("x");
		expect(fired).toBe(1);
	});

	it("hands out a Map and an emitter holding only data as they are", async () => {
		await create();
		const { map, emitter } = await api.slots.plain();
		expect(types.isProxy(map)).toBe(false);
		expect(types.isProxy(emitter)).toBe(false);
		expect(map.get("a")).toBe(1);
	});

	it("hands out Node's keys and message channels so Node accepts them", async () => {
		await create();
		const { secret, privateKey, cryptoKey, channel } = await api.slots.node();
		try {
			expect(createHmac("sha256", secret).update("x").digest("hex")).toHaveLength(64);
			expect(sign(null, Buffer.from("x"), privateKey)).toHaveLength(64);
			expect((await webcrypto.subtle.sign("HMAC", cryptoKey, Buffer.from("x"))).byteLength).toBe(32);
			const moved = structuredClone(channel.port1, { transfer: [channel.port1] });
			moved.close();
		} finally {
			channel.port1.close();
			channel.port2.close();
		}
	});
});

describe("a plugin installed as a package, run under Node's own loader (#597)", () => {
	it("places its own file, loaded through its package name, on the plugin", () => {
		const result = spawnSync(process.execPath, [...probeConditions(), PROBE], { cwd: PLUGIN_ROOT, encoding: "utf8", timeout: 120000 });
		expect(result.stderr).toBe("");
		expect(JSON.parse(result.stdout)).toEqual({ "eager/async": 42, "eager/live": 42, "lazy/async": 42, "lazy/live": 42 });
	});
});

describe("a module's own function passed by routes slothlet does not see, run under Node's own loader (#597)", () => {
	it("runs as the module that wrote it, under the call that runs it, whichever route it took", () => {
		const result = spawnSync(process.execPath, [...probeConditions(), CHANNELS_PROBE], {
			cwd: PLUGIN_ROOT,
			encoding: "utf8",
			timeout: 120000
		});
		expect(result.stderr).toBe("");
		const out = JSON.parse(result.stdout);
		expect(Object.keys(out)).toHaveLength(4);
		for (const [config, results] of Object.entries(out)) {
			const {
				own,
				provenanceOff,
				bothAllowed,
				onlyPlugAllowed,
				bothAllowedKept,
				onlyPlugAllowedKept,
				bothAllowedKeptCall,
				onlyPlugAllowedKeptCall,
				...routes
			} = results;
			expect([config, own]).toEqual([config, 42]);
			// With provenance turned off, the function runs with the permissions of the call that runs it.
			expect([config, provenanceOff]).toEqual([config, 42]);
			// It runs as the module that wrote it, under the call that runs it: both have to be allowed.
			expect([config, bothAllowed]).toEqual([config, 42]);
			expect([config, onlyPlugAllowed]).toEqual([config, "PERMISSION_DENIED"]);
			// A namespace the module read and kept reads as that module for whoever uses it, the host included.
			expect([config, bothAllowedKept, onlyPlugAllowedKept, bothAllowedKeptCall, onlyPlugAllowedKeptCall]).toEqual([
				config,
				42,
				42,
				42,
				42
			]);
			// A namespace the module kept before any of it was loaded is held to the module as well (hostNsCalled).
			expect(Object.keys(routes)).toHaveLength(14);
			for (const [route, value] of Object.entries(routes))
				expect([config, route, ["PERMISSION_DENIED", "RUNTIME_NO_ACTIVE_CONTEXT_SELF"].includes(value)]).toEqual([config, route, true]);
		}
	});
});

describe("a package's code run inside another module's call, under Node's own loader (#597)", () => {
	it("runs as the modules that import the package, under the call that runs it", () => {
		const result = spawnSync(process.execPath, [...probeConditions(), PACKAGES_PROBE], {
			cwd: PLUGIN_ROOT,
			encoding: "utf8",
			timeout: 120000
		});
		expect(result.stderr).toBe("");
		const out = JSON.parse(result.stdout);
		expect(Object.keys(out)).toHaveLength(4);
		for (const [config, results] of Object.entries(out)) {
			// Code compiled under a name no file holds (vm, Module#_compile, a data: URL, a node: name) is no one's: refused even where
			// both modules may read the vault, and run as the caller only with provenance off.
			for (const name of ["plugDenied", "bothAllowed"])
				for (const value of results[name].compiled) expect([config, name, value]).not.toEqual([config, name, 42]);
			expect([config, results.plugDeniedProvenanceOff.compiled]).toEqual([config, [42, 42, 42, 42, 42]]);
			for (const name of Object.keys(results)) delete results[name].compiled;
			expect({ config, ...results }).toEqual({
				config,
				// The plugin's package code is the plugin's: refused where the plugin may not read the vault.
				plugDenied: { viaPlug: "PERMISSION_DENIED", viaLinked: "PERMISSION_DENIED", viaRequired: "PERMISSION_DENIED", ownPackage: 42 },
				bothAllowed: { viaPlug: 42, viaLinked: 42, viaRequired: 42, ownPackage: 42 },
				// With provenance off it runs with the permissions of the call that runs it.
				plugDeniedProvenanceOff: { viaPlug: 42, viaLinked: 42, viaRequired: 42, ownPackage: 42 }
			});
		}
	});
});

describe("a file a module requires while the host keeps a short stack, under Node's own loader (#597)", () => {
	it("runs as the module that required it", () => {
		const result = spawnSync(process.execPath, [...probeConditions(), SHORT_STACK_PROBE], {
			cwd: PLUGIN_ROOT,
			encoding: "utf8",
			timeout: 120000
		});
		expect(result.stderr).toBe("");
		expect(JSON.parse(result.stdout)).toEqual({
			"eager/async": "PERMISSION_DENIED",
			"eager/live": "PERMISSION_DENIED",
			"lazy/async": "PERMISSION_DENIED",
			"lazy/live": "PERMISSION_DENIED"
		});
	});
});

describe("what a module of a shut-down instance made, run under Node's own loader (#597)", () => {
	it("reaches no instance from a timer it sets while another instance's call waits on it", () => {
		const result = spawnSync(process.execPath, [...probeConditions(), SHUTDOWN_PROBE], {
			cwd: PLUGIN_ROOT,
			encoding: "utf8",
			timeout: 120000
		});
		expect(result.stderr).toBe("");
		const out = JSON.parse(result.stdout);
		expect(Object.keys(out)).toHaveLength(8);
		// Refused in every row. A CommonJS file two instances load is one file under one path, so in eager mode its frames
		// name no single instance and its definer cannot be told (#735): that is a refusal of the access. Every other row
		// has no context to read `self` from.
		const untellable = new Set(["cjs/eager/async", "cjs/eager/live"]);
		for (const [key, value] of Object.entries(out))
			expect([key, value]).toEqual([key, untellable.has(key) ? "PERMISSION_DENIED" : "RUNTIME_NO_ACTIVE_CONTEXT_SELF"]);
	});
});

describe.each(CONFIGS)("what a module of a shut-down instance made (#597) — $mode / $runtime", (config) => {
	it("reads the instance of the call it runs inside, having none of its own left", async () => {
		const gone = await slothlet({ base: API, ...config, silent: true });
		const live = await slothlet({ base: API, ...config, silent: true });
		try {
			const read = await gone.esm.reader();
			expect(await read()).toBe(42);
			await gone.slothlet.shutdown();
			// The permission system is off, so nothing is checked: run inside another instance's call, the closure reads
			// that call's `self` (#726).
			expect(await live.esm.call(read)).toBe(42);
		} finally {
			await live.slothlet.shutdown();
		}
	});
});

describe.each(CONFIGS)("what a node removed since made (#625) — $mode / $runtime", (config) => {
	it.each([
		["has no standing left while the permission system is on", { defaultPolicy: "allow" }, "PERMISSION_DENIED"],
		["runs as plain JavaScript with the permission system off", undefined, 42]
	])("%s", async (_label, permissions, expected) => {
		const api = await slothlet({ base: API, ...config, silent: true, ...(permissions ? { permissions } : {}) });
		try {
			const read = await api.esm.reader();
			expect(await read()).toBe(42);
			await api.slothlet.api.remove("esm");
			expect(await read()).toBe(expected);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
