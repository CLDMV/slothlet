/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_underscore/clash/clash.mjs
 *	@Date: 2026-08-03 12:00:00 -07:00 (1785783600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-03 12:00:00 -07:00 (1785783600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Companion module for the reserved-name contract. Its reserved-name exports were
 * removed when scan-time rejection landed (#260): a module can no longer export `_materialize` /
 * `__impl` at all — the loader refuses the file with MODULE_RESERVED_EXPORT. What remains pins
 * that the framework's own reserved handles stay served on an ordinary module's wrapper.
 * @module api_test_underscore.clash
 * @memberof module:api_test_underscore
 */

/** @type {string} Ordinary member — the framework's reserved handles coexist beside it. */
export const safe = "safe";
