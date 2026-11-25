/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-snapshot-helpers.test.vitest.mjs
 *	@Date: 2026-11-25T01:30:44-08:00 (1795599044)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:10:08-08:00 (1795601408)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The run snapshot's helpers driven directly, on a fresh copy of the module: before the handlers set the
 * platform's kind, Proxy and view checks (the module's own fallbacks), and after a test sets stand-ins that answer as
 * the platform does.
 *
 * @description
 * Every expected value is what plain JavaScript answers: a `Map` is a map, a `WeakMap` is shared live, a run reads an
 * object as it was when the run started, and what the run writes stays in the run. The objects are made here; nothing
 * is loaded through slothlet.
 * @module tests/vitests/suites/context/run-snapshot-helpers
 */

import { types } from "node:util";
import { EventEmitter } from "node:events";
import { describe, it, expect, beforeEach, vi } from "vitest";

/** @type {typeof import("#helpers/run-snapshot")} */
let rs;

beforeEach(async () => {
	vi.resetModules();
	rs = await import("#helpers/run-snapshot");
});

/**
 * The kinds the platform's own brand checks tell, as the handlers set them.
 * @param {*} value - The value.
 * @returns {string|null} The kind.
 */
const platformKind = (value) => {
	if (types.isMap(value)) return "map";
	if (types.isSet(value)) return "set";
	if (types.isDate(value)) return "date";
	if (types.isRegExp(value)) return "regexp";
	if (types.isTypedArray(value)) return "typed";
	if (types.isArrayBuffer(value)) return "buffer";
	if (types.isDataView(value)) return "dataview";
	if (types.isWeakMap(value) || types.isWeakSet(value) || value instanceof WeakRef) return "weak";
	if (types.isPromise(value)) return "promise";
	return null;
};

/**
 * Open a run on a new instance object.
 * @returns {{owner: object, snap: object, domain: object}} The instance object, the run and the instance's domain.
 */
const openRun = () => {
	const owner = {};
	const snap = rs.openRunSnapshot(owner, null);
	return { owner, snap, domain: rs.instanceDomain(owner) };
};

