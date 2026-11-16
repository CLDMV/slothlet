/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/fixtures/folder-collapse-rules/f07_callable_default_named/e/e/e.mjs
 *	@Date: 2026-11-13T00:23:16-08:00 (1794558196)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T00:30:06-08:00 (1794558606)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `e/e/e.mjs` of fixture `f07_callable_default_named`: a same-named folder combined with a flattening rule (#743). Each function returns `"<file>:<export>"` so a test can tell which file and export a node is.
 * @module folder-collapse-rules.f07_callable_default_named
 */

/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
export default function e() {
	return "e/e/e.mjs:default";
}

/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
export function a() {
	return "e/e/e.mjs:a";
}

/**
 * Name the file and export this is.
 * @returns {string} The file and export.
 */
export function b() {
	return "e/e/e.mjs:b";
}
