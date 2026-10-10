/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reject_reserved_folder/session/_impl/set.mjs
 *	@Date: 2026-10-07T00:00:00-07:00 (1791356400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-07T00:00:00-07:00 (1791356400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#571): a folder named for a framework-reserved key, refused by the directory scan.
 * @module api_test_reject_reserved_folder.session._impl.set
 */

/**
 * @returns {string} Marker naming this leaf.
 */
export function set() {
	return "session._impl.set";
}
