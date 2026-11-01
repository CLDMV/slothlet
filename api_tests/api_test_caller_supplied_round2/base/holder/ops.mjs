/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round2/base/holder/ops.mjs
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
 * @fileoverview A base module whose file the supplier imports raw (#597): it may call the vault's secret, and runs
 * what it is handed.
 *
 * @module api_tests/api_test_caller_supplied_round2/base/holder/ops
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Call a function it was handed.
 * @param {function(): *} fn - The function.
 * @returns {*} What it returned.
 * @public
 * @example
 * api.holder.ops.run(() => 1); // 1
 */
export function run(fn) {
	return fn();
}

/**
 * Call the `fn` of an options object it was handed.
 * @param {{fn: function(): *}} options - The options.
 * @returns {*} What `fn` returned.
 * @public
 * @example
 * api.holder.ops.runIn({ fn: () => 1 }); // 1
 */
export function runIn(options) {
	return options.fn();
}

/**
 * Call the vault's secret.
 * @returns {string} The secret.
 * @public
 * @example
 * api.holder.ops.useSecret(); // "s3cret"
 */
export function useSecret() {
	return self.vault.secret.secret();
}

/**
 * Hand out this module's own `useSecret` function as a value.
 * @returns {function(): string} The function.
 * @public
 * @example
 * api.holder.ops.share()(); // "s3cret", when called by the host
 */
export function share() {
	return useSecret;
}
