/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_members/other/sink.mjs
 *	@Date: 2026-11-03T00:00:00-08:00 (1793692800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T04:18:25-08:00 (1793708305)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #632 — a module the callers may call, handed a node of the callee's.
 *
 * @module api_tests/api_test_function_members/other/sink
 */

import { EventEmitter } from "node:events";
import { self } from "@cldmv/slothlet/runtime";
import { Bus } from "../../api_test_function_members_lib/bus-class.mjs";

/**
 * Take a value handed over and report what kind it is.
 * @param {*} value - The value.
 * @returns {string} Its `typeof`.
 * @public
 * @example
 * take({}); // "object"
 */
export function take(value) {
	return typeof value;
}

/**
 * Whether a value is an instance of the callee's emitter class, with that class's prototype as its own.
 * @param {*} value - The value.
 * @returns {boolean[]} `[instanceof Bus, getPrototypeOf === Bus.prototype]`.
 * @public
 * @example
 * isBus({}); // [false, false]
 */
export function isBus(value) {
	return [value instanceof Bus, Object.getPrototypeOf(value) === Bus.prototype];
}

/**
 * Use the prototype of an emitter handed over: run its method and test it against `EventEmitter`.
 * @param {*} value - The emitter.
 * @returns {Array<*>} `[the method's result, instanceof EventEmitter]`.
 * @public
 * @example
 * protoOf(bus); // ["bus", true]
 */
export function protoOf(value) {
	return [Object.getPrototypeOf(value).kind.call({}), value instanceof EventEmitter];
}

/**
 * Hand the callee's emitter to the caller module.
 * @returns {Promise<Array<string>>} What the caller could do with its prototype.
 * @public
 * @example
 * await handToCaller(); // ["PERMISSION_DENIED", "PERMISSION_DENIED"]
 */
export async function handToCaller() {
	return self.caller.probe.protoOfHanded(self.callee.bus);
}
