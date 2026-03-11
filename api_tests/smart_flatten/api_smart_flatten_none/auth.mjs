/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_none/auth.mjs
 *	@Date: 2026-01-04T16:31:08-08:00 (1767573068)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:21 -08:00 (1772425281)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Auth service fixture for api_smart_flatten_none — tests that smart-flatten is disabled
 * when the flatten option is not set, verifying normal nested API structure is preserved.
 * @module api_smart_flatten_none.auth
 */
export function authenticate(user) {
	return `User ${user} authenticated`;
}

export function authorize(user, permission) {
	return `User ${user} authorized for ${permission}`;
}

export default {
	name: "auth-service",
	version: "1.0.0"
};

