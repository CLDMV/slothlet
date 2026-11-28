/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_leaf_file_import_siblings/api/cjslate/keeper.cjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:32-08:00 (1795868912)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A leaf that may call the vault's secret. A sibling api file of its folder imports this file, which
 * module code may not: that sibling's load is refused.
 *
 * @module api_tests/api_test_leaf_file_import_siblings/api/cjslate/keeper
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
 * api.cjslate.keeper.read(); // "s3cret"
 */
function read() {
	return self.vault.secret.secret();
}

/**
 * Report who the vault sees.
 * @returns {string|null} The caller's api path.
 * @public
 * @example
 * api.cjslate.keeper.who(); // "cjslate.keeper.who"
 */
function who() {
	return self.vault.secret.whoami();
}

module.exports = { read, who };
