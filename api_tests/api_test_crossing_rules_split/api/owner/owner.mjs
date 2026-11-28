/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_crossing_rules_split/api/owner/owner.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:53-08:00 (1795868873)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The owner of the split fixture: hands out a class no node exports, inside data, and runs what it is
 * handed.
 * @module api_test_crossing_rules/split/owner/owner
 */

/** A class no node exports. */
class Hidden {
	hi() {
		return "hi";
	}
}

/**
 * The class inside data.
 * @returns {{Hidden: Function}} The data.
 */
export function hiddenCls() {
	return { Hidden };
}

/**
 * Run a function handed in.
 * @param {Function} fn - The function.
 * @returns {string} `"ran"`.
 */
export function run(fn) {
	fn();
	return "ran";
}

/**
 * Whether `Hidden` was given a `make` member, removing it.
 * @returns {boolean} True when it was.
 */
export function landed() {
	const hit = Object.hasOwn(Hidden, "make");
	delete Hidden.make;
	return hit;
}
