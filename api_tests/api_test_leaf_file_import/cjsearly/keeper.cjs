/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_file_import/cjsearly/keeper.cjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T00:00:00-08:00 (1794816000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A leaf that may call the vault's secret. A sibling api file of its folder loads this file itself too;
 * what that load evaluates is the sibling's code, held to the sibling's rules, while this leaf stays itself.
 *
 * @module api_tests/api_test_leaf_file_import/cjsearly/keeper
 */

"use strict";

// The runtime is an ES module: taken once it has loaded, long before any of these run.
let self;
import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

/**
 * Call the vault's secret.
 * @returns {string} The secret.
 * @public
 * @example
 * api.cjsearly.keeper.read(); // "s3cret"
 */
function read() {
	return self.vault.secret.secret();
}

/**
 * Report who the vault sees.
 * @returns {string|null} The caller's api path.
 * @public
 * @example
 * api.cjsearly.keeper.who(); // "cjsearly.keeper.who"
 */
function who() {
	return self.vault.secret.whoami();
}

module.exports = { read, who };
