/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_order/watch/spy.mjs
 *	@Date: 2026-11-25T11:33:17-08:00 (1795635197)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T11:50:25-08:00 (1795636225)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Registers hooks from module code and keeps what they saw.
 * @module api_test_private_order/watch/spy
 */
import { self } from "@cldmv/slothlet/runtime";

/** @type {string[]} */
const seen = [];

/**
 * Register a hook that records the path, args and result it sees.
 * @param {string} typePattern - `pattern:type`.
 * @returns {{value: *, error: string|null}} `true` when registered, or the refusal's code.
 */
export function arm(typePattern) {
	try {
		self.slothlet.hook.on(typePattern, ({ path, args, result }) => {
			seen.push(JSON.stringify({ path, args, result }));
		});
		return { value: true, error: null };
	} catch (error) {
		return { value: undefined, error: error?.code ?? String(error) };
	}
}

/**
 * What the hooks saw so far, then forget it.
 * @returns {string[]} One JSON record per firing.
 */
export function drain() {
	return seen.splice(0, seen.length);
}
