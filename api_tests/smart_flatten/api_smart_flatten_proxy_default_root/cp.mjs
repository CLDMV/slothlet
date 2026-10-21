/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_proxy_default_root/cp.mjs
 *	@Date: 2026-10-09T00:00:00-07:00 (1791529200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T00:00:00-07:00 (1791529200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: a read-only callable Proxy default at the api root, so the api itself is the callable. A Proxy over a function
 * is itself a function, so it takes the function-default path; its traps refuse every write.
 * @module api_smart_flatten_proxy_default_root.cp
 */

export default new Proxy(
	function cp() {
		return "cp";
	},
	{
		set() {
			throw new TypeError("cp is read-only");
		},
		defineProperty() {
			throw new TypeError("cp is read-only");
		}
	}
);

/**
 * A named export composed beside the callable Proxy.
 * @returns {string} "cp.extra".
 */
export function extra() {
	return "cp.extra";
}
