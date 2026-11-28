/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/fixtures/folder-collapse-rules/__base/hold.mjs
 *	@Date: 2026-11-13T00:23:16-08:00 (1794558196)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:57-08:00 (1795869057)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `hold.mjs` of fixture `__base`: a same-named folder combined with a flattening rule (#743). Each function returns `"<file>:<export>"` so a test can tell which file and export a node is.
 * @module folder-collapse-rules.__base
 */

/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
export function hold() {
	return "hold.mjs:hold";
}
