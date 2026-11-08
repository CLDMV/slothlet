/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_host_record_leaf/api/ext/c.mjs
 *	@Date: 2026-11-08T12:34:06-08:00 (1794170046)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T12:37:42-08:00 (1794170262)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that is not part of the calls in the host record leaf tests (#717): it imports `c-pkg`, which
 * the host imports too.
 * @module api_tests/api_test_host_record_leaf/ext/c
 */

import { relay } from "c-pkg";

/**
 * Answer through `c-pkg`.
 * @returns {string} `"pong"`.
 * @example
 * api.ext.c.ping(); // "pong"
 */
export function ping() {
	return relay(() => "pong");
}
