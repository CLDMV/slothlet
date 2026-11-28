/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_self_closed/api/probe.mjs
 *	@Date: 2026-11-25T01:30:04-08:00 (1795599004)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:42-08:00 (1795868982)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Runs each operation the language has on an object on this module's `self`, inside the module.
 */
import { self } from "@cldmv/slothlet/runtime";
import { operations } from "../lib/operations.mjs";

/**
 * Each operation on `self`, as it answers here.
 * @param {boolean} [write=true] - Whether to try `Reflect.set` of a new member too.
 * @returns {Record<string, *>} What each operation gave.
 */
export function closedOperations(write = true) {
	return operations(self, write);
}

/**
 * What `self` is here before the root is closed.
 * @returns {string} Its `typeof`.
 */
export function ready() {
	return typeof self;
}
