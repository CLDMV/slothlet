/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-structures/fixture-scripts-not-api-files.test.vitest.mjs
 *	@Date: 2026-11-12T22:47:25-08:00 (1794552445)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T10:23:26-08:00 (1795544606)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A fixture's child-process scripts are not api files of that fixture (#759).
 * @description
 * `api_test_host_record_leaf/lib/__probe-records.mjs` and `api_test_stream_plants/lib/__probe.mjs` each build slothlet
 * instances of their own and are run in a child process by their permission tests. They sit in the fixture's `lib/`,
 * beside the `api/` folder the structures test loads, so loading the fixture's api tree never runs them as api files.
 * @module tests/vitests/suites/api-structures/fixture-scripts-not-api-files
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const API_TESTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests");

describe.each([
	["api_test_host_record_leaf", "__probe-records.mjs", "probeRecords"],
	["api_test_stream_plants", "__probe.mjs", "probe"]
])("%s's child-process script", (folder, script, leafName) => {
	it.each(["eager", "lazy"])("is not loaded as an api file of the fixture's api tree (%s)", async (mode) => {
		expect(existsSync(path.join(API_TESTS, folder, "lib", script))).toBe(true);
		const api = await slothlet({ base: path.join(API_TESTS, folder, "api"), mode, silent: true });
		try {
			const keys = Object.keys(api);
			expect(keys).not.toContain(leafName);
			expect(keys.some((key) => key.toLowerCase().includes("probe"))).toBe(false);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
