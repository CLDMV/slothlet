/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_code_strings_staticdata/api/inline.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:47-08:00 (1795868867)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module file that imports a `data:` URL with an `import` statement, resolved as the file links.
 *
 * @module api_tests/api_test_code_strings/staticdata/inline
 */

import seven from "data:text/javascript,export default 7";

/**
 * The imported value.
 * @returns {number} 7.
 * @public
 * @example
 * api.staticdata.inline.value(); // 7
 */
export function value() {
	return seven;
}
