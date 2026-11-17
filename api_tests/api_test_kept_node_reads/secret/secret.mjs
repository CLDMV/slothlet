/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_kept_node_reads/secret/secret.mjs
 *	@Date: 2026-11-16T00:13:19-08:00 (1794816799)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:24:47-08:00 (1794882287)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Data another module keeps references into: top-level values, nested objects, closed objects, an object
 * whose methods hand back their own receiver, and an object the module defines members holding objects on at runtime.
 * @module api_test_kept_node_reads/secret
 */

import { self } from "@cldmv/slothlet/runtime";

export const hidden = "TOP";
export const pub = "PUB";
export const data = { pub: 1, hidden: "H", cfg: { pub: 1, hidden: "H" } };
export const box = Object.freeze({ pub: 1, hidden: "H" });
export const closed = Object.preventExtensions({ pub: 1, hidden: "H" });
export const obj = {
	name: "o",
	/**
	 * The receiver, nested in an object.
	 * @returns {{me: object}} `{ me: this }`.
	 */
	whoami() {
		return { me: this };
	},
	/**
	 * The receiver.
	 * @returns {object} `this`.
	 */
	itself() {
		return this;
	}
};
export const holder = { pub: 1 };

/**
 * Define a member holding an object on the module's own node, as the module may.
 * @param {string} key - The member's name.
 * @param {{writable: boolean, configurable: boolean}} attributes - The member's attributes.
 * @returns {boolean} Whether it was defined.
 */
export function define(key, { writable, configurable }) {
	return Reflect.defineProperty(self.secret.holder, key, { value: { v: 1, hidden: "H" }, writable, configurable, enumerable: true });
}

/**
 * Change a member of the object a defined member holds, as its module.
 * @param {string} key - The defined member's name.
 * @param {number} v - The new value.
 * @returns {number} What the member reads afterwards.
 */
export function change(key, v) {
	self.secret.holder[key].v = v;
	return self.secret.holder[key].v;
}
