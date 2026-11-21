/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_plain_require/helpers/plain.cjs
 *	@Date: 2026-11-13T09:00:00-08:00 (1794589200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T09:00:00-08:00 (1794589200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS helper two api files require through a `require` made from a plain path. Loaded once per
 * process, as Node loads such a file.
 * @module api_test_plain_require.helpers.plain
 */
let self;
// The runtime is an ES module: a CommonJS file reaches it with a dynamic import.
import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

let count = 0;

/**
 * Count one up.
 * @returns {number} The count so far.
 */
function bump() {
	return ++count;
}

/**
 * Read the vault.
 * @returns {string} What the vault holds.
 */
function read() {
	return self.vault.get();
}

module.exports = { bump, read };
