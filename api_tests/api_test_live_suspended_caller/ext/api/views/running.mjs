/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/ext/api/views/running.mjs
 *	@Date: 2026-09-28 18:00:00 -07:00 (1790644800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 18:00:00 -07:00 (1790644800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview The extension's view — reachable by the extension itself, never by the host's `run.*`.
 * @module api_test_live_suspended_caller.ext.views.running
 */

/**
 * Render a label.
 * @param {string} label - What to render.
 * @returns {string} `"rendered:<label>"`.
 */
export function render(label) {
	return `rendered:${label}`;
}
