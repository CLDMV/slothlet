/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_node_set_prototype/host/leaf.mjs
 *	@Date: 2026-11-15T11:54:55-08:00 (1794772495)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:59-08:00 (1795868939)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A function leaf, and what its module sees of it.
 * @module api_test_node_set_prototype/host/leaf
 */

/**
 * A function leaf.
 * @returns {string} Its name.
 */
export function only() {
	return "only";
}

/**
 * Whether the module's own function still has the engine's prototype.
 * @returns {boolean} The answer.
 */
export function untouched() {
	return Object.getPrototypeOf(only) === Function.prototype;
}
