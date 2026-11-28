/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_version_ceiling/api/supplier/probe.mjs
 *	@Date: 2026-11-25T01:29:35-08:00 (1795598975)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:04-08:00 (1795869004)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A supplier that calls the versioned `auth.login` directly and from code it hands the callee.
 * @module api_test_version_ceiling/supplier/probe
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call `auth.login` as this module.
 * @returns {string} The version that answered.
 * @example
 * direct(); // "v1"
 */
export function direct() {
	return self.auth.login();
}

/**
 * Call `auth.login` from code the callee runs (the callee is its ceiling).
 * @returns {Promise<string>} The version that answered.
 * @example
 * await inside(); // "v1"
 */
export async function inside() {
	let result;
	await self.callee.ops.echo({
		toString() {
			result = self.auth.login();
			return "x";
		}
	});
	return result;
}
