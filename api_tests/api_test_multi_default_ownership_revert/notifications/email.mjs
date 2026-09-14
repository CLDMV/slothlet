/**
 * Fixture for #366/#372 ownership-revert coverage: file WITH a default export in a
 * multi-default folder (Rule 5 / C02). Establishes `notifications.email` as a wrapper
 * so the folder qualifies as "multi-default" (paired with sms.mjs below), which is what
 * makes helperA.mjs/helperB.mjs's own no-default exports hoist (C03) instead of nesting.
 */

/**
 * Send an email notification.
 * @param {string} to - Recipient address.
 * @returns {{ sent: boolean, via: string }} Result object.
 */
export default function send(to) {
	return { sent: true, via: "email", to };
}
