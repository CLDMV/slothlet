/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_detached_flow/helpers/shared.mjs
 *	@Date: 2026-11-13T08:00:00-08:00 (1794585600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T08:00:00-08:00 (1794585600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file only `alpha` imports: an async function that reads the vault after an `await`.
 * @module api_test_live_detached_flow.helpers.shared
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Read the vault once the function has picked up after an `await`.
 * @returns {Promise<string>} What the vault answered.
 * @example
 * await readLater(); // "SECRET"
 */
export const readLater = async () => {
	await null;
	return self.vault.get();
};
