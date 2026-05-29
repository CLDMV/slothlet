/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser/auth.mjs
 *	@Date: 2026-05-28 00:00:00 -07:00 (1748419200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-28 07:32:31 -07:00 (1779978751)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Browser-mode test fixture — auth module.
 * @module api_test_browser.auth
 */

/**
 * Simulates a login call.
 * @param {string} user
 * @param {string} pass
 * @returns {{ ok: boolean, user: string }}
 * @example login("alice", "secret"); // { ok: true, user: "alice" }
 */
export function login(user, pass) {
	return { ok: !!pass, user };
}

/**
 * Simulates a logout call.
 * @returns {{ ok: boolean }}
 * @example logout(); // { ok: true }
 */
export function logout() {
	return { ok: true };
}
