/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/returned-module-code-stand-ins.test.vitest.mjs
 *	@Date: 2026-11-08T08:00:50-08:00 (1794153650)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T12:17:31-08:00 (1794169051)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module's own code comes back as a stand-in wherever it sits in what the module hands out (#726).
 * @description
 * Returned data holding no code comes back as itself, and so do the caller's own values the call's arguments reach.
 * What the module itself made stays the module's: a function it writes into the caller's arguments during the call,
 * code it hands to one of its own leaves, code a `WeakRef` with a plain prototype points at, and code past any depth or
 * width, behind a `Map`, a `Set`, a symbol key, a non-enumerable key, an accessor, a frozen object, a cycle, a class
 * instance or a Proxy. Each such function comes back as a stand-in that runs as the module, so with permissions off
 * as well as on it cannot write the framework's own namespace (PERMISSIONS.md, "Code a module hands out").
 *
 * Expected values come from the fixture run as plain JavaScript (where a value sits, what is `===` what) and from
 * PERMISSIONS.md (a module's code is handed out as a stand-in running as the module).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { types } from "node:util";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "returned-module-code-stand-ins");
const API = path.join(ROOT, "api");
const LIB = path.join(ROOT, "lib");
const BAG = path.join(API, "bag.mjs");
const THROWER = path.join(LIB, "thrower.mjs");

/** The leaf file. Every function a test pulls out writes the framework namespace when it runs. */
const BAG_SOURCE = `import { self } from "@cldmv/slothlet/runtime";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";

const who = () => self.slothlet.metadata.self()?.apiPath ?? null;
/** A fresh function of the module's: reports who it runs as, after trying to write the framework namespace. */
const code = () => () => {
	self.slothlet.planted = 1;
	return who();
};
const keepAlive = [];

export function plantNested(arg) {
	const w = code();
	arg.inner.w = w;
	return w;
}

export function plantTop(arg) {
	const w = code();
	arg.w = w;
	return w;
}

export function plantList(arg) {
	arg.inner.list.push(code());
	return { got: arg.inner.list };
}

let kept = null;
export function keep(arg) {
	kept = arg.inner;
	return () => true;
}

export function plantKept() {
	kept.w = code();
	return { data: kept };
}

export function plantReturnArg(arg) {
	arg.w = code();
	return { data: arg };
}

let later = null;
export function plantLater(arg) {
	later = code();
	arg.inner.w = later;
	return 1;
}

export function ownLater() {
	return later;
}

export function echo(value) {
	return value;
}

let sub = null;
export function plantSub(arg) {
	arg.sub = { w: code() };
	sub = arg.sub;
	return 1;
}

export function ownSubW() {
	return sub.w;
}

export function pick(value, key) {
	return value[key];
}

const shell = Object.freeze({ list: Object.freeze([1, 2]), inner: {} });
export function frozenShell() {
	return shell;
}

export function plantInShell() {
	shell.inner.w = code();
	return shell;
}

export function sink() {
	return () => true;
}

export function launder() {
	const w = code();
	self.bag.sink({ box: { w } });
	return w;
}

export function weakRef() {
	const w = code();
	keepAlive.push(w);
	const ref = new WeakRef(w);
	Object.setPrototypeOf(ref, Object.prototype);
	return { ref };
}

export function plainEmitter() {
	const emitter = new EventEmitter();
	emitter.on("x", code());
	Object.setPrototypeOf(emitter, Object.prototype);
	return { emitter };
}

export function plainTarget() {
	const target = new EventTarget();
	target.addEventListener("x", code());
	Object.setPrototypeOf(target, Object.prototype);
	return { target };
}

export function plainKey() {
	const key = crypto.createSecretKey(Buffer.from("secret"));
	Object.setPrototypeOf(key, Object.prototype);
	key.w = code();
	return { key };
}

export async function plainCryptoKey() {
	const key = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, true, ["sign"]);
	Object.setPrototypeOf(key, Object.prototype);
	key.w = code();
	return { key };
}

/** \`value\` placed \`depth\` levels down, objects and arrays alternating. */
function bury(value, depth) {
	let out = value;
	for (let level = 0; level < depth; level++) out = level % 2 === 0 ? { inner: out } : [out];
	return out;
}

/** A holder of one function of the module's, of the given kind. */
function holderOf(kind, w) {
	switch (kind) {
		case "map":
			return new Map([["k", w]]);
		case "set":
			return new Set([w]);
		case "symbol":
			return { [Symbol.for("slot726")]: w };
		case "nonEnumerable":
			return Object.defineProperty({}, "w", { value: w, enumerable: false });
		case "accessor":
			return {
				get w() {
					return w;
				}
			};
		case "frozen":
			return Object.freeze({ w });
		case "cycle": {
			const holder = { w };
			holder.self = holder;
			return holder;
		}
		case "instance":
			return new (class Box {
				constructor() {
					this.w = w;
				}
				run() {
					return this.w();
				}
			})();
		case "proxyTarget":
			return new Proxy({ w }, {});
		default:
			throw new Error(kind);
	}
}

/** The caller's data beside 800 rows of module data, and a function of the module's \`depth\` levels down. */
export function hidden(kind, depth, value) {
	return { data: value, pad: Array.from({ length: 800 }, (_, index) => ({ index })), deep: bury(holderOf(kind, code()), depth) };
}

export function namespace() {
	return { ns: globalThis.__ns726 };
}

/** A generator, sync or async, yielding a function of the module's, given the prototype of plain data. */
function plainGenerator(isAsync, prototype) {
	const generator = isAsync ? (async function* () { yield code(); })() : (function* () { yield code(); })();
	Object.setPrototypeOf(generator, prototype);
	return generator;
}

export function plainGen(isAsync, nullPrototype) {
	return { g: plainGenerator(isAsync, nullPrototype ? null : Object.prototype) };
}

export function frozenGen() {
	return Object.freeze({ g: Object.freeze(plainGenerator(false, Object.prototype)) });
}

/** A generator, sync or async, yielding a function of the module's, with its own prototype. */
export function nativeGen(isAsync) {
	return { g: isAsync ? (async function* () { yield code(); })() : (function* () { yield code(); })() };
}

export function arrayIterator() {
	return { it: [code()].values() };
}

export function helper() {
	return {
		it: [1].values().map(() => {
			self.slothlet.planted = 1;
			return who();
		})
	};
}

let given = null;
export function giveData() {
	given = { k: 1, inner: { n: 2 } };
	return given;
}

export function plantInGiven() {
	given.w = code();
	given.inner.w = code();
	return 1;
}

export function readW(value) {
	return value.w;
}

export function ownW() {
	return given.w;
}

export function plantSubInGiven() {
	given.sub = { w: code() };
	sub = given.sub;
	return 1;
}

/** Hand out fresh plain data while the global \`Error\` is a Proxy counting what it is asked. */
export function underProxiedError() {
	const real = globalThis.Error;
	const counts = { hits: 0 };
	globalThis.Error = new Proxy(real, {
		get(target, prop, receiver) {
			counts.hits++;
			return Reflect.get(target, prop, receiver);
		},
		getOwnPropertyDescriptor(target, prop) {
			counts.hits++;
			return Reflect.getOwnPropertyDescriptor(target, prop);
		},
		set(target, prop, value, receiver) {
			counts.hits++;
			return Reflect.set(target, prop, value, receiver);
		}
	});
	globalThis.__restoreError726 = () => {
		globalThis.Error = real;
		return counts.hits;
	};
	return { rows: [{ a: 1 }, { b: [2] }], more: { c: "x" } };
}
`;

/** A module that stashes its own namespace and throws before its binding is initialised. */
const THROWER_SOURCE = `import * as me from "./thrower.mjs";
globalThis.__ns726 = me;
throw new Error("thrower");
export let x = 1;
`;

/** The plain JavaScript reference: the same functions, imported and called directly. */
let plain;

beforeAll(async () => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(API, { recursive: true });
	mkdirSync(LIB, { recursive: true });
	writeFileSync(BAG, BAG_SOURCE);
	writeFileSync(THROWER, THROWER_SOURCE);
	plain = await import(pathToFileURL(BAG).href);
	// Loaded by Node's own loader, so its namespace is a real one whose binding stays uninitialised.
	expect(() => createRequire(import.meta.url)(THROWER)).toThrow("thrower");
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	delete globalThis.__ns726;
});

