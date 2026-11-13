/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_flow/api/second.mjs
 *	@Date: 2026-11-12T22:50:28-08:00 (1794552628)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T22:50:28-08:00 (1794552628)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An ES module api file that starts a job queue at its top level. What the queue runs is this file's
 * own code, started by this file's own load.
 * @module api_test_load_flow.second
 */
import { self } from "@cldmv/slothlet/runtime";

const jobs = [];
// An ordinary job queue, started when the file loads.
const timer = setInterval(() => jobs.shift()?.(), 1);
timer.unref?.();

/**
 * Read the vault from the queue this file started when it loaded.
 * @returns {Promise<string>} What the vault holds, or the code of the error the read threw.
 * @example
 * await api.second.viaQueue(); // "SECRET"
 */
export const viaQueue = () =>
	new Promise((resolve) =>
		jobs.push(() => {
			try {
				resolve(self.vault.get());
			} catch (error) {
				resolve(error?.code ?? String(error?.message ?? error));
			}
		})
	);
