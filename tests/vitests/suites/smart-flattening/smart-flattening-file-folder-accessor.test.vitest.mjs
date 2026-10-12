/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/smart-flattening-file-folder-accessor.test.vitest.mjs
 *	@Date: 2026-10-11T22:49:06-07:00 (1791784146)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T23:37:15-07:00 (1791787035)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Getters on a file and a same-named folder stay live through their collision, and the
 * collision's winner answers a getter both sides define (#585 review).
 * @description
 * Fixture (`api_smart_flatten_file_folder_accessor`):
 * ```
 * gauge.mjs         default { level: 1, get double() → level * 2, get shared() → "file" }
 * gauge/gauge.mjs   default { get shared() → "folder", folderOnly: 1 }
 * ```
 * The file loads first. Under `merge` the first-loaded side keeps a conflicting member, under
 * `merge-replace` the incoming side takes it; a member only one side has is kept either way.
 * @module tests/vitests/suites/smart-flattening/smart-flattening-file-folder-accessor
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = path.join(TEST_DIRS.SMART_FLATTEN, "api_smart_flatten_file_folder_accessor");

describe.each(getMatrixConfigs())("file and folder collision with getters > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it.each([
		["merge", "file"],
		["merge-replace", "folder"]
	])(
		"under %s keeps the file's getter reading writes made through the node, and answers %s for the shared getter",
		async (mode, sharedWinner) => {
			api = await slothlet({ ...config, base: BASE, collision: { initial: mode, api: mode } });
			await api.gauge;
			expect(api.gauge.double).toBe(2);
			api.gauge.level = 5;
			expect(api.gauge.level).toBe(5);
			expect(api.gauge.double).toBe(10);
			expect(api.gauge.shared).toBe(sharedWinner);
			expect(api.gauge.folderOnly).toBe(1);
		}
	);
});
