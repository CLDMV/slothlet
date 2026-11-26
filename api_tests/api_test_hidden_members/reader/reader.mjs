/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_hidden_members/reader/reader.mjs
 *	@Date: 2026-11-25T02:33:27-08:00 (1795602807)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T02:59:39-08:00 (1795604379)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that describes another module's objects through `self`.
 * @module api_test_hidden_members/reader
 */

import { self } from "@cldmv/slothlet/runtime";
import { describe } from "../lib/describe.mjs";

/**
 * Describe the objects the checks look at, as this module sees them.
 * @returns {object} The descriptions, by name.
 */
export function look() {
	return {
		conf: describe(self.conf, ["visible", "inner", "hidden", "secret", "computed"]),
		inner: describe(self.conf.inner, ["deep", "tucked"]),
		secret: describe(self.conf.secret, ["deep"]),
		opts: describe(self.named.opts, ["a", "quiet"])
	};
}
