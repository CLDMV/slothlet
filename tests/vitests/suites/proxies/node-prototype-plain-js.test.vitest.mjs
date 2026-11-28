/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/proxies/node-prototype-plain-js.test.vitest.mjs
 *	@Date: 2026-11-25T03:03:38-08:00 (1795604618)
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
 * @fileoverview An api node answers its prototype, its function's `prototype` and a refused close as plain JavaScript
 * does (#972).
 *
 * @description
 * A class-instance node reports its class's prototype, a file's default export as much as a member; a function node
 * describes its own `prototype` as writable and non-configurable; and a node over a module's Proxy that refuses to be
 * made non-extensible answers `false` and stays open. Each check runs once on the fixture's module imported as plain
 * JavaScript and once on its api node, and the two answers must be equal, in eager and lazy mode, the async and live
 * runtime, with hooks on and off.
 * @module tests/vitests/suites/proxies/node-prototype-plain-js
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

/**
 * Build an instance over the fixture with every node the checks touch loaded.
 * @param {object} options - Instance options.
 * @returns {Promise<object>} The api.
 */
async function build({ mode, runtime, hook }) {
	const api = await slothlet({ base: FIXTURE, silent: true, mode, runtime, hook: { enabled: hook } });
	await api.inst;
	await api.shapes;
	await api.valued;
	await api.stubborn;
	return api;
}

/**
 * What a value's prototype is, told without comparing identities across module copies.
 * @param {object} value - The value.
 * @returns {object} The answer.
 */
function prototypeOf(value) {
	const prototype = Object.getPrototypeOf(value);
	return {
		isObjectPrototype: prototype === Object.prototype,
		className: prototype?.constructor?.name,
		members: prototype === null ? null : Object.getOwnPropertyNames(prototype),
		viaProto: value.__proto__ === prototype
	};
}

/**
 * A class instance's prototype, open and frozen.
 * @param {object} value - The instance.
 * @returns {object} What it answered.
 */
function instancePrototype(value) {
	const open = prototypeOf(value);
	Object.freeze(value);
	return { open, frozen: prototypeOf(value).className };
}

/**
 * A function's own `prototype` as described, open and once the function is closed. Each close starts from an open
 * function: V8 leaves `prototype` writable when a sealed function is then frozen, which says nothing about the node.
 * @param {Function} value - The function.
 * @param {string} close - The `Object` method that closes it.
 * @returns {object} What it answered.
 */
function functionPrototype(value, close) {
	const describe = () => {
		const descriptor = Object.getOwnPropertyDescriptor(value, "prototype");
		return {
			writable: descriptor.writable,
			enumerable: descriptor.enumerable,
			configurable: descriptor.configurable,
			type: typeof descriptor.value,
			read: typeof value.prototype,
			same: descriptor.value === value.prototype
		};
	};
	const open = describe();
	const deleted = Reflect.deleteProperty(value, "prototype");
	const keys = Reflect.ownKeys(value).filter((key) => typeof key === "string");
	Object[close](value);
	return { open, deleted, keys, closed: describe() };
}

/**
 * Close a Proxy whose `preventExtensions` trap refuses.
 * @param {object} value - The Proxy.
 * @returns {object} What it answered.
 */
function refusedClose(value) {
	const answered = Reflect.preventExtensions(value);
	const extensible = Object.isExtensible(value);
	let frozen;
	try {
		Object.freeze(value);
		frozen = "frozen";
	} catch (error) {
		frozen = error.constructor.name;
	}
	return { answered, extensible, frozen, stillExtensible: Object.isExtensible(value), read: value.b };
}

describe("node prototype answers match plain JavaScript (#972)", () => {
	let api;
	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	for (const options of matrix) {
		const label = `${options.mode}, ${options.runtime}, hooks ${options.hook ? "on" : "off"}`;
		it(`a class-instance node reports its class's prototype (${label})`, async () => {
			api = await build(options);
			expect(instancePrototype(api.inst)).toEqual(instancePrototype((await twin("inst.mjs")).default));
			expect(instancePrototype(api.shapes.kept)).toEqual(instancePrototype((await twin("shapes.mjs")).kept));
		});
		for (const close of ["seal", "freeze"]) {
			it(`a function node describes its prototype as a function does, open and after ${close} (${label})`, async () => {
				api = await build(options);
				const expected = functionPrototype((await twin("valued/valued.mjs")).default, close);
				expect(functionPrototype(api.valued, close)).toEqual(expected);
			});
		}
		it(`a node over a Proxy refusing to close answers false and stays open (${label})`, async () => {
			api = await build(options);
			expect(refusedClose(api.stubborn)).toEqual(refusedClose((await twin("stubborn.mjs")).stubborn));
		});
	}
});
