/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/intrinsics-language-parity.test.vitest.mjs
 *	@Date: 2026-11-25T01:32:12-08:00 (1795599132)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:10:46-08:00 (1795601446)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `helpers/intrinsics`' stand-ins for the language's own string, list, map, promise and iterator
 * operations give what the language gives: each case is compared with the built-in it stands in for, called on the
 * same input. Also how the module loads on hosts without some globals (no `Iterator`, no `SharedArrayBuffer`, no
 * `RegExp.prototype.unicodeSets`, no `Error.isError`) and under another copy's `Function.prototype.toString` wrapper.
 * @module tests/vitests/suites/helpers/intrinsics-language-parity
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
	asyncGeneratorSteps,
	copyList,
	describeThrown,
	jsonOf,
	listFromIterable,
	listSplice,
	mapEntriesToArray,
	mapValues,
	mapValuesToArray,
	matchAllOf,
	promiseAllSettled,
	regExpReplace,
	regExpSplit,
	splitText,
	stringOf
} from "#helpers/intrinsics";

describe("intrinsics > lists", () => {
	it("listFromIterable with and without a map, as Array.from", () => {
		const set = new Set([1, 2]);
		expect(listFromIterable(set)).toEqual(Array.from(set));
		expect(listFromIterable(set, (value) => value * 2)).toEqual(Array.from(set, (value) => value * 2));
	});

	it("copyList with negative and out-of-range bounds, as Array.prototype.slice", () => {
		const list = [1, 2, 3, 4];
		for (const [start, end] of [
			[-2, undefined],
			[-10, undefined],
			[1, -1],
			[1, -10],
			[10, undefined],
			[0, 10]
		]) {
			expect(copyList(list, start, end)).toEqual(list.slice(start, end));
		}
	});

	it("listSplice with a negative start, as Array.prototype.splice", () => {
		for (const args of [[-2], [-2, 1], [-10, 1], [1, 1, "x"], [Number.NaN, 1]]) {
			const mine = [1, 2, 3, 4];
			const theirs = [1, 2, 3, 4];
			expect(listSplice(mine, ...args)).toEqual(theirs.splice(...args));
			expect(mine).toEqual(theirs);
		}
	});

	it("a map's values and entries; none gives an empty array", () => {
		const map = new Map([["a", 1]]);
		expect(mapValuesToArray(map)).toEqual([...map.values()]);
		expect(mapEntriesToArray(map)).toEqual([...map.entries()]);
		for (const none of [null, undefined]) {
			expect(mapValuesToArray(none)).toEqual([]);
			expect(mapEntriesToArray(none)).toEqual([]);
		}
	});
});

describe("intrinsics > strings and regular expressions", () => {
	it("splitText with a limit and an empty separator, as String.prototype.split", () => {
		for (const [text, separator, limit] of [
			["a.b.c", ".", 0],
			["a.b.c", ".", 2],
			["abc", "", undefined],
			["abc", "", 2],
			["", "", undefined],
			["a..b", ".", undefined]
		]) {
			expect(splitText(text, separator, limit)).toEqual(text.split(separator, limit));
		}
	});

	it("regExpReplace reads every $ pattern as String.prototype.replace does", () => {
		const cases = [
			[/(b)(c)/, "abcd", "[$$|$&|$`|$'|$1|$2|$3|$0|$12|$x|$]"],
			[/(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)(l)/, "abcdefghijkl", "$12-$11-$10-$13-$1"],
			[/(?<word>b)/, "abc", "<$<word>|$<nope>|$<open>"],
			[/(?<word>b)/, "abc", "$<word"],
			[/(b)?x/, "ax", "[$1]"],
			[/b/, "abc", "$<word>"],
			[/b/g, "abcb", "-$&-"],
			[/(b)/, "abc", "[$1:]"],
			[/(a)(b)(c)(d)(e)(f)(g)(h)(i)(x)?/, "abcdefghi", "[$10]"]
		];
		for (const [regexp, text, replacement] of cases) {
			expect(regExpReplace(new RegExp(regexp.source, regexp.flags), text, replacement)).toBe(text.replace(regexp, replacement));
		}
	});

	it("regExpReplace calls a function replacement with the match, captures, position, text and groups", () => {
		const seen = [];
		const theirs = [];
		const record = (into) =>
			function (...args) {
				into.push(args);
				return "#";
			};
		const regexp = /(?<letter>[a-z])(\d)/g;
		const text = "a1b2";
		const mine = regExpReplace(new RegExp(regexp.source, regexp.flags), text, record(seen));
		expect(mine).toBe(text.replace(regexp, record(theirs)));
		expect(seen).toEqual(theirs);
	});

	it("regExpReplace steps past empty matches, by code point under the u and v flags", () => {
		for (const regexp of [/x*/g, /x*/gu, /x*/gv, /(?:)/g]) {
			for (const text of ["a😀b", "", "😀"]) {
				expect(regExpReplace(new RegExp(regexp.source, regexp.flags), text, "-")).toBe(text.replace(regexp, "-"));
			}
		}
	});

	it("regExpMatch on a sticky expression starts at lastIndex", async () => {
		const { regExpMatch } = await import("#helpers/intrinsics");
		const mine = /b/y;
		const theirs = /b/y;
		mine.lastIndex = 1;
		theirs.lastIndex = 1;
		expect(regExpMatch(mine, "abc")?.[0]).toBe("abc".match(theirs)?.[0]);
		expect(mine.lastIndex).toBe(theirs.lastIndex);
	});

	it("regExpReplace on a sticky expression starts at lastIndex", () => {
		const mine = /b/y;
		const theirs = /b/y;
		mine.lastIndex = 1;
		theirs.lastIndex = 1;
		expect(regExpReplace(mine, "abc", "x")).toBe("abc".replace(theirs, "x"));
		expect(mine.lastIndex).toBe(theirs.lastIndex);
	});

	it("regExpSplit with limits, captures, empty text and unicode, as String.prototype.split", () => {
		const cases = [
			[/,/, "a,b,c", 0],
			[/,/, "a,b,c", 2],
			[/(,)/, "a,b,c", 2],
			[/(,)(;)?/, "a,b", 3],
			[/x/, "", undefined],
			[/(?:)/, "", undefined],
			[/(?:)/u, "a😀b", undefined],
			[/(?:)/v, "😀", undefined],
			[/(?:)/, "a😀b", undefined],
			[/b*/, "abbc", undefined]
		];
		for (const [regexp, text, limit] of cases) expect(regExpSplit(regexp, text, limit)).toEqual(text.split(regexp, limit));
	});

	it("matchAllOf steps past empty matches, as String.prototype.matchAll", () => {
		const regexp = /x*/g;
		const mine = matchAllOf("ab", regexp).map((match) => [match[0], match.index]);
		const theirs = [..."ab".matchAll(regexp)].map((match) => [match[0], match.index]);
		expect(mine).toEqual(theirs);
	});
});

