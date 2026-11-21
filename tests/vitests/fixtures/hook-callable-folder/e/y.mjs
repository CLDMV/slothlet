/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/hook-callable-folder/e/y.mjs
 *	@Date: 2026-11-13T21:30:00-08:00 (1794634200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T21:30:00-08:00 (1794634200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `e/y.mjs` of fixture `hook-callable-folder`: a sibling file beside the callable folder's own file. Each function returns "<file>:<export>".
 * @module hook-callable-folder.y
 */

/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
export function b() {
	return "e/y.mjs:b";
}
