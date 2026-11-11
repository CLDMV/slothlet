/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_toplevel_identity/base/lone.mjs
 *	@Date: 2026-11-11T12:00:00-08:00 (1794427200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T12:00:00-08:00 (1794427200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for the permission path of file-level code: a file whose one export is named after it. The code outside every export reads the
 * vault from a timer the file starts when it loads, and through a helper a leaf returns for the host to run.
 * @module api_test_toplevel_identity.base.lone
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Report an outcome as a string: the value, or the refusal's code and the caller it names.
 * @param {*} error - What was thrown.
 * @returns {string} The report.
 */
const refused = (error) => `${error?.code}:${error?.context?.caller ?? null}`;

/**
 * Read the vault from code outside every export.
 * @returns {*} The secret, or the refusal.
 */
const read = () => {
	try {
		const value = self.vault.get();
		return value && typeof value.then === "function" ? value.then((settled) => settled, refused) : value;
	} catch (error) {
		return refused(error);
	}
};

const jobs = [];
let last;
// Started when the file loads: what it runs has no export's frame below it.
const timer = setInterval(() => {
	const job = jobs.shift();
	if (job) last = job();
}, 1);
timer.unref?.();

/**
 * The file's one export: arms the timer, reports its result, hands the helper out or runs it.
 * @param {"arm"|"result"|"give"|"direct"} action - What to do.
 * @returns {*} The outcome.
 */
export function lone(action) {
	if (action === "arm") {
		last = undefined;
		jobs.push(read);
		return undefined;
	}
	if (action === "result") return last;
	if (action === "give") return read;
	return read();
}