describe("intrinsics > iterators and promises", () => {
	it("throwing into a generator that delegates to a map iterator closes it with a TypeError, as the language does", () => {
		const run = (values) => {
			function* outer() {
				yield* values(new Map([["a", 1]]));
			}
			const steps = outer();
			steps.next();
			try {
				steps.throw(new Error("in"));
				return "no throw";
			} catch (error) {
				return [error.constructor, steps.next()];
			}
		};
		expect(run(mapValues)).toEqual(run((map) => map.values()));
	});

	it("throwing into a generator that delegates through generatorSteps reaches the inner generator, as yield* does", async () => {
		const { generatorSteps } = await import("#helpers/intrinsics");
		const run = (wrap) => {
			const log = [];
			function* inner() {
				try {
					yield 1;
				} catch (error) {
					log.push(`caught ${error}`);
					yield 2;
				}
			}
			function* outer() {
				yield* wrap(inner());
			}
			const steps = outer();
			return [steps.next(), steps.throw("boom"), steps.next(), log];
		};
		expect(run(generatorSteps)).toEqual(run((generator) => generator));
	});

	it("an async generator delegating through asyncGeneratorSteps steps, returns and is thrown into as with yield* on the generator", async () => {
		const walk = async (wrap, plan) => {
			const log = [];
			async function* inner() {
				try {
					log.push(yield 1);
					log.push(yield 2);
				} catch (error) {
					log.push(`caught ${error}`);
					yield 3;
				} finally {
					log.push("closed");
				}
			}
			async function* outer() {
				return yield* wrap(inner());
			}
			const steps = outer();
			const out = [await steps.next()];
			for (const [method, value] of plan) out.push(await steps[method](value));
			return { out, log };
		};
		for (const plan of [
			[
				["next", "x"],
				["next", "y"]
			],
			[["return", "r"]],
			[["throw", "boom"], ["next"]]
		]) {
			expect(await walk(asyncGeneratorSteps, plan)).toEqual(await walk((generator) => generator, plan));
		}
		const steps = asyncGeneratorSteps((async function* () {})());
		expect(steps[Symbol.asyncIterator]()).toBe(steps);
	});

	it("promiseAllSettled reports a rejection, as Promise.allSettled", async () => {
		const list = () => [Promise.resolve(1), Promise.reject(new Error("no")), 3];
		expect(await promiseAllSettled(list())).toEqual(await Promise.allSettled(list()));
	});
});

