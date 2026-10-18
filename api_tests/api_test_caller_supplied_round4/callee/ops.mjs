/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round4/callee/ops.mjs
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
 * @fileoverview The callee for the fourth round of caller-supplied-code tests (#597): it may call the vault's secret,
 * and runs what it is handed or reads.
 *
 * @module api_tests/api_test_caller_supplied_round4/callee/ops
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Write a member of a member of a value.
 * @param {object} value - The value.
 * @param {string} key - The member.
 * @param {string} inner - The member's member.
 * @param {*} next - What to write.
 * @returns {boolean} True.
 * @public
 * @example
 * api.callee.ops.writeNested(box, "ns", "v", 1);
 */
export function writeNested(value, key, inner, next) {
	value[key][inner] = next;
	return true;
}

/**
 * Spread a member of a value.
 * @param {object} value - The value.
 * @param {string} key - The member.
 * @returns {Array<*>} What it yields.
 * @public
 * @example
 * api.callee.ops.spreadMember(box, "it");
 */
export function spreadMember(value, key) {
	return [...value[key]];
}

/**
 * Run a member's getter, taken from its descriptor, on another receiver.
 * @param {object} value - The value.
 * @param {string} key - The member.
 * @param {string} inner - The accessor's key.
 * @returns {*} What the getter returned.
 * @public
 * @example
 * api.callee.ops.detachedGetter(box, "as", "value");
 */
export function detachedGetter(value, key, inner) {
	return Object.getOwnPropertyDescriptor(value[key], inner).get.call({});
}

/**
 * Read a member of a value.
 * @param {object} value - The value.
 * @param {string} key - The member.
 * @returns {*} The member.
 * @public
 * @example
 * api.callee.ops.read(proxied, "x");
 */
export function read(value, key) {
	return value[key];
}

/**
 * Call a function with no arguments.
 * @param {Function} fn - The function.
 * @returns {*} What it returned.
 * @public
 * @example
 * api.callee.ops.call(() => 1); // 1
 */
export function call(fn) {
	return fn();
}

/**
 * The secret, called as the callee.
 * @returns {string} The secret.
 * @public
 * @example
 * api.callee.ops.secretDirect(); // "s3cret"
 */
export function secretDirect() {
	return self.vault.secret.secret();
}

/**
 * Read the supplier's Proxy export through `self`.
 * @returns {*} What the read returned.
 * @public
 * @example
 * api.callee.ops.proxiedViaSelf();
 */
export function proxiedViaSelf() {
	return self.supplier.bag.proxied.anything;
}

/**
 * Iterate the supplier's generator through `self`.
 * @returns {Array<string>} What it yielded.
 * @public
 * @example
 * api.callee.ops.genViaSelf();
 */
export function genViaSelf() {
	return [...self.supplier.bag.gen()];
}

/**
 * Iterate the supplier's async generator through `self`.
 * @returns {Promise<Array<string>>} What it yielded.
 * @public
 * @example
 * await api.callee.ops.agenViaSelf();
 */
export async function agenViaSelf() {
	const values = [];
	for await (const value of self.supplier.bag.agen()) values.push(value);
	return values;
}

/**
 * Iterate the generator the supplier's function under a symbol returns, through `self`.
 * @returns {Array<string>} What it yielded.
 * @public
 * @example
 * api.callee.ops.symbolGenViaSelf();
 */
export function symbolGenViaSelf() {
	return [...self.supplier.bag.symbolic[Symbol.for("round4.gen")]()];
}

/**
 * Call the function the supplier returns, through `self`.
 * @returns {*} What it returned.
 * @public
 * @example
 * api.callee.ops.madeViaSelf();
 */
export function madeViaSelf() {
	return self.supplier.bag.make()();
}

/**
 * Step the iterator the supplier returns, through `self`.
 * @returns {*} The step's value.
 * @public
 * @example
 * api.callee.ops.iterViaSelf();
 */
export function iterViaSelf() {
	return self.supplier.bag.makeIter().next().value;
}

/**
 * Construct the class the supplier returns, through `self`.
 * @returns {*} The instance's answer.
 * @public
 * @example
 * api.callee.ops.classViaSelf();
 */
export function classViaSelf() {
	const Made = self.supplier.bag.makeClass();
	return new Made(1).answer;
}
