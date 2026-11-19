/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_prototype_nodes/reader/reader.mjs
 *	@Date: 2026-11-18T21:27:37-08:00 (1795066057)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T21:57:36-08:00 (1795067856)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module reading another module's class prototype through `self`, by every route.
 * @module api_test_prototype_nodes/reader
 */
import { self } from "@cldmv/slothlet/runtime";
import * as probes from "../../api_test_prototype_nodes_lib/probes.mjs";

/**
 * How the owner's prototype reads through `self`.
 * @returns {object} The answers.
 */
export function shape() {
	return probes.shape(self.owner);
}

/**
 * Whether the owner's prototype is one object by every route through `self`.
 * @returns {object} The answers.
 */
export function identity() {
	return probes.identity(self.owner);
}

/**
 * What this module reads of the owner's prototype's private members through `self`.
 * @returns {object} The answers.
 */
export function privacy() {
	return probes.privacy(self.owner);
}

/**
 * Write onto the owner's prototype through `self`.
 * @param {string} route - The route.
 * @param {string} how - The write.
 * @param {string} key - The member.
 * @returns {string} The outcome.
 */
export function write(route, how, key) {
	return probes.write(self.owner, route, how, key);
}

/**
 * Write onto the owner's prototype read through `self` at `name`.
 * @param {string} name - `"Box"` or `"Alias"`.
 * @param {string} key - The member.
 * @returns {string} The outcome.
 */
export function writeAt(name, key) {
	return probes.attempt(() => {
		self.owner[name].prototype[key] = 1;
		return "done";
	});
}

/**
 * Whether the prototype the owner hands this module is the one this module reads through `self`, at each name.
 * @returns {object} The answers.
 */
export function sameAsOwner() {
	return {
		Box: self.owner.prototypeAt("Box") === self.owner.Box.prototype,
		Alias: self.owner.prototypeAt("Alias") === self.owner.Alias.prototype
	};
}