describe("intrinsics > text of values", () => {
	it("stringOf renders a nested array to its depth, and an error with no message as its name", () => {
		const nested = [1, [2, [3, [4]]]];
		expect(stringOf(nested)).toBe(String(nested));
		expect(stringOf(nested, 1)).toBe("1,");
		expect(stringOf(new TypeError())).toBe("TypeError");
		const named = new Error("m");
		named.name = 7;
		expect(stringOf(named)).toBe("Error: m");
		class SubError extends Error {}
		expect(stringOf(new SubError("s"))).toBe(String(new SubError("s")));
		const own = new Error("o");
		own.name = "Custom";
		expect(stringOf(own)).toBe(String(own));
	});

	it("stringOf gives a function whose source cannot be read as native code", () => {
		const { proxy, revoke } = Proxy.revocable(() => {}, {});
		revoke();
		expect(stringOf(proxy)).toBe("function () { [native code] }");
	});

	it("describeThrown gives an error whose message is not a string as name: message", () => {
		const error = new Error("x");
		Object.defineProperty(error, "message", { value: 5 });
		expect(describeThrown(error)).toBe("Error");
		const getter = new Error("y");
		Object.defineProperty(getter, "message", { get: () => "z" });
		expect(describeThrown(getter)).toBe("Error");
	});

	it("jsonOf gives a bigint as its digits and stops at its depth", () => {
		expect(jsonOf({ n: 10n })).toBe('{"n":"10"}');
		expect(jsonOf({ a: { b: { c: 1 } } }, 2)).toBe('{"a":{"b":null}}');
	});
});

describe("intrinsics > on other hosts", () => {
	const restores = [];
	afterEach(() => {
		while (restores.length) restores.pop()();
		vi.resetModules();
	});

	/**
	 * Take a property off an object until the test ends.
	 * @param {object} owner - The object.
	 * @param {PropertyKey} key - The property.
	 * @returns {void}
	 */
	const without = (owner, key) => {
		const held = Object.getOwnPropertyDescriptor(owner, key);
		delete owner[key];
		restores.push(() => held && Object.defineProperty(owner, key, held));
	};

	/**
	 * Load a fresh copy of the module with the host as it is now, then put the host back.
	 * @returns {Promise<object>} The module.
	 */
	const fresh = async () => {
		vi.resetModules();
		const mod = await import("#helpers/intrinsics");
		while (restores.length) restores.pop()();
		return mod;
	};

	it("with no Iterator, Iterators is an empty object; with no SharedArrayBuffer its functions are none", async () => {
		without(globalThis, "Iterator");
		without(globalThis, "SharedArrayBuffer");
		const mod = await fresh();
		expect(Object.keys(mod.Iterators)).toEqual([]);
		expect(Object.keys(mod.PrototypeFunctions.SharedArrayBuffer)).toEqual([]);
		expect(Object.keys(mod.PrototypeFunctions.Iterator)).toEqual([]);
	});

	it("with no unicodeSets flag, the u flag alone steps by code point", async () => {
		without(RegExp.prototype, "unicodeSets");
		const mod = await fresh();
		expect(mod.regExpReplace(/x*/gu, "a😀", "-")).toBe("a😀".replace(/x*/gu, "-"));
		expect(mod.regExpSplit(/(?:)/u, "a😀")).toEqual("a😀".split(/(?:)/u));
		expect(mod.matchAllOf("ab", /b/g).length).toBe(1);
		expect(mod.regExpReplace(/x*/g, "ab", "-")).toBe("ab".replace(/x*/g, "-"));
		expect(mod.regExpSplit(/,/, "a,b")).toEqual("a,b".split(/,/));
	});

	it("with no Buffer and no toStringTag getter on typed arrays, those are absent", async () => {
		without(globalThis, "Buffer");
		without(Object.getPrototypeOf(Uint8Array.prototype), Symbol.toStringTag);
		const mod = await fresh();
		expect(Object.keys(mod.BufferMethods)).toEqual([]);
		expect(Object.keys(mod.Buffers)).toEqual([]);
		expect(mod.PrototypeFunctions.TypedArray.toStringTag).toBe(undefined);
	});

	it("statics that are accessors are left out", async () => {
		for (const owner of [Math, Reflect]) {
			Object.defineProperty(owner, "slothletTestAccessor", { get: () => 1, configurable: true });
			restores.push(() => delete owner.slothletTestAccessor);
		}
		const mod = await fresh();
		expect("slothletTestAccessor" in mod.Reflect).toBe(false);
	});

	it("with no Error.isError, an error is told by instanceof", async () => {
		without(Error, "isError");
		const mod = await fresh();
		expect(mod.stringOf(new RangeError("r"))).toBe("RangeError: r");
		expect(mod.stringOf({ name: "x" })).toBe("[object Object]");
	});

	it("under another copy's toString wrapper, functionSource reads the language's own toString", async () => {
		const native = Function.prototype.toString;
		const marker = Symbol.for("slothlet.functionSource.original");
		const wrapper = function toString() {
			return "wrapped";
		};
		Object.defineProperty(wrapper, marker, { value: native });
		const outer = function toString() {
			return "outer";
		};
		Object.defineProperty(outer, marker, { value: wrapper });
		const held = Object.getOwnPropertyDescriptor(Function.prototype, "toString");
		Object.defineProperty(Function.prototype, "toString", { ...held, value: outer });
		restores.push(() => Object.defineProperty(Function.prototype, "toString", held));
		const mod = await fresh();
		function sample() {
			return 1;
		}
		expect(mod.functionSource(sample)).toBe(native.call(sample));
	});
});
