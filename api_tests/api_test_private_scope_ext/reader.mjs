/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_scope_ext/reader.mjs
 *	@Date: 2026-11-15T19:24:45-08:00 (1794799485)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T20:09:54-08:00 (1794802194)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reads a member at a dotted api path through `self`, answering its value or the refusal's code.
 * @module api_test_private_scope_ext/reader
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the member at a dotted path.
 * @param {string} path - The path, e.g. `"billing.internals.__rate"`.
 * @returns {Promise<{value: *, error: string|null}>} The value, or the error's code.
 */
export async function read(path) {
	try {
		return { value: await path.split(".").reduce((node, key) => node[key], self), error: null };
	} catch (error) {
		return { value: undefined, error: error?.code ?? error?.message ?? String(error) };
	}
}
