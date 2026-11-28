/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_versioned/v1/config.mjs
 *	@Date: 2026-04-01T22:37:31-07:00 (1775108251)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:05-08:00 (1795869005)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * v1 config fixture — returns objects tagged with version: "v1"
 */

/**
 * Get a configuration setting — v1 implementation.
 * @param {string} key - The setting key.
 * @returns {{ value: string|null, version: string, key: string }}
 * @example
 * getSetting("timeout"); // { value: null, version: "v1", key: "timeout" }
 */
export const getSetting = (key) => ({ value: null, version: "v1", key });
