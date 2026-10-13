/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_value_default/bag/addapi.mjs
 *	@Date: 2026-10-11T20:03:02-07:00 (1791774182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T22:03:05-07:00 (1791781385)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): an addapi file whose default is a Map, with a named export.
 * @module api_smart_flatten_addapi_value_default.bag.addapi
 */

export default new Map([["a", 1]]);

/**
 * @returns {string} Marker naming this named export.
 */
export const extra = () => "bag.extra";
