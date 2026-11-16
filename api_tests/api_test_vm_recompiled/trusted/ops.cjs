/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vm_recompiled/trusted/ops.cjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS module that may call the vault's secret. The reader compiles copies of this file's exact
 * source under its file name; those copies are the reader's code, not this module's.
 *
 * @module api_tests/api_test_vm_recompiled/trusted/ops
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
 * api.trusted.ops.read(); // "s3cret"
 */
function read() {
	return self.vault.secret.secret();
}

/**
 * Report who the vault sees.
 * @returns {string|null} The caller's api path.
 * @public
 * @example
 * api.trusted.ops.who(); // "trusted.ops.who"
 */
function who() {
	return self.vault.secret.whoami();
}

/**
 * Run a function handed in.
 * @param {Function} fn - The function.
 * @returns {*} What it returned.
 * @public
 * @example
 * api.trusted.ops.run(() => 1); // 1
 */
function run(fn) {
	return fn();
}

/**
 * Run the function left on the global object under the name given, as code that calls whatever it finds there.
 * @param {string} name - The global's name.
 * @returns {*} What it returned.
 * @public
 * @example
 * api.trusted.ops.runGlobal("planted");
 */
function runGlobal(name) {
	return globalThis[name]();
}

module.exports = { read, who, run, runGlobal };
