/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/single-file-default/p2_doc_example/processor/process.mjs
 *	@Date: 2026-11-14T08:20:39-08:00 (1794673239)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:08:55-08:00 (1794676135)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview F05's own example (docs/API-RULES/API-FLATTENING.md): `processor/process.mjs` exporting a default
 * function named `processor`.
 * @module single-file-default.p2_doc_example
 */

/**
 * Upper-case the input.
 * @param {string} [input=""] - Text.
 * @returns {string} Where it comes from, then the text upper-cased.
 */
export default function processor(input = "") {
	return `processor/process.mjs:default${input.toUpperCase()}`;
}
