/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/returned-shared-values.test.vitest.mjs
 *	@Date: 2026-10-27T06:58:07-07:00 (1793109487)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-30T23:04:30-07:00 (1793426670)
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
import { createHmac, sign, webcrypto } from "node:crypto";
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
	 * @returns {Promise<object>} The api.
	 */
	async function create() {
		const api = await slothlet({ base: API, ...config, silent: true });
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

	it("hands out a package's exports as the module's, working as they would", async () => {
		const api = await create();
		const refs = await api.esm.refs();
		const { fakeEsm, fakeCjs } = await hostPackages();
		for (const key of ["Thing", "tools", "make", "fakeCjs"]) expect(types.isProxy(refs[key])).toBe(true);
		expect(refs.Thing).not.toBe(fakeEsm.Thing);
		expect(refs.fakeCjs).not.toBe(fakeCjs);
		// Its instances are instances of the class as the module hands it out, not of the host's own import of it.
		expect(refs.make()).toBeInstanceOf(refs.Thing);
		expect(refs.tools.make()).toBeInstanceOf(refs.Thing);
		expect(new refs.Thing()).toBeInstanceOf(refs.Thing);
		expect(refs.make()).not.toBeInstanceOf(fakeEsm.Thing);
		expect(refs.fakeCjs.fn()).toBe("fn");
	});

	it("hands out a CommonJS package's exports as the module's from a CommonJS module, working as they would", async () => {
		const api = await create();
		const refs = await api.cjs.refs();
		const { fakeCjs } = await hostPackages();
		expect(refs.fakeCjs).not.toBe(fakeCjs);
		expect(refs.fn).not.toBe(fakeCjs.fn);
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
		const api = await create();
		try {
			const handed = await api.esm.plantOnBuiltin();
			expect(handed).not.toBe(EventEmitter);
			expect(types.isProxy(handed)).toBe(true);
		} finally {
			delete EventEmitter.slothletTestPlanted;
		}
		expect((await api.esm.refs()).EventEmitter).toBe(EventEmitter);
	});

	it("keeps a built-in's class a module put its own code on deep below it as that module's", async () => {
		const api = await create();
		try {
			const handed = await api.esm.plantDeepOnBuiltin();
			expect(types.isProxy(handed)).toBe(true);
		} finally {
			delete EventEmitter.prototype.slothletTestDeep;
		}
		expect((await api.esm.refs()).EventEmitter).toBe(EventEmitter);
	});

	it("records none of a module's code through the instance-import state", async () => {
		const api = await create();
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
	 * @returns {Promise<object>} The api.
	 */
	async function create() {
		api = await slothlet({
			base: API,
			...config,
			silent: true,
			permissions: { defaultPolicy: "allow", rules: [{ caller: "slots.**", target: "vault.**", effect: "deny" }] }
		});
		return api;
	}

	it.each(["map", "emitter", "date"])("runs the module's code a %s carries as that module, whoever calls it", async (kind) => {
		await create();
		expect(await api.esm.viaSlots(kind)).toBe("PERMISSION_DENIED");
	});

	it.each(["map", "set", "promise", "weakRef", "cause", "iterator", "mapForEach", "setForEach"])(
		"runs the module's code a %s holds in its internal slots as that module, whoever takes it out",
		async (kind) => {
			await create();
			expect(await api.esm.viaHolding(kind)).toBe("PERMISSION_DENIED");
		}
	);

	it.each(["thenable", "callback"])(
		"runs the module's code it passes back through a %s it was handed as that module, after its call is over",
		async (kind) => {
			await create();
			expect(await api.esm.viaCallback(kind)).toBe("PERMISSION_DENIED");
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
		for (const [key, value] of Object.entries(out)) expect([key, value]).toEqual([key, "RUNTIME_NO_ACTIVE_CONTEXT_SELF"]);
	});
});

describe.each(CONFIGS)("what a module of a shut-down instance made (#597) — $mode / $runtime", (config) => {
	it("runs as plain code that reaches no instance, even called inside another instance's call", async () => {
		const gone = await slothlet({ base: API, ...config, silent: true });
		const live = await slothlet({ base: API, ...config, silent: true });
		try {
			const read = await gone.esm.reader();
			expect(await read()).toBe(42);
			await gone.slothlet.shutdown();
			const result = await live.esm.call(read);
			expect(result).not.toBe(42);
			expect(typeof result).toBe("string");
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
