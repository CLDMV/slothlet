/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/notifications/email.mjs
 *	@Date: 2026-05-27 19:05:26 -07:00 (1779933926)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-27 20:44:29 -07:00 (1779939869)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Fixture for Rule 5 / C02: file WITH a default export in a multi-default folder.
 * Gets preserved as its own namespace: api.notifications.email(...)
 */

/**
 * Send an email notification.
 * @param {string} to - Recipient address.
 * @param {string} msg - Message body.
 * @returns {{ sent: boolean, via: string, to: string }} Result object.
 * @example
 * email("a@x", "hi"); // { sent: true, via: "email", to: "a@x" }
 */
export default function send(to, msg) {
	return { sent: true, via: "email", to, msg };
}
