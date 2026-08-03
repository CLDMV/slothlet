/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/pair/crog/bind.mjs
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
 * @fileoverview Sibling in the callable-vs-callable directory whose name (`bind`) exists on
 * `Function.prototype`. The surviving slot is the FILE's callable, so this member reaches it
 * through the collision settle — a prototype-chain membership test there drops it silently.
 * @module api_test_collisions.pair.crog.bind
 * @memberof module:api_test_collisions
 */

/** @type {string} Reachable at api.pair.crog.bind.ping once the settle carries it across. */
export const ping = "bound-sibling";
