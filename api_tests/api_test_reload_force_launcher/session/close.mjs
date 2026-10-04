/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_reload_force_launcher/session/close.mjs
 *	@Date: 2026-09-29T02:01:58-07:00 (1790672518)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:43-07:00 (1791090883)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf only the overwritten module provides, shadowed by the overwrite (#530).
 * @module api_test_reload_force_launcher.session.close
 */

/**
 * @function close
 * @returns {string} `"launcher:close"`.
 */
export function close() {
	return "launcher:close";
}
