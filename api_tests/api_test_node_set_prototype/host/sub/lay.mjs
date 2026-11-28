/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_node_set_prototype/host/sub/lay.mjs
 *	@Date: 2026-11-15T11:54:55-08:00 (1794772495)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:00-08:00 (1795868940)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A default function with named exports beside it, so its node is a function over a layer.
 * @module api_test_node_set_prototype/host/sub/lay
 */

/**
 * The file's function.
 * @returns {string} Its name.
 */
export default function lay() {
	return "lay";
}

/** @type {number} */
export const side = 1;

/**
 * Whether the module's own function still has the engine's prototype.
 * @returns {boolean} The answer.
 */
export function untouched() {
	return Object.getPrototypeOf(lay) === Function.prototype;
}
