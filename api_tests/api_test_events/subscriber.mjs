/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_events/subscriber.mjs
 *	@Date: 2026-09-17 00:00:00 -07:00
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-17 00:00:00 -07:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

const received = [];

/**
 * Subscribe to an event as this module. Returns the granted delivery level so a test can assert
 * per-subscriber gating. Deliveries are recorded into an internal buffer readable via `drain()`.
 * @param {string} eventName - Event to subscribe to.
 * @returns {"deny"|"notify"|"allow"} The granted level.
 */
export function subscribe(eventName) {
	const { level } = self.slothlet.event.on(eventName, (payload, meta) => {
		received.push({ payload, meta });
	});
	return level;
}

/**
 * Return and clear the recorded deliveries.
 * @returns {Array<{payload: *, meta: object}>} Deliveries since the last drain.
 */
export function drain() {
	const out = received.slice();
	received.length = 0;
	return out;
}
