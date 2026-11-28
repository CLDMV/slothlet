/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_helper_imports_mixed/lib/esm-counter.mjs
 *	@Date: 2026-10-02T12:27:51-07:00 (1790969271)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:14-08:00 (1795868894)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview ES module required by a CommonJS leaf and imported by an ESM leaf (#534). It has a
 * default export, so `require()` returns Node's `__esModule` facade, and imports a second-level helper.
 * @module api_test_helper_imports.mixed.lib.esmCounter
 * @internal
 */
import { bump as chainBump } from "./esm-chain.mjs";

let count = 0;

/**
 * Increment this module's counter.
 * @returns {number} The counter after incrementing.
 */
export function bump() {
	return ++count;
}

/**
 * Increment the second-level helper's counter.
 * @returns {number} The counter after incrementing.
 */
export function chain() {
	return chainBump();
}

/**
 * Default export: also increments this module's counter.
 * @returns {number} The counter after incrementing.
 */
export default function defaultBump() {
	return ++count;
}
