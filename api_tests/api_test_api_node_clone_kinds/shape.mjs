/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_clone_kinds/shape.mjs
 *	@Date: 2026-11-13T00:32:54-08:00 (1794558774)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T07:20:54-08:00 (1794583254)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Describes a clone as plain data, so a clone made through the api and one made of the module's own
 * object can be compared. Not an api file: the reader imports it, and so does the test.
 * @module api_test_api_node_clone_kinds/shape
 */

const TYPED = [
	Int8Array,
	Uint8Array,
	Uint8ClampedArray,
	Int16Array,
	Uint16Array,
	Int32Array,
	Uint32Array,
	Float32Array,
	Float64Array,
	BigInt64Array,
	BigUint64Array
];

/**
 * The name of a value's prototype's constructor, or null.
 * @param {object} value - An object.
 * @returns {string|null} The name.
 */
const protoName = (value) => Object.getPrototypeOf(value)?.constructor?.name ?? null;

/**
 * Describe a value as plain data: its kind, and what it holds.
 * @param {*} value - The value (a clone).
 * @param {boolean} [read=false] - Whether it was read back by `v8.deserialize`, which places a typed array inside the
 *   buffer it read the whole message from: where in a buffer an array starts is then left out.
 * @returns {*} Its description.
 */
export function shape(value, read = false) {
	const inner = (member) => shape(member, read);
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return typeof value === "bigint" ? `${value}n` : value;
	if (typeof value === "function") return { function: true };
	if (value instanceof Error) {
		return {
			error: protoName(value),
			own: Object.getOwnPropertyNames(value).sort(),
			name: value.name,
			message: value.message,
			stack: typeof value.stack === "string" ? value.stack.split("\n")[0] : typeof value.stack,
			cause: "cause" in value ? inner(value.cause) : "none"
		};
	}
	if (value instanceof Date) return { date: value.getTime() };
	if (value instanceof RegExp) return { regexp: value.source, flags: value.flags, lastIndex: value.lastIndex };
	if (value instanceof Map) return { map: [...value].map(([key, member]) => [inner(key), inner(member)]) };
	if (value instanceof Set) return { set: [...value].map(inner) };
	if (value instanceof ArrayBuffer) {
		return { buffer: [...new Uint8Array(value)], resizable: value.resizable, max: value.maxByteLength };
	}
	if (typeof SharedArrayBuffer === "function" && value instanceof SharedArrayBuffer) return { shared: [...new Uint8Array(value)] };
	if (value instanceof DataView) {
		if (read) return { dataview: true, byteLength: value.byteLength };
		return { dataview: value.byteOffset, byteLength: value.byteLength, bufferLength: value.buffer.byteLength };
	}
	if (TYPED.some((kind) => value instanceof kind)) {
		const values = [...value].map(inner);
		if (read) return { typed: protoName(value), length: value.length, values };
		return { typed: protoName(value), offset: value.byteOffset, length: value.length, bufferLength: value.buffer.byteLength, values };
	}
	for (const kind of [String, Number, Boolean]) if (value instanceof kind) return { boxed: kind.name, value: value.valueOf() };
	if (Array.isArray(value)) return value.map(inner);
	return { proto: protoName(value), entries: Object.entries(value).map(([key, member]) => [key, inner(member)]) };
}
