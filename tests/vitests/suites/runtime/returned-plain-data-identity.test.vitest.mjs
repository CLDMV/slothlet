/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/returned-plain-data-identity.test.vitest.mjs
 *	@Date: 2026-11-08T00:57:54-08:00 (1794128274)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T10:00:28-08:00 (1794160828)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Data a module hands back comes back as itself, at any depth and width (#726).
 * @description
 * A leaf returning data that holds no code — data it built, the caller's own objects, or a mix — hands the caller the
 * very values, as a plain call of the same function would: `util.types.isProxy` reports false for every object in it
 * and every member the caller passed in is `===` the one it passed, however deep it sits and however many properties
 * the data has. That holds with the permission system off (no `permissions` config, `mode: "off"`, `enabled: false`)
 * and on. A function, class, method-bearing object or Proxy the module made still comes back as a stand-in that runs
 * as the module, wherever in the returned data it sits, so with permissions off the module's code still cannot change
 * the framework's own namespace.
 *
 * Expected values come from calling the fixture's own functions directly (plain JavaScript) and from PERMISSIONS.md.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { types } from "node:util";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "returned-plain-data-identity");
const API = path.join(ROOT, "api");
const BAG = path.join(API, "bag.mjs");

/** The leaf file: data builders that run as plain JavaScript when imported directly. */
const BAG_SOURCE = `import { self } from "@cldmv/slothlet/runtime";

export function copy(value) {
	return { ...value };
}

export function echo(value) {
	return value;
}

export function hold(value) {
	return { held: value, also: [value] };
}

export function pick(value, key) {
	return value[key];
}

export function fromMap(value) {
	return { fn: value.map.get("k") };
}

export function fromSet(value) {
	return { fn: [...value.set][0] };
}

/** Module-made data nested \`depth\` levels, arrays and objects alternating. */
export function nest(depth) {
	let value = { leaf: depth, text: "end" };
	for (let level = depth; level > 1; level--) value = level % 2 === 0 ? [value, level] : { level, next: value };
	return value;
}

/** Module-made data \`count\` properties wide, each a small object. */
export function wide(count) {
	const out = {};
	for (let index = 0; index < count; index++) out["k" + index] = { index, list: [index] };
	return out;
}

/** The caller's data placed \`depth\` levels down inside module-made data. */
export function bury(value, depth) {
	let out = value;
	for (let level = 0; level < depth; level++) out = level % 2 === 0 ? { inner: out } : [out];
	return out;
}

const who = () => self.slothlet.metadata.self()?.apiPath ?? null;

export function makeClient() {
	return () => who();
}

export function makeWriter() {
	return () => {
		self.slothlet.planted = 1;
		return "wrote";
	};
}

export function makeClass() {
	return class Made {
		static who() {
			return who();
		}
	};
}

export function makeObject() {
	return { label: "obj", run: () => who() };
}

export function makeProxy() {
	return new Proxy({}, { get: (_target, prop) => (prop === "then" ? undefined : who()) });
}

/** A module closure \`depth\` levels down in module-made data, beside the caller's data. */
export function deepClient(value, depth) {
	let out = { run: () => who(), write: () => { self.slothlet.planted = 1; } };
	for (let level = 0; level < depth; level++) out = level % 2 === 0 ? { inner: out } : [out];
	return { data: value, deep: out };
}

export class Priv {
	#x = 7;
	read() {
		return this.#x;
	}
}

export function same(value) {
	return value;
}

/** A class instance of the module's own, handed to its own leaf and back. */
export function roundTrip() {
	const p = new Priv();
	const back = self.bag.same(p);
	return { same: back === p, read: back.read() };
}

export async function roundTripAwaited() {
	const p = new Priv();
	const back = await self.bag.same(p);
	return { same: back === p, read: back.read() };
}

export function plantBox(arg) {
	arg.box.w = () => who();
	return { b: arg.box };
}
`;

/** The plain JavaScript reference: the same functions, imported and called directly. */
let plain;

beforeAll(async () => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(API, { recursive: true });
	writeFileSync(BAG, BAG_SOURCE);
	plain = await import(pathToFileURL(BAG).href);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const PERMISSION_CONFIGS = [
	["no permissions config", {}],
	['mode: "off"', { permissions: { mode: "off" } }],
	["enabled: false", { permissions: { enabled: false } }],
	['mode: "on"', { permissions: { mode: "on", defaultPolicy: "allow" } }]
];

const MATRIX = [];
for (const [label, config] of PERMISSION_CONFIGS)
	for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) MATRIX.push({ label, config, mode, runtime });

/**
 * Walk a result beside its plain-JavaScript twin: no object in it is a Proxy, and every object the plain result
 * shares with the caller's input is the very same object in the result.
 * @param {*} got - What slothlet handed back.
 * @param {*} want - What the plain call returned.
 * @param {Set<object>} callers - Every object the caller passed in.
 * @param {string} at - Where in the result.
 * @returns {number} How many objects were checked.
 */
function expectSameShape(got, want, callers, at = "out") {
	if (want === null || typeof want !== "object") {
		expect(got, at).toBe(want);
		return 0;
	}
	expect(types.isProxy(got), `${at} is a Proxy`).toBe(false);
	if (callers.has(want)) {
		expect(got === want, `${at} is the caller's own object`).toBe(true);
		return 1;
	}
	expect(Array.isArray(got), `${at} array-ness`).toBe(Array.isArray(want));
	expect(Object.keys(got), `${at} keys`).toEqual(Object.keys(want));
	let checked = 1;
	for (const key of Object.keys(want)) checked += expectSameShape(got[key], want[key], callers, `${at}.${key}`);
	return checked;
}

/** Every object reachable from a value. */
function objectsOf(value, seen = new Set()) {
	if (value === null || typeof value !== "object" || seen.has(value)) return seen;
	seen.add(value);
	for (const key of Object.keys(value)) objectsOf(value[key], seen);
	return seen;
}

/** The caller's data nested `depth` levels, arrays and objects alternating. */
function callerData(depth) {
	let value = { leaf: depth, flag: true };
	for (let level = depth; level > 1; level--) value = level % 2 === 0 ? [{ level, value }] : { level, list: [value] };
	return { list: [value] };
}

/** The message shape from #726. */
const messages = () => ({ list: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:x" } }] }] });

describe.each(MATRIX)("returned data, $label, $mode/$runtime (#726)", ({ config, mode, runtime }) => {
	let api;

	beforeAll(async () => {
		api = await slothlet({ base: API, mode, runtime, silent: true, ...config });
	});

	afterAll(async () => {
		await api?.shutdown();
	});

	it("hands back the issue's message shape with the caller's array as itself", async () => {
		const input = messages();
		const out = await api.bag.copy(input);
		expect(types.isProxy(out)).toBe(false);
		expect(out.list === input.list).toBe(true);
		expect(out.list[0].content[0].image_url === input.list[0].content[0].image_url).toBe(true);
		expectSameShape(out, plain.copy(input), objectsOf(input));
		expect(JSON.stringify(out)).toBe(JSON.stringify(input));
	});

	it.each([1, 2, 3, 4, 5, 6, 7, 8, 12, 24, 64])("keeps the caller's data nested %i levels as itself", async (depth) => {
		const input = callerData(depth);
		const out = await api.bag.copy(input);
		expect(types.isProxy(out)).toBe(false);
		expect(out.list === input.list).toBe(true);
		expect(expectSameShape(out, plain.copy(input), objectsOf(input))).toBeGreaterThan(0);
	});

	it.each([1, 2, 3, 4, 5, 6, 7, 8, 12, 24, 64])("hands back module-made data nested %i levels unwrapped", async (depth) => {
		const out = await api.bag.nest(depth);
		const want = plain.nest(depth);
		expect(out).toEqual(want);
		expectSameShape(out, want, new Set());
	});

	it.each([1, 2, 3, 4, 5, 6, 7, 8, 12])("keeps the caller's data buried %i levels in module data as itself", async (depth) => {
		const input = messages();
		const out = await api.bag.bury(input, depth);
		expectSameShape(out, plain.bury(input, depth), objectsOf(input));
	});

	it("hands back data wider than 512 properties as itself", async () => {
		const out = await api.bag.wide(600);
		const want = plain.wide(600);
		expect(Object.keys(out)).toHaveLength(600);
		expectSameShape(out, want, new Set());

		const input = { rows: Array.from({ length: 1000 }, (_, index) => ({ index, tags: [String(index)] })) };
		for (let index = 0; index < 600; index++) input["p" + index] = { index };
		const copied = await api.bag.copy(input);
		expect(types.isProxy(copied)).toBe(false);
		expect(copied.rows === input.rows).toBe(true);
		expect(copied.p599 === input.p599).toBe(true);
		expectSameShape(copied, plain.copy(input), objectsOf(input));
	});

	it("hands the caller's own object back as itself, alone or inside a new one", async () => {
		const input = callerData(6);
		expect((await api.bag.echo(input)) === input).toBe(true);
		const held = await api.bag.hold(input);
		expect(types.isProxy(held)).toBe(false);
		expect(held.held === input).toBe(true);
		expect(held.also[0] === input).toBe(true);
		expectSameShape(held, plain.hold(input), objectsOf(input));
	});

	it("hands the caller's own functions back as themselves, at any depth", async () => {
		const callback = () => "caller's";
		const input = { list: [{ deep: [{ deeper: { cb: callback } }] }], cb: callback };
		const out = await api.bag.copy(input);
		expect(types.isProxy(out)).toBe(false);
		expect(out.cb === callback).toBe(true);
		expect(out.list === input.list).toBe(true);
		expect(out.list[0].deep[0].deeper.cb === callback).toBe(true);
		const buried = await api.bag.bury(input, 7);
		expectSameShape(buried, plain.bury(input, 7), objectsOf(input));
	});

	it("hands back the caller's nested function, Proxy and collection members as themselves", async () => {
		const callback = () => "caller's";
		const proxy = new Proxy({}, {});
		const input = { deep: { cb: callback, proxy }, map: new Map([["k", callback]]), set: new Set([callback]) };
		expect((await api.bag.pick(input.deep, "cb")) === callback).toBe(true);
		expect((await api.bag.pick(input.deep, "proxy")) === proxy).toBe(true);
		const copied = await api.bag.copy(input.deep);
		expect(types.isProxy(copied)).toBe(false);
		expect(copied.proxy === proxy).toBe(true);
		const fromMap = await api.bag.fromMap(input);
		expect(types.isProxy(fromMap)).toBe(false);
		expect(fromMap.fn === plain.fromMap(input).fn).toBe(true);
		const fromSet = await api.bag.fromSet(input);
		expect(types.isProxy(fromSet)).toBe(false);
		expect(fromSet.fn === callback).toBe(true);
	});

	it("hands the module's own stand-in back as the same stand-in inside its result", async () => {
		const client = await api.bag.makeClient();
		const held = await api.bag.hold(client);
		expect(held.held === client).toBe(true);
		expect(held.also[0] === client).toBe(true);
		const copied = await api.bag.copy({ client, list: [1] });
		expect(copied.client === client).toBe(true);
		expect(copied.client()).toBe("bag.makeClient");
	});

	it("still hands out a closure the module made as a stand-in that runs as the module", async () => {
		const client = await api.bag.makeClient();
		expect(types.isProxy(client)).toBe(true);
		expect(client()).toBe("bag.makeClient");
	});

	it("still keeps a returned closure of the module's off the framework namespace", async () => {
		const writer = await api.bag.makeWriter();
		expect(types.isProxy(writer)).toBe(true);
		expect(() => writer()).toThrow(expect.objectContaining({ code: "PERMISSION_DENIED" }));
		expect(api.slothlet.planted).toBeUndefined();
	});

	it("still hands out a class, a method-bearing object and a Proxy the module made as the module's", async () => {
		const Made = await api.bag.makeClass();
		expect(types.isProxy(Made)).toBe(true);
		expect(Made.who()).toBe("bag.makeClass");

		const object = await api.bag.makeObject();
		expect(types.isProxy(object)).toBe(true);
		expect(object.label).toBe("obj");
		expect(object.run()).toBe("bag.makeObject");

		const proxied = await api.bag.makeProxy();
		expect(types.isProxy(proxied)).toBe(true);
		expect(proxied.anything).toBe("bag.makeProxy");
	});

	it.each([1, 4, 5, 8, 16])("finds a module closure %i levels down and runs it as the module", async (depth) => {
		const input = messages();
		const out = await api.bag.deepClient(input, depth);
		// Holding the module's code, the container is a stand-in; the caller's data in it is still the caller's.
		expect(types.isProxy(out)).toBe(true);
		expect(out.data === input).toBe(true);
		let node = out.deep;
		for (let level = depth - 1; level >= 0; level--) node = level % 2 === 0 ? node.inner : node[0];
		expect(node.run()).toBe("bag.deepClient");
		expect(() => node.write()).toThrow(expect.objectContaining({ code: "PERMISSION_DENIED" }));
		expect(api.slothlet.planted).toBeUndefined();
	});

	it("hands a module's own class instance back as itself through its own leaf", async () => {
		// Plain JavaScript: the instance handed to `same` is the one it returns.
		const instance = new plain.Priv();
		const want = { same: plain.same(instance) === instance, read: instance.read() };
		expect(want).toEqual({ same: true, read: 7 });
		expect(await api.bag.roundTrip()).toEqual(want);
		expect(await api.bag.roundTripAwaited()).toEqual(want);
	});

	it("hands the caller's class instance back as itself, with what the module wrote onto it", async () => {
		class HostBox {}
		const want = new HostBox();
		expect(plain.plantBox({ box: want }).b).toBe(want);
		const box = new HostBox();
		const out = await api.bag.plantBox({ box });
		expect(types.isProxy(out)).toBe(false);
		expect(out.b === box).toBe(true);
		expect(typeof box.w).toBe("function");
	});
});
