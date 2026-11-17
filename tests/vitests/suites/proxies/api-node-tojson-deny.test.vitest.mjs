/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/api-node-tojson-deny.test.vitest.mjs
 *	@Date: 2026-11-15T23:45:00-08:00 (1794815100)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:18-08:00 (1794882618)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Serializing a node whose data has a `toJSON` of its own never gives a member the reader may not read:
 * what the `toJSON` gives is held to the rules at the node's path and the member's name, as a plain object's members
 * are.
 *
 * @description
 * The fixture's `owner` file exports a class instance serializing through its prototype's `toJSON`, one whose
 * `toJSON` reads a private field and gives nested data, a plain object whose own `toJSON` gives other data, such an
 * instance nested in a plain object, and one held in an array. A reader the rules name and a writer they do not
 * serialize them through `self`, now and from a timer through a node they kept, in eager and lazy mode, the async and
 * live runtime, and under both attributions. The expected answers are plain JavaScript's on the same values with what
 * the reader may not read left out.
 * @module tests/vitests/suites/proxies/api-node-tojson-deny
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_serialize_tojson");

const MODES = ["eager", "lazy"];
const RUNTIMES = ["async", "live"];
const ATTRIBUTIONS = ["precise", "fast"];

const matrix = MODES.flatMap((mode) => RUNTIMES.flatMap((runtime) => ATTRIBUTIONS.map((attribution) => ({ mode, runtime, attribution }))));

const PATHS = ["owner.cfg", "owner.sealed", "owner.own", "owner.holder", "owner.list"];

/**
 * The owner's data as a module imports it, outside slothlet.
 * @returns {Promise<object>} The owner file's exports.
 */
const twin = () => import(`${pathToFileURL(join(FIXTURE, "owner", "owner.mjs")).href}?plain-twin-tojson`);

/**
 * A copy of a JSON value with the members at the given dotted paths left out.
 * @param {*} value - The parsed JSON value.
 * @param {string[]} paths - Paths below the value.
 * @returns {*} The copy.
 */
function without(value, paths) {
	const copy = structuredClone(value);
	for (const path of paths) {
		const keys = path.split(".");
		const last = keys.pop();
		const holder = keys.reduce((node, key) => node?.[key], copy);
		if (holder) delete holder[last];
	}
	return copy;
}

/**
 * Plain JavaScript's serialization of the owner's data, with the members at the given paths (below `owner`) left out.
 * @param {object} owner - The owner file's exports.
 * @param {string[]} [denied] - Paths below `owner`.
 * @returns {Record<string, string>} The JSON text by node path.
 */
function expected(owner, denied = []) {
	const out = {};
	for (const path of PATHS) {
		const name = path.slice("owner.".length);
		const below = denied.filter((p) => p.startsWith(`${name}.`)).map((p) => p.slice(name.length + 1));
		out[path] = JSON.stringify(without(JSON.parse(JSON.stringify(owner[name])), below));
	}
	return out;
}

describe.each(matrix)("serializing data with its own toJSON > $mode / $runtime / $attribution", ({ mode, runtime, attribution }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
	});

	const build = async (rules) => {
		api = await slothlet({
			base: join(FIXTURE, "host"),
			mode,
			runtime,
			silent: true,
			permissions: { policy: "allow", caller: { attribution }, rules }
		});
		for (const name of ["owner", "reader", "writer"]) await api.slothlet.api.add(name, join(FIXTURE, name), { id: name });
		for (const name of ["owner", "reader", "writer"]) await api[name];
		for (const path of PATHS) await api.owner[path.slice("owner.".length)];
		return api;
	};

	/**
	 * What a module gets serializing each node, now, through the node's `toJSON` called itself, and from a timer
	 * through the node it kept.
	 * @param {string} who - `reader` or `writer`.
	 * @returns {Promise<{now: object, called: object, later: object}>} The JSON text by node path, per route.
	 */
	const serialized = async (who) => {
		const now = {};
		const called = {};
		const later = {};
		for (const path of PATHS) {
			now[path] = await api[who].json(path);
			called[path] = await api[who].called(path);
			await api[who].keep(path);
			later[path] = await api[who].later(path);
		}
		return { now, called, later };
	};

	const DENIED = [
		"cfg.hidden",
		"sealed.hidden",
		"sealed.deep.hidden",
		"sealed.list.0.hidden",
		"own.hidden",
		"holder.inner.hidden",
		"list.0.hidden"
	];

	it("leaves out each member the reader may not read, by the node's path and the member's name", async () => {
		const owner = await twin();
		await build(DENIED.map((path) => ({ caller: "reader.**", target: `owner.${path}`, effect: "deny" })));
		const want = expected(owner, DENIED);
		const got = await serialized("reader");
		expect(got.now).toEqual(want);
		expect(got.later).toEqual(want);
		// The node's own `toJSON`, called by the module, gives the same: it is the one serialization uses.
		expect(got.called["owner.cfg"]).toBe(want["owner.cfg"]);
		expect(got.called["owner.sealed"]).toBe(want["owner.sealed"]);
		expect(got.called["owner.own"]).toBe(want["owner.own"]);
	});

	it("leaves out an object member the rules leave the reader nothing of", async () => {
		const owner = await twin();
		await build([{ caller: "reader.**", target: "owner.sealed.deep.**", effect: "deny" }]);
		const got = await serialized("reader");
		expect(got.now["owner.sealed"]).toBe(expected(owner, ["sealed.deep"])["owner.sealed"]);
		expect(got.later["owner.sealed"]).toBe(expected(owner, ["sealed.deep"])["owner.sealed"]);
	});

	it("serializes everything for a module the rules do not name, and for the host, as plain JavaScript does", async () => {
		const owner = await twin();
		await build(DENIED.map((path) => ({ caller: "reader.**", target: `owner.${path}`, effect: "deny" })));
		const want = expected(owner);
		const got = await serialized("writer");
		expect(got.now).toEqual(want);
		expect(got.later).toEqual(want);
		for (const path of PATHS) expect(JSON.stringify(api.owner[path.slice("owner.".length)])).toBe(want[path]);
	});
});
