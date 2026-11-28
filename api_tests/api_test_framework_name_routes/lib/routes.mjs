/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_framework_name_routes/lib/routes.mjs
 *	@Date: 2026-11-25T14:57:07-08:00 (1795647427)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:01-08:00 (1795868881)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The routes that can give a value a member: each takes the value, the member's name and its value.
 * @module api_test_framework_name_routes.lib.routes
 */

/**
 * Each route, by name.
 * @type {Record<string, function(object, string, Function): *>}
 */
export const ROUTES = {
	set: (node, name, value) => {
		node[name] = value;
	},
	define: (node, name, value) => Object.defineProperty(node, name, { value, writable: true, enumerable: true, configurable: true }),
	reflectDefine: (node, name, value) => Reflect.defineProperty(node, name, { value, writable: true, enumerable: true, configurable: true }),
	prototype: (node, name, value) => Object.setPrototypeOf(node, { [name]: value })
};

/**
 * Run one route, answering what it did.
 * @param {string} route - One of {@link ROUTES}.
 * @param {object} node - What it writes to.
 * @param {string} name - The member's name.
 * @param {Function} value - The member's value.
 * @returns {string} "done", or "THREW:" and the code (or class) of what was thrown.
 */
export function runRoute(route, node, name, value) {
	try {
		ROUTES[route](node, name, value);
		return "done";
	} catch (error) {
		return `THREW:${error.code ?? error.constructor.name}`;
	}
}
