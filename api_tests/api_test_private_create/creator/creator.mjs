/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_create/creator/creator.mjs
 *	@Date: 2026-11-18T18:18:44-08:00 (1795054724)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T18:27:21-08:00 (1795055241)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The module that creates members: on the other module's node (`owned`), and on its own (`creator`),
 * which holds a function, a class, and an instance of it as the other module's does.
 */
import { self } from "@cldmv/slothlet/runtime";
import * as creations from "../../api_test_private_create_lib/creations.mjs";

/**
 * Answer who answered.
 * @returns {string} `"creator"`.
 * @example
 * fn(); // "creator"
 */
export function fn() {
	return "creator";
}

/**
 * A class of the module's.
 */
export class Box {
	/**
	 * Name the box.
	 * @returns {string} `"crate"`.
	 * @example
	 * new Box().label(); // "crate"
	 */
	label() {
		return "crate";
	}
}

/**
 * An instance of the module's class.
 * @type {Box}
 */
export const inst = new Box();

/**
 * The node a creation targets.
 * @param {string} where - `"own"` for the module's own node, `"other"` for the other module's.
 * @returns {object} The node.
 * @example
 * target("own");
 */
function target(where) {
	return where === "own" ? self.creator : self.owned;
}

/**
 * Create a member on a node.
 * @param {string} where - `"own"` or `"other"`.
 * @param {string} how - The creation.
 * @param {string} key - The member name.
 * @returns {string} Its outcome.
 * @example
 * create("other", "set", "__x");
 */
export function create(where, how, key) {
	return creations.create(target(where), how, key);
}

/**
 * Read a member made by a creation on a node.
 * @param {string} where - `"own"` or `"other"`.
 * @param {string} how - The creation.
 * @param {string} key - The member name.
 * @returns {string} What it holds, or the error code.
 * @example
 * read("other", "set", "__x");
 */
export function read(where, how, key) {
	return creations.read(target(where), how, key);
}
