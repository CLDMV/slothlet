/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/holder/owner.mjs
 *	@Date: 2026-11-03T08:00:39-08:00 (1793721639)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T01:50:44-08:00 (1793785844)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The holder module, writing its own nested node through `self` before that node has loaded (#653).
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Assign a member on the module's own `deep.inner` node.
 * @param {string} key - The member's name.
 * @param {*} value - Its value.
 * @returns {string} `"done"`, or the code the write was refused with.
 * @example
 * writeOwnInner("byOwner", 1); // "done"
 */
export function writeOwnInner(key, value) {
	try {
		self.holder.deep.inner[key] = value;
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * Close the module's own `deep.inner` node with `Object.freeze`, `Object.seal`, or `Object.preventExtensions`.
 * @param {"freeze"|"seal"|"preventExtensions"} kind - How to close it.
 * @returns {string} `"done"`, or the code it was refused with.
 * @example
 * closeOwnInner("freeze"); // "done"
 */
export function closeOwnInner(kind) {
	try {
		Object[kind](self.holder.deep.inner);
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * Return the module's own `deep.cfg.getterOnly` node, synchronously.
 * @returns {object} The node.
 * @example
 * syncNode().g; // 1
 */
export function syncNode() {
	return self.holder.deep.cfg.getterOnly;
}
