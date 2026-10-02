/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_restart/counter.mjs
 *	@Date: 2026-09-21T01:27:16+00:00 (1789954036)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-26 22:30:51 -07:00 (1790487051)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview restart() fixture (#504): module-scope state that only a fresh import resets.
 * @module api_test_restart.counter
 */

let count = 0;

/**
 * Increment the module-scope counter.
 * @returns {number} The new count.
 */
export function increment() {
	count += 1;
	return count;
}

/**
 * Read the module-scope counter.
 * @returns {number} The current count.
 */
export function current() {
	return count;
}
