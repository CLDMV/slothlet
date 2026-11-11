/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_shared_helper_import_split/probe.mjs
 *	@Date: 2026-11-08T15:50:17-08:00 (1794181817)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:00:38-08:00 (1794182438)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Runs the shared-helper fixture (#715) under Node's own loader and prints what every case gave as JSON.
 * @module api_test_shared_helper_import_split.probe
 */
import { linkSharedLib } from "./link.mjs";

linkSharedLib();
const { default: slothlet } = await import("@cldmv/slothlet");
const { runCalls } = await import("./calls.mjs");
console.log(JSON.stringify(await runCalls(slothlet)));
