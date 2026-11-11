/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_identity/api/vault.mjs
 *	@Date: 2026-11-11T11:44:49-08:00 (1794426289)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:00-08:00 (1794431580)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for what a file starts while it loads: what the rules guard.
 * @module api_test_load_identity.vault
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
