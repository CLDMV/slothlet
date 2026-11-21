/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_body_mutable_arg/api/other.mjs
 *	@Date: 2026-11-07T21:44:01-08:00 (1794116641)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-07T21:46:25-08:00 (1794116785)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A second module of the leaf-body tests (#717): it calls the project module's own leaf with plain data
 * that can still be changed.
 * @module api_tests/api_test_leaf_body_mutable_arg/other
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Call `project.own` with a mutable object.
 * @returns {Promise<unknown>} What it gave.
 * @example
 * await api.other.callOwn(); // { who: "project.own", open: "open", id: "x" }
 */
export async function callOwn() {
	return self.project.own({ id: "x" });
}
