/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multi_default/notifications/sms.mjs
 *	@Date: 2026-05-27 19:05:33 -07:00 (1779933933)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-27 19:10:12 -07:00 (1779934212)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Fixture for Rule 5 / C02: file WITH a default export in a multi-default folder.
 * Gets preserved as its own namespace: api.notifications.sms(...)
 */

/**
 * Send an SMS notification.
 * @param {string} to - Recipient phone number.
 * @param {string} msg - Message body.
 * @returns {{ sent: boolean, via: string, to: string }} Result object.
 * @example
 * sms("+15555555555", "hi"); // { sent: true, via: "sms", to: "+15555555555" }
 */
export default function send(to, msg) {
	return { sent: true, via: "sms", to, msg };
}
