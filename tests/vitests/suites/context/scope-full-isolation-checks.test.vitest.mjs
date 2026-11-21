/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/scope-full-isolation-checks.test.vitest.mjs
 *	@Date: 2026-11-18T06:09:41-08:00 (1795010981)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T06:50:40-08:00 (1795013440)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A full-isolation run's `self` (`run()` / `scope()` with the default `isolation: "full"`) is the run's own
 * api, read and written through the ordinary path. A write through it is refused exactly as the same write is refused
 * outside any run (reserved keys, invalid paths, ownership, permission write rules, module code a module left on
 * `globalThis`), a read answers each caller as the read gate answers that caller, values written in the run included,
 * built-in data members work as they do outside the run, and nothing the run writes (deep writes under a lazy node
 * included) reaches the instance. Once the run has a tree of its own, `api` and `self` agree in the run.
 *
 * Each expected value is what the same code answers outside any run, or what plain JavaScript answers.
 *
 * Fixture (written at run time): `vault.mjs` holds a token and built-in data members and writes its own token;
 * `alice.mjs` / `mallory.mjs` read them (mallory is denied `vault`); `store/{get,put}.mjs` write under `store`;
 * `writer.mjs` writes and reads members of `self`; `probe.mjs` reads a path of `self`; `plug/evil.mjs` (added under
 * `plug`, owning only `plug.*`) attempts the writes the normal path refuses; `more/more.mjs` is a folder a run adds.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "scope-full-isolation-checks");
const BASE = path.join(ROOT, "api");
const PLUG = path.join(ROOT, "plug");
const MORE = path.join(ROOT, "more");
const LEAK = Symbol.for("slothlet.test.scope-full-isolation-checks.leak");

/**
 * Write a fixture file.
 * @param {string} file - Path under ROOT.
 * @param {string[]} lines - Its lines.
 * @returns {void}
 */
function write(file, lines) {
	writeFileSync(path.join(ROOT, file), lines.join("\n") + "\n");
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "store"), { recursive: true });
	mkdirSync(PLUG, { recursive: true });
	mkdirSync(MORE, { recursive: true });
	const RUNTIME = 'import { self } from "@cldmv/slothlet/runtime";';
	const TRY = "const tryIt = (f) => { try { return f(); } catch (e) { return 'ERR:' + (e.code || e.constructor.name); } };";
	write("api/vault.mjs", [
		RUNTIME,
		'export const token = "SECRET";',
		'export const secretMap = new Map([["k", "SECRET"]]);',
		'export const secretBuf = Buffer.from("SECRET");',
		"export const secretDate = new Date(0);",
		'export const cfg = { key: "SECRET" };',
		"export function setToken(value) {",
		"\tself.vault.token = value;",
		"\treturn self.vault.token;",
		"}"
	]);
	for (const who of ["alice", "mallory"]) {
		write(`api/${who}.mjs`, [
			RUNTIME,
			TRY,
			"export function read() {",
			"\treturn tryIt(() => self.vault.token);",
			"}",
			"export function data() {",
			"\treturn {",
			'\t\tmap: tryIt(() => self.vault.secretMap.get("k")),',
			"\t\tbuf: tryIt(() => self.vault.secretBuf.toString()),",
			"\t\tdate: tryIt(() => self.vault.secretDate.getTime()),",
			"\t\tcfg: tryIt(() => self.vault.cfg.key)",
			"\t};",
			"}"
		]);
	}
	write("api/store/get.mjs", [RUNTIME, "export function get(key) {", "\treturn self.store[key];", "}"]);
	write("api/store/put.mjs", [
		RUNTIME,
		"export function put(key, value) {",
		"\tself.store[key] = value;",
		"\treturn self.store[key];",
		"}"
	]);
	write("api/writer.mjs", [
		RUNTIME,
		TRY,
		"export function put(key, value) {",
		"\tself[key] = value;",
		"\treturn self[key];",
		"}",
		"export function get(key) {",
		"\treturn self[key];",
		"}",
		"export function close(how) {",
		"\tObject[how](self.store);",
		"\tconst write = tryIt(() => { self.store.added = 1; return 'wrote'; });",
		"\treturn { frozen: Object.isFrozen(self.store), sealed: Object.isSealed(self.store), extensible: Object.isExtensible(self.store), write, added: self.store.added };",
		"}"
	]);
	write("api/probe.mjs", [
		RUNTIME,
		TRY,
		"export function peek(parts) {",
		"\treturn tryIt(() => { let value = self; for (const part of parts) value = value[part]; return typeof value === 'function' ? '[fn]' : value; });",
		"}"
	]);
	write("plug/evil.mjs", [
		RUNTIME,
		TRY,
		"export function proto() {",
		"\treturn {",
		'\t\tdunderProto: tryIt(() => { self.__proto__ = { polluted: "P" }; return "ok"; }),',
		'\t\tconstructorKey: tryIt(() => { self.constructor = "C"; return "ok"; }),',
		'\t\tprototypeKey: tryIt(() => { self.prototype = "PR"; return "ok"; }),',
		'\t\tdeepProto: tryIt(() => { self.vault.__proto__ = { polluted: "P" }; return "ok"; }),',
		'\t\treadBack: tryIt(() => [self.polluted, self.constructor === Object, self.prototype, self.vault.polluted].map(String).join("|"))',
		"\t};",
		"}",
		"export function badPath() {",
		'\treturn { write: tryIt(() => { self["a..b"] = 1; return "ok"; }), read: tryIt(() => self["a..b"]) };',
		"}",
		'export function notOwnedDeep() { return tryIt(() => { self.vault.token = "PWNED"; return "ok"; }); }',
		'export function notOwnedTop() { return tryIt(() => { self.newtop = "NEW"; return "ok"; }); }',
		'export function ruleDenied() { return tryIt(() => { self.plug.evil.extra = "X"; return "ok"; }); }',
		"export function leak() {",
		`\tglobalThis[Symbol.for("slothlet.test.scope-full-isolation-checks.leak")] = () => tryIt(() => { self.vault.token = "LEAKED"; return "ok"; });`,
		'\treturn "installed";',
		"}"
	]);
	write("more/more.mjs", ["export function ping() {", '\treturn "more";', "}"]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	delete globalThis[LEAK];
});

