/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_reject_reserved_folder/session/-____impl/set.mjs
 *	@Date: 2026-10-07T00:00:00-07:00 (1791356400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:17-08:00 (1795868957)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#571): a folder named for a framework-reserved key, refused by the directory scan.
 * @module api_test_reject_reserved_folder.session.____impl.set
 */

/**
 * @returns {string} Marker naming this leaf.
 */
export function set() {
	return "session.____impl.set";
}
