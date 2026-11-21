/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_own_package_requires/probe.mjs
 *	@Date: 2026-11-09T00:26:30-08:00 (1794212790)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-09T00:36:30-08:00 (1794213390)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Runs the own-package require fixture (#715) under Node's own loader and prints what every case gave as
 * JSON.
 * @module api_test_own_package_requires.probe
 */

const { default: slothlet } = await import("@cldmv/slothlet");
const { runCalls } = await import("./calls.mjs");
console.log(JSON.stringify(await runCalls(slothlet)));
