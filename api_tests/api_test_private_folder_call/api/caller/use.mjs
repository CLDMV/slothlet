/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_folder_call/api/caller/use.mjs
 *	@Date: 2026-11-25T13:12:09-08:00 (1795641129)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:19:49-08:00 (1795641589)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Another module that calls through the underscore-named folder `ext._box`.
 * @module api_test_private_folder_call.caller.use
 * @memberof module:api_test_private_folder_call
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a call and report what it gave or the error code it threw.
 * @param {Function} fn - The call.
 * @returns {Promise<{value: *, error: string|null}>} The outcome.
 */
async function outcome(fn) {
	try {
		return { value: await fn(), error: null };
	} catch (e) {
		return { value: undefined, error: e.code ?? e.message };
	}
}

/**
 * Call the public function under the underscore-named folder.
 * @returns {Promise<{value: *, error: string|null}>} The outcome.
 */
export const open = () => outcome(() => self.ext._box.item.open());

/**
 * Call the private function under the underscore-named folder.
 * @returns {Promise<{value: *, error: string|null}>} The outcome.
 */
export const seal = () => outcome(() => self.ext._box.item._seal());

/**
 * Read the folder first, then call the public function through what was read.
 * @returns {Promise<{value: *, error: string|null}>} The outcome.
 */
export const openHeld = () =>
	outcome(() => {
		const box = self.ext._box;
		return box.item.open();
	});
