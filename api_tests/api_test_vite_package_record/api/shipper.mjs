/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_vite_package_record/api/shipper.mjs
 *	@Date: 2026-11-15T14:56:32-08:00 (1794783392)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:08-08:00 (1795869008)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that imports two packages, one CommonJS and one an ES module, and hands out their readers.
 * @module api_test_vite_package_record.shipper
 */
import { self } from "@cldmv/slothlet/runtime";
import shippedCjs from "shipped-cjs";
import { read as readEsm } from "shipped-esm";

const readers = { cjs: shippedCjs.read, esm: readEsm };

/**
 * Read the vault through a package's own code, inside this file's call.
 * @param {"cjs"|"esm"} kind - Which package.
 * @returns {string} What the package read.
 * @example
 * api.shipper.own("esm"); // "SECRET"
 */
export function own(kind) {
	return readers[kind](self);
}

/**
 * A package's reader, as it is.
 * @param {"cjs"|"esm"} kind - Which package.
 * @returns {function(object): string} The reader.
 * @example
 * api.runner.run(api.shipper.give("esm")); // the package's code runs inside runner's call
 */
export function give(kind) {
	return readers[kind];
}
