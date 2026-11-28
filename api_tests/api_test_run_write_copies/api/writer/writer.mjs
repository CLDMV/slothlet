/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_run_write_copies/api/writer/writer.mjs
 *	@Date: 2026-11-21T00:00:00-08:00 (1795248000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:40-08:00 (1795868980)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module code that runs a snippet against its own `self`.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run `src` as an expression with `self` in scope, after the `data` module has loaded.
 * @param {string} src - The expression.
 * @returns {Promise<*>} Its value.
 */
export async function evalIn(src) {
	await self.data.fn(1, 2);
	return new Function("self", `return (${src});`)(self);
}

/**
 * Run `src` as an expression with `self` in scope, without loading anything first.
 * @param {string} src - The expression.
 * @returns {*} Its value.
 */
export function evalCold(src) {
	return new Function("self", `return (${src});`)(self);
}
