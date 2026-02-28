/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_single_root_fn/root.mjs
 *	@Date: 2026-01-01T00:00:00-08:00
 *	@Author: Test Fixture
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Single root function - acts as the callable API root.
 * @param {string} [input="world"] - Input string
 * @returns {string} Greeting
 */
export default function rootFn(input = "world") {
	return `root:${input}`;
}

export const version = "1.0";
