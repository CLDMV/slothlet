/**
 * @fileoverview Hands another module a promise inside data, and rejects it later.
 * @module api_test_crossing_rules/pledge
 */

/** Rejects the promise last handed out. */
let rejectIt = () => {};

/**
 * Data holding a pending promise whose rejection this module handles itself.
 * @returns {{pending: Promise<never>}} The data.
 */
export function handled() {
	const pending = new Promise((_, reject) => (rejectIt = reject));
	pending.catch(() => {});
	return { pending };
}

/**
 * Data holding a pending promise nobody has handled.
 * @returns {{pending: Promise<never>}} The data.
 */
export function unhandled() {
	return { pending: new Promise((_, reject) => (rejectIt = reject)) };
}

/**
 * Reject the promise last handed out.
 * @returns {void}
 */
export function settle() {
	rejectIt(new Error("boom"));
}
