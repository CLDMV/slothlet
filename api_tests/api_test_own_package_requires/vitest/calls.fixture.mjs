/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_own_package_requires/vitest/calls.fixture.mjs
 *	@Date: 2026-11-09T00:26:34-08:00 (1794212794)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-09T00:36:31-08:00 (1794213391)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Run by `helper-require-own-package` in a vitest of its own (#715): runs the own-package require fixture through
 * vitest's module runner with the `slothletInstanceImports()` plugin and prints what every case gave as one JSON line.
 * @module api_test_own_package_requires.vitest.calls
 */

import { it } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCalls } from "../calls.mjs";

it("reports every case", async () => {
	console.log(`OWN-PACKAGE-REQUIRES ${JSON.stringify(await runCalls(slothlet))}`);
});
