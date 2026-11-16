/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser/viewer.mjs
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
 * @fileoverview Browser-mode test fixture: lists, logs and inspects members of `self` as module code does.
 * @module api_test_browser.viewer
 */

import { self } from "@cldmv/slothlet/runtime";

/** The key `util.inspect` reads a hook from, which slothlet's platform shim uses in a browser too. */
const INSPECT = Symbol.for("nodejs.util.inspect.custom");

/**
 * The member of `self` at a dotted path, or `self` itself.
 * @param {string} path - `self`, or a path such as `slothlet.api`.
 * @returns {*} The member.
 */
function at(path) {
	return path === "self" ? self : path.split(".").reduce((node, key) => node[key], self);
}

/**
 * What the module gets listing the member: `Object.keys`, the keys of `Object.entries` and of a spread copy.
 * @param {string} path - The member's path.
 * @returns {{keys: string[]|string, entries: string[]|string, spread: string[]|string}} Each list, or `THROW <code>`.
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
 * Log the member with `console.log`.
 * @param {string} path - The member's path.
 * @returns {string} `logged`, or `THROW <code>`.
 */
export function logged(path) {
	try {
		console.log(at(path));
		return "logged";
	} catch (error) {
		return `THROW ${error?.code ?? error?.name}`;
	}
}

/**
 * Call the member's inspect hook as `util.inspect` would, and give the names of what it shows.
 * @param {string} path - The member's path.
 * @returns {string[]|string|null} The names shown, the type of what it returned, or null with no hook.
 */
export function hooked(path) {
	const node = at(path);
	const hook = node[INSPECT];
	if (typeof hook !== "function") return null;
	const shown = hook.call(node, 2, {}, (value) => value);
	return shown && typeof shown === "object" ? Object.keys(shown) : typeof shown;
}
