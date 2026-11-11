/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_guard/owner/owner.mjs
 *	@Date: 2026-11-10T20:53:39-08:00 (1794372819)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-10T21:25:28-08:00 (1794374728)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Hands another module its values by every route a value crosses between modules: instances of classes
 * it does not export, the classes themselves, and data holding them.
 * @module api_test_crossing_guard/owner
 */

import { EventEmitter } from "node:events";
import { self, context } from "@cldmv/slothlet/runtime";

/** A class no node exports, with a private field, a method, a getter and a static. */
class Foo {
	#secret = 42;
	constructor() {
		this.tag = "foo";
	}
	hi() {
		return "hi";
	}
	get secret() {
		return this.#secret;
	}
	me() {
		return this;
	}
	static create() {
		return new Foo();
	}
}
class Sub extends Foo {
	sub() {
		return "sub";
	}
}
class MyDate extends Date {
	hi() {
		return "hi";
	}
}
class MyBytes extends Uint8Array {
	hi() {
		return "hi";
	}
}
class MyErr extends Error {
	hi() {
		return "hi";
	}
}
class MyMap extends Map {
	hi() {
		return "hi";
	}
}
class MyEmitter extends EventEmitter {
	hi() {
		return "hi";
	}
}
class MyPromise extends Promise {
	hi() {
		return "hi";
	}
}
class MyArr extends Array {
	hi() {
		return "hi";
	}
}
/**
 * A constructor written as a function.
 * @returns {void}
 */
function OldStyle() {
	this.tag = "old";
}
OldStyle.prototype.hi = function () {
	return "hi";
};
/** A prototype no class owns. */
const objProto = {
	hi() {
		return "hi";
	}
};

/** Everything of this module's a write must not land on, by name. */
const CODE = {
	Foo: Foo.prototype,
	Sub: Sub.prototype,
	MyDate: MyDate.prototype,
	MyBytes: MyBytes.prototype,
	MyErr: MyErr.prototype,
	MyMap: MyMap.prototype,
	MyEmitter: MyEmitter.prototype,
	MyPromise: MyPromise.prototype,
	MyArr: MyArr.prototype,
	OldStyle: OldStyle.prototype,
	objProto,
	FooStatic: Foo,
	SubStatic: Sub
};

/** The instances kept alive for a `WeakRef`. */
const kept = [];

/** The values other modules registered. */
const store = new Set();

/** One object this module holds. */
const held = { n: 1 };

/** One instance this module holds. */
const heldInstance = new Foo();

/**
 * Which of this module's classes and prototypes hold a member whose name starts with `prefix`, removing each.
 * @param {string} prefix - The prefix.
 * @returns {string[]} `"<name>:<rest of the key>"` for each one found.
 */
export function landed(prefix) {
	const hit = [];
	for (const [name, target] of Object.entries(CODE))
		for (const key of Reflect.ownKeys(target))
			if (typeof key === "string" && key.startsWith(prefix)) {
				hit.push(`${name}:${key.slice(prefix.length)}`);
				delete target[key];
			}
	return hit;
}

/** `Foo`'s own code as it was written. */
const ORIGINAL = { hi: Foo.prototype.hi, create: Foo.create, prototype: Foo.prototype, objHi: objProto.hi };

/**
 * What of `Foo`'s own code, of the instance this module holds, or of `objProto` is no longer as it was written,
 * putting each back.
 * @returns {string[]} The name of each thing changed.
 */
export function changed() {
	const names = [];
	const restore = (name, isChanged, put) => {
		if (!isChanged) return;
		names.push(name);
		put();
	};
	restore("Foo.prototype.hi", Foo.prototype.hi !== ORIGINAL.hi, () => (Foo.prototype.hi = ORIGINAL.hi));
	restore("Foo.create", Foo.create !== ORIGINAL.create, () => (Foo.create = ORIGINAL.create));
	restore("objProto.hi", objProto.hi !== ORIGINAL.objHi, () => (objProto.hi = ORIGINAL.objHi));
	restore("held.hi", Object.hasOwn(heldInstance, "hi"), () => delete heldInstance.hi);
	restore("held prototype", Object.getPrototypeOf(heldInstance) !== ORIGINAL.prototype, () =>
		Object.setPrototypeOf(heldInstance, ORIGINAL.prototype)
	);
	return names;
}

