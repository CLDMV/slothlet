/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_load_package_frame/lib/host/walk.mjs
 *	@Date: 2026-11-14T08:00:00-08:00 (1794672000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:51-08:00 (1795868931)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A host file's function that calls a callback from frames of its own. The host puts it where the
 * modules of this fixture find it (`globalThis.__loadPackageFrameWalk`).
 * @module api_test_load_package_frame.lib.host.walk
 */

/**
 * Call `callback` from `depth` frames of this function.
 * @param {number} depth - How deep to recurse.
 * @param {function(): *} callback - What to call.
 * @returns {*} What the callback returned.
 * @example
 * walk(3, () => 1); // 1
 */
export function walk(depth, callback) {
	return depth > 0 ? walk(depth - 1, callback) : callback();
}
