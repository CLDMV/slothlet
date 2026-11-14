/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_flow/helpers/queue.mjs
 *	@Date: 2026-11-12T22:53:16-08:00 (1794552796)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T22:53:16-08:00 (1794552796)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A helper file only `late.mjs` imports. It waits on `slow.mjs`, which `early.mjs` started loading
 * first, and starts a job queue at its top level.
 * @module api_test_load_flow.helpers.queue
 */
import { self } from "@cldmv/slothlet/runtime";
import "./slow.mjs";

const jobs = [];
// An ordinary job queue, started when the file loads.
const timer = setInterval(() => jobs.shift()?.(), 1);
timer.unref?.();

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
