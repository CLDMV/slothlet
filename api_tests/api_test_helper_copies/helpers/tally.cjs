/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_copies/helpers/tally.cjs
 *	@Date: 2026-11-12T00:24:01-08:00 (1794471841)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T00:24:01-08:00 (1794471841)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS helper file four api files load (`one.mjs` and `two.mjs` import it, `three.cjs` and
 * `four.cjs` require it): it keeps a count in module state and reads the vault with a function of its own.
 * @module api_test_helper_copies.helpers.tallyCjs
 */
let self;
// The runtime is an ES module: a CommonJS file reaches it with a dynamic import.
import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

let count = 0;

/**
 * Count one up.
 * @returns {number} The count so far in this copy of the module.
 * @example
 * bump(); // 1
 */
function bump() {
	return ++count;
}

/**
 * Read the vault. The helper's own function: no leaf's code is written in it.
 * @returns {string} What the vault holds.
 * @example
 * read(); // "SECRET"
 */
function read() {
	return self.vault.get();
}

module.exports = { bump, read };
