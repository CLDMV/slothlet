/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lazy/lazy-same-named-folder.test.vitest.mjs
 *	@Date: 2026-10-08T00:00:00-07:00 (1791442800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-08T00:00:00-07:00 (1791442800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A folder whose only entry is a same-named folder is one level in every mode (#581, #743).
 *
 * @description
 * A FILE named after its folder flattens into it (Rule 1). A folder whose only entry is a FOLDER of the same name is
 * one level too (Rule 22): 2.x collapsed it, 3.0.0 through 3.24.0 kept both levels (and before #581 lazy mode
 * collapsed it while eager mode did not), and #743 restores the 2.x shape in both modes.
 *
 * Fixture (`api_test_same_named_folder`):
 * ```
 * x/info.mjs          → api.x.info()        → "x.info"
 * x/foo/foo/get.mjs   → api.x.foo.get()     → "x.foo.get"       (folder: one level)
 * x/bar/bar.mjs       → api.x.bar()         → "x.bar"           (file: flattens)
 * ```
 *
 * @module tests/vitests/suites/lazy/lazy-same-named-folder
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("same-named folder (#581, #743) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("makes a folder holding only a same-named folder one level", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_SAME_NAMED_FOLDER });
		expect(await api.x.foo.get()).toBe("x.foo.get");
		// Loads `x.foo` in lazy mode; a no-op in eager mode.
		await api.x.foo;
		expect(Object.keys(api.x.foo)).toEqual(["get"]);
		expect(api.x.foo.foo).toBeUndefined();
	});

	it("still flattens a same-named file into its folder", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_SAME_NAMED_FOLDER });
		expect(await api.x.bar()).toBe("x.bar");
		expect(await api.x.info()).toBe("x.info");
	});
});
