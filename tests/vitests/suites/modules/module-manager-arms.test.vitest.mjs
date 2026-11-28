/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/modules/module-manager-arms.test.vitest.mjs
 *	@Date: 2026-11-25T01:32:13-08:00 (1795599133)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:09-08:00 (1795869129)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview ModuleManager arms the other module suites do not reach: a collision mode given as a bare string,
 * and discovery refused where there is no filesystem.
 *
 * @module tests/vitests/suites/modules/module-manager-arms.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { ModuleManager } from "#handlers/module-manager";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const FIX_NPM = path.resolve(process.cwd(), "api_tests/api_test_modules_npm");

let api;
afterEach(async () => {
	if (api?.shutdown) await api.shutdown().catch(() => {});
	api = null;
});

describe("ModuleManager — collision mode as a bare string", () => {
	it('refuses a second mount at the same path with collision "error"', async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", runtime: "async", silent: true });
		const mm = api.slothlet.api.modules;
		await mm.discover({ root: FIX_NPM });
		const baz = mm.cache.get().find((r) => r.package === "packrat-extension-baz");
		await mm.add(baz, { collision: "error" });
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(mm.add(baz, { collision: "error" })).rejects.toMatchObject({ code: "MODULE_MOUNT_COLLISION" });
		});
	});
});

describe("ModuleManager — discovery without a filesystem", () => {
	it("refuses discover() for a browser instance", async () => {
		const mm = new ModuleManager({ handlers: {}, envTarget: "browser" });
		await expect(mm.discover({ root: FIX_NPM })).rejects.toMatchObject({ code: "MODULE_DISCOVERY_REQUIRES_NODE" });
	});
});
