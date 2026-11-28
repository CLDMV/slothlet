/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_uwa_searched/api/searched.mjs
 *	@Date: 2026-11-25T02:33:50-08:00 (1795602830)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:00-08:00 (1795869000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that makes data of many shapes at run time and hands it out: shapes the search for code in
 * what a module hands out reads, stops at, or cannot tell from code.
 */
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { constants } from "node:os";
import * as table from "../lib/table.mjs";

/**
 * An object with `count` string-keyed members `k0`, `k1`, ….
 * @param {number} count - How many members.
 * @returns {object} The object.
 * @example
 * wide(2); // { k0: 0, k1: 1 }
 */
function wide(count) {
	const value = {};
	for (let i = 0; i < count; i++) value[`k${i}`] = i;
	return value;
}

/**
 * The arguments object of a call with the given values.
 * @param {...*} values - The values.
 * @returns {IArguments} The arguments object.
 * @example
 * argumentsOf(1, 2).length; // 2
 */
function argumentsOf(...values) {
	return (function () {
		return arguments;
	})(...values);
}

/**
 * Make a value of the named shape, wrapped in a plain object under `value`.
 * @param {string} kind - The shape.
 * @returns {{value: *}} The value.
 * @example
 * make("list"); // { value: [...] }
 */
export function make(kind) {
	switch (kind) {
		case "generator":
			return {
				value: (function* () {
					yield 1;
					yield 2;
				})()
			};
		case "iterator":
			return { value: [1, 2].values() };
		case "longList":
			return { value: new Array(600).fill(1) };
		case "wide":
			return { value: wide(600) };
		case "wideMap": {
			const map = new Map([["a", 1]]);
			Object.assign(map, wide(600));
			return { value: map };
		}
		case "builtinAccessor":
			return { value: Object.defineProperty({}, "tag", { get: Object.prototype.toString, enumerable: true }) };
		case "intrinsics":
			return { value: { math: Math, proto: Object.prototype, max: Math.max } };
		case "namespace":
			return { value: table };
		case "arguments":
			return { value: argumentsOf(1, 2) };
		case "emitter": {
			const emitter = new EventEmitter();
			emitter.on("ping", () => "pong");
			emitter.label = "emitter";
			return { value: emitter };
		}
		case "stream": {
			const stream = new PassThrough();
			stream.label = "stream";
			return { value: stream };
		}
		case "target": {
			const target = new EventTarget();
			target.label = "target";
			return { value: target };
		}
		case "errorMessage": {
			const error = new Error("text");
			error.message = 5;
			return { value: error };
		}
		case "errorCause":
			return { value: new Error("text", { cause: Symbol.for("uws.cause") }) };
		case "errorName": {
			const error = new Error("text");
			Object.defineProperty(error, "name", { get: Object.prototype.toString, configurable: true });
			return { value: error };
		}
		case "errorPrototype":
			return { value: Object.setPrototypeOf(new Error("text"), Object.prototype) };
		case "mapSet":
			return { value: { map: new Map([["k", { n: 1 }]]), set: new Set([1, "two"]) } };
		case "mapSymbol":
			return { value: { map: new Map([["k", Symbol.for("uws.entry")]]) } };
		case "nestedAccessor":
			return { value: { inner: Object.defineProperty({}, "tag", { get: Object.prototype.toString, enumerable: true }) } };
		case "deepShared":
			return { value: { a: { b: { c: constants } } } };
		default:
			return { value: null };
	}
}
