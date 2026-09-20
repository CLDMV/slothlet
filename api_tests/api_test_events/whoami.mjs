/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_events/whoami.mjs
 *	@Date: 2026-09-20 00:00:00 -07:00
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-20 00:00:00 -07:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Report the api path `self.slothlet.caller()` resolves to from inside this module — the module's own
 * identity. A module reading its own identity is not privileged, so the accessor is ungated; this leaf
 * simply exercises it from a module context.
 * @returns {string|null} This module's dotted api path.
 */
export function here() {
	return self.slothlet.caller();
}

/**
 * Capture this module's identity via `caller()` AND subscribe to an event, returning both the captured
 * identity and the granted delivery level — so a test can assert `caller()` reports the SAME identity
 * `event.on` attributes the subscription to (the property a cross-boundary forwarder relies on).
 * @param {string} eventName - Event to subscribe to.
 * @returns {{ identity: string|null, level: "deny"|"notify"|"allow" }} The captured identity and granted level.
 */
export function subscribeAndReport(eventName) {
	const identity = self.slothlet.caller();
	const { level } = self.slothlet.event.on(eventName, () => {});
	return { identity, level };
}
