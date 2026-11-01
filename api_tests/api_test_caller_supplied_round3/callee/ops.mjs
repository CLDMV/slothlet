/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round3/callee/ops.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The callee for the third round of caller-supplied-code tests (#597), mounted as a module of its own:
 * it may call the vault's secret, and handles what its caller hands it the way any leaf does — calling it, spreading
 * it, reading its members.
 *
 * @module api_tests/api_test_caller_supplied_round3/callee/ops
 */

import { createRequire } from "node:module";
import { self } from "@cldmv/slothlet/runtime";

/**
 * The callee's CommonJS helper.
 * @type {{double: function(number): number}}
 * @private
 */
const helper = createRequire(import.meta.url)("./__lib/helper.cjs");

/**
 * Double a number with its CommonJS helper.
 * @param {number} value - The number.
 * @returns {number} Twice it.
 * @public
 * @example
 * api.callee.ops.double(2); // 4
 */
export function double(value) {
	return helper.double(value);
}

/**
 * Call the vault's secret through its CommonJS helper, in a call it was handed an object in: the helper's frame is
 * its own code.
 * @param {object} _ - Anything.
 * @returns {string} The secret.
 * @public
 * @example
 * api.callee.ops.ownViaHelper({}); // "s3cret"
 */
export function ownViaHelper(_) {
	return helper.apply(() => self.vault.secret.secret());
}

/**
 * Convert a value it was handed to a string, after waiting one macrotask.
 * @param {*} value - The value.
 * @returns {Promise<string>} The string.
 * @public
 * @example
 * await api.callee.ops.convertLater({}); // "[object Object]"
 */
export async function convertLater(value) {
	await new Promise((resolve) => setTimeout(resolve, 0));
	return String(value);
}

/**
 * Call the vault's secret on its own account, after waiting one macrotask.
 * @returns {Promise<string>} The secret.
 * @public
 * @example
 * await api.callee.ops.secretLater(); // "s3cret"
 */
export async function secretLater() {
	await new Promise((resolve) => setTimeout(resolve, 0));
	return self.vault.secret.secret();
}

/**
 * Call a function it was handed.
 * @param {function(): *} fn - The function.
 * @returns {*} What it returned.
 * @public
 * @example
 * api.callee.ops.run(() => 1); // 1
 */
export function run(fn) {
	return fn();
}

/**
 * Read a property of a value it was handed.
 * @param {object} value - The value.
 * @param {string} key - The property.
 * @returns {*} The property's value.
 * @public
 * @example
 * api.callee.ops.read({ a: 1 }, "a"); // 1
 */
export function read(value, key) {
	return value[key];
}

/**
 * Read a nested property of a value it was handed.
 * @param {object} value - The value.
 * @param {string} key - The first property.
 * @param {string} inner - The property of that.
 * @returns {*} The nested property's value.
 * @public
 * @example
 * api.callee.ops.readNested({ a: { b: 1 } }, "a", "b"); // 1
 */
export function readNested(value, key, inner) {
	return value[key][inner];
}

/**
 * Spread an iterable it was handed into an array.
 * @param {Iterable<*>} value - The iterable.
 * @returns {Array<*>} Its entries.
 * @public
 * @example
 * api.callee.ops.spread([1, 2]); // [1, 2]
 */
export function spread(value) {
	return [...value];
}

/**
 * Read every enumerable member of a value it was handed.
 * @param {object} value - The value.
 * @returns {Array<*>} The members' values.
 * @public
 * @example
 * api.callee.ops.values({ a: 1 }); // [1]
 */
export function values(value) {
	return Object.keys(value).map((key) => value[key]);
}

/**
 * Call the function a value holds under a symbol.
 * @param {object} value - The value.
 * @param {symbol} key - The symbol.
 * @returns {*} What it returned.
 * @public
 * @example
 * api.callee.ops.callSymbol({ [Symbol.for("x")]: () => 1 }, Symbol.for("x")); // 1
 */
export function callSymbol(value, key) {
	return value[key]();
}
