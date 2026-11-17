/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/captured-prototype-methods-child.test.vitest.mjs
 *	@Date: 2026-11-15T23:40:00-08:00 (1794814800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:29:33-08:00 (1794882573)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview slothlet checks calls, searches what one module hands another and makes its views with the methods
 * built-in values inherited when slothlet loaded, whatever a module puts on the built-in prototypes later.
 *
 * @description
 * A child process (replacing the prototype methods would disturb vitest itself) builds an api with two modules of
 * their own, an owner and a reader, then replaces methods on the built-in prototypes with stand-ins that note when
 * slothlet's own source calls them: `Array.prototype[Symbol.iterator]` and the array iterator's `next` (spread,
 * `for…of`, array destructuring), `Array.prototype` `map`, `forEach`, `push`, `filter`, `includes`, `some`, `slice` and
 * `join`, `Set.prototype` `add` and `has`, `Map.prototype` `get`, `set` and `has`, `WeakSet.prototype` `has` and `add`,
 * `WeakMap.prototype` `get`, `set` and `has`, the map and set iterators' `next`, `Promise.prototype.then`,
 * `Function.prototype` `call`, `apply` and `bind`, `String.prototype` `startsWith`, `slice`, `split`, `includes` and
 * `replace`, and `RegExp.prototype` `test` and `exec`. Code that is not slothlet's gets the method as it was.
 *
 * Then it runs a call a rule allows, one a rule denies, a call returning another module's data holding a class
 * instance, a `Set`, a `Map` and a function (searched before it is handed out, and read through the view the reader
 * gets), a write through that view onto the instance's prototype, a write of a function onto the owner's data, a
 * hooked call and a `context.run()`.
 *
 * - "record": the stand-ins call the method as it was. No step calls one from slothlet's source, and every step
 *   answers as with nothing replaced.
 * - "steer": the stand-ins answer what would mislead slothlet when its source calls them (every `has` true, every
 *   `get` empty, every iteration empty, `includes` and `startsWith` false). Every step answers as with nothing replaced.
 *
 * The reader reads the owner's data without the replaced methods: a replaced method the reader calls through a view
 * runs as the reader asked, as in plain JavaScript, and is the reader's own call. Calls the engine makes from a job of
 * its own (a promise settling) have no caller frame to tell them by and are not counted.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "captured-prototype-methods-child");
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
		"const emptyIterator = [][Symbol.iterator]();",
		"const ArrayIteratorPrototype = getPrototypeOf([][Symbol.iterator]());",
		"const MapIteratorPrototype = getPrototypeOf(new Map()[Symbol.iterator]());",
		"const SetIteratorPrototype = getPrototypeOf(new Set()[Symbol.iterator]());",
		"const OWN_SOURCE = process.cwd() + '/src/';",
		"// What a stand-in answers to slothlet's source in the steer run.",
		"const yes = () => true;",
		"const no = () => false;",
		"const nothing = () => undefined;",
		"const empty = () => emptyIterator;",
		"const done = () => ({ value: undefined, done: true });",
		"const TARGETS = [",
		"\t[Array.prototype, Symbol.iterator, 'Array.prototype[Symbol.iterator]', empty],",
		"\t[ArrayIteratorPrototype, 'next', 'ArrayIterator.next', done],",
		"\t[Array.prototype, 'map', 'Array.prototype.map', () => []],",
		"\t[Array.prototype, 'forEach', 'Array.prototype.forEach', nothing],",
		"\t[Array.prototype, 'push', 'Array.prototype.push', () => 0],",
		"\t[Array.prototype, 'filter', 'Array.prototype.filter', () => []],",
		"\t[Array.prototype, 'includes', 'Array.prototype.includes', no],",
		"\t[Array.prototype, 'some', 'Array.prototype.some', no],",
		"\t[Array.prototype, 'slice', 'Array.prototype.slice', () => []],",
		"\t[Array.prototype, 'join', 'Array.prototype.join', () => ''],",
		"\t[Set.prototype, 'add', 'Set.prototype.add', function () { return this; }],",
		"\t[Set.prototype, 'has', 'Set.prototype.has', yes],",
		"\t[Map.prototype, 'get', 'Map.prototype.get', nothing],",
		"\t[Map.prototype, 'set', 'Map.prototype.set', function () { return this; }],",
		"\t[Map.prototype, 'has', 'Map.prototype.has', yes],",
		"\t[MapIteratorPrototype, 'next', 'MapIterator.next', done],",
		"\t[SetIteratorPrototype, 'next', 'SetIterator.next', done],",
		"\t[WeakSet.prototype, 'has', 'WeakSet.prototype.has', yes],",
		"\t[WeakSet.prototype, 'add', 'WeakSet.prototype.add', function () { return this; }],",
		"\t[WeakMap.prototype, 'get', 'WeakMap.prototype.get', nothing],",
		"\t[WeakMap.prototype, 'set', 'WeakMap.prototype.set', function () { return this; }],",
		"\t[WeakMap.prototype, 'has', 'WeakMap.prototype.has', yes],",
		"\t[Promise.prototype, 'then', 'Promise.prototype.then', null],",
		"\t[Function.prototype, 'call', 'Function.prototype.call', null],",
		"\t[Function.prototype, 'apply', 'Function.prototype.apply', null],",
		"\t[Function.prototype, 'bind', 'Function.prototype.bind', null],",
		"\t[String.prototype, 'startsWith', 'String.prototype.startsWith', no],",
		"\t[String.prototype, 'slice', 'String.prototype.slice', null],",
		"\t[String.prototype, 'split', 'String.prototype.split', null],",
		"\t[String.prototype, 'includes', 'String.prototype.includes', no],",
		"\t[String.prototype, 'replace', 'String.prototype.replace', null],",
		"\t[RegExp.prototype, 'test', 'RegExp.prototype.test', null],",
		"\t[RegExp.prototype, 'exec', 'RegExp.prototype.exec', null]",
		"];",
		"const hits = create(null);",
		"let busy = false;",
		"// The first frame with a file of its own below the stand-in: slothlet's source, or someone else's code.",
		"function calledBySlothlet() {",
		"\tconst lines = apply(StringSplit, String(new ProbeError().stack), ['\\n']);",
		"\tfor (let i = 3; i < lines.length; i++) {",
		"\t\tconst line = lines[i];",
		"\t\tif (apply(StringIncludes, line, ['(<anonymous>)']) || apply(StringIncludes, line, ['(native)'])) continue;",
		"\t\tif (apply(StringIndexOf, line, ['/']) === -1 && apply(StringIndexOf, line, ['file:']) === -1) continue;",
		"\t\treturn apply(StringIncludes, line, [OWN_SOURCE]);",
		"\t}",
		"\treturn false;",
		"}",
		"const saved = [];",
		"function replaceAll(steer) {",
		"\tfor (let t = 0; t < TARGETS.length; t++) {",
		"\t\tconst holder = TARGETS[t][0], key = TARGETS[t][1], name = TARGETS[t][2], misleading = TARGETS[t][3];",
		"\t\tconst descriptor = getOwnPropertyDescriptor(holder, key);",
		"\t\tconst original = descriptor.value;",
		"\t\tsaved[saved.length] = [holder, key, descriptor];",
		"\t\tconst standIn = {",
		"\t\t\t[name](...args) {",
		"\t\t\t\tif (busy) return apply(original, this, args);",
		"\t\t\t\tbusy = true;",
		"\t\t\t\tlet bySlothlet;",
		"\t\t\t\ttry {",
		"\t\t\t\t\tbySlothlet = calledBySlothlet();",
		"\t\t\t\t} finally {",
		"\t\t\t\t\tbusy = false;",
		"\t\t\t\t}",
		"\t\t\t\tif (!bySlothlet) return apply(original, this, args);",
		"\t\t\t\thits[name] = true;",
		"\t\t\t\tif (steer && misleading) return apply(misleading, this, args);",
		"\t\t\t\treturn apply(original, this, args);",
		"\t\t\t}",
		"\t\t}[name];",
		"\t\tdefineProperty(holder, key, { ...descriptor, value: standIn });",
		"\t}",
		"}",
		"function restoreAll() {",
		"\tfor (let i = saved.length - 1; i >= 0; i--) defineProperty(saved[i][0], saved[i][1], saved[i][2]);",
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
		"\tdir: API, mode, runtime, hook: true, silent: true,",
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
		"if (replace !== 'no') replaceAll(replace === 'steer');",
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
 * @param {string[]} args - mode, runtime, attribution, and "no", "record" or "steer".
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
	"built-in prototype methods replaced after slothlet loaded ($mode, $runtime, $attribution)",
	({ mode, runtime, attribution }) => {
		it("checks, searches and hands out as with nothing replaced", () => {
			expect(probe([mode, runtime, attribution, "no"])).toEqual(EXPECTED);
		});

		it("calls none of the replaced methods from its own source", () => {
			expect(probe([mode, runtime, attribution, "record"])).toEqual(EXPECTED);
		});

		it("decides the same when the replaced methods answer what would mislead it", () => {
			expect(probe([mode, runtime, attribution, "steer"])).toEqual(EXPECTED);
		});
	}
);
