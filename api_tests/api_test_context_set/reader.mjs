/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_context_set/reader.mjs
 *	@Date: 2026-11-16T16:58:03-08:00 (1794877083)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T17:05:37-08:00 (1794877537)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: reads the instance context for the context.set() suite.
 * @module api_test_context_set.reader
 */
import { context } from "@cldmv/slothlet/runtime";

/**
 * Read one context key.
 * @param {string} key - Context key.
 * @returns {*} The value the leaf sees.
 * @example
 * api.reader.read("tenant");
 */
export function read(key) {
	return context[key];
}
