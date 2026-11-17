/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/prototype-members-child.test.vitest.mjs
 *	@Date: 2026-11-16T01:34:54-08:00 (1794821694)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:50-08:00 (1794882650)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview slothlet checks calls, searches what one module hands another and makes its views without reading a
 * member a module adds to `Object.prototype` or `Array.prototype`, and without building its arrays through one.
 *
 * @description
 * A child process builds an api with an owner and a reader (as in `captured-prototype-methods-child`), then defines
 * accessors that note when slothlet's own source runs them:
 *
 * - "members": on `Object.prototype`, the names slothlet reads off descriptors, records, options and results it makes
 *   (`get`, `set`, `value`, `writable`, `enumerable`, `configurable`, `toJSON`, `next`, `done`, `return`, `throw`,
 *   `length`, `size`, `constructor`), `Symbol.toPrimitive` and `Symbol.toStringTag`, and `toString` and `valueOf` (the
 *   conversions a template literal or `String()` make). Each getter answers what the member reads as without it.
 *   `then` is left out: it is read off what module code returns, as `await` reads it in plain JavaScript.
 * - "promises": on `Promise.prototype`, `constructor`, `then`, `catch` and `finally`, and `Promise[Symbol.species]`,
 *   which `await`, a promise's `then` and an async function's return read.
 * - "indices": on `Array.prototype` and `Object.prototype`, the indices 0 to 31, whose setters define the element as a
 *   plain write would; and `Array.prototype.constructor` and `Array[Symbol.species]`, read when an array method makes
 *   its result.
 *
 * Every step answers as with nothing defined, and no accessor runs from slothlet's source. Calls the engine makes from
 * a job of its own (a promise settling) have no caller frame to tell them by and are not counted.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "prototype-members-child");
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
	write("api/guest/guest.mjs", [
		'import { self } from "@cldmv/slothlet/runtime";',
		"export function tryMath() {",
		"\treturn self.math.add(1, 1);",
		"}"
	]);
	write("api/ctx/ctx.mjs", [
		'import { context } from "@cldmv/slothlet/runtime";',
		"export function who() {",
		"\treturn context.user;",
		"}"
	]);
	write("owner/owner.mjs", [
		"class Foo {",
		"\thi() {",
		'\t\treturn "hi";',
		"\t}",
		"}",
		"const held = {",
		"\tn: 1,",
		"\tinst: new Foo(),",
		"\tlist: [new Foo(), new Foo()],",
		"\tset: new Set([new Foo()]),",
		'\tmap: new Map([["k", new Foo()]]),',
		"\tfn() {",
		'\t\treturn "fn";',
		"\t}",
		"};",
		"const fn = held.fn;",
		"export const getHeld = () => held;",
		"// Which members a write left on the class and the data, put back as written.",
		"export function landed() {",
		"\tconst hit = Object.getOwnPropertyNames(Foo.prototype).filter((key) => key !== 'constructor' && key !== 'hi');",
		"\tfor (const key of hit) delete Foo.prototype[key];",
		"\tif (held.fn !== fn) hit.push('fn');",
		"\theld.fn = fn;",
		"\treturn hit;",
		"}"
	]);
	write("reader/reader.mjs", [
		'import { types } from "node:util";',
		'import { self } from "@cldmv/slothlet/runtime";',
		"const attempt = (fn) => {",
		"\ttry {",
		"\t\tfn();",
		"\t\treturn 'written';",
		"\t} catch (error) {",
		"\t\treturn error?.code ?? String(error);",
		"\t}",
		"};",
		"export function probe() {",
		"\tconst value = self.owner.getHeld();",
		"\t// Read without the replaced methods: calling one through a view runs it as the reader asked, as plain JavaScript does.",
		"\tconst first = value.list[0];",
		"\tlet fromSet;",
		"\tvalue.set.forEach((member) => (fromSet = member));",
		"\tlet fromMap;",
		"\tvalue.map.forEach((member) => (fromMap = member));",
		"\treturn {",
		"\t\twrapped: types.isProxy(value),",
		"\t\tinst: value.inst.hi(),",
		"\t\tfirst: first.hi(),",
		"\t\tfromSet: fromSet.hi(),",
		"\t\tfromMap: fromMap.hi(),",
		"\t\tfn: value.fn(),",
		"\t\tproto: attempt(() => (Object.getPrototypeOf(value.inst).planted = () => 'planted')),",
		"\t\tlisted: attempt(() => (Object.getPrototypeOf(value.list[1]).plantedList = () => 'planted')),",
		"\t\tdata: attempt(() => (value.fn = () => 'planted'))",
		"\t};",
		"}"
	]);
	write("probe.mjs", [
		'import slothlet from "@cldmv/slothlet";',
		"const [mode, runtime, attribution, replace] = process.argv.slice(2);",
		'const API = new URL("./api/", import.meta.url).pathname;',
		'const OWNER = new URL("./owner/", import.meta.url).pathname;',
		'const READER = new URL("./reader/", import.meta.url).pathname;',
		"// Taken before anything is replaced: the probe itself calls none of the stand-ins.",
		"const { apply } = Reflect;",
		"const { getOwnPropertyDescriptor, defineProperty, getPrototypeOf, create } = Object;",
		"const ProbeError = Error;",
		"const exit = process.exit.bind(process);",
		"const write = process.stdout.write.bind(process.stdout);",
		"const stringify = JSON.stringify;",
		"const StringSplit = String.prototype.split;",
		"const StringIncludes = String.prototype.includes;",
		"const StringIndexOf = String.prototype.indexOf;",
		"const ArraySort = Array.prototype.sort;",
		"const ObjectKeys = Object.keys;",
		"const OWN_SOURCE = process.cwd() + '/src/';",
		"const NAMES = ['get', 'set', 'value', 'writable', 'enumerable', 'configurable', 'toJSON', 'next', 'done', 'return', 'throw', 'length', 'size'];",
		"const hits = create(null);",
		"let busy = false;",
		"// The first frame with a file of its own below the accessor: slothlet's source, or someone else's code.",
		"function calledBySlothlet() {",
		"\tconst lines = apply(StringSplit, String(new ProbeError().stack), ['\\n']);",
		"\t// Below this function, note and the accessor itself.",
		"\tfor (let i = 4; i < lines.length; i++) {",
		"\t\tconst line = lines[i];",
		"\t\tif (apply(StringIncludes, line, ['(<anonymous>)']) || apply(StringIncludes, line, ['(native)'])) continue;",
		"\t\tif (apply(StringIndexOf, line, ['/']) === -1 && apply(StringIndexOf, line, ['file:']) === -1) continue;",
		"\t\t// slothlet's live-runtime patch of Promise.prototype.then passes every then call through, as the language's own runs it.",
		"\t\tif (apply(StringIncludes, line, ['/helpers/promise-context.mjs'])) return false;",
		"\t\treturn apply(StringIncludes, line, [OWN_SOURCE]);",
		"\t}",
		"\treturn false;",
		"}",
		"const note = (name) => {",
		"\tif (busy) return;",
		"\tbusy = true;",
		"\ttry {",
		"\t\tif (calledBySlothlet()) hits[name] = true;",
		"\t} finally {",
		"\t\tbusy = false;",
		"\t}",
		"};",
		"const saved = [];",
		"function define(holder, key, name, descriptor) {",
		"\tsaved[saved.length] = [holder, key, getOwnPropertyDescriptor(holder, key)];",
		"\tdefineProperty(holder, key, { __proto__: null, configurable: true, ...descriptor });",
		"}",
		"function replaceAll(kind) {",
		"\tif (kind === 'members') {",
		"\t\tfor (let i = 0; i < NAMES.length; i++) {",
		"\t\t\tconst key = NAMES[i];",
		"\t\t\tdefine(Object.prototype, key, 'Object.prototype.' + key, { __proto__: null, get() { note('Object.prototype.' + key); return undefined; }, set(value) { note('Object.prototype.' + key); defineProperty(this, key, { __proto__: null, value, writable: true, enumerable: true, configurable: true }); } });",
		"\t\t}",
		"\t\tconst ObjectConstructor = Object;",
		"\t\tdefine(Object.prototype, 'constructor', 'Object.prototype.constructor', { get() { note('Object.prototype.constructor'); return ObjectConstructor; }, set(value) { defineProperty(this, 'constructor', { __proto__: null, value, writable: true, enumerable: true, configurable: true }); } });",
		"\t\t// The conversions a template literal, String() or + make: the language's own functions, run through a getter that notes the read.",
		"\t\tfor (const key of ['toString', 'valueOf']) {",
		"\t\t\tconst original = Object.prototype[key];",
		"\t\t\tdefine(Object.prototype, key, 'Object.prototype.' + key, { get() { note('Object.prototype.' + key); return original; }, set(value) { defineProperty(this, key, { __proto__: null, value, writable: true, enumerable: true, configurable: true }); } });",
		"\t\t}",
		"\t\tdefine(Object.prototype, Symbol.toStringTag, 'Object.prototype[Symbol.toStringTag]', { get() { note('Object.prototype[Symbol.toStringTag]'); return undefined; } });",
		"\t\tdefine(Object.prototype, Symbol.toPrimitive, 'Object.prototype[Symbol.toPrimitive]', { get() { note('Object.prototype[Symbol.toPrimitive]'); return undefined; } });",
		"\t}",
		"\tif (kind === 'promises') {",
		"\t\tconst PromiseConstructor = Promise;",
		"\t\tdefine(Promise.prototype, 'constructor', 'Promise.prototype.constructor', { get() { note('Promise.prototype.constructor'); return PromiseConstructor; }, set(value) { defineProperty(this, 'constructor', { __proto__: null, value, writable: true, enumerable: true, configurable: true }); } });",
		"\t\tconst species = getOwnPropertyDescriptor(Promise, Symbol.species);",
		"\t\tdefine(Promise, Symbol.species, 'Promise[Symbol.species]', { get() { note('Promise[Symbol.species]'); return apply(species.get, this, []); } });",
		"\t\tfor (const key of ['then', 'catch', 'finally']) {",
		"\t\t\tconst original = Promise.prototype[key];",
		"\t\t\tdefine(Promise.prototype, key, 'Promise.prototype.' + key, { writable: true, value: { [key](...args) { note('Promise.prototype.' + key); return apply(original, this, args); } }[key] });",
		"\t\t}",
		"\t}",
		"\tif (kind === 'indices') {",
		"\t\tfor (const holder of [Array.prototype, Object.prototype]) {",
		"\t\t\tconst where = holder === Array.prototype ? 'Array.prototype' : 'Object.prototype';",
		"\t\t\tfor (let i = 0; i < 32; i++) {",
		"\t\t\t\tconst key = String(i);",
		"\t\t\t\tdefine(holder, key, where + '[index]', { get() { note(where + '[index]'); return undefined; }, set(value) { note(where + '[index]'); defineProperty(this, key, { __proto__: null, value, writable: true, enumerable: true, configurable: true }); } });",
		"\t\t\t}",
		"\t\t}",
		"\t\tconst ArrayConstructor = Array;",
		"\t\tdefine(Array.prototype, 'constructor', 'Array.prototype.constructor', { get() { note('Array.prototype.constructor'); return ArrayConstructor; }, set(value) { defineProperty(this, 'constructor', { __proto__: null, value, writable: true, enumerable: true, configurable: true }); } });",
		"\t\tconst species = getOwnPropertyDescriptor(Array, Symbol.species);",
		"\t\tdefine(Array, Symbol.species, 'Array[Symbol.species]', { get() { note('Array[Symbol.species]'); return apply(species.get, this, []); } });",
		"\t}",
		"}",
		"function restoreAll() {",
		"\tfor (let i = saved.length - 1; i >= 0; i--) {",
		"\t\tif (saved[i][2]) defineProperty(saved[i][0], saved[i][1], { __proto__: null, ...saved[i][2] });",
		"\t\telse delete saved[i][0][saved[i][1]];",
		"\t}",
		"}",
		"const step = async (fn) => {",
		"\ttry {",
		"\t\treturn await fn();",
		"\t} catch (error) {",
		"\t\treturn error?.code ?? 'threw ' + error?.message;",
		"\t}",
		"};",
		"const out = {};",
		"const api = await slothlet({",
		"\tbase: API, mode, runtime, hook: true, silent: true,",
		"\tpermissions: { policy: 'allow', rules: [{ caller: 'guest.**', target: 'math.**', effect: 'deny' }], caller: { attribution } }",
		"});",
		"await api.slothlet.api.add('owner', OWNER, { id: 'owner' });",
		"await api.slothlet.api.add('reader', READER, { id: 'reader' });",
		"// Every node loaded and every path taken once before anything is replaced.",
		"await step(() => api.math.add(1, 1));",
		"await step(() => api.guest.tryMath());",
		"await step(() => api.reader.probe());",
		"await step(() => api.owner.landed());",
		"await step(() => api.ctx.who());",
		"if (replace !== 'no') replaceAll(replace);",
		"out.add = await step(() => api.math.add(2, 3));",
		"out.denied = await step(() => api.guest.tryMath());",
		"out.read = await step(() => api.reader.probe());",
		"out.hooked = await step(async () => {",
		"\tapi.slothlet.hook.on('math.add:after', ({ result }) => result * 10, { id: 'times-ten' });",
		"\tconst result = await api.math.add(1, 2);",
		"\tapi.slothlet.hook.remove({ id: 'times-ten' });",
		"\treturn result;",
		"});",
		"out.context = await step(() => api.slothlet.context.run({ user: 'ann' }, () => api.ctx.who()));",
		"restoreAll();",
		"out.landed = await step(() => api.owner.landed());",
		"await api.shutdown();",
		"const names = ObjectKeys(hits);",
		"apply(ArraySort, names, []);",
		"out.hits = names;",
		"write(stringify(out) + '\\n');",
		"exit(0);"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Run the probe in a child process.
 * @param {string[]} args - mode, runtime, attribution, and "no", "members", "promises" or "indices".
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

/** What every step answers with nothing replaced. */
const EXPECTED = {
	add: 5,
	denied: "PERMISSION_DENIED",
	read: {
		wrapped: true,
		inst: "hi",
		first: "hi",
		fromSet: "hi",
		fromMap: "hi",
		fn: "fn",
		proto: "LOOSE_SET_NOT_OWNED",
		listed: "LOOSE_SET_NOT_OWNED",
		data: "LOOSE_SET_NOT_OWNED"
	},
	hooked: 30,
	context: "ann",
	landed: [],
	hits: []
};

describe.each(CONFIGS)(
	"members added to the shared prototypes after slothlet loaded ($mode, $runtime, $attribution)",
	({ mode, runtime, attribution }) => {
		it("checks, searches and hands out as with nothing added", () => {
			expect(probe([mode, runtime, attribution, "no"])).toEqual(EXPECTED);
		});

		it("reads no member a module added to Object.prototype", () => {
			expect(probe([mode, runtime, attribution, "members"])).toEqual(EXPECTED);
		});

		it("settles its own promises through no member a module put on Promise", () => {
			expect(probe([mode, runtime, attribution, "promises"])).toEqual(EXPECTED);
		});

		it("builds its arrays through no index or species a module added", () => {
			expect(probe([mode, runtime, attribution, "indices"])).toEqual(EXPECTED);
		});
	}
);
