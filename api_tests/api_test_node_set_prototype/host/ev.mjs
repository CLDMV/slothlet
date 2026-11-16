/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_node_set_prototype/host/ev.mjs
 *	@Date: 2026-11-15T11:54:55-08:00 (1794772495)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T20:55:15-08:00 (1794804915)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Values a module holds as they are (an emitter, a class instance), and code that changes their
 * prototypes through `self`.
 * @module api_test_node_set_prototype/host/ev
 */

import { EventEmitter } from "node:events";
import { self } from "@cldmv/slothlet/runtime";

/** @type {EventEmitter} */
export const em = new EventEmitter();

/**
 * A class of the module's.
 */
class Kind {
	/**
	 * A method.
	 * @returns {number} One.
	 */
	one() {
		return 1;
	}
}

/** @type {Kind} */
export const inst = new Kind();

/**
 * The prototypes of the module's own values.
 * @returns {{em: object, inst: object}} Them.
 */
export function prototypes() {
	return { em: Object.getPrototypeOf(em), inst: Object.getPrototypeOf(inst) };
}

/**
 * Give a node this module owns a prototype through `self`.
 * @param {string} which - `"em"`, `"inst"`, `"leaf"` (the base's function leaf), `"grp"` (the base's folder function),
 *   `"lay"` (the base's function with named exports) or `"ns"` (this file's own namespace).
 * @param {object} prototype - The prototype.
 * @returns {string} `"done"`, `"refused"` when it answered false, or the code or name of what it threw.
 */
export function change(which, prototype) {
	const nodes = {
		em: () => self.ev.em,
		inst: () => self.ev.inst,
		leaf: () => self.leaf.only,
		grp: () => self.grp,
		lay: () => self.sub.lay,
		ns: () => self.ev
	};
	try {
		return Reflect.setPrototypeOf(nodes[which](), prototype) ? "done" : "refused";
	} catch (error) {
		return error?.code ?? error?.name ?? "threw";
	}
}

/**
 * Read a member through this file's own namespace node, as the module that owns it.
 * @param {string} name - The member's name.
 * @returns {*} The member, or `{ threw: code }` when the read was refused.
 */
export function read(name) {
	try {
		return self.ev[name];
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}
