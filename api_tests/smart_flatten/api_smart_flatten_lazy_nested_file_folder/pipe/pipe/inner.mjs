/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_lazy_nested_file_folder/pipe/pipe/inner.mjs
 *	@Date: 2026-03-15T00:00:00-08:00 (1773705600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-08 19:13:56 -07:00 (1773022436)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview inner.mjs inside the pipe/pipe/ subfolder.
 * Exists solely to give the inner pipe/ directory some content so it is a valid folder.
 * @module api_smart_flatten_lazy_nested_file_folder.pipe.pipe.inner
 */

/**
 * Inner pipe helper.
 * @returns {string} Inner identifier.
 * @example
 * innerHelper(); // "inner-pipe"
 */
export function innerHelper() {
	return "inner-pipe";
}
