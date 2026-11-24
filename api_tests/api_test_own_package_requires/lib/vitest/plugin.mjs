/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_own_package_requires/lib/vitest/plugin.mjs
 *	@Date: 2026-11-09T00:26:34-08:00 (1794212794)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:06:06-08:00 (1795536366)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `@cldmv/slothlet/vite` plugin for the own-package require fixture's vitest config (#715), loaded by
 * Node from here, so the build of slothlet the process's export conditions name is the one used.
 * @module api_test_own_package_requires.vitest.plugin
 */

export { plugin } from "@cldmv/slothlet/vite";
