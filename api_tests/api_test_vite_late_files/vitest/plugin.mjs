/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_late_files/vitest/plugin.mjs
 *	@Date: 2026-11-06T20:00:22-08:00 (1794024022)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T20:13:54-08:00 (1794024834)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `slothletInstanceImports()` plugin for the late-files fixture's vitest config (#714), loaded by Node
 * from here, so the build of slothlet the process's export conditions name is the one used.
 * @module api_test_vite_late_files.vitest.plugin
 */
export { slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";
