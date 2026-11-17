/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_serialize_tojson/writer/writer.mjs
 *	@Date: 2026-11-15T23:45:00-08:00 (1794815100)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:27:43-08:00 (1794882463)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Serializes another module's data through `self`, now and from a timer through a node it kept.
 * @module api_test_serialize_tojson/writer
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a check, answering what it returned, or the code of what it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer, or `{ threw }`.
 */
function answer(check) {
	try {
		return check();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * The node at a dotted path below `self`.
 * @param {string} path - The path.
 * @returns {*} The node.
 */
const at = (path) => path.split(".").reduce((node, key) => node[key], self);

const kept = {};

/**
 * `JSON.stringify` of the node at a path.
 * @param {string} path - The path.
 * @returns {string|{threw: string}} The JSON text.
 */
export function json(path) {
	return answer(() => JSON.stringify(at(path)));
}

/**
 * `JSON.stringify` of what calling the node's `toJSON` gives.
 * @param {string} path - The path.
 * @returns {string|{threw: string}} The JSON text.
 */
export function called(path) {
	return answer(() => JSON.stringify(at(path).toJSON()));
}

/**
 * Keep the node at a path.
 * @param {string} path - The path.
 * @returns {boolean} `true`.
 */
export function keep(path) {
	kept[path] = at(path);
	return true;
}

/**
 * `JSON.stringify` of a node kept earlier, from a timer.
 * @param {string} path - The path it was kept from.
 * @returns {Promise<string|{threw: string}>} The JSON text.
 */
export function later(path) {
	return new Promise((done) => setTimeout(() => done(answer(() => JSON.stringify(kept[path]))), 0));
}
