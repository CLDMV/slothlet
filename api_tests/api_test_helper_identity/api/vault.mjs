/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_identity/api/vault.mjs
 *	@Date: 2026-11-11T23:40:32-08:00 (1794469232)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T23:53:11-08:00 (1794469991)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What the other modules of this fixture are allowed, or not, to read.
 * @module api_test_helper_identity.vault
 */

/**
 * What the vault holds.
 * @returns {string} The secret.
 * @example
 * api.vault.get(); // "SECRET"
 */
export function get() {
	return "SECRET";
}

/**
 * Answer a ping.
 * @returns {string} "pong".
 * @example
 * api.vault.ping(); // "pong"
 */
export function ping() {
	return "pong";
}
