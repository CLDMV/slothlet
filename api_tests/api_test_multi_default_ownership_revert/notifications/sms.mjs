/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_multi_default_ownership_revert/notifications/sms.mjs
 *	@Date: 2026-09-14T15:15:27-07:00 (1789424127)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:54 -07:00 (1791082974)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Fixture for #366/#372 ownership-revert coverage: second file WITH a default export in
 * the multi-default `notifications` folder (Rule 5 / C02) — see email.mjs for why this
 * pairing matters.
 */

/**
 * Send an SMS notification.
 * @param {string} to - Recipient phone number.
 * @returns {{ sent: boolean, via: string }} Result object.
 */
export default function send(to) {
	return { sent: true, via: "sms", to };
}
