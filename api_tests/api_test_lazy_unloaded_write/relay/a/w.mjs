/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/relay/a/w.mjs
 *	@Date: 2026-11-04T08:12:26-08:00 (1793808746)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T08:22:55-08:00 (1793809375)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A setter that writes somewhere else (#653): assigning `obj.s` writes `g` through the node the function
 * the test left at `Symbol.for("slothlet.test.i653.relay")` reads, if any. Its load waits for the test to let it finish
 * while the test asks it to, and loads at once otherwise.
 */
await globalThis[Symbol.for("slothlet.test.i653.relayGate")];

/**
 * An object whose `s` setter writes `g = s + 1` on the node the test hands over.
 * @type {{s: number}}
 */
export const obj = {
	set s(value) {
		const target = globalThis[Symbol.for("slothlet.test.i653.relay")]?.();
		if (target) target.g = value + 1;
	}
};
