/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_versioned/callers/v1-caller.mjs
 *	@Date: 2026-04-01 22:38:36 -07:00 (1775108316)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:25 -07:00 (1775108905)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * v1 caller fixture — calls the auth dispatcher as a v1-versioned module.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call auth.login through the dispatcher.
 * @param {string} user - The username.
 * @returns {*} Result of auth.login.
 * @example
 * callLogin("alice"); // routes to v1 when this module has v1 version metadata
 */
export const callLogin = (user) => self.auth.login(user);

/**
 * Call auth.logout through the dispatcher.
 * @returns {*} Result of auth.logout.
 * @example
 * callLogout(); // routes to v1 when this module has v1 version metadata
 */
export const callLogout = () => self.auth.logout();
