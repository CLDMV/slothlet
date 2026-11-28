/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-vitest-runner-compile-helper.test.vitest.mjs
 *	@Date: 2026-11-24T00:00:00-08:00 (1795507200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:45-08:00 (1795869165)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Copies of a lib file under an instance's tag, imported by a module's call once the instance has loaded,
 * under vitest with the `@cldmv/slothlet/vite` plugin and the permission system on: vitest's compile of the code its
 * server sent loads; a fetch reply changed before vitest's runner reads it, and the lib file's source compiled under a
 * copy's name, are refused.
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = path.join(path.dirname(TEST_DIRS.API_TEST_VITEST_RUNNER_COMPILE), "api_test_vitest_runner_compile_helper", "api");

const CONFIGS = [
	{ mode: "eager", runtime: "async" },
	{ mode: "lazy", runtime: "async" },
	{ mode: "eager", runtime: "live" },
	{ mode: "lazy", runtime: "live" }
];

describe.each(CONFIGS)("vitest runner compile of a lib file's copy — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	it("loads the copy the server sent, and refuses other code under a copy's name once the instance has loaded", async () => {
		api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions: {} });
		const report = await withSuppressedSlothletErrorOutput(() => api.late.forge());
		expect(report).toEqual({
			runner: true,
			genuine: "done",
			forged: "PERMISSION_CAPABILITY_REFUSED",
			forgedRan: false,
			sourceAtCopy: "PERMISSION_CAPABILITY_REFUSED"
		});
	});
});
