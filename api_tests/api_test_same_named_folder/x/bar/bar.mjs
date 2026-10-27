/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_same_named_folder/x/bar/bar.mjs
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
 * @fileoverview Fixture (#581): a folder whose only entry is a same-named file; it flattens (`x.bar`).
 * @module api_test_same_named_folder.x.bar
 */

/**
 * @returns {string} Marker naming this leaf.
 */
export default function bar() {
	return "x.bar";
}
