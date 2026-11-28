/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_replaced_prototypes/owner.mjs
 *	@Date: 2026-11-17T13:23:01-08:00 (1794950581)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:23-08:00 (1795868963)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Writes context keys as `owner`, the module named as their owner.
 */

import { context } from "@cldmv/slothlet/runtime";

/**
 * Write a context key.
 * @param {string} key - The key.
 * @param {*} value - The value.
 * @returns {*} The key's value after the write.
 */
export const writeContext = (key, value) => {
	context[key] = value;
	return context[key];
};

/**
 * Write a field of an object a context key holds.
 * @param {string} key - The key.
 * @param {string} field - The field.
 * @param {*} value - The value.
 * @returns {*} The field's value after the write.
 */
export const writeNested = (key, field, value) => {
	context[key][field] = value;
	return context[key][field];
};
