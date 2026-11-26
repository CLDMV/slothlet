/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_order/peek.mjs
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
 * @fileoverview Another file of the same folder as `tool.mjs`, reaching a member at a dotted api path through `self`.
 * @module api_test_private_order/peek
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call the member at a path.
 * @param {string} path - Dotted api path.
 * @param {...*} args - Arguments.
 * @returns {Promise<{value: *, error: string|null}>} The result or the refusal's code.
 */
export async function callAt(path, ...args) {
	try {
		return { value: await path.split(".").reduce((node, key) => node[key], self)(...args), error: null };
	} catch (error) {
		return { value: undefined, error: error?.code ?? String(error) };
	}
}

/**
 * Read the member at a path.
 * @param {string} path - Dotted api path.
 * @returns {Promise<{value: *, error: string|null}>} The value (a function as its type) or the refusal's code.
 */
export async function readAt(path) {
	try {
		const value = await path.split(".").reduce((node, key) => node[key], self);
		return { value: typeof value === "function" ? "function" : value, error: null };
	} catch (error) {
		return { value: undefined, error: error?.code ?? String(error) };
	}
}
