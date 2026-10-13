/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_same_name_j/s/s.mjs
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
 * @fileoverview Fixture (#583 review): a self-named file exporting a single named object whose `a` conflicts with a sibling
 * @module api_smart_flatten_same_name_j.s.s
 */

/** @type {{a: () => string, b: () => string}} */
export const s = {
	/**
	 * @returns {string} Marker naming this source.
	 */
	a() {
		return "object-a";
	},
	/**
	 * @returns {string} Marker naming this source.
	 */
	b() {
		return "object-b";
	}
};
