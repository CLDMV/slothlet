/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_call_identity/api/vault.mjs
 *	@Date: 2026-11-11T12:33:39-08:00 (1794429219)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:27-08:00 (1794431607)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for who makes each access of a member expression: the module the rules protect.
 * @module api_test_self_call_identity.vault
 */

/**
 * The protected call.
 * @returns {string} The secret.
 */
export function get() {
	return "SECRET";
}

/**
 * Protected data.
 * @type {{secret: string}}
 */
export const data = { secret: "DATA" };

/**
 * Hand a value back.
 * @param {*} value - The value.
 * @returns {*} The value.
 */
export function echo(value) {
	return value;
}

/**
 * Run what the caller hands in.
 * @param {Function} fn - The caller's code.
 * @returns {*} What it returned.
 */
export function run(fn) {
	return fn();
}
