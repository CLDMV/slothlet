/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_helper_imports_mixed/lib/cjs-object.cjs
 *	@Date: 2026-10-02T12:27:51-07:00 (1790969271)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:14-08:00 (1795868894)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview CommonJS helper exporting a `module.exports = { … }` object literal (#534): its keys
 * must still be importable as named exports by an ESM leaf.
 * @module api_test_helper_imports.mixed.lib.cjsObject
 * @internal
 */
let count = 0;
const label = "object";

/**
 * Increment this module's counter.
 * @returns {number} The counter after incrementing.
 */
function bump() {
	return ++count;
}

module.exports = { bump, label };