/** Permission rules: mallory is denied `vault`, and `plug` is denied writes to itself. */
const PERMISSIONS = {
	policy: "allow",
	rules: [
		{ caller: "mallory.**", target: "vault.**", effect: "deny" },
		{ caller: "mallory.**", target: "vault", effect: "deny" },
		{ caller: "plug.**", target: "plug.**:write", effect: "deny" }
	]
};

describe.each([
	["async", "eager"],
	["async", "lazy"],
	["live", "eager"],
	["live", "lazy"]
])("full-isolation self — %s runtime, %s mode", (runtime, mode) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
		delete globalThis[LEAK];
	});

	/**
	 * Make an instance on the fixture, with `plug` added.
	 * @param {boolean} permissions - Whether the permission rules are on.
	 * @returns {Promise<object>} The api.
	 */
	async function make(permissions) {
		api = await slothlet({ base: BASE, runtime, mode, silent: true, ...(permissions ? { permissions: PERMISSIONS } : {}) });
		await api.slothlet.api.add(["plug"], PLUG);
		return api;
	}

	/**
	 * Run `fn` in a run with the default isolation (full).
	 * @param {Function} fn - The body.
	 * @returns {Promise<*>} What it returned.
	 */
	const inRun = (fn) => api.slothlet.context.run({}, fn);

	describe.each([
		["permissions on", true],
		["permissions off", false]
	])("%s", (_label, permissions) => {
		it("refuses the reserved keys __proto__, constructor and prototype as outside a run", async () => {
			await make(permissions);
			const outside = await api.plug.evil.proto();
			const inside = await inRun(() => api.plug.evil.proto());
			expect(inside).toEqual(outside);
			expect(inside.dunderProto).toBe("ERR:LOOSE_SET_RESERVED_KEY");
			expect(inside.constructorKey).toBe("ERR:LOOSE_SET_RESERVED_KEY");
			expect(inside.prototypeKey).toBe("ERR:LOOSE_SET_RESERVED_KEY");
			expect({}.polluted).toBeUndefined();
		});

		it("refuses an invalid path as outside a run", async () => {
			await make(permissions);
			const outside = await api.plug.evil.badPath();
			const inside = await inRun(() => api.plug.evil.badPath());
			expect(inside).toEqual(outside);
			expect(inside.write).toBe("ERR:API_PATH_INVALID");
		});

		it("answers a write outside the writer's subtree and one a write rule names as outside a run", async () => {
			await make(permissions);
			const outside = {
				deep: await api.plug.evil.notOwnedDeep(),
				top: await api.plug.evil.notOwnedTop(),
				rule: await api.plug.evil.ruleDenied()
			};
			// Outside a run the writes the rules let through land on the instance: a fresh instance answers the run's.
			await api.slothlet.shutdown();
			await make(permissions);
			const inside = await inRun(async () => ({
				deep: await api.plug.evil.notOwnedDeep(),
				top: await api.plug.evil.notOwnedTop(),
				rule: await api.plug.evil.ruleDenied()
			}));
			expect(inside).toEqual(outside);
			if (permissions)
				expect(inside).toEqual({ deep: "ERR:LOOSE_SET_NOT_OWNED", top: "ERR:LOOSE_SET_NOT_OWNED", rule: "ERR:PERMISSION_DENIED" });
			expect(await api.vault.token).toBe("SECRET");
			expect("newtop" in api).toBe(false);
		});

		it("judges a write by module code left on globalThis as outside a run, and keeps it off the instance", async () => {
			await make(permissions);
			await api.plug.evil.leak();
			const outside = globalThis[LEAK]();
			// A write let through outside a run lands on the instance: a fresh instance answers the run's.
			await api.slothlet.shutdown();
			await make(permissions);
			await api.plug.evil.leak();
			const inside = await inRun(() => globalThis[LEAK]());
			expect(inside).toBe(outside);
			expect(await api.vault.token).toBe("SECRET");
		});
	});

	it("answers each caller's read as the read gate does, in either order", async () => {
		await make(true);
		const outside = { alice: await api.alice.read(), mallory: await api.mallory.read() };
		expect(outside).toEqual({ alice: "SECRET", mallory: "ERR:PERMISSION_DENIED" });
		expect(await inRun(async () => ({ alice: await api.alice.read(), mallory: await api.mallory.read() }))).toEqual(outside);
		expect(await inRun(async () => ({ mallory: await api.mallory.read(), alice: await api.alice.read() }))).toEqual(outside);
	});

	it("keeps a caller denied a member after another module wrote it in the run", async () => {
		await make(true);
		const seen = await inRun(async () => ({
			written: await api.vault.setToken("NEW"),
			mallory: await api.mallory.read(),
			alice: await api.alice.read()
		}));
		expect(seen).toEqual({ written: "NEW", mallory: "ERR:PERMISSION_DENIED", alice: "NEW" });
		expect(await api.vault.token).toBe("SECRET");
	});

	it("hands an allowed caller Map, Buffer and Date members that work as outside a run", async () => {
		await make(true);
		const outside = await api.alice.data();
		expect(outside).toEqual({ map: "SECRET", buf: "SECRET", date: 0, cfg: "SECRET" });
		expect(await inRun(() => api.alice.data())).toEqual(outside);
		const denied = await api.mallory.data();
		expect(await inRun(() => api.mallory.data())).toEqual(denied);
	});

	it("keeps a deep write under a node (lazy or not) in the run", async () => {
		await make(false);
		const seen = await inRun(async () => ({ put: await api.store.put("extra", "run"), get: await api.store.get("extra") }));
		expect(seen).toEqual({ put: "run", get: "run" });
		expect(await api.store.get("extra")).toBeUndefined();
		expect(api.store.extra).toBeUndefined();
	});

	it("keeps top-level and deep writes off the instance, a synchronous one included", async () => {
		await make(false);
		const seen = await inRun(() => {
			const early = api.writer.put("early", "run");
			return Promise.resolve(early).then(async (written) => ({
				written,
				read: await api.writer.get("early"),
				other: await api.probe.peek(["early"])
			}));
		});
		expect(seen).toEqual({ written: "run", read: "run", other: "run" });
		expect(await api.writer.get("early")).toBeUndefined();
		expect("early" in api).toBe(false);
	});

	it("makes api and self agree once the run has a tree of its own", async () => {
		await make(false);
		const seen = await inRun(async () => {
			const before = await api.writer.put("kept", "before");
			await api.store.put("deep", "before");
			await api.slothlet.api.add("more", MORE);
			const after = await api.writer.put("late", "after");
			return {
				before,
				after,
				selfKept: await api.writer.get("kept"),
				apiKept: api.kept,
				apiDeep: api.store.deep,
				selfDeep: await api.store.get("deep"),
				apiLate: api.late,
				more: await api.more.ping()
			};
		});
		expect(seen).toEqual({
			before: "before",
			after: "after",
			selfKept: "before",
			apiKept: "before",
			apiDeep: "before",
			selfDeep: "before",
			apiLate: "after",
			more: "more"
		});
		expect("kept" in api).toBe(false);
		expect("late" in api).toBe(false);
		expect(api.store.deep).toBeUndefined();
	});

	it('an explicit scope({ isolation: "full" }) keeps a write in the scope', async () => {
		await make(false);
		const seen = await api.slothlet.context.scope({ context: {}, isolation: "full", fn: () => api.writer.put("scoped", 1) });
		expect(seen).toBe(1);
		expect("scoped" in api).toBe(false);
	});

	it.each([
		["freeze", { frozen: true, sealed: true }],
		["seal", { sealed: true }],
		["preventExtensions", {}]
	])("Object.%s on a node closes it in the run as on an object, and leaves the instance open", async (how, closed) => {
		await make(false);
		const seen = await inRun(() => api.writer.close(how));
		// As on an object: closed as asked, it takes no new member.
		expect(seen).toMatchObject({ ...closed, extensible: false, write: "ERR:TypeError", added: undefined });
		expect(Object.isExtensible(api.store)).toBe(true);
		expect(Object.isFrozen(api.store)).toBe(false);
	});
});
