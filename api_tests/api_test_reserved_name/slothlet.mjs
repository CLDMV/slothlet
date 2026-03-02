/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reserved_name/slothlet.mjs
 *	@Date: 2026-03-01 19:00:00 -08:00 (1772416800)
 *	@Author: Nate Hyson <CLDMV>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Fixture for testing the reserved name "slothlet" warning.
 * When this file is loaded, slothlet will emit WARNING_RESERVED_PROPERTY_CONFLICT.
 */

/**
 * A stub function — the filename "slothlet" conflicts with the reserved namespace.
 * @returns {string} A simple string.
 * @example
 * slothlet.slothlet.greet(); // "hello"
 */
export function greet() {
	return "hello";
}
