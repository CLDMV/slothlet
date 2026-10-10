/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_proxy_default/ro.mjs
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
 * @fileoverview Fixture: a read-only Proxy default plus a named export. The Proxy refuses every write,
 * so composing the named export onto it would fail the load.
 * @module api_smart_flatten_proxy_default.ro
 */

const items = ["a", "b"];

export default new Proxy(items, {
	set() {
		throw new TypeError("ro is read-only");
	},
	defineProperty() {
		throw new TypeError("ro is read-only");
	}
});

/**
 * A named export composed beside the Proxy default.
 * @returns {string} "ro.extra".
 */
export function extra() {
	return "ro.extra";
}
