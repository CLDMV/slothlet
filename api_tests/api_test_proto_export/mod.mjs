/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_proto_export/mod.mjs
 *	@Date: 2026-10-12T15:24:17-07:00 (1791843857)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-12T15:31:31-07:00 (1791844291)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module exporting a member named `__proto__`, which no api path can hold (#585 review).
 * @module api_test_proto_export.mod
 */

const tag = { role: "x" };

export { tag as __proto__ };

/** @type {string} Ordinary sibling export; the file is refused as a whole. */
export const fine = "fine";
