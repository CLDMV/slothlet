/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/fixtures/folder-collapse-rules/f05_index/e/e/index.mjs
 *	@Date: 2026-11-13T00:23:16-08:00 (1794558196)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:58-08:00 (1795869058)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `e/e/index.mjs` of fixture `f05_index`: a same-named folder combined with a flattening rule (#743). Each function returns `"<file>:<export>"` so a test can tell which file and export a node is.
 * @module folder-collapse-rules.f05_index
 */

/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
export function a() {
	return "e/e/index.mjs:a";
}

/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
export function b() {
	return "e/e/index.mjs:b";
}
