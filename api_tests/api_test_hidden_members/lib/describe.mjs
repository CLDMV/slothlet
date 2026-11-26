/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_hidden_members/lib/describe.mjs
 *	@Date: 2026-11-25T02:33:27-08:00 (1795602807)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:59:39-08:00 (1795604379)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Describe an object the way ordinary code sees its own members. Used by the reader module and by the
 * test's plain-JS twin alike, so both answer through the same code.
 * @module api_test_hidden_members/lib/describe
 */

/**
 * What enumeration, JSON and descriptors report for an object, and what its listed members read as.
 * @param {object} value - The object.
 * @param {string[]} names - The members to read and describe.
 * @returns {object} The description.
 */
export function describe(value, names) {
	const forIn = [];
	for (const key in value) forIn.push(key);
	return {
		keys: Object.keys(value),
		forIn,
		json: JSON.stringify(value),
		spread: Object.keys({ ...value }),
		entries: JSON.stringify(Object.entries(value)),
		enumerable: names.map((name) => Object.getOwnPropertyDescriptor(value, name)?.enumerable),
		propertyIsEnumerable: names.map((name) => Object.prototype.propertyIsEnumerable.call(value, name)),
		has: names.map((name) => name in value),
		read: names.map((name) => JSON.stringify(value[name]))
	};
}
