/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_framework_member_exports/nested/probe/holder.mjs
 *	@Date: 2026-11-25T13:17:45-08:00 (1795641465)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:40:45-08:00 (1795642845)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An exported object whose own member is named for one of the wrapper's methods. The member is the
 * framework's name, so it never becomes a member of the node.
 * @module api_test_framework_member_exports.nested.probe.holder
 */

import { note } from "../../lib/capture.mjs";

/** The member's name sorts before `zeta`, so adopting `zeta` would call through it. */
export const box = {
	___createChildWrapper() {
		note("box.___createChildWrapper");
		return undefined;
	},
	zeta: { leaf: 1 }
};

export { calls } from "../../lib/capture.mjs";
