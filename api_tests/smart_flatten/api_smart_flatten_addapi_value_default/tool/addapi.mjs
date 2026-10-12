/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_addapi_value_default/tool/addapi.mjs
 *	@Date: 2026-10-11T20:30:00-07:00 (1791783000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T20:30:00-07:00 (1791783000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): an addapi file whose default is a function, beside a sibling.
 * @module api_smart_flatten_addapi_value_default.tool.addapi
 */

/**
 * @param {number} x - Any value.
 * @returns {string} Marker naming the default and its argument.
 */
export default function main(x) {
	return `tool:${x}`;
}

/**
 * @returns {string} Marker naming this named export.
 */
export const extra = () => "tool.extra";
