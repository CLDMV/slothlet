/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_file_import/cjslate/zulu.cjs
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
 * @fileoverview A sibling api file that requires the keeper leaf's file while it loads, after slothlet loads the keeper
 * leaf. What that require evaluates is this file's code.
 *
 * @module api_tests/api_test_leaf_file_import/cjslate/zulu
 */

"use strict";

const keeper = require("./keeper.cjs");

/**
 * Call the vault's secret through the keeper file this file loaded.
 * @returns {string} The secret, when this file may have it.
 * @public
 * @example
 * api.cjslate.zulu.viaCopy(); // throws PERMISSION_DENIED
 */
function viaCopy() {
	return keeper.read();
}

/**
 * Report who the vault sees, asked through the keeper file this file loaded.
 * @returns {string|null} The caller's api path.
 * @public
 * @example
 * api.cjslate.zulu.whoViaCopy(); // "cjslate.zulu.whoViaCopy"
 */
function whoViaCopy() {
	return keeper.who();
}

/**
 * Hand out the keeper file's `read` as this file loaded it, for the host to run.
 * @returns {Function} The function.
 * @public
 * @example
 * api.cjslate.zulu.give()(); // throws PERMISSION_DENIED
 */
function give() {
	return keeper.read;
}

/**
 * Hand out the keeper file's `read` nested in plain data, for the host to run.
 * @returns {{fn: Function}} The function, in an object.
 * @public
 * @example
 * api.cjslate.zulu.giveNested().fn(); // throws PERMISSION_DENIED
 */
function giveNested() {
	return { fn: keeper.read };
}

/**
 * Whether the keeper file this file loaded is the module slothlet built the keeper leaf from.
 * @param {Function} leafRead - The keeper leaf's `read`, as the host reads it off the api.
 * @returns {boolean} True when it is the same function.
 * @public
 * @example
 * api.cjslate.zulu.sameAs(fn); // false
 */
function sameAs(leafRead) {
	return keeper.read === leafRead;
}

module.exports = { viaCopy, whoViaCopy, give, giveNested, sameAs };