describe("run snapshot > domains and windows", () => {
	it("an owner that is not an object, or never had a run, has no domain", () => {
		for (const owner of [null, undefined, 1, "x", true]) expect(rs.domainOf(owner)).toBe(null);
		expect(rs.domainOf({})).toBe(null);
		const fn = () => {};
		const snap = rs.openRunSnapshot(fn, null);
		expect(rs.domainOf(fn)).toBe(rs.instanceDomain(fn));
		rs.closeRunSnapshot(snap);
	});

	it("closing nothing, or a run twice, changes nothing", () => {
		const before = rs.snapshotCounts().runs;
		rs.closeRunSnapshot(null);
		rs.closeRunSnapshot(undefined);
		const { snap } = openRun();
		expect(rs.snapshotCounts().runs).toBe(before + 1);
		rs.closeRunSnapshot(snap);
		rs.closeRunSnapshot(snap);
		expect(rs.snapshotCounts().runs).toBe(before);
	});

	it("a checkpoint runs once per window, and never with no run open", () => {
		const fn = vi.fn();
		rs.checkpointOnce(null, "k", fn);
		const owner = {};
		rs.checkpointOnce(rs.instanceDomain(owner), "k", fn);
		expect(fn).toHaveBeenCalledTimes(0);
		const first = rs.openRunSnapshot(owner, null);
		const domain = rs.instanceDomain(owner);
		rs.checkpointOnce(domain, "k", fn);
		rs.checkpointOnce(domain, "k", fn);
		expect(fn).toHaveBeenCalledTimes(1);
		const second = rs.openRunSnapshot(owner, null);
		rs.checkpointOnce(domain, "k", fn);
		expect(fn).toHaveBeenCalledTimes(2);
		rs.closeRunSnapshot(second);
		rs.closeRunSnapshot(first);
	});

	it("closing the newest run keeps the versions an older open run still reads", () => {
		const owner = {};
		const older = rs.openRunSnapshot(owner, null);
		const newer = rs.openRunSnapshot(owner, null);
		const domain = rs.instanceDomain(owner);
		const subject = { n: 1 };
		const other = { n: 1 };
		rs.beforeChange(domain, subject, rs.shallowCopy);
		rs.beforeChange(domain, other, rs.shallowCopy);
		subject.n = 2;
		other.n = 2;
		rs.closeRunSnapshot(newer);
		expect(rs.versionAt(domain, subject, older.start)).toEqual({ n: 1 });
		expect(rs.versionAt(domain, other, older.start)).toEqual({ n: 1 });
		rs.closeRunSnapshot(older);
	});

	it("a start no kept version spans reads the object as it is", () => {
		const owner = {};
		const first = rs.openRunSnapshot(owner, null);
		const domain = rs.instanceDomain(owner);
		const subject = { n: 1 };
		rs.beforeChange(domain, subject, rs.shallowCopy);
		subject.n = 2;
		const second = rs.openRunSnapshot(owner, null);
		rs.beforeChange(domain, subject, rs.shallowCopy);
		subject.n = 3;
		rs.closeRunSnapshot(first);
		const third = rs.openRunSnapshot(owner, null);
		rs.beforeChange(domain, subject, rs.shallowCopy);
		subject.n = 4;
		expect(rs.versionAt(domain, subject, first.start)).toBe(rs.CURRENT);
		expect(rs.versionAt(domain, subject, second.start)).toEqual({ n: 2 });
		expect(rs.versionAt(domain, subject, third.start)).toEqual({ n: 3 });
		rs.closeRunSnapshot(third);
		rs.closeRunSnapshot(second);
	});

	it("with no domain, an object is read as it is and counts as saved", () => {
		const subject = {};
		expect(rs.versionAt(null, subject, 1)).toBe(rs.CURRENT);
		expect(rs.beforeChange(null, subject, () => ({}))).toBe(false);
		expect(rs.savedThisWindow(null, subject)).toBe(true);
	});

	it("a run reads a function's default prototype as the language made it, after the instance added to it", () => {
		const { snap, domain } = openRun();
		function Thing() {}
		expect(rs.isDefaultPrototype(Thing.prototype, Thing)).toBe(true);
		expect(rs.saveDefaultPrototype(domain, Thing.prototype, Thing)).toBe(true);
		Thing.prototype.extra = 1;
		const seen = rs.versionAt(domain, Thing.prototype, snap.start);
		expect(Reflect.ownKeys(seen)).toEqual(["constructor"]);
		expect(rs.isDefaultPrototype(seen, Thing)).toBe(true);
		expect(rs.versionAt(domain, Thing.prototype, snap.start)).toBe(seen);
		rs.closeRunSnapshot(snap);
	});

	it("a default prototype is told by its shape, its attributes and its prototype", () => {
		function Thing() {}
		expect(rs.isDefaultPrototype(null, Thing)).toBe(false);
		expect(rs.isDefaultPrototype(1, Thing)).toBe(false);
		expect(rs.isDefaultPrototype({ constructor: Thing }, Thing)).toBe(false);
		expect(rs.isDefaultPrototype(Object.create(null), Thing)).toBe(false);
		expect(rs.isDefaultPrototype(Object.preventExtensions(Object.create(Thing.prototype)), Thing)).toBe(false);
		function Other() {}
		expect(rs.isDefaultPrototype(Other.prototype, Thing)).toBe(false);
		function Grown() {}
		Grown.prototype.more = 1;
		expect(rs.isDefaultPrototype(Grown.prototype, Grown)).toBe(false);
	});

	it("a saved version whose content is not an object answers its run, and is saved again in the next window", () => {
		const { owner, snap, domain } = openRun();
		const subject = { n: 1 };
		rs.beforeChange(domain, subject, () => null);
		expect(rs.versionAt(domain, subject, snap.start)).toBe(null);
		const next = rs.openRunSnapshot(owner, null);
		subject.n = 2;
		rs.checkpointDeep(domain, subject);
		subject.n = 3;
		expect(rs.versionAt(domain, subject, next.start)).toEqual({ n: 2 });
		rs.closeRunSnapshot(next);
		rs.closeRunSnapshot(snap);
	});
});

