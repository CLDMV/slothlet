/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_cjs_folder_load/croot.cjs
 *	@Date: 2026-11-15T09:36:41-08:00 (1794764201)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:38:51-08:00 (1794775131)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS module that starts a job queue at its top level and runs its own code calling the vault in
 * it later, with two exports so the folder it is named like takes them as its members.
 */
let self;
import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

const jobs = [];
// An ordinary job queue, started when the file loads.
const timer = setInterval(() => jobs.shift()?.(), 1);
timer.unref?.();

/**
 * Run this file's own code calling the vault from the queue its load started.
 * @returns {Promise<string>} What the vault answered, or the code of the refusal.
 */
function later() {
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
function now() {
	try {
		return self.vault.get();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
}

module.exports = { later, now };
