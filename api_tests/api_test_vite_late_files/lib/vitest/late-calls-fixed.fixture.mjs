/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_late_files/lib/vitest/late-calls-fixed.fixture.mjs
 *	@Date: 2026-11-16T00:19:47-08:00 (1794817187)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:06:49-08:00 (1795536409)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Run by `permissions-stack-settings-fixed` in a vitest of its own: the late-files fixture with the
 * process's `Error.prepareStackTrace` and `Error.stackTraceLimit` fixed in place (read-only, non-configurable) before
 * the host imports its late files, so their registrations (#714) are made after the settings were fixed. Prints what
 * every call gave as one JSON line.
 * @module api_test_vite_late_files.vitest.late-calls-fixed
 */
import { it } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCalls } from "../calls.mjs";

it("reports every call with the stack settings fixed in place", async () => {
	Object.defineProperty(Error, "prepareStackTrace", { value: () => "", writable: false, configurable: false });
	Object.defineProperty(Error, "stackTraceLimit", { value: 0, writable: false, configurable: false });
	process.stdout.write(`LATE-CALLS ${JSON.stringify(await runCalls(slothlet))}\n`);
});
