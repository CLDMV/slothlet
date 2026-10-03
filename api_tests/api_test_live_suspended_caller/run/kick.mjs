/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/run/kick.mjs
 *	@Date: 2026-09-28 18:00:00 -07:00 (1790644800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 18:00:00 -07:00 (1790644800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Privileged synchronous host leaf that starts an async call and does not await it.
 *
 * @description
 * The started call settles after this leaf has returned, and settling restores the live runtime's
 * caller field to this leaf — which by then is neither running nor suspended. Nothing executing
 * afterwards may be attributed to it.
 *
 * @module api_test_live_suspended_caller.run.kick
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Fire `run.quick` without awaiting it.
 * @returns {string} `"kicked"`.
 */
export function kick() {
	self.run.quick();
	return "kicked";
}
