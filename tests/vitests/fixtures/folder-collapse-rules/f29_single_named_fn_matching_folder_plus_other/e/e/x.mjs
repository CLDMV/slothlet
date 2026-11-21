/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/folder-collapse-rules/f29_single_named_fn_matching_folder_plus_other/e/e/x.mjs
 *	@Date: 2026-11-13T00:23:16-08:00 (1794558196)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T00:30:08-08:00 (1794558608)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `e/e/x.mjs` of fixture `f29_single_named_fn_matching_folder_plus_other`: a same-named folder combined with a flattening rule (#743). Each function returns `"<file>:<export>"` so a test can tell which file and export a node is.
 * @module folder-collapse-rules.f29_single_named_fn_matching_folder_plus_other
 */

/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
export function e() {
	return "e/e/x.mjs:e";
}

/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
export function other() {
	return "e/e/x.mjs:other";
}
