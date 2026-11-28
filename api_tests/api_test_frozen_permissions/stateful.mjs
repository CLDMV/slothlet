/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_frozen_permissions/stateful.mjs
 *	@Date: 2026-10-13T02:23:23-07:00 (1791883403)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:04-08:00 (1795868884)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: an array member whose element 0 is a getter answering an object on its first read and a string after.
 * @module api_test_frozen_permissions.stateful
 */

/** @type {boolean} Whether the getter has not run yet. */
let first = true;

/** @type {unknown[]} The array member. */
export const flip = [];
Object.defineProperty(flip, 0, {
	get: () => {
		if (!first) return "SECRET";
		first = false;
		return {};
	},
	enumerable: true,
	configurable: true
});
