/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_package_record/__probe.mjs
 *	@Date: 2026-11-15T15:00:00-08:00 (1794787200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T15:00:00-08:00 (1794787200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The package table of `api/` (see `table.mjs`) under Node's own loader, run in a child process by
 * `tests/vitests/suites/permissions/permissions-vite-package-record.test.vitest.mjs`. Prints the table as JSON.
 * @module api_tests/api_test_vite_package_record/__probe
 */

import slothlet from "@cldmv/slothlet";
import { packageTable } from "./table.mjs";

process.stdout.write(JSON.stringify(await packageTable(slothlet)));
