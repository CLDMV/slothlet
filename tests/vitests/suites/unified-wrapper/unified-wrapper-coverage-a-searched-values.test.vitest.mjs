/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-searched-values.test.vitest.mjs
 *	@Date: 2026-11-25T02:35:44-08:00 (1795602944)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:33:13-08:00 (1795869193)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview With `permissions.caller.provenance` off, what a module hands out is searched for code: the search
 * reads nested data, stops at its depth and property budget, skips the language's own and Node's own values, and
 * copies what it cannot otherwise tell from one of the engine's iterators. Whatever the search decides, the caller
 * reads each value as plain JS has it.
 *
 * Fixture: `api_tests/api_test_uwa_searched` — `searched`, with helper modules in `lib/`.
 */
import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import { constants } from "node:os";
import { types } from "node:util";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_uwa_searched/api");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("values searched for code as a module hands them out — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	/**
	 * Load the fixture with the permission system on and provenance off.
	 * @returns {Promise<object>} The api.
	 */
	const load = async () => {
		api = await slothlet({ base: FIXTURE, mode, runtime, silent: true, permissions: { caller: { provenance: false } } });
		return api;
	};

	/**
	 * The value the module makes for a shape.
	 * @param {string} kind - The shape.
	 * @returns {Promise<*>} The value.
	 */
	const made = async (kind) => (await api.searched.make(kind)).value;

	it("hands out a nested generator object and one of the engine's iterators, stepping as the module's", async () => {
		await load();
		expect([...(await made("generator"))]).toEqual([1, 2]);
		expect([...(await made("iterator"))]).toEqual([1, 2]);
	});

	it("hands out a list and an object past the property budget whole", async () => {
		await load();
		const list = await made("longList");
		expect([list.length, list[599]]).toEqual([600, 1]);
		const wide = await made("wide");
		expect([Object.keys(wide).length, wide.k599]).toEqual([600, 599]);
		const map = await made("wideMap");
		expect([map.get("a"), map.size, map.k599]).toEqual([1, 1, 599]);
	});

	it("reads a built-in accessor, the language's own objects and a built-in function as the language's", async () => {
		await load();
		expect((await made("builtinAccessor")).tag).toBe("[object Object]");
		const intrinsics = await made("intrinsics");
		expect([intrinsics.math, intrinsics.proto, intrinsics.max(1, 3)]).toEqual([Math, Object.prototype, 3]);
		expect((await made("nestedAccessor")).inner.tag).toBe("[object Object]");
	});

	it("hands out a module namespace of data, and an arguments object as the language's own", async () => {
		await load();
		const namespace = await made("namespace");
		expect([namespace.count, namespace.label, namespace[Symbol.toStringTag]]).toEqual([3, "table", "Module"]);
		const args = await made("arguments");
		expect([args.length, args[0], args[1]]).toEqual([2, 1, 2]);
		expect([Object.prototype.toString.call(args), types.isArgumentsObject(args)]).toEqual(["[object Arguments]", true]);
	});

	it("hands out an emitter, a stream and an event target, their listeners running as registered", async () => {
		await load();
		const emitter = await made("emitter");
		expect([emitter.label, emitter.listenerCount("ping"), emitter.emit("ping")]).toEqual(["emitter", 1, true]);
		const stream = await made("stream");
		expect([stream.label, stream.readable, stream.writable]).toEqual(["stream", true, true]);
		stream.destroy();
		const target = await made("target");
		let heard = 0;
		target.addEventListener("ping", () => heard++);
		target.dispatchEvent(new Event("ping"));
		expect([target.label, heard]).toEqual(["target", 1]);
	});

	it("hands out errors whose message, cause, name or prototype are not the language's usual", async () => {
		await load();
		const message = await made("errorMessage");
		expect([message.message, message instanceof Error]).toEqual([5, true]);
		const cause = await made("errorCause");
		expect([cause.message, cause.cause]).toEqual(["text", Symbol.for("uws.cause")]);
		const name = await made("errorName");
		expect([name.name, name.message]).toEqual(["[object Error]", "text"]);
		const prototype = await made("errorPrototype");
		expect([prototype.message, prototype instanceof Error, Object.getPrototypeOf(prototype)]).toEqual(["text", false, Object.prototype]);
	});

	it("hands out maps and sets, one holding a symbol, and Node's own data nested past the copy's depth", async () => {
		await load();
		const collections = await made("mapSet");
		expect([[...collections.map], [...collections.set]]).toEqual([[["k", { n: 1 }]], [1, "two"]]);
		expect([...(await made("mapSymbol")).map]).toEqual([["k", Symbol.for("uws.entry")]]);
		const deep = await made("deepShared");
		expect(deep.a.b.c).toBe(constants);
		expect(deep.a.b.c.signals.SIGINT).toBe(constants.signals.SIGINT);
	});
});
