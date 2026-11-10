/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_own_package_imports/vitest/plugin.mjs
 *	@Date: 2026-11-08T16:46:18-08:00 (1794185178)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:56:52-08:00 (1794185812)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `slothletInstanceImports()` plugin for the own-package fixture's vitest config (#715), loaded by
 * Node from here, so the build of slothlet the process's export conditions name is the one used.
 * @module api_test_own_package_imports.vitest.plugin
 */

export { slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";
