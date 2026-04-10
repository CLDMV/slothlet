/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_versioned/v2/auth.mjs
 *	@Date: 2026-04-01 22:37:44 -07:00 (1775108264)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:25 -07:00 (1775108905)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * v2 auth fixture — returns objects tagged with version: "v2"
 * Uses different arg counts per function to confirm arg pass-through.
 */

/**
 * Login with username and password — v2 implementation (2 args vs v1's 1 arg).
 * @param {string} user - The username.
 * @param {string} password - The password.
 * @returns {{ ok: boolean, version: string, user: string, authenticated: boolean }}
 * @example
 * login("alice", "secret"); // { ok: true, version: "v2", user: "alice", authenticated: true }
 */
export const login = (user, password) => ({ ok: true, version: "v2", user, authenticated: password !== undefined });

/**
 * Logout — v2 implementation.
 * @returns {{ ok: boolean, version: string, timestamp: number }}
 * @example
 * logout(); // { ok: true, version: "v2", timestamp: 0 }
 */
export const logout = () => ({ ok: true, version: "v2", timestamp: 0 });

/**
 * Create a user — v2 implementation.
 * @param {object} data - User data.
 * @param {object} [options] - Additional options (extra arg vs v1).
 * @returns {{ created: boolean, version: string, data: object, options: object }}
 * @example
 * createUser({ name: "alice" }, { role: "admin" }); // { created: true, version: "v2", ... }
 */
export const createUser = (data, options = {}) => ({ created: true, version: "v2", data, options });
