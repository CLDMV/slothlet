/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_inspect_accessors/viewer/viewer.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:21-08:00 (1795868901)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Inspects `self.held.record` as module code does.
 * @module api_test_inspect_accessors/viewer/viewer
 */

import { self } from "@cldmv/slothlet/runtime";
import util from "node:util";

/**
 * What `util.inspect` shows the module of `self.held.record`.
 * @returns {string} The text.
 */
export function view() {
	return util.inspect(self.held.record);
}
