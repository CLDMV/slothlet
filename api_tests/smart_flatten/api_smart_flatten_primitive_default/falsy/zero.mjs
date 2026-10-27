/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_primitive_default/falsy/zero.mjs
 *	@Date: 2026-10-11T20:17:02-07:00 (1791775022)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T22:03:15-07:00 (1791781395)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a default of `0` beside a named export, which a truthiness check took for no default.
 * @module smart_flatten.api_smart_flatten_primitive_default.falsy.zero
 */

export default 0;

/**
 * @returns {string} Marker naming this named export.
 */
export const label = () => "falsy.zero.label";
