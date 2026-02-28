/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_single_root_fn/helper.mjs
 *	@Date: 2026-01-01T00:00:00-08:00
 *	@Author: Test Fixture
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Named export helper functions.
 * @param {string} value - Input value
 * @returns {string} Processed value
 */
export function helperFn(value) {
	return `helper:${value}`;
}

export const meta = { type: "helper" };
