/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/hook-callable-folder/e/e.mjs
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
 * @fileoverview `e/e.mjs` of fixture `hook-callable-folder`: the default export that makes the folder `e` callable. Each function returns "<file>:<export>".
 * @module hook-callable-folder.e
 */

/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
export default function e() {
	return "e/e.mjs:default";
}
