/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_versioned/v2/config.mjs
 *	@Date: 2026-04-01 22:37:51 -07:00 (1775108271)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:25 -07:00 (1775108905)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * v2 config fixture — returns objects tagged with version: "v2"
 */

/**
 * Get a configuration setting — v2 implementation.
 * @param {string} key - The setting key.
 * @param {*} [defaultValue] - Default value if setting not found (extra arg vs v1).
 * @returns {{ value: *, version: string, key: string }}
 * @example
 * getSetting("timeout", 30); // { value: 30, version: "v2", key: "timeout" }
 */
export const getSetting = (key, defaultValue = null) => ({ value: defaultValue, version: "v2", key });
