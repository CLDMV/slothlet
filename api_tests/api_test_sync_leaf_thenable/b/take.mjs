/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_sync_leaf_thenable/b/take.mjs
 *	@Date: 2026-11-03T04:44:33-08:00 (1793709873)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T05:23:26-08:00 (1793712206)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Module `b`'s receiving side for the sync-leaf-thenable tests (#599): awaits a thenable another
 * module hands it, which is the reverse case (#597).
 *
 * @module api_tests/api_test_sync_leaf_thenable/b/take
 */

/**
 * Await whatever is passed in.
 * @param {*} thenable - A thenable from the caller.
 * @returns {Promise<*>} What it resolved with.
 * @public
 * @example
 * await api.b.take.awaitIt(Promise.resolve(1)); // 1
 */
export async function awaitIt(thenable) {
	return await thenable;
}
