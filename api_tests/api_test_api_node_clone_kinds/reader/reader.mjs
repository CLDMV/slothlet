/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_clone_kinds/reader/reader.mjs
 *	@Date: 2026-11-13T00:32:54-08:00 (1794558774)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T07:20:54-08:00 (1794583254)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that clones another module's built-in data objects it reads through `self`.
 * @module api_test_api_node_clone_kinds/reader
 */

import v8 from "node:v8";
import { self } from "@cldmv/slothlet/runtime";
import { shape } from "../shape.mjs";

/**
 * Run a check, answering what it returned or the name of what it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer, or `{ threw }`.
 */
function answer(check) {
	try {
		return check();
	} catch (error) {
		return { threw: error?.name ?? "threw" };
	}
}

/**
 * Clone a value read through `self` with `structuredClone`, and describe the clone.
 * @param {string} module - The module's api name.
 * @param {string} key - The member's key.
 * @returns {*} The clone's description, or `{ threw }`.
 */
export const cloned = (module, key) => answer(() => shape(structuredClone(self[module][key])));

/**
 * Clone a value read through `self` with `v8.serialize`, and describe the copy.
 * @param {string} module - The module's api name.
 * @param {string} key - The member's key.
 * @returns {*} The copy's description, or `{ threw }`.
 */
export const serialized = (module, key) => answer(() => shape(v8.deserialize(v8.serialize(self[module][key])), true));

/**
 * Post a value read through `self` through a channel, and describe what arrives.
 * @param {string} module - The module's api name.
 * @param {string} key - The member's key.
 * @returns {Promise<*>} The message's description, or `{ threw }`.
 */
export const posted = async (module, key) => {
	const { port1, port2 } = new MessageChannel();
	try {
		const received = new Promise((resolve) => port2.once("message", resolve));
		port1.postMessage({ held: self[module][key] });
		return shape((await received).held);
	} catch (error) {
		return { threw: error?.name ?? "threw" };
	} finally {
		port1.close();
		port2.close();
	}
};

/**
 * Clone the owner's map and pair, change the clones, and answer whether they share buffers as the originals do.
 * @returns {{shares: boolean, time: number, one: number}} Whether the pair's clone shares one buffer, and the owner's
 *   own values after the clones were changed.
 */
export const changed = () => {
	const pair = structuredClone(self.owner.pair);
	const map = structuredClone(self.owner.byName);
	const when = structuredClone(self.owner.when);
	map.get("one").n = -1;
	when.setTime(-1);
	return { shares: pair.small.buffer === pair.wide.buffer, time: self.owner.time(), one: self.owner.one() };
};
