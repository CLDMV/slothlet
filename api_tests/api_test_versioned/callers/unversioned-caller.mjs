/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_versioned/callers/unversioned-caller.mjs
 *	@Date: 2026-04-01 22:39:13 -07:00 (1775108353)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 22:48:25 -07:00 (1775108905)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Unversioned caller fixture — calls the auth dispatcher with no version context.
 * Falls back to the default version during routing.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call auth.login through the dispatcher with no version context.
 * @param {string} user - The username.
 * @returns {*} Result of auth.login (routed to default version).
 * @example
 * callLogin("alice"); // routes to default version
 */
export const callLogin = (user) => self.auth.login(user);

/**
 * Call auth.logout through the dispatcher with no version context.
 * @returns {*} Result of auth.logout (routed to default version).
 * @example
 * callLogout(); // routes to default version
 */
export const callLogout = () => self.auth.logout();
