/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_late_files/vitest/late-calls.fixture.mjs
 *	@Date: 2026-11-06T19:31:46-08:00 (1794022306)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T19:39:56-08:00 (1794022796)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Run by `permissions-vite-late-files` in a vitest of its own (#714): runs the late-files fixture through
 * vitest's module runner with the `slothletInstanceImports()` plugin and prints what every call gave as one JSON line.
 * @module api_test_vite_late_files.vitest.late-calls
 */
import { it } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCalls } from "../calls.mjs";

it("reports every call", async () => {
	console.log(`LATE-CALLS ${JSON.stringify(await runCalls(slothlet))}`);
});
