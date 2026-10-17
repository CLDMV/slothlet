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
 * @fileoverview A folder whose only entry is a same-named folder stays nested in every mode (#581).
 *
 * @description
 * Only a FILE named after its folder flattens into it (Rule 1). Lazy mode also flattened a folder
 * whose only entry was a same-named FOLDER, so the same tree composed `x.foo.foo.get` eagerly and
 * `x.foo.get` lazily.
 *
 * Fixture (`api_test_same_named_folder`):
 * ```
 * x/info.mjs          → api.x.info()        → "x.info"
 * x/foo/foo/get.mjs   → api.x.foo.foo.get() → "x.foo.foo.get"   (folder: stays nested)
 * x/bar/bar.mjs       → api.x.bar()         → "x.bar"           (file: flattens)
 * ```
 *
 * @module tests/vitests/suites/lazy/lazy-same-named-folder
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("same-named folder nesting (#581) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("keeps a same-named folder nested", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_SAME_NAMED_FOLDER });
		expect(await api.x.foo.foo.get()).toBe("x.foo.foo.get");
		// Loads `x.foo` in lazy mode; a no-op in eager mode.
		await api.x.foo;
		expect(Object.keys(api.x.foo)).toEqual(["foo"]);
		expect(api.x.foo.get).toBeUndefined();
	});

	it("still flattens a same-named file into its folder", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST_SAME_NAMED_FOLDER });
		expect(await api.x.bar()).toBe("x.bar");
		expect(await api.x.info()).toBe("x.info");
	});
});
