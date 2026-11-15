/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_slothlet_namespace_view/reader/reader.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Lists, reads and inspects a member of `self.slothlet` as module code does.
 * @module api_test_slothlet_namespace_view/reader/reader
 */

import { self } from "@cldmv/slothlet/runtime";
import util from "node:util";

/**
 * The member of `self` at a dotted path, or `self` itself.
 * @param {string} path - `self`, or a path (`slothlet.env`).
 * @returns {*} The member.
 */
function at(path) {
	return path === "self" ? self : path.split(".").reduce((node, key) => node[key], self);
}

/**
 * Whether the module may read the member at all.
 * @param {string} path - The member's path.
 * @returns {boolean} True when reading it does not throw.
 */
export function reaches(path) {
	try {
		at(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * What the module's code gets listing the member: `Object.keys`, the keys of `Object.entries` and of a spread copy.
 * @param {string} path - The member's path.
 * @returns {{keys: string[]|string, entries: string[]|string, spread: string[]|string}} Each list, or the code of what it threw.
 */
export function list(path) {
	const node = at(path);
	const out = {};
	for (const [name, take] of [
		["keys", () => Object.keys(node)],
		["entries", () => Object.entries(node).map(([key]) => key)],
		["spread", () => Object.keys({ ...node })]
	]) {
		try {
			out[name] = take();
		} catch (error) {
			out[name] = `THROW ${error?.code ?? error?.name}`;
		}
	}
	return out;
}

/**
 * The names among `keys` the module may read on the member.
 * @param {string} path - The member's path.
 * @param {string[]} keys - The names to try.
 * @returns {string[]} The ones whose read does not throw.
 */
export function readable(path, keys) {
	const node = at(path);
	return keys.filter((key) => {
		try {
			node[key];
			return true;
		} catch {
			return false;
		}
	});
}

/**
 * What `util.inspect` shows the module of the member.
 * @param {string} path - The member's path.
 * @param {object} options - The inspect options.
 * @returns {string} The text, or `THROW <code>`.
 */
export function shown(path, options) {
	try {
		return util.inspect(at(path), options);
	} catch (error) {
		return `THROW ${error?.code ?? error?.name}`;
	}
}
