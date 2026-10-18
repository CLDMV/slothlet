/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/front/relay.mjs
 *	@Date: 2026-10-18T13:32:03-07:00 (1792355523)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T14:48:51-07:00 (1792360131)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Mounted at apiPath "front" (moduleID "front") by the nested self-assign ownership tests (#625): a
// module calling into `evil`, so `evil` has a module caller while it runs.
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call `evil.x.keepCallerPin` and hand back what it returns.
 * @returns {Promise<Function>} The deferred pin-and-run `evil` handed back.
 */
export function keepCallerPin() {
	return self.evil.x.keepCallerPin();
}