export const make = () => new Foo();
export const makeSub = () => new Sub();
export const cls = () => Foo;
export const proto = () => Foo.prototype;
export const inData = () => ({ inst: new Foo() });
export const inFrozen = () => Object.freeze({ inst: new Foo() });
export const inArray = () => [new Foo()];
export const inMap = () => new Map([["k", new Foo()]]);
export const inSet = () => new Set([new Foo()]);
export const inWeakRef = () => {
	const instance = new Foo();
	kept.push(instance);
	return new WeakRef(instance);
};
export const inPromiseData = () => ({ p: Promise.resolve(new Foo()) });
export const makeAsync = async () => new Foo();
export const gen = function* () {
	yield new Foo();
};
export const agen = async function* () {
	yield new Foo();
};
export const iter = () => ({
	[Symbol.iterator]() {
		let done = false;
		return {
			next() {
				if (done) return { done: true, value: undefined };
				done = true;
				return { done: false, value: new Foo() };
			}
		};
	}
});
export const each = (cb) => cb(new Foo());
export const eachThis = (cb) => cb.call(new Foo());
export const eachNested = (options) => options.cb(new Foo());
export const thrown = () => {
	const error = new Error("x");
	error.inst = new Foo();
	throw error;
};
export const rejected = async () => {
	const error = new Error("x");
	error.inst = new Foo();
	throw error;
};
export const thrownRaw = () => {
	throw new Foo();
};
export const getter = () => ({
	get inst() {
		return new Foo();
	}
});
export const bound = () => (() => new Foo()).bind(null);
export const closure = () => () => new Foo();
export const inClosureData = () => ({ f: () => new Foo() });
export const myDate = () => new MyDate();
export const dateProp = () => Object.assign(new Date(), { inst: new Foo() });
export const myBytes = () => new MyBytes(4);
export const regexProp = () => Object.assign(/x/, { inst: new Foo() });
export const boxedProp = () => Object.assign(new String("x"), { inst: new Foo() });
export const bufferProp = () => Object.assign(new ArrayBuffer(2), { inst: new Foo() });
export const symbolOnBytes = () => Object.assign(new Uint8Array(2), { [Symbol.for("crossing.inst")]: new Foo() });
export const myErr = () => new MyErr("e");
export const myMap = () => new MyMap();
export const myEmitter = () => new MyEmitter();
export const myPromise = () => new MyPromise((resolve) => resolve(1));
export const myArr = () => new MyArr();
export const oldStyle = () => new OldStyle();
export const objCreate = () => Object.create(objProto);
export const protoAsData = () => ({ proto: objProto });
export const symKey = () => ({ [Symbol.for("crossing.inst")]: new Foo() });
export const proxy = () => new Proxy({}, { get: (_, prop) => (prop === "inst" ? new Foo() : undefined) });
export const fillBox = (box) => {
	box.inst = new Foo();
};
export const fillArr = (list) => {
	list.push(new Foo());
};
export const fillMap = (map) => {
	map.set("k", new Foo());
};
export const fillFn = (fn) => {
	fn.inst = new Foo();
};
export const fillNested = (box) => {
	box.deep.inst = new Foo();
};
export const fillDefine = (box) => {
	Object.defineProperty(box, "inst", { value: new Foo(), configurable: true });
};
export const newWith = (Taker) => new Taker(new Foo());
export const callStatic = (Taker) => {
	Taker.take(new Foo());
};
export const emitter = () => {
	const made = new EventEmitter();
	setTimeout(() => made.emit("x", new Foo()), 1);
	return made;
};
export const emitInto = (target) => {
	target.emit("x", new Foo());
};
export const emitEvent = () => {
	self.slothlet.event.emit("crossing-guard:carry", { inst: new Foo() });
};
export const viaContext = () => {
	context.crossingInst = new Foo();
};
export const roundTrip = (holder) => {
	holder.inst = new Foo();
	return holder;
};
export const resolver = () => ({
	then(resolve) {
		resolve(new Foo());
	}
});
export const nestedDeep = () => ({ a: { b: { c: [{ inst: new Foo() }] } } });
export const accessorDesc = () =>
	Object.defineProperty({}, "inst", {
		get() {
			return new Foo();
		},
		enumerable: true,
		configurable: false
	});
export const heldOne = () => heldInstance;

// Identity and plain-JS answers.
export const takeBack = (value) => (value instanceof Foo ? "foo" : typeof value);
export const secretOf = (value) => value.secret;
export const add = (value) => store.add(value).size;
export const has = (value) => store.has(value);
export const all = () => [...store];
export const getHeld = () => held;
export const isHeld = (value) => value === held;
export const plain = () => ({ a: { b: 1 }, list: [1, 2, 3] });
export const buf = () => Buffer.from("hey");
export const date = () => new Date(0);
export const url = () => new URL("https://example.com/a?b=1");
export const mapOf = () => new Map([["a", { z: 1 }]]);
export const rejecting = () => ({
	then(_, reject) {
		reject(new Error("nope"));
	}
});
export const handlers = () => ({
	onSave() {
		return "saved";
	},
	label: "x"
});
export const closed = () => Object.preventExtensions({ a: 1, b: {} });
export const touch = (value) => {
	value.a = 2;
	delete value.b;
};

/**
 * A function constructor whose prototype object has no `constructor` of its own.
 * @returns {void}
 */
function Legacy() {}
Legacy.prototype = {
	hi() {
		return "hi";
	}
};
const legacyHi = Legacy.prototype.hi;
const legacyPrototype = Legacy.prototype;

/**
 * Which of the function constructor's code is no longer as written, putting each back.
 * @returns {string[]} The name of each thing changed.
 */
export function legacyChanged() {
	const names = [];
	if (Legacy.prototype !== legacyPrototype) {
		names.push("Legacy.prototype");
		Legacy.prototype = legacyPrototype;
	}
	if (legacyPrototype.hi !== legacyHi) {
		names.push("Legacy.prototype.hi");
		legacyPrototype.hi = legacyHi;
	}
	if (Object.hasOwn(Foo, Symbol.hasInstance)) {
		names.push("Foo[Symbol.hasInstance]");
		delete Foo[Symbol.hasInstance];
	}
	return names;
}

export const run = (fn) => {
	fn();
};
export const echo = (value) => value;
export const legacy = () => ({ Legacy });
export const heldBox = () => ({ inst: heldInstance });
export const isHeldInstance = (value) => value === heldInstance;

/**
 * Hook this module's own function and write onto the prototype of what the hook is handed.
 * @returns {string} Whether the hook was handed the module's own prototype, and how a write onto it ended.
 */
export function ownHook() {
	let got;
	const off = self.slothlet.hook.on("after:owner.inData", ({ result }) => {
		got = result;
		return result;
	});
	self.owner.inData();
	if (typeof off === "function") off();
	const prototype = Object.getPrototypeOf(got.inst);
	prototype.__own = 1;
	const written = Foo.prototype.__own === 1;
	delete Foo.prototype.__own;
	return [prototype === Foo.prototype, written].join();
}
