/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reject_then_export_cjs_proxy/session/tool.cjs
 *	@Date: 2026-10-11T00:00:00-07:00 (1791702000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T00:00:00-07:00 (1791702000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#580 review): a CommonJS `module.exports` Proxy whose own `then` is described
 * as data holding `1`, while its `get` trap answers `then` with a function. The value copied onto the
 * namespace is the read, so the module is refused instead of hanging the load.
 * @module api_test_reject_then_export_cjs_proxy.session.tool
 */

const target = {
	then: 1,
	/**
	 * @returns {string} Marker naming this leaf.
	 */
	other() {
		return "session.tool.other";
	}
};

module.exports = new Proxy(target, {
	get: (t, key) => (key === "then" ? () => {} : t[key])
});
