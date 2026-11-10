/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_own_package_imports/vitest/calls.fixture.mjs
 *	@Date: 2026-11-08T16:46:18-08:00 (1794185178)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:56:52-08:00 (1794185812)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Run by `helper-import-own-package` in a vitest of its own (#715): runs the own-package fixture through
 * vitest's module runner with the `slothletInstanceImports()` plugin and prints what every case gave as one JSON line.
 * @module api_test_own_package_imports.vitest.calls
 */

import { it } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCalls } from "../calls.mjs";

it("reports every case", async () => {
	console.log(`OWN-PACKAGE ${JSON.stringify(await runCalls(slothlet))}`);
});
