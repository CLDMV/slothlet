/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_builtin_names/base/probe/probe.mjs
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
 * @fileoverview Module code that reads functions' `name` and `length` through `self`, and logs and inspects `self`, as
 * a console or formatter does.
 * @module api_test_function_builtin_names.probe
 */

import util from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/**
 * The member of `self` at a dotted path, or `self` itself.
 * @param {string} path - `""` for `self`, or a path such as `math.add`.
 * @returns {*} The member.
 */
function at(path) {
	return path === "" ? self : path.split(".").reduce((node, key) => node[key], self);
}

/**
 * Run a read, answering what it gave or the code it threw.
 * @param {Function} take - The read.
 * @returns {*} The value, or `"THROW <code>"`.
 */
function attempt(take) {
	try {
		return take();
	} catch (error) {
		return `THROW ${error?.code ?? error?.name}`;
	}
}

/**
 * Read one member of the function at `path` by three routes: a dot read, `Reflect.get` and its own descriptor.
 * @param {string} path - The function's path under `self`.
 * @param {string} key - The member, `name` or `length`.
 * @returns {{held: string, dot: *, reflect: *, descriptor: *}} The type of what reading the function itself gave, and
 *   what each route gave.
 * @example
 * api.probe.read("math.add", "name"); // { held: "function", dot: "add", reflect: "add", descriptor: "add" }
 */
export function read(path, key) {
	return {
		held: attempt(() => typeof at(path)),
		dot: attempt(() => at(path)[key]),
		reflect: attempt(() => Reflect.get(at(path), key)),
		descriptor: attempt(() => Reflect.getOwnPropertyDescriptor(at(path), key)?.value)
	};
}

/**
 * `Object.keys` of a member of `self`, as a formatter lists an object's members before reading them.
 * @param {string} path - The member's path.
 * @returns {string[]|string} The keys, or `"THROW <code>"`.
 * @example
 * api.probe.listed("slothlet"); // ["version", "api", …]
 */
export function listed(path) {
	return attempt(() => Object.keys(at(path)));
}

/**
 * `util.inspect` of `self` (or a member), as Node's console formats it.
 * @param {string} [path=""] - The member's path.
 * @returns {string} The text, or `"THROW <code>"`.
 * @example
 * api.probe.inspected(); // "[Function: …] { … }"
 */
export function inspected(path = "") {
	return attempt(() => util.inspect(at(path), { depth: 6 }));
}

/**
 * `console.log` of `self` (or a member).
 * @param {string} [path=""] - The member's path.
 * @returns {string} `"logged"`, or `"THROW <code>"`.
 * @example
 * api.probe.logged(); // "logged"
 */
export function logged(path = "") {
	return attempt(() => {
		console.log(at(path));
		return "logged";
	});
}

/**
 * Read every function's `name` and `length` under a member of `self`, walking its listed members as a page-side
 * formatter does. A member whose listing or read is refused is not walked into.
 * @param {string} path - The member's path.
 * @param {number} [depth=3] - How deep to walk.
 * @returns {string[]} `"<path> <name>/<length>"` per function, or `"<path> THROW <code>"` when reading them threw.
 * @example
 * api.probe.formatted("math"); // ["math.add add/2", "math.helpers.twice twice/1"]
 */
export function formatted(path, depth = 3) {
	const out = [];
	const walk = (value, where, left) => {
		if (typeof value === "function") {
			out.push(`${where} ${attempt(() => `${value.name}/${value.length}`)}`);
		}
		if (left === 0 || value === null || (typeof value !== "object" && typeof value !== "function")) return;
		let keys;
		try {
			keys = Object.keys(value);
		} catch {
			return;
		}
		for (const key of keys) {
			let member;
			try {
				member = value[key];
			} catch {
				continue;
			}
			walk(member, where === "" ? key : `${where}.${key}`, left - 1);
		}
	};
	walk(at(path), path, depth);
	return out;
}
