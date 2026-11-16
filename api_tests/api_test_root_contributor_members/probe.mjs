/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_contributor_members/probe.mjs
 *	@Date: 2026-11-14T00:00:00-08:00 (1794643200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T00:00:00-08:00 (1794643200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that calls another node, so a rule can name it as the caller.
 * @module api_test_root_contributor_members/probe
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Calls the node at `target` with `args` and returns its result, or the error's code.
 * @param {string} target - Dotted path from the root.
 * @param {...unknown} args - Arguments for the call.
 * @returns {Promise<unknown>} The result, or the error code.
 */
export async function call(target, ...args) {
	try {
		return await target.split(".").reduce((node, key) => node[key], self)(...args);
	} catch (error) {
		return error.code ?? error.message;
	}
}

/**
 * Writes `value` at `target`, or returns the error's code.
 * @param {string} target - Dotted path from the root.
 * @param {unknown} value - What to write.
 * @returns {string} "WRITTEN", or the error code.
 */
export function write(target, value) {
	const keys = target.split(".");
	const last = keys.pop();
	try {
		const parent = keys.reduce((node, key) => node[key], self);
		parent[last] = value;
		return "WRITTEN";
	} catch (error) {
		return error.code ?? error.message;
	}
}
