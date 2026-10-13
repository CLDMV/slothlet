/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_same_name_j/s/a.mjs
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
 * @fileoverview Fixture (#583 review): a sibling file whose member `a` conflicts with the self-named object's `a`
 * @module api_smart_flatten_same_name_j.s.a
 */

/**
 * @returns {string} Marker naming this source.
 */
export function a() {
	return "sibling-a";
}
