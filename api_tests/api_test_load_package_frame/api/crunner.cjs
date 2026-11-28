/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_load_package_frame/api/crunner.cjs
 *	@Date: 2026-11-14T08:00:00-08:00 (1794672000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:50-08:00 (1795868930)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS module that starts a timer's job queue at its top level and runs code in it later: the bag's
 * functions, or its own code calling the vault through a CommonJS package or a host file's function.
 * @module api_test_load_package_frame.crunner
 * @memberof module:api_test_load_package_frame
 */
const { descend } = require("cjs-walker");

let self;
import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

const timerJobs = [];
// An ordinary job queue, started when the file loads.
const timer = setInterval(() => timerJobs.shift()?.(), 1);
timer.unref?.();

/**
 * This file's own code calling the vault, outside every export.
 * @param {string} route - `"package"`, `"host"` or `"direct"`.
 * @param {number} depth - How deep the code between recurses.
 * @returns {function(): string} The code.
 */
function own(route, depth) {
	if (route === "package") return () => descend(depth, self.vault.get);
	if (route === "host") return () => globalThis.__loadPackageFrameWalk(depth, self.vault.get);
	return () => self.vault.get();
}

/**
 * Run code and give what it answered, or the code of the error it threw.
 * @param {function(): (string|Promise<string>)} code - The code.
 * @returns {Promise<string>} The answer.
 */
async function attempt(code) {
	try {
		return await code();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
}

/**
 * The code a route runs: the bag's function, or this file's own code (`"own-<route>"`).
 * @param {string} route - The route.
 * @param {number} depth - How deep the code between recurses.
 * @returns {Promise<function(): string>} The code.
 */
async function codeFor(route, depth) {
	return route.startsWith("own-") ? own(route.slice(4), depth) : await self.bag.give(route, depth);
}

/**
 * Run a route's code later, from the job queue this file started when it loaded.
 * @param {string} route - The route.
 * @param {number} depth - How deep the code between recurses.
 * @returns {Promise<string>} What the vault answered, or the code of the refusal.
 * @example
 * await api.crunner.later("package", 5); // "SECRET"
 */
async function later(route, depth) {
	const code = await codeFor(route, depth);
	return new Promise((resolve) => timerJobs.push(() => resolve(attempt(code))));
}

/**
 * Run a route's code now, inside this call.
 * @param {string} route - The route.
 * @param {number} depth - How deep the code between recurses.
 * @returns {Promise<string>} What the vault answered, or the code of the refusal.
 * @example
 * await api.crunner.now("package", 5); // "SECRET"
 */
async function now(route, depth) {
	return attempt(await codeFor(route, depth));
}

module.exports = { later, now };
