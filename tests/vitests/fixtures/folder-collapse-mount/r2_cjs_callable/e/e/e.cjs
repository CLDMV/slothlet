/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/folder-collapse-mount/r2_cjs_callable/e/e/e.cjs
 *	@Date: 2026-11-13T16:59:41-08:00 (1794617981)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T17:24:39-08:00 (1794619479)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `e/e/e.cjs` of fixture `r2_cjs_callable`: a same-named folder mounted at its own name (Rule 13 with F09). Each function returns `"<file>:<export>"` so a test can tell which file and export a node is.
 * @module folder-collapse-mount.r2_cjs_callable
 */

/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
function e() {
	return "e/e/e.cjs:default";
}
/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
e.a = function a() {
	return "e/e/e.cjs:a";
};
module.exports = e;
