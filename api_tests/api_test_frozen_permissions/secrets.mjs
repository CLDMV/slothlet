/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_frozen_permissions/secrets.mjs
 *	@Date: 2026-10-12T20:59:52-07:00 (1791863992)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T21:29:34-07:00 (1791865774)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#609): a namespace with a plain member and an array member that the rules deny another module.
 * @module api_test_frozen_permissions.secrets
 */

/** @type {string} A member a denied caller must not read. */
export const key = "SECRET";

/** @type {string[]} An array member whose elements a denied caller must not read. */
export const list = ["a", "b"];
