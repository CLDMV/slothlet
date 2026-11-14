/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_guard/reader/reader.mjs
 *	@Date: 2026-11-10T20:53:39-08:00 (1794372819)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-10T21:25:29-08:00 (1794374729)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reaches another module's classes and instances by every route a value crosses between modules, and
 * tries to change that module's code through what it reaches.
 * @module api_test_crossing_guard/reader
 */

import { EventEmitter } from "node:events";
import { types } from "node:util";
import { self, context } from "@cldmv/slothlet/runtime";

/** A class of this module's the owner constructs and calls. */
class Taker {
	constructor(instance) {
		this.i = instance;
	}
	static take(instance) {
		Taker.got = instance;
	}
}

/** The first `"x"` an emitter emits. */
const once = (emitter) => new Promise((resolve) => emitter.on("x", resolve));

/** Each route: what the reader ends up holding of the owner's. `{ prototype }` names a prototype reached directly. */
const ROUTES = {
	returned: () => self.owner.make(),
	returnedSubclass: () => self.owner.makeSub(),
	classReturned: () => self.owner.cls(),
	classStaticCall: () => self.owner.cls().create(),
	classConstructed: () => new (self.owner.cls())(),
	prototypeReturned: () => ({ prototype: self.owner.proto() }),
	inData: () => self.owner.inData().inst,
	inFrozenData: () => self.owner.inFrozen().inst,
	inArray: () => self.owner.inArray()[0],
	arraySpread: () => [...self.owner.inArray()][0],
	arrayMap: () => self.owner.inArray().map((item) => item)[0],
	mapGet: () => self.owner.inMap().get("k"),
	mapValues: () => [...self.owner.inMap().values()][0],
	mapForEach: () => {
		let got;
		self.owner.inMap().forEach((value) => (got = value));
		return got;
	},
	setSpread: () => [...self.owner.inSet()][0],
	weakRef: () => self.owner.inWeakRef().deref(),
	promiseInData: () => self.owner.inPromiseData().p,
	asyncReturned: () => self.owner.makeAsync(),
	generator: () => self.owner.gen().next().value,
	generatorSpread: () => [...self.owner.gen()][0],
	asyncGenerator: async () => (await self.owner.agen().next()).value,
	iterable: () => [...self.owner.iter()][0],
	callbackArgument: () => {
		let got;
		self.owner.each((instance) => (got = instance));
		return got;
	},
	callbackReceiver: () => {
		let got;
		self.owner.eachThis(function () {
			got = this;
		});
		return got;
	},
	callbackInData: () => {
		let got;
		self.owner.eachNested({ cb: (instance) => (got = instance) });
		return got;
	},
	thrownOnError: () => {
		try {
			self.owner.thrown();
		} catch (error) {
			return error.inst;
		}
	},
	rejectedOnError: async () => {
		try {
			await self.owner.rejected();
		} catch (error) {
			return error.inst;
		}
	},
	thrownItself: () => {
		try {
			self.owner.thrownRaw();
		} catch (error) {
			return error;
		}
	},
	getterRead: () => self.owner.getter().inst,
	getterFromDescriptor: () => {
		const holder = self.owner.getter();
		return Object.getOwnPropertyDescriptor(holder, "inst").get.call(holder);
	},
	boundFunction: () => self.owner.bound()(),
	closure: () => self.owner.closure()(),
	closureInData: () => self.owner.inClosureData().f(),
	dateSubclass: () => self.owner.myDate(),
	dateMember: () => self.owner.dateProp().inst,
	typedArraySubclass: () => self.owner.myBytes(),
	regexpMember: () => self.owner.regexProp().inst,
	boxedMember: () => self.owner.boxedProp().inst,
	arrayBufferMember: () => self.owner.bufferProp().inst,
	typedArraySymbolMember: () => self.owner.symbolOnBytes()[Symbol.for("crossing.inst")],
	errorSubclass: () => self.owner.myErr(),
	mapSubclass: () => self.owner.myMap(),
	emitterSubclass: () => self.owner.myEmitter(),
	promiseSubclass: () => ({ value: self.owner.myPromise() }),
	arraySubclass: () => self.owner.myArr(),
	functionConstructor: () => self.owner.oldStyle(),
	objectCreate: () => self.owner.objCreate(),
	symbolKey: () => self.owner.symKey()[Symbol.for("crossing.inst")],
	proxyMember: () => self.owner.proxy().inst,
	storedInObject: () => {
		const box = {};
		self.owner.fillBox(box);
		return box.inst;
	},
	storedInArray: () => {
		const list = [];
		self.owner.fillArr(list);
		return list[0];
	},
	storedInMap: () => {
		const map = new Map();
		self.owner.fillMap(map);
		return map.get("k");
	},
	storedOnFunction: () => {
		const fn = () => {};
		self.owner.fillFn(fn);
		return fn.inst;
	},
	storedNested: () => {
		const box = { deep: {} };
		self.owner.fillNested(box);
		return box.deep.inst;
	},
	storedByDefine: () => {
		const box = {};
		self.owner.fillDefine(box);
		return box.inst;
	},
	constructedWith: () => self.owner.newWith(Taker).i,
	constructorArgument: () => {
		let got;
		class Catcher {
			constructor(instance) {
				got = instance;
			}
		}
		self.owner.newWith(Catcher);
		return got;
	},
	staticArgument: () => {
		self.owner.callStatic(Taker);
		return Taker.got;
	},
	emitterReturned: () => once(self.owner.emitter()),
	emitterHandedIn: () => {
		const emitter = new EventEmitter();
		let got;
		emitter.on("x", (instance) => (got = instance));
		self.owner.emitInto(emitter);
		return got;
	},
	eventPayload: async () => {
		let got;
		const { off } = self.slothlet.event.on("crossing-guard:carry", (payload) => (got = payload.inst));
		await self.owner.emitEvent();
		off?.();
		return got;
	},
	runtimeContext: () => {
		self.owner.viaContext();
		return context.crossingInst;
	},
	roundTripReturned: () => self.owner.roundTrip({}).inst,
	roundTripHeld: () => {
		const holder = {};
		self.owner.roundTrip(holder);
		return holder.inst;
	},
	methodReturningThis: () => self.owner.make().me(),
	methodCalledOn: () => {
		const instance = self.owner.make();
		return instance.me.call(instance);
	},
	thenable: async () => await self.owner.resolver(),
	deepMember: () => self.owner.nestedDeep().a.b.c[0].inst,
	objectValues: () => Object.values(self.owner.inData())[0],
	objectAssign: () => Object.assign({}, self.owner.inData()).inst,
	objectSpread: () => ({ ...self.owner.inData() }).inst,
	objectEntries: () => Object.entries(self.owner.inData())[0][1],
	fixedAccessor: () => self.owner.accessorDesc().inst,
	reflectGet: () => Reflect.get(self.owner.inData(), "inst"),
	reflectGetReceiver: () => Reflect.get(self.owner.getter(), "inst", {}),
	descriptorValue: () => Object.getOwnPropertyDescriptor(self.owner.inData(), "inst").value,
	descriptorsValue: () => Object.getOwnPropertyDescriptors(self.owner.inData()).inst.value,
	inheritedFromData: () => Object.create(self.owner.inData()).inst,
	destructured: () => {
		const { inst } = self.owner.inData();
		return inst;
	},
	arrayFrom: () => Array.from(self.owner.inSet())[0],
	promiseAll: async () => (await Promise.all([self.owner.makeAsync()]))[0],
	promiseThen: () => new Promise((resolve) => self.owner.makeAsync().then(resolve)),
	heldInstance: () => self.owner.heldOne()
};

