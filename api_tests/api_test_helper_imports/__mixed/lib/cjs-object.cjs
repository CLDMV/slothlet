/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/__mixed/lib/cjs-object.cjs
 *	@Date: 2026-10-02 12:27:51 -07:00 (1790969271)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:38 -07:00 (1791082958)
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
