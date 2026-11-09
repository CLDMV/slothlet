/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_unknown_caller/shared/call.mjs
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
 * @fileoverview Plain module code in a folder the instance hides: no leaf is built from it, so its frames name no
 * definer.
 * @module api_test_unknown_caller.shared.call
 */

/**
 * Call `views.running.render` on a node.
 * @param {object} target - The node.
 * @param {string} label - What to render.
 * @returns {*} What `render` returned.
 */
export function callRender(target, label) {
	return target.views.running.render(label);
}
