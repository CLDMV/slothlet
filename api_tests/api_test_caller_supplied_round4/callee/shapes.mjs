/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round4/callee/shapes.mjs
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
 * @fileoverview Reads slothlet functions and reports what plain JavaScript says about them (#597): a function a module
 * reads out of `self.slothlet` behaves as the one the host reads.
 *
 * @module api_tests/api_test_caller_supplied_round4/callee/shapes
 */

import { self } from "@cldmv/slothlet/runtime";
import { describeFunction } from "./__lib/describe.mjs";

/**
 * The functions this module read and kept, by path.
 * @type {Map<string, Function>}
 * @private
 */
const kept = new Map();

/**
 * Read a slothlet function by its path under `self.slothlet`.
 * @param {string} dotted - The path.
 * @returns {Function} The function.
 * @private
 */
function read(dotted) {
	return dotted.split(".").reduce((node, key) => node[key], self.slothlet);
}

/**
 * Read a slothlet function and keep it.
 * @param {string} dotted - Its path under `self.slothlet`.
 * @returns {boolean} True.
 * @public
 * @example
 * api.callee.shapes.keep("scope");
 */
export function keep(dotted) {
	kept.set(dotted, read(dotted));
	return true;
}

/**
 * Describe a slothlet function this module reads (or kept).
 * @param {string} dotted - Its path under `self.slothlet`.
 * @param {PropertyKey} [key] - A member whose attributes are reported.
 * @returns {object} The report.
 * @public
 * @example
 * api.callee.shapes.report("scope");
 */
export function report(dotted, key) {
	return describeFunction(kept.get(dotted) ?? read(dotted), key);
}

/**
 * Define a member on a slothlet function this module reads, naming only its value.
 * @param {string} dotted - Its path under `self.slothlet`.
 * @param {string} key - The member.
 * @returns {object} The function's report for the member.
 * @public
 * @example
 * api.callee.shapes.define("scope", "extra");
 */
export function define(dotted, key) {
	const fn = read(dotted);
	Object.defineProperty(fn, key, { value: 1 });
	return describeFunction(fn, key);
}

/**
 * Give a slothlet function this module reads `Function.prototype` as its prototype.
 * @param {string} dotted - Its path under `self.slothlet`.
 * @returns {boolean} Whether the prototype was set.
 * @public
 * @example
 * api.callee.shapes.reparent("scope");
 */
export function reparent(dotted) {
	return Reflect.setPrototypeOf(read(dotted), Function.prototype);
}
