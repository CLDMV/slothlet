/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_view_mirror_rules/b.mjs
 *	@Date: 2026-11-16T00:29:25-08:00 (1794817765)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:00-08:00 (1794882480)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a module that keeps a node of `store`, reads it every way, and lends a function that
 * reads it to whoever runs it.
 * @module api_test_view_mirror_rules.b
 * @memberof module:api_test_view_mirror_rules
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
 * @memberof module:api_test_view_mirror_rules.b
 * @param {string} name - The member.
 * @returns {string} Its type.
 * @example
 * api.b.keep("frozen"); // "object"
 */
export function keep(name) {
	kept[name] = self.store[name];
	return typeof kept[name];
}

/**
 * Read a kept node every way asked.
 * @function reads
 * @memberof module:api_test_view_mirror_rules.b
 * @param {string} name - The member kept.
 * @param {Array<[string, (string|number)?]>} list - The reads.
 * @returns {Array<*>} What each read gave.
 * @example
 * api.b.reads("frozen", [["get", "hid"]]); // ["S3CRET"]
 */
export function reads(name, list) {
	return readAll(kept[name], list);
}

/**
 * Hand out a function that reads a kept node every way asked.
 * @function lend
 * @memberof module:api_test_view_mirror_rules.b
 * @param {string} name - The member kept.
 * @param {Array<[string, (string|number)?]>} list - The reads.
 * @returns {function(): Array<*>} The function.
 * @example
 * api.a.run(api.b.lend("frozen", [["get", "hid"]]));
 */
export function lend(name, list) {
	return () => readAll(kept[name], list);
}

/**
 * Run a function.
 * @function run
 * @memberof module:api_test_view_mirror_rules.b
 * @param {function(): *} fn - The function.
 * @returns {*} What it returned.
 * @example
 * api.b.run(() => 1); // 1
 */
export function run(fn) {
	return fn();
}

/**
 * Read a kept node every way asked from a timer slothlet does not patch.
 * @function later
 * @memberof module:api_test_view_mirror_rules.b
 * @param {string} name - The member kept.
 * @param {Array<[string, (string|number)?]>} list - The reads.
 * @returns {Promise<Array<*>>} What each read gave.
 * @example
 * await api.b.later("frozen", [["get", "hid"]]); // ["S3CRET"]
 */
export async function later(name, list) {
	const timers = await import("node:timers");
	return new Promise((resolve) => timers.setTimeout(() => resolve(readAll(kept[name], list)), 2));
}

/**
 * The node this module kept, handed to whoever asks.
 * @param {string} name - The store export it kept.
 * @returns {object} The kept node.
 */
export function give(name) {
	return kept[name];
}

/**
 * Make the reads on a node another module handed over.
 * @param {object} node - The node.
 * @param {Array<[string, (string|number)?]>} list - The reads.
 * @returns {Array<*>} The answers.
 */
export function readsOf(node, list) {
	return readAll(node, list);
}
