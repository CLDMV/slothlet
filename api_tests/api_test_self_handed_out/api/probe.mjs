/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_handed_out/api/probe.mjs
 *	@Date: 2026-11-25T01:46:29-08:00 (1795599989)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:09:42-08:00 (1795601382)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Hands out functions that use `self` and the runtime `context`, for the host to run later.
 */

import { self, context } from "@cldmv/slothlet/runtime";

/**
 * Hand out `self` itself, held in an object: awaiting `self` would read its `then` outside any call.
 * @returns {{self: *}} This module's `self`.
 */
export function expose() {
	return { self };
}

/**
 * Functions that call, construct and inspect `self` when the host runs them, after this call has returned.
 * @returns {{call: Function, construct: Function, proto: Function}} The functions.
 */
export function handOut() {
	return {
		call: (n) => self(n),
		construct: (n) => typeof new self(n),
		proto: () => Object.getPrototypeOf(self)
	};
}

/**
 * Describe a member of the runtime `context` as this call sees it.
 * @param {string} key - The member.
 * @returns {string} "value", "accessor" or "none".
 */
export function describeContext(key) {
	const descriptor = Object.getOwnPropertyDescriptor(context, key);
	if (descriptor === undefined) return "none";
	return "value" in descriptor ? "value" : "accessor";
}
