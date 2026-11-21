/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/single-file-default/n1_named_fn_other_name/e/x.mjs
 *	@Date: 2026-11-14T08:20:40-08:00 (1794673240)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T09:08:53-08:00 (1794676133)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview No default export: a named function named like the file keeps the file's level (F03 needs the folder's
 * name).
 * @module single-file-default.n1_named_fn_other_name
 */

/**
 * The file's only export.
 * @returns {string} Where it comes from.
 */
export function x() {
	return "e/x.mjs:x";
}
