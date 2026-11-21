/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_positions/cjsobj.cjs
 *	@Date: 2026-11-11T22:55:16-08:00 (1794466516)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:54-08:00 (1794477414)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A CommonJS file exporting two locals with the same text through an object literal.
 * @module api_test_leaf_positions.cjsobj
 * @memberof module:api_test_leaf_positions
 */
// The runtime is an ES module: a CommonJS file reaches it through import().
let self;
import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

/**
 * Exported as `shown`.
 * @returns {function(): string} A function that reads the vault.
 */
const first = () => () => self.vault.get();

/**
 * Exported as `hidden`.
 * @returns {function(): string} A function that reads the vault.
 */
const second = () => () => self.vault.get();

module.exports = { shown: first, hidden: second };
