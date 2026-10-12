/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_function_default_layer/box/box.mjs
 *	@Date: 2026-10-11T19:30:00-07:00 (1791779400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T19:30:00-07:00 (1791779400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a function default with its own member and a named export. The
 * module's function is recorded on `globalThis` so a test can check the build never wrote to it.
 * @module api_smart_flatten_function_default_layer.box.box
 */

/**
 * @param {number} x - Any value.
 * @returns {string} Marker naming this default and its argument.
 */
function main(x) {
	return "box:" + x;
}
main.own = 1;
(globalThis.__slothletFunctionDefaultLayer ??= {}).box = main;

export default main;

/**
 * @returns {string} Marker naming this named export.
 */
export const extra = () => "box.extra";