/**
 * The name of every route.
 * @returns {string[]} The names.
 */
export function routes() {
	return Object.keys(ROUTES);
}

/** What the writes put on the owner's code. */
const planted = function planted() {
	return "planted";
};

/**
 * Run one write, answering how it ended.
 * @param {function(): void} write - The write.
 * @returns {string} `"written"`, `"refused"` for a write reporting false, or the error's code or name.
 */
function attempt(write) {
	try {
		return write() === false ? "refused" : "written";
	} catch (error) {
		return error?.code ?? error?.name ?? "threw";
	}
}

/**
 * Reach the owner's value by `route` and try every write that would change the owner's code through it, each under a
 * key starting with `prefix`.
 * @param {string} route - A name in {@link ROUTES}.
 * @param {string} prefix - What every key written starts with.
 * @returns {Promise<{reached: string, proxied: boolean, writes: Object<string, string>}>} What was reached, whether it
 *   is a Proxy, and each write's outcome.
 */
export async function plant(route, prefix) {
	let value;
	try {
		value = await ROUTES[route]();
	} catch (error) {
		return { reached: `threw ${error?.code ?? error?.name}`, proxied: false, writes: {} };
	}
	if (value === null || (typeof value !== "object" && typeof value !== "function"))
		return { reached: typeof value, proxied: false, writes: {} };
	if ("prototype" in value && typeof value !== "function") {
		const target = value.prototype;
		const writes = { direct: attempt(() => void (target[`${prefix}direct`] = planted)) };
		return { reached: "prototype", proxied: types.isProxy(target), writes };
	}
	if ("value" in value && Object.keys(value).length === 1) value = value.value;
	const isClass = typeof value === "function";
	if (isClass) {
		// A class: its prototype, and its statics added, replaced and removed.
		return {
			reached: "class",
			proxied: types.isProxy(value),
			writes: {
				classPrototype: attempt(() => void (value.prototype[`${prefix}classPrototype`] = planted)),
				staticAdded: attempt(() => void (value[`${prefix}staticAdded`] = planted)),
				staticReplaced: attempt(() => void (value.create = planted)),
				staticDeleted: attempt(() => delete value.create)
			}
		};
	}
	// An instance: its class's prototype however it is reached, the class's statics, and the instance's own code.
	const writes = {
		getPrototypeOf: attempt(() => void (Object.getPrototypeOf(value)[`${prefix}getPrototypeOf`] = planted)),
		dunderProto: attempt(() => void (value.__proto__[`${prefix}dunderProto`] = planted)),
		define: attempt(
			() => void Object.defineProperty(Object.getPrototypeOf(value), `${prefix}define`, { value: planted, configurable: true })
		),
		reflectSet: attempt(() => Reflect.set(Object.getPrototypeOf(value), `${prefix}reflectSet`, planted)),
		protoAccessor: attempt(
			() => void (Object.getOwnPropertyDescriptor(Object.prototype, "__proto__").get.call(value)[`${prefix}protoAccessor`] = planted)
		),
		methodShadowed: attempt(() => void (value.hi = planted)),
		methodDefined: attempt(() => void Object.defineProperty(value, "hi", { value: planted, configurable: true })),
		prototypeSet: attempt(() => Reflect.setPrototypeOf(value, Object.create(Object.getPrototypeOf(value), { hi: { value: planted } })))
	};
	// The class the instance names as its constructor, when it is one of the owner's (never the language's own).
	const owned = Object.hasOwn(Object.getPrototypeOf(value), "constructor") ? value.constructor : null;
	if (typeof owned === "function") {
		writes.constructorPrototype = attempt(() => void (owned.prototype[`${prefix}constructorPrototype`] = planted));
		writes.staticAdded = attempt(() => void (owned[`${prefix}staticAdded`] = planted));
		if (Object.hasOwn(owned, "create")) writes.staticReplaced = attempt(() => void (owned.create = planted));
	}
	return { reached: "instance", proxied: types.isProxy(value), writes };
}

