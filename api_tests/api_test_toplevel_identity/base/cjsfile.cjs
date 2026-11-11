/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_toplevel_identity/base/cjsfile.cjs
 *	@Date: 2026-11-11T11:24:50-08:00 (1794425090)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-11T13:13:33-08:00 (1794431613)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for the permission path of file-level code: a CommonJS file with several exports.
 * @module api_test_toplevel_identity.cjsfile
 */
// The runtime is an ES module: a CommonJS file reaches it through import().
let self;
import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

const refused = (error) => `${error?.code}:${error?.context?.caller ?? null}`;

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

module.exports = {
	arm() {
		last = undefined;
		jobs.push(read);
	},
	result: () => last,
	give: () => read,
	direct: () => read()
};
