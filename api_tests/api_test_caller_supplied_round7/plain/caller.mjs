/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round7/plain/caller.mjs
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
 * @fileoverview Host code that calls the vault, directly or from deep inside its own calls (#597).
 *
 * @module api_tests/api_test_caller_supplied_round7/plain/caller
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

/**
 * Call the vault's secret as the host from `depth` nested calls of the host's own.
 * @param {object} api - The api.
 * @param {number} depth - How many calls deep.
 * @returns {*} What the call returned.
 * @public
 * @example
 * callDeep(api, 250); // "s3cret"
 */
export function callDeep(api, depth) {
	if (depth > 0) {
		const answer = callDeep(api, depth - 1);
		return answer;
	}
	return api.vault.secret.secret();
}
