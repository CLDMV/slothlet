/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_same_named_folder/x/foo/foo/get.mjs
 *	@Date: 2026-10-08T00:00:00-07:00 (1791442800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-08T00:00:00-07:00 (1791442800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#581): a folder whose only entry is a same-named folder; it stays nested (`x.foo.foo`).
 * @module api_test_same_named_folder.x.foo.foo.get
 */

/**
 * @returns {string} Marker naming this leaf.
 */
export function get() {
	return "x.foo.foo.get";
}
