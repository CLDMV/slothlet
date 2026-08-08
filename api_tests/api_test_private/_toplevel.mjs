/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private/_toplevel.mjs
 *	@Date: 2026-08-08 12:00:00 -07:00 (1786215600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-08 12:00:00 -07:00 (1786215600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview A root-level module whose own name starts with an underscore (#260).
 *
 * @description
 * Single-underscore files are deliberately not hidden at scan, so this mounts as `api._toplevel`.
 * Privacy attaches to a member OF a module; this path has no parent segment, so it is the mount
 * itself and stays public. Hiding a root-level file is what the `__` prefix and the `hidden` globs
 * are for.
 * @module api_test_private._toplevel
 */

/**
 * Public root-level callable.
 * @returns {string} Fixed marker.
 * @public
 */
export function _toplevel() {
	return "mounted";
}
