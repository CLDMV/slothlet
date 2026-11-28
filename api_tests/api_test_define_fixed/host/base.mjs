/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_define_fixed/host/base.mjs
 *	@Date: 2026-11-16T05:00:00-08:00 (1794834000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:54-08:00 (1795868874)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The base module's own code, which owns the whole tree: defines members on another module's node.
 * @module api_test_define_fixed/host
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

/**
 * Define a member on `owner.data` read-only and non-configurable in one step.
 * @param {string} key - The member.
 * @param {string} kind - The value's kind.
 * @param {string} how - The route.
 * @returns {*} What the route returned, or `{ threw, typeError }`.
 */
export function onNode(key, kind, how) {
	return fix(self.owner.data, key, kind, how);
}
