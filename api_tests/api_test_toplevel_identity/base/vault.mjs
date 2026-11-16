/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_toplevel_identity/base/vault.mjs
 *	@Date: 2026-11-11T11:24:50-08:00 (1794425090)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:35-08:00 (1794431615)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for the permission path of file-level code: what the rules guard.
 * @module api_test_toplevel_identity.vault
 */

/**
 * The guarded value.
 * @returns {string} The secret.
 */
export function get() {
	return "SECRET";
}

/**
 * A second export, so the file is a module with leaves.
 * @returns {string} A marker.
 */
export function ping() {
	return "pong";
}
