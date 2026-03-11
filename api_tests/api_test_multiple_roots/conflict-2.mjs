/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multiple_roots/conflict-2.mjs
 *	@Date: 2026-01-23T17:35:04-08:00 (1769218504)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:15 -08:00 (1772425275)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Second conflicting default export for api_test_multiple_roots testing.
 * @module api_test_multiple_roots.conflict2
 * @memberof module:api_test_multiple_roots
 */

export default function conflictingName() {
	return "from-file-2";
}

export function rootFunctionShout(name) {
	return `HELLO 2, ${name.toUpperCase()}!`;
}