describe("run snapshot > kinds, without the platform's checks", () => {
	it("tells each built-in data kind by its brand", () => {
		const buffer = new ArrayBuffer(8);
		expect(rs.builtinKind(new Map())).toBe("map");
		expect(rs.builtinKind(new Set())).toBe("set");
		expect(rs.builtinKind(new Date(0))).toBe("date");
		expect(rs.builtinKind(/x/)).toBe("regexp");
		expect(rs.builtinKind(new Uint8Array(2))).toBe("typed");
		expect(rs.builtinKind(buffer)).toBe("buffer");
		expect(rs.builtinKind(new DataView(buffer))).toBe("dataview");
		expect(rs.builtinKind({})).toBe(null);
		expect(rs.builtinKind(null)).toBe(null);
		expect(rs.builtinKind(1)).toBe(null);
	});

	it("tells what a run shares live by its prototype chain and brands", () => {
		expect(rs.isSharedLive(null)).toBe(false);
		expect(rs.isSharedLive(1)).toBe(false);
		expect(rs.isSharedLive(() => {})).toBe(true);
		const settled = Promise.resolve(1);
		expect(rs.isSharedLive(settled)).toBe(true);
		expect(rs.isSharedLive(new WeakMap())).toBe(true);
		expect(rs.isSharedLive(new WeakSet())).toBe(true);
		expect(rs.isSharedLive(new WeakRef({}))).toBe(true);
		expect(rs.isSharedLive(new EventTarget())).toBe(true);
		expect(rs.isSharedLive(new EventEmitter())).toBe(true);
		expect(rs.isSharedLive({})).toBe(false);
		expect(rs.isSharedLive(new Map())).toBe(false);
	});

	it("an emitter inherits on and emit functions", () => {
		expect(rs.isEmitterLike(null)).toBe(false);
		expect(rs.isEmitterLike(1)).toBe(false);
		expect(rs.isEmitterLike({ on() {}, emit() {} })).toBe(false);
		expect(rs.isEmitterLike(Object.create({ on() {}, emit() {} }))).toBe(true);
		expect(rs.isEmitterLike(Object.create({ on: 1, emit() {} }))).toBe(false);
	});

	it("a Proxy prototype is the platform's, not a module's, once Proxies are told apart", () => {
		rs.setProxyCheck((value) => types.isProxy(value));
		expect(rs.isLanguagePrototype(new Proxy({}, {}))).toBe(true);
	});

	it("a prototype is the language's when its constructor is native code or it is an emitter's, and a module's otherwise", () => {
		class Mine {}
		expect(rs.isLanguagePrototype(Mine.prototype)).toBe(false);
		expect(rs.isLanguagePrototype(Mine.prototype)).toBe(false);
		expect(rs.isLanguagePrototype({ constructor: 1 })).toBe(false);
		expect(rs.isLanguagePrototype(Map.prototype)).toBe(true);
		expect(rs.isLanguagePrototype(EventEmitter.prototype)).toBe(true);
		expect(rs.isLanguagePrototype(null)).toBe(true);
	});
});

describe("run snapshot > kinds, with the platform's checks", () => {
	beforeEach(() => {
		rs.setKindCheck(platformKind);
	});

	it("a weak collection or a promise is no data kind, the rest are the platform's answer", () => {
		expect(rs.builtinKind(new WeakMap())).toBe(null);
		expect(rs.builtinKind(Promise.resolve())).toBe(null);
		expect(rs.builtinKind(new Map())).toBe("map");
	});

	it("shares live a weak collection, a promise, an EventTarget and an emitter, and nothing of a data kind", () => {
		expect(rs.isSharedLive(new WeakSet())).toBe(true);
		expect(rs.isSharedLive(Promise.resolve())).toBe(true);
		expect(rs.isSharedLive(new Map())).toBe(false);
		expect(rs.isSharedLive(new EventTarget())).toBe(true);
		expect(rs.isSharedLive(new EventEmitter())).toBe(true);
		expect(rs.isSharedLive({})).toBe(false);
	});
});

