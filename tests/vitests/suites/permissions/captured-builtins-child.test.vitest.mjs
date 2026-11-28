/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/captured-builtins-child.test.vitest.mjs
 *	@Date: 2026-11-13T01:04:06-08:00 (1794560646)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:11-08:00 (1795869131)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview slothlet builds, adds to, reloads and shuts down an api, records the files it loads and makes its
 * errors with the built-ins it loaded with, whatever the globals hold by then.
 *
 * A child process (replacing the globals would disturb vitest itself) loads slothlet, then replaces with functions that
 * throw: the global constructors and functions `Map`, `Set`, `WeakMap`, `WeakSet`, `WeakRef`, `Promise`, `Symbol`,
 * `Proxy`, `URL`, `URLSearchParams`, `String`, `Boolean`, `Number`, `BigInt`, `Date`, `RegExp`, `Error` and the other
 * error constructors, `ArrayBuffer`, `SharedArrayBuffer`, `DataView`, the typed arrays, `FinalizationRegistry`,
 * `Iterator`, `TextDecoder`, `TextEncoder`, `Blob`, `EventTarget`, `MessageChannel`, `queueMicrotask`,
 * `structuredClone`, `setTimeout`, `setImmediate`, `decodeURIComponent`, `encodeURIComponent`, `parseInt`, `isNaN`
 * and `Buffer`; every static function of `Object`, `Array`, `Reflect`, `JSON`, `Math`, `Intl`, `Promise`, `Symbol`,
 * `String`, `Number`, `Date`, `Error`, `ArrayBuffer` and `Iterator`; the functions of `process` slothlet
 * calls; and `navigator` with one whose locale getters throw. Then it runs: building an instance (`slothlet.mjs`,
 * `helpers/config`, `builders/`, `modes/`, `processors/flatten` and `processors/loader`), a CommonJS file
 * (`helpers/instance-imports`), a rule-denied call (`errors.mjs`, `i18n/translations`), a call with a hook on it
 * (`handlers/hook-manager`), a `context.run()` whose data holds a `Map` (copied for the call), `api.slothlet.api.add`
 * (`builders/api-assignment`, `builders/modes-processor`), `api.slothlet.reload()`, a refused add and a refused
 * config, and `shutdown()`. The same probe with nothing replaced gives the expected answers.
 *
 * The probe builds and shuts down one instance before replacing anything: `index.mjs` loads slothlet's own files with
 * the first instance, and they take their copies when they load. Left in place: `Promise.resolve` (`KEPT`), which
 * `Promise.all` and the other combinators read off the constructor themselves; the static functions of `Buffer`, which
 * Node's own `fs` and streams read off it (`Buffer.allocUnsafe`, `Buffer.from`); and `Error.prepareStackTrace` where
 * something set one, which the engine calls to format a stack.
 *
 * A second replacement replaces, after the warm-up instance, the functions of the Node built-in modules slothlet calls
 * (`fs`, `fs/promises`, `path`, `url`, `util` with `util.types`, `module`, `crypto`, `vm`, `v8` with
 * `v8.promiseHooks`, `timers`, `child_process`, `os`, `events`, `async_hooks`) on Node's module objects, and refreshes the
 * ES module namespaces with `module.syncBuiltinESMExports()`. Each stand-in throws, and is listed, when slothlet's own
 * code calls it; Node's own code and the probe's still get the original. Every step answers as with nothing replaced,
 * and no stand-in is called by slothlet. Left in place there: the classes those modules export (named with a capital:
 * `Module`, whose `_load`, `_resolveFilename` and `_cache` slothlet patches or reads as they are on purpose, and the
 * `AsyncResource` and `AsyncLocalStorage` the boundary patch layers onto), and `util.inspect.custom`, a symbol.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "captured-builtins-child");
