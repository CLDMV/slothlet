/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_default_value/reader/reader.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794589200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:00:00-08:00 (1794589200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reads another module's error or boxed primitive through `self`. It has no write rights of its own on the modules it reads.
 * @module api_test_api_node_default_value/reader
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a check, answering what it returned, or the code (or name) of what it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer, or `{ threw }`.
 */
function answer(check) {
	try {
		return check();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * What another module's error or boxed primitive answers through `self`: the same questions the test asks the value.
 * @param {string} module - The module's api name.
 * @param {string} key - The node's key.
 * @returns {object} The answers.
 */
export const value = (module, key) => {
	const node = self[module][key];
	const probe = answer(() => [node.toString, node.valueOf, node.message, node.stack].length);
	return {
		keys: answer(() => Object.keys(node)),
		keysAfter: answer(() => (probe, Object.keys(node))),
		spread: answer(() => Object.keys({ ...node })),
		isError: answer(() => node instanceof Error),
		isTypeError: answer(() => node instanceof TypeError),
		isAggregate: answer(() => node instanceof AggregateError),
		isString: answer(() => node instanceof String),
		isNumber: answer(() => node instanceof Number),
		isBoolean: answer(() => node instanceof Boolean),
		message: answer(() => node.message),
		cause: answer(() => JSON.stringify(node.cause)),
		code: answer(() => node.code),
		stack: answer(() => typeof node.stack),
		errors: answer(() => node.errors?.map((error) => error.message)),
		string: answer(() => String(node)),
		template: answer(() => `${node}`),
		plus: answer(() => node + 1),
		valueOf: answer(() => {
			const primitive = node.valueOf();
			return typeof primitive === "object" ? "object" : `${typeof primitive}:${String(primitive)}`;
		}),
		toString: answer(() => node.toString()),
		json: answer(() => JSON.stringify(node)),
		clone: answer(() => {
			const copy = structuredClone(node);
			return `${typeof copy}:${String(copy)}`;
		})
	};
};

/**
 * What a method the module's own subclass defines answers through `self`.
 * @param {string} module - The module's api name.
 * @param {string} key - The node's key.
 * @returns {*} The method's answer, or `{ threw }`.
 */
export const describeOf = (module, key) => answer(() => self[module][key].describe());
