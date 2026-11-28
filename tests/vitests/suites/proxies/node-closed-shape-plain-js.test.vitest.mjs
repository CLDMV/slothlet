/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/proxies/node-closed-shape-plain-js.test.vitest.mjs
 *	@Date: 2026-11-25T07:58:11-08:00 (1795622291)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:55-08:00 (1795869175)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A closed api node lists, serializes and inspects as the same object does in plain JavaScript (#971).
 *
 * @description
 * A node given an integer key, a member fixed before it is closed and a symbol member answers `Reflect.ownKeys`,
 * `Object.keys`, `JSON.stringify` and `util.inspect` as the plain object does, open and after `Object.preventExtensions`,
 * `Object.seal` and `Object.freeze`: integer keys ascending, then string keys in the order they were made, then symbols.
 * Each check runs once on the fixture's module imported as plain JavaScript and once on its api node, for a folder node,
 * function nodes and class-instance nodes, in eager and lazy mode, the async and live runtime, with permissions on and
 * off.
 * @module tests/vitests/suites/proxies/node-closed-shape-plain-js
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import util from "node:util";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_node_shape_plain_js");

const PERMISSIONS = [
	{ name: "permissions off", permissions: null },
	{ name: "permissions on", permissions: { policy: "allow" } }
];
const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => PERMISSIONS.map((entry) => ({ mode, runtime, ...entry })))
);

let twins = 0;

/**
 * A fresh copy of one of the fixture's modules, imported as plain JavaScript.
 * @param {string} file - The file under the fixture.
 * @returns {Promise<object>} Its namespace.
 */
const twin = (file) => import(`${pathToFileURL(join(FIXTURE, file)).href}?plain-twin-${++twins}`);

/** Each node checked: how to reach it on the api, and the same value in plain JavaScript. */
const NODES = {
	folder: {
		node: (api) => api.folder,
		plain: async () => ({ alpha: (await twin("folder/alpha.mjs")).alpha, beta: (await twin("folder/beta.mjs")).beta })
	},
	member: { node: (api) => api.folder.alpha, plain: async () => (await twin("folder/alpha.mjs")).alpha },
	valued: { node: (api) => api.valued, plain: async () => (await twin("valued/valued.mjs")).default },
	inst: { node: (api) => api.inst, plain: async () => (await twin("inst.mjs")).default },
	kept: { node: (api) => api.shapes.kept, plain: async () => (await twin("shapes.mjs")).kept },
	plain: { node: (api) => api.shapes.plain, plain: async () => (await twin("shapes.mjs")).plain }
};

/** How a value is closed, or left open. */
const CLOSES = {
	open: () => {},
	preventExtensions: (value) => Object.preventExtensions(value),
	seal: (value) => Object.seal(value),
	freeze: (value) => Object.freeze(value)
};

const SYMBOL = Symbol.for("slothlet.test.971.member");

/**
 * A closed node still lists the `util.inspect` hook its shell holds. Node reads the hook off a Proxy's target, never
 * through its traps, and a closed target's prototype is the one the node reports, so the hook can only be the shell's
 * own, which the invariants then require the node to list. It is left out of the comparison; everything else is not.
 * @param {Array<string|symbol>} keys - Own keys.
 * @returns {Array<string>} The keys as text, without the hook.
 */
const withoutInspectHook = (keys) => keys.filter((key) => key !== util.inspect.custom).map(String);

/**
 * Build an instance over the fixture with every node the checks touch loaded.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function build({ mode, runtime, permissions }) {
	const api = await slothlet({ base: FIXTURE, silent: true, mode, runtime, ...(permissions ? { permissions } : {}) });
	await api.folder;
	await api.folder.alpha;
	await api.valued;
	await api.inst;
	await api.shapes;
	return api;
}

/**
 * Give a value members of every kind, one fixed before the value is closed, close it, and read its shape.
 * @param {object|Function} value - The value.
 * @param {Function} close - How it is closed.
 * @returns {object} What it answered.
 */
function closedShape(value, close) {
	value.first = 1;
	value[2] = "two";
	value.second = 2;
	value[SYMBOL] = "sym";
	value[0] = "zero";
	// Fixed before the value is closed, made after `first`: plain JavaScript keeps it in the order it was made.
	Object.defineProperty(value, "second", { configurable: false });
	Object.defineProperty(value, "fixed", { value: 7, writable: true, enumerable: true, configurable: false });
	value.last = 3;
	close(value);
	return {
		own: withoutInspectHook(Reflect.ownKeys(value)),
		keys: Object.keys(value),
		json: JSON.stringify(value),
		inspect: util.inspect(value)
	};
}

describe("a closed node lists, serializes and inspects as plain JavaScript (#971)", () => {
	let api;
	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	for (const options of matrix) {
		const label = `${options.mode}, ${options.runtime}, ${options.name}`;
		for (const [how, close] of Object.entries(CLOSES)) {
			it(`${how}: key order, keys, JSON and inspect match plain JS (${label})`, async () => {
				api = await build(options);
				for (const [name, { node, plain }] of Object.entries(NODES)) {
					const expected = closedShape(await plain(), close);
					expect({ name, how, ...closedShape(node(api), close) }).toEqual({ name, how, ...expected });
				}
			});
		}
	}
});
