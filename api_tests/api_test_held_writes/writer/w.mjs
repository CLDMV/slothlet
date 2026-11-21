/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_held_writes/writer/w.mjs
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
 * @fileoverview A module that writes to other modules' nodes through `self`, straight or through a reference it took
 * and held. In lazy mode a reference taken before a folder has loaded stands in for the node until it does.
 *
 * @module api_tests/api_test_held_writes/writer/w
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * The node at a dotted path under `self`.
 * @param {string} path - The path.
 * @returns {*} The node, or what stands in for it.
 * @private
 */
const at = (path) => path.split(".").reduce((holder, key) => holder[key], self);

/**
 * Assign a member of a node, reached through `self` at the moment of writing.
 * @param {string} path - The node's path.
 * @param {string} member - The member.
 * @returns {string} "ok", or the refusal's code.
 * @public
 * @example
 * api.writer.w.write("sub", "x"); // "LOOSE_SET_NOT_OWNED"
 */
export function write(path, member) {
	try {
		at(path)[member] = { by: "writer" };
		return "ok";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Take a reference to a node, optionally wait for it, then write a member through it: assigned, defined or deleted.
 * @param {string} path - The node's path.
 * @param {string} member - The member.
 * @param {string} how - "set", "define" or "delete".
 * @param {boolean} wait - Await the reference before writing through it.
 * @returns {Promise<string>} "ok", or the refusal's code.
 * @public
 * @example
 * await api.writer.w.heldWrite("sub", "x", "set", true); // "LOOSE_SET_NOT_OWNED"
 */
export async function heldWrite(path, member, how, wait) {
	const held = at(path);
	if (wait) await held;
	try {
		if (how === "set") held[member] = { by: "writer" };
		else if (how === "define")
			Object.defineProperty(held, member, { value: { by: "writer" }, configurable: true, enumerable: true, writable: true });
		else delete held[member];
		return "ok";
	} catch (error) {
		return error?.code ?? String(error);
	}
}
