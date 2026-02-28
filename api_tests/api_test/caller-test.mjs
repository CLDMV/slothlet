/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/caller-test.mjs
 *	@Date: 2026-02-23T20:21:51-08:00 (1771906911)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:23:14 -08:00 (1772313794)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
 */
export function getCallerMeta() {
	return self.slothlet.metadata.caller();
}
