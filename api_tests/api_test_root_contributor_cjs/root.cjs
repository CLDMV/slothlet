/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_root_contributor_cjs/root.cjs
 *	@Date: 2026-11-14T00:00:00-08:00 (1794643200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:30-08:00 (1795868970)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS root file whose export is a function with members of its own: a function, an accessor over a
 * value the file holds, a function that changes that value, and an object with a function.
 * @module api_test_root_contributor_cjs/root
 */

/**
 * The root's own function.
 * @returns {string} A marker.
 */
function main() {
	return "main";
}

/**
 * A member function.
 * @returns {string} A marker.
 */
main.helper = function helper() {
	return "helper";
};

let current = 1;
Object.defineProperty(main, "live", {
	get() {
		return current;
	},
	enumerable: true,
	configurable: true
});

/**
 * Changes the value `live` reads.
 * @param {number} value - The new value.
 * @returns {number} The new value.
 */
main.setLive = function setLive(value) {
	current = value;
	return current;
};

main.cfg = {
	/** @returns {string} A marker. */
	f() {
		return "cfg.f";
	}
};

module.exports = main;
