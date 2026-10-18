/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_round7/brokenplug/probe.mjs
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
 * @fileoverview A module whose top level awaits and then throws (#597): adding it fails once the await is over.
 *
 * @module api_tests/api_test_caller_supplied_round7/brokenplug/probe
 */

await new Promise((resolve) => setTimeout(resolve, 30));

throw new Error("brokenplug: failed to load");

/**
 * Never reached: the module fails to load.
 * @returns {string} Nothing.
 * @public
 * @example
 * api.brokenplug.probe.never();
 */
export function never() {
	return "never";
}
