/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_versioned/v1/auth.mjs
 *	@Date: 2026-04-01 22:37:23 -07:00 (1775108243)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:25 -07:00 (1775108905)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * v1 auth fixture — returns objects tagged with version: "v1"
 */

/**
 * Login with username — v1 implementation.
 * @param {string} user - The username.
 * @returns {{ ok: boolean, version: string, user: string }}
 * @example
 * login("alice"); // { ok: true, version: "v1", user: "alice" }
 */
export const login = (user) => ({ ok: true, version: "v1", user });

/**
 * Logout — v1 implementation.
 * @returns {{ ok: boolean, version: string }}
 * @example
 * logout(); // { ok: true, version: "v1" }
 */
export const logout = () => ({ ok: true, version: "v1" });

/**
 * Create a user — v1 implementation.
 * @param {object} data - User data.
 * @returns {{ created: boolean, version: string, data: object }}
 * @example
 * createUser({ name: "alice" }); // { created: true, version: "v1", data: { name: "alice" } }
 */
export const createUser = (data) => ({ created: true, version: "v1", data });
