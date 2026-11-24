/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_own_package_imports/lib/probe.mjs
 *	@Date: 2026-11-08T16:46:18-08:00 (1794185178)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:06:05-08:00 (1795536365)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Runs the own-package fixture (#715) under Node's own loader and prints what every case gave as JSON.
 * @module api_test_own_package_imports.probe
 */

const { default: slothlet } = await import("@cldmv/slothlet");
const { runCalls } = await import("./calls.mjs");
console.log(JSON.stringify(await runCalls(slothlet)));
