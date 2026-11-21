/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_identity/helpers/shared.mjs
 *	@Date: 2026-11-11T23:40:32-08:00 (1794469232)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T23:53:11-08:00 (1794469991)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file two api files import (`alpha.mjs` and `beta.mjs`): functions of its own that the leaves
 * hand out, and a queue it starts when it loads.
 * @module api_test_helper_identity.helpers.shared
 */
import { self } from "@cldmv/slothlet/runtime";

const jobs = [];
// An ordinary job queue, started when the file loads.
const timer = setInterval(() => jobs.shift()?.(), 1);
timer.unref?.();

/**
 * Read the vault. The helper's own function: no leaf's code is written in it.
 * @returns {string} What the vault holds.
 * @example
 * read(); // "SECRET"
 */
export const read = () => self.vault.get();

/**
 * Read the vault after an await.
 * @returns {Promise<string>} What the vault holds.
 * @example
 * await readLater(); // "SECRET"
 */
export const readLater = async () => {
	await null;
	return self.vault.get();
};

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

/**
 * Put a job on the queue the helper started when it loaded.
 * @param {Function} job - The job.
 * @returns {void}
 * @example
 * push(() => console.log("ran"));
 */
export const push = (job) => {
	jobs.push(job);
};
