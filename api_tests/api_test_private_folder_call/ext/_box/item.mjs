/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_folder_call/ext/_box/item.mjs
 *	@Date: 2026-11-25T13:12:58-08:00 (1795641178)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:19:50-08:00 (1795641590)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module mounted with `api.slothlet.api.add("ext", …)`. A file under its underscore-named folder: `_box` holds no function of its own, so it is a public
 * mount, and `open` is a public member of it. `_seal` is a real private member and stays private to this module.
 * @module api_test_private_folder_call.ext._box.item
 * @memberof module:api_test_private_folder_call
 */

/**
 * A public function under the underscore-named folder.
 * @returns {string} "opened".
 */
export function open() {
	return "opened";
}

/**
 * A module-private function under the same folder.
 * @returns {string} "sealed".
 */
export function _seal() {
	return "sealed";
}
