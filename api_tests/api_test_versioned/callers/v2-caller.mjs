/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_versioned/callers/v2-caller.mjs
 *	@Date: 2026-04-01 22:38:55 -07:00 (1775108335)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:25 -07:00 (1775108905)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * v2 caller fixture — calls the auth dispatcher as a v2-versioned module.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call auth.login through the dispatcher with username and password (v2 signature).
 * @param {string} user - The username.
 * @param {string} password - The password.
 * @returns {*} Result of auth.login.
 * @example
 * callLogin("alice", "secret"); // routes to v2 when this module has v2 version metadata
 */
export const callLogin = (user, password) => self.auth.login(user, password);

/**
 * Call auth.logout through the dispatcher.
 * @returns {*} Result of auth.logout.
 * @example
 * callLogout(); // routes to v2 when this module has v2 version metadata
 */
export const callLogout = () => self.auth.logout();
