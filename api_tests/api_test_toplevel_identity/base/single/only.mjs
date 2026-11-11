/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_toplevel_identity/base/single/only.mjs
 *	@Date: 2026-11-11T11:24:50-08:00 (1794425090)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:35-08:00 (1794431615)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for the permission path of file-level code: the only file of its folder. The code outside every export reads the
 * vault from a timer the file starts when it loads, and through a helper a leaf returns for the host to run.
 * @module api_test_toplevel_identity.base.single.only
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
 * Queue the file-level read for the file's own timer.
 * @returns {void}
 */
export const arm = () => {
	last = undefined;
	jobs.push(read);
};

/**
 * What the timer's read gave.
 * @returns {*} The outcome, or undefined while the timer has not run.
 */
export const result = () => last;

/**
 * Hand the file-level helper out.
 * @returns {Function} The helper.
 */
export const give = () => read;

/**
 * Run the file-level helper from a leaf's own code.
 * @returns {*} The outcome.
 */
export const direct = () => read();
