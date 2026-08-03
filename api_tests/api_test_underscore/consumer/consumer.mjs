/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_underscore/consumer/consumer.mjs
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
 * @fileoverview Reads the underscore-prefixed members through `self`, so the in-module view is
 * covered as well as the host view — a member reachable from one but not the other is the shape
 * this fixture exists to catch.
 * @module api_test_underscore.consumer
 * @memberof module:api_test_underscore
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the underscore members via `self`.
 * @returns {Promise<{keys: string[], priv: string, semi: string}>} What the in-module view sees.
 * @example
 * await api.consumer.readViaSelf(); // { keys: ["__priv","_semi","plain"], priv: "p", semi: "s" }
 */
export const readViaSelf = async () => {
	const mod = await self.mod;
	return { keys: Object.keys(mod).sort(), priv: await mod.__priv, semi: await mod._semi };
};
