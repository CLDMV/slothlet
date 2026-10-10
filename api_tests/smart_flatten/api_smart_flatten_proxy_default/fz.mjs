/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_proxy_default/fz.mjs
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
 * @fileoverview Fixture: a Proxy default over a frozen target, plus a named export. A frozen target
 * cannot gain members, so the named export has to live beside the Proxy, not on it.
 * @module api_smart_flatten_proxy_default.fz
 */

export default new Proxy(
	Object.freeze({
		base() {
			return "fz.base";
		}
	}),
	{}
);

/**
 * A named export composed beside the Proxy default.
 * @returns {string} "fz.extra".
 */
export function extra() {
	return "fz.extra";
}
