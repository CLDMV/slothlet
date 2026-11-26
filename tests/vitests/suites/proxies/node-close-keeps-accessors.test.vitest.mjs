/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/node-close-keeps-accessors.test.vitest.mjs
 *	@Date: 2026-11-25T03:03:06-08:00 (1795604586)
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
 * @fileoverview Closing an api node keeps its accessors, as closing an object does (#970).
 *
 * @description
 * An accessor defined on a folder node, a class-instance node, a module-object node or an array node stays an
 * accessor once the node is made non-extensible, sealed or frozen: its getter and setter still run, and the node
 * describes it as an accessor. A member written through the node stays the data it is. Each check runs once on the
 * fixture's module imported as plain JavaScript and once on its api node, and the two answers must be equal, in eager
 * and lazy mode, the async and live runtime, with hooks on and off.
 * @module tests/vitests/suites/proxies/node-close-keeps-accessors
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
 * A member's descriptor as plain attributes.
 * @param {object} value - The value.
 * @param {string} key - The member.
 * @returns {object|undefined} Its shape.
 */
function shape(value, key) {
	const descriptor = Object.getOwnPropertyDescriptor(value, key);
	if (!descriptor) return undefined;
	return {
		kind: "value" in descriptor ? "data" : "accessor",
		get: typeof descriptor.get,
		set: typeof descriptor.set,
		writable: descriptor.writable,
		enumerable: descriptor.enumerable,
		configurable: descriptor.configurable
	};
}

/**
 * Define accessors and write a member, close the value, then read, write and describe them.
 * @param {object} value - The value.
 * @param {string} close - The `Object` method that closes it.
 * @returns {object} What it answered.
 */
function closedAccessors(value, close) {
	let stored = 2;
	Object.defineProperty(value, "acc", {
		get: () => stored,
		set: (next) => {
			stored = next;
		},
		enumerable: true,
		configurable: true
	});
	Object.defineProperty(value, "getOnly", { get: () => "only", enumerable: true, configurable: true });
	Reflect.set(value, "written", 4);
	Object[close](value);
	const read = value.acc;
	const wrote = Reflect.set(value, "acc", 7);
	return {
		read,
		wrote,
		afterWrite: value.acc,
		getOnly: value.getOnly,
		written: value.written,
		acc: shape(value, "acc"),
		getOnlyShape: shape(value, "getOnly"),
		writtenShape: shape(value, "written"),
		extensible: Object.isExtensible(value),
		sealed: Object.isSealed(value),
		frozen: Object.isFrozen(value)
	};
}

describe("closing a node keeps its accessors (#970)", () => {
	let api;
	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	for (const options of matrix) {
		const label = `${options.mode}, ${options.runtime}, hooks ${options.hook ? "on" : "off"}`;
		for (const close of ["preventExtensions", "seal", "freeze"]) {
			it(`${close}: every node answers as its plain value (${label})`, async () => {
				api = await build(options);
				for (const [name, { node, plain }] of Object.entries(NODES)) {
					const expected = closedAccessors(await plain(), close);
					expect({ name, ...closedAccessors(node(api), close) }).toEqual({ name, ...expected });
				}
			});
		}
	}
});
