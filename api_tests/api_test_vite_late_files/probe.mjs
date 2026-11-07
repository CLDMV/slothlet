/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_late_files/probe.mjs
 *	@Date: 2026-11-06T19:31:26-08:00 (1794022286)
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
 * @fileoverview Runs the late-files fixture (#714) under Node's own loader and prints what every call gave as JSON.
 * @module api_test_vite_late_files.probe
 */
import slothlet from "@cldmv/slothlet";
import { runCalls } from "./calls.mjs";

console.log(JSON.stringify(await runCalls(slothlet)));
