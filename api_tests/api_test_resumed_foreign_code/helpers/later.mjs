/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_resumed_foreign_code/helpers/later.mjs
 *	@Date: 2026-11-12T23:29:38-08:00 (1794554978)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:59:02-08:00 (1794556742)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file (no api file itself) whose async function reads the vault after an `await`.
 * @module api_test_resumed_foreign_code.helpers.later
 * @memberof module:api_test_resumed_foreign_code
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the vault after an `await`.
 * @returns {Promise<string>} The vault's value.
 * @example
 * await readLater(); // "SECRET"
 */
export const readLater = async () => {
	await null;
	return self.vault.get();
};
