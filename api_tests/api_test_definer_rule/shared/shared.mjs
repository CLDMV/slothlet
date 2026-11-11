/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_definer_rule/shared/shared.mjs
 *	@Date: 2026-11-08T19:11:03-08:00 (1794193863)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T19:17:27-08:00 (1794194247)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for the definer rule (#726): keeps a function and hands it back.
 * @module api_test_definer_rule.shared
 */
let kept = null;
export const keep = (fn) => {
	kept = fn;
};
export const take = () => kept;
