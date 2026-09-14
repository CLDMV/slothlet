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
