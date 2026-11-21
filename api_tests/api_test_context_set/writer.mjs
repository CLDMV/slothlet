/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_context_set/writer.mjs
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
 * @fileoverview Fixture: module code calling `self.slothlet.context.set()` for the context.set() suite.
 * @module api_test_context_set.writer
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Set one context key from module code.
 * @param {string} key - Context key.
 * @param {*} value - Value.
 * @returns {void}
 * @example
 * api.writer.write("tenant", "acme");
 */
export function write(key, value) {
	self.slothlet.context.set(key, value);
}