describe("run snapshot > classes with private names", () => {
	it("is false for anything but an object", () => {
		expect(rs.declaresPrivate(null)).toBe(false);
		expect(rs.declaresPrivate(1)).toBe(false);
		expect(rs.declaresPrivate({})).toBe(false);
	});

	it("finds #names outside strings, templates, regular expressions and comments", () => {
		class Plain {
			text = "#notPrivate";
			other = "#no";
			tpl = `#no`;
			re = /#no/;
			// #no
			/* #no */
			m() {
				return 4 / 2;
			}
		}
		class Real {
			#hidden = 1;
			read() {
				return this.#hidden;
			}
		}
		expect(rs.declaresPrivate(new Plain())).toBe(false);
		expect(rs.declaresPrivate(new Real())).toBe(true);
		expect(rs.declaresPrivate(new Real())).toBe(true);
	});

	it("finds #names that come after a regular expression literal holding a quote or a /*", () => {
		class AfterQuote {
			static re = /'/;
			#x = 1;
			read() {
				return this.#x;
			}
		}
		class AfterStar {
			static re = /\/*a/;
			#x = 1;
			read() {
				return this.#x;
			}
		}
		class AfterReturn {
			test(text) {
				return /["`]/.test(text);
			}
			#x = 1;
			read() {
				return this.#x;
			}
		}
		class AfterClass {
			static re = /[/"]/;
			#x = 1;
			read() {
				return this.#x;
			}
		}
		expect(rs.declaresPrivate(new AfterQuote())).toBe(true);
		expect(rs.declaresPrivate(new AfterStar())).toBe(true);
		expect(rs.declaresPrivate(new AfterReturn())).toBe(true);
		expect(rs.declaresPrivate(new AfterClass())).toBe(true);
	});

	it("finds #names after strings with escaped quotes and templates with substitutions", () => {
		class Escaped {
			a = "q\"'#no";
			b = "r'\"#no";
		}
		class Nested {
			a = `${"`"}`;
			b = "/*";
			#p = 1;
			read() {
				return this.#p;
			}
		}
		class Deep {
			a = `x${{ k: `y${"}"}` }.k}z`;
			#p = 1;
			read() {
				return this.#p;
			}
		}
		class Substituted {
			a = `${1}`;
			b = "#no";
		}
		expect(rs.declaresPrivate(new Escaped())).toBe(false);
		expect(rs.declaresPrivate(new Nested())).toBe(true);
		expect(rs.declaresPrivate(new Deep())).toBe(true);
		expect(rs.declaresPrivate(new Substituted())).toBe(false);
	});

	it("a run's view of such an instance runs its methods on the instance, as plain JS does", () => {
		class AfterQuote {
			static re = /'/;
			#x = 7;
			read() {
				return this.#x;
			}
		}
		const { snap } = openRun();
		const raw = new AfterQuote();
		const view = rs.handOutRaw(snap, raw);
		expect(view.read()).toBe(7);
		rs.closeRunSnapshot(snap);
	});

	it("a class whose constructor's source cannot be read declares none", () => {
		const { proxy, revoke } = Proxy.revocable(class Made {}, {});
		revoke();
		const value = Object.create({ constructor: proxy });
		expect(rs.declaresPrivate(value)).toBe(false);
	});

	it("an unterminated comment in a class's source ends the scan", () => {
		const value = Object.create({ constructor: { toString: null } });
		expect(rs.declaresPrivate(value)).toBe(false);
	});
});

describe("run snapshot > copies", () => {
	it("copies a DataView's own bytes, at its offset and length", () => {
		const buffer = new ArrayBuffer(8);
		new Uint8Array(buffer).set([1, 2, 3, 4, 5, 6, 7, 8]);
		const view = new DataView(buffer, 2, 4);
		const copy = rs.shallowCopy(view);
		expect(copy).toBeInstanceOf(DataView);
		expect(copy.byteLength).toBe(4);
		expect([0, 1, 2, 3].map((at) => copy.getUint8(at))).toEqual([3, 4, 5, 6]);
		view.setUint8(0, 99);
		expect(copy.getUint8(0)).toBe(3);
	});

	it("copies an ArrayBuffer's bytes", () => {
		const buffer = new Uint8Array([1, 2, 3]).buffer;
		const copy = rs.shallowCopy(buffer);
		expect(copy).not.toBe(buffer);
		expect([...new Uint8Array(copy)]).toEqual([1, 2, 3]);
	});

	it("copies what an object describes, skipping a key it lists but does not describe", () => {
		const target = { a: 1 };
		const listed = new Proxy(target, { ownKeys: () => ["a", "ghost"] });
		const copy = rs.shallowCopy(listed);
		expect(Reflect.ownKeys(copy)).toEqual(["a"]);
		expect(copy.a).toBe(1);
	});
});

describe("run snapshot > saving deep values", () => {
	it("does nothing with no domain, no run open, or a value that is not an object", () => {
		const owner = {};
		const domain = rs.instanceDomain(owner);
		const before = rs.snapshotCounts().versions;
		rs.checkpointDeep(null, { a: 1 });
		rs.checkpointDeep(domain, { a: 1 });
		const snap = rs.openRunSnapshot(owner, null);
		rs.checkpointDeep(domain, 1);
		rs.checkpointDeep(domain, null);
		expect(rs.snapshotCounts().versions).toBe(before);
		rs.closeRunSnapshot(snap);
	});

	it("a run reads a nested value, a Map's and a Set's members, as they were at its start; shared live values are left alone", () => {
		const { snap, domain } = openRun();
		const inner = { b: 1 };
		const member = { c: 1 };
		const setMember = { d: 1 };
		const raw = { a: inner, again: inner, m: new Map([["k", member]]), s: new Set([setMember]), w: new WeakMap(), p: Promise.resolve() };
		raw.self = raw;
		rs.checkpointDeep(domain, raw);
		inner.b = 2;
		member.c = 2;
		setMember.d = 2;
		raw.m.set("k2", 1);
		expect(rs.versionAt(domain, inner, snap.start)).toEqual({ b: 1 });
		expect(rs.versionAt(domain, member, snap.start)).toEqual({ c: 1 });
		expect(rs.versionAt(domain, setMember, snap.start)).toEqual({ d: 1 });
		expect([...rs.versionAt(domain, raw.m, snap.start).keys()]).toEqual(["k"]);
		expect(rs.versionAt(domain, raw.w, snap.start)).toBe(rs.CURRENT);
		rs.closeRunSnapshot(snap);
	});

	it("leaves alone what the caller's skip names, and a Proxy once Proxies are told apart", () => {
		const { snap, domain } = openRun();
		const skipped = { n: 1 };
		rs.checkpointDeep(domain, skipped, new Set(), (value) => value === skipped);
		rs.setProxyCheck((value) => types.isProxy(value));
		const proxied = new Proxy({ n: 1 }, {});
		rs.checkpointDeep(domain, proxied);
		expect(rs.versionAt(domain, skipped, snap.start)).toBe(rs.CURRENT);
		expect(rs.versionAt(domain, proxied, snap.start)).toBe(rs.CURRENT);
		rs.closeRunSnapshot(snap);
	});

	it("a value saved again in a new window keeps its version when unchanged, and saves a new one for each kind of change", () => {
		const owner = {};
		const first = rs.openRunSnapshot(owner, null);
		const domain = rs.instanceDomain(owner);
		const same = { a: 1 };
		const getter = () => 1;
		const accessor = Object.defineProperty({}, "x", { get: getter, enumerable: true, configurable: true });
		const reshaped = { a: 1 };
		const grown = { a: 1 };
		const hidden = { a: 1 };
		const valued = { a: 1 };
		const toAccessor = { a: 1 };
		const listed = { a: 1, b: 2 };
		const values = [same, accessor, reshaped, grown, hidden, valued, toAccessor, listed];
		for (const value of values) rs.checkpointDeep(domain, value);
		const second = rs.openRunSnapshot(owner, null);
		Object.setPrototypeOf(reshaped, { inherited: 1 });
		grown.b = 2;
		Object.defineProperty(hidden, "a", { enumerable: false });
		valued.a = 2;
		Object.defineProperty(toAccessor, "a", { get: () => 1, enumerable: true });
		delete listed.a;
		listed.a = 1;
		const ghostTarget = { a: 1 };
		const ghost = new Proxy(ghostTarget, { ownKeys: () => ["a", "ghost"] });
		for (const value of [...values, ghost]) rs.checkpointDeep(domain, value);
		// Each reads, for the second run, what it held when that run started: the unchanged ones their one version.
		const sameVersion = rs.versionAt(domain, same, first.start);
		expect(rs.versionAt(domain, same, second.start)).toBe(sameVersion);
		expect(Object.getOwnPropertyDescriptor(rs.versionAt(domain, accessor, second.start), "x").get).toBe(getter);
		reshaped.a = 9;
		grown.a = 9;
		hidden.a = 9;
		valued.a = 9;
		listed.a = 9;
		same.a = 9;
		rs.checkpointDeep(domain, same);
		expect(rs.versionAt(domain, reshaped, second.start).inherited).toBe(1);
		expect(rs.versionAt(domain, grown, second.start)).toEqual({ a: 1, b: 2 });
		expect(Object.getOwnPropertyDescriptor(rs.versionAt(domain, hidden, second.start), "a").enumerable).toBe(false);
		expect(rs.versionAt(domain, valued, second.start)).toEqual({ a: 2 });
		expect(Reflect.ownKeys(rs.versionAt(domain, listed, second.start))).toEqual(["b", "a"]);
		expect(rs.versionAt(domain, same, first.start)).toEqual({ a: 1 });
		rs.closeRunSnapshot(second);
		rs.closeRunSnapshot(first);
	});

	it("a Map, a Set or a Date saved again in a new window keeps its version only while it holds the same", () => {
		rs.setKindCheck(platformKind);
		const owner = {};
		const first = rs.openRunSnapshot(owner, null);
		const domain = rs.instanceDomain(owner);
		class MyMap extends Map {}
		const make = () => ({
			mapSame: new Map([["a", 1]]),
			mapSize: new Map([["a", 1]]),
			mapEntry: new Map([["a", 1]]),
			mapProto: new Map([["a", 1]]),
			mapMember: new Map([["a", 1]]),
			mapMemberValue: Object.assign(new Map([["a", 1]]), { tag: 1 }),
			mapKeyOrder: Object.assign(new Map(), { x: 1, y: 2 }),
			setSame: new Set([1]),
			setSize: new Set([1]),
			setMember: new Set([1]),
			dateSame: new Date(1000),
			dateTime: new Date(1000),
			regexp: /x/
		});
		const v = make();
		for (const value of Object.values(v)) rs.checkpointDeep(domain, value);
		const second = rs.openRunSnapshot(owner, null);
		v.mapSize.set("b", 2);
		v.mapEntry.set("a", 2);
		Object.setPrototypeOf(v.mapProto, MyMap.prototype);
		v.mapMember.tag = 1;
		v.mapMemberValue.tag = 2;
		delete v.mapKeyOrder.x;
		v.mapKeyOrder.x = 1;
		v.setSize.add(2);
		v.setMember.delete(1);
		v.setMember.add(2);
		v.dateTime.setTime(2000);
		for (const value of Object.values(v)) rs.checkpointDeep(domain, value);
		expect(rs.versionAt(domain, v.mapSame, second.start)).toBe(rs.versionAt(domain, v.mapSame, first.start));
		expect(rs.versionAt(domain, v.setSame, second.start)).toBe(rs.versionAt(domain, v.setSame, first.start));
		expect(rs.versionAt(domain, v.dateSame, second.start)).toBe(rs.versionAt(domain, v.dateSame, first.start));
		// Changed ones: the second run's version holds what each held at its start.
		v.mapSize.clear();
		v.mapEntry.clear();
		v.mapProto.clear();
		v.mapMember.clear();
		v.mapMemberValue.clear();
		v.mapKeyOrder.clear();
		v.setSize.clear();
		v.setMember.clear();
		v.dateTime.setTime(3000);
		for (const value of Object.values(v)) rs.beforeChange(domain, value, rs.shallowCopy);
		expect([...rs.versionAt(domain, v.mapSize, second.start)]).toEqual([
			["a", 1],
			["b", 2]
		]);
		expect([...rs.versionAt(domain, v.mapEntry, second.start)]).toEqual([["a", 2]]);
		expect(Object.getPrototypeOf(rs.versionAt(domain, v.mapProto, second.start))).toBe(MyMap.prototype);
		expect(rs.versionAt(domain, v.mapMember, second.start).tag).toBe(1);
		expect(rs.versionAt(domain, v.mapMemberValue, second.start).tag).toBe(2);
		expect(Object.keys(rs.versionAt(domain, v.mapKeyOrder, second.start))).toEqual(["y", "x"]);
		expect([...rs.versionAt(domain, v.setSize, second.start)]).toEqual([1, 2]);
		expect([...rs.versionAt(domain, v.setMember, second.start)]).toEqual([2]);
		expect(rs.versionAt(domain, v.dateTime, second.start).getTime()).toBe(2000);
		expect([...rs.versionAt(domain, v.mapSame, first.start)]).toEqual([["a", 1]]);
		rs.closeRunSnapshot(second);
		rs.closeRunSnapshot(first);
	});

	it("a default prototype saved as its function is saved again as a copy in a new window", () => {
		const owner = {};
		const first = rs.openRunSnapshot(owner, null);
		const domain = rs.instanceDomain(owner);
		function Thing() {}
		rs.saveDefaultPrototype(domain, Thing.prototype, Thing);
		const second = rs.openRunSnapshot(owner, null);
		rs.checkpointDeep(domain, Thing.prototype);
		Thing.prototype.later = 1;
		expect(Reflect.ownKeys(rs.versionAt(domain, Thing.prototype, second.start))).toEqual(["constructor"]);
		rs.closeRunSnapshot(second);
		rs.closeRunSnapshot(first);
	});
});

describe("run snapshot > what a run is handed", () => {
	it("hands values that are not objects, and anything with no run, as they are", () => {
		const { snap } = openRun();
		const raw = { a: 1 };
		expect(rs.handOutRaw(null, raw)).toBe(raw);
		expect(rs.handOutRaw(snap, 1)).toBe(1);
		expect(rs.rawBehind(1)).toBe(1);
		expect(rs.rawBehind(raw)).toBe(raw);
		expect(rs.isRawRunView(raw)).toBe(false);
		expect(rs.isRawRunView(null)).toBe(false);
		expect(rs.isRawRunView(() => {})).toBe(false);
		rs.closeRunSnapshot(snap);
		expect(rs.handOutRaw(snap, raw)).toBe(raw);
	});

	it("hands a shared live value as itself, and a Proxy as itself once Proxies are told apart", () => {
		const { snap } = openRun();
		const weak = new WeakMap();
		expect(rs.handOutRaw(snap, weak)).toBe(weak);
		rs.setProxyCheck((value) => types.isProxy(value));
		const proxied = new Proxy({}, {});
		expect(rs.handOutRaw(snap, proxied)).toBe(proxied);
		rs.closeRunSnapshot(snap);
	});

	it("a run's view reads the object as of its start, and keeps what the run writes, deletes and defines to itself", () => {
		const { snap, domain } = openRun();
		const raw = { a: 1, nested: { b: 1 }, list: [1, 2] };
		rs.checkpointDeep(domain, raw);
		raw.a = 2;
		raw.nested.b = 2;
		const view = rs.handOutRaw(snap, raw);
		expect(rs.isRawRunView(view)).toBe(true);
		expect(rs.rawBehind(view)).toBe(raw);
		expect(rs.handOutRaw(snap, view)).toBe(view);
		expect(view.a).toBe(1);
		expect(view.nested.b).toBe(1);
		expect("a" in view).toBe(true);
		expect(Object.keys(view.list)).toEqual(["0", "1"]);
		expect(view.list.length).toBe(2);
		view.z = 5;
		delete view.a;
		Object.defineProperty(view, "d", { value: view.nested, enumerable: true, configurable: true, writable: true });
		Object.defineProperty(view, "g", { get: () => 3, enumerable: true, configurable: true });
		expect(view.z).toBe(5);
		expect("a" in view).toBe(false);
		expect(view.g).toBe(3);
		expect(rs.rawContent(snap, raw).d).toBe(raw.nested);
		expect(Object.getOwnPropertyDescriptor(view, "z")).toEqual({ value: 5, writable: true, enumerable: true, configurable: true });
		expect(Object.getOwnPropertyDescriptor(view, "missing")).toBe(undefined);
		const proto = { inherited: 1 };
		Object.setPrototypeOf(view, proto);
		expect(Object.getPrototypeOf(view)).toBe(proto);
		expect(view.inherited).toBe(1);
		expect(raw).toEqual({ a: 2, nested: { b: 2 }, list: [1, 2] });
		expect(Object.getPrototypeOf(raw)).toBe(Object.prototype);
		rs.closeRunSnapshot(snap);
	});

	it("a value written through a view stores the object a view of this run stands for, and another run's view as it is", () => {
		const owner = {};
		const snap = rs.openRunSnapshot(owner, null);
		const other = rs.openRunSnapshot(owner, null);
		const raw = {};
		const target = { t: 1 };
		const view = rs.handOutRaw(snap, raw);
		const mine = rs.handOutRaw(snap, target);
		const theirs = rs.handOutRaw(other, target);
		view.mine = mine;
		view.theirs = theirs;
		view.prim = 1;
		const copy = rs.rawContent(snap, raw);
		expect(copy.mine).toBe(target);
		expect(copy.theirs).toBe(theirs);
		rs.closeRunSnapshot(other);
		rs.closeRunSnapshot(snap);
	});

	it("a sibling run's view and built-in copy are handed to another run as they are; a nested run reads the object behind its outer run's", () => {
		rs.setKindCheck(platformKind);
		const owner = {};
		const outer = rs.openRunSnapshot(owner, null);
		const sibling = rs.openRunSnapshot(owner, null);
		const raw = { a: 1 };
		const map = new Map([["k", { v: 1 }]]);
		const outerView = rs.handOutRaw(outer, raw);
		const outerMap = rs.handOutRaw(outer, map);
		expect(outerMap).toBeInstanceOf(Map);
		expect(rs.handOutRaw(outer, outerMap)).toBe(outerMap);
		expect(rs.handOutRaw(sibling, outerMap)).toBe(outerMap);
		const siblingView = rs.handOutRaw(sibling, outerView);
		expect(siblingView).not.toBe(outerView);
		const inner = rs.openRunSnapshot(owner, outer);
		const innerView = rs.handOutRaw(inner, outerView);
		expect(rs.rawBehind(innerView)).toBe(raw);
		expect(innerView.a).toBe(1);
		const innerMap = rs.handOutRaw(inner, outerMap);
		expect(innerMap).not.toBe(outerMap);
		expect([...innerMap.keys()]).toEqual(["k"]);
		rs.closeRunSnapshot(inner);
		rs.closeRunSnapshot(sibling);
		rs.closeRunSnapshot(outer);
	});

	it("a nested run reads its outer run's copy as of the nested run's start", () => {
		const owner = {};
		const outer = rs.openRunSnapshot(owner, null);
		const raw = { a: 1 };
		const outerView = rs.handOutRaw(outer, raw);
		outerView.a = 2;
		const inner = rs.openRunSnapshot(owner, outer);
		const innerView = rs.handOutRaw(inner, raw);
		expect(innerView.a).toBe(2);
		outerView.a = 3;
		expect(innerView.a).toBe(2);
		expect(outerView.a).toBe(3);
		const late = { b: 1 };
		const innerLate = rs.handOutRaw(inner, late);
		rs.handOutRaw(outer, late).b = 5;
		expect(innerLate.b).toBe(1);
		rs.closeRunSnapshot(inner);
		rs.closeRunSnapshot(outer);
	});

	it("a promise is handed on once per run, and as it is with no run", async () => {
		const { snap } = openRun();
		const promise = Promise.resolve({ a: 1 });
		const handOut = (value) => rs.handOutRaw(snap, value);
		expect(rs.handOutSettled(null, promise, handOut)).toBe(promise);
		const handed = rs.handOutSettled(snap, promise, handOut);
		expect(rs.handOutSettled(snap, promise, handOut)).toBe(handed);
		const value = await handed;
		expect(rs.isRawRunView(value)).toBe(true);
		expect(value.a).toBe(1);
		rs.closeRunSnapshot(snap);
		expect(rs.handOutSettled(snap, promise, handOut)).toBe(promise);
	});

	it("methods of a class with private fields run on the instance, whatever this they are called with", () => {
		class Counter {
			#hits = 0;
			label = "c";
			inc() {
				return ++this.#hits;
			}
		}
		const { snap } = openRun();
		const raw = new Counter();
		const view = rs.handOutRaw(snap, raw);
		expect(view.label).toBe("c");
		expect(view.inc()).toBe(1);
		expect(view.inc).toBe(view.inc);
		expect(view.inc.call(raw)).toBe(2);
		const other = rs.handOutRaw(snap, new Counter());
		expect(other.inc()).toBe(1);
		rs.closeRunSnapshot(snap);
	});
});
