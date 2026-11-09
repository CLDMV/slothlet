/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_shared_helper_import_split/vitest/plugin.mjs
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
 * @fileoverview The `slothletInstanceImports()` plugin for the shared-helper fixture's vitest config (#715), loaded by
 * Node from here, so the build of slothlet the process's export conditions name is the one used.
 * @module api_test_shared_helper_import_split.vitest.plugin
 */
export { slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";
