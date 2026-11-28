/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_leaf_file_import_browser/late/zulu.mjs
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
 * @fileoverview A sibling api file that imports the keeper leaf's file, after slothlet loads the keeper leaf. What that
 * import evaluates is this file's code.
 *
 * @module api_tests/api_test_leaf_file_import_browser/late/zulu
 */

import * as keeper from "./keeper.mjs";

/**
 * Call the vault's secret through the keeper file this file loaded.
 * @returns {string} The secret, when this file may have it.
 * @public
 * @example
 * api.late.zulu.viaCopy(); // throws PERMISSION_DENIED
 */
export function viaCopy() {
	return keeper.read();
}

/**
 * Report who the vault sees, asked through the keeper file this file loaded.
 * @returns {string|null} The caller's api path.
 * @public
 * @example
 * api.late.zulu.whoViaCopy(); // "late.zulu.whoViaCopy"
 */
export function whoViaCopy() {
	return keeper.who();
}

/**
 * Hand out the keeper file's `read` as this file loaded it, for the host to run.
 * @returns {Function} The function.
 * @public
 * @example
 * api.late.zulu.give()(); // throws PERMISSION_DENIED
 */
export function give() {
	return keeper.read;
}

/**
 * Hand out the keeper file's `read` nested in plain data, for the host to run.
 * @returns {{fn: Function}} The function, in an object.
 * @public
 * @example
 * api.late.zulu.giveNested().fn(); // throws PERMISSION_DENIED
 */
export function giveNested() {
	return { fn: keeper.read };
}

/**
 * Whether the keeper file this file loaded is the module slothlet built the keeper leaf from.
 * @param {Function} leafRead - The keeper leaf's `read`, as the host reads it off the api.
 * @returns {boolean} True when it is the same function.
 * @public
 * @example
 * api.late.zulu.sameAs(fn); // false
 */
export function sameAs(leafRead) {
	return keeper.read === leafRead;
}
