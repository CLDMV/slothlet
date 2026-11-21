/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_create/owned/owned.mjs
 *	@Date: 2026-11-18T18:18:38-08:00 (1795054718)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T21:57:34-08:00 (1795067854)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The module whose node another module tries to create members on: a function, a class, an instance of
 * it, and a module-private value of its own.
 */
import { self } from "@cldmv/slothlet/runtime";
import * as creations from "../../api_test_private_create_lib/creations.mjs";

/**
 * Answer who answered.
 * @returns {string} `"owned"`.
 * @example
 * fn(); // "owned"
 */
export function fn() {
	return "owned";
}

/**
 * A class of the module's.
 */
export class Box {
	/**
	 * Name the box.
	 * @returns {string} `"box"`.
	 * @example
	 * new Box().label(); // "box"
	 */
	label() {
		return "box";
	}
}

/**
 * An instance of the module's class.
 * @type {Box}
 */
export const inst = new Box();

/**
 * Module-private values held on the prototype of the module's class, as members an instance inherits.
 */
Box.prototype.__hidden = 1;
Box.prototype._hidden = 1;

/**
 * Module-private values held as the module's function's own properties.
 */
fn.__tag = 1;
fn._tag = 1;

/**
 * A module-private value.
 * @type {number}
 */
export const __secret = 1;

/**
 * A module-private value, by the single-underscore form.
 * @type {number}
 */
export const _secret = 1;

/**
 * Create a member on the module's own node.
 * @param {string} how - The creation.
 * @param {string} key - The member name.
 * @returns {string} Its outcome.
 * @example
 * create("set", "__mine");
 */
export function create(how, key) {
	return creations.create(self.owned, how, key);
}

/**
 * Read a member made by a creation on the module's own node.
 * @param {string} how - The creation.
 * @param {string} key - The member name.
 * @returns {string} What it holds, or the error code.
 * @example
 * read("set", "__mine");
 */
export function read(how, key) {
	return creations.read(self.owned, how, key);
}

/**
 * List what the prototype of the module's class lists and describes of its own members.
 * @param {string} route - The route to the prototype.
 * @param {string[]} names - The members whose descriptors are described.
 * @returns {string} The listing, or the error code.
 * @example
 * list("classPrototype", ["__hidden"]);
 */
export function list(route, names) {
	return creations.list(self.owned, route, names);
}
