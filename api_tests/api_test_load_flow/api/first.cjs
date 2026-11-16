/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_flow/api/first.cjs
 *	@Date: 2026-11-12T22:50:28-08:00 (1794552628)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T22:50:28-08:00 (1794552628)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS api file, loaded before `second.mjs`. It asks for slothlet's runtime with a dynamic import
 * it does not wait for, as a CommonJS file does.
 * @module api_test_load_flow.first
 */
let self;
import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

/**
 * Read the vault.
 * @returns {string} What the vault holds.
 * @example
 * api.first.read(); // "SECRET"
 */
function read() {
	return self.vault.get();
}

module.exports = { read };
