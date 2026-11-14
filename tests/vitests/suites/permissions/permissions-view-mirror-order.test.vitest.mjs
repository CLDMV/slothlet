/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-view-mirror-order.test.vitest.mjs
 *	@Date: 2026-11-12T00:09:41-08:00 (1794470981)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T02:01:09-08:00 (1794477669)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a node a module kept answers that module does not depend on who read through it first.
 *
 * @description
 * A module's kept reference to a node closed to extension stands over a copy of what the node holds, filled the first
 * time it is read. Fixture `api_test_view_mirror_order`:
 * ```
 * store.mjs   closed, sealed, frozen (objects), closedArr, sealedArr, frozenArr: a value member and an object member each
 * a.mjs       allowed everything: keeps a node, reads it, lends a function that reads it
 * b.mjs       the same, under a rule that denies it one member of the node
 * ```
 * `a`'s reference is first read by code `b` runs (a function `a` lent, which is held to both), or from a timer with no
 * caller; then `a` reads it. `a` must get what plain JavaScript gives for the same object, every time. The other way
 * round, `b`'s reference first read by code `a` runs still refuses `b` the member the rule denies.
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_view_mirror_order");
const DENIED = "PERMISSION_DENIED";

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => ["precise", "fast"].map((attribution) => ({ mode, runtime, attribution })))
);

/**
 * Plain twins of what `store` exports: the answers plain JavaScript gives are read off these.
 * @type {Record<string, function(): object>}
 */
const TWINS = {
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
 * The member of a node the rule denies `b`, and the reads of the node that reach it.
 * @type {Array<{label: string, target: function(string): string, refused: string[]}>}
 */
const DENIALS = [
	{ label: "its value member", target: (name) => `store.${name}.${name.endsWith("Arr") ? 0 : "hid"}`, refused: ["get"] },
	{
		label: "what its object member holds",
		target: (name) => `store.${name}.${name.endsWith("Arr") ? 1 : "obj"}.**`,
		refused: ["below", "belowDescribed"]
	}
];

describe.each(matrix)("a kept node read first by someone else ($mode, $runtime, $attribution)", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		if (api) await api.slothlet.shutdown();
		api = null;
	});

	/**
	 * Build the fixture with `b` denied one member of a node.
	 * @param {string} target - The denied target.
	 * @returns {Promise<object>} The api.
	 */
	const build = async (target) => {
		api = await slothlet({
			base: BASE,
			mode,
			runtime,
			silent: true,
			permissions: { defaultPolicy: "allow", attribution, rules: [{ caller: "b.**", target, effect: "deny" }] }
		});
		return api;
	};

	describe.each(Object.keys(TWINS))("%s", (name) => {
		const list = readsOf(name);

		describe.each(DENIALS)("with b denied $label", ({ target, refused }) => {
			it("answers its keeper as plain JavaScript does when nobody else read it", async () => {
				await build(target(name));
				await api.a.keep(name);
				expect(await api.a.reads(name, list)).toEqual(plain(name));
			});

			it("answers its keeper the same after code the denied module ran read it first", async () => {
				await build(target(name));
				await api.a.keep(name);
				const viaDenied = await api.b.run(await api.a.lend(name, list));
				// Code `a` lent, run by `b`, is held to both: the denied member is refused there.
				for (const read of refused) expect(viaDenied[list.findIndex(([entry]) => entry === read)]).toBe(DENIED);
				expect(await api.a.reads(name, list)).toEqual(plain(name));
				// And again once both have read it.
				await api.b.run(await api.a.lend(name, list));
				expect(await api.a.reads(name, list)).toEqual(plain(name));
			});

			it("answers its keeper the same after a timer with no caller read it first", async () => {
				await build(target(name));
				await api.a.keep(name);
				expect(await api.a.later(name, list)).toEqual(plain(name));
				expect(await api.a.reads(name, list)).toEqual(plain(name));
			});

			it("refuses the denied module the same whoever read its own reference first", async () => {
				await build(target(name));
				await api.b.keep(name);
				const alone = await api.b.reads(name, list);
				for (const read of refused) expect(alone[list.findIndex(([entry]) => entry === read)]).toBe(DENIED);
				await api.slothlet.shutdown();

				await build(target(name));
				await api.b.keep(name);
				// Code `b` lent, run by the allowed module, reads `b`'s reference first.
				const viaAllowed = await api.a.run(await api.b.lend(name, list));
				for (const read of refused) expect(viaAllowed[list.findIndex(([entry]) => entry === read)]).toBe(DENIED);
				expect(await api.b.reads(name, list)).toEqual(alone);
			});
		});
	});
});
