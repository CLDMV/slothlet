/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_positions/cjsdup.cjs
 *	@Date: 2026-11-11T22:55:16-08:00 (1794466516)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:53-08:00 (1794477413)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS file assigning two functions with the same text to `exports`.
 * @module api_test_leaf_positions.cjsdup
 * @memberof module:api_test_leaf_positions
 */
// The runtime is an ES module: a CommonJS file reaches it through import().
let self;
import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

/**
 * Hands out a function that reads the vault.
 * @returns {function(): string} The function.
 */
exports.shown = () => () => self.vault.get();

/**
 * Hands out a function that reads the vault, written with the same text as `shown`.
 * @returns {function(): string} The function.
 */
exports.hidden = () => () => self.vault.get();
