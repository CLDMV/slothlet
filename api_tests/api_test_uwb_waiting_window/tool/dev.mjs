/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_uwb_waiting_window/tool/dev.mjs
 *	@Date: 2026-11-25T01:21:43-08:00 (1795598503)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:42:35-08:00 (1795599755)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A folder member whose value is its own Proxy.
 */

/** Members the proxy answers. */
const table = { inner: { z: "tool.dev.inner.z" } };

export default new Proxy(table, {
	get(target, prop) {
		return Reflect.get(target, prop);
	}
});
