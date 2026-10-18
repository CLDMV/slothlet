/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_code/callee/ops.mjs
 *	@Date: 2026-10-16T19:30:00-07:00 (1792204200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T19:30:00-07:00 (1792204200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The callee for the caller-supplied-code tests (#597). Each leaf does something ordinary with
 * the value it is handed — converts it, reads a property of it, calls it — so any code that value carries
 * runs inside this module's call. The rules allow this module, and only this module, to read the vault.
 *
 * @module api_tests/api_test_caller_supplied_code/callee/ops
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Convert the value to a string and return its length (`String(v)`), as in the issue's repro.
 * @param {*} value - Any value.
 * @returns {number} Length of its string form.
 * @public
 * @example
 * api.callee.ops.echo("abc"); // 3
 */
export function echo(value) {
	return String(value).length;
}

/**
 * Convert the value with a template literal and return the length.
 * @param {*} value - Any value.
 * @returns {number} Length of its string form.
 * @public
 * @example
 * api.callee.ops.template("abc"); // 3
 */
export function template(value) {
	return `${value}`.length;
}

/**
 * Convert the value to a number (`+v`), which goes through `Symbol.toPrimitive` or `valueOf`.
 * @param {*} value - Any value.
 * @returns {number} Its numeric form.
 * @public
 * @example
 * api.callee.ops.num("2"); // 2
 */
export function num(value) {
	return +value;
}

/**
 * Read one property of the value, which runs a getter or a Proxy `get` trap it carries.
 * @param {object} value - Any object.
 * @param {string} key - Property to read.
 * @returns {*} The property's value.
 * @public
 * @example
 * api.callee.ops.read({ a: 1 }, "a"); // 1
 */
export function read(value, key) {
	return value[key];
}

/**
 * Test for a property with `in`, which runs a Proxy `has` trap.
 * @param {object} value - Any object.
 * @param {string} key - Property to test.
 * @returns {boolean} Whether the property is present.
 * @public
 * @example
 * api.callee.ops.has({ a: 1 }, "a"); // true
 */
export function has(value, key) {
	return key in value;
}

/**
 * Serialize the value with `JSON.stringify`, which runs a `toJSON` method it carries.
 * @param {*} value - Any value.
 * @returns {string} The JSON text.
 * @public
 * @example
 * api.callee.ops.json({ a: 1 }); // '{"a":1}'
 */
export function json(value) {
	return JSON.stringify(value);
}

/**
 * Call the function it is handed, synchronously.
 * @param {Function} fn - Callback.
 * @returns {*} The callback's result.
 * @public
 * @example
 * api.callee.ops.run(() => 1); // 1
 */
export function run(fn) {
	return fn();
}

/**
 * Wait one timer tick, then call the function it is handed, still inside this call.
 * @param {Function} fn - Callback.
 * @returns {Promise<*>} The callback's result.
 * @public
 * @example
 * await api.callee.ops.runAfterAwait(() => 1); // 1
 */
export async function runAfterAwait(fn) {
	await new Promise((resolve) => setTimeout(resolve, 0));
	return await fn();
}

/**
 * Read the vault on this module's own account: the deputy's legitimate use of its own rights.
 * @returns {string} The vault's value.
 * @public
 * @example
 * api.callee.ops.useSecret(); // "s3cret"
 */
export function useSecret() {
	return self.vault.secret.secret();
}
