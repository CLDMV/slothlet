/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/node-key-listing-plain-js.test.vitest.mjs
 *	@Date: 2026-11-25T03:03:19-08:00 (1795604599)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T03:26:43-08:00 (1795606003)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An api node lists its keys and serializes as the same object does in plain JavaScript (#971).
 *
 * @description
 * A member defined non-enumerable on a node is among its own keys, open or closed; a class-instance node lists and
 * serializes members written or defined through it in the order they were made, an enumerable accessor included, open
 * or closed. Each check runs once on the fixture's module imported as plain JavaScript and once on its api node, and
 * the two answers must be equal, in eager and lazy mode, the async and live runtime, with hooks on and off.
 * @module tests/vitests/suites/proxies/node-key-listing-plain-js
 */

import { describe, it, expect, afterEach } from "vitest";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import slothlet from "@cldmv/slothlet";

const FIXTURE = resolve("api_tests/api_test_node_shape_plain_js");

const matrix = ["eager", "lazy"].flatMap((mode) =>
	["async", "live"].flatMap((runtime) => [true, false].map((hook) => ({ mode, runtime, hook })))
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
	inst: { node: (api) => api.inst, plain: async () => (await twin("inst.mjs")).default },
	kept: { node: (api) => api.shapes.kept, plain: async () => (await twin("shapes.mjs")).kept },
	plain: { node: (api) => api.shapes.plain, plain: async () => (await twin("shapes.mjs")).plain },
	listed: { node: (api) => api.listed, plain: async () => (await twin("listed.mjs")).listed }
};

/**
 * Build an instance over the fixture with every node the checks touch loaded.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function build({ mode, runtime, hook }) {
	const api = await slothlet({ base: FIXTURE, silent: true, mode, runtime, hook: { enabled: hook } });
	await api.folder;
	await api.inst;
	await api.shapes;
	await api.listed;
	return api;
}

/**
 * Every string key of a value, and its enumerable ones.
 * @param {object} value - The value.
 * @returns {object} The listings.
 */
const listings = (value) => ({ own: Object.getOwnPropertyNames(value), keys: Object.keys(value) });

/**
 * Define a non-enumerable accessor and a non-enumerable data member, then list the value open and frozen.
 * @param {object} value - The value.
 * @returns {object} What it answered.
 */
function hiddenMembers(value) {
	Object.defineProperty(value, "hiddenAcc", { get: () => 1, enumerable: false, configurable: true });
	Object.defineProperty(value, "hiddenData", { value: 2, writable: true, enumerable: false, configurable: true });
	const open = { ...listings(value), symbols: Object.getOwnPropertySymbols(value).length };
	Object.freeze(value);
	const frozen = listings(value);
	const accessor = Object.getOwnPropertyDescriptor(value, "hiddenAcc");
	const data = Object.getOwnPropertyDescriptor(value, "hiddenData");
	return {
		open,
		frozen,
		reads: [value.hiddenAcc, value.hiddenData],
		accessor: accessor && { kind: "value" in accessor ? "data" : "accessor", enumerable: accessor.enumerable },
		data: data && { value: data.value, enumerable: data.enumerable, writable: data.writable }
	};
}

/**
 * Define an enumerable accessor, then write a member, and list and serialize the value open and frozen.
 * @param {object} value - The value.
 * @returns {object} What it answered.
 */
function madeInOrder(value) {
	Object.defineProperty(value, "acc", { get: () => 3, enumerable: true, configurable: true });
	Reflect.set(value, "later", 5);
	const open = { ...listings(value), json: JSON.stringify(value) };
	Object.freeze(value);
	return { open, frozen: { ...listings(value), json: JSON.stringify(value) } };
}

describe("node key listings answer as plain JavaScript (#971)", () => {
	let api;
	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	for (const options of matrix) {
		const label = `${options.mode}, ${options.runtime}, hooks ${options.hook ? "on" : "off"}`;
		it(`a member defined non-enumerable is listed, open and frozen (${label})`, async () => {
			api = await build(options);
			for (const [name, { node, plain }] of Object.entries(NODES)) {
				const expected = hiddenMembers(await plain());
				expect({ name, ...hiddenMembers(node(api)) }).toEqual({ name, ...expected });
			}
		});
		it(`members are listed and serialized in the order they were made (${label})`, async () => {
			api = await build(options);
			for (const [name, { node, plain }] of Object.entries(NODES)) {
				const expected = madeInOrder(await plain());
				expect({ name, ...madeInOrder(node(api)) }).toEqual({ name, ...expected });
			}
		});
	}
});
