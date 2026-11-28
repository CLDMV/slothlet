/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/lazy/lazy-held-stand-in-after-load.test.vitest.mjs
 *	@Date: 2026-11-15T08:35:27-08:00 (1794760527)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:00-08:00 (1795869120)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A member read before its lazy folder loads, and kept, answers as the member does once the folder has
 * loaded: a default-export Map is `instanceof Map` and its methods work, an object lists its keys, a string reads as
 * the string.
 *
 * @description
 * Each file of `d/` exports one kind of value by default. The host and a module (`reader`, through `self`) read each
 * member before `d` has loaded, keep what the read gave, wait for the folder, and ask it the same questions as the
 * value imported plainly. The expected answers are the plain value's. A read the rules refuse stays refused through
 * the kept member. Eager rows check the same questions against the loaded node. `typeof` of a member read before its
 * folder loads stays "function" (a Proxy's target is fixed when it is made).
 * @module tests/vitests/suites/lazy/lazy-held-stand-in-after-load
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_lazy_held_standin");

const KEYS = ["map", "set", "date", "err", "arr", "obj", "fn", "str", "num"];

const configs = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * The value a file of `d/` exports by default, imported plainly.
 * @param {string} key - The file's name.
 * @returns {Promise<*>} The value.
 */
async function twin(key) {
	return (await import(`${pathToFileURL(join(FIXTURE, "d", `${key}.mjs`)).href}?plain-twin-held`)).default;
}

/**
 * What a value answers: the same questions the fixture's `reader.ask` asks.
 * @param {*} node - The value, its node, or a member kept from before its folder loaded.
 * @returns {object} The answers.
 */
function answers(node) {
	const answer = (check) => {
		try {
			return check();
		} catch (error) {
			return { threw: error?.code ?? error?.name ?? "threw" };
		}
	};
	return {
		proto: answer(() => {
			const proto = Object.getPrototypeOf(node);
			return proto === null ? null : proto.constructor.name;
		}),
		map: answer(() => node instanceof Map),
		set: answer(() => node instanceof Set),
		date: answer(() => node instanceof Date),
		error: answer(() => node instanceof Error),
		array: answer(() => node instanceof Array),
		keys: answer(() => Object.keys(node)),
		has: answer(() => "a" in Object(node)),
		value: answer(() => {
			if (node instanceof Map) return [node.get("k"), node.size, [...node]];
			if (node instanceof Set) return [node.has("s"), node.size, [...node]];
			if (node instanceof Date) return node.getTime();
			if (node instanceof Error) return node.message;
			if (node instanceof Array) return [node[0], node.length, [...node]];
			const proto = Object.getPrototypeOf(Object(node));
			if (proto === String.prototype || proto === Number.prototype) return [`${node}`, node.length];
			if (proto === Function.prototype) return [node.name, node.length];
			return [node.a, node.b, node.f()];
		})
	};
}

/**
 * Every answer refused, as a read of the member is.
 * @returns {object} The answers.
 */
function refused() {
	const threw = { threw: "PERMISSION_DENIED" };
	return { proto: threw, map: threw, set: threw, date: threw, error: threw, array: threw, keys: threw, has: threw, value: threw };
}

/**
 * Whether the reader module's read of a member goes through: true, or the code it was refused with.
 * @param {object} api - The api.
 * @param {string} key - The member's name.
 * @returns {Promise<true|string>} The outcome.
 */
async function taking(api, key) {
	try {
		await api.reader.take(key);
		return true;
	} catch (error) {
		return error.code;
	}
}

/**
 * What the reader module is answered about a member in eager mode, where the member is the loaded node from the start:
 * whether its read of the member goes through, and what the member answers it after (every answer refused when the
 * read itself is refused, as it is for a value the rules deny the reader).
 * @param {string} key - The member's name.
 * @param {string} runtime - The runtime.
 * @param {string} attribution - The attribution.
 * @param {object[]} [rules=[]] - The permission rules.
 * @returns {Promise<{taken: true|string, kept: object}>} The answers.
 */
async function eagerAnswers(key, runtime, attribution, rules = []) {
	const api = await slothlet({
		base: FIXTURE,
		mode: "eager",
		runtime,
		silent: true,
		permissions: { policy: "allow", caller: { attribution }, rules }
	});
	try {
		const taken = await taking(api, key);
		return { taken, kept: taken === true ? await api.reader.ask(key) : refused() };
	} finally {
		await api.shutdown();
	}
}

describe.each(configs)(
	"a member kept from before its lazy folder loads > $mode / $runtime / $attribution",
	({ mode, runtime, attribution }) => {
		let api;

		afterEach(async () => {
			await api?.shutdown?.();
			api = null;
		});

		const build = (rules = []) =>
			slothlet({ base: FIXTURE, mode, runtime, silent: true, permissions: { policy: "allow", caller: { attribution }, rules } });

		it.each(KEYS)("answers the host as the value does once the folder has loaded: %s", async (key) => {
			const expected = answers(await twin(key));
			api = await build();
			const kept = api.d[key];
			await api.d;
			expect(answers(kept)).toEqual(expected);
			expect(answers(api.d[key])).toEqual(expected);
		});

		it.each(KEYS)("answers a module reading through self as the loaded node answers it in eager mode: %s", async (key) => {
			const expected = await eagerAnswers(key, runtime, attribution);
			api = await build();
			expect(await api.reader.take(key)).toBe(true);
			expect(await api.reader.settle()).toBe(true);
			expect(await api.reader.ask(key)).toEqual(expected.kept);
			expect(await api.reader.ask(key, true)).toEqual(expected.kept);
		});

		it.each(["map", "date", "obj", "str", "num"])(
			"answers a module the rules deny the member as the loaded node answers it in eager mode: %s",
			async (key) => {
				const rules = [{ caller: "reader.**", target: `d.${key}`, effect: "deny" }];
				const expected = await eagerAnswers(key, runtime, attribution, rules);
				api = await build(rules);
				// A member read before its folder loads is a stand-in for it, whatever the rules say of the member.
				const taken = await taking(api, key);
				expect(taken).toBe(mode === "lazy" ? true : expected.taken);
				expect(await api.reader.settle()).toBe(true);
				if (taken === true) expect(await api.reader.ask(key)).toEqual(expected.kept);
				if (expected.taken === true) expect(await api.reader.ask(key, true)).toEqual(expected.kept);
				else await expect((async () => api.reader.ask(key, true))()).rejects.toMatchObject({ code: expected.taken });
			}
		);
	}
);

describe.each(["off", "disabled"])("a member kept from before its lazy folder loads > lazy / permissions %s", (permissionsMode) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	it.each(KEYS)("answers the host and a module as the value does: %s", async (key) => {
		const expected = answers(await twin(key));
		api = await slothlet({ base: FIXTURE, mode: "lazy", silent: true, permissions: { mode: permissionsMode } });
		const kept = api.d[key];
		expect(await api.reader.take(key)).toBe(true);
		await api.d;
		expect(answers(kept)).toEqual(expected);
		expect(await api.reader.ask(key)).toEqual(expected);
	});
});
