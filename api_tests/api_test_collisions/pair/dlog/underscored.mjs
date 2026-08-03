/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/pair/dlog/underscored.mjs
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
 * @fileoverview Underscore-named export inside a collision folder, so the collision merge carries
 * an underscore member. Skipping such members by prefix there would merge an unwrapped snapshot
 * instead of the live child wrapper.
 * @module api_test_collisions.pair.dlog.underscored
 * @memberof module:api_test_collisions
 */

/** @type {string} Underscore-named member composed through the collision merge. */
export const _tag = "underscored";
