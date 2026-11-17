/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-view-mirror-rules.test.vitest.mjs
 *	@Date: 2026-11-16T00:29:25-08:00 (1794817765)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:48-08:00 (1794882648)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a node a module kept answers depends only on the rules in force when it reads, never on what
 * was read through it before: not on a rule added or removed after the view was first read, not on another module
 * reading the keeper's view first, and not on which module loaded the node.
 *
 * @description
 * Fixture `api_test_view_mirror_rules`:
 * ```
 * store.mjs   open, closed, sealed, frozen (objects), closedArr, sealedArr, frozenArr: a value member and an object member each
 * a.mjs       keeps a node, reads it every way, hands it over, reads a node handed to it
 * b.mjs       the same
 * ```
 * A module allowed the member gets what plain JavaScript gives for the same object. A module denied it gets what the
 * same module gets on a fresh instance under the same rules, read by nobody else first: the property pinned here is
 * that the answer does not depend on what happened before the read. Eager and lazy mode, the async and live runtime,
 * both attributions.
 * @module tests/vitests/suites/permissions/permissions-view-mirror-rules
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_view_mirror_rules");

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * Plain twins of what `store` exports.
 * @type {Record<string, function(): object>}
 */
const TWINS = {
	open: () => ({ x: 1, hid: "S3CRET", obj: { k: 1 } }),
	closed: () => Object.preventExtensions({ x: 1, hid: "S3CRET", obj: { k: 1 } }),
	sealed: () => Object.seal({ x: 1, hid: "S3CRET", obj: { k: 1 } }),
	frozen: () => Object.freeze({ x: 1, hid: "S3CRET", obj: Object.freeze({ k: 1 }) }),
	closedArr: () => Object.preventExtensions(["S3CRET", { k: 1 }, 3]),
	sealedArr: () => Object.seal(["S3CRET", { k: 1 }, 3]),
	frozenArr: () => Object.freeze(["S3CRET", Object.freeze({ k: 1 }), 3])
};

/** @type {Record<string, function(object, (string|number)=): *>} The fixture's reads, made on a plain object. */
const READS = {
	extensible: (node) => Object.isExtensible(node),
	keys: (node) => Object.keys(node),
	names: (node) => Object.getOwnPropertyNames(node),
	has: (node, key) => key in node,
	get: (node, key) => node[key],
	describe: (node, key) => Object.getOwnPropertyDescriptor(node, key),
	below: (node, key) => node[key].k,
	belowDescribed: (node, key) => Object.getOwnPropertyDescriptor(node, key).value.k,
	json: (node) => JSON.parse(JSON.stringify(node))
};

/**
 * The reads made of a node: its value member and its object member, every way.
 * @param {string} name - The node.
 * @returns {Array<[string, (string|number)?]>} The reads.
 */
const readsOf = (name) => {
	const [value, object] = name.endsWith("Arr") ? [0, 1] : ["hid", "obj"];
	return [
		["extensible"],
		["keys"],
		["names"],
		["has", value],
		["get", value],
		["describe", value],
		["below", object],
		["belowDescribed", object],
		["json"]
	];
};

/**
 * What plain JavaScript gives for each read.
 * @param {string} name - The node.
 * @returns {Array<*>} The answers.
 */
const plain = (name) => readsOf(name).map(([read, key]) => JSON.parse(JSON.stringify(READS[read](TWINS[name](), key) ?? null)));

/**
 * The member of a node a rule denies, as a target.
 * @type {Array<{label: string, target: function(string): string}>}
 */
const DENIALS = [
	{ label: "its value member", target: (name) => `store.${name}.${name.endsWith("Arr") ? 0 : "hid"}` },
	{ label: "what its object member holds", target: (name) => `store.${name}.${name.endsWith("Arr") ? 1 : "obj"}.**` }
];

describe.each(matrix)("a kept node's answers follow the rules alone ($mode, $runtime, $attribution)", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		if (api) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Build the fixture.
	 * @param {Array<object>} [rules] - The rules.
	 * @returns {Promise<object>} The api.
	 */
	const build = async (rules = []) => {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: { policy: "allow", caller: { attribution }, rules } });
		return api;
	};

	/**
	 * What `who` reads of its kept node on a fresh instance where the rule denies it the member from the start.
	 * @param {string} who - `a` or `b`.
	 * @param {string} name - The node.
	 * @param {string} target - The denied target.
	 * @returns {Promise<Array<*>>} The answers.
	 */
	const deniedAlone = async (who, name, target) => {
		await build([{ caller: `${who}.**`, target, effect: "deny" }]);
		await api[who].keep(name);
		const answers = await api[who].reads(name, readsOf(name));
		await api.slothlet.shutdown();
		api = null;
		return answers;
	};

	describe.each(Object.keys(TWINS))("%s", (name) => {
		const list = readsOf(name);

		describe.each(DENIALS)("a rule on $label", ({ target }) => {
			it("is applied from the next read when it is added or removed after the view was read", async () => {
				const denied = await deniedAlone("a", name, target(name));
				await build();
				await api.a.keep(name);
				expect(await api.a.reads(name, list)).toEqual(plain(name));
				const id = api.slothlet.permissions.rules.add({ caller: "a.**", target: target(name), effect: "deny" });
				expect(await api.a.reads(name, list)).toEqual(denied);
				expect(await api.a.later(name, list)).toEqual(denied);
				api.slothlet.permissions.rules.remove(id);
				expect(await api.a.reads(name, list)).toEqual(plain(name));
				expect(await api.a.later(name, list)).toEqual(plain(name));
			});

			it("is lifted from the next read when the view was first read under it", async () => {
				await build();
				const id = api.slothlet.permissions.rules.add({ caller: "a.**", target: target(name), effect: "deny" });
				await api.a.keep(name);
				await api.a.reads(name, list);
				api.slothlet.permissions.rules.remove(id);
				expect(await api.a.reads(name, list)).toEqual(plain(name));
			});

			it("answers the keeper and the module it handed its view to by their own rules, whoever read first", async () => {
				const denied = await deniedAlone("b", name, target(name));
				await build([{ caller: "b.**", target: target(name), effect: "deny" }]);
				await api.a.keep(name);
				// `a`'s view, handed over, is read by the denied module first: it gets no more than it gets alone.
				expect(await api.b.readsOf(await api.a.give(name), list)).toEqual(denied);
				expect(await api.a.reads(name, list)).toEqual(plain(name));
				expect(await api.a.later(name, list)).toEqual(plain(name));
			});

			it("answers the same whichever module's read loaded the node", async () => {
				const denied = await deniedAlone("b", name, target(name));
				await build([{ caller: "b.**", target: target(name), effect: "deny" }]);
				await api.a.keep(name);
				await api.b.keep(name);
				expect(await api.b.reads(name, list)).toEqual(denied);
				expect(await api.a.reads(name, list)).toEqual(plain(name));
				await api.slothlet.shutdown();

				await build([{ caller: "b.**", target: target(name), effect: "deny" }]);
				await api.a.keep(name);
				await api.b.keep(name);
				expect(await api.a.reads(name, list)).toEqual(plain(name));
				expect(await api.b.reads(name, list)).toEqual(denied);
				expect(await api.a.later(name, list)).toEqual(plain(name));
			});
		});
	});
});
