/**
 * Validates user data (named export).
 * Should be accessible as api.validateUser().
 * @function validateUser
 * @public
 * @param {object} user - User object to validate
 * @returns {boolean} True if valid
 */
export function validateUser(user: object): boolean;
/**
 * Formats user for display (named export).
 * Should be accessible as api.formatUser().
 * @function formatUser
 * @public
 * @param {object} user - User object to format
 * @returns {string} Formatted user string
 */
export function formatUser(user: object): string;
export default createUser;
/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_issue/user.mjs
 *	@Date: 2025-10-23 12:24:39 -07:00 (1761247479)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-23 12:30:35 -07:00 (1761247835)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview User management functions for root-level API testing.
 * Root-level default export should flatten but currently breaks with multi-default detection.
 * Expected: api() creates user, api.validateUser(), api.formatUser()
 * Actual bug: api.user() creates user (not flattened)
 */
/**
 * Creates a new user (default export).
 * Should be accessible as api() at root level due to root flattening.
 * @function createUser
 * @public
 * @param {string} name - User name
 * @param {string} email - User email
 * @returns {object} User object
 */
declare function createUser(name: string, email: string): object;
//# sourceMappingURL=user.d.mts.map