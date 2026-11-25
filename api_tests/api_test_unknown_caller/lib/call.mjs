/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_unknown_caller/lib/call.mjs
 *	@Date: 2026-11-09T01:58:02-08:00 (1794218282)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T11:38:20-08:00 (1795549100)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A lib helper `resume.mjs` imports, outside every api tree: no leaf is built from it, and its code is
 * the same two calls' as `resume.mjs`'s.
 * @module api_test_unknown_caller.lib.call
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
