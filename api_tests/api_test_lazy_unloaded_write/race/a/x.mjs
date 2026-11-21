/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/race/a/x.mjs
 *	@Date: 2026-11-04T07:11:17-08:00 (1793805077)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T07:22:51-08:00 (1793805771)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module whose load waits for the test to let it finish (#653), and loads at once otherwise. It
 * exports a member with a getter only, so a change queued for it is refused when it loads.
 */
await globalThis[Symbol.for("slothlet.test.i653.raceGate")];

/**
 * An export with a getter and no setter: assigning the member is refused.
 * @type {{g: number}}
 */
export const getterOnly = {
	get g() {
		return 1;
	}
};
