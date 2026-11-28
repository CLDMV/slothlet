/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_warnings/monitor.mjs
 *	@Date: 2026-11-16T17:41:29-08:00 (1794879689)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:10-08:00 (1795869010)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: module code reading `self.slothlet.warnings` for the per-instance warnings suite.
 * @module api_test_warnings.monitor
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The codes of the instance's warnings, as module code reads them.
 * @returns {string[]} Warning codes.
 * @example
 * api.monitor.codes();
 */
export function codes() {
	return self.slothlet.warnings.get().map((warning) => warning.code);
}
