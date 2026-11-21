/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-node-callbacks.test.vitest.mjs
 *	@Date: 2026-11-17T13:21:32-08:00 (1794950492)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T13:33:22-08:00 (1794951202)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Callbacks of Node's callback-style APIs (fs, dns, crypto) run in the `context.run()` flow and as the
 * caller that handed them in, on both runtimes and in every permission mode.
 *
 * @description
 * Node calls these callbacks from the event loop with an empty stack, past every boundary the live runtime patched
 * before (promise jobs, timers, listeners). Each case below starts one API call with a callback; two `run()` flows are
 * opened one after the other, each starting the same case, and each callback reports the context it sees and who
 * called it. Each flow must see only its own context and its own caller.
 *
 * Fixture (written to tmp/): `cases.mjs` holds one starter per API, shared by the probe module and the host-code
 * tests; `one.*` and `two.*` are the same probe file mounted twice, so a report names the module whose callback ran;
 * `who.caller()` reports `{ tag: context.tag, caller: metadata.caller() api path }`.
 */

import path from "node:path";
import fs, { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { stat as namedStat } from "node:fs";
import dns from "node:dns";
import crypto from "node:crypto";
import util from "node:util";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "context-live-node-callbacks");
const require = createRequire(import.meta.url);

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

/**
 * One starter per covered API: `(env, done)` makes the call with a callback that ends in `done()`. `env` carries a
 * scratch folder, a readable file, key pairs and a resolver pointed at a closed local port (so dns queries fail fast).
 * @type {string[]}
 */
