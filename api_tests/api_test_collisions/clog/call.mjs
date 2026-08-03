/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/clog/call.mjs
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
 * @fileoverview Sibling whose module name (`call`) also exists on `Function.prototype`. The
 * composed slot is a callable, so carrying wrapper children onto it with an `in` test would treat
 * this as already present and drop it — the proxy surface serves wrapper children ahead of
 * anything inherited, so it must survive. Guards that precedence (#259 review).
 * @module api_test_collisions.clog.call
 * @memberof module:api_test_collisions
 */

/** @type {string} Reachable at api.clog.call.ping despite colliding with Function.prototype.call. */
export const ping = "prototype-named";
