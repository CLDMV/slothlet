/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_shared_helper_import_split/vitest/calls.fixture.mjs
 *	@Date: 2026-11-08T15:50:17-08:00 (1794181817)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:00:39-08:00 (1794182439)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Run by `helper-import-one-url` in a vitest of its own (#715): runs the shared-helper fixture through
 * vitest's module runner with the `slothletInstanceImports()` plugin and prints what every case gave as one JSON line.
 * @module api_test_shared_helper_import_split.vitest.calls
 */
import { it } from "vitest";
import slothlet from "@cldmv/slothlet";
import { linkSharedLib } from "../link.mjs";
import { runCalls } from "../calls.mjs";

it("reports every case", async () => {
	linkSharedLib();
	console.log(`SPLIT-CALLS ${JSON.stringify(await runCalls(slothlet))}`);
});
