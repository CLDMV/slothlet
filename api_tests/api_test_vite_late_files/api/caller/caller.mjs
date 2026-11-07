/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vite_late_files/api/caller/caller.mjs
 *	@Date: 2026-11-06T19:31:26-08:00 (1794022286)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-06T19:39:55-08:00 (1794022795)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that hands another module a plain function of its own (#714), which reaches the other module's
 * leaf when it runs.
 * @module api_test_vite_late_files.caller
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Hand the callee a function that calls its `gated` leaf.
 * @returns {Promise<boolean>} What `hand` gives.
 */
export async function setup() {
	return self.callee.hand(() => self.callee.gated());
}
