/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_issue/user.mjs
 *	@Date: 2025-10-23T13:13:39-07:00 (1761250419)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:16 -08:00 (1772425276)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview User API module for api_test_root_issue testing.
 * @module api_test_root_issue.user
 * @memberof module:api_test_root_issue
 */
/**
 * @namespace user
 * @memberof module:api_test_root_issue
 * @alias module:api_test_root_issue.user
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
function createUser(name, email) {
	return { id: Math.random(), name, email, created: new Date() };
}

/**
 * Validates user data (named export).
 * Should be accessible as api.validateUser().
 * @function validateUser
 * @public
 * @param {object} user - User object to validate
 * @returns {boolean} True if valid
 */
export function validateUser(user) {
	return user && user.name && user.email;
}

/**
 * Formats user for display (named export).
 * Should be accessible as api.formatUser().
 * @function formatUser
 * @public
 * @param {object} user - User object to format
 * @returns {string} Formatted user string
 */
export function formatUser(user) {
	return `${user.name} <${user.email}>`;
}

export default createUser;
