/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_late_files/vitest/vitest.fixed.config.mjs
 *	@Date: 2026-11-16T01:30:00-08:00 (1794821400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T01:30:00-08:00 (1794821400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The late-files fixture's vitest config, running `late-calls-fixed.fixture.mjs` only.
 * @module api_test_vite_late_files.vitest.fixed-config
 */
import base from "./vitest.config.mjs";

export default { ...base, test: { ...base.test, include: ["late-calls-fixed.fixture.mjs"] } };
