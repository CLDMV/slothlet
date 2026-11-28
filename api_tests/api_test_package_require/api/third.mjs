/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_package_require/api/third.mjs
 *	@Date: 2026-11-14T09:00:00-08:00 (1794675600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:06-08:00 (1795868946)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview An ES module api file importing the packages the CommonJS api files of this folder require.
 * @module api_test_package_require.third
 */
import { self } from "@cldmv/slothlet/runtime";
import main from "count-main";
import viaExports from "count-exports";

const packages = { main, exports: viaExports };

/**
 * Count one up in a package.
 * @param {string} name - `"main"` or `"exports"`.
 * @returns {number} The package's count so far.
 * @example
 * api.third.bump("main"); // 1
 */
export function bump(name) {
	return packages[name].bump();
}

/**
 * Read the vault through a package's own code, inside this file's call.
 * @param {string} name - `"main"` or `"exports"`.
 * @returns {string} What the package read.
 * @example
 * api.third.read("main"); // "SECRET"
 */
export function read(name) {
	return packages[name].read(self);
}
