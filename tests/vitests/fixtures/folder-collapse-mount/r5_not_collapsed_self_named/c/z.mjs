/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/folder-collapse-mount/r5_not_collapsed_self_named/c/z.mjs
 *	@Date: 2026-11-13T16:59:41-08:00 (1794617981)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T17:24:40-08:00 (1794619480)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `c/z.mjs` of fixture `r5_not_collapsed_self_named`: a same-named folder mounted at its own name (Rule 13 with F09). Each function returns `"<file>:<export>"` so a test can tell which file and export a node is.
 * @module folder-collapse-mount.r5_not_collapsed_self_named
 */

/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
export function a() {
	return "c/z.mjs:a";
}