const PROBE = path.join(ROOT, "probe.mjs");

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

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("api/math/math.mjs", ["export function add(a, b) {", "\treturn a + b;", "}"]);
	write("api/folder/folder.mjs", ["export function only() {", '\treturn "flattened";', "}"]);
	write("api/legacy/legacy.cjs", ["module.exports = {", "\tgreet(name) {", '\t\treturn "hi " + name;', "\t}", "};"]);
	write("api/guest/guest.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function tryMath() {",
		"\treturn self.math.add(1, 1);",
		"}"
	]);
	write("api/ctx/ctx.mjs", [
		'import { context } from "@cldmv/slothlet/runtime";',
		"export function size() {",
		"\t// Told by its tag: the probe replaces the global Map while this runs.",
		"\treturn Object.prototype.toString.call(context.table) === '[object Map]' ? context.table.size : 'no map';",
		"}"
	]);
	write("extra/mul.mjs", ["export function mul(a, b) {", "\treturn a * b;", "}"]);
	write("probe.mjs", [
		'import slothlet from "@cldmv/slothlet";',
		"const [mode, runtime, attribution, replace] = process.argv.slice(2);",
		'const API = new URL("./api/", import.meta.url).pathname;',
		'const EXTRA = new URL("./extra/", import.meta.url).pathname;',
		"const saved = [];",
		"const restores = [];",
		"// Taken before anything is replaced: the probe itself runs on none of the replaced functions.",
		"const CONSTRUCTORS = ['Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'Promise', 'Symbol', 'Proxy', 'URL', 'URLSearchParams',",
		"\t'String', 'Boolean', 'Number', 'BigInt', 'Date', 'RegExp', 'Error', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError',",
		"\t'TypeError', 'URIError', 'AggregateError', 'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array',",
		"\t'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float16Array', 'Float32Array', 'Float64Array',",
		"\t'BigInt64Array', 'BigUint64Array', 'FinalizationRegistry', 'Iterator', 'TextDecoder', 'TextEncoder', 'Blob', 'EventTarget',",
		"\t'MessageChannel', 'queueMicrotask', 'structuredClone', 'setTimeout', 'setImmediate', 'decodeURIComponent',",
		"\t'encodeURIComponent', 'parseInt', 'isNaN', 'Buffer'].filter((name) => typeof globalThis[name] === 'function');",
		"const HOLDERS = [Object, Array, Reflect, JSON, Math, Intl, Promise, Symbol, String, Number, Date, Error, ArrayBuffer];",
		"if (typeof Iterator === 'function') HOLDERS.push(Iterator);",
		"// The functions of process slothlet calls; the rest are Node's own (it calls emitWarning, for one, itself).",
		"const PROCESS = ['cwd', 'getBuiltinModule', 'nextTick', 'binding', 'kill', 'getuid', 'exit', 'send'].filter((name) => typeof process[name] === 'function');",
		"const exit = process.exit.bind(process);",
		"const table = new Map([['a', 1], ['b', 2]]);",
		"// Promise.all and the others read Promise.resolve off the constructor themselves.",
		"const KEPT = [Promise.resolve];",
		"const statics = [];",
		"for (const holder of HOLDERS) {",
		"\tfor (const name of Object.getOwnPropertyNames(holder)) {",
		"\t\tconst d = Object.getOwnPropertyDescriptor(holder, name);",
		"\t\t// Error.prepareStackTrace, where something set one, is what the engine calls to format a stack, not one of Error's functions.",
		"\t\tif (holder === Error && name === 'prepareStackTrace') continue;",
		"\t\tif (typeof d.value === 'function' && d.writable && !KEPT.includes(d.value)) statics.push([holder, name]);",
		"\t}",
		"}",
		"const ProbeError = Error;",
		"const { getOwnPropertyDescriptor, defineProperty } = Object;",
		"const thrower = (name) => function () { throw new ProbeError('replaced ' + name); };",
		"function replaceAll() {",
		"\tfor (const [holder, name] of statics) { saved.push([holder, name, holder[name]]); holder[name] = thrower(name); }",
		"\tfor (const name of CONSTRUCTORS) { saved.push([globalThis, name, globalThis[name]]); globalThis[name] = thrower(name); }",
		"\tfor (const name of PROCESS) { saved.push([process, name, process[name]]); process[name] = thrower('process.' + name); }",
		"\tconst navigator = getOwnPropertyDescriptor(globalThis, 'navigator');",
		"\tif (navigator) {",
		"\t\tconst replaced = { get language() { throw new ProbeError('replaced navigator'); }, get languages() { throw new ProbeError('replaced navigator'); } };",
		"\t\tdefineProperty(globalThis, 'navigator', { value: replaced, configurable: true, writable: true });",
		"\t\trestores.push(() => defineProperty(globalThis, 'navigator', navigator));",
		"\t}",
		"}",
		"// The functions of Node's built-in modules slothlet calls, replaced on the modules themselves.",
		"const NODE_IDS = ['fs', 'fs/promises', 'path', 'url', 'util', 'module', 'crypto', 'vm', 'v8', 'timers', 'child_process', 'os', 'events', 'async_hooks'];",
		"const OWN_SOURCE = process.cwd() + '/src/';",
		"const nodeHits = new Set();",
		"const { apply } = Reflect;",
		"const syncBuiltinESMExports = process.getBuiltinModule('node:module').syncBuiltinESMExports;",
		"// The frame that called the stand-in: slothlet's own source, by its path or its file URL.",
		"const calledBySlothlet = () => {",
		"\tconst caller = String(new ProbeError().stack).split('\\n')[3] ?? '';",
		"\treturn caller.includes(OWN_SOURCE);",
		"};",
		"function replaceNode() {",
		"\tconst holders = [];",
		"\tfor (const id of NODE_IDS) {",
		"\t\tconst mod = process.getBuiltinModule('node:' + id);",
		"\t\tholders.push([id, mod]);",
		"\t\tif (id === 'util') holders.push(['util.types', mod.types]);",
		"\t\tif (id === 'v8' && mod.promiseHooks) holders.push(['v8.promiseHooks', mod.promiseHooks]);",
		"\t}",
		"\tfor (const [id, holder] of holders) {",
		"\t\tfor (const name of Object.getOwnPropertyNames(holder)) {",
		"\t\t\tconst d = Object.getOwnPropertyDescriptor(holder, name);",
		"\t\t\tif (typeof d.value !== 'function' || !d.writable || /^[A-Z]/.test(name)) continue;",
		"\t\t\tconst original = d.value;",
		"\t\t\tsaved.push([holder, name, original]);",
		"\t\t\tholder[name] = function (...args) {",
		"\t\t\t\tif (calledBySlothlet()) {",
		"\t\t\t\t\tnodeHits.add(id + '.' + name);",
		"\t\t\t\t\tthrow new ProbeError('replaced ' + id + '.' + name);",
		"\t\t\t\t}",
		"\t\t\t\treturn apply(original, this, args);",
		"\t\t\t};",
		"\t\t}",
		"\t}",
		"\tsyncBuiltinESMExports();",
		"\trestores.push(() => syncBuiltinESMExports());",
		"}",
		"function restoreAll() {",
		"\tfor (let i = saved.length - 1; i >= 0; i--) saved[i][0][saved[i][1]] = saved[i][2];",
		"\tfor (const restore of restores) restore();",
		"}",
		"const step = async (fn) => {",
		"\ttry {",
		"\t\treturn await fn();",
		"\t} catch (error) {",
		"\t\treturn error?.code ?? 'threw ' + error?.message;",
		"\t}",
		"};",
		"const out = {};",
		"// slothlet's own files load with the first instance (index.mjs imports them then): one built and shut down first.",
		"const warm = await slothlet({ base: EXTRA, mode, runtime });",
		"await warm.shutdown();",
		"if (replace === 'yes') replaceAll();",
		"if (replace === 'node') replaceNode();",
		"let api = null;",
		"out.built = await step(async () => {",
		"\tapi = await slothlet({",
		"\t\tbase: API, mode, runtime, hook: true,",
		"\t\tpermissions: { policy: 'allow', rules: [{ caller: 'guest.**', target: 'math.**', effect: 'deny' }], caller: { attribution } }",
		"\t});",
		"\treturn 'built';",
		"});",
		"if (api) {",
		"\tout.add = await step(() => api.math.add(2, 3));",
		"\tout.flatten = await step(() => api.folder.only());",
		"\tout.cjs = await step(() => api.legacy.greet('x'));",
		"\tout.denied = await step(() => api.guest.tryMath());",
		"\tout.hooked = await step(async () => {",
		"\t\tapi.slothlet.hook.on('math.add:after', ({ result }) => result * 10, { id: 'times-ten' });",
		"\t\tconst result = await api.math.add(1, 2);",
		"\t\tapi.slothlet.hook.remove({ id: 'times-ten' });",
		"\t\treturn result;",
		"\t});",
		"\tout.context = await step(() => api.slothlet.context.run({ table }, () => api.ctx.size()));",
		"\tout.added = await step(async () => {",
		"\t\tawait api.slothlet.api.add('extra', EXTRA);",
		"\t\treturn api.extra.mul(2, 3);",
		"\t});",
		"\tout.refusedAdd = await step(() => api.slothlet.api.add('slothlet', EXTRA));",
		"\tout.reloaded = await step(async () => {",
		"\t\tawait api.slothlet.reload();",
		"\t\treturn api.math.add(4, 5);",
		"\t});",
		"\tout.shutdown = await step(async () => {",
		"\t\tawait api.shutdown();",
		"\t\treturn 'done';",
		"\t});",
		"}",
		"out.refusedConfig = await step(() => slothlet({ base: API + 'missing' }));",
		"restoreAll();",
		"if (replace === 'node') out.nodeHits = [...nodeHits];",
		"process.stdout.write(JSON.stringify(out) + '\\n');",
		"exit(0);"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Run the probe in a child process.
 * @param {string[]} args - mode, runtime, attribution, and whether to replace the built-ins.
 * @returns {object} What each step answered.
 */
function probe(args) {
	const result = spawnSync(process.execPath, ["--conditions=slothlet-dev", PROBE, ...args], {
		cwd: process.cwd(),
		env: process.env,
		encoding: "utf8",
		timeout: 120000
	});
	expect(result.status, result.stderr).toBe(0);
	return JSON.parse(result.stdout.trim().split("\n").pop());
}

const CONFIGS = [];
for (const mode of ["eager", "lazy"]) {
	for (const runtime of ["async", "live"]) {
		for (const attribution of ["precise", "fast"]) CONFIGS.push({ mode, runtime, attribution });
	}
}

describe.each(CONFIGS)("built-ins replaced after slothlet loaded ($mode, $runtime, $attribution)", ({ mode, runtime, attribution }) => {
	it("answers every step as with nothing replaced", () => {
		const plain = probe([mode, runtime, attribution, "no"]);
		expect(plain).toMatchObject({
			built: "built",
			add: 5,
			flatten: "flattened",
			cjs: "hi x",
			denied: "PERMISSION_DENIED",
			hooked: 30,
			context: 2,
			added: 6,
			reloaded: 9,
			shutdown: "done",
			refusedAdd: "API_PATH_INVALID",
			refusedConfig: "FOLDER_UNREADABLE"
		});
		expect(probe([mode, runtime, attribution, "yes"])).toEqual(plain);
	});

	it("answers every step as with nothing replaced when the functions of Node's built-in modules are replaced, calling none of them", () => {
		const plain = probe([mode, runtime, attribution, "no"]);
		const { nodeHits, ...answers } = probe([mode, runtime, attribution, "node"]);
		expect(nodeHits).toEqual([]);
		expect(answers).toEqual(plain);
	});
});
