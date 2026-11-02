/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round2/supplier/hooks.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Lets the supplier run code while the callee is executing (#597): the callee notifies this module
 * synchronously, and whatever the supplier armed runs then, as the supplier.
 *
 * @module api_tests/api_test_caller_supplied_round2/supplier/hooks
 */

/** What to run on the next notification. */
let armed = null;

/**
 * Arm a function to run on the next notification.
 * @param {function(): void} fn - The function.
 * @returns {void}
 * @public
 * @example
 * api.supplier.hooks.arm(() => {});
 */
export function arm(fn) {
	armed = fn;
}

/**
 * Run the armed function, once.
 * @returns {void}
 * @public
 * @example
 * api.supplier.hooks.notify();
 */
export function notify() {
	const fn = armed;
	armed = null;
	fn?.();
}
