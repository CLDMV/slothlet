/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_nested_self_assign/api/vault/secret.mjs
 *	@Date: 2026-10-17T21:07:21-07:00 (1792296441)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:59-08:00 (1795868939)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Mounted at apiPath "vault" (moduleID "vault") by the nested self-assign ownership tests (#625).

/**
 * A value only its owner is meant to hand out.
 * @returns {string} The secret.
 */
export function secret() {
	return "vault-secret";
}
