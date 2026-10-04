/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_export_shadow/reader/reader.mjs
 *	@Date: 2026-09-27T08:20:21-07:00 (1790522421)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:33-07:00 (1791090873)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Reads the owner module's exports from another module (#475).
 */

/**
 * Read one of owner's exports.
 * @param {string} key - Export name.
 * @returns {*} The value read through `self`.
 */
export const read = (key) => self.owner[key];
