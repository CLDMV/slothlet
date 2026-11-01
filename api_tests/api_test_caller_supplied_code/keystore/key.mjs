/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_code/keystore/key.mjs
 *	@Date: 2026-10-16T19:30:00-07:00 (1792204200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-16T19:30:00-07:00 (1792204200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A key store in the shape of CLDMV/jellytagger#3 (#597): `lock(name, fn)` takes a named lock
 * for whoever called it, then runs the callback it was handed. The callback belongs to the caller, so the
 * calls it makes are the caller's.
 *
 * @module api_tests/api_test_caller_supplied_code/keystore/key
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Take a named lock for the calling module, run `fn` under it, and report who held it.
 * @param {string} name - Lock name.
 * @param {function(): *} fn - Work to run while the lock is held.
 * @returns {Promise<{name: string, holder: string|null, result: *}>} The holder and `fn`'s result.
 * @public
 * @example
 * await api.keystore.key.lock("k", () => 1);
 */
export async function lock(name, fn) {
	const holder = self.slothlet.metadata.caller()?.apiPath ?? null;
	await new Promise((resolve) => setTimeout(resolve, 0));
	const result = await fn();
	return { name, holder, result };
}
