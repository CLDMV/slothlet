/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_add_comount_b/net/dns.mjs
 *	@Date: 2026-10-02 12:32:25 -07:00 (1790969545)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:42 -07:00 (1791082962)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf in a subfolder only the second module contributes (#548).
 * @module api_test_lazy_add_comount_b.net.dns
 */

/**
 * @function dns
 * @returns {string} `"b:dns"`.
 */
export function dns() {
	return "b:dns";
}
