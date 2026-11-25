/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_framework_name_routes/routes/probe/statics.mjs
 *	@Date: 2026-11-25T14:52:50-08:00 (1795647170)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:03:27-08:00 (1795651407)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A function whose own members are named with the framework's prefix, beside an ordinary one.
 * @module api_test_framework_name_routes.routes.probe.statics
 */

import { planted } from "../../lib/capture.mjs";

/**
 * A function with own members.
 * @returns {string} "statics".
 */
export function tool() {
	return "statics";
}
tool.___createChildWrapper = planted("statics.___createChildWrapper");
tool.____state = { planted: true };
tool.zeta = { leaf: 1 };

export { calls } from "../../lib/capture.mjs";
