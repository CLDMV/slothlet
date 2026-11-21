/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_define_fixed/owner/owner.mjs
 *	@Date: 2026-11-16T05:00:00-08:00 (1794834000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:25:38-08:00 (1794882338)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module defining members on its own node: in one step, or assigned and then locked.
 * @module api_test_define_fixed/owner
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a check, answering what it returned, or the code of what it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer, or `{ threw, typeError }`.
 */
function answer(check) {
	try {
		return check();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw", typeError: error instanceof TypeError };
	}
}

/**
 * A fresh value of a kind.
 * @param {string} kind - `object`, `function` or `primitive`.
 * @returns {*} The value.
 */
const valueOf = (kind) => (kind === "object" ? { v: 1, hidden: "H" } : kind === "function" ? () => "fn" : "P");

/**
 * Define `key` on `node` read-only and non-configurable in one step, by one of the three routes.
 * @param {object} node - The node.
 * @param {string} key - The member.
 * @param {string} kind - The value's kind.
 * @param {string} how - `defineProperty`, `defineProperties` or `reflect`.
 * @returns {*} What the route returned, or `{ threw, typeError }`.
 */
const fix = (node, key, kind, how) =>
	answer(() => {
		const descriptor = { value: valueOf(kind), writable: false, configurable: false, enumerable: true };
		if (how === "defineProperties") return Object.defineProperties(node, { [key]: descriptor }) === node;
		if (how === "reflect") return Reflect.defineProperty(node, key, descriptor);
		return Object.defineProperty(node, key, descriptor) === node;
	});

export const data = { pub: 1 };

/**
 * Define a member on the module's own node read-only and non-configurable in one step.
 * @param {string} key - The member.
 * @param {string} kind - The value's kind.
 * @param {string} how - The route.
 * @returns {*} What the route returned, or `{ threw, typeError }`.
 */
export function define(key, kind, how) {
	return fix(self.owner.data, key, kind, how);
}

/**
 * Assign an object to a member of the module's own node, then lock the member.
 * @param {string} key - The member.
 * @returns {boolean} Whether the lock was defined.
 */
export function assignThenLock(key) {
	self.owner.data[key] = { v: 1, hidden: "H" };
	return Reflect.defineProperty(self.owner.data, key, { writable: false, configurable: false });
}