const CASES = [
	'import fs from "node:fs";',
	'import dns from "node:dns";',
	'import crypto from "node:crypto";',
	'import path from "node:path";',
	"// A path no other case or copy of this file uses (the live runtime loads a copy of this file per instance).",
	'const fresh = (env) => path.join(env.dir, "f-" + crypto.randomUUID());',
	'const made = (env) => { const file = fresh(env); fs.writeFileSync(file, "x"); return file; };',
	"// Runs a call on a fresh file descriptor, closing it once the call's callback has run.",
	'const onFd = (env, call, done) => { const handle = fs.openSync(made(env), "r+"); call(handle, () => { fs.closeSync(handle); done(); }); };',
	"export const fsCases = {",
	"\taccess: (env, done) => fs.access(env.file, done),",
	'\tappendFile: (env, done) => fs.appendFile(fresh(env), "x", done),',
	"\tchmod: (env, done) => fs.chmod(made(env), 0o644, done),",
	"\tchown: (env, done) => fs.chown(made(env), process.getuid(), process.getgid(), done),",
	'\tclose: (env, done) => fs.close(fs.openSync(made(env), "r"), done),',
	"\tcopyFile: (env, done) => fs.copyFile(env.file, fresh(env), done),",
	"\texists: (env, done) => fs.exists(env.file, done),",
	"\tfchmod: (env, done) => onFd(env, (handle, next) => fs.fchmod(handle, 0o644, next), done),",
	"\tfchown: (env, done) => onFd(env, (handle, next) => fs.fchown(handle, process.getuid(), process.getgid(), next), done),",
	"\tfdatasync: (env, done) => onFd(env, (handle, next) => fs.fdatasync(handle, next), done),",
	"\tfstat: (env, done) => onFd(env, (handle, next) => fs.fstat(handle, next), done),",
	"\tfsync: (env, done) => onFd(env, (handle, next) => fs.fsync(handle, next), done),",
	"\tftruncate: (env, done) => onFd(env, (handle, next) => fs.ftruncate(handle, 0, next), done),",
	"\tfutimes: (env, done) => onFd(env, (handle, next) => fs.futimes(handle, 1, 1, next), done),",
	"\tlchown: (env, done) => fs.lchown(made(env), process.getuid(), process.getgid(), done),",
	"\tlink: (env, done) => fs.link(made(env), fresh(env), done),",
	"\tlstat: (env, done) => fs.lstat(env.file, done),",
	"\tlutimes: (env, done) => fs.lutimes(made(env), 1, 1, done),",
	"\tmkdir: (env, done) => fs.mkdir(fresh(env), done),",
	'\tmkdtemp: (env, done) => fs.mkdtemp(path.join(env.dir, "d-"), done),',
	"\topen: (env, done) => fs.open(env.file, (error, handle) => fs.closeSync(handle) ?? done()),",
	"\topendir: (env, done) => fs.opendir(env.dir, (error, dir) => dir.closeSync() ?? done()),",
	"\tread: (env, done) => onFd(env, (handle, next) => fs.read(handle, Buffer.alloc(1), 0, 1, 0, next), done),",
	"\treaddir: (env, done) => fs.readdir(env.dir, done),",
	"\treadFile: (env, done) => fs.readFile(env.file, done),",
	"\treadlink: (env, done) => { const link = fresh(env); fs.symlinkSync(env.file, link); fs.readlink(link, done); },",
	"\treadv: (env, done) => onFd(env, (handle, next) => fs.readv(handle, [Buffer.alloc(1)], 0, next), done),",
	"\trealpath: (env, done) => fs.realpath(env.file, done),",
	'\t"realpath.native": (env, done) => fs.realpath.native(env.file, done),',
	"\trename: (env, done) => fs.rename(made(env), fresh(env), done),",
	"\trm: (env, done) => fs.rm(made(env), done),",
	"\trmdir: (env, done) => { const dir = fresh(env); fs.mkdirSync(dir); fs.rmdir(dir, done); },",
	"\tstat: (env, done) => fs.stat(env.file, done),",
	"\tstatfs: (env, done) => fs.statfs(env.dir, done),",
	"\tsymlink: (env, done) => fs.symlink(env.file, fresh(env), done),",
	"\ttruncate: (env, done) => fs.truncate(made(env), 0, done),",
	"\tunlink: (env, done) => fs.unlink(made(env), done),",
	"\tutimes: (env, done) => fs.utimes(made(env), 1, 1, done),",
	'\twrite: (env, done) => onFd(env, (handle, next) => fs.write(handle, "y", next), done),',
	'\twriteFile: (env, done) => fs.writeFile(fresh(env), "x", done),',
	'\twritev: (env, done) => onFd(env, (handle, next) => fs.writev(handle, [Buffer.from("y")], next), done),',
	"\t// The handle is busy until the read's callback returns, so it is closed asynchronously.",
	'\t"Dir.read": (env, done) => { const dir = fs.opendirSync(env.dir); dir.read(() => { done(); dir.close(() => {}); }); },',
	'\t"Dir.close": (env, done) => fs.opendirSync(env.dir).close(done),',
	'\t"WriteStream.write": (env, done) => { const out = fs.createWriteStream(fresh(env)); out.write("x", () => out.end(done)); }',
	"};",
	'const query = (method) => (env, done) => dns[method]("example.invalid", () => done());',
	'const resolverQuery = (method) => (env, done) => env.resolver[method]("example.invalid", () => done());',
	'const RESOLVE = ["resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa", "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv", "resolveTlsa", "resolveTxt"];',
	"export const dnsCases = {",
	'\tlookup: (env, done) => dns.lookup("localhost", () => done()),',
	'\tlookupService: (env, done) => dns.lookupService("127.0.0.1", 22, () => done()),',
	'\treverse: (env, done) => dns.reverse("127.0.0.1", () => done()),',
	'\t"Resolver.reverse": (env, done) => env.resolver.reverse("127.0.0.1", () => done()),',
	"\t...Object.fromEntries(RESOLVE.map((method) => [method, query(method)])),",
	'\t...Object.fromEntries(RESOLVE.map((method) => ["Resolver." + method, resolverQuery(method)]))',
	"};",
	"export const cryptoCases = {",
	"\tcheckPrime: (env, done) => crypto.checkPrime(7n, done),",
	'\tgenerateKey: (env, done) => crypto.generateKey("hmac", { length: 64 }, done),',
	'\tgenerateKeyPair: (env, done) => crypto.generateKeyPair("ed25519", done),',
	"\tgeneratePrime: (env, done) => crypto.generatePrime(16, done),",
	'\thkdf: (env, done) => crypto.hkdf("sha256", "key", "salt", "info", 8, done),',
	'\tpbkdf2: (env, done) => crypto.pbkdf2("a", "b", 1, 8, "sha256", done),',
	"\trandomBytes: (env, done) => crypto.randomBytes(8, done),",
	"\trandomFill: (env, done) => crypto.randomFill(Buffer.alloc(4), done),",
	"\trandomInt: (env, done) => crypto.randomInt(10, done),",
	'\tscrypt: (env, done) => crypto.scrypt("a", "b", 8, done),',
	'\tsign: (env, done) => crypto.sign(null, Buffer.from("x"), env.ed25519.privateKey, done),',
	'\tverify: (env, done) => crypto.verify(null, Buffer.from("x"), env.ed25519.publicKey, env.signature, done),',
	"\t...(crypto.argon2",
	'\t\t? { argon2: (env, done) => crypto.argon2("argon2id", { message: "p", nonce: Buffer.alloc(16), parallelism: 1, tagLength: 32, memory: 8, passes: 1 }, done) }',
	"\t\t: {}),",
	"\t...(crypto.diffieHellman.length >= 2",
	"\t\t? { diffieHellman: (env, done) => crypto.diffieHellman({ privateKey: env.x25519[0].privateKey, publicKey: env.x25519[1].publicKey }, done) }",
	"\t\t: {}),",
	"\t...(crypto.encapsulate && env_hasMlKem()",
	"\t\t? {",
	"\t\t\t\tencapsulate: (env, done) => crypto.encapsulate(env.mlKem.publicKey, done),",
	"\t\t\t\tdecapsulate: (env, done) => crypto.decapsulate(env.mlKem.privateKey, env.ciphertext, done)",
	"\t\t\t}",
	"\t\t: {})",
	"};",
	"function env_hasMlKem() {",
	'\ttry { crypto.generateKeyPairSync("ml-kem-512"); return true; } catch { return false; }',
	"}",
	"export const CASES = { fs: fsCases, dns: dnsCases, crypto: cryptoCases };",
	"export function makeEnv(dir, file) {",
	'\tconst ed25519 = crypto.generateKeyPairSync("ed25519");',
	'\tconst x25519 = [crypto.generateKeyPairSync("x25519"), crypto.generateKeyPairSync("x25519")];',
	"\tconst resolver = new dns.Resolver({ timeout: 50, tries: 1 });",
	'\tresolver.setServers(["127.0.0.1:9"]);',
	'\tconst env = { dir, file, ed25519, x25519, resolver, signature: crypto.sign(null, Buffer.from("x"), ed25519.privateKey) };',
	"\tif (crypto.encapsulate && env_hasMlKem()) {",
	'\t\tenv.mlKem = crypto.generateKeyPairSync("ml-kem-512");',
	"\t\tenv.ciphertext = crypto.encapsulate(env.mlKem.publicKey).ciphertext;",
	"\t}",
	"\treturn env;",
	"}"
];

