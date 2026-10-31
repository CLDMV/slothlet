/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round7/host/lib/caller.mjs
 *	@Date: 2026-10-18T00:00:00-07:00 (1792306800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:00:00-07:00 (1792306800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Host code under a folder named `lib` (#597): a folder a module adds by a relative name is not every
 * folder of that name.
 *
 * @module api_tests/api_test_caller_supplied_round7/host/lib/caller
 */

/**
 * Call the vault's secret as the host.
 * @param {object} api - The api.
 * @returns {*} What the call returned.
 * @public
 * @example
 * callSecret(api); // "s3cret"
 */
export function callSecret(api) {
	return api.vault.secret.secret();
}
