/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round2/callee/ops.mjs
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
 * @fileoverview The callee for the second round of caller-supplied-code tests (#597), mounted as a module of its
 * own: it may call the vault's secret, and handles what its caller hands it the way any leaf does — calling it,
 * reading it, converting it, sometimes after an await.
 *
 * @module api_tests/api_test_caller_supplied_round2/callee/ops
 */

import { self, context } from "@cldmv/slothlet/runtime";

/**
 * Wait one macrotask.
 * @returns {Promise<void>} Settles on the next turn.
 * @private
 */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

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
 * Convert a value it was handed to a string, after an await.
 * @param {*} value - The value.
 * @returns {Promise<string>} The string.
 * @public
 * @example
 * await api.callee.ops.convertLater({}); // "[object Object]"
 */
export async function convertLater(value) {
	await tick();
	return String(value);
}

/**
 * Read a property of a value it was handed, after an await.
 * @param {object} value - The value.
 * @param {string} key - The property.
 * @returns {Promise<*>} The property's value.
 * @public
 * @example
 * await api.callee.ops.readLater({ a: 1 }, "a"); // 1
 */
export async function readLater(value, key) {
	await tick();
	return value[key];
}

/**
 * Call the first entry of a list it was handed, after an await.
 * @param {Array<function(): *>} list - The list.
 * @returns {Promise<*>} What the entry returned.
 * @public
 * @example
 * await api.callee.ops.callFirstLater([() => 1]); // 1
 */
export async function callFirstLater(list) {
	await tick();
	return list[0]();
}

/**
 * Tell the supplier something happened, then convert a value it was handed to a string.
 * @param {*} value - The value.
 * @returns {string} The string.
 * @public
 * @example
 * api.callee.ops.convertAfterNotify({}); // "[object Object]"
 */
export function convertAfterNotify(value) {
	self.supplier.hooks.notify();
	return String(value);
}

/**
 * Open a scope that owns the `token` context key, and run a function it was handed inside it.
 * @param {function(): *} fn - The function.
 * @returns {Promise<*>} What it returned.
 * @public
 * @example
 * await api.callee.ops.scoped(() => 1); // 1
 */
export function scoped(fn) {
	return self.slothlet.scope({ context: { token: "callee" }, owners: { token: "callee" }, fn });
}

/**
 * Open a scope that owns the `token` context key, and write the key itself.
 * @returns {Promise<string>} The key's value after the write.
 * @public
 * @example
 * await api.callee.ops.scopedOwnWrite(); // "rewritten"
 */
export function scopedOwnWrite() {
	return self.slothlet.scope({
		context: { token: "callee" },
		owners: { token: "callee" },
		fn: () => {
			context.token = "rewritten";
			return context.token;
		}
	});
}

/**
 * Assign a member under this module's own mount.
 * @returns {number} The member's value.
 * @public
 * @example
 * api.callee.ops.plantOwn(); // 1
 */
export function plantOwn() {
	self.callee.planted = 1;
	return self.callee.planted;
}

/**
 * Report which version of a versioned path this module is routed to.
 * @returns {string} The version.
 * @public
 * @example
 * api.callee.ops.whichAuth(); // "v1"
 */
export function whichAuth() {
	return self.auth.login.which();
}