const PERMISSION_CONFIGS = [
	["permissions off", {}],
	["permissions on", { permissions: { mode: "on", defaultPolicy: "allow" } }]
];

const MATRIX = [];
for (const [label, config] of PERMISSION_CONFIGS)
	for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) MATRIX.push({ label, config, mode, runtime });

/** Navigate `depth` levels down a value built by the fixture's `bury`. */
function unbury(value, depth) {
	let node = value;
	for (let level = depth - 1; level >= 0; level--) node = level % 2 === 0 ? node.inner : node[0];
	return node;
}

/** The function of a holder of the given kind, as `holderOf` placed it. */
function functionOf(kind, holder) {
	switch (kind) {
		case "map":
			return holder.get("k");
		case "set":
			return [...holder][0];
		case "symbol":
			return holder[Symbol.for("slot726")];
		case "cycle":
			return holder.self.self.w;
		default:
			return holder.w;
	}
}

const KINDS = ["map", "set", "symbol", "nonEnumerable", "accessor", "frozen", "cycle", "instance", "proxyTarget"];

describe.each(MATRIX)("module code handed out, $label, $mode/$runtime (#726)", ({ config, mode, runtime }) => {
	let api;

	beforeAll(async () => {
		api = await slothlet({ base: API, mode, runtime, silent: true, ...config });
	});

	afterAll(async () => {
		await api?.shutdown();
	});

	/** A function of the module's, as handed out: a stand-in that runs as the module and cannot write the namespace. */
	function expectStandIn(fn) {
		expect(typeof fn).toBe("function");
		expect(types.isProxy(fn), "a stand-in").toBe(true);
		expect(() => fn()).toThrow(expect.objectContaining({ code: "PERMISSION_DENIED" }));
		expect(api.slothlet.planted).toBeUndefined();
	}

	describe("code a module writes into the caller's arguments", () => {
		// What the module writes into the arguments during a call is what the caller reads from its own objects, so that
		// call's result hands it back as the caller holds it (PERMISSIONS.md, the limits).
		it("hands back a function written into a nested argument during the call as the caller reads it", async () => {
			const arg = { inner: { list: [] } };
			const want = { inner: { list: [] } };
			expect(plain.plantNested(want)).toBe(want.inner.w);
			const out = await api.bag.plantNested(arg);
			expect(types.isProxy(arg.inner.w)).toBe(false);
			expect(out === arg.inner.w).toBe(true);
		});

		it("hands back a function written onto the argument itself during the call as the caller reads it", async () => {
			const want = {};
			expect(plain.plantTop(want)).toBe(want.w);
			const arg = {};
			const out = await api.bag.plantTop(arg);
			expect(out === arg.w).toBe(true);
		});

		it("hands back the caller's nested array the module pushed a function into as itself", async () => {
			const want = { inner: { list: [1] } };
			const got = plain.plantList(want);
			expect(got.got).toBe(want.inner.list);
			expect(got.got[1]).toBe(want.inner.list[1]);
			const arg = { inner: { list: [1] } };
			const out = await api.bag.plantList(arg);
			expect(types.isProxy(out)).toBe(false);
			expect(out.got === arg.inner.list).toBe(true);
			expect(out.got[0]).toBe(1);
			expect(types.isProxy(out.got[1])).toBe(false);
		});

		it("hands back a function written into an argument kept from an earlier call as the module's", async () => {
			const arg = { inner: { list: [] } };
			expect(typeof (await api.bag.keep(arg))).toBe("function");
			const out = await api.bag.plantKept();
			expectStandIn(out.data.w);
		});

		it("hands back a function written into an argument during an earlier call as the caller holds it, for that call only", async () => {
			const want = { inner: {} };
			plain.plantLater(want);
			expect(plain.pick(want.inner, "w")).toBe(want.inner.w);
			expect(plain.ownLater()).toBe(want.inner.w);
			const arg = { inner: {} };
			expect(await api.bag.plantLater(arg)).toBe(1);
			// The caller reads it from its own object without any call (PERMISSIONS.md, the limits).
			const held = arg.inner.w;
			expect(typeof held).toBe("function");
			expect(types.isProxy(held)).toBe(false);
			// Handing the object back, the call's arguments reach it: it comes back as the caller holds it.
			expect((await api.bag.pick(arg.inner, "w")) === held).toBe(true);
			// That call recorded nothing for later ones: the module handing out its own function hands out a stand-in.
			expectStandIn(await api.bag.ownLater());
		});

		it("hands the caller's own argument back as itself when the module wrote into it", async () => {
			const want = {};
			expect(plain.plantReturnArg(want).data).toBe(want);
			const arg = {};
			const out = await api.bag.plantReturnArg(arg);
			expect(out.data === arg).toBe(true);
		});
	});

	// Data handed back as itself stays itself: a function the module puts into it afterwards runs as whoever calls it
	// (PERMISSIONS.md, "Plain data passes as it is").
	it("hands frozen data back as itself, and as itself again once the module puts code where it is not frozen", async () => {
		const want = plain.frozenShell();
		expect(Object.isFrozen(want) && !Object.isFrozen(want.inner)).toBe(true);
		const first = await api.bag.frozenShell();
		expect(types.isProxy(first)).toBe(false);
		expect(await api.bag.frozenShell()).toBe(first);
		const planted = await api.bag.plantInShell();
		expect(planted === first).toBe(true);
		expect(planted.list).toEqual([1, 2]);
		expect(typeof planted.inner.w).toBe("function");
		expect(types.isProxy(planted.inner.w)).toBe(false);
	});

	describe("code a module hands to its own leaf", () => {
		it("hands back a function the module nested in its own leaf's arguments as the module's", async () => {
			expectStandIn(await api.bag.launder());
		});
	});

	describe("objects given a plain prototype", () => {
		it("does not hand out a WeakRef's target raw", async () => {
			const out = await api.bag.weakRef();
			let target;
			try {
				target = WeakRef.prototype.deref.call(out.ref);
			} catch {
				target = "refused";
			}
			if (target !== "refused") expectStandIn(target);
			expect(api.slothlet.planted).toBeUndefined();
		});

		it("hands out an emitter's listener as the module's", async () => {
			const out = await api.bag.plainEmitter();
			const [listener] = EventEmitter.prototype.listeners.call(out.emitter, "x");
			expectStandIn(listener);
		});

		it("hands out an event target holding the module's listener as a stand-in", async () => {
			const out = await api.bag.plainTarget();
			expect(types.isProxy(out.target)).toBe(true);
		});

		it("hands out a key's and a crypto key's own function as the module's", async () => {
			expectStandIn((await api.bag.plainKey()).key.w);
			expectStandIn((await api.bag.plainCryptoKey()).key.w);
		});
	});

	describe.each(KINDS)("code in a %s past any bound", (kind) => {
		it.each([8, 9, 10])("hands it out %i levels down beside 800 rows as the module's", async (depth) => {
			const input = { list: [{ role: "user" }] };
			const want = plain.hidden(kind, depth, input);
			expect(typeof functionOf(kind, unbury(want.deep, depth))).toBe("function");
			const out = await api.bag.hidden(kind, depth, input);
			expect(types.isProxy(out)).toBe(true);
			expect(out.data === input).toBe(true);
			expect(out.pad).toHaveLength(800);
			const holder = unbury(out.deep, depth);
			expectStandIn(functionOf(kind, holder));
			if (kind === "instance") expect(() => holder.run()).toThrow(expect.objectContaining({ code: "PERMISSION_DENIED" }));
			expect(api.slothlet.planted).toBeUndefined();
		});
	});

	describe("objects holding code no member shows, given a plain prototype", () => {
		const GENERATOR = Object.getPrototypeOf(Object.getPrototypeOf((function* () {})()));
		const ASYNC_GENERATOR = Object.getPrototypeOf(Object.getPrototypeOf((async function* () {})()));

		/** Step an object through an intrinsic `next`; a refusal hands out nothing. */
		async function stepped(next, value) {
			try {
				return { value: (await Reflect.apply(next, value, [])).value };
			} catch {
				return null;
			}
		}

		it.each([
			["a generator", false],
			["a generator with no prototype", true]
		])("hands out %s as a stand-in that yields the module's code as the module's", async (_label, nullPrototype) => {
			const want = plain.plainGen(false, nullPrototype);
			expect(typeof Reflect.apply(GENERATOR.next, want.g, []).value).toBe("function");
			const out = await api.bag.plainGen(false, nullPrototype);
			expect(types.isProxy(out), "its holder is a stand-in").toBe(true);
			const step = await stepped(GENERATOR.next, out.g);
			expect(step, "the stand-in steps").not.toBeNull();
			expectStandIn(step.value);
		});

		it.each([
			["an async generator", false],
			["an async generator with no prototype", true]
		])("hands out %s as a stand-in that never yields the module's code raw", async (_label, nullPrototype) => {
			const want = plain.plainGen(true, nullPrototype);
			expect(typeof (await Reflect.apply(ASYNC_GENERATOR.next, want.g, [])).value).toBe("function");
			const out = await api.bag.plainGen(true, nullPrototype);
			expect(types.isProxy(out), "its holder is a stand-in").toBe(true);
			// With the prototype gone, the stand-in cannot tell the generator is async and refuses to step, as on 3.24.0.
			for (const next of [GENERATOR.next, ASYNC_GENERATOR.next]) {
				const step = await stepped(next, out.g);
				if (step !== null && typeof step.value === "function") expectStandIn(step.value);
			}
			expect(api.slothlet.planted).toBeUndefined();
		});

		it("does not take a frozen holder of such a generator for frozen data", async () => {
			const want = plain.frozenGen();
			expect(Object.isFrozen(want) && Object.isFrozen(want.g)).toBe(true);
			const out = await api.bag.frozenGen();
			expect(types.isProxy(out), "its holder is a stand-in").toBe(true);
			const step = await stepped(GENERATOR.next, out.g);
			expect(step, "the stand-in steps").not.toBeNull();
			expectStandIn(step.value);
		});
	});

	describe("generators and iterators with their own prototype", () => {
		it.each([
			["a generator", false],
			["an async generator", true]
		])("hands out %s yielding the module's code as the module's", async (_label, isAsync) => {
			const want = plain.nativeGen(isAsync);
			expect(typeof (await want.g.next()).value).toBe("function");
			const out = await api.bag.nativeGen(isAsync);
			expect(types.isProxy(out), "its holder is a stand-in").toBe(true);
			expectStandIn((await out.g.next()).value);
		});

		it("hands out an array iterator over the module's code as a stand-in stepping to the module's", async () => {
			expect(typeof plain.arrayIterator().it.next().value).toBe("function");
			const out = await api.bag.arrayIterator();
			expect(types.isProxy(out.it), "the iterator is a stand-in").toBe(true);
			expectStandIn(out.it.next().value);
			expect(out.it.next().done).toBe(true);
		});
	});

	it("runs an iterator helper's mapper as the module when stepped through its stand-in", async () => {
		const out = await api.bag.helper();
		expect(types.isProxy(out.it)).toBe(true);
		expect(() => out.it.next()).toThrow(expect.objectContaining({ code: "PERMISSION_DENIED" }));
		expect(api.slothlet.planted).toBeUndefined();
	});

	describe("data the module handed out earlier, handed back to it", () => {
		it("hands back a function the module later wrote into it as the caller holds it, and as the module's to everyone else", async () => {
			const want = plain.giveData();
			plain.plantInGiven();
			expect(plain.readW(want)).toBe(want.w);
			expect(plain.ownW()).toBe(want.w);
			const data = await api.bag.giveData();
			expect(types.isProxy(data)).toBe(false);
			await api.bag.plantInGiven();
			// The caller holds the data as itself and reads what the module wrote into it without any call.
			expect(types.isProxy(data.w)).toBe(false);
			expect((await api.bag.readW(data)) === data.w).toBe(true);
			expect((await api.bag.readW(data.inner)) === data.inner.w).toBe(true);
			// Those calls recorded nothing for later ones.
			expectStandIn(await api.bag.ownW());
			expect((await api.bag.readW(data)) === data.w).toBe(true);
			expectStandIn(await api.bag.ownW());
		});
	});

	describe("what a call's arguments reach is the caller's for that call only", () => {
		it("hands out a sub-object's function the caller handed back earlier as the module's", async () => {
			const want = {};
			plain.plantSub(want);
			expect(plain.readW(want.sub)).toBe(want.sub.w);
			expect(plain.ownSubW()).toBe(want.sub.w);
			const arg = {};
			expect(await api.bag.plantSub(arg)).toBe(1);
			expect((await api.bag.readW(arg.sub)) === arg.sub.w).toBe(true);
			expectStandIn(await api.bag.ownSubW());
			expect((await api.bag.readW({ sub: arg.sub }.sub)) === arg.sub.w).toBe(true);
			expectStandIn(await api.bag.ownSubW());
		});

		it("does the same for a sub-object the module put into data it handed out", async () => {
			const want = plain.giveData();
			plain.plantSubInGiven();
			expect(plain.readW(want.sub)).toBe(want.sub.w);
			expect(plain.ownSubW()).toBe(want.sub.w);
			const given = await api.bag.giveData();
			expect(await api.bag.plantSubInGiven()).toBe(1);
			expect((await api.bag.readW(given.sub)) === given.sub.w).toBe(true);
			expectStandIn(await api.bag.ownSubW());
		});
	});

	describe("the limit: what the module writes into an object the caller holds as itself", () => {
		it("hands that object back as itself, holding the module's function as the caller reads it", async () => {
			const want = {};
			const fn = plain.plantTop(want);
			expect(plain.echo(want)).toBe(want);
			expect(plain.echo(want).w).toBe(fn);
			const arg = {};
			// Written onto the caller's own object, the caller reads it as it is, without slothlet, and the call's own
			// result hands it back as that.
			expect((await api.bag.plantTop(arg)) === arg.w).toBe(true);
			expect(types.isProxy(arg.w)).toBe(false);
			const back = await api.bag.echo(arg);
			expect(back === arg).toBe(true);
			expect(back.w === arg.w).toBe(true);
		});
	});

	it("reads no global the module replaced while searching what it hands out", async () => {
		const want = plain.underProxiedError();
		expect(globalThis.__restoreError726()).toBe(0);
		let hits;
		try {
			const out = await api.bag.underProxiedError();
			hits = globalThis.__restoreError726();
			expect(out).toEqual(want);
		} finally {
			globalThis.__restoreError726?.();
			delete globalThis.__restoreError726;
		}
		expect(hits).toBe(0);
	});

	it("hands out a module namespace that cannot be described as a stand-in", async () => {
		const out = await api.bag.namespace();
		expect(types.isModuleNamespaceObject(globalThis.__ns726)).toBe(true);
		expect(() => globalThis.__ns726.x).toThrow(ReferenceError);
		expect(types.isProxy(out)).toBe(true);
		expect(() => out.ns.x).toThrow(ReferenceError);
	});
});
