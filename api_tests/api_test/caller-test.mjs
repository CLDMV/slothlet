/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/caller-test.mjs
 *	@Date: 2026-02-23T20:21:51-08:00 (1771906911)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-12 21:33:00 -07:00 (1773376380)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test module for caller-based path resolution via self.slothlet.metadata.caller().
 * @module api_test.callerTest
 * @memberof module:api_test
 */
/**
 * @namespace callerTest
 * @memberof module:api_test
 */

// Import runtime bindings
import { self } from "@cldmv/slothlet/runtime";

/**
 * Returns the metadata of the slothlet function that invoked this function.
 *
 * Uses self.slothlet.metadata.caller() to read the callerWrapper from the
 * active context-manager store. Returns null when called directly from
 * outside any tracked slothlet execution (no caller in context).
 *
 * @function getCallerMeta
 * @public
 * @returns {object|null} Metadata of the calling slothlet function, or null
 *
 * @example
 * // Called directly — no tracked caller
 * const result = api.callerTest.getCallerMeta(); // → null
 *
 * @example
 * // Called from another slothlet function via self
 * const result = await api.metadataTestHelper.invokeCallerTest(); // → metadata object
 *
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.caller-test.getCallerMeta();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.caller-test.getCallerMeta();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.caller-test.getCallerMeta();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.caller-test.getCallerMeta();
 */
export function getCallerMeta() {
	return self.slothlet.metadata.caller();
}
