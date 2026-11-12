/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_copies/helpers/tally.mjs
 *	@Date: 2026-11-12T00:24:02-08:00 (1794471842)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T00:24:02-08:00 (1794471842)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An ES module helper file two api files import (`one.mjs` and `two.mjs`): it keeps a count in module
 * state, reads the vault with a function of its own, and starts a job queue when it loads.
 * @module api_test_helper_copies.helpers.tally
 */
import { self } from "@cldmv/slothlet/runtime";
import { state } from "./store.mjs";

const jobs = [];
// An ordinary job queue, started when the file loads.
const timer = setInterval(() => jobs.shift()?.(), 1);
timer.unref?.();

/**
 * Count one up.
 * @returns {number} The count so far in this copy of the module.
 * @example
 * bump(); // 1
 */
export const bump = () => ++state.count;

/**
 * Read the vault. The helper's own function: no leaf's code is written in it.
 * @returns {string} What the vault holds.
 * @example
 * read(); // "SECRET"
 */
export const read = () => self.vault.get();

/**
 * Run the helper's own read of the vault from the queue the helper started when it loaded.
 * @returns {Promise<string>} What the vault holds, or the code of the error the read threw.
 * @example
 * await queued(); // "SECRET"
 */
export const queued = () =>
	new Promise((resolve) =>
		jobs.push(() => {
			try {
				resolve(self.vault.get());
			} catch (error) {
				resolve(error?.code ?? String(error?.message ?? error));
			}
		})
	);
