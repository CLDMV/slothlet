/**
 * @fileoverview Fixture: a module that keeps a node of `store`, reads it every way, and lends a function that
 * reads it to whoever runs it.
 * @module api_test_view_mirror_order.a
 * @memberof module:api_test_view_mirror_order
 */
import { self } from "@cldmv/slothlet/runtime";

/** @type {Record<string, function(object, (string|number)=): *>} Each way a node is read. */
const READS = {
	extensible: (node) => Object.isExtensible(node),
	keys: (node) => Object.keys(node),
	names: (node) => Object.getOwnPropertyNames(node),
	has: (node, key) => key in node,
	get: (node, key) => node[key],
	describe: (node, key) => Object.getOwnPropertyDescriptor(node, key),
	below: (node, key) => node[key].k,
	belowDescribed: (node, key) => Object.getOwnPropertyDescriptor(node, key).value.k,
	json: (node) => JSON.parse(JSON.stringify(node))
};

/**
 * Make each read of a node, reporting what it gave or the code it threw.
 * @param {object} node - The node.
 * @param {Array<[string, (string|number)?]>} reads - The reads, each with the key it reads.
 * @returns {Array<*>} What each read gave.
 */
function readAll(node, reads) {
	return reads.map(([read, key]) => {
		try {
			return JSON.parse(JSON.stringify(READS[read](node, key) ?? null));
		} catch (error) {
			return error.code ?? `${error.name}: ${error.message}`;
		}
	});
}

/** @type {Record<string, object>} The nodes kept. */
const kept = {};

/**
 * Keep a member of `store`.
 * @function keep
 * @memberof module:api_test_view_mirror_order.a
 * @param {string} name - The member.
 * @returns {string} Its type.
 * @example
 * api.a.keep("frozen"); // "object"
 */
export function keep(name) {
	kept[name] = self.store[name];
	return typeof kept[name];
}

/**
 * Read a kept node every way asked.
 * @function reads
 * @memberof module:api_test_view_mirror_order.a
 * @param {string} name - The member kept.
 * @param {Array<[string, (string|number)?]>} list - The reads.
 * @returns {Array<*>} What each read gave.
 * @example
 * api.a.reads("frozen", [["get", "hid"]]); // ["S3CRET"]
 */
export function reads(name, list) {
	return readAll(kept[name], list);
}

/**
 * Hand out a function that reads a kept node every way asked.
 * @function lend
 * @memberof module:api_test_view_mirror_order.a
 * @param {string} name - The member kept.
 * @param {Array<[string, (string|number)?]>} list - The reads.
 * @returns {function(): Array<*>} The function.
 * @example
 * api.b.run(api.a.lend("frozen", [["get", "hid"]]));
 */
export function lend(name, list) {
	return () => readAll(kept[name], list);
}

/**
 * Run a function.
 * @function run
 * @memberof module:api_test_view_mirror_order.a
 * @param {function(): *} fn - The function.
 * @returns {*} What it returned.
 * @example
 * api.a.run(() => 1); // 1
 */
export function run(fn) {
	return fn();
}

/**
 * Read a kept node every way asked from a timer slothlet does not patch.
 * @function later
 * @memberof module:api_test_view_mirror_order.a
 * @param {string} name - The member kept.
 * @param {Array<[string, (string|number)?]>} list - The reads.
 * @returns {Promise<Array<*>>} What each read gave.
 * @example
 * await api.a.later("frozen", [["get", "hid"]]); // ["S3CRET"]
 */
export async function later(name, list) {
	const timers = await import("node:timers");
	return new Promise((resolve) => timers.setTimeout(() => resolve(readAll(kept[name], list)), 2));
}
