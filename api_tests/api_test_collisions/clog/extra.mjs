/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/clog/extra.mjs
 *	@Date: 2026-08-02 12:00:00 -07:00 (1785697200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-02 12:00:00 -07:00 (1785697200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Sibling module in the multi-file collision directory — composes as a child
 * namespace on the callable (`api.clog.extra.ping`), exactly like `loggerMeta` in the modes-debug
 * fixture. Present so the directory takes the MULTI-file composition branch, not the single-file
 * one.
 * @module api_test_collisions.clog.extra
 * @memberof module:api_test_collisions
 */

/** @type {string} Reachable at api.clog.extra.ping in every mode. */
export const ping = "extra";
