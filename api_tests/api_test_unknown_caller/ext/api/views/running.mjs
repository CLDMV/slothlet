/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_unknown_caller/ext/api/views/running.mjs
 *	@Date: 2026-11-09T02:00:00-08:00 (1794222000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-09T02:00:00-08:00 (1794222000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The extension's view (`ext.views.running.render`), in a folder of its own so a lazy mount loads it apart.
 * @module api_test_unknown_caller.ext.views.running
 */

/**
 * Render a label.
 * @param {string} label - What to render.
 * @returns {string} `"rendered:<label>"`.
 */
export function render(label) {
	return `rendered:${label}`;
}