/**
 * Reach an object the owner uses as a prototype but hands over as data, replace a function it holds, and add a member
 * to it.
 * @param {string} prefix - What the added key starts with.
 * @returns {{replaced: string, added: string}} Each write's outcome.
 */
export function prototypeAsData(prefix) {
	const target = self.owner.protoAsData().proto;
	return {
		replaced: attempt(() => void (target.hi = planted)),
		added: attempt(() => void (target[`${prefix}added`] = 1))
	};
}

/** An object and a function of this module's, registered with the owner. */
const mine = { mine: true };
const mineFn = () => 1;

/**
 * What ordinary code gets from the owner's values: the same answers whether `owner` is the module itself or another
 * module's `self.owner`.
 * @param {object} owner - The owner's functions.
 * @returns {Promise<object>} Each answer, by name.
 */
export async function battery(owner) {
	const answers = {};
	const answer = async (name, read) => {
		try {
			answers[name] = await read();
		} catch (error) {
			answers[name] = `threw ${error?.code ?? error?.name}: ${String(error?.message).slice(0, 60)}`;
		}
	};
	const instance = owner.make();
	const Class = owner.cls();
	await answer("privateGetter", () => instance.secret);
	await answer("method", () => instance.hi());
	await answer("instanceofClass", () => instance instanceof Class);
	await answer("methodReturningThis", () => instance.me() === instance);
	await answer("sameMemberTwice", () => {
		const data = owner.inData();
		return data.inst === data.inst;
	});
	await answer("ownKeys", () => Object.keys(instance).join());
	await answer("handedBack", () => owner.takeBack(instance));
	await answer("privateInOwner", () => owner.secretOf(instance));
	await answer("objectAcrossTwoFunctions", () => {
		owner.add(mine);
		return owner.has(mine);
	});
	await answer("functionAcrossTwoFunctions", () => {
		owner.add(mineFn);
		return owner.has(mineFn);
	});
	await answer("sameValueTwice", () => owner.getHeld() === owner.getHeld());
	await answer("ownersValueHandedBack", () => owner.isHeld(owner.getHeld()));
	await answer("ownValueComesBack", () => {
		const holder = {};
		return owner.roundTrip(holder) === holder;
	});
	await answer("ownValueStoredAndRead", () => {
		const fresh = { fresh: true };
		owner.add(fresh);
		return [...owner.all()].includes(fresh);
	});
	await answer("subclass", () => {
		class Extended extends Class {
			more() {
				return 2;
			}
		}
		const extended = new Extended();
		return [extended instanceof Extended, extended instanceof Class, extended.hi(), extended.more(), extended.secret].join();
	});
	await answer("url", () => {
		const url = owner.url();
		return [url.href, url.searchParams.get("b"), url instanceof URL, String(url), new URL(url).host, JSON.stringify(url)].join("|");
	});
	await answer("map", () => {
		const map = owner.mapOf();
		return [map.get("a").z, map.size, [...map].length, map instanceof Map, [...map.keys()].join()].join("|");
	});
	await answer("buffer", () => {
		const buffer = owner.buf();
		return [Buffer.isBuffer(buffer), buffer.toString(), Buffer.concat([buffer]).length].join("|");
	});
	await answer("date", () => owner.date().getTime());
	await answer("error", () => {
		try {
			owner.thrown();
		} catch (error) {
			return [error instanceof Error, error.message, typeof error.stack].join("|");
		}
	});
	await answer("plainData", () => {
		const plain = owner.plain();
		return [JSON.stringify(plain), Object.keys(plain).join(), Array.isArray(plain.list), plain.list.length, plain.a === plain.a].join("|");
	});
	await answer("dataWritten", () => {
		const data = owner.inData();
		data.count = 1;
		delete data.inst;
		return [data.count, "inst" in data].join("|");
	});
	await answer("functionStoredInData", () => {
		const table = owner.handlers();
		table.added = () => "added";
		table.label = "y";
		return [table.added(), table.label, table.onSave()].join("|");
	});
	await answer("promiseSameTwice", () => {
		const box = owner.inPromiseData();
		return box.p === box.p;
	});
	await answer("rejectionCaught", async () => {
		try {
			await owner.rejecting();
			return "no rejection";
		} catch (error) {
			return error.message;
		}
	});
	await answer("closedObjectFollowsItsOwner", () => {
		const value = owner.closed();
		const before = Object.keys(value).join();
		owner.touch(value);
		return [
			before,
			Object.keys(value).join(),
			Object.getOwnPropertyDescriptor(value, "a").value,
			"b" in value,
			Object.isExtensible(value)
		].join("|");
	});
	await answer("frozenByReader", () => Object.isFrozen(Object.freeze(owner.plain())));
	await answer("inspected", async () => (await import("node:util")).inspect(owner.plain()));
	await answer("arrayMethods", () => {
		const list = owner.plain().list;
		list.push(4);
		return [list.map((item) => item * 2).join(), list.includes(4), list.indexOf(2), [...list].length].join("|");
	});
	return answers;
}