/**
 * The probe: starts a case from module code; the callback reports from there.
 * @type {string[]}
 */
const PROBE = [
	'import { self } from "@cldmv/slothlet/runtime";',
	'import { CASES } from "../../cases.mjs";',
	"export function via(group, name, env) {",
	"\treturn new Promise((resolve, reject) => CASES[group][name](env, () => Promise.resolve(self.who.caller()).then(resolve, reject)));",
	"}"
];

let cases;
let env;
let savedServers;

beforeAll(async () => {
	rmSync(ROOT, { recursive: true, force: true });
	write("cases.mjs", CASES);
	write("api/one/one.mjs", PROBE);
	write("api/two/two.mjs", PROBE);
	write("api/who/who.mjs", [
		'import { self, context } from "@cldmv/slothlet/runtime";',
		"export function caller() {",
		"\tconst found = self.slothlet.metadata.caller();",
		'\tconst at = found ? (found.apiPath ?? (Array.isArray(found.path) ? found.path.join(".") : "?")) : null;',
		"\treturn { tag: context.tag ?? null, caller: at };",
		"}"
	]);
	mkdirSync(path.join(ROOT, "scratch"), { recursive: true });
	write("scratch/readable.txt", ["readable"]);
	cases = await import(pathToFileURL(path.join(ROOT, "cases.mjs")).href);
	env = cases.makeEnv(path.join(ROOT, "scratch"), path.join(ROOT, "scratch", "readable.txt"));
	// The module-level dns queries go to a closed local port, so they fail at once instead of reaching the network.
	savedServers = dns.getServers();
	dns.setServers(["127.0.0.1:9"]);
});

