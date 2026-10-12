/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_primitive_default/falsy/nothing.mjs
 *	@Date: 2026-10-11T21:30:00-07:00 (1791786600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T21:30:00-07:00 (1791786600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a default of `null` beside a named export, which a truthiness check took for no default.
 * @module smart_flatten.api_smart_flatten_primitive_default.falsy.nothing
 */

export default null;

/**
 * @returns {string} Marker naming this named export.
 */
export const label = () => "falsy.nothing.label";
