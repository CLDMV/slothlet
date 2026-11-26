/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/unified-wrapper/unified-wrapper-coverage-a-made-values.test.vitest.mjs
 *	@Date: 2026-11-25T01:28:55-08:00 (1795598935)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:13:01-08:00 (1795601581)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a module makes at run time and hands out — an async generator function with members of its own, a
 * closed generator object — reaches the caller as plain JS has it: the same kind of function, the same members read
 * and written through, the same closed state, the same steps. A list the caller hands back holding the module's own
 * function reads that function as the module's, and what the module puts in the list reaches the caller callable.
 *
 * Fixture: `api_tests/api_test_uwa_made` — `factory`.
 */
import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import { types } from "node:util";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_uwa_made/api");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("values a module makes and hands out — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	/**
	 * Load the fixture with the permission system on.
	 * @param {boolean} [provenance=true] - Whether the code running is told by its frames (off: values are searched).
	 * @returns {Promise<object>} The api.
	 */
	const load = async (provenance = true) => {
		api = await slothlet({ base: FIXTURE, mode, runtime, silent: true, permissions: provenance ? {} : { caller: { provenance: false } } });
		return api;
	};

	it("hands out an async generator function as one, its own members read and written through", async () => {
		await load();
		const made = await api.factory.makeAsyncGenerator();
		expect([types.isGeneratorFunction(made), types.isAsyncFunction(made)]).toEqual([true, true]);
		expect(Object.hasOwn(made, "name")).toBe(false);
		expect(made.length).toBe(1);
		expect(made.tag).toBe("first");
		made.tag = "second";
		expect(await api.factory.tagOf(made)).toBe("second");
		const values = [];
		for await (const value of made(3)) values.push(value);
		expect(values).toEqual([0, 1, 2]);
	});

	// A generator object holds no members of its own, so closing it any of these ways leaves it frozen, as plain JS reports.
	it.each(["seal", "preventExtensions", "freeze"])(
		"hands out a generator object closed by %s as closed, stepping as the module's",
		async (how) => {
			await load();
			const plain = (function* () {})();
			Object[how](plain);
			const generator = await api.factory.makeClosedGenerator(how);
			const state = (value) => ({ sealed: Object.isSealed(value), frozen: Object.isFrozen(value), extensible: Object.isExtensible(value) });
			expect(state(generator)).toEqual(state(plain));
			expect([...generator]).toEqual([1, 2]);
		}
	);

	it("reads its own function in a list the caller hands back as its own, and hands out what it puts there", async () => {
		await load();
		const fn = await api.factory.keep();
		const list = [fn];
		Object.defineProperty(list, "fixed", { value: fn });
		expect(await api.factory.inspect(list)).toEqual({
			includes: true,
			first: true,
			described: true,
			fixedKind: "function",
			childOwn: true
		});
		expect(list[0]).toBe(fn);
		expect([list[1](), list.defined(), list.accessor]).toEqual(["pushed", "defined", 1]);
	});

	it.each([true, false])(
		"hands out the plain data it makes, collections included, readable as plain JS has it (provenance %s)",
		async (provenance) => {
			await load(provenance);
			const data = await api.factory.makeData("collections");
			expect([...data.map]).toEqual([["k", { n: 1 }]]);
			expect([...data.set]).toEqual([1, "two"]);
			expect(data.nested.list).toEqual([1, 2]);
		}
	);

	it.each([true, false])("hands out an error it makes with its message, name and cause (provenance %s)", async (provenance) => {
		await load(provenance);
		const { error } = await api.factory.makeData("error");
		expect([error.message, error.name, error.cause.message]).toEqual(["outer", "Error", "inner"]);
		expect((await api.factory.makeData("errorAccessor")).error.message).toBe("from a getter");
		expect((await api.factory.makeData("errorName")).error.name).toBe("Custom");
	});

	it.each([true, false])(
		"hands out boxed primitives, members it hides and accessors as plain JS reads them (provenance %s)",
		async (provenance) => {
			await load(provenance);
			const boxed = await api.factory.makeData("boxed");
			expect([String(boxed.text), boxed.symbol.valueOf()]).toEqual(["abc", Symbol.for("uwa")]);
			const hidden = await api.factory.makeData("hidden");
			expect([Object.keys(hidden), hidden.hidden, hidden[Symbol.for("uwa.key")]]).toEqual([["shown"], 2, 3]);
			expect((await api.factory.makeData("accessor")).value).toBe(4);
		}
	);

	it("hands back the very list a caller handed in holding its own function", async () => {
		await load();
		const fn = await api.factory.keep();
		const list = [fn];
		expect(await api.factory.echoList(list)).toBe(list);
	});

	it("hands out its own exported function as the api's node for it, and its class's prototype as the class's", async () => {
		await load();
		const leaf = await api.factory.ownLeaf();
		expect(leaf).toBe(api.factory.keep);
		const prototype = await api.factory.widgetPrototype();
		expect(prototype).toBe(api.factory.Widget.prototype);
		expect(prototype.kind.call(null)).toBe("widget");
	});
});
