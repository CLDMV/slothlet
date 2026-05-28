/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/notifications/helpers.mjs
 *	@Date: 2026-05-27 19:05:43 -07:00 (1779933943)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-27 20:44:29 -07:00 (1779939869)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Fixture for Rule 5 / C03: file WITHOUT a default export in a multi-default folder.
 * Named exports get hoisted into the parent namespace:
 *   api.notifications.formatPhone(...)
 *   api.notifications.RETRY_LIMIT
 * The helpers namespace itself does NOT appear on api.notifications.
 */

/**
 * Format a bare phone number to E.164 by prepending "+1".
 * @param {string} phone - Bare digits (no country code).
 * @returns {string} E.164 formatted number.
 * @example
 * formatPhone("5555555555"); // "+15555555555"
 */
export function formatPhone(phone) {
	return "+1" + phone;
}

/** Maximum number of delivery retries before giving up. */
export const RETRY_LIMIT = 3;
