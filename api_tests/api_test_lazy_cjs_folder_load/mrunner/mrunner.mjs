/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_cjs_folder_load/mrunner/mrunner.mjs
 *	@Date: 2026-11-15T09:36:41-08:00 (1794764201)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:38:53-08:00 (1794775133)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The same as `crunner/crunner.cjs`, as an ES module.
 */
import { self } from "@cldmv/slothlet/runtime";

const jobs = [];
const timer = setInterval(() => jobs.shift()?.(), 1);
timer.unref?.();

/**
 * Run this file's own code calling the vault from the queue its load started.
 * @returns {Promise<string>} What the vault answered, or the code of the refusal.
 */
export function later() {
	return new Promise((resolve) =>
		jobs.push(() => {
			try {
				resolve(self.vault.get());
			} catch (error) {
				resolve(error?.code ?? String(error?.message ?? error));
			}
		})
	);
}

/**
 * Run the same code now, inside this call.
 * @returns {string} What the vault answered, or the code of the refusal.
 */
export function now() {
	try {
		return self.vault.get();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
}
