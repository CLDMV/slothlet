/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_events/listeners.mjs
 *	@Date: 2026-09-28T21:34:06-07:00 (1790656446)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 21:34:06 -07:00 (1790656446)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self, context } from "@cldmv/slothlet/runtime";

const received = [];
const failures = new Map();

/**
 * Subscribe a tagged listener as this module. Each delivery is recorded (tag, payload, event, and
 * the `user` key of the context the listener runs in) so a test can assert who received what, and
 * under which context. A listener armed with {@link failNext} throws instead of recording.
 * @param {string} eventName - Event to subscribe to.
 * @param {string} tag - Label recorded with each delivery.
 * @param {object} [options] - Options forwarded to `event.on` (`key`, `once`).
 * @returns {{ level: string, id: string }} The granted level and the listener identity.
 */
export function listen(eventName, tag, options = {}) {
	const { level, id } = self.slothlet.event.on(
		eventName,
		async (payload, meta) => {
			const remaining = failures.get(tag) ?? 0;
			if (remaining > 0) {
				failures.set(tag, remaining - 1);
				throw new TypeError(`listener ${tag} failed`);
			}
			received.push({ tag, payload, event: meta.event, user: context.user ?? null });
		},
		options
	);
	return { level, id };
}

/**
 * Make the listener with this tag throw on its next `times` deliveries.
 * @param {string} tag - Listener tag.
 * @param {number} [times=1] - Number of deliveries that should throw.
 * @returns {void}
 */
export function failNext(tag, times = 1) {
	failures.set(tag, times);
}

/**
 * Return and clear the recorded deliveries.
 * @returns {Array<{tag: string, payload: *, event: string, user: *}>} Deliveries since the last drain.
 */
export function drain() {
	const out = received.slice();
	received.length = 0;
	return out;
}
