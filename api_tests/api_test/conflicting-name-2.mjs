/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/conflicting-name-2.mjs
 *	@Date: 2026-02-16T17:50:31-08:00 (1771293031)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:16:58 -08:00 (1772425018)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Second file in conflicting-name collision test — loaded second, overwrites first.
 * @module api_test.conflictingName2
 * @memberof module:api_test
 */
/**
 * @namespace conflictingName2
 * @memberof module:api_test
 */

/**
	* Named export attempting to overwrite the one from file 1
	* @returns {string} Version identifier
	*/
export function conflictingName() {
	return "from-file-2";
}

