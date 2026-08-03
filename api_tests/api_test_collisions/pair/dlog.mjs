/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_collisions/pair/dlog.mjs
 *	@Date: 2026-08-02 12:00:00 -07:00 (1785697200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-02 12:00:00 -07:00 (1785697200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Callable file colliding with a NON-self-named folder (`dlog/` holds only
 * `only.mjs`): the folder composes a plain namespace, so the merge lands an object product onto
 * the surviving callable — the file's callable keeps the slot under `merge`, the folder's
 * namespace members ride along.
 * @module api_test_collisions.pair.dlog
 * @memberof module:api_test_collisions
 */

/**
 * The first-loaded callable — keeps the slot under `merge`.
 * @returns {string} Tag proving which source answered.
 * @example
 * api.pair.dlog(); // "file-dlog"
 */
export default function fileDlog() {
	return "file-dlog";
}