afterAll(() => {
	dns.setServers(savedServers);
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Every case, as `[group, name]`.
 * @returns {Array<[string, string]>} The cases.
 */
const allCases = () => Object.entries(cases.CASES).flatMap(([group, set]) => Object.keys(set).map((name) => [group, name]));

const PERMISSIONS = [
	["no permissions config", undefined],
	["permissions off", { mode: "off" }],
	["permissions disabled", { mode: "disabled" }],
	["permissions on", { mode: "on" }]
];

const MATRIX = ["async", "live"].flatMap((runtime) => PERMISSIONS.map(([name, permissions]) => ({ runtime, name, permissions })));

describe.each(MATRIX)("Node callback APIs keep the run > $runtime / $name", ({ runtime, permissions }) => {
	let api;

	beforeAll(async () => {
		api = await slothlet({
			base: path.join(ROOT, "api"),
			runtime,
			mode: "eager",
			silent: true,
			context: { tag: "base" },
			...(permissions ? { permissions } : {})
		});
	});

	afterAll(async () => {
		await api?.shutdown();
		api = null;
	});

	afterEach(async () => {
		expect(await api.who.caller()).toEqual({ tag: "base", caller: null });
	});

	const run = (tag, fn) => api.slothlet.context.run({ tag }, fn);

	/**
	 * Both flows' reports for one case, or what went wrong: a throw, or a callback that never ran within 5 s.
	 * @param {function(string): Promise<*>} start - Starts the case in a `run()` with the tag given.
	 * @returns {Promise<Array<*>>} The two reports, or `[{ error }]`.
	 */
	const both = (start) => {
		let timer;
		const late = new Promise((resolve) => (timer = setTimeout(() => resolve([{ error: "callback never ran" }]), 5000)));
		const seen = Promise.all([start("one"), start("two")]).catch((error) => [{ error: String(error?.message ?? error) }]);
		return Promise.race([seen, late]).finally(() => clearTimeout(timer));
	};

	it("a module's callback sees its own run and caller, with a second run open beside it", async () => {
		const failures = [];
		for (const [group, name] of allCases()) {
			const seen = await both((tag) => run(tag, () => (tag === "one" ? api.one : api.two).via(group, name, env)));
			const expected = [
				{ tag: "one", caller: "one.via" },
				{ tag: "two", caller: "two.via" }
			];
			if (JSON.stringify(seen) !== JSON.stringify(expected)) failures.push({ api: `${group}.${name}`, seen });
		}
		expect(failures).toEqual([]);
	}, 120000);

	it("host code's callback sees its own run, with a second run open beside it", async () => {
		const failures = [];
		const read = () => api.slothlet.context.get().tag;
		for (const [group, name] of allCases()) {
			const start = (tag) => run(tag, () => new Promise((resolve) => cases.CASES[group][name](env, () => resolve(read()))));
			const seen = await both(start);
			if (seen[0] !== "one" || seen[1] !== "two") failures.push({ api: `${group}.${name}`, seen });
		}
		expect(failures).toEqual([]);
	}, 120000);

	// Node serves overlapping `crypto.randomInt(…, cb)` calls from one shared cache of random bytes; once it runs out, every
	// waiting callback is called from the async context of the call that started the refill. 1100 calls per flow outrun
	// the cache (1024 values), so the second flow's calls all wait on a refill the first flow started.
	const RANDOM_INT_CALLS = 1100;

	it("overlapping crypto.randomInt calls that outrun Node's shared cache each see their own run, from host code", async () => {
		const read = () => api.slothlet.context.get().tag;
		const start = (tag) =>
			run(tag, () =>
				Promise.all(Array.from({ length: RANDOM_INT_CALLS }, () => new Promise((resolve) => crypto.randomInt(10, () => resolve(read())))))
			);
		const [one, two] = await Promise.all([start("one"), start("two")]);
		expect(new Set(one)).toEqual(new Set(["one"]));
		expect(new Set(two)).toEqual(new Set(["two"]));
	});

	it("crypto.randomInt calls from module code waiting on a refill another flow started each see their own run and caller", async () => {
		// The host empties the cache outside every run, so the refill it starts is the one both flows' calls wait on.
		const draining = Promise.all(Array.from({ length: RANDOM_INT_CALLS }, () => new Promise((resolve) => crypto.randomInt(10, resolve))));
		const seen = await Promise.all([
			run("one", () => api.one.via("crypto", "randomInt", env)),
			run("two", () => api.two.via("crypto", "randomInt", env))
		]);
		await draining;
		expect(seen).toEqual([
			{ tag: "one", caller: "one.via" },
			{ tag: "two", caller: "two.via" }
		]);
	});

	it("host code's callback outside every run sees the instance's own context", async () => {
		const read = () => api.slothlet.context.get().tag;
		const hold = Promise.withResolvers();
		const open = run("one", () => api.one.via("crypto", "randomBytes", env).then(() => hold.promise));
		const seen = await new Promise((resolve) => fs.stat(env.file, () => resolve(read())));
		hold.resolve();
		await open;
		expect(seen).toBe("base");
	});

	it("util.promisify of a patched function keeps the run", async () => {
		const promisified = util.promisify(fs.stat);
		const seen = await Promise.all(
			["one", "two"].map((tag) => run(tag, () => promisified(env.file).then(() => api.slothlet.context.get().tag)))
		);
		expect(seen).toEqual(["one", "two"]);
	});
});

describe("Node callback APIs > the patch itself", () => {
	const make = (runtime = "live") =>
		slothlet({ base: path.join(ROOT, "api"), runtime, mode: "eager", silent: true, context: { tag: "base" } });

	it("every non-sync function of fs, dns and crypto is covered, or listed as carried by Node or as taking no callback", async () => {
		// Callbacks Node already delivers through a carried boundary (an emitter, nextTick, a promise reaction), and
		// functions that take no completion callback.
		const notPatched = new Set([
			"fs.cp",
			"fs.glob",
			"fs.watch",
			"fs.watchFile",
			"fs.unwatchFile",
			"fs.createReadStream",
			"fs.createWriteStream",
			"fs.openAsBlob",
			"fs.lchmod",
			"fs._toUnixTimestamp",
			"dns.getDefaultResultOrder",
			"dns.setDefaultResultOrder",
			"dns.getServers",
			"dns.setServers"
		]);
		const covered = new Set(allCases().map(([group, name]) => `${group}.${name}`));
		const callbackFree = (name) =>
			!/^(argon2|checkPrime|decapsulate|diffieHellman|encapsulate|generate|hkdf|pbkdf2|random(Bytes|Fill|Int)$|scrypt|sign$|verify$)/.test(
				name
			);
		const missing = [];
		for (const [group, mod] of [
			["fs", fs],
			["dns", dns],
			["crypto", crypto]
		]) {
			for (const name of Object.keys(mod)) {
				if (typeof mod[name] !== "function" || /Sync$/.test(name) || /^[A-Z]/.test(name)) continue;
				const id = `${group}.${name}`;
				if (covered.has(id) || notPatched.has(id)) continue;
				if (group === "crypto" && callbackFree(name)) continue;
				// Node 22's `diffieHellman` takes no callback.
				if (id === "crypto.diffieHellman" && crypto.diffieHellman.length < 2) continue;
				missing.push(id);
			}
		}
		expect(missing).toEqual([]);
	});

	it("is not installed with no live instance, and is removed when the last one shuts down", async () => {
		const original = fs.stat;
		const asyncApi = await make("async");
		expect(fs.stat).toBe(original);
		await asyncApi.shutdown();

		const first = await make();
		const patched = fs.stat;
		expect(patched).not.toBe(original);
		const second = await make();
		expect(fs.stat).toBe(patched);
		await first.shutdown();
		// The second instance still holds it.
		expect(fs.stat).toBe(patched);
		await second.shutdown();
		expect(fs.stat).toBe(original);
	});

	it("keeps name, length and promisify support, and is the same function for require, default and named imports", async () => {
		const before = { stat: fs.stat, exists: fs.exists, read: fs.read, resolve4: dns.resolve4, randomBytes: crypto.randomBytes };
		const api = await make();
		try {
			expect(fs.stat).not.toBe(before.stat);
			for (const [name, original] of Object.entries(before)) {
				const host = name === "resolve4" ? dns : name === "randomBytes" ? crypto : fs;
				expect(host[name].name).toBe(original.name);
				expect(host[name].length).toBe(original.length);
			}
			expect(fs.exists[util.promisify.custom]).toBe(before.exists[util.promisify.custom]);
			expect(await util.promisify(fs.exists)(env.file)).toBe(true);
			const handle = fs.openSync(env.file, "r");
			try {
				expect(Object.keys(await util.promisify(fs.read)(handle, Buffer.alloc(1), 0, 1, 0))).toEqual(["bytesRead", "buffer"]);
			} finally {
				fs.closeSync(handle);
			}
			expect(require("node:fs").stat).toBe(fs.stat);
			// ES module bindings of a builtin are refreshed when the patch goes in and when it comes out.
			expect(namedStat).toBe(fs.stat);
			expect(typeof fs.realpath.native).toBe("function");
			expect(fs.realpath.native).not.toBe(before.stat);
		} finally {
			await api.shutdown();
		}
		expect(fs.stat).toBe(before.stat);
		expect(namedStat).toBe(before.stat);
	});

	it("patches crypto.randomInt alone for async instances, held while any instance needs it", async () => {
		const original = { stat: fs.stat, randomInt: crypto.randomInt, randomBytes: crypto.randomBytes };
		const first = await make("async");
		const bound = crypto.randomInt;
		expect(bound).not.toBe(original.randomInt);
		expect(bound.name).toBe(original.randomInt.name);
		expect(bound.length).toBe(original.randomInt.length);
		expect(fs.stat).toBe(original.stat);
		expect(crypto.randomBytes).toBe(original.randomBytes);
		const second = await make("async");
		expect(crypto.randomInt).toBe(bound);
		await first.shutdown();
		expect(crypto.randomInt).toBe(bound);
		// A live instance beside an async one: the same wrapper does both jobs, and fs is patched for the live one.
		const live = await make();
		expect(crypto.randomInt).toBe(bound);
		expect(fs.stat).not.toBe(original.stat);
		await second.shutdown();
		expect(crypto.randomInt).toBe(bound);
		await live.shutdown();
		expect(crypto.randomInt).toBe(original.randomInt);
		expect(fs.stat).toBe(original.stat);
		// And the other way round: the live instance goes first, the async one keeps randomInt bound.
		const live2 = await make();
		const async2 = await make("async");
		await live2.shutdown();
		expect(fs.stat).toBe(original.stat);
		expect(crypto.randomInt).not.toBe(original.randomInt);
		await async2.shutdown();
		expect(crypto.randomInt).toBe(original.randomInt);
		expect(typeof crypto.randomInt(10)).toBe("number");
	});

	it("hands crypto.randomInt's callback the same value and errors as Node on the async runtime", async () => {
		const api = await make("async");
		try {
			const values = await Promise.all(
				[[10], [5, 7], [-3, -1]].map(
					(args) =>
						new Promise((resolve, reject) => crypto.randomInt(...args, (error, value) => (error ? reject(error) : resolve([args, value]))))
				)
			);
			for (const [args, value] of values) {
				const [min, max] = args.length === 1 ? [0, args[0]] : args;
				expect(Number.isSafeInteger(value) && value >= min && value < max).toBe(true);
			}
			// Malformed calls throw as Node's own call does, and the callback is never called.
			let called = false;
			expect(() => crypto.randomInt(5, 1, () => (called = true))).toThrow(RangeError);
			expect(() => crypto.randomInt(() => (called = true))).toThrow(TypeError);
			expect(() => crypto.randomInt(1.5, () => (called = true))).toThrow(TypeError);
			await new Promise((resolve) => setImmediate(resolve));
			expect(called).toBe(false);
		} finally {
			await api.shutdown();
		}
	});

	it("passes calls without a callback straight through", async () => {
		const api = await make();
		try {
			const dir = fs.opendirSync(env.dir);
			await expect(dir.read()).resolves.not.toBeUndefined();
			await dir.close();
			expect(() => fs.stat(env.file)).toThrow(TypeError);
		} finally {
			await api.shutdown();
		}
	});

	it("steps aside for a library that patched after it, and leaves that library's function in place", async () => {
		const original = fs.stat;
		const api = await make();
		const slothletStat = fs.stat;
		let libraryCalls = 0;
		const library = function stat(...args) {
			libraryCalls++;
			return slothletStat.apply(this, args);
		};
		fs.stat = library;
		await api.shutdown();
		// Not put back over the library's function, and slothlet's wrapper under it now passes calls through.
		expect(fs.stat).toBe(library);
		await new Promise((resolve, reject) => fs.stat(env.file, (error) => (error ? reject(error) : resolve())));
		expect(libraryCalls).toBe(1);

		// The library restores what it found; a later instance installs over Node's own function and removes cleanly.
		fs.stat = slothletStat;
		const again = await make();
		const seen = await Promise.all(
			["one", "two"].map((tag) =>
				again.slothlet.context.run(
					{ tag },
					() => new Promise((resolve) => fs.stat(env.file, () => resolve(again.slothlet.context.get().tag)))
				)
			)
		);
		expect(seen).toEqual(["one", "two"]);
		await again.shutdown();
		expect(fs.stat).toBe(original);
	});
});