/**
 * {@link battery} against the owner as this module reaches it.
 * @returns {Promise<object>} Each answer, by name.
 */
export function answers() {
	return battery(self.owner);
}

/** What one function of this module read from the owner, for another to compare. */
let keptHeld;

/**
 * Keep the owner's held object as this function reads it.
 * @returns {void}
 */
export function keep() {
	keptHeld = self.owner.getHeld();
}

/**
 * Whether the owner's held object, read in another function of this module, is the one {@link keep} read.
 * @returns {boolean} True when it is.
 */
export function compare() {
	return keptHeld === self.owner.getHeld();
}

/**
 * How another module's values show to the tools that tell a Proxy from an object, which differ from plain JavaScript
 * while the permission system is on.
 * @returns {{dataWrapped: boolean, instanceWrapped: boolean, cloned: string}} What each tool answers.
 */
export function shows() {
	const data = self.owner.plain();
	let cloned;
	try {
		cloned = JSON.stringify(structuredClone(data));
	} catch (error) {
		cloned = error.name;
	}
	return { dataWrapped: types.isProxy(data), instanceWrapped: types.isProxy(self.owner.make()), cloned };
}

/** Routes that reach the owner's code by a detour: each makes its writes itself and answers how they ended. */
const DETOURS = {
	// Run out of stack while the value is being decided, and write from the frame that still has room.
	stackExhausted: (prefix) => {
		const data = self.owner.inData();
		let outcome = "refused";
		const dive = (depth) => {
			try {
				dive(depth + 1);
			} catch {
				// Out of stack: unwind one frame and try from there.
			}
			if (outcome !== "refused") return;
			try {
				Object.getPrototypeOf(data.inst)[`${prefix}stack`] = planted;
				outcome = "written";
			} catch {
				// Refused, or still out of stack.
			}
		};
		dive(0);
		return outcome;
	},
	// Have the owner run a built-in bound to the write: no frame of this module's is on the stack when it lands.
	boundBuiltIn: (prefix) =>
		attempt(() => void self.owner.run(Reflect.set.bind(null, Object.getPrototypeOf(self.owner.make()), `${prefix}bound`, planted))),
	closureRunByOwner: (prefix) =>
		attempt(
			() =>
				void self.owner.run(() => {
					Object.getPrototypeOf(self.owner.make())[`${prefix}closure`] = planted;
				})
		),
	// Hand the owner's value back to the owner and take what it returns.
	echoedData: (prefix) =>
		attempt(() => void (Object.getPrototypeOf(self.owner.echo(self.owner.inData()).inst)[`${prefix}echoData`] = planted)),
	echoedInstance: (prefix) =>
		attempt(() => void (Object.getPrototypeOf(self.owner.echo(self.owner.make()))[`${prefix}echoInst`] = planted)),
	// Pass the owner's instance through one of its functions, then read it again nested in data.
	passedThroughOwner: (prefix) =>
		attempt(() => {
			self.owner.isHeldInstance(self.owner.heldOne());
			Object.getPrototypeOf(self.owner.heldBox().inst)[`${prefix}passed`] = planted;
		}),
	// Read the class once, then reach its prototype through an instance.
	afterClassReturned: (prefix) =>
		attempt(() => {
			self.owner.cls();
			self.owner.make().constructor.prototype[`${prefix}afterClass`] = planted;
		}),
	hasInstanceDefined: () =>
		attempt(
			() => void Object.defineProperty(self.owner.inData().inst.constructor, Symbol.hasInstance, { value: () => true, configurable: true })
		),
	functionPrototypeMember: () => attempt(() => void (self.owner.legacy().Legacy.prototype.hi = planted)),
	functionPrototypeReplaced: () => attempt(() => void (self.owner.legacy().Legacy.prototype = { hi: planted })),
	instancePrototypeAssigned: () => attempt(() => void (self.owner.heldOne().__proto__ = { hi: planted })),
	instanceDataWritten: () =>
		attempt(() => {
			const instance = self.owner.heldOne();
			instance.flag = 1;
			if (instance.flag !== 1) throw new Error("not written");
			delete instance.flag;
		})
};

/**
 * The name of every detour.
 * @returns {string[]} The names.
 */
export function detours() {
	return Object.keys(DETOURS);
}

/**
 * Take one detour.
 * @param {string} name - A name in {@link DETOURS}.
 * @param {string} prefix - What every key written starts with.
 * @returns {string} How its write ended.
 */
export function detour(name, prefix) {
	return DETOURS[name](prefix);
}
