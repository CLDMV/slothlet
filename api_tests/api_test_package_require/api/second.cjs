/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_package_require/api/second.cjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794675600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:00:00-08:00 (1794675600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS api file requiring the packages `count-main` and `count-exports` while it loads, as another
 * CommonJS api file of this folder does, and `count-later` inside a function.
 * @module api_test_package_require.second
 */
let self;
// The runtime is an ES module: a CommonJS file reaches it with a dynamic import.
import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

const packages = { main: require("count-main"), exports: require("count-exports") };

/**
 * Count one up in a package.
 * @param {string} name - `"main"`, `"exports"` or `"later"`.
 * @returns {number} The package's count so far.
 * @example
 * api.second.bump("main"); // 1
 */
function bump(name) {
	return (name === "later" ? require("count-later") : packages[name]).bump();
}

/**
 * Read the vault through a package's own code, inside this file's call.
 * @param {string} name - `"main"`, `"exports"` or `"later"`.
 * @returns {string} What the package read.
 * @example
 * api.second.read("main"); // "SECRET"
 */
function read(name) {
	return (name === "later" ? require("count-later") : packages[name]).read(self);
}

module.exports = { bump, read };
